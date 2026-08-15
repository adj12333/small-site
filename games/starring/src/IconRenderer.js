/**
 * IconRenderer.js - Canvas 2D Sci-Fi Icon Rendering Engine
 * All icons are drawn using pure Canvas 2D API calls.
 * No external images, no emoji, no text as icons.
 */

// ---------- Global Color Tokens ----------
window.COLORS = {
    primary: '#3b82f6',
    primaryLight: '#60a5fa',
    primaryDark: '#1d4ed8',
    accent: '#06b6d4',
    success: '#22c55e',
    danger: '#ef4444',
    warning: '#f59e0b',
    purple: '#a855f7',
    orange: '#f97316',
    bgDark: '#020617',
    bgPanel: 'rgba(15, 23, 42, 0.92)',
    bgCard: 'rgba(30, 41, 59, 0.6)',
    border: 'rgba(96, 165, 250, 0.2)',
    borderHover: 'rgba(96, 165, 250, 0.5)',
    textPrimary: '#e2e8f0',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    hpBar: '#22c55e',
    hpBarLow: '#ef4444',
    shieldBar: '#3b82f6',
    energyColor: '#3b82f6',
    crystalColor: '#a855f7',
    supplyColor: '#f59e0b',
    populationColor: '#22c55e',
};

// ---------- IconRenderer Class ----------
class IconRenderer {

    static get _icons() {
        if (!IconRenderer._iconsCache) {
            IconRenderer._iconsCache = {
                // Resource Icons
                energy:       IconRenderer._drawEnergy,
                crystal:      IconRenderer._drawCrystal,
                supply:       IconRenderer._drawSupply,
                population:   IconRenderer._drawPopulation,

                // Command Icons
                move:         IconRenderer._drawMove,
                attack:       IconRenderer._drawAttack,
                patrol:       IconRenderer._drawPatrol,
                retreat:      IconRenderer._drawRetreat,
                build:        IconRenderer._drawBuild,
                blockade:     IconRenderer._drawBlockade,
                collect:      IconRenderer._drawCollect,
                bombard:      IconRenderer._drawBombard,

                // Attribute Icons
                hp:           IconRenderer._drawHp,
                shield:       IconRenderer._drawShield,
                speed:        IconRenderer._drawSpeed,

                // Notification Icons
                mail:         IconRenderer._drawMail,
                battleReport: IconRenderer._drawBattleReport,
                notification: IconRenderer._drawNotification,

                // Device Icons
                phone:        IconRenderer._drawPhone,
                tablet:       IconRenderer._drawTablet,
                desktop:      IconRenderer._drawDesktop,
            };
        }
        return IconRenderer._iconsCache;
    }

    // ---------- Main Dispatcher ----------

    static drawIcon(ctx, name, x, y, size, color) {
        const method = IconRenderer._icons[name];
        if (method) {
            ctx.save();
            method(ctx, x, y, size, color);
            ctx.restore();
        }
    }

    static iconExists(name) {
        return IconRenderer._icons[name] !== undefined;
    }

    // ==================== Resource Icons ====================

    // Lightning bolt
    static _drawEnergy(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 12);
        const half = size / 2;
        const top = y - half;
        const bottom = y + half;
        const left = x - half * 0.5;
        const right = x + half * 0.5;
        const midY = y + half * 0.15;

        // Polyline zigzag: top-center -> right-mid -> left-lower -> right-bottom-center
        ctx.beginPath();
        ctx.moveTo(x, top + lw * 2);
        ctx.lineTo(x + half * 0.55, midY - lw);
        ctx.lineTo(x - half * 0.2, midY - lw);
        ctx.lineTo(x + half * 0.3, midY + half * 0.35);
        ctx.lineTo(x - half * 0.35, bottom - lw);
        ctx.lineTo(x + half * 0.1, bottom - lw);
        ctx.lineTo(x, bottom - lw * 2);
        ctx.closePath();

        // Glow pass
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.fill();

