class Game {
    constructor() {
        let canvas = document.getElementById("game");
        this.cm = new CanvasManager(canvas);
        this.assets = new AssetCache();
        this.player = null;
        this.input = new InputController();

        // Targets, countdown timer, and deliveries score
        this.target = null; // instance of Target
        this.deliveries = 0;
        this.timerTotalMs = 3 * 60 * 1000; // 3 minutes total
        this.timerRemainingMs = this.timerTotalMs; // remaining countdown
        // Snapshot of elapsed time at the moment of game over (ms)
        this.elapsedAtGameOverMs = null;

        this.state = 'stopped'; // 'stopped' | 'running' | 'paused'
        this.gameOver = false;   // game over flag
        this.lastTimestamp = 0;
        this.rafId = null;

        // FPS metrics
        this.fps = 0;
        this.framesSinceFpsUpdate = 0;
        this.fpsTimeAccumulatorMs = 0;

        // Fixed timestep simulation (decoupled from render)
        this.fixedDeltaMs = 1000 / 240; // logic at 240 Hz
        this.accumulatorMs = 0;
        this.maxSubSteps = 10; // cap per frame to avoid spiral of death

        // Reuse a bound loop to avoid re-binding each frame
        this._boundLoop = this.loop.bind(this);
        this.time = new Time(this.fixedDeltaMs);

        // Track last view size to detect resize and recenter camera
        this._lastViewW = 0;
        this._lastViewH = 0;

        // Bind resize handler to keep paused view updated
        this._onViewportResize = this.onViewportResize.bind(this);
        window.addEventListener('resize', this._onViewportResize);
        if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
            window.visualViewport.addEventListener('resize', this._onViewportResize);
        }

        // Debug toggles
        this.debugDrawColliders = false;
        window.addEventListener('keydown', (e) => {
            if (e.code === 'F4') {
                this.debugDrawColliders = !this.debugDrawColliders;
                if (this.state === 'paused') {
                    try { this.render(); } catch {}
                }
            }
        });

        // Track last non-zero movement direction (for spawn manager placement)
        this._lastMoveDir = { x: 0, y: 1 };

