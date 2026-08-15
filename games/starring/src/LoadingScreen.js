/**
 * 加载画面控制器
 * 管理加载动画、进度更新和星空生成
 */
class LoadingScreen {
    constructor() {
        this.element = document.getElementById('loading-screen');
        this.progressBar = document.getElementById('loading-progress');
        this.loadingText = document.getElementById('loading-text');
        this.starsContainer = document.getElementById('loading-stars');
        this.currentProgress = 0;
        this.targetProgress = 0;
        this.isComplete = false;
        this._rafId = null;

        this._initStars();
        this._startProgressAnimation();
    }

    /**
     * 生成背景星空
     */
    _initStars() {
        if (!this.starsContainer) return;

        const starCount = 80;
        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('div');
            star.className = 'loading-star';

            const size = Math.random() * 2 + 1;
            const x = Math.random() * 100;
            const y = Math.random() * 100;
            const duration = Math.random() * 3 + 2;
            const delay = Math.random() * 5;
            const minOpacity = Math.random() * 0.3 + 0.1;
            const maxOpacity = Math.random() * 0.5 + 0.5;

            star.style.cssText = `
                width: ${size}px;
                height: ${size}px;
                left: ${x}%;
                top: ${y}%;
                --duration: ${duration}s;
                --delay: ${delay}s;
                --min-opacity: ${minOpacity};
                --max-opacity: ${maxOpacity};
            `;

            this.starsContainer.appendChild(star);
        }
    }

    /**
     * 启动进度条动画循环
     */
    _startProgressAnimation() {
        const animate = () => {
            if (this.isComplete) return;

            // 平滑插值到目标进度
            const diff = this.targetProgress - this.currentProgress;
            if (Math.abs(diff) > 0.1) {
                this.currentProgress += diff * 0.08;
                this._updateProgressUI();
            }

            this._rafId = requestAnimationFrame(animate);
        };
        this._rafId = requestAnimationFrame(animate);
    }

    /**
     * 更新进度条UI
     */
    _updateProgressUI() {
        if (this.progressBar) {
            this.progressBar.style.width = `${Math.min(100, this.currentProgress)}%`;
        }
    }

    /**
     * 设置加载进度 (0-100)
     * @param {number} progress - 进度百分比
     * @param {string} text - 加载状态文字
     */
    setProgress(progress, text) {
        this.targetProgress = Math.min(100, Math.max(0, progress));
        if (text && this.loadingText) {
            this.loadingText.textContent = text;
        }
    }

    /**
     * 模拟加载阶段
     * @param {Array<{progress:number, text:string, delay:number}>} stages - 加载阶段
     */
    async simulateStages(stages) {
        for (const stage of stages) {
            this.setProgress(stage.progress, stage.text);
            await this._sleep(stage.delay || 300);
        }
    }

    /**
     * 完成加载并隐藏
     */
    complete() {
        this.isComplete = true;
        // 取消动画循环
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this.currentProgress = 100;
        this._updateProgressUI();

        // 延迟隐藏以显示100%状态
        setTimeout(() => {
            if (this.element) {
                this.element.classList.add('hidden');
            }
            // 完全隐藏后清理DOM
            setTimeout(() => {
                if (this.element && this.element.parentNode) {
                    this.element.style.display = 'none';
                }
            }, 800);
        }, 400);
    }

    /**
     * 立即隐藏（用于快速启动）
     */
    hide() {
        this.isComplete = true;
        if (this.element) {
            this.element.classList.add('hidden');
            setTimeout(() => {
                if (this.element) this.element.style.display = 'none';
            }, 800);
        }
    }

    /**
     * 延迟辅助函数
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 全局加载画面实例
window.loadingScreen = new LoadingScreen();
