class Player {
    constructor(config = {}) {
        // Render size in world pixels (tiles are 64x64)
        this.w = config.w ?? 46;
        this.h = config.h ?? 46;
        this.baseSpeed = config.baseSpeed ?? 200;
        // Current HP (set from stats.maxHp at game start)
        this.hp = null;

        // Animations configuration (centralized)
        // Can be extended with 'walk', 'attack', etc.
        this.animations = config.animations ?? {
            idle: {
                down: [
                    "player/idle/idle_down_1.png",
                    "player/idle/idle_down_2.png",
                ],
                up: [
                    "player/idle/idle_up_1.png",
                    "player/idle/idle_up_2.png",
                ],
                side: [
                    "player/idle/idle_side_1.png",
                    "player/idle/idle_side_2.png",
                ],
            },
            walk: {
                down: [
                    "player/walk/walk_down_1.png",
                    "player/walk/walk_down_2.png",
                    "player/walk/walk_down_3.png",
                    "player/walk/walk_down_4.png",
                ],
                up: [
                    "player/walk/walk_up_1.png",
                    "player/walk/walk_up_2.png",
                    "player/walk/walk_up_3.png",
                    "player/walk/walk_up_4.png",
                ],
                side: [
                    "player/walk/walk_side_1.png",
                    "player/walk/walk_side_2.png",
                    "player/walk/walk_side_3.png",
                    "player/walk/walk_side_4.png",
                ],
            },
        };
    }

    getFrames(state, direction) {
        const group = this.animations[state] || this.animations.idle;
        return group[direction] || group.down;
    }

    getIdleFrames(direction) {
        return this.getFrames('idle', direction);
    }

    getAllSpritePaths() {
        const all = [];
        const groups = this.animations;
        Object.keys(groups).forEach(state => {
            const dirs = groups[state];
            Object.keys(dirs).forEach(dir => {
                all.push(...dirs[dir]);
            });
        });
        return all;
    }
}


