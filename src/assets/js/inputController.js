class InputController {
    constructor(target = window) {
        this.target = target;
        this.pressedCodes = new Set();
        this._onKeyDown = this.onKeyDown.bind(this);
        this._onKeyUp = this.onKeyUp.bind(this);
        this.attach();
    }

    attach() {
        this.target.addEventListener('keydown', this._onKeyDown);
        this.target.addEventListener('keyup', this._onKeyUp);
    }

    detach() {
        this.target.removeEventListener('keydown', this._onKeyDown);
        this.target.removeEventListener('keyup', this._onKeyUp);
        this.pressedCodes.clear();
    }

    onKeyDown(e) {
        const code = e.code || e.key;
        if (code && String(code).startsWith('Arrow')) e.preventDefault();
        if (e.key === ' ' || e.key === 'Spacebar') e.preventDefault();
        this.pressedCodes.add(code);
    }

    onKeyUp(e) {
        const code = e.code || e.key;
        this.pressedCodes.delete(code);
    }

    isDownCode(codes) {
        for (const c of codes) if (this.pressedCodes.has(c)) return true;
        return false;
    }

    // Returns movement axis in range [-1, 1] for x and y
    getAxis() {
        // Use physical key codes so it works on any layout (RU, etc.)
        const left = this.isDownCode(['KeyA', 'ArrowLeft']);
        const right = this.isDownCode(['KeyD', 'ArrowRight']);
        const up = this.isDownCode(['KeyW', 'ArrowUp']);
        const down = this.isDownCode(['KeyS', 'ArrowDown']);

        let x = (right ? 1 : 0) + (left ? -1 : 0);
        let y = (down ? 1 : 0) + (up ? -1 : 0);

        // Normalize diagonal to maintain constant speed
        if (x !== 0 && y !== 0) {
            const inv = 1 / Math.sqrt(2);
            x *= inv;
            y *= inv;
        }
        return { x, y };
    }
}


