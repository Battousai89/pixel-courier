class PlayerStats {
    constructor(config = {}) {
        const cfg = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.player) ? GAME_CONFIG.player : {};
        // Unify to meters per second; support legacy px/s fallback
        const cfgMps = config.moveSpeedMps ?? cfg.moveSpeedMps;
        const cfgPx = config.moveSpeed ?? cfg.moveSpeed;
        this.moveSpeedMps = (typeof cfgMps === 'number') ? cfgMps
            : (typeof cfgPx === 'number' ? (cfgPx / METERS_TO_PIXELS) : 2.0);
        this.maxHp = config.maxHp ?? cfg.maxHp ?? 100;
    }
}


