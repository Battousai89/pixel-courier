class CanvasManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.dpr = Math.max(1, window.devicePixelRatio || 1);
        const initial = this._getViewportCssSize();
        this.setCanvasSize(initial.width, initial.height)
        // images handled by AssetCache (in Game), kept for compatibility if needed
        // Pixel-art settings (disable smoothing across vendors)
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;

        // FPS metrics
        this.fps = 0;
        this.framesSinceFpsUpdate = 0;
        this.fpsTimeAccumulatorMs = 0;

        const onResize = () => {
            const s = this._getViewportCssSize();
            this.setCanvasSize(s.width, s.height);
        };
        window.addEventListener('resize', onResize);
        if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
            window.visualViewport.addEventListener('resize', onResize);
        }
    }

    _getViewportCssSize() {
        // Prefer visualViewport when available (reacts to docked devtools/OSK)
        if (window.visualViewport) {
            return { width: Math.floor(window.visualViewport.width), height: Math.floor(window.visualViewport.height) };
        }
        const w = Math.floor(document.documentElement.clientWidth || window.innerWidth || this.canvas.clientWidth || 0);
        const h = Math.floor(document.documentElement.clientHeight || window.innerHeight || this.canvas.clientHeight || 0);
        return { width: w, height: h };
    }

    beginWorld(camera) {
        // Apply transform so world coordinates are offset by camera
        this.ctx.save();
        const camXPx = camera.getOffsetXPx();
        const camYPx = camera.getOffsetYPx();
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, -camXPx * this.dpr, -camYPx * this.dpr);
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
    }

    endWorld() {
        this.ctx.restore();
    }

    setCanvasSize(width, height) {
        this.dpr = Math.max(1, window.devicePixelRatio || 1);
        this.canvas.style.width = width + "px";
        this.canvas.style.height = height + "px";
        const newW = Math.floor(width * this.dpr);
        const newH = Math.floor(height * this.dpr);
        this.canvas.width = newW;
        this.canvas.height = newH;
        this.canvas.style.backgroundColor = "black";
        this.canvas.style.margin = 0;
        this.canvas.style.padding = 0;
        // Ensure CSS preserves crisp pixel rendering
        this.canvas.style.imageRendering = 'pixelated';

        // Reset transform for DPR scaling and disable smoothing
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
    }

    clear() {
        // Fill solid green background in device pixels
        const ctx = this.ctx;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#2e7d32";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();
    }

    // removed level drawing for now

    getOrLoadImage(spritePath) {
        // Deprecated here; kept for compatibility. Prefer AssetCache from Game.
        const fullPath = SPRITES_FOLDER + spritePath;
        if (!this._fallbackImages) this._fallbackImages = new Map();
        if (this._fallbackImages.has(fullPath)) return this._fallbackImages.get(fullPath);
        const img = new Image();
        img.src = fullPath;
        this._fallbackImages.set(fullPath, img);
        return img;
    }

    // preloadLevel removed — handled by AssetCache

    // preloadPlayer removed — handled by AssetCache

    updateFps(deltaMs) {
        this.framesSinceFpsUpdate++;
        this.fpsTimeAccumulatorMs += deltaMs;
        if (this.fpsTimeAccumulatorMs >= 1000) {
            this.fps = this.framesSinceFpsUpdate;
            this.framesSinceFpsUpdate = 0;
            this.fpsTimeAccumulatorMs -= 1000;
        }
    }

    // HUD drawing moved to HUDManager

    drawPlayer(playerController) {
        const spritePath = playerController.getCurrentSpritePath();
        const img = this.getOrLoadImage(spritePath);
        if (!img || !img.complete || img.naturalWidth === 0) {
            return;
        }

        const ctx = this.ctx;
        ctx.save();
        // Snap to integer pixels to avoid subpixel blur in pixel art
        const px = Math.round(playerController.x);
        const py = Math.round(playerController.y);
        const sw = 32, sh = 32; // source rect (exact sprite size)
        // Damage flash: tint sprite red briefly after taking damage
        const flashA = Math.max(0, Math.min(1, (playerController.model.hitFlashMs || 0) / 200));
        if (flashA > 0) {
            ctx.globalCompositeOperation = 'source-over';
        }
        if (playerController.direction === 'side' && playerController.facingLeft) {
            ctx.translate(px + playerController.w / 2, py + playerController.h / 2);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, sw, sh, -playerController.w / 2, -playerController.h / 2, playerController.w, playerController.h);
        } else {
            ctx.drawImage(img, 0, 0, sw, sh, px, py, playerController.w, playerController.h);
        }
        if (flashA > 0) {
            // red overlay
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = `rgba(255,0,0,${0.45 * flashA})`;
            ctx.fillRect(px, py, playerController.w, playerController.h);
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();
    }

    drawPlayerHpBar(playerController) {
        if (!playerController || !playerController.stats) return;
        const ctx = this.ctx;
        const maxHp = playerController.stats.maxHp;
        const hpValue = Math.max(0, Math.min(maxHp, Math.round(playerController.model.hp ?? maxHp)));
        const frac = maxHp > 0 ? hpValue / maxHp : 0;

        // Bar geometry in world pixels
        const barWidth = Math.max(36, Math.min(56, Math.floor(playerController.w * 0.7)));
        const barHeight = 6;
        const pad = 1;
        const x = Math.round(playerController.x + (playerController.w - barWidth) / 2);
        const y = Math.round(playerController.y + playerController.h + 6);

        ctx.save();
        // Background
        ctx.fillStyle = (GAME_CONFIG.ui?.hpBarBg) || "#000";
        ctx.fillRect(x, y, barWidth, barHeight);
        // Fill
        const innerW = barWidth - pad * 2;
        const fillW = Math.floor(innerW * frac);
        const innerH = barHeight - pad * 2;
        ctx.fillStyle = (GAME_CONFIG.ui?.hpBarFill) || "#e53935";
        if (fillW > 0 && innerH > 0) {
            ctx.fillRect(x + pad, y + pad, fillW, innerH);
        }
        ctx.restore();
    }

    drawTargetArrow(playerController, target, camera) {
        // Draw an arrow on the screen edge pointing towards target when off-screen
        const ctx = this.ctx;
        const viewW = this.canvas.width / this.dpr;
        const viewH = this.canvas.height / this.dpr;

        // Target position in screen space (CSS px)
        const tx = (target.x - camera.x);
        const ty = (target.y - camera.y);

        // If target is visible inside the screen, skip arrow
        if (tx >= 0 && tx <= viewW && ty >= 0 && ty <= viewH) return;

        // Ray from screen center to target in screen space
        const cx = viewW / 2;
        const cy = viewH / 2;
        const vx = tx - cx;
        const vy = ty - cy;
        const angle = Math.atan2(vy, vx);

        // Intersect ray with screen rectangle (padded by margin)
        const margin = 24;
        const left = margin, right = viewW - margin, top = margin, bottom = viewH - margin;

        let tMin = Infinity;
        let ix = cx, iy = cy;
        if (vx !== 0) {
            const t1 = (left - cx) / vx;  // hit left
            const y1 = cy + t1 * vy;
            if (t1 > 0 && y1 >= top && y1 <= bottom && t1 < tMin) { tMin = t1; ix = left; iy = y1; }

            const t2 = (right - cx) / vx; // hit right
            const y2 = cy + t2 * vy;
            if (t2 > 0 && y2 >= top && y2 <= bottom && t2 < tMin) { tMin = t2; ix = right; iy = y2; }
        }
        if (vy !== 0) {
            const t3 = (top - cy) / vy;   // hit top
            const x3 = cx + t3 * vx;
            if (t3 > 0 && x3 >= left && x3 <= right && t3 < tMin) { tMin = t3; ix = x3; iy = top; }

            const t4 = (bottom - cy) / vy; // hit bottom
            const x4 = cx + t4 * vx;
            if (t4 > 0 && x4 >= left && x4 <= right && t4 < tMin) { tMin = t4; ix = x4; iy = bottom; }
        }

        // Draw in device pixels
        ctx.save();
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.translate(ix, iy);
        ctx.rotate(angle);
        ctx.fillStyle = "#ffeb3b";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        const size = 14;
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.6, size * 0.6);
        ctx.lineTo(-size * 0.6, -size * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    drawTarget(target) {
        const ctx = this.ctx;
        ctx.save();
        const px = Math.round(target.x);
        const py = Math.round(target.y);
        const s = Math.round(target.size);
        const sprite = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.target && GAME_CONFIG.target.sprite)
            ? GAME_CONFIG.target.sprite
            : null;
        if (sprite) {
            const img = this.getOrLoadImage(sprite);
            if (img && img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, px - s / 2, py - s / 2, s, s);
            } else {
                ctx.fillStyle = "#ffeb3b";
                ctx.fillRect(px - s / 2, py - s / 2, s, s);
            }
        } else {
            ctx.fillStyle = "#ffeb3b";
            ctx.fillRect(px - s / 2, py - s / 2, s, s);
        }
        ctx.restore();
    }

    drawBoosts(boosts) {
        const ctx = this.ctx;
        ctx.save();
        for (const b of boosts) {
            const px = Math.round(b.x);
            const py = Math.round(b.y);
            const s = Math.round(b.sizePx);
            const sprite = b.getSpritePath && b.getSpritePath();
            if (sprite) {
                const img = this.getOrLoadImage(sprite);
                if (img && img.complete && img.naturalWidth > 0) {
                    ctx.drawImage(img, px - s / 2, py - s / 2, s, s);
                } else {
                    ctx.fillStyle = '#2196f3';
                    ctx.fillRect(px - s / 2, py - s / 2, s, s);
                }
            } else {
                ctx.fillStyle = '#2196f3';
                ctx.fillRect(px - s / 2, py - s / 2, s, s);
            }
        }
        ctx.restore();
    }

    drawEnemies(enemies) {
        const ctx = this.ctx;
        ctx.save();
        for (const e of enemies) {
            const px = Math.round(e.x);
            const py = Math.round(e.y);
            const s = Math.round(e.sizePx);
            if (e.kind === 'car' && e.spriteFolder && e.spriteFrames) {
                const frame = e._animFrame || 0;
                // SPRITES_FOLDER already points to ./assets/sprites
                const img = this.getOrLoadImage(`${e.spriteFolder}/${e.spriteFrames[frame]}`);
                if (img && img.complete && img.naturalWidth > 0) {
                    ctx.save();
                    ctx.translate(px, py);
                    const angle = (e.rotationRad || 0) + (e.spriteAngleOffsetRad || 0);
                    ctx.rotate(angle);
                    ctx.drawImage(img, -s / 2, -s / 2, s, s);
                    ctx.restore();
                } else {
                    ctx.fillStyle = '#c62828';
                    ctx.fillRect(px - s / 2, py - s / 2, s, s);
                }
            } else if (e.kind === 'dog' && GAME_CONFIG.enemies?.dog?.animations?.walk) {
                // Draw dog directional walk
                const anim = e.anim;
                const frames = (anim && anim.set && anim.set[anim.dir]) ? anim.set[anim.dir] : null;
                if (frames && frames.length) {
                    const framePath = frames[anim.idx % frames.length];
                    const img = this.getOrLoadImage(framePath);
                    if (img && img.complete && img.naturalWidth > 0) {
                        if (anim.dir === 'side' && anim.facingLeft) {
                            // side left flip by checking rotation sign (nx<0)
                            this.ctx.save();
                            this.ctx.translate(px, py);
                            this.ctx.scale(-1, 1);
                            this.ctx.drawImage(img, -s / 2, -s / 2, s, s);
                            this.ctx.restore();
                        } else {
                            this.ctx.drawImage(img, px - s / 2, py - s / 2, s, s);
                        }
                    } else {
                        ctx.fillStyle = "#e53935";
                        ctx.fillRect(px - s / 2, py - s / 2, s, s);
                    }
                } else {
                    ctx.fillStyle = "#e53935";
                    ctx.fillRect(px - s / 2, py - s / 2, s, s);
                }
            } else {
                ctx.fillStyle = "#e53935";
                ctx.fillRect(px - s / 2, py - s / 2, s, s);
            }
        }
        ctx.restore();
    }

    // Debug rendering
    drawPlayerCollider(player) {
        const ctx = this.ctx;
        const box = getPlayerDamageAabb(player);
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffeb3b';
        const x = Math.round(box.x1);
        const y = Math.round(box.y1);
        const w = Math.round(box.x2 - box.x1);
        const h = Math.round(box.y2 - box.y1);
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
    }

    drawEnemyCollider(enemy) {
        const ctx = this.ctx;
        ctx.save();
        ctx.lineWidth = 2;
        const ec = getEnemyDamageCollider(enemy);
        if (ec.type === 'circle') {
            ctx.strokeStyle = '#ff5252';
            ctx.beginPath();
            ctx.arc(Math.round(ec.cx), Math.round(ec.cy), ec.r, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.strokeStyle = '#ff5252';
            const x = Math.round(ec.x1), y = Math.round(ec.y1), w = Math.round(ec.x2 - ec.x1), h = Math.round(ec.y2 - ec.y1);
            ctx.strokeRect(x, y, w, h);
        }
        ctx.restore();
    }

    // HUD drawing moved to HUDManager

    // HUD drawing moved to HUDManager
    // HUD drawing moved to HUDManager

    // HUD drawing moved to HUDManager

    // HUD drawing moved to HUDManager
}