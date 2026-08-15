(function() {
    if (typeof window !== 'undefined' && window.ProximaCoinRenderer) {
        return;
    }

    class ProximaCoinRenderer {
        constructor() {
            this.colors = {
                primary: '#8b5cf6',
                secondary: '#a855f7',
                highlight: '#c4b5fd',
                star: '#ddd6fe'
            };
        }

        draw(ctx, x, y, size) {
            const halfSize = size / 2;
            const centerX = x + halfSize;
            const centerY = y + halfSize;
            const radius = halfSize * 0.9;

            // 绘制六边形
            this.drawHexagon(ctx, centerX, centerY, radius);

            // 绘制四角星
            this.drawStar(ctx, centerX, centerY, radius * 0.5);
        }

        drawHexagon(ctx, centerX, centerY, radius) {
            ctx.save();

            // 创建径向渐变
            const gradient = ctx.createRadialGradient(
                centerX - radius * 0.3,
                centerY - radius * 0.3,
                0,
                centerX,
                centerY,
                radius
            );
            gradient.addColorStop(0, this.colors.highlight);
            gradient.addColorStop(0.3, this.colors.primary);
            gradient.addColorStop(1, this.colors.secondary);

            // 绘制六边形路径
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i - Math.PI / 2;
                const px = centerX + radius * Math.cos(angle);
                const py = centerY + radius * Math.sin(angle);
                if (i === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.closePath();

            // 填充六边形
            ctx.fillStyle = gradient;
            ctx.fill();

            // 绘制边框
            ctx.strokeStyle = this.colors.highlight;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.restore();
        }

        drawStar(ctx, centerX, centerY, radius) {
            ctx.save();

            // 绘制四角星
            ctx.beginPath();
            const spikes = 4;
            const innerRadius = radius * 0.4;

            for (let i = 0; i < spikes * 2; i++) {
                const angle = (Math.PI / spikes) * i - Math.PI / 2;
                const r = i % 2 === 0 ? radius : innerRadius;
                const px = centerX + r * Math.cos(angle);
                const py = centerY + r * Math.sin(angle);
                if (i === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.closePath();

            // 填充星形
            ctx.fillStyle = this.colors.star;
            ctx.fill();

            // 星形边框
            ctx.strokeStyle = this.colors.highlight;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.restore();
        }
    }

    if (typeof window !== 'undefined') {
        window.ProximaCoinRenderer = ProximaCoinRenderer;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ProximaCoinRenderer;
    }
})();
