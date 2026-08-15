/**
 * MusicManager - 游戏音乐管理器
 * 管理背景音乐切换、淡入淡出效果
 * 根据战斗状态自动切换音乐
 */
class MusicManager {
    constructor() {
        // 音频元素
        this.normalMusic = null;
        this.fightMusic = null;

        // 音乐状态
        this.currentState = 'normal'; // 'normal' | 'fight'
        this.isInCombat = false;
        this.combatEndTime = 0;
        this.combatCooldown = 5; // 战斗结束后5秒切换回normal

        // 淡入淡出配置
        this.fadeDuration = 2; // 秒
        this.targetVolume = 0.5; // 目标音量

        // 音频上下文（用于更精确的淡入淡出）
        this.audioContext = null;
        this.normalGainNode = null;
        this.fightGainNode = null;

        // 初始化标记
        this.initialized = false;
        this.userInteracted = false; // 用户是否已交互
        this.pendingStart = false; // 是否有待启动的音乐

        // 绑定用户交互事件
        this._bindUserInteraction();
    }

    /**
     * 绑定用户交互事件（用于解锁音频自动播放）
     */
    _bindUserInteraction() {
        const events = ['click', 'keydown', 'touchstart'];
        const handler = () => {
            this.userInteracted = true;
            if (this.pendingStart && this.initialized) {
                this._doStart();
            }
            // 移除事件监听
            events.forEach(event => {
                document.removeEventListener(event, handler);
            });
        };

        events.forEach(event => {
            document.addEventListener(event, handler, { once: true });
        });
    }

    /**
     * 初始化音乐管理器
     * @param {string} normalPath - 普通音乐路径
     * @param {string} fightPath - 战斗音乐路径
     */
    init(normalPath = 'music/normal.mp3', fightPath = 'music/fight.mp3') {
        if (this.initialized) return;

        // 创建音频元素（不使用Web Audio API以避免CORS问题）
        this.normalMusic = new Audio(normalPath);
        this.normalMusic.loop = true;
        this.normalMusic.volume = this.targetVolume;
        this.normalMusic.crossOrigin = 'anonymous';

        this.fightMusic = new Audio(fightPath);
        this.fightMusic.loop = true;
        this.fightMusic.volume = 0; // 初始静音
        this.fightMusic.crossOrigin = 'anonymous';

        // 不使用Web Audio API，直接使用HTML5 Audio API避免CORS问题
        this.audioContext = null;
        this.normalGainNode = null;
        this.fightGainNode = null;

        this.initialized = true;
        console.log('[MusicManager] Initialized (using HTML5 Audio API)');
    }

    /**
     * 开始播放音乐（从主菜单开始）
     */
    start() {
        if (!this.initialized) return;

        // 如果用户还没有交互，标记为待启动
        if (!this.userInteracted) {
            this.pendingStart = true;
            console.log('[MusicManager] Waiting for user interaction to start music');
            return;
        }

        this._doStart();
    }

    /**
     * 实际开始播放音乐
     */
    _doStart() {
        // 播放普通音乐
        this.normalMusic.play().then(() => {
            console.log('[MusicManager] Started playing normal music');
        }).catch(e => {
            console.warn('[MusicManager] Failed to play normal music:', e);
        });

        this.currentState = 'normal';
        this.pendingStart = false;
    }

    /**
     * 进入战斗状态
     */
    enterCombat() {
        if (!this.initialized) return;

        this.isInCombat = true;
        this.combatEndTime = 0;

        if (this.currentState !== 'fight') {
            this._transitionToFight();
        }
    }

    /**
     * 退出战斗状态
     */
    exitCombat() {
        if (!this.initialized) return;

        this.isInCombat = false;
        this.combatEndTime = Date.now() / 1000; // 记录战斗结束时间
    }

    /**
     * 更新音乐状态（每帧调用）
     * @param {number} dt - 时间增量（秒）
     * @param {boolean} isInGame - 是否在游戏中（非主菜单）
     */
    update(dt, isInGame = true) {
        if (!this.initialized) return;

        // 如果不在游戏中（主菜单），保持normal音乐
        if (!isInGame) {
            if (this.currentState !== 'normal') {
                this._transitionToNormal();
            }
            return;
        }

        // 检查是否需要从fight切换回normal
        if (!this.isInCombat && this.currentState === 'fight') {
            const currentTime = Date.now() / 1000;
            if (currentTime - this.combatEndTime >= this.combatCooldown) {
                this._transitionToNormal();
            }
        }
    }

    /**
     * 切换到战斗音乐（带淡入淡出）
     */
    _transitionToFight() {
        if (this.currentState === 'fight') return;

        console.log('[MusicManager] Transitioning to fight music');
        this.currentState = 'fight';

        // 确保fight音乐已加载并播放
        this.fightMusic.play().catch(e => {
            console.warn('[MusicManager] Failed to play fight music:', e);
        });

        // 使用简单的音量控制进行淡入淡出
        this._fadeVolume(this.normalMusic, this.targetVolume, 0, this.fadeDuration);
        this._fadeVolume(this.fightMusic, 0, this.targetVolume, this.fadeDuration);
    }

    /**
     * 切换到普通音乐（带淡入淡出）
     */
    _transitionToNormal() {
        if (this.currentState === 'normal') return;

        console.log('[MusicManager] Transitioning to normal music');
        this.currentState = 'normal';

        // 使用简单的音量控制进行淡入淡出
        this._fadeVolume(this.fightMusic, this.targetVolume, 0, this.fadeDuration);
        this._fadeVolume(this.normalMusic, 0, this.targetVolume, this.fadeDuration);
    }

    /**
     * 简单的音量淡入淡出
     */
    _fadeVolume(audioElement, fromVolume, toVolume, duration) {
        const startTime = Date.now();
        const volumeDiff = toVolume - fromVolume;

        // 清除之前的淡入淡出定时器
        if (audioElement._fadeInterval) {
            clearInterval(audioElement._fadeInterval);
        }

        audioElement._fadeInterval = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            const progress = Math.min(elapsed / duration, 1);

            audioElement.volume = fromVolume + volumeDiff * progress;

            if (progress >= 1) {
                clearInterval(audioElement._fadeInterval);
                audioElement._fadeInterval = null;
            }
        }, 50);
    }

    /**
     * 设置音量
     * @param {number} volume - 音量 0-1
     */
    setVolume(volume) {
        this.targetVolume = Math.max(0, Math.min(1, volume));

        if (!this.initialized) return;

        // 根据当前状态设置音量
        if (this.currentState === 'normal') {
            this.normalMusic.volume = this.targetVolume;
        } else {
            this.fightMusic.volume = this.targetVolume;
        }
    }

    /**
     * 暂停音乐
     */
    pause() {
        if (!this.initialized) return;

        this.normalMusic.pause();
        this.fightMusic.pause();
    }

    /**
     * 恢复音乐
     */
    resume() {
        if (!this.initialized) return;

        if (this.currentState === 'normal') {
            this.normalMusic.play().catch(() => {});
        } else {
            this.fightMusic.play().catch(() => {});
        }
    }

    /**
     * 停止音乐
     */
    stop() {
        if (!this.initialized) return;

        this.normalMusic.pause();
        this.normalMusic.currentTime = 0;
        this.fightMusic.pause();
        this.fightMusic.currentTime = 0;
    }

    /**
     * 获取当前音乐状态
     */
    getStatus() {
        return {
            currentState: this.currentState,
            isInCombat: this.isInCombat,
            volume: this.targetVolume,
            initialized: this.initialized,
            userInteracted: this.userInteracted,
            pendingStart: this.pendingStart
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MusicManager;
}
