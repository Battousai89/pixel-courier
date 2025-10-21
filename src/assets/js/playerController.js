class PlayerController {
    constructor(playerModel, xMeters, yMeters) {
        this.model = playerModel;
        this.xM = xMeters; // world meters
        this.yM = yMeters; // world meters
        this.w = playerModel.w;
        this.h = playerModel.h;

        this.direction = "down"; // 'down' | 'up' | 'side'
        this.facingLeft = false; // for 'side' direction

        // Animation separated
        this.anim = new AnimationController(playerModel);
    }

    // World position in meters with pixel getters/setters for compatibility
    get x() { return this.xM * METERS_TO_PIXELS; }
    set x(px) { this.xM = px / METERS_TO_PIXELS; }
    get y() { return this.yM * METERS_TO_PIXELS; }
    set y(py) { this.yM = py / METERS_TO_PIXELS; }

    update(deltaMs) {
        this.anim.update(deltaMs);
    }

    setDirection(direction) {
        if (direction !== this.direction) {
            this.direction = direction;
            this.anim.setDirection(direction);
        }
    }

    setState(state) {
        this.anim.setState(state);
    }

    getCurrentSpritePath() {
        return this.anim.getCurrentSpritePath();
    }

    getAllSpritePaths() {
        return this.model.getAllSpritePaths();
    }
}


