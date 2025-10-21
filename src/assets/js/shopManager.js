class ShopManager {
    constructor(game) {
        this.game = game;
        this.levels = {}; // id -> number purchased
    }

    getItems() {
        const cfg = (GAME_CONFIG.shop || {});
        const itemsLeft = [];
        const itemsRight = [];
        if (cfg.player?.moveSpeed) {
            const c = cfg.player.moveSpeed;
            itemsLeft.push({ id: 'player.moveSpeed', label: 'MOVE SPEED', value: `+${c.addMps} m/s`, cost: c.cost, level: (this.levels['player.moveSpeed'] || 0) });
        }
        if (cfg.player?.maxHp) {
            const c = cfg.player.maxHp;
            itemsLeft.push({ id: 'player.maxHp', label: 'MAX HP', value: `+${c.addHp}`, cost: c.cost, level: (this.levels['player.maxHp'] || 0) });
        }
        if (cfg.boosts?.coinValue) {
            const c = cfg.boosts.coinValue;
            itemsRight.push({ id: 'boosts.coinValue', label: 'COIN VALUE', value: `+${c.addMin}-${c.addMax}`, cost: c.cost, level: (this.levels['boosts.coinValue'] || 0) });
        }
        if (cfg.boosts?.clockTime) {
            const c = cfg.boosts.clockTime;
            itemsRight.push({ id: 'boosts.clockTime', label: 'CLOCK TIME', value: `+${c.addSeconds}s`, cost: c.cost, level: (this.levels['boosts.clockTime'] || 0) });
        }
        if (cfg.boosts?.energyDuration) {
            const c = cfg.boosts.energyDuration;
            itemsRight.push({ id: 'boosts.energyDuration', label: 'ENERGY DURATION', value: `+${c.addSeconds}s`, cost: c.cost, level: (this.levels['boosts.energyDuration'] || 0) });
        }
        return { left: itemsLeft, right: itemsRight };
    }

    canAfford(cost) {
        const coins = this.game?.player?.model?.coins || 0;
        return coins >= cost;
    }

    purchase(id) {
        const cfg = (GAME_CONFIG.shop || {});
        const player = this.game.player;
        if (!player || !player.model) return false;
        let cost = 0;
        if (id === 'player.moveSpeed') { cost = cfg.player?.moveSpeed?.cost || 0; }
        if (id === 'player.maxHp') { cost = cfg.player?.maxHp?.cost || 0; }
        if (id === 'boosts.coinValue') { cost = cfg.boosts?.coinValue?.cost || 0; }
        if (id === 'boosts.clockTime') { cost = cfg.boosts?.clockTime?.cost || 0; }
        if (id === 'boosts.energyDuration') { cost = cfg.boosts?.energyDuration?.cost || 0; }
        if (!this.canAfford(cost)) return false;
        player.model.coins -= cost;
        // apply effect
        if (id === 'player.moveSpeed') {
            const add = cfg.player?.moveSpeed?.addMps || 0;
            const stats = player.stats;
            if (stats) {
                stats._baseMoveSpeedMps = stats._baseMoveSpeedMps || stats.moveSpeedMps;
                stats._baseMoveSpeedMps += add;
                stats.moveSpeedMps += add;
            }
        } else if (id === 'player.maxHp') {
            const add = cfg.player?.maxHp?.addHp || 0;
            const stats = player.stats;
            if (stats) {
                stats.maxHp += add;
                player.model.hp = Math.min(stats.maxHp, (player.model.hp || stats.maxHp) + add);
            }
        } else if (id === 'boosts.coinValue') {
            const c = cfg.boosts?.coinValue || {};
            if (GAME_CONFIG.boosts?.coin) {
                GAME_CONFIG.boosts.coin.valueMin = (GAME_CONFIG.boosts.coin.valueMin || 0) + (c.addMin || 0);
                GAME_CONFIG.boosts.coin.valueMax = (GAME_CONFIG.boosts.coin.valueMax || 0) + (c.addMax || 0);
            }
        } else if (id === 'boosts.clockTime') {
            const c = cfg.boosts?.clockTime || {};
            if (GAME_CONFIG.boosts?.clock) {
                GAME_CONFIG.boosts.clock.addSeconds = (GAME_CONFIG.boosts.clock.addSeconds || 0) + (c.addSeconds || 0);
            }
        } else if (id === 'boosts.energyDuration') {
            const c = cfg.boosts?.energyDuration || {};
            if (GAME_CONFIG.boosts?.energy) {
                GAME_CONFIG.boosts.energy.durationSec = (GAME_CONFIG.boosts.energy.durationSec || 0) + (c.addSeconds || 0);
            }
        }
        this.levels[id] = (this.levels[id] || 0) + 1;
        return true;
    }
}


