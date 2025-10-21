class Enemy {
    constructor(kind, xM, yM, config) {
        this.kind = kind;
        this.xM = xM;
        this.yM = yM;
        this.sizeM = config.sizeM ?? (24 / METERS_TO_PIXELS);
        this.moveSpeedMps = config.moveSpeedMps ?? 1.5;
        // DoT for mobs; for dashers use single-hit damagePerHit
        this.damagePerTick = config.damagePerTick ?? 5;
        this.damageIntervalMs = config.damageIntervalMs ?? 500;
        this.damagePerHit = config.damagePerHit ?? null;
        this.maxHp = config.maxHp ?? 20;
        this.hp = this.maxHp;
        this.type = config.type ?? 'mob';
        this.lifetimeMs = (config.lifetimeSec ?? 0) * 1000;
        this.ageMs = 0;
        this._damageTimerMs = 0;
        this._wasOverlapping = false;
        this.hasEnteredScreen = false; // becomes true once seen near the screen
        this.offscreenMs = 0; // time spent off the strict screen bounds
        // Car/dash specifics
        this.dashDelayMs = config.dashDelayMs ?? 0;
        this._dashTimerMs = 0;
        this._hasHitOnce = false; // single-hit damage flag
        this._animFrame = 0;
        this._animTimer = 0;
        this._frameDurationMs = config.frameDurationMs ?? 120;
        this.spriteFolder = config.spriteFolder || null; // resolved at spawn
        this.spriteFrames = config.frames || null;
        this.spriteAngleOffsetRad = config.spriteAngleOffsetRad || 0;
        this.rotationRad = 0; // facing rotation for rendering
        // directional animation (for dogs)
        this.anim = {
            set: (config.animations?.walk) || null,
            frameMs: (config.animations?.frameDurationMs) || 140,
            timer: 0,
            idx: 0,
            dir: 'down',
        };
    }

    get x() { return this.xM * METERS_TO_PIXELS; }
    get y() { return this.yM * METERS_TO_PIXELS; }
    get sizePx() { return this.sizeM * METERS_TO_PIXELS; }

    update(deltaMs, player) {
        // Lifetime
        if (this.lifetimeMs > 0) {
            this.ageMs += deltaMs;
        }
        // Behavior
        const targetXM = player.xM + (player.w / 2) / METERS_TO_PIXELS;
        const targetYM = player.yM + (player.h / 2) / METERS_TO_PIXELS;
        const dxM = targetXM - this.xM;
        const dyM = targetYM - this.yM;
        const distM = Math.hypot(dxM, dyM) || 1e-6;
        const nx = dxM / distM;
        const ny = dyM / distM;
        const stepM = this.moveSpeedMps * (deltaMs / 1000);
        if (this.type === 'dash') {
            // wait dash delay, then move straight (no retarget) on first direction captured
            if (this._dashTimerMs < this.dashDelayMs) {
                this._dashTimerMs += deltaMs;
                // capture initial dir to persist trajectory
                this._dashDir = this._dashDir || { x: nx, y: ny };
                this.rotationRad = Math.atan2(this._dashDir.y, this._dashDir.x);
            } else {
                const dir = this._dashDir || { x: nx, y: ny };
                this.xM += dir.x * stepM;
                this.yM += dir.y * stepM;
                this.rotationRad = Math.atan2(dir.y, dir.x);
            }
        } else {
            // mob: continuously homes in
            this.xM += nx * stepM;
            this.yM += ny * stepM;
            this.rotationRad = Math.atan2(ny, nx);
        }

        // Animation update
        if (this.kind === 'car') {
            this._animTimer += deltaMs;
            if (this._frameDurationMs && this._animTimer >= this._frameDurationMs) {
                this._animTimer -= this._frameDurationMs;
                this._animFrame = (this._animFrame + 1) % 2;
            }
        } else if (this.kind === 'dog' && this.anim.set) {
            // choose direction by unnormalized vector (more stable)
            const ax = Math.abs(dxM);
            const ay = Math.abs(dyM);
            if (ax >= ay + 0.01) {
                this.anim.dir = 'side';
                this.anim.facingLeft = (dxM < 0);
            } else {
                this.anim.dir = (dyM > 0 ? 'down' : 'up');
            }
            this.anim.timer += deltaMs;
            if (this.anim.timer >= this.anim.frameMs) {
                this.anim.timer -= this.anim.frameMs;
                const frames = this.anim.set[this.anim.dir] || [];
                if (frames.length) this.anim.idx = (this.anim.idx + 1) % frames.length;
            }
        }

        // Damage logic
        const pb = getPlayerDamageAabb(player);
        const ec = getEnemyDamageCollider(this);
        let overlap = false;
        if (ec.type === 'circle') {
            const qx = Math.max(pb.x1, Math.min(ec.cx, pb.x2));
            const qy = Math.max(pb.y1, Math.min(ec.cy, pb.y2));
            const dx = ec.cx - qx, dy = ec.cy - qy;
            overlap = (dx * dx + dy * dy) <= (ec.r * ec.r);
        } else {
            overlap = aabbIntersects({ x1: ec.x1, y1: ec.y1, x2: ec.x2, y2: ec.y2 }, pb);
        }
        if (overlap) {
            // Car/dash: one-time hit
            if (this.type === 'dash' && this.damagePerHit != null) {
                if (!this._hasHitOnce) {
                    player.model.hp = Math.max(0, player.model.hp - this.damagePerHit);
                    player.model.hitFlashMs = Math.max(200, player.model.hitFlashMs || 0);
                    this._hasHitOnce = true;
                }
                return;
            }
            if (!this._wasOverlapping) {
                // immediate tick on contact
                player.model.hp = Math.max(0, player.model.hp - this.damagePerTick);
                // trigger short damage flash on player
                player.model.hitFlashMs = Math.max(200, player.model.hitFlashMs || 0);
                this._damageTimerMs = 0;
                this._wasOverlapping = true;
                try { window.game?.playSfx?.('damage'); } catch {}
            } else {
                this._damageTimerMs += deltaMs;
                if (this._damageTimerMs >= this.damageIntervalMs) {
                    this._damageTimerMs -= this.damageIntervalMs;
                    player.model.hp = Math.max(0, player.model.hp - this.damagePerTick);
                    player.model.hitFlashMs = Math.max(200, player.model.hitFlashMs || 0);
                    try { window.game?.playSfx?.('damage'); } catch {}
                }
            }
        } else {
            this._damageTimerMs = 0;
            this._wasOverlapping = false;
        }
    }
}


