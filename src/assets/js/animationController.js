class AnimationController {
    constructor(playerModel) {
        this.model = playerModel;
        this.state = 'idle';
        this.direction = 'down';
        this.currentFrameIndex = 0;
        this.frameTimerMs = 0;
        this.frameDurations = {
            idle: 300,
            walk: 120,
        };
    }

    setState(state) {
        if (state !== this.state) {
            this.state = state;
            this.currentFrameIndex = 0;
            this.frameTimerMs = 0;
        }
    }

    setDirection(direction) {
        if (direction !== this.direction) {
            this.direction = direction;
            this.currentFrameIndex = 0;
            this.frameTimerMs = 0;
        }
    }

    update(deltaMs) {
        this.frameTimerMs += deltaMs;
        const duration = this.frameDurations[this.state] || 200;
        if (this.frameTimerMs >= duration) {
            this.frameTimerMs -= duration;
            const frames = this.model.getFrames(this.state, this.direction);
            this.currentFrameIndex = (this.currentFrameIndex + 1) % frames.length;
        }
    }

    getCurrentSpritePath() {
        const frames = this.model.getFrames(this.state, this.direction);
        return frames[this.currentFrameIndex];
    }
}
