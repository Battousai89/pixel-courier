class Boost {
    constructor(kind, xM, yM, config) {
        this.kind = kind; // 'coin' | 'clock' | 'energy'
        this.xM = xM;
        this.yM = yM;
        this.sizeM = (GAME_CONFIG?.boosts?.sizeM) ?? 2.0;
        this.spriteBase = config.spriteBase;
        this.frames = config.frames || [];
        this.frameDurationMs = config.frameDurationMs ?? 160;
        this._frame = 0;
        this._timer = 0;
        // specific values
        this.valueMin = config.valueMin;
        this.valueMax = config.valueMax;
        this.addSeconds = config.addSeconds;
        this.speedMultiplier = config.speedMultiplier;
        this.durationSec = config.durationSec;
        this.collected = false;
    }

    get x() { return this.xM * METERS_TO_PIXELS; }
    get y() { return this.yM * METERS_TO_PIXELS; }
    get sizePx() { return this.sizeM * METERS_TO_PIXELS; }

    update(deltaMs) {
        this._timer += deltaMs;
        if (this.frames && this.frames.length && this._timer >= this.frameDurationMs) {
            this._timer -= this.frameDurationMs;
            this._frame = (this._frame + 1) % this.frames.length;
        }
    }

    getSpritePath() {
        if (!this.frames || this.frames.length === 0) return null;
        return `${this.spriteBase}/${this.frames[this._frame]}`;
    }
}
