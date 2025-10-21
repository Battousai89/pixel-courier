class Time {
    constructor(fixedDeltaMs = 1000 / 240) {
        this.fixedDeltaMs = fixedDeltaMs;
        this.elapsedMs = 0;
        this.deltaMs = 0;
    }

    update(frameDeltaMs) {
        // Clamp extreme gaps (tab inactive, breakpoints)
        const clamped = Math.min(frameDeltaMs, 250);
        this.deltaMs = clamped;
        this.elapsedMs += clamped;
        return clamped;
    }
}


