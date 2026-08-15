/**
 * SelectionRenderer - 单位选择框渲染器
 * 显示拖拽框选和选中单位的高亮效果
 */
class SelectionRenderer {
    constructor(ctx, theme, gameCore) {
        this.ctx = ctx;
        this.theme = theme;
        this.gameCore = gameCore;
        this.dragRect = null;
        this.selectedUnits = [];
        this.animationTime = 0;
    }

    setGameCore(gameCore) {
        this.gameCore = gameCore;
    }

    setDragRect(x1, y1, x2, y2) {
        this.dragRect = { x1, y1, x2, y2 };
    }

    clearDragRect() {
        this.dragRect = null;
    }

    setSelectedUnits(units) {
        this.selectedUnits = units || [];
    }

    update(dt) {
        this.animationTime += dt;
    }

    render() {
        this._renderDragRect();
        this._renderUnitHighlights();
    }

    _renderDragRect() {
        if (!this.dragRect) return;
        const ctx = this.ctx;
        const colors = this.theme.colors;

        // 将屏幕坐标转换为世界坐标，再转换回屏幕坐标（考虑摄像机变换）
        let x1, y1, x2, y2;
        if (this.gameCore && this.gameCore.camera) {
            const startWorld = this.gameCore.screenToWorld(this.dragRect.x1, this.dragRect.y1);
            const endWorld = this.gameCore.screenToWorld(this.dragRect.x2, this.dragRect.y2);
            const startScreen = this.gameCore.worldToScreen(startWorld.x, startWorld.y);
            const endScreen = this.gameCore.worldToScreen(endWorld.x, endWorld.y);
            x1 = startScreen.x;
            y1 = startScreen.y;
            x2 = endScreen.x;
            y2 = endScreen.y;
        } else {
            x1 = this.dragRect.x1;
            y1 = this.dragRect.y1;
            x2 = this.dragRect.x2;
            y2 = this.dragRect.y2;
        }

        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);
        const w = Math.abs(x2 - x1);
        const h = Math.abs(y2 - y1);

        const dashOffset = -(this.animationTime / 10) % 16;

        ctx.save();
        ctx.strokeStyle = colors.selection;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.lineDashOffset = dashOffset;
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        ctx.fillStyle = colors.selection + '22';
        ctx.fillRect(x, y, w, h);

        const cornerSize = 10;
        ctx.strokeStyle = colors.selection;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(x, y + cornerSize);
        ctx.lineTo(x, y);
        ctx.lineTo(x + cornerSize, y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + w - cornerSize, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + cornerSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, y + h - cornerSize);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + cornerSize, y + h);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + w - cornerSize, y + h);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + w, y + h - cornerSize);
        ctx.stroke();
        ctx.restore();
    }

    _renderUnitHighlights() {
        const ctx = this.ctx;
        const colors = this.theme.colors;

        ctx.save();
        if (this.gameCore && this.gameCore.camera) {
            const cam = this.gameCore.camera;
            const zoom = cam.zoom || 1.0;
            // 应用缩放和位移变换
            ctx.scale(zoom, zoom);
            ctx.translate(-cam.x, -cam.y);
        }

        for (const unit of this.selectedUnits) {
            if (!unit || unit.hp <= 0) continue;

            const size = unit.size || 24;
            const x = unit.x - size / 2;
            const y = unit.y - size / 2;

            const pulse = Math.sin(this.animationTime / 200) * 0.2 + 0.8;

            ctx.strokeStyle = colors.selection;
            ctx.lineWidth = 2;
            ctx.globalAlpha = pulse;
            ctx.strokeRect(x - 2, y - 2, size + 4, size + 4);

            ctx.fillStyle = colors.selection + '33';
            ctx.fillRect(x, y, size, size);

            ctx.globalAlpha = 1;

            const markSize = 6;
            ctx.fillStyle = colors.selection;

            ctx.fillRect(x - markSize, y - markSize, markSize, 2);
            ctx.fillRect(x - markSize, y - markSize, 2, markSize);

            ctx.fillRect(x + size, y - markSize, markSize, 2);
            ctx.fillRect(x + size + markSize - 2, y - markSize, 2, markSize);

            ctx.fillRect(x - markSize, y + size - 2, markSize, 2);
            ctx.fillRect(x - markSize, y + size - markSize, 2, markSize);

            ctx.fillRect(x + size, y + size - 2, markSize, 2);
            ctx.fillRect(x + size + markSize - 2, y + size - markSize, 2, markSize);
        }

        ctx.restore();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SelectionRenderer;
}
