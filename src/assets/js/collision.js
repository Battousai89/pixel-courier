function aabbIntersects(a, b) {
    // a,b: {x1,y1,x2,y2}
    return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
}

function getPlayerDamageAabb(player) {
    const w = player.w, h = player.h;
    const cfg = (GAME_CONFIG.player?.collider) || { left: 0.3, right: 0.3, top: 0.1, bottom: 0.1 };
    const leftTrim = Math.max(0, Math.min(0.49, cfg.left));
    const rightTrim = Math.max(0, Math.min(0.49, cfg.right));
    const topTrim = Math.max(0, Math.min(0.49, cfg.top));
    const bottomTrim = Math.max(0, Math.min(0.49, cfg.bottom));
    const x1 = player.x + Math.floor(w * leftTrim);
    const x2 = player.x + Math.ceil(w * (1 - rightTrim));
    const y1 = player.y + Math.floor(h * topTrim);
    const y2 = player.y + Math.ceil(h * (1 - bottomTrim));
    return { x1, y1, x2, y2 };
}

function getEnemyDamageCollider(enemy) {
    const cfg = (GAME_CONFIG.enemies?.[enemy.kind]?.collider) || { type: 'circle' };
    if (cfg.type === 'aabb') {
        const s = enemy.sizePx; // derived from sizeM
        // Support per-direction trims: cfg.up/cfg.down/cfg.side
        const dir = (enemy.anim && enemy.anim.dir) ? enemy.anim.dir : null;
        const trims = (dir && cfg[dir]) ? cfg[dir] : cfg;
        const leftTrim = Math.max(0, Math.min(0.49, trims.left ?? 0));
        const rightTrim = Math.max(0, Math.min(0.49, trims.right ?? 0));
        const topTrim = Math.max(0, Math.min(0.49, trims.top ?? 0));
        const bottomTrim = Math.max(0, Math.min(0.49, trims.bottom ?? 0));
        const x1 = enemy.x - s / 2 + Math.floor(s * leftTrim);
        const x2 = enemy.x - s / 2 + Math.ceil(s * (1 - rightTrim));
        const y1 = enemy.y - s / 2 + Math.floor(s * topTrim);
        const y2 = enemy.y - s / 2 + Math.ceil(s * (1 - bottomTrim));
        return { type: 'aabb', x1, y1, x2, y2 };
    }
    // default circle
    return { type: 'circle', cx: enemy.x, cy: enemy.y, r: enemy.sizePx / 2 };
}


