class SpawnManager {
    constructor(camera, config) {
        this.camera = camera;
        this.enemies = [];
        this._timerMs = 0;
        // Runtime-tunable spawn parameters per type (dogs as baseline mobs)
        const baseSpawn = (GAME_CONFIG.enemies?.spawn) || {};
        const dogSpawn = (GAME_CONFIG.enemies?.dog?.spawn) || {};
        this.dogInitialCount = dogSpawn.initialCount ?? (baseSpawn.initialCount ?? 2);
        this.dogMaxCount = dogSpawn.maxCount ?? (baseSpawn.maxCount ?? 8);
        this.dogIntervalMs = dogSpawn.intervalMs ?? (baseSpawn.intervalMs ?? 2000);
        // Power-up scaling
        const pu = (GAME_CONFIG.enemies?.powerup) || {};
        this.puIntervalMs = (pu.intervalSec ?? 60) * 1000;
        this.puSpeedDeltaMps = pu.speedDeltaMps ?? 2;
        // dogs per-step
        const dogPU = (GAME_CONFIG.enemies?.dog?.powerup) || {};
        this.dogMaxCountDelta = (dogPU.maxCountDelta ?? pu.maxCountDelta) ?? 0;
        this.dogIntervalDeltaMs = (dogPU.intervalDeltaMs ?? pu.intervalDeltaMs) ?? 0;
        this.puIntervalMinMs = (pu.intervalMinSec ?? 0.3) * 1000;
        this._puTimerMs = 0;
    }

    spawnDogAtEdge(player) {
        const viewW = this.camera.viewWidth;
        const viewH = this.camera.viewHeight;
        const camXPx = this.camera.getOffsetXPx ? this.camera.getOffsetXPx() : (this.camera.x || 0);
        const camYPx = this.camera.getOffsetYPx ? this.camera.getOffsetYPx() : (this.camera.y || 0);
        const margin = 32; // spawn just outside view

        // Choose random edge: 0=top,1=right,2=bottom,3=left
        const edge = Math.floor(Math.random() * 4);
        let xPx = camXPx + Math.random() * viewW;
        let yPx = camYPx + Math.random() * viewH;
        if (edge === 0) { yPx = camYPx - margin; }
        if (edge === 2) { yPx = camYPx + viewH + margin; }
        if (edge === 1) { xPx = camXPx + viewW + margin; }
        if (edge === 3) { xPx = camXPx - margin; }

        const xM = xPx / METERS_TO_PIXELS;
        const yM = yPx / METERS_TO_PIXELS;
        const dogCfg = (GAME_CONFIG.enemies?.dog) || {};
        const enemy = new Enemy('dog', xM, yM, dogCfg);
        this.enemies.push(enemy);
    }

    spawnCarAtEdge(player) {
        const viewW = this.camera.viewWidth;
        const viewH = this.camera.viewHeight;
        const camXPx = this.camera.getOffsetXPx ? this.camera.getOffsetXPx() : (this.camera.x || 0);
        const camYPx = this.camera.getOffsetYPx ? this.camera.getOffsetYPx() : (this.camera.y || 0);
        const margin = 32;
        const edge = Math.floor(Math.random() * 4);
        let xPx = camXPx + Math.random() * viewW;
        let yPx = camYPx + Math.random() * viewH;
        if (edge === 0) { yPx = camYPx - margin; }
        if (edge === 2) { yPx = camYPx + viewH + margin; }
        if (edge === 1) { xPx = camXPx + viewW + margin; }
        if (edge === 3) { xPx = camXPx - margin; }

        const xM = xPx / METERS_TO_PIXELS;
        const yM = yPx / METERS_TO_PIXELS;
        const cfg = (GAME_CONFIG.enemies?.car) || {};
        // resolve random color folder
        const colors = cfg.colors || [];
        const color = colors.length ? colors[Math.floor(Math.random() * colors.length)] : null;
        // cars sprites live under enemies/cars/<color>/move/move_#.png
        const folder = cfg.spriteBase && color ? `${cfg.spriteBase}/${color}/move` : null;
        const enemyCfg = { ...cfg, spriteFolder: folder };
        const enemy = new Enemy('car', xM, yM, enemyCfg);
        this.enemies.push(enemy);
    }

    ensureInitial(player) {
        const dogs = this.enemies.filter(e => e.kind === 'dog').length;
        for (let i = dogs; i < this.dogInitialCount; i++) this.spawnDogAtEdge(player);
    }

