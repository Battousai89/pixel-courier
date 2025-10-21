class Target {
    constructor(xMeters, yMeters, sizePx = 20) {
        this.xM = xMeters; // world meters
        this.yM = yMeters; // world meters
        this.size = sizePx; // render size in px
    }

    // Pixel getters for rendering/collision
    get x() { return this.xM * METERS_TO_PIXELS; }
    get y() { return this.yM * METERS_TO_PIXELS; }

    static spawnAround(originXM, originYM, options = {}) {
        const cfg = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.targetDistanceMeters) ? GAME_CONFIG.targetDistanceMeters : null;
        const minMeters = options.minMeters ?? (cfg ? cfg.min : 40);
        const maxMeters = options.maxMeters ?? (cfg ? cfg.max : 60);
        const distanceMeters = minMeters + Math.random() * (maxMeters - minMeters);
        const angle = Math.random() * Math.PI * 2;
        const xM = originXM + Math.cos(angle) * distanceMeters;
        const yM = originYM + Math.sin(angle) * distanceMeters;
        const sizeM = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.target && GAME_CONFIG.target.sizeM) ? GAME_CONFIG.target.sizeM : 2.0;
        const size = options.size ?? Math.round(sizeM * METERS_TO_PIXELS);
        return new Target(xM, yM, size);
    }
}


