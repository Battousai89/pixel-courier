class Camera {
    constructor(viewWidth, viewHeight, config = {}) {
        // Store top-left in world meters
        this.xM = 0;
        this.yM = 0;
        this.viewWidth = viewWidth;   // CSS px
        this.viewHeight = viewHeight; // CSS px
        // Dynamic deadzone in px (per axis)
        this.deadzonePxX = config.deadzonePxX ?? null;
        this.deadzonePxY = config.deadzonePxY ?? null;
        this.deadzoneHalfRatio = config.deadzoneHalfRatio ?? 0.5; // 0..1 of half-dimension
        this.smoothness = config.smoothness ?? 0.15;
    }

    setViewSize(width, height) {
        this.viewWidth = width;
        this.viewHeight = height;
    }

    setCenter(worldXM, worldYM) {
        // worldXM/worldYM are in meters
        this.xM = worldXM - (this.viewWidth / 2) / METERS_TO_PIXELS;
        this.yM = worldYM - (this.viewHeight / 2) / METERS_TO_PIXELS;
    }

    // Pixel-space helpers for rendering/HUD
    getOffsetXPx() { return this.xM * METERS_TO_PIXELS; }
    getOffsetYPx() { return this.yM * METERS_TO_PIXELS; }
    getCenterXPx() { return this.getOffsetXPx() + this.viewWidth / 2; }
    getCenterYPx() { return this.getOffsetYPx() + this.viewHeight / 2; }

    follow(targetXM, targetYM, deltaMs) {
        // Work in pixels for deadzone math
        const cx = this.getCenterXPx();
        const cy = this.getCenterYPx();
        const tx = targetXM * METERS_TO_PIXELS;
        const ty = targetYM * METERS_TO_PIXELS;
        const dx = tx - cx;
        const dy = ty - cy;

        // Dynamic per-axis deadzone derived from view size
        const dzX = (this.deadzonePxX != null)
            ? this.deadzonePxX
            : (this.viewWidth / 3) * this.deadzoneHalfRatio;
        const dzY = (this.deadzonePxY != null)
            ? this.deadzonePxY
            : (this.viewHeight / 3) * this.deadzoneHalfRatio;

        let shiftX = 0;
        let shiftY = 0;
        if (Math.abs(dx) > dzX) {
            shiftX = dx - Math.sign(dx) * dzX;
        }
        if (Math.abs(dy) > dzY) {
            shiftY = dy - Math.sign(dy) * dzY;
        }

        // Desired new top-left to keep target inside deadzone
        const desiredXPx = this.getOffsetXPx() + shiftX;
        const desiredYPx = this.getOffsetYPx() + shiftY;

        // Smoothly interpolate based on delta (convert smoothness to per-delta factor)
        const base = 1 - (this.smoothness);
        const steps = deltaMs / 16.67; // relative to ~60fps
        const factor = 1 - Math.pow(base, Math.max(0, steps));

        const newXPx = this.getOffsetXPx() + (desiredXPx - this.getOffsetXPx()) * factor;
        const newYPx = this.getOffsetYPx() + (desiredYPx - this.getOffsetYPx()) * factor;
        this.xM = newXPx / METERS_TO_PIXELS;
        this.yM = newYPx / METERS_TO_PIXELS;
    }
}