    update(deltaMs, player, lastMoveDir = { x: 0, y: 1 }) {
        this._timerMs += deltaMs; // legacy/global timer (unused)
        this._dogTimerMs = (this._dogTimerMs || 0) + deltaMs;
        this._puTimerMs += deltaMs;
        // Dog spawning
        const dogCount = this.enemies.filter(e => e.kind === 'dog').length;
        if (this._dogTimerMs >= this.dogIntervalMs && dogCount < this.dogMaxCount) {
            this._dogTimerMs -= this.dogIntervalMs;
            this.spawnDogAtEdge(player);
        }
        // Cars spawning (independent schedule)
        this._carTimerMs = (this._carTimerMs || 0) + deltaMs;
        const carCfg = (GAME_CONFIG.enemies?.car) || {};
        const carIntervalMs = carCfg.spawn?.intervalMs ?? 3000;
        const carMaxCount = carCfg.spawn?.maxCount ?? Infinity;
        // Enable cars when maxCount becomes > 0
        if (!this._carsEnabled && carMaxCount > 0) {
            this._carsEnabled = true;
            const initialCars = carCfg.spawn?.initialCount ?? 1;
            for (let i = 0; i < initialCars; i++) this.spawnCarAtEdge(player);
            this._carTimerMs = 0;
        }
        if (this._carsEnabled) {
            const carsAlive = this.enemies.filter(e => e.kind === 'car').length;
            if (this._carTimerMs >= carIntervalMs && carsAlive < carMaxCount) {
                this._carTimerMs -= carIntervalMs;
                this.spawnCarAtEdge(player);
            }
        }
        // Power-up step
        if (this._puTimerMs >= this.puIntervalMs) {
            this._puTimerMs -= this.puIntervalMs;
            this.dogMaxCount += this.dogMaxCountDelta;
            this.dogIntervalMs = Math.max(this.puIntervalMinMs, this.dogIntervalMs - this.dogIntervalDeltaMs);
            // Apply per-type or global speed increments; also cars' interval/damage
            for (const e of this.enemies) {
                const typeCfg = (GAME_CONFIG.enemies?.[e.kind]) || {};
                const override = (typeCfg.powerup?.speedDeltaMps);
                const inc = (override != null) ? override : this.puSpeedDeltaMps;
                e.moveSpeedMps += inc;
                if (e.kind === 'car' && typeof typeCfg.powerup?.damageDelta === 'number' && e.damagePerHit != null) {
                    e.damagePerHit += typeCfg.powerup.damageDelta;
                }
            }
            // Update base speeds for new spawns
            const enemiesCfg = (GAME_CONFIG.enemies || {});
            for (const key of Object.keys(enemiesCfg)) {
                if (key === 'spawn' || key === 'powerup') continue;
                const typeCfg = enemiesCfg[key];
                if (!typeCfg || typeof typeCfg !== 'object') continue;
                const override = (typeCfg.powerup?.speedDeltaMps);
                const inc = (override != null) ? override : this.puSpeedDeltaMps;
                if (typeof typeCfg.moveSpeedMps === 'number') {
                    typeCfg.moveSpeedMps += inc;
                }
                if (key === 'car') {
                    if (typeof typeCfg.powerup?.intervalDeltaMs === 'number' && typeCfg.spawn && typeof typeCfg.spawn.intervalMs === 'number') {
                        const minMs = (GAME_CONFIG.enemies?.powerup?.intervalMinSec ?? 0.3) * 1000;
                        typeCfg.spawn.intervalMs = Math.max(minMs, typeCfg.spawn.intervalMs - (typeCfg.powerup.intervalDeltaMs));
                    }
                    if (typeof typeCfg.powerup?.maxCountDelta === 'number' && typeCfg.spawn && typeof typeCfg.spawn.maxCount === 'number') {
                        typeCfg.spawn.maxCount += typeCfg.powerup.maxCountDelta;
                    }
                    if (typeof typeCfg.powerup?.damageDelta === 'number' && typeof typeCfg.damagePerHit === 'number') {
                        typeCfg.damagePerHit += typeCfg.powerup.damageDelta;
                    }
                }
            }
        }
        // Precompute view bounds for culling/teleport checks
        const viewW = this.camera.viewWidth;
        const viewH = this.camera.viewHeight;
        const camXPx = this.camera.getOffsetXPx ? this.camera.getOffsetXPx() : (this.camera.x || 0);
        const camYPx = this.camera.getOffsetYPx ? this.camera.getOffsetYPx() : (this.camera.y || 0);
        const marginLarge = 96;
        const marginStrict = 24;
        const leftLarge = camXPx - marginLarge, rightLarge = camXPx + viewW + marginLarge;
        const topLarge = camYPx - marginLarge, bottomLarge = camYPx + viewH + marginLarge;
        const strictL0 = camXPx - marginStrict, strictR0 = camXPx + viewW + marginStrict;
        const strictT0 = camYPx - marginStrict, strictB0 = camYPx + viewH + marginStrict;

        // Update enemies and lifetime cull
        const kept = [];
        for (const e of this.enemies) {
            e.update(deltaMs, player);
            if (e.lifetimeMs > 0 && e.ageMs >= e.lifetimeMs) {
                // remove entity
                continue;
            }
            // Car off-screen culling: once a car has entered screen area, despawn after it leaves far bounds
            if (e.kind === 'car') {
                const ex = e.x, ey = e.y;
                const nearScreen = (ex >= strictL0 && ex <= strictR0 && ey >= strictT0 && ey <= strictB0);
                if (nearScreen) {
                    e.hasEnteredScreen = true;
                    e.offscreenMs = 0;
                } else if (e.hasEnteredScreen) {
                    const outsideLarge = (ex < leftLarge || ex > rightLarge || ey < topLarge || ey > bottomLarge);
                    if (outsideLarge) {
                        e.offscreenMs = (e.offscreenMs || 0) + deltaMs;
                        if (e.offscreenMs >= 300) {
                            continue; // despawn car after leaving far bounds for a short time
                        }
                    }
                }
            }
            kept.push(e);
        }
        this.enemies = kept;

        // Teleport mobs that are far behind the player (Vampire Survivors-like)
        // reuse previously computed viewW/viewH/camXPx/camYPx
        const margin = 64; // large wrap placement offset
        const left = camXPx - margin, right = camXPx + viewW + margin;
        const top = camYPx - margin, bottom = camYPx + viewH + margin;
        const small = 24; // small offscreen threshold
        const strictL = camXPx - small, strictR = camXPx + viewW + small;
        const strictT = camYPx - small, strictB = camYPx + viewH + small;
        const offscreenDelayMs = 800; // must stay offscreen for this time before wrap
        const aheadDistancePx = Math.max(viewW, viewH) * 0.7; // not used in wrap mode but kept for future

        for (const e of this.enemies) {
            if (e.type !== 'mob') continue;
            const ex = e.x, ey = e.y;
            // Mark that enemy has been near the screen at least once
            const nearScreen = (ex >= strictL && ex <= strictR && ey >= strictT && ey <= strictB);
            if (nearScreen) {
                e.hasEnteredScreen = true;
                e.offscreenMs = 0;
                continue;
            }
            // Only teleport enemies that уже хотя бы один раз «были рядом»
            if (!e.hasEnteredScreen) continue;
            // Require to be offscreen for some time to avoid instant wrap loops
            e.offscreenMs = (e.offscreenMs || 0) + deltaMs;
            if (e.offscreenMs < offscreenDelayMs) continue;
            // Wrap-вариант: переносим на противоположную сторону относительно движения игрока,
            // сохраняя параллельную координату (как в VS)
            const verticalPrimary = Math.abs(lastMoveDir.y) >= Math.abs(lastMoveDir.x);
            const edgePad = 32;
            let spawnX = ex;
            let spawnY = ey;
            if (verticalPrimary) {
                // вверх/вниз
                const jitterX = (Math.random() - 0.5) * edgePad * 2;
                spawnX = Math.min(Math.max(ex + jitterX, left + edgePad), right - edgePad);
                spawnY = (lastMoveDir.y < 0) ? (top - margin) : (bottom + margin);
            } else {
                // вправо/влево
                const jitterY = (Math.random() - 0.5) * edgePad * 2;
                spawnY = Math.min(Math.max(ey + jitterY, top + edgePad), bottom - edgePad);
                spawnX = (lastMoveDir.x > 0) ? (right + margin) : (left - margin);
            }
            e.xM = spawnX / METERS_TO_PIXELS;
            e.yM = spawnY / METERS_TO_PIXELS;
            e._damageTimerMs = 0;
            e._wasOverlapping = false;
            e.offscreenMs = 0;
        }
    }
}


