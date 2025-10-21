class HUDManager {
    constructor(canvasManager) {
        this.cm = canvasManager;
        this._cache = {
            viewW: 0,
            viewH: 0,
            fpsWidth: 0,
            statsWidth: 0,
            scoreWidth: 0,
            lastScoreText: null,
        };
    }

    draw(game) {
        const ctx = this.cm.ctx;
        const dpr = this.cm.dpr;
        const viewW = this.cm.canvas.width / dpr;
        const viewH = this.cm.canvas.height / dpr;

        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const resized = (viewW !== this._cache.viewW || viewH !== this._cache.viewH);
        if (resized) {
            this._cache.viewW = viewW;
            this._cache.viewH = viewH;
            this._cache.fpsWidth = 0;
            this._cache.statsWidth = 0;
            this._cache.scoreWidth = 0;
            this._cache.lastScoreText = null;
        }

        this.drawTimer(ctx, viewW, game.timerRemainingMs);
        this.drawFps(ctx, resized);
        this.drawStatsTopRight(ctx, viewW, game, resized);
        const elapsedMs = (game.elapsedAtGameOverMs != null && (game.state === 'paused' && game.gameOver))
            ? game.elapsedAtGameOverMs
            : ((game.timerTotalMs ?? 0) - (game.timerRemainingMs ?? 0));
        this.drawBottomLeftHud(ctx, viewH, game.player, game.deliveries, elapsedMs, resized);
        if (game.target) this.drawTargetArrow(game.player, game.target, game.camera);
        if (game.boosts && game.boosts.boosts.length) {
            for (const b of game.boosts.boosts) {
                this.drawBoostArrow(game.player, b, game.camera);
            }
        }

        // Floating texts (over player) with stacking to avoid overlap
        if (game.floatTexts && game.floatTexts.length && game.player && game.camera) {
            const camXPx = game.camera.getOffsetXPx ? game.camera.getOffsetXPx() : (game.camera.x || 0);
            const camYPx = game.camera.getOffsetYPx ? game.camera.getOffsetYPx() : (game.camera.y || 0);
            const px = (game.player.x - camXPx) + game.player.w / 2; // screen space
            const py = (game.player.y - camYPx);                     // top of player in screen space
            const now = performance.now();
            const spacing = ((GAME_CONFIG.ui?.metrics?.lineHSmall) || 16) + 2;
            // Oldest first; newest will be drawn closest to player (bottom of the stack)
            const items = game.floatTexts.slice().sort((a, b) => a.t0 - b.t0);
            for (let i = 0; i < items.length; i++) {
                const ft = items[i];
                const age = Math.min(1, (now - ft.t0) / ft.durationMs);
                const alpha = 1 - age;
                const stackFromBottom = (items.length - 1 - i);
                const y = py + ft.yOffset - age * 12 - stackFromBottom * spacing; // slide up + stacked
                ctx.globalAlpha = Math.max(0, alpha);
                ctx.font = (GAME_CONFIG.ui?.metrics?.fontSmall) || '16px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.strokeStyle = ft.stroke;
                ctx.fillStyle = ft.color;
                ctx.lineWidth = 3;
                ctx.strokeText(ft.text, px, y);
                ctx.fillText(ft.text, px, y);
                ctx.globalAlpha = 1;
            }
        }

        if (game.state === 'paused' || game.isPaused === true) {
            if (game.gameOver) {
                this.drawGameOverOverlay(ctx, viewW, viewH, game);
            } else {
                this.drawPauseOverlay(ctx, viewW, viewH);
                this.drawShop(ctx, viewW, viewH, game);
            }
        }

        ctx.restore();
    }

    drawShop(ctx, viewW, viewH, game) {
        if (!game.shop) return;
        const items = game.shop.getItems();
        const screenMargin = (GAME_CONFIG.ui?.metrics?.screenMargin ?? 8);
        const padX = (GAME_CONFIG.ui?.metrics?.padX ?? 6);
        const padY = (GAME_CONFIG.ui?.metrics?.padY ?? 4);
        const lineH = (GAME_CONFIG.ui?.metrics?.lineHMain ?? 18);
        // compute dynamic panel width based on text metrics
        const BTN = 16; // button size
        ctx.font = (GAME_CONFIG.ui?.metrics?.fontMain) || '18px monospace';
        const calcRowWidth = (it) => {
            const costText = `[${it.cost}]`;
            const levelText = `(Lv.${it.level||0})`;
            const label = `${it.label}: ${it.value}`;
            const labelW = Math.ceil(ctx.measureText(label).width);
            const levelW = Math.ceil(ctx.measureText(levelText).width);
            const costW = Math.ceil(ctx.measureText(costText).width);
            return padX + labelW + 8 + levelW + 8 + costW + 6 + BTN + padX;
        };
        let maxRow = Math.ceil(ctx.measureText('PLAYER UPGRADES').width) + padX * 2;
        for (const it of items.left) maxRow = Math.max(maxRow, calcRowWidth(it));
        maxRow = Math.max(maxRow, Math.ceil(ctx.measureText('BOOST UPGRADES').width) + padX * 2);
        for (const it of items.right) maxRow = Math.max(maxRow, calcRowWidth(it));
        const panelW = Math.min(viewW - screenMargin * 2, Math.max(260, Math.floor(maxRow)));
        // drawing params
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';

        // helper to trim text to fit width
        const trimText = (text, maxW) => {
            if (Math.ceil(ctx.measureText(text).width) <= maxW) return text;
            const ell = '…';
            let low = 0, high = text.length;
            while (low < high) {
                const mid = Math.floor((low + high) / 2);
                const t = text.slice(0, mid) + ell;
                if (Math.ceil(ctx.measureText(t).width) <= maxW) low = mid + 1; else high = mid;
            }
            return text.slice(0, Math.max(0, low - 1)) + ell;
        };

        // Left panel: Player upgrades
        const leftX = screenMargin;
        const topY = Math.floor(viewH * 0.15);
        const leftH = (items.left.length + 2) * lineH + padY * 2;
        ctx.fillStyle = (GAME_CONFIG.ui?.backdrop) || 'rgba(0,0,0,0.5)';
        ctx.fillRect(leftX, topY, panelW, leftH);
        ctx.strokeStyle = (GAME_CONFIG.ui?.stroke) || '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(leftX, topY, panelW, leftH);
        ctx.fillStyle = (GAME_CONFIG.ui?.text) || '#fff';
        ctx.font = (GAME_CONFIG.ui?.metrics?.fontMain) || '18px monospace';
        let y = topY + padY;
        ctx.fillText('PLAYER UPGRADES', leftX + padX, y);
        y += lineH;
        for (const it of items.left) {
            const affordable = game.shop.canAfford(it.cost);
            const costText = `[${it.cost}]`;
            const levelText = `(Lv.${it.level||0})`;
            const rightEdge = leftX + panelW - padX;
            const costW = Math.ceil(ctx.measureText(costText).width);
            const levelW = Math.ceil(ctx.measureText(levelText).width);
            const levelX = rightEdge - BTN - 6 - costW - 8 - levelW; // start X for level
            const labelMaxW = levelX - (leftX + padX);
            const label = trimText(`${it.label}: ${it.value}`, Math.max(10, labelMaxW));
            ctx.globalAlpha = affordable ? 1 : 0.5;
            // label left
            ctx.textAlign = 'left';
            ctx.fillText(label, leftX + padX, y);
            // level near right
            ctx.textAlign = 'left';
            ctx.fillText(levelText, levelX, y);
            // cost right-left of button
            ctx.textAlign = 'left';
            const costX = rightEdge - BTN - 6 - costW;
            ctx.fillText(costText, costX, y);
            // draw [+] button
            const bx = rightEdge - BTN;
            const by = y + Math.floor((lineH - BTN) / 2) - 1;
            ctx.globalAlpha = affordable ? 1 : 0.4;
            ctx.fillStyle = affordable ? '#4caf50' : '#888';
            ctx.fillRect(bx, by, BTN, BTN);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText('+', bx + Math.floor(BTN/2), by + 1);
            ctx.textAlign = 'left';
            ctx.fillStyle = (GAME_CONFIG.ui?.text) || '#fff';
            y += lineH;
            ctx.globalAlpha = 1;
        }

        // Right panel: moved under left panel per requirement
        const rightX = screenMargin;
        const rightY = topY + leftH + 12;
        const rightW = panelW;
        const rightH = (items.right.length + 2) * lineH + padY * 2;
        ctx.fillStyle = (GAME_CONFIG.ui?.backdrop) || 'rgba(0,0,0,0.5)';
        ctx.fillRect(rightX, rightY, rightW, rightH);
        ctx.strokeStyle = (GAME_CONFIG.ui?.stroke) || '#000';
        ctx.strokeRect(rightX, rightY, rightW, rightH);
        ctx.fillStyle = (GAME_CONFIG.ui?.text) || '#fff';
        y = rightY + padY;
        ctx.fillText('BOOST UPGRADES', rightX + padX, y);
        y += lineH;
        for (const it of items.right) {
            const affordable = game.shop.canAfford(it.cost);
            const costText = `[${it.cost}]`;
            const levelText = `(Lv.${it.level||0})`;
            const rightEdge = rightX + rightW - padX;
            const costW = Math.ceil(ctx.measureText(costText).width);
            const levelW = Math.ceil(ctx.measureText(levelText).width);
            const levelX = rightEdge - BTN - 6 - costW - 8 - levelW;
            const labelMaxW = levelX - (rightX + padX);
            const label = trimText(`${it.label}: ${it.value}`, Math.max(10, labelMaxW));
            ctx.globalAlpha = affordable ? 1 : 0.5;
            ctx.textAlign = 'left';
            ctx.fillText(label, rightX + padX, y);
            ctx.fillText(levelText, levelX, y);
            const costX = rightEdge - BTN - 6 - costW;
            ctx.fillText(costText, costX, y);
            // [+]
            const bx = rightEdge - BTN;
            const by = y + Math.floor((lineH - BTN) / 2) - 1;
            ctx.globalAlpha = affordable ? 1 : 0.4;
            ctx.fillStyle = affordable ? '#4caf50' : '#888';
            ctx.fillRect(bx, by, BTN, BTN);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText('+', bx + Math.floor(BTN/2), by + 1);
            ctx.textAlign = 'left';
            ctx.fillStyle = (GAME_CONFIG.ui?.text) || '#fff';
            y += lineH;
            ctx.globalAlpha = 1;
        }

        // Footer hint
        ctx.globalAlpha = 0.9;
        ctx.font = (GAME_CONFIG.ui?.metrics?.fontSmall) || '16px monospace';
        const hint = 'Click [+] to buy (if enough coins)';
        const hw = Math.ceil(ctx.measureText(hint).width);
        ctx.fillText(hint, Math.floor((viewW - hw) / 2), topY + Math.max(leftH, rightH) + 12);
        ctx.globalAlpha = 1;
    }

    drawBoostArrow(playerController, boost, camera) {
        if (!boost) return;
        const ctx = this.cm.ctx;
        const viewW = this.cm.canvas.width / this.cm.dpr;
        const viewH = this.cm.canvas.height / this.cm.dpr;
        const camXPx = camera.getOffsetXPx ? camera.getOffsetXPx() : (camera.x || 0);
        const camYPx = camera.getOffsetYPx ? camera.getOffsetYPx() : (camera.y || 0);
        const tx = (boost.x - camXPx);
        const ty = (boost.y - camYPx);
        if (tx >= 0 && tx <= viewW && ty >= 0 && ty <= viewH) return;
        const cx = viewW / 2;
        const cy = viewH / 2;
        const vx = tx - cx;
        const vy = ty - cy;
        const angle = Math.atan2(vy, vx);
        const margin = 28;
        const left = margin, right = viewW - margin, top = margin, bottom = viewH - margin;
        let tMin = Infinity; let ix = cx, iy = cy;
        if (vx !== 0) {
            const t1 = (left - cx) / vx; const y1 = cy + t1 * vy; if (t1 > 0 && y1 >= top && y1 <= bottom && t1 < tMin) { tMin = t1; ix = left; iy = y1; }
            const t2 = (right - cx) / vx; const y2 = cy + t2 * vy; if (t2 > 0 && y2 >= top && y2 <= bottom && t2 < tMin) { tMin = t2; ix = right; iy = y2; }
        }
        if (vy !== 0) {
            const t3 = (top - cy) / vy; const x3 = cx + t3 * vx; if (t3 > 0 && x3 >= left && x3 <= right && t3 < tMin) { tMin = t3; ix = x3; iy = top; }
            const t4 = (bottom - cy) / vy; const x4 = cx + t4 * vx; if (t4 > 0 && x4 >= left && x4 <= right && t4 < tMin) { tMin = t4; ix = x4; iy = bottom; }
        }
        ctx.save();
        ctx.setTransform(this.cm.dpr, 0, 0, this.cm.dpr, 0, 0);
        ctx.translate(ix, iy);
        ctx.rotate(angle);
        ctx.fillStyle = (GAME_CONFIG.ui?.boostArrowFill) || "#03a9f4";
        ctx.strokeStyle = (GAME_CONFIG.ui?.stroke) || "#000";
        ctx.lineWidth = 2;
        const size = 14;
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.6, size * 0.6);
        ctx.lineTo(-size * 0.6, -size * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        // distance label in meters (non-rotated)
        const dx = (boost.x - camXPx) - cx;
        const dy = (boost.y - camYPx) - cy;
        const distM = Math.round(Math.hypot(dx, dy) / METERS_TO_PIXELS);
        const labelY = Math.min(Math.max(iy + 6, 0), viewH - 14);
        ctx.font = (GAME_CONFIG.ui?.metrics?.fontSmall) || '16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = (GAME_CONFIG.ui?.text) || '#fff';
        ctx.strokeStyle = (GAME_CONFIG.ui?.stroke) || '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(`${distM}m`, ix, labelY);
        ctx.fillText(`${distM}m`, ix, labelY);
    }

    drawGameOverOverlay(ctx, viewW, viewH, game) {
        ctx.save();
        // Dim screen stronger
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, viewW, viewH);
        // Texts
        const centerX = Math.floor(viewW / 2);
        let y = Math.floor(viewH / 2) - 40;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.font = (GAME_CONFIG.ui?.metrics?.fontTimer) || '24px monospace';
        ctx.lineWidth = 4;
        ctx.strokeStyle = (GAME_CONFIG.ui?.stroke) || '#000';
        ctx.fillStyle = (GAME_CONFIG.ui?.text) || '#fff';
        const title = 'GAME OVER';
        ctx.strokeText(title, centerX, y);
        ctx.fillText(title, centerX, y);

        // Score (deliveries)
        y += 26;
        ctx.font = (GAME_CONFIG.ui?.metrics?.fontMain) || '18px monospace';
        const score = `Score: ${game.deliveries}`;
        ctx.strokeText(score, centerX, y);
        ctx.fillText(score, centerX, y);

        // Elapsed time total
        y += 20;
        const totalMs = (game.elapsedAtGameOverMs != null) ? game.elapsedAtGameOverMs : ((game.timerTotalMs ?? 0) - (game.timerRemainingMs ?? 0));
        const totalSec = Math.max(0, Math.floor(totalMs / 1000));
        const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
        const ss = String(totalSec % 60).padStart(2, '0');
        const elapsed = `Time: ${mm}:${ss}`;
        ctx.strokeText(elapsed, centerX, y);
        ctx.fillText(elapsed, centerX, y);

        // Hint
        y += 22;
        const hint = 'try again (F5)';
        ctx.strokeText(hint, centerX, y);
        ctx.fillText(hint, centerX, y);
        ctx.restore();
    }

    drawPauseOverlay(ctx, viewW, viewH) {
        ctx.save();
        // Dim screen
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, viewW, viewH);
        // Text
        ctx.font = (GAME_CONFIG.ui?.metrics?.fontTimer) || '24px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const title = 'PAUSED';
        const hint = '(Escape)';
        const x = Math.floor(viewW / 2);
        const y = Math.floor(viewH / 2) - 8;
        ctx.lineWidth = 4;
        ctx.strokeStyle = (GAME_CONFIG.ui?.stroke) || '#000';
        ctx.fillStyle = (GAME_CONFIG.ui?.text) || '#fff';
        ctx.strokeText(title, x, y);
        ctx.fillText(title, x, y);
        // hint below
        ctx.font = (GAME_CONFIG.ui?.metrics?.fontMain) || '18px monospace';
        ctx.strokeText(hint, x, y + 24);
        ctx.fillText(hint, x, y + 24);
        ctx.restore();
    }

    drawTargetArrow(playerController, target, camera) {
        const ctx = this.cm.ctx;
        const viewW = this.cm.canvas.width / this.cm.dpr;
        const viewH = this.cm.canvas.height / this.cm.dpr;

        const camXPx = camera.getOffsetXPx ? camera.getOffsetXPx() : (camera.x || 0);
        const camYPx = camera.getOffsetYPx ? camera.getOffsetYPx() : (camera.y || 0);
        const tx = (target.x - camXPx);
        const ty = (target.y - camYPx);
        if (tx >= 0 && tx <= viewW && ty >= 0 && ty <= viewH) return;

        const cx = viewW / 2;
        const cy = viewH / 2;
        const vx = tx - cx;
        const vy = ty - cy;
        const angle = Math.atan2(vy, vx);

        const margin = 24;
        const left = margin, right = viewW - margin, top = margin, bottom = viewH - margin;
        let tMin = Infinity; let ix = cx, iy = cy;
        if (vx !== 0) {
            const t1 = (left - cx) / vx; const y1 = cy + t1 * vy;
            if (t1 > 0 && y1 >= top && y1 <= bottom && t1 < tMin) { tMin = t1; ix = left; iy = y1; }
            const t2 = (right - cx) / vx; const y2 = cy + t2 * vy;
            if (t2 > 0 && y2 >= top && y2 <= bottom && t2 < tMin) { tMin = t2; ix = right; iy = y2; }
        }
        if (vy !== 0) {
            const t3 = (top - cy) / vy; const x3 = cx + t3 * vx;
            if (t3 > 0 && x3 >= left && x3 <= right && t3 < tMin) { tMin = t3; ix = x3; iy = top; }
            const t4 = (bottom - cy) / vy; const x4 = cx + t4 * vx;
            if (t4 > 0 && x4 >= left && x4 <= right && t4 < tMin) { tMin = t4; ix = x4; iy = bottom; }
        }

        ctx.save();
        ctx.setTransform(this.cm.dpr, 0, 0, this.cm.dpr, 0, 0);
        ctx.translate(ix, iy);
        ctx.rotate(angle);
        ctx.fillStyle = (GAME_CONFIG.ui?.arrowFill) || "#ffeb3b";
        ctx.strokeStyle = (GAME_CONFIG.ui?.stroke) || "#000";
        ctx.lineWidth = 2;
        const size = 14;
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.6, size * 0.6);
        ctx.lineTo(-size * 0.6, -size * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        // distance label in meters near arrow (non-rotated)
        const dx = (target.x - camXPx) - cx;
        const dy = (target.y - camYPx) - cy;
        const distM = Math.round(Math.hypot(dx, dy) / METERS_TO_PIXELS);
        const labelY = Math.min(Math.max(iy + 6, 0), viewH - 14);
        ctx.font = (GAME_CONFIG.ui?.metrics?.fontSmall) || '16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = (GAME_CONFIG.ui?.text) || '#fff';
        ctx.strokeStyle = (GAME_CONFIG.ui?.stroke) || '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(`${distM}m`, ix, labelY);
        ctx.fillText(`${distM}m`, ix, labelY);
    }

    drawFps(ctx, resized) {
        ctx.save();
        ctx.font = (GAME_CONFIG.ui?.metrics?.fontMain) || "18px monospace";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        const text = `FPS: ${this.cm.fps}`;
        const screenMargin = (GAME_CONFIG.ui?.metrics?.screenMargin ?? 8);
        const padX = 4, padY = 2, lineH = (GAME_CONFIG.ui?.metrics?.lineHSmall ?? 16);
        const xLeft = screenMargin;
        const yTop = screenMargin;
        if (resized || !this._cache.fpsWidth) {
            // фиксированная ширина для 3-значного FPS во избежание мерцания
            this._cache.fpsWidth = Math.ceil(ctx.measureText("FPS: 000").width);
        }
        ctx.fillStyle = (GAME_CONFIG.ui?.backdrop) || "rgba(0,0,0,0.5)";
        ctx.fillRect(xLeft - padX, yTop - padY, this._cache.fpsWidth + padX * 2, lineH + padY * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = (GAME_CONFIG.ui?.stroke) || "#000";
        ctx.fillStyle = (GAME_CONFIG.ui?.fps) || "#0f0";
        ctx.strokeText(text, xLeft, yTop);
        ctx.fillText(text, xLeft, yTop);
        ctx.restore();
    }

    drawTimer(ctx, viewW, remainingMs) {
        const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
        const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const ss = String(totalSeconds % 60).padStart(2, '0');
        const text = `${mm}:${ss}`;
        ctx.save();
        ctx.font = (GAME_CONFIG.ui?.metrics?.fontTimer) || "24px monospace";
        ctx.textBaseline = "top";
        ctx.textAlign = "center";
        const x = Math.floor(viewW / 2);
        const y = 6;
        ctx.lineWidth = 3;
        ctx.strokeStyle = (GAME_CONFIG.ui?.stroke) || "#000";
        ctx.fillStyle = (GAME_CONFIG.ui?.text) || "#fff";
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    drawStatsTopRight(ctx, viewW, game, resized) {
        const player = game.player;
        if (!player || !player.stats) return;
        ctx.save();
        ctx.font = (GAME_CONFIG.ui?.metrics?.fontMain) || "18px monospace";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        // Show speed in m/s; support legacy px/s fallback
        const mps = (player.stats.moveSpeedMps != null)
            ? player.stats.moveSpeedMps
            : (player.stats.moveSpeed != null ? (player.stats.moveSpeed / METERS_TO_PIXELS) : 0);
        const speed = Math.round(mps * 10) / 10;
        // Player section
        const labels = ["PLAYER", "MAX HP:", "SPEED (m/s):"];
        const values = ["", String(player.stats.maxHp), String(speed)];
        const screenMargin = (GAME_CONFIG.ui?.metrics?.screenMargin ?? 8), padX = (GAME_CONFIG.ui?.metrics?.padX ?? 6), padY = (GAME_CONFIG.ui?.metrics?.padY ?? 4), lineH = (GAME_CONFIG.ui?.metrics?.lineHSmall ?? 16);
        const yTop = 6;
        if (resized || !this._cache.statsWidth) {
            const labelW = Math.max(...labels.map(t => Math.ceil(ctx.measureText(t).width)));
            const valueW = Math.max(...values.map(t => Math.ceil(ctx.measureText(t).width)));
            this._cache.statsWidth = labelW + 8 + valueW; // 8px gutter
            this._cache.statsLabelW = labelW;
        }
        const rectW = this._cache.statsWidth + padX * 2;
        const rectH = labels.length * lineH + padY * 2;
        const rectX = Math.floor(viewW - screenMargin - rectW);
        const rectY = Math.floor(yTop - padY);
        ctx.fillStyle = (GAME_CONFIG.ui?.backdrop) || "rgba(0,0,0,0.5)";
        ctx.fillRect(rectX, rectY, rectW, rectH);
        ctx.lineWidth = 2;
        ctx.strokeStyle = (GAME_CONFIG.ui?.stroke) || "#000";
        ctx.fillStyle = (GAME_CONFIG.ui?.text) || "#fff";
        let y = Math.round(rectY + padY);
        const lx = rectX + padX;
        const vx = lx + this._cache.statsLabelW + 8; // values start
        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            const value = values[i];
            ctx.strokeText(label, lx, y);
            ctx.fillText(label, lx, y);
            if (value) {
                // align values to the right edge of rect (minus padding)
                const valueW = Math.ceil(ctx.measureText(value).width);
                const rightX = rectX + rectW - padX;
                const vxRight = rightX - valueW;
                ctx.strokeText(value, vxRight, y);
                ctx.fillText(value, vxRight, y);
            }
            y += lineH;
        }
        // Spawner section (powerups, global)
        const spm = game.spawns;
        const sp = spm ? { maxCount: spm.maxCount, intervalMs: spm.intervalMs } : (GAME_CONFIG.enemies?.spawn) || {};
        const pu = (GAME_CONFIG.enemies?.powerup) || {};
        const x2 = rectX; // same right edge block below
        const y2 = rectY + rectH + 6;
        const labels2 = ["SPAWN", "MAX COUNT:", "INTERVAL (ms):"];
        const maxWithDelta = `${sp.maxCount ?? 0} (+${pu.maxCountDelta ?? 0})`;
        const intervalWithDelta = `${sp.intervalMs ?? 0} (-${pu.intervalDeltaMs ?? 0})`;
        const values2 = ["", maxWithDelta, intervalWithDelta];
        // measure width for second block
        const labelW2 = Math.max(...labels2.map(t => Math.ceil(ctx.measureText(t).width)));
        const valueW2 = Math.max(...values2.map(t => Math.ceil(ctx.measureText(t).width)));
        const rectW2 = labelW2 + 8 + valueW2 + padX * 2;
        const rectH2 = labels2.length * lineH + padY * 2;
        const rectX2 = Math.floor(viewW - screenMargin - rectW2);
        const rectY2 = Math.floor(y2 - padY);
        ctx.fillStyle = (GAME_CONFIG.ui?.backdrop) || "rgba(0,0,0,0.5)";
        ctx.fillRect(rectX2, rectY2, rectW2, rectH2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = (GAME_CONFIG.ui?.stroke) || "#000";
        ctx.fillStyle = (GAME_CONFIG.ui?.text) || "#fff";
        let yb = Math.round(rectY2 + padY);
        const lxb = rectX2 + padX;
        for (let i = 0; i < labels2.length; i++) {
            const label = labels2[i];
            const value = values2[i];
            ctx.strokeText(label, lxb, yb);
            ctx.fillText(label, lxb, yb);
            if (value) {
                const valueW = Math.ceil(ctx.measureText(value).width);
                const rightX = rectX2 + rectW2 - padX;
                const vxRight = rightX - valueW;
                ctx.strokeText(value, vxRight, yb);
                ctx.fillText(value, vxRight, yb);
            }
            yb += lineH;
        }
        // Per-mob speeds and powerups (DOG)
        const dogCfg = (GAME_CONFIG.enemies?.dog) || {};
        const dogSpeed = typeof dogCfg.moveSpeedMps === 'number' ? dogCfg.moveSpeedMps : 0;
        const dogPu = (dogCfg.powerup || {});
        const mobY = rectY2 + rectH2 + 6;
        const mobLabels = [
            "DOGS",
            "SPEED (m/s):",
            "DAMAGE/TICK:",
            "DAMAGE INTERVAL (ms):",
            "MAX HP:",
            "LIFETIME (s):",
        ];
        const speedWithDelta = `${(Math.round(dogSpeed * 10) / 10)} (+${dogPu.speedDeltaMps ?? (pu.speedDeltaMps ?? 0)})`;
        const mobValues = [
            "",
            speedWithDelta,
            String(dogCfg.damagePerTick ?? 0),
            String(dogCfg.damageIntervalMs ?? 0),
            String(dogCfg.maxHp ?? 0),
            String(dogCfg.lifetimeSec ?? 0),
        ];
        const labelWm = Math.max(...mobLabels.map(t => Math.ceil(ctx.measureText(t).width)));
        const valueWm = Math.max(...mobValues.map(t => Math.ceil(ctx.measureText(t).width)));
        const rectWm = labelWm + 8 + valueWm + padX * 2;
        const rectHm = mobLabels.length * lineH + padY * 2;
        const rectXm = Math.floor(viewW - screenMargin - rectWm);
        const rectYm = Math.floor(mobY - padY);
        ctx.fillStyle = (GAME_CONFIG.ui?.backdrop) || "rgba(0,0,0,0.5)";
        ctx.fillRect(rectXm, rectYm, rectWm, rectHm);
        ctx.lineWidth = 2;
        ctx.strokeStyle = (GAME_CONFIG.ui?.stroke) || "#000";
        ctx.fillStyle = (GAME_CONFIG.ui?.text) || "#fff";
        let ym = Math.round(rectYm + padY);
        const lxm = rectXm + padX;
        for (let i = 0; i < mobLabels.length; i++) {
            const label = mobLabels[i];
            const value = mobValues[i];
            ctx.strokeText(label, lxm, ym);
            ctx.fillText(label, lxm, ym);
            if (value) {
                const valueW = Math.ceil(ctx.measureText(value).width);
                const rightX = rectXm + rectWm - padX;
                const vxRight = rightX - valueW;
                ctx.strokeText(value, vxRight, ym);
                ctx.fillText(value, vxRight, ym);
            }
            ym += lineH;
        }
        // Per-mob (CAR)
        const carCfg = (GAME_CONFIG.enemies?.car) || {};
        const carSpeed = typeof carCfg.moveSpeedMps === 'number' ? carCfg.moveSpeedMps : 0;
        const carPu = (carCfg.powerup || {});
        const carSpawn = (carCfg.spawn || {});
        const mobY2 = rectYm + rectHm + 6;
        const carLabels = [
            "CARS",
            "SPEED (m/s):",
            "DAMAGE/HIT:",
            "MAX COUNT:",
            "INTERVAL (ms):",
        ];
        const carSpeedWithDelta = `${(Math.round(carSpeed * 10) / 10)} (+${carPu.speedDeltaMps ?? (pu.speedDeltaMps ?? 0)})`;
        const carMaxWithDelta = `${carSpawn.maxCount ?? 0} (+${carPu.maxCountDelta ?? 0})`;
        const carIntervalWithDelta = `${carSpawn.intervalMs ?? 0} (-${carPu.intervalDeltaMs ?? 0})`;
        const carValues = [
            "",
            carSpeedWithDelta,
            String(carCfg.damagePerHit ?? 0),
            carMaxWithDelta,
            carIntervalWithDelta,
        ];
        const labelWc = Math.max(...carLabels.map(t => Math.ceil(ctx.measureText(t).width)));
        const valueWc = Math.max(...carValues.map(t => Math.ceil(ctx.measureText(t).width)));
        const rectWc = labelWc + 8 + valueWc + padX * 2;
        const rectHc = carLabels.length * lineH + padY * 2;
        const rectXc = Math.floor(viewW - screenMargin - rectWc);
        const rectYc = Math.floor(mobY2 - padY);
        ctx.fillStyle = (GAME_CONFIG.ui?.backdrop) || "rgba(0,0,0,0.5)";
        ctx.fillRect(rectXc, rectYc, rectWc, rectHc);
        ctx.lineWidth = 2;
        ctx.strokeStyle = (GAME_CONFIG.ui?.stroke) || "#000";
        ctx.fillStyle = (GAME_CONFIG.ui?.text) || "#fff";
        let yc = Math.round(rectYc + padY);
        const lxc = rectXc + padX;
        for (let i = 0; i < carLabels.length; i++) {
            const label = carLabels[i];
            const value = carValues[i];
            ctx.strokeText(label, lxc, yc);
            ctx.fillText(label, lxc, yc);
            if (value) {
                const valueW = Math.ceil(ctx.measureText(value).width);
                const rightX = rectXc + rectWc - padX;
                const vxRight = rightX - valueW;
                ctx.strokeText(value, vxRight, yc);
                ctx.fillText(value, vxRight, yc);
            }
            yc += lineH;
        }
        ctx.restore();
    }

    drawBottomLeftHud(ctx, viewH, player, deliveries, elapsedMs, resized) {
        ctx.save();
        const screenMargin = (GAME_CONFIG.ui?.metrics?.screenMargin ?? 8), gap = (GAME_CONFIG.ui?.metrics?.gap ?? 6), padX = (GAME_CONFIG.ui?.metrics?.padX ?? 6), padY = (GAME_CONFIG.ui?.metrics?.padY ?? 4);
        const scoreLineH = (GAME_CONFIG.ui?.metrics?.lineHMain ?? 18);
        const barH = scoreLineH + padY * 2;

        // Score
        const totalSeconds = Math.max(0, Math.floor((elapsedMs ?? 0) / 1000));
        const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const ss = String(totalSeconds % 60).padStart(2, '0');
        const coins = (player?.model?.coins) || 0;
        const scoreText = `DELIVERED: ${deliveries}   COINS: ${coins}   TIME: ${mm}:${ss}`;
        ctx.font = (GAME_CONFIG.ui?.metrics?.fontMain) || "18px monospace";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        if (resized || this._cache.lastScoreText !== scoreText) {
            this._cache.scoreWidth = Math.ceil(ctx.measureText(scoreText).width);
            this._cache.lastScoreText = scoreText;
        }
        const minW = (GAME_CONFIG.ui?.metrics?.minHudWidth ?? 220);
        const rectW = Math.max((GAME_CONFIG.ui?.metrics?.minHudWidth ?? 220), this._cache.scoreWidth + padX * 2);
        const rectH = scoreLineH + padY * 2;
        const xLeft = screenMargin;
        const totalH = rectH + gap + barH;
        const yTopScore = viewH - screenMargin - totalH;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(xLeft - padX, yTopScore - padY, rectW, rectH);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#000";
        ctx.fillStyle = "#fff";
        ctx.strokeText(scoreText, Math.round(xLeft), Math.round(yTopScore));
        ctx.fillText(scoreText, Math.round(xLeft), Math.round(yTopScore));

        // HP bar
        const barX = xLeft - padX;
        const barY = yTopScore - padY + rectH + gap;
        ctx.fillStyle = (GAME_CONFIG.ui?.hpBarBg) || "#000";
        ctx.fillRect(barX, barY, rectW, barH);
        if (player && player.stats) {
            const maxHp = player.stats.maxHp;
            const hp = Math.max(0, Math.min(maxHp, Math.round(player.model.hp ?? maxHp)));
            const frac = maxHp > 0 ? hp / maxHp : 0;
            const innerPad = 2;
            const fillW = Math.floor((rectW - innerPad * 2) * frac);
            const fillH = barH - innerPad * 2;
            ctx.fillStyle = (GAME_CONFIG.ui?.hpBarFill) || "#e53935";
            ctx.fillRect(barX + innerPad, barY + innerPad, fillW, fillH);
            const label = `${hp}/${maxHp}`;
            ctx.font = (GAME_CONFIG.ui?.metrics?.fontSmall) || "16px monospace";
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            const cx = barX + rectW / 2;
            const cy = barY + barH / 2;
            ctx.lineWidth = 3;
            ctx.strokeStyle = (GAME_CONFIG.ui?.stroke) || "#000";
            ctx.fillStyle = (GAME_CONFIG.ui?.text) || "#fff";
            ctx.strokeText(label, cx, cy);
            ctx.fillText(label, cx, cy);
        }
        ctx.restore();
    }
}