        // Floating texts (HUD popups) e.g., for boosts
        this.floatTexts = [];
    }

    start() {
        if (this.state === 'running') return;
        console.log("Game started");
        // Center spawn in CSS pixels
        const viewW = this.cm.canvas.width / this.cm.dpr;
        const viewH = this.cm.canvas.height / this.cm.dpr;
        const camCfg = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.camera) ? GAME_CONFIG.camera : {};
        this.camera = new Camera(viewW, viewH, {
            // make deadzone scale with view: half the distance from center to edge
            deadzoneHalfRatio: 0.5,
            smoothness: camCfg.smoothness
        });
        this._lastViewW = viewW;
        this._lastViewH = viewH;
        const playerModel = new Player();
        // Attach stats (from config) to controller for movement/HP
        const stats = new PlayerStats();
        const spawnX = Math.floor((viewW - playerModel.w) / 2);
        const spawnY = Math.floor((viewH - playerModel.h) / 2);
        this.player = new PlayerController(playerModel, spawnX / METERS_TO_PIXELS, spawnY / METERS_TO_PIXELS);
        this.player.stats = stats;
        this.player.model.hp = stats.maxHp;
        // Initialize meta counters
        this.player.model.coins = (GAME_CONFIG.player?.startCoins ?? 0);

        // Create a single route target 50 meters away in a random direction
        this.target = Target.spawnAround(this.player.xM, this.player.yM);
        this.state = 'running';
        this.lastTimestamp = performance.now();
        // Reset game-over snapshot on new run
        this.gameOver = false;
        this.elapsedAtGameOverMs = null;
        // Center camera on player at start
        this.camera.setCenter(this.player.xM + (this.player.w / 2) / METERS_TO_PIXELS, this.player.yM + (this.player.h / 2) / METERS_TO_PIXELS);

        // Spawn manager
        this.spawns = new SpawnManager(this.camera);
        this.spawns.ensureInitial(this.player);

        // Boost manager
        this.boosts = new BoostManager(this.camera, this);

        // Shop manager
        this.shop = new ShopManager(this);

        // Preload essential sprites (player + target chest)
        const preloadList = [
            ...(this.player ? this.player.getAllSpritePaths?.() || [] : []),
            (GAME_CONFIG.target?.sprite) ? GAME_CONFIG.target.sprite : null,
        ].filter(Boolean);
        const preloadPromise = this.assets.preloadPaths(preloadList);
        preloadPromise
            .then(() => {
                // Start background music
                try {
                    this.startMusic();
                    // Install one-time unlock handler for browsers blocking autoplay
                    if (!this._audioUnlockBound) {
                        this._audioUnlockBound = true;
                        this._onUnlockAudio = () => {
                            try {
                                if (this._audio) {
                                    this._audio.play().catch(() => { this.startMusic(); });
                                } else {
                                    this.startMusic();
                                }
                            } catch {}
                        };
                        window.addEventListener('pointerdown', this._onUnlockAudio, { once: true });
                        window.addEventListener('keydown', this._onUnlockAudio, { once: true });
                    }
                } catch {}
                this.rafId = requestAnimationFrame(this._boundLoop);
            });
    }

    stop() {
        if (this.state === 'stopped') return;
        this.state = 'stopped';
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
        console.log("Game stopped");
        // detach input and listeners
        if (this.input) this.input.detach();
        if (this._onViewportResize) {
            window.removeEventListener('resize', this._onViewportResize);
            if (window.visualViewport && typeof window.visualViewport.removeEventListener === 'function') {
                window.visualViewport.removeEventListener('resize', this._onViewportResize);
            }
        }
    }

    pause() {
        if (this.state !== 'running') return;
        this.state = 'paused';
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
        console.log("Game paused");
        if (this.input) this.input.detach();
        // pause music if playing
        try { if (this._audio) this._audio.pause(); } catch {}
        // enable click-to-buy while paused
        if (!this._onClickShop) {
            this._onClickShop = (e) => {
                if (this.state !== 'paused' || this.gameOver) return;
                const rect = this.cm.canvas.getBoundingClientRect();
                const x = (e.clientX - rect.left);
                const y = (e.clientY - rect.top);
                this.handleShopClick(x, y);
            };
            this.cm.canvas.addEventListener('click', this._onClickShop);
        }
        // Draw one overlay frame to show PAUSED immediately
        try { this.render(); } catch (e) { console.error('Render error on pause:', e); }
    }

    resume() {
        if (this.state !== 'paused') return;
        this.state = 'running';
        this.lastTimestamp = performance.now();
        this.rafId = requestAnimationFrame(this._boundLoop);
        console.log("Game resumed");
        if (this.input) this.input.attach?.();
        if (this._onClickShop) {
            this.cm.canvas.removeEventListener('click', this._onClickShop);
            this._onClickShop = null;
        }
        // resume music if available
        try { if (this._audio) this._audio.play().catch(()=>{}); } catch {}
    }

    togglePause() {
        if (this.state === 'stopped') return;
        (this.state === 'paused') ? this.resume() : this.pause();
    }

    onViewportResize() {
        if (this.state === 'stopped') return;
        // Ensure camera matches new canvas size and recenters on player
        const viewW = this.cm.canvas.width / this.cm.dpr;
        const viewH = this.cm.canvas.height / this.cm.dpr;
        if (this.camera) {
            this.camera.setViewSize(viewW, viewH);
            if (this.player) {
                const cx = this.player.x + this.player.w / 2;
                const cy = this.player.y + this.player.h / 2;
                this.camera.setCenter(cx, cy);
            }
        }
        // If paused, redraw one frame so the canvas isn't left blank
        if (this.state === 'paused') {
            try { this.render(); } catch (e) { console.error('Render error on resize while paused:', e); }
        }
    }

    loop(timestamp) {
        if (this.state !== 'running') return;

        const frameDelta = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;

        // Update FPS, countdown timer
        const clamped = this.time.update(frameDelta);
        this.cm.updateFps(clamped);
        this.timerRemainingMs = Math.max(0, this.timerRemainingMs - clamped);
        // End game when countdown reaches zero
        if (!this.gameOver && this.timerRemainingMs <= 0) {
            // Snapshot elapsed time at game-over
            this.elapsedAtGameOverMs = (this.timerTotalMs ?? 0) - (this.timerRemainingMs ?? 0);
            this.gameOver = true;
            this.state = 'paused';
        }

        // Handle resize: if view size changed, update camera and recenter on player
        const curViewW = this.cm.canvas.width / this.cm.dpr;
        const curViewH = this.cm.canvas.height / this.cm.dpr;
        if (curViewW !== this._lastViewW || curViewH !== this._lastViewH) {
            this.camera.setViewSize(curViewW, curViewH);
            if (this.player) {
                const playerCenterX = this.player.x + this.player.w / 2;
                const playerCenterY = this.player.y + this.player.h / 2;
                this.camera.setCenter(playerCenterX, playerCenterY);
            }
            this._lastViewW = curViewW;
            this._lastViewH = curViewH;
        }

        // Accumulate time and run fixed-step updates
        // Clamp extremely large frame gaps (tab inactive, breakpoint, etc.)
        this.accumulatorMs += clamped;

        let steps = 0;
        while (this.accumulatorMs >= this.fixedDeltaMs && steps < this.maxSubSteps) {
            try {
                this.update(this.fixedDeltaMs);
            } catch (e) {
                console.error("Update error:", e);
            }
            this.accumulatorMs -= this.fixedDeltaMs;
            steps++;
        }
        if (steps === this.maxSubSteps && this.accumulatorMs >= this.fixedDeltaMs) {
            this.accumulatorMs = 0;
        }

        try {
            this.render();
        } catch (e) {
            console.error("Render error:", e);
        }

        this.rafId = requestAnimationFrame(this._boundLoop);
    }

    update(delta) {
        // Advance simulation by fixed delta (ms)
        // e.g., physics, AI, timers using 'delta'
        if (this.player) {
			// Movement
			const axis = this.input.getAxis();
            // Use meters per second from stats; fallback convert from model.baseSpeed px/s
            const mps = (this.player.stats?.moveSpeedMps) ?? (this.player.model.baseSpeed / METERS_TO_PIXELS);
            const moveM = mps * (delta / 1000);
            this.player.xM += axis.x * moveM;
            this.player.yM += axis.y * moveM;
            if (axis.x !== 0 || axis.y !== 0) {
                const len = Math.hypot(axis.x, axis.y) || 1;
                this._lastMoveDir = { x: axis.x / len, y: axis.y / len };
            }

			// Direction for idle/side facing (notify animation controller)
			if (Math.abs(axis.x) > Math.abs(axis.y)) {
				this.player.setDirection('side');
				this.player.facingLeft = axis.x < 0;
			} else if (Math.abs(axis.y) > 0) {
				this.player.setDirection(axis.y > 0 ? 'down' : 'up');
			}

			// Switch animation state based on movement
			this.player.setState((axis.x !== 0 || axis.y !== 0) ? 'walk' : 'idle');

            this.player.update(delta);
            // player damage flash timer countdown
            if (this.player.model.hitFlashMs && this.player.model.hitFlashMs > 0) {
                this.player.model.hitFlashMs = Math.max(0, this.player.model.hitFlashMs - delta);
            }

            // Camera follow with deadzone and smoothing around player center
            const playerCenterXM = this.player.xM + (this.player.w / 2) / METERS_TO_PIXELS;
            const playerCenterYM = this.player.yM + (this.player.h / 2) / METERS_TO_PIXELS;
            this.camera.follow(playerCenterXM, playerCenterYM, delta);

            // Target pickup detection (AABB overlap)
			if (this.target && this.isOverlapping(this.player, this.target)) {
                // Apply rewards
                this.deliveries += 1;
                const rw = (GAME_CONFIG.rewards?.targetPickup) || {};
                const addS = rw.addTimeSeconds ?? 0;
				if (addS > 0) {
					this.timerRemainingMs += addS * 1000;
					try { this.addFloatText(`+${addS}s`, { color: '#90caf9' }); } catch {}
				}
                const addCoins = rw.addCoins ?? 0;
				if (addCoins > 0) {
					this.player.model.coins = (this.player.model.coins || 0) + addCoins;
					try { this.addFloatText(`+${addCoins} coins`, { color: '#ffd54f' }); } catch {}
				}
                if (rw.healFull) {
                    this.player.model.hp = this.player.stats?.maxHp ?? this.player.model.hp;
					try { this.addFloatText(`HP full`, { color: '#ef9a9a' }); } catch {}
                } else if (rw.healAmount && rw.healAmount > 0) {
                    const maxHp = this.player.stats?.maxHp ?? 0;
                    this.player.model.hp = Math.min(maxHp, (this.player.model.hp || 0) + rw.healAmount);
					try { this.addFloatText(`+${rw.healAmount} HP`, { color: '#ef9a9a' }); } catch {}
                }
                try { this.playSfx('reward'); } catch {}
                // Respawn a new target around current player position (meters origin)
                this.target = Target.spawnAround(this.player.xM, this.player.yM);
			}

            // Enemies update
            if (this.spawns) {
                this.spawns.update(delta, this.player, this._lastMoveDir);
            }
            // Boosts update
            if (this.boosts) {
                this.boosts.update(delta, this.player);
            }
            // Update floating texts timers
            if (this.floatTexts.length) {
                const now = performance.now();
                this.floatTexts = this.floatTexts.filter(ft => (now - ft.t0) < ft.durationMs);
            }
            // Check Game Over
            if (!this.gameOver && this.player.model.hp <= 0) {
                // Snapshot elapsed time at game-over
                this.elapsedAtGameOverMs = (this.timerTotalMs ?? 0) - (this.timerRemainingMs ?? 0);
                this.gameOver = true;
                this.state = 'paused';
                try { this.playSfx('game_over'); } catch {}
            }
        }
    }

    isOverlapping(player, target) {
        const px1 = player.x;
        const py1 = player.y;
        const px2 = player.x + player.w;
        const py2 = player.y + player.h;
        const tx1 = target.x - target.size / 2;
        const ty1 = target.y - target.size / 2;
        const tx2 = target.x + target.size / 2;
        const ty2 = target.y + target.size / 2;
        return !(px2 < tx1 || px1 > tx2 || py2 < ty1 || py1 > ty2);
    }

    render() {
        this.cm.clear()
        // world-space drawing under camera transform
        this.cm.beginWorld(this.camera);
        if (this.target) {
            this.cm.drawTarget(this.target);
        }
        if (this.player) {
            this.cm.drawPlayer(this.player);
            this.cm.drawPlayerHpBar(this.player);
            if (this.debugDrawColliders) this.cm.drawPlayerCollider(this.player);
        }
        if (this.spawns && this.spawns.enemies.length) {
            this.cm.drawEnemies(this.spawns.enemies);
            if (this.debugDrawColliders) {
                for (const e of this.spawns.enemies) this.cm.drawEnemyCollider(e);
            }
        }
        // Draw boosts (world-space)
        if (this.boosts && this.boosts.boosts.length) {
            this.cm.drawBoosts(this.boosts.boosts);
        }
        this.cm.endWorld();
        // Draw FPS overlay last
        // World-space done; draw HUD with dedicated manager
        if (!this.hud) this.hud = new HUDManager(this.cm);
        this.hud.draw(this);
        // Arrow рисуется в HUDManager. Убираем дублирование.
    }

    addFloatText(text, options = {}) {
        const color = options.color || (GAME_CONFIG.ui?.text) || '#fff';
        const durationMs = options.durationMs || 1000;
        const stroke = options.stroke || (GAME_CONFIG.ui?.stroke) || '#000';
        const yOffset = options.yOffset || -18;
        this.floatTexts.push({ text, color, stroke, durationMs, yOffset, t0: performance.now() });
    }

    startMusic() {
        const cfg = (GAME_CONFIG.audio?.music) || {};
        const list = Array.isArray(cfg.tracks) ? cfg.tracks.slice() : [];
        if (!list.length) return;
        // shuffle if needed
        if (cfg.shuffle) {
            for (let i = list.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [list[i], list[j]] = [list[j], list[i]];
            }
        }
        // Create playlist
        this._musicIdx = 0;
        const next = () => {
            const src = list[this._musicIdx % list.length];
            if (this._audio) {
                try { this._audio.pause(); } catch {}
            }
            const a = new Audio(`./assets/audio/${src}`);
            a.autoplay = true;
            a.playsInline = true;
            a.volume = Math.max(0, Math.min(1, cfg.volume ?? 0.5));
            if (list.length === 1) a.loop = true;
            a.addEventListener('ended', () => {
                this._musicIdx = (this._musicIdx + 1) % list.length;
                next();
            });
            // Attempt autoplay: start muted then unmute shortly after playback starts
            a.muted = true;
            a.addEventListener('playing', () => {
                setTimeout(() => { try { a.muted = false; } catch {} }, 200);
            });
            a.play().catch(() => {});
            this._audio = a;
            // Pause/resume on tab visibility
            if (!this._visBound) {
                this._visBound = true;
                document.addEventListener('visibilitychange', () => {
                    try {
                        if (!this._audio) return;
                        if (document.hidden) this._audio.pause();
                        else if (this.state === 'running') this._audio.play().catch(()=>{});
                    } catch {}
                });
            }
        };
        next();
    }

    playSfx(name) {
        try {
            const sfxCfg = (GAME_CONFIG.audio?.sfx) || {};
            const entry = sfxCfg.map?.[name];
            if (!entry) return;
            const src = typeof entry === 'string' ? entry : entry.src;
            const perVol = typeof entry === 'object' && entry.volume != null ? entry.volume : 1;
            const a = new Audio(`./assets/audio/${src}`);
            a.volume = Math.max(0, Math.min(1, (sfxCfg.volume ?? 1) * perVol));
            a.play().catch(()=>{});
        } catch {}
    }

    handleShopClick(x, y) {
        if (!this.shop) return;
        // hit-test within panels as drawn in HUD (must match metrics)
        const viewW = this.cm.canvas.width / this.cm.dpr;
        const viewH = this.cm.canvas.height / this.cm.dpr;
        const screenMargin = (GAME_CONFIG.ui?.metrics?.screenMargin ?? 8);
        const padX = (GAME_CONFIG.ui?.metrics?.padX ?? 6);
        const padY = (GAME_CONFIG.ui?.metrics?.padY ?? 4);
        const lineH = (GAME_CONFIG.ui?.metrics?.lineHMain ?? 18);
        const BTN = 16;
        const topY = Math.floor(viewH * 0.15);
        const items = this.shop.getItems();
        // Recompute dynamic panel width to match HUD drawing
        const ctx = this.cm.ctx;
        const prevFont = ctx.font;
        ctx.font = (GAME_CONFIG.ui?.metrics?.fontMain) || '18px monospace';
        const calcRowWidth = (it) => {
            const costText = `[${it.cost}]`;
            const levelText = `(Lv.${it.level||0})`;
            const label = `${it.label}: ${it.value}`;
            const labelW = Math.ceil(ctx.measureText(label).width);
            const levelW = Math.ceil(ctx.measureText(levelText).width);
            const costW = Math.ceil(ctx.measureText(costText).width);
            return padX + labelW + 8 + levelW + 8 + costW + 6 + BTN + padX;
        };
        let maxRow = Math.ceil(ctx.measureText('PLAYER UPGRADES').width) + padX * 2;
        for (const it of items.left) maxRow = Math.max(maxRow, calcRowWidth(it));
        maxRow = Math.max(maxRow, Math.ceil(ctx.measureText('BOOST UPGRADES').width) + padX * 2);
        for (const it of items.right) maxRow = Math.max(maxRow, calcRowWidth(it));
        const panelW = Math.min(viewW - screenMargin * 2, Math.max(260, Math.floor(maxRow)));
        ctx.font = prevFont;

        // Left panel bounds and [+] hit
        const leftX = screenMargin;
        const leftH = (items.left.length + 2) * lineH + padY * 2;
        if (x >= leftX && x <= leftX + panelW && y >= topY && y <= topY + leftH) {
            const idx = Math.floor((y - topY - padY - lineH) / lineH);
            if (idx >= 0 && idx < items.left.length) {
                const it = items.left[idx];
                // detect [+] button area at right
                const bx1 = leftX + panelW - padX - BTN;
                const bx2 = bx1 + BTN;
                const by1 = topY + padY + lineH + idx * lineH + Math.floor((lineH - BTN) / 2) - 1;
                const by2 = by1 + BTN;
                if (x >= bx1 && x <= bx2 && y >= by1 && y <= by2) {
                    this.shop.purchase(it.id);
                }
                this.render();
                return;
            }
        }
        // Right panel (now below left) bounds and [+]
        const rightX = screenMargin;
        const rightY = topY + (items.left.length + 2) * lineH + padY * 2 + 12;
        const rightH = (items.right.length + 2) * lineH + padY * 2;
        if (x >= rightX && x <= rightX + panelW && y >= rightY && y <= rightY + rightH) {
            const idx = Math.floor((y - rightY - padY - lineH) / lineH);
            if (idx >= 0 && idx < items.right.length) {
                const it = items.right[idx];
                const bx1 = rightX + panelW - padX - BTN;
                const bx2 = bx1 + BTN;
                const by1 = rightY + padY + lineH + idx * lineH + Math.floor((lineH - BTN) / 2) - 1;
                const by2 = by1 + BTN;
                if (x >= bx1 && x <= bx2 && y >= by1 && y <= by2) {
                    this.shop.purchase(it.id);
                }
                this.render();
                return;
            }
        }
    }
}