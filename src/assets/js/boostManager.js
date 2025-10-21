class BoostManager {
    constructor(camera, game) {
        this.camera = camera;
        this.game = game;
        this.boosts = [];
        this._timerMs = 0;
        const bcfg = (GAME_CONFIG.boosts || {});
        this.intervalMs = (bcfg.spawnIntervalSec ?? 10) * 1000;
        this.types = Array.isArray(bcfg.types) ? bcfg.types.slice() : ["coin","clock","energy"];
    }

    update(deltaMs, player) {
        this._timerMs += deltaMs;
        if (this._timerMs >= this.intervalMs) {
            this._timerMs -= this.intervalMs;
            this.spawnRandom(player);
            // sfx
            try { this.game?.playSfx?.('boost_created'); } catch {}
        }
        for (const b of this.boosts) b.update(deltaMs);
        // pickup detection
        const kept = [];
        for (const b of this.boosts) {
            const s = b.sizePx;
            const half = s / 2;
            const bx1 = b.x - half, by1 = b.y - half, bx2 = b.x + half, by2 = b.y + half;
            const px1 = player.x, py1 = player.y, px2 = player.x + player.w, py2 = player.y + player.h;
            const overlap = !(px2 < bx1 || px1 > bx2 || py2 < by1 || py1 > by2);
            if (overlap) {
                this.apply(b, player);
            } else if (!b.collected) {
                kept.push(b);
            }
        }
        this.boosts = kept;
    }

    apply(boost, player) {
        boost.collected = true;
        if (boost.kind === 'coin') {
            const min = (GAME_CONFIG.boosts?.coin?.valueMin ?? 10);
            const max = (GAME_CONFIG.boosts?.coin?.valueMax ?? 50);
            const amount = Math.floor(min + Math.random() * (max - min + 1));
            player.model.coins = (player.model.coins || 0) + amount;
            try { this.game?.playSfx?.('boost_picked'); } catch {}
            try { this.game?.addFloatText?.(`+${amount} coins`, { color: '#ffd54f' }); } catch {}
        } else if (boost.kind === 'clock') {
            const addS = (GAME_CONFIG.boosts?.clock?.addSeconds ?? 30);
            // only affects countdown; elapsed handled separately in Game
            if (this.game) this.game.timerRemainingMs += addS * 1000;
            try { this.game?.playSfx?.('boost_picked'); } catch {}
            try { this.game?.addFloatText?.(`+${addS}s`, { color: '#90caf9' }); } catch {}
        } else if (boost.kind === 'energy') {
            const mult = (GAME_CONFIG.boosts?.energy?.speedMultiplier ?? 2.0);
            const durMs = (GAME_CONFIG.boosts?.energy?.durationSec ?? 10) * 1000;
            const stats = player.stats;
            if (stats) {
                stats._baseMoveSpeedMps = stats._baseMoveSpeedMps || stats.moveSpeedMps;
                stats.moveSpeedMps = (stats._baseMoveSpeedMps * mult);
                clearTimeout(this._energyTimerId);
                this._energyTimerId = setTimeout(() => {
                    stats.moveSpeedMps = stats._baseMoveSpeedMps;
                }, durMs);
            }
            try { this.game?.playSfx?.('boost_picked'); } catch {}
            try { this.game?.addFloatText?.(`x${mult} speed`, { color: '#66bb6a' }); } catch {}
        }
    }

    spawnRandom(player) {
        const kind = this.types[Math.floor(Math.random() * this.types.length)];
        const cfg = (GAME_CONFIG.boosts?.[kind]) || {};
        const range = (GAME_CONFIG.boosts?.spawnDistanceMeters) || { min: 50, max: 200 };
        // Spawn in a random direction at [min,max] meters from player center
        const pxM = player.xM + (player.w / 2) / METERS_TO_PIXELS;
        const pyM = player.yM + (player.h / 2) / METERS_TO_PIXELS;
        const angle = Math.random() * Math.PI * 2;
        const dist = range.min + Math.random() * Math.max(0, (range.max - range.min));
        const xM = pxM + Math.cos(angle) * dist;
        const yM = pyM + Math.sin(angle) * dist;
        const b = new Boost(kind, xM, yM, cfg);
        this.boosts.push(b);
    }

    getClosestBoost(player) {
        if (!this.boosts.length) return null;
        let best = null;
        let bestD2 = Infinity;
        const px = player.x, py = player.y;
        for (const b of this.boosts) {
            const dx = b.x - px;
            const dy = b.y - py;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) { bestD2 = d2; best = b; }
        }
        return best;
    }
}


