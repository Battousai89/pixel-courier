// Base path for sprite assets used by CanvasManager
const SPRITES_FOLDER = "./assets/sprites/";
// World-to-screen scale: 1 meter equals 10 pixels (renderer converts meters → pixels)
const METERS_TO_PIXELS = 10;

// Game configuration
const GAME_CONFIG = {
    // Distance used for route target generation (in meters)
    targetDistanceMeters: {
        min: 100, // minimal distance from player (m)
        max: 500, // maximal distance from player (m)
    },
    // Target (main goal) visuals
    target: {
        // Path is relative to SPRITES_FOLDER
        sprite: 'rewards/chest/idle/chest.png',
        // Visual size in meters (renderer converts using METERS_TO_PIXELS)
        sizeM: 3.2,
    },
    camera: {
        // Smooth follow factor (0..1 per 16ms frame)
        smoothness: 0.15,
    },
    player: {
        // Movement speed (meters per second)
        moveSpeedMps: 10.0,
        // Maximum health points
        maxHp: 100,
        // Starting coins for player at new game
        startCoins: 100,
        // Damage collider of the player: trim ratios of the full sprite (0..0.49)
        collider: {
            left: 0.25,   // trim 25% of width from the left side
            right: 0.25,  // trim 25% from right
            top: 0.10,    // trim 10% from top (exclude hat)
            bottom: 0.03, // trim 3% from bottom (exclude shadow/hp bar)
        },
    },
    ui: {
        // Colors for HUD text/backdrop and effects
        backdrop: "rgba(0,0,0,0.5)", // HUD boxes background
        text: "#fff",                 // HUD text color
        stroke: "#000",               // outline for readability
        fps: "#0f0",                  // FPS color
        hpBarFill: "#e53935",         // HP bar fill
        hpBarBg: "#000",              // HP bar background
        arrowFill: "#ffeb3b",         // target arrow color
        boostArrowFill: "#03a9f4",    // boost arrow color (blue)
        metrics: {
            // Layout/typography for HUD
            screenMargin: 8,         // outer margin from screen edges (px)
            gap: 6,                  // vertical gap between blocks (px)
            padX: 6,                 // inner horizontal padding (px)
            padY: 4,                 // inner vertical padding (px)
            fontMain: "18px monospace",  // default HUD font
            fontSmall: "16px monospace", // small font
            fontTimer: "24px monospace", // top timer font
            lineHSmall: 16,          // line height for small text (px)
            lineHMain: 18,           // line height for main text (px)
            minHudWidth: 220,        // minimal width for bottom-left HUD (px)
        }
    },
    // Audio configuration
    audio: {
        music: {
            volume: 0.1,                 // 0..1
            shuffle: true,               // shuffle playlist on start
            tracks: [                    // relative to ./assets/audio/
                'music/audio.mp3',
            ],
        },
        sfx: {
            volume: 0.6,                 // global sfx volume multiplier
            map: {                       // name -> { src, volume }
                damage:        { src: 'sfx/damage.mp3',        volume: 0.3 },
                boost_created: { src: 'sfx/boost_created.mp3', volume: 0.5 },
                boost_picked:  { src: 'sfx/boost_picked.mp3',  volume: 0.5 },
                reward:        { src: 'sfx/reward.mp3',        volume: 1.0 },
                game_over:     { src: 'sfx/game_over.mp3',     volume: 1.0 },
            }
        },
    },
    enemies: {
        // Enemy type "dog" base parameters (meters / m/s)
        dog: {
            sizeM: 3.2,           // visual size (meters) => 32px at 10px/m
            moveSpeedMps: 3.0,    // base speed (m/s)
            damagePerTick: 5,     // damage per tick on contact (HP)
            damageIntervalMs: 500,// period of damage ticks (ms)
            maxHp: 20,            // enemy health
            type: 'mob',          // behavior class (wrap/teleport like VS)
            lifetimeSec: 30,      // lifetime before despawn (seconds)
            // Enemy collider config per direction (defaults similar to player)
            collider: {
                type: 'aabb',
                up:    { left: 0.26, right: 0.26, top: 0.10, bottom: 0.04 },
                down:  { left: 0.25, right: 0.25, top: 0.10, bottom: 0.06 },
                side:  { left: 0.17, right: 0.17, top: 0.10, bottom: 0.06 },
            },
            // Animation frames for walking (by direction)
            animations: {
                // Walk animation frames per direction (paths are relative to SPRITES_FOLDER)
                walk: {
                    up:   ['enemies/mobs/dog/walk/walk_up_1.png','enemies/mobs/dog/walk/walk_up_2.png','enemies/mobs/dog/walk/walk_up_3.png','enemies/mobs/dog/walk/walk_up_4.png'],
                    down: ['enemies/mobs/dog/walk/walk_down_1.png','enemies/mobs/dog/walk/walk_down_2.png','enemies/mobs/dog/walk/walk_down_3.png','enemies/mobs/dog/walk/walk_down_4.png'],
                    side: ['enemies/mobs/dog/walk/walk_side_1.png','enemies/mobs/dog/walk/walk_side_2.png','enemies/mobs/dog/walk/walk_side_3.png','enemies/mobs/dog/walk/walk_side_4.png'],
                },
                frameDurationMs: 140, // frame duration for dog walk animation
            },
            // Per-type spawn rules for dogs
            spawn: {
                initialCount: 2,   // initial dogs spawned at start
                maxCount: 8,       // max concurrent dogs
                intervalMs: 2000,  // dog spawn interval
            },
				// Per-type powerup overrides; if omitted, global 'enemies.powerup' is used
				powerup: {
					// speed increase for DOG per powerup step (m/s)
                speedDeltaMps: 1,
                // dogs per-step adjustments
                maxCountDelta: 3,     // +max dogs per step
                intervalDeltaMs: 200, // -spawn interval per step
				},
        },
        // Enemy type "car" — fast dashers that spawn later and move straight
        car: {
            sizeM: 3.2,             // visual size (meters)
            moveSpeedMps: 10,       // high base speed (m/s)
            damagePerHit: 15,       // one-time damage on collision
            type: 'dash',           // straight dash after short delay
            dashDelayMs: 250,       // delay before starting movement (ms)
            spriteAngleOffsetRad: Math.PI / 2, // car sprite faces UP; rotate +90deg to align with vector
            // Collider (AABB by default)
            collider: {
                type: 'circle',
                left: 0.0, right: 0.0, top: 0.0, bottom: 0.0,
            },
            // Per-type spawn rules for cars
            // To delay cars: set maxCount = 0 at start, then raise via powerups
            spawn: {
                maxCount: 0,       // 0 disables cars initially
                initialCount: 1,   // spawn this many cars once maxCount becomes > 0
                intervalMs: 3000,  // spawn interval when enabled
            },
            // Per-type powerups for cars
            powerup: {
                speedDeltaMps: 10,   // +speed per step (m/s)
                intervalDeltaMs: 100, // spawn interval decreases by N ms per step
                damageDelta: 2,     // +damage per step
                maxCountDelta: 1,   // +max cars per step
            },
            // Sprite set base folder — color picked randomly at spawn
            spriteBase: 'enemies/cars',
            colors: ['red_car','blue_car','green_car','yellow_car'],
            frames: ['move_1.png','move_2.png'],
            frameDurationMs: 120, // like player walk
        },
        // Spawn baseline (editable in runtime if нужно динамически)
        spawn: {
            initialCount: 2,    // enemies to spawn initially
            maxCount: 8,        // max concurrent enemies
            intervalMs: 2000,   // time between spawns (ms)
        },
        // Power-up scaling parameters (applied every intervalSec)
        powerup: {
            intervalSec: 20,     // seconds per step
            // speedDeltaMps: 2,    // +speed per step (m/s)
            // maxCountDelta: 3,    // +maxCount per step
            intervalDeltaMs: 100,// spawn interval decreases by N ms each step
            intervalMinSec: 0.3, // minimal spawn interval (seconds)
        },
    },
    // Boosts configuration
    boosts: {
        spawnIntervalSec: 20,  // how often to spawn a boost
        sizeM: 2.0,            // visual size in meters
        // spawn range relative to player center (meters)
        spawnDistanceMeters: { min: 50, max: 150 },
        // list of enabled boost types
        types: ["coin", "clock", "energy"],
        // Per-type configs
        coin: {
            valueMin: 10,
            valueMax: 50,
            spriteBase: 'boosts/coin/idle',
            frames: ['idle_1.png','idle_2.png','idle_3.png'],
            frameDurationMs: 160,
        },
        clock: {
            addSeconds: 30,
            spriteBase: 'boosts/clock/idle',
            frames: ['idle_1.png','idle_2.png','idle_3.png'],
            frameDurationMs: 160,
        },
        energy: {
            speedMultiplier: 2.0,    // multiply moveSpeedMps
            durationSec: 10,         // duration of the buff
            spriteBase: 'boosts/energy/idle',
            frames: ['idle_1.png','idle_2.png','idle_3.png'],
            frameDurationMs: 160,
        },
    },
    // Shop configuration: costs and effects per upgrade
    shop: {
        // Upgrades that can be purchased in pause menu
        player: {
            // Increase maximum HP by addHp
            maxHp: { cost: 30, addHp: 20 },
            // Increase move speed by addMps meters/second
            moveSpeed: { cost: 50, addMps: 1.0 },
        },
        boosts: {
            // Extend energy boost duration by seconds
            energyDuration: { cost: 20, addSeconds: 5 },
            // Increase random coin value by addMin..addMax
            coinValue: { cost: 30, addMin: 5, addMax: 10 },
            // Add extra seconds to clock boost effect
            clockTime: { cost: 40, addSeconds: 10 },
        }
    },
    // Rewards and pickups tuning
    rewards: {
        // When player picks up the delivery target (yellow square)
        targetPickup: {
            addTimeSeconds: 15, // add seconds to top timer
            addCoins: 50,       // add coins to player's wallet
            healFull: true,     // restore HP to full (true) or leave as is
            // healAmount: 0,   // optional: if set (>0) add flat HP instead of full heal
        },
    },
};