        // Main pass
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.fill();
        ctx.stroke();
    }

    // Diamond / crystal
    static _drawCrystal(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 12);
        const half = size / 2;
        const top = y - half;
        const bottom = y + half;
        const left = x - half * 0.65;
        const right = x + half * 0.65;

        // Glow outer
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = lw * 4;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(right, y);
        ctx.lineTo(x, bottom);
        ctx.lineTo(left, y);
        ctx.closePath();
        ctx.stroke();

        // Main diamond
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, top + lw);
        ctx.lineTo(right, y);
        ctx.lineTo(x, bottom - lw);
        ctx.lineTo(left, y);
        ctx.closePath();
        ctx.stroke();

        // Fill with semi-transparent color
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = color;
        ctx.fill();

        // Diagonal cross lines
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = lw * 0.7;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, top + half * 0.3);
        ctx.lineTo(x, bottom - half * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(left + half * 0.2, y);
        ctx.lineTo(right - half * 0.2, y);
        ctx.stroke();
    }

    // Gear / supply
    static _drawSupply(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 14);
        const half = size / 2;
        const outerR = half * 0.7;
        const innerR = half * 0.35;
        const toothW = size / 10;
        const toothH = half * 0.3;

        // Glow pass
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, outerR, 0, Math.PI * 2);
        ctx.stroke();

        // Main outer circle
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, outerR, 0, Math.PI * 2);
        ctx.stroke();

        // 6 teeth around the edge
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i - Math.PI / 2;
            const tx = x + Math.cos(angle) * (outerR + toothH * 0.5);
            const ty = y + Math.sin(angle) * (outerR + toothH * 0.5);
            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(angle);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.7;
            ctx.fillRect(-toothW / 2, -toothH / 2, toothW, toothH);
            ctx.globalAlpha = 0.2;
            ctx.strokeStyle = color;
            ctx.lineWidth = lw * 0.5;
            ctx.strokeRect(-toothW / 2, -toothH / 2, toothW, toothH);
            ctx.restore();
        }

        // Inner circle
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, innerR, 0, Math.PI * 2);
        ctx.stroke();

        // Center dot
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, lw, 0, Math.PI * 2);
        ctx.fill();
    }

    // Two person silhouettes
    static _drawPopulation(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 14);
        const half = size / 2;
        const headR = half * 0.22;
        const bodyLen = half * 0.55;
        const legLen = half * 0.35;
        const offsetX = half * 0.38;

        // Helper to draw one stick figure
        const drawPerson = (cx, cy, alpha) => {
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = color;
            ctx.lineWidth = lw;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Head
            ctx.beginPath();
            ctx.arc(cx, cy - bodyLen, headR, 0, Math.PI * 2);
            ctx.stroke();

            // Body
            ctx.beginPath();
            ctx.moveTo(cx, cy - bodyLen + headR);
            ctx.lineTo(cx, cy);
            ctx.stroke();

            // Left leg
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx - headR * 1.2, cy + legLen);
            ctx.stroke();

            // Right leg
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + headR * 1.2, cy + legLen);
            ctx.stroke();

            // Left arm
            ctx.beginPath();
            ctx.moveTo(cx, cy - bodyLen * 0.55);
            ctx.lineTo(cx - headR * 1.1, cy - bodyLen * 0.1);
            ctx.stroke();

            // Right arm
            ctx.beginPath();
            ctx.moveTo(cx, cy - bodyLen * 0.55);
            ctx.lineTo(cx + headR * 1.1, cy - bodyLen * 0.1);
            ctx.stroke();
        };

        // Back person (slightly dimmer, offset)
        drawPerson(x - offsetX, y + half * 0.1, 0.4);
        // Front person
        drawPerson(x + offsetX, y + half * 0.1, 1);
    }

    // ==================== Command Icons ====================

    // Arrow pointing right
    static _drawMove(ctx, x, y, size, color) {
        const lw = Math.max(1.5, size / 10);
        const half = size / 2;
        const left = x - half * 0.8;
        const right = x + half * 0.8;
        const shaftTop = y - half * 0.2;
        const shaftBottom = y + half * 0.2;
        const arrowHeadSize = half * 0.5;

        // Glow
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right - arrowHeadSize * 0.6, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(right - arrowHeadSize * 0.6, shaftTop);
        ctx.lineTo(right, y);
        ctx.lineTo(right - arrowHeadSize * 0.6, shaftBottom);
        ctx.stroke();

        // Main shaft
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right - arrowHeadSize * 0.6, y);
        ctx.stroke();

        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(right - arrowHeadSize * 0.6, shaftTop);
        ctx.lineTo(right, y);
        ctx.lineTo(right - arrowHeadSize * 0.6, shaftBottom);
        ctx.closePath();
        ctx.fill();
    }

    // Crossed swords
    static _drawAttack(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 12);
        const half = size / 2;
        const bladeLen = half * 0.75;
        const handleLen = half * 0.35;
        const guardLen = half * 0.2;

        const drawSword = (angle) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.lineWidth = lw;
            ctx.strokeStyle = color;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Blade (tapered)
            ctx.beginPath();
            ctx.moveTo(0, -bladeLen);
            ctx.lineTo(0, -handleLen);
            ctx.stroke();

            // Glow on blade
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = lw * 3;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.lineWidth = lw;

            // Cross guard
            ctx.beginPath();
            ctx.moveTo(-guardLen, -handleLen);
            ctx.lineTo(guardLen, -handleLen);
            ctx.stroke();

            // Handle
            ctx.beginPath();
            ctx.moveTo(0, -handleLen);
            ctx.lineTo(0, handleLen);
            ctx.stroke();

            // Pommel
            ctx.beginPath();
            ctx.arc(0, handleLen, lw * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.5;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.stroke();

            ctx.restore();
        };

        drawSword(Math.PI / 4);
        drawSword(-Math.PI / 4);
    }

    // Circular arrow / patrol loop
    static _drawPatrol(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 12);
        const half = size / 2;
        const r = half * 0.6;
        const startAngle = -Math.PI * 0.6;
        const endAngle = Math.PI * 1.1;

        // Glow
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, startAngle, endAngle);
        ctx.stroke();

        // Main arc
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, startAngle, endAngle);
        ctx.stroke();

        // Arrowhead at end of arc
        const arrowAngle = endAngle;
        const arrowX = x + Math.cos(arrowAngle) * r;
        const arrowY = y + Math.sin(arrowAngle) * r;
        const arrowSize = half * 0.3;
        const perpAngle = arrowAngle + Math.PI / 2;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
            arrowX + Math.cos(arrowAngle - 2.5) * arrowSize,
            arrowY + Math.sin(arrowAngle - 2.5) * arrowSize
        );
        ctx.lineTo(
            arrowX + Math.cos(arrowAngle + 2.5) * arrowSize,
            arrowY + Math.sin(arrowAngle + 2.5) * arrowSize
        );
        ctx.closePath();
        ctx.fill();
    }

    // Reverse arrow / retreat
    static _drawRetreat(ctx, x, y, size, color) {
        const lw = Math.max(1.5, size / 10);
        const half = size / 2;
        const left = x - half * 0.8;
        const right = x + half * 0.8;
        const shaftTop = y - half * 0.2;
        const shaftBottom = y + half * 0.2;
        const arrowHeadSize = half * 0.5;

        // Glow
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(right, y);
        ctx.lineTo(left + arrowHeadSize * 0.6, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(left + arrowHeadSize * 0.6, shaftTop);
        ctx.lineTo(left, y);
        ctx.lineTo(left + arrowHeadSize * 0.6, shaftBottom);
        ctx.stroke();

        // Main shaft
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(right, y);
        ctx.lineTo(left + arrowHeadSize * 0.6, y);
        ctx.stroke();

        // Arrowhead (pointing left)
        ctx.beginPath();
        ctx.moveTo(left + arrowHeadSize * 0.6, shaftTop);
        ctx.lineTo(left, y);
        ctx.lineTo(left + arrowHeadSize * 0.6, shaftBottom);
        ctx.closePath();
        ctx.fill();
    }

    // Hammer
    static _drawBuild(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 12);
        const half = size / 2;
        const handleLeft = x - half * 0.12;
        const handleRight = x + half * 0.12;
        const handleTop = y - half * 0.15;
        const handleBottom = y + half * 0.7;
        const headLeft = x - half * 0.5;
        const headRight = x + half * 0.5;
        const headTop = y - half * 0.6;
        const headBottom = y - half * 0.15;

        // Glow
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        ctx.lineJoin = 'round';
        ctx.strokeRect(headLeft, headTop, headRight - headLeft, headBottom - headTop);
        ctx.beginPath();
        ctx.moveTo(x, handleTop);
        ctx.lineTo(x, handleBottom);
        ctx.stroke();

        // Hammer head
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(headLeft, headTop, headRight - headLeft, headBottom - headTop);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.strokeRect(headLeft, headTop, headRight - headLeft, headBottom - headTop);

        // Handle
        ctx.lineWidth = lw * 1.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, handleTop);
        ctx.lineTo(x, handleBottom);
        ctx.stroke();
    }

    // Circle with slash (blockade)
    static _drawBlockade(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 12);
        const half = size / 2;
        const r = half * 0.65;

        // Glow
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Main circle
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Diagonal slash
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + r * 0.7, y - r * 0.7);
        ctx.lineTo(x - r * 0.7, y + r * 0.7);
        ctx.stroke();

        // Glow on slash
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = lw * 2.5;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + r * 0.7, y - r * 0.7);
        ctx.lineTo(x - r * 0.7, y + r * 0.7);
        ctx.stroke();
    }

    // Claw / pickup
    static _drawCollect(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 12);
        const half = size / 2;
        const clawLen = half * 0.65;
        const spread = half * 0.45;
        const bottomY = y + half * 0.5;

        // Three claws converging from top to bottom
        const drawClaw = (startX, endX) => {
            const cp1x = startX;
            const cp1y = y - half * 0.1;
            const cp2x = endX;
            const cp2y = y + half * 0.1;

            ctx.beginPath();
            ctx.moveTo(startX, y - half * 0.5);
            ctx.quadraticCurveTo(cp1x, cp1y, endX, bottomY - half * 0.1);
            ctx.stroke();
        };

        // Glow
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        drawClaw(x - spread, x - half * 0.15);
        drawClaw(x, x);
        drawClaw(x + spread, x + half * 0.15);

        // Main claws
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        drawClaw(x - spread, x - half * 0.15);
        drawClaw(x, x);
        drawClaw(x + spread, x + half * 0.15);

        // Small connecting bar at bottom
        ctx.beginPath();
        ctx.moveTo(x - half * 0.2, bottomY);
        ctx.lineTo(x + half * 0.2, bottomY);
        ctx.stroke();
    }

    // Explosion / burst star
    static _drawBombard(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 14);
        const half = size / 2;
        const outerR = half * 0.75;
        const innerR = half * 0.25;
        const points = 6;

        // Glow
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const angle = (Math.PI * 2 / (points * 2)) * i - Math.PI / 2;
            const r = i % 2 === 0 ? outerR : innerR;
            const px = x + Math.cos(angle) * r;
            const py = y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // Main star
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const angle = (Math.PI * 2 / (points * 2)) * i - Math.PI / 2;
            const r = i % 2 === 0 ? outerR : innerR;
            const px = x + Math.cos(angle) * r;
            const py = y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
    }

    // ==================== Attribute Icons ====================

    // Cross / plus sign (HP)
    static _drawHp(ctx, x, y, size, color) {
        const lw = Math.max(1.5, size / 8);
        const half = size / 2;
        const armLen = half * 0.6;
        const armWidth = half * 0.2;

        // Glow
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = color;
        ctx.fillRect(x - armWidth, y - armLen, armWidth * 2, armLen * 2);
        ctx.fillRect(x - armLen, y - armWidth, armLen * 2, armWidth * 2);

        // Main cross
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.fillRect(x - armWidth, y - armLen, armWidth * 2, armLen * 2);
        ctx.fillRect(x - armLen, y - armWidth, armLen * 2, armWidth * 2);

        // Subtle outline
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = color;
        ctx.lineWidth = lw * 0.4;
        ctx.strokeRect(x - armWidth, y - armLen, armWidth * 2, armLen * 2);
        ctx.strokeRect(x - armLen, y - armWidth, armLen * 2, armWidth * 2);
    }

    // Shield
    static _drawShield(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 12);
        const half = size / 2;
        const topWidth = half * 0.55;
        const bottomY = y + half * 0.75;

        // Shield path: flat top, curved sides, pointed bottom
        const pathTop = y - half * 0.55;
        const leftX = x - topWidth;
        const rightX = x + topWidth;

        // Glow
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(leftX, pathTop);
        ctx.lineTo(rightX, pathTop);
        ctx.quadraticCurveTo(rightX + half * 0.15, y + half * 0.1, x, bottomY);
        ctx.quadraticCurveTo(leftX - half * 0.15, y + half * 0.1, leftX, pathTop);
        ctx.closePath();
        ctx.stroke();

        // Main shield
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(leftX, pathTop);
        ctx.lineTo(rightX, pathTop);
        ctx.quadraticCurveTo(rightX + half * 0.15, y + half * 0.1, x, bottomY);
        ctx.quadraticCurveTo(leftX - half * 0.15, y + half * 0.1, leftX, pathTop);
        ctx.closePath();
        ctx.stroke();

        // Fill
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = color;
        ctx.fill();

        // Inner detail line
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = lw * 0.6;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, pathTop + half * 0.2);
        ctx.lineTo(x, bottomY - half * 0.25);
        ctx.stroke();
    }

    // Speed (lightning + arrow)
    static _drawSpeed(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 12);
        const half = size / 2;
        const left = x - half * 0.75;
        const right = x + half * 0.75;
        const top = y - half * 0.5;
        const bottom = y + half * 0.5;

        // Glow
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // Lightning bolt
        ctx.beginPath();
        ctx.moveTo(x - half * 0.15, top);
        ctx.lineTo(x - half * 0.5, y + half * 0.05);
        ctx.lineTo(x - half * 0.2, y + half * 0.05);
        ctx.lineTo(x - half * 0.35, bottom);
        ctx.stroke();
        // Arrow
        ctx.beginPath();
        ctx.moveTo(x + half * 0.1, y - half * 0.3);
        ctx.lineTo(right, y);
        ctx.lineTo(x + half * 0.1, y + half * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();

        // Main lightning bolt
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x - half * 0.15, top);
        ctx.lineTo(x - half * 0.5, y + half * 0.05);
        ctx.lineTo(x - half * 0.2, y + half * 0.05);
        ctx.lineTo(x - half * 0.35, bottom);
        ctx.stroke();

        // Arrow shaft
        ctx.lineWidth = lw * 0.8;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right - half * 0.2, y);
        ctx.stroke();

        // Arrowhead
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(right - half * 0.25, y - half * 0.3);
        ctx.lineTo(right, y);
        ctx.lineTo(right - half * 0.25, y + half * 0.3);
        ctx.closePath();
        ctx.fill();
    }

    // ==================== Notification Icons ====================

    // Envelope
    static _drawMail(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 12);
        const half = size / 2;
        const w = half * 0.7;
        const h = half * 0.5;
        const left = x - w;
        const right = x + w;
        const top = y - h;
        const bottom = y + h;

        // Glow
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(left, top);
        ctx.lineTo(right, top);
        ctx.lineTo(right, bottom);
        ctx.lineTo(left, bottom);
        ctx.closePath();
        ctx.stroke();

        // Main envelope
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(left, top);
        ctx.lineTo(right, top);
        ctx.lineTo(right, bottom);
        ctx.lineTo(left, bottom);
        ctx.closePath();
        ctx.stroke();

        // Envelope flap - V shape
        ctx.beginPath();
        ctx.moveTo(left, top);
        ctx.lineTo(x, y);
        ctx.lineTo(right, top);
        ctx.stroke();

        // Fill
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = color;
        ctx.fillRect(left, top, w * 2, h * 2);
    }

    // Flag / banner
    static _drawBattleReport(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 12);
        const half = size / 2;
        const poleLeft = x - half * 0.2;
        const poleTop = y - half * 0.7;
        const poleBottom = y + half * 0.7;
        const flagRight = x + half * 0.6;
        const flagTop = y - half * 0.5;
        const flagBottom = y + half * 0.05;

        // Glow
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(poleLeft, poleTop);
        ctx.lineTo(poleLeft, poleBottom);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(poleLeft, flagTop);
        ctx.lineTo(flagRight, y - half * 0.15);
        ctx.lineTo(poleLeft, flagBottom);
        ctx.closePath();
        ctx.stroke();

        // Pole
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(poleLeft, poleTop);
        ctx.lineTo(poleLeft, poleBottom);
        ctx.stroke();

        // Flag
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(poleLeft, flagTop);
        ctx.lineTo(flagRight, y - half * 0.15);
        ctx.lineTo(poleLeft, flagBottom);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(poleLeft, flagTop);
        ctx.lineTo(flagRight, y - half * 0.15);
        ctx.lineTo(poleLeft, flagBottom);
        ctx.closePath();
        ctx.stroke();

        // Pole top ball
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(poleLeft, poleTop, lw * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Bell
    static _drawNotification(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 12);
        const half = size / 2;
        const bellW = half * 0.5;
        const bellTop = y - half * 0.45;
        const bellBottom = y + half * 0.25;
        const clapperY = y + half * 0.45;

        // Glow
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.arc(x, bellTop + half * 0.25, bellW, Math.PI, 0);
        ctx.lineTo(x + bellW, bellBottom);
        ctx.lineTo(x - bellW, bellBottom);
        ctx.closePath();
        ctx.stroke();

        // Main bell shape
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(x, bellTop + half * 0.25, bellW, Math.PI, 0);
        ctx.lineTo(x + bellW, bellBottom);
        ctx.lineTo(x - bellW, bellBottom);
        ctx.closePath();
        ctx.stroke();

        // Fill
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = color;
        ctx.fill();

        // Clapper
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw * 0.7;
        ctx.beginPath();
        ctx.moveTo(x, bellBottom);
        ctx.lineTo(x, clapperY);
        ctx.stroke();

        ctx.globalAlpha = 0.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, clapperY, lw * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Bell top knob
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(x, bellTop, lw * 1.3, 0, Math.PI * 2);
        ctx.fill();
    }

    // ==================== Device Icons ====================

    // Helper for rounded rect
    static _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }

    // Smartphone
    static _drawPhone(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 14);
        const half = size / 2;
        const w = half * 0.42;
        const h = half * 0.75;
        const r = size / 10;
        const left = x - w;
        const right = x + w;
        const top = y - h;
        const bottom = y + h;

        // Glow
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        IconRenderer._roundRect(ctx, left, top, w * 2, h * 2, r);
        ctx.stroke();

        // Main body
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.strokeStyle = color;
        IconRenderer._roundRect(ctx, left, top, w * 2, h * 2, r);
        ctx.stroke();

        // Fill
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = color;
        ctx.fill();

        // Screen area
        const screenMargin = half * 0.12;
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = color;
        ctx.fillRect(
            left + screenMargin,
            top + screenMargin + half * 0.1,
            w * 2 - screenMargin * 2,
            h * 1.2 - screenMargin * 2
        );

        // Home button
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = lw * 0.6;
        ctx.beginPath();
        ctx.arc(x, bottom - half * 0.2, lw * 1.5, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Tablet
    static _drawTablet(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 14);
        const half = size / 2;
        const w = half * 0.65;
        const h = half * 0.55;
        const r = size / 10;
        const left = x - w;
        const right = x + w;
        const top = y - h;
        const bottom = y + h;

        // Glow
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        IconRenderer._roundRect(ctx, left, top, w * 2, h * 2, r);
        ctx.stroke();

        // Main body
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.strokeStyle = color;
        IconRenderer._roundRect(ctx, left, top, w * 2, h * 2, r);
        ctx.stroke();

        // Fill
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = color;
        ctx.fill();

        // Screen area
        const screenMargin = half * 0.12;
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = color;
        ctx.fillRect(
            left + screenMargin,
            top + screenMargin,
            w * 2 - screenMargin * 2,
            h * 2 - screenMargin * 2 - half * 0.15
        );

        // Home button / camera dot
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, top + screenMargin + half * 0.1, lw * 1.2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Desktop monitor
    static _drawDesktop(ctx, x, y, size, color) {
        const lw = Math.max(1, size / 14);
        const half = size / 2;
        const screenW = half * 0.65;
        const screenH = half * 0.45;
        const screenTop = y - half * 0.5;
        const screenBottom = screenTop + screenH * 2;
        const screenLeft = x - screenW;
        const screenRight = x + screenW;
        const standW = half * 0.3;
        const standH = half * 0.2;
        const baseW = half * 0.5;
        const baseH = lw * 1.5;

        // Screen glow
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = lw * 3;
        ctx.strokeStyle = color;
        ctx.lineJoin = 'round';
        IconRenderer._roundRect(ctx, screenLeft, screenTop, screenW * 2, screenH * 2, lw * 2);
        ctx.stroke();

        // Screen
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw;
        ctx.strokeStyle = color;
        IconRenderer._roundRect(ctx, screenLeft, screenTop, screenW * 2, screenH * 2, lw * 2);
        ctx.stroke();

        // Screen fill
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = color;
        ctx.fill();

        // Inner screen
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = color;
        ctx.fillRect(
            screenLeft + half * 0.1,
            screenTop + half * 0.08,
            screenW * 2 - half * 0.2,
            screenH * 2 - half * 0.16
        );

        // Stand
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw * 0.8;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, screenBottom);
        ctx.lineTo(x, screenBottom + standH);
        ctx.stroke();

        // Base
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = color;
        ctx.fillRect(x - baseW, screenBottom + standH, baseW * 2, baseH);
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw * 0.6;
        ctx.strokeStyle = color;
        ctx.strokeRect(x - baseW, screenBottom + standH, baseW * 2, baseH);
    }
}

// Make IconRenderer available globally
window.IconRenderer = IconRenderer;