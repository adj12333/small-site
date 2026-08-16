/**
 * ThemeEngine - UI主题与样式管理引擎
 * 定义简约科技风配色和样式变量
 */
class ThemeEngine {
    constructor() {
        this.colors = {
            background: '#0a0e17',
            panelBg: '#111827',
            primary: '#3b82f6',
            primaryHover: '#60a5fa',
            secondary: '#64748b',
            text: '#f1f5f9',
            textMuted: '#94a3b8',
            border: '#1e293b',
            borderHover: '#334155',
            success: '#22c55e',
            danger: '#ef4444',
            warning: '#f59e0b',
            selection: '#3b82f6',
            minimapBg: '#0f172a',
            hpBar: '#ef4444',
            shieldBar: '#3b82f6',
            energy: '#f59e0b',
            crystal: '#a855f7',
            supply: '#22c55e',
            population: '#f1f5f9'
        };

        this.fonts = {
            title: 'bold 36px "Segoe UI", Arial, sans-serif',
            menu: '24px "Segoe UI", Arial, sans-serif',
            hud: '16px "Segoe UI", Arial, sans-serif',
            small: '12px "Segoe UI", Arial, sans-serif'
        };

        this.layout = {
            resourceBarHeight: 40,
            minimapSize: 180,
            unitPanelWidth: 280,
            controlButtonSize: 48,
            padding: 12,
            borderWidth: 1,
            borderRadius: 4
        };
    }

    applyToContext(ctx) {
        ctx.textBaseline = 'top';
        ctx.font = this.fonts.hud;
        ctx.fillStyle = this.colors.text;
    }

    getColor(name) {
        return this.colors[name] || this.colors.text;
    }

    getFont(name) {
        return this.fonts[name] || this.fonts.hud;
    }

    getLayout(name) {
        return this.layout[name] || 0;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeEngine;
}
