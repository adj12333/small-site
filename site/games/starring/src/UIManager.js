/**
 * UIManager - 统一管理所有UI模块的初始化和渲染调度
 * 核心调度器，管理各模块生命周期和渲染顺序
 */
class UIManager {
    constructor(canvas) {
        this.canvas = canvas;
        // 使用 willReadFrequently: false 优化 getContext
        this.ctx = canvas.getContext('2d', {
            willReadFrequently: false,
            alpha: false // 不需要透明通道，提升性能
        });
        this.theme = new ThemeEngine();
        this.resourceManager = new ResourceManager('picture');
        this.input = new InputSystem(canvas);
        this.menuSystem = new MenuSystem(this.ctx, this.theme, this.input);
        this.hudSystem = new HUDSystem(this.ctx, this.theme);
        this.gameCore = null;

        this.gameState = 'MENU';
        this.lastTime = 0;
        this.running = false;
        this._resizeHandler = this._onResize.bind(this);
        window.addEventListener('resize', this._resizeHandler);

        // 预绑定循环引用（避免每帧创建新函数）
        this._boundLoop = () => this._loop();
        // Safari 帧率修复：Safari 节流 requestAnimationFrame 至 ~30fps
        // 使用 setInterval 作为额外调度器突破此限制
        this._isSafari = typeof navigator !== 'undefined' &&
            /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        this._safariTimer = null;
        this._currentSafariInterval = 0;
        this._loopGuard = false;

        // 画面设置（纯本地，不参与网络同步）
        this.settings = {
            antialiasing: true,
            particles: 'high', // 'off' | 'low' | 'medium' | 'high'
            showFPS: false,
            fancyEffects: false,
            music: true,
            frameRateLimit: 60,
            vSyncEnabled: false
        };

        // 粒子效果过渡动画
        this._particleTransition = {
            currentLevel: 3, // 0=off, 1=low, 2=medium, 3=high
            targetLevel: 3,
            transitionSpeed: 0.25
        };

        // ========== 分层渲染系统 ==========
        this.layers = {
            background: null,  // 背景层（星星、星云等）
            game: null,        // 游戏层（单位、建筑等）
            ui: null           // UI层（HUD、菜单等）
        };
        this.layerCtx = {};

        // ========== 渲染优化 ==========
        this.renderStats = {
            drawCalls: 0,
            lastDrawCalls: 0,
            frameCount: 0
        };
        this._batchRenderQueue = []; // 批量渲染队列
        this._dirtyLayers = new Set(); // 脏层标记 - 必须在 _initLayerSystem 之前初始化

        this._initLayerSystem();

        // 华丽特效开关过渡状态
        this._fancyEffectsTransition = {
            current: 0,   // 当前过渡值 0-1
            target: 0,    // 目标值
            duration: 0.5 // 过渡时间(秒)
        };

        // 设置面板状态
        this.settingsOpen = false;
        this._settingsJustOpened = false;
        this.pauseMenuOpen = false;
        this._pauseMenuHoverIndex = -1;
        this._wasPausedBeforeSettings = false;
        this.onReturnToMenu = null;

        this._fpsFrameCount = 0;
        this._fpsElapsed = 0;
        this._currentFPS = 0;

        this.animations = {
            basePulse: 0,
            zonePulse: 0
        };

        // ========== 渐变缓存系统（性能优化） ==========
        this._gradientCache = new Map();
        this._gradientCacheMaxSize = 500;

        // 预创建的渐变（避免每帧创建）
        this._hexGradient = null;
        this._logoTextGradient = null;
        this._logoScanGradient = null;
        this._panelBorderGradient = null;
        this._menuBgGradient = null;

        // 星星离屏缓存
        this._starsCanvas = null;

        this.consoleOpen = false;
        this.consoleInput = '';
        this.consoleHistory = [];
        this.consoleAnimProgress = 0;
        this.consoleCursorBlink = 0;
        this.consoleScanOffset = 0;

        // 太空背景系统数据
        this._initSpaceBackgroundData();

        // 加载动画相关属性
        this.isLoading = false;
        this.loadingStage = 0;
        this.loadingStages = [
            '初始化系统...',
            '加载资源...',
            '完成！'
        ];
        this.loadingProgress = 0;
        this.loadingStartTime = 0;
        this.loadingComplete = false;
        this.loadingFadeOut = 0;
        this._loadingStageTime = 0;

        // 粒子系统（用于华丽特效）
        this._initParticleSystem();
    }

    /**
     * 获取缓存的渐变，避免每帧重复创建
     * @param {string} key - 缓存键
     * @param {Function} factory - 渐变工厂函数
     * @returns {CanvasGradient}
     */
    _getCachedGradient(key, factory) {
        if (this._gradientCache.has(key)) {
            return this._gradientCache.get(key);
        }
        const gradient = factory();
        if (this._gradientCache.size >= this._gradientCacheMaxSize) {
            const firstKey = this._gradientCache.keys().next().value;
            this._gradientCache.delete(firstKey);
        }
        this._gradientCache.set(key, gradient);
        return gradient;
    }

    /**
     * 清除渐变缓存
     */
    _clearGradientCache() {
        this._gradientCache.clear();
    }

    /**
     * 初始化分层渲染系统
     */
    _initLayerSystem() {
        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.width || window.innerWidth || 1920;
        const h = this.canvas.height || window.innerHeight || 1080;

        // 创建离屏 Canvas 层
        for (const name of Object.keys(this.layers)) {
            const layer = document.createElement('canvas');
            layer.width = Math.max(1, w);
            layer.height = Math.max(1, h);
            this.layers[name] = layer;
            this.layerCtx[name] = layer.getContext('2d', {
                willReadFrequently: false,
                alpha: true
            });
        }

        // 标记所有层为脏
        this._markAllLayersDirty();
    }

    /**
     * 标记所有层为脏（需要重绘）
     */
    _markAllLayersDirty() {
        Object.keys(this.layers).forEach(name => this._dirtyLayers.add(name));
    }

    /**
     * 标记指定层为脏
     */
    _markLayerDirty(layerName) {
        this._dirtyLayers.add(layerName);
    }

    /**
     * 调整分层 Canvas 大小
     */
    _resizeLayers() {
        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.width;
        const h = this.canvas.height;

        for (const [name, layer] of Object.entries(this.layers)) {
            layer.width = w;
            layer.height = h;
        }

        this._markAllLayersDirty();
    }

    /**
     * 合并所有层到主 Canvas
     */
    _composeLayers() {
        const ctx = this.ctx;
        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.width / dpr;
        const h = this.canvas.height / dpr;

        // 清空主画布
        ctx.clearRect(0, 0, w, h);

        // 按顺序绘制各层
        const layerOrder = ['background', 'game', 'ui'];
        for (const name of layerOrder) {
            const layer = this.layers[name];
            if (layer) {
                ctx.drawImage(layer, 0, 0, w, h);
            }
        }
    }

    /**
     * 批量渲染队列执行
     */
    _executeBatchRender() {
        if (this._batchRenderQueue.length === 0) return;

        const ctx = this.ctx;
        ctx.save();

        // 按类型分组批量渲染
        const batches = new Map();
        for (const item of this._batchRenderQueue) {
            const key = `${item.type}_${item.color || 'default'}`;
            if (!batches.has(key)) {
                batches.set(key, []);
            }
            batches.get(key).push(item);
        }

        // 执行批量渲染
        for (const [key, items] of batches) {
            if (items.length === 0) continue;

            const first = items[0];
            ctx.fillStyle = first.color || '#ffffff';
            ctx.strokeStyle = first.color || '#ffffff';
            ctx.lineWidth = first.lineWidth || 1;

            ctx.beginPath();
            for (const item of items) {
                switch (item.shape) {
                    case 'rect':
                        ctx.rect(item.x, item.y, item.w, item.h);
                        break;
                    case 'arc':
                        ctx.moveTo(item.x + item.r, item.y);
                        ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
                        break;
                    case 'line':
                        ctx.moveTo(item.x1, item.y1);
                        ctx.lineTo(item.x2, item.y2);
                        break;
                }
            }

            if (first.type === 'fill') {
                ctx.fill();
            } else {
                ctx.stroke();
            }

            this.renderStats.drawCalls++;
        }

        ctx.restore();
        this._batchRenderQueue = [];
    }

    /**
     * 添加批量渲染项
     */
    _addBatchItem(item) {
        this._batchRenderQueue.push(item);
        // 当队列达到一定大小时自动执行
        if (this._batchRenderQueue.length >= 50) {
            this._executeBatchRender();
        }
    }

    /**
     * 获取渲染统计信息
     * @returns {Object}
     */
    getRenderStats() {
        return {
            drawCalls: this.renderStats.lastDrawCalls,
            dirtyLayers: this._dirtyLayers.size,
            batchQueueSize: this._batchRenderQueue.length
        };
    }

    /**
     * 初始化粒子系统
     */
    _initParticleSystem() {
        this.particles = [];
        this.maxParticles = 80;
        this.rippleEffects = [];
        this.explosionParticles = [];
        this.engineTrails = [];
        this.energyFieldParticles = [];
        this.collectionParticles = [];

        // 初始化基础粒子
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push(this._createBaseParticle());
        }
    }

    /**
     * 粒子类型常量
     */
    static PARTICLE_TYPES = {
        BASE: 'base',
        EXPLOSION: 'explosion',
        ENGINE: 'engine',
        ENERGY_FIELD: 'energyField',
        COLLECTION: 'collection'
    };

    /**
     * 创建基础粒子（浮动粒子）
     */
    _createBaseParticle() {
        return {
            type: 'base',
            x: Math.random(),
            y: Math.random(),
            vx: (Math.random() - 0.5) * 0.002,
            vy: (Math.random() - 0.5) * 0.002,
            size: Math.random() * 2 + 0.5,
            alpha: Math.random() * 0.5 + 0.2,
            pulsePhase: Math.random() * Math.PI * 2,
            color: Math.random() > 0.7 ? '#fbbf24' : '#0ea5e9',
            glow: Math.random() > 0.5
        };
    }

    /**
     * 创建爆炸粒子
     */
    createExplosionParticles(x, y, color = '#f97316', count = 15) {
        if (this.settings.particles === 'off' || this.settings.particles === 'low') return;

        const gameMap = this.gameCore ? this.gameCore.gameMap : null;
        if (!gameMap) return;

        const mapW = gameMap.width;
        const mapH = gameMap.height;

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const speed = 0.003 + Math.random() * 0.005;
            this.explosionParticles.push({
                type: 'explosion',
                x: x / mapW,
                y: y / mapH,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 4,
                alpha: 1,
                decay: 0.02 + Math.random() * 0.02,
                color: color,
                glow: true,
                trail: []
            });
        }
    }

    /**
     * 创建引擎尾焰粒子
     */
    createEngineTrail(x, y, angle, color = '#3b82f6') {
        if (this.settings.particles === 'off' || this.settings.particles === 'low') return;

        const gameMap = this.gameCore ? this.gameCore.gameMap : null;
        if (!gameMap) return;

        const mapW = gameMap.width;
        const mapH = gameMap.height;

        // 在飞船后方生成粒子
        const backAngle = angle + Math.PI;
        const offset = 0.01;

        this.engineTrails.push({
            type: 'engine',
            x: (x + Math.cos(backAngle) * 15) / mapW,
            y: (y + Math.sin(backAngle) * 15) / mapH,
            vx: Math.cos(backAngle) * 0.001 + (Math.random() - 0.5) * 0.001,
            vy: Math.sin(backAngle) * 0.001 + (Math.random() - 0.5) * 0.001,
            size: 3 + Math.random() * 3,
            alpha: 0.8,
            decay: 0.03 + Math.random() * 0.02,
            color: color,
            glow: true,
            shrink: true
        });
    }

    /**
     * 创建能量场粒子
     */
    createEnergyFieldParticles(x, y, radius, color = '#8b5cf6') {
        if (this.settings.particles !== 'high') return;

        const gameMap = this.gameCore ? this.gameCore.gameMap : null;
        if (!gameMap) return;

        const mapW = gameMap.width;
        const mapH = gameMap.height;

        // 在基地周围生成旋转的能量粒子
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * radius;

        this.energyFieldParticles.push({
            type: 'energyField',
            centerX: x / mapW,
            centerY: y / mapH,
            x: (x + Math.cos(angle) * r) / mapW,
            y: (y + Math.sin(angle) * r) / mapH,
            angle: angle,
            radius: r / Math.max(mapW, mapH),
            orbitSpeed: 0.001 + Math.random() * 0.002,
            size: 1.5 + Math.random() * 2,
            alpha: 0.4 + Math.random() * 0.4,
            pulsePhase: Math.random() * Math.PI * 2,
            color: color,
            glow: true
        });
    }

    /**
     * 创建收集粒子效果
     */
    createCollectionParticles(x, y, targetX, targetY, color = '#22c55e') {
        if (this.settings.particles !== 'high') return;

        const gameMap = this.gameCore ? this.gameCore.gameMap : null;
        if (!gameMap) return;

        const mapW = gameMap.width;
        const mapH = gameMap.height;

        for (let i = 0; i < 8; i++) {
            this.collectionParticles.push({
                type: 'collection',
                x: x / mapW,
                y: y / mapH,
                targetX: targetX / mapW,
                targetY: targetY / mapH,
                vx: (Math.random() - 0.5) * 0.002,
                vy: (Math.random() - 0.5) * 0.002,
                size: 2 + Math.random() * 2,
                alpha: 1,
                color: color,
                glow: true,
                life: 1,
                decay: 0.015 + Math.random() * 0.01
            });
        }
    }

    /**
     * 添加波纹效果
     */
    _addRipple(x, y, color = '#0ea5e9') {
        if (!this.settings.fancyEffects) return;
        this.rippleEffects.push({
            x, y, radius: 0, alpha: 1, color,
            maxRadius: 100 + Math.random() * 50
        });
    }

    /**
     * 更新粒子系统
     */
    _updateParticles(dt) {
        if (this.settings.particles === 'off' || (this.settings.particles === 'low' && !this.settings.fancyEffects)) return;

        const dtSec = dt / 1000;

        // 更新基础粒子
        this.particles.forEach(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.pulsePhase += dtSec * 2;

            // 边界处理
            if (p.x < 0 || p.x > 1) p.vx *= -1;
            if (p.y < 0 || p.y > 1) p.vy *= -1;
        });

        // 更新波纹
        this.rippleEffects = this.rippleEffects.filter(r => {
            r.radius += dtSec * 80;
            r.alpha = 1 - (r.radius / r.maxRadius);
            return r.alpha > 0;
        });

        // 更新爆炸粒子
        this.explosionParticles = this.explosionParticles.filter(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.alpha -= p.decay;

            // 记录拖尾
            if (p.trail) {
                p.trail.push({ x: p.x, y: p.y });
                if (p.trail.length > 5) p.trail.shift();
            }

            return p.alpha > 0;
        });

        // 更新引擎尾焰
        this.engineTrails = this.engineTrails.filter(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.alpha -= p.decay;
            if (p.shrink) {
                p.size *= 0.98;
            }
            return p.alpha > 0 && p.size > 0.5;
        });

        // 更新能量场粒子
        if (this.settings.particles === 'high') {
            this.energyFieldParticles.forEach(p => {
                p.angle += p.orbitSpeed * dt;
                p.x = p.centerX + Math.cos(p.angle) * p.radius;
                p.y = p.centerY + Math.sin(p.angle) * p.radius;
                p.pulsePhase += dtSec * 3;
            });

            // 限制能量场粒子数量
            if (this.energyFieldParticles.length > 50) {
                this.energyFieldParticles.splice(0, this.energyFieldParticles.length - 50);
            }
        }

        // 更新收集粒子
        this.collectionParticles = this.collectionParticles.filter(p => {
            // 向目标移动
            const dx = p.targetX - p.x;
            const dy = p.targetY - p.y;
            p.x += dx * 0.05 + p.vx * dt;
            p.y += dy * 0.05 + p.vy * dt;
            p.life -= p.decay;
            p.alpha = p.life;

            return p.life > 0;
        });
    }

    /**
     * 渲染粒子效果
     */
    _renderParticles(ctx, w, h) {
        if (this.settings.particles === 'off' || (this.settings.particles === 'low' && !this.settings.fancyEffects)) return;

        // 设置混合模式增强发光效果
        ctx.globalCompositeOperation = 'screen';

        // 渲染基础粒子
        this.particles.forEach(p => {
            const x = p.x * w;
            const y = p.y * h;
            const pulseAlpha = p.alpha * (0.7 + Math.sin(p.pulsePhase) * 0.3);

            // 发光效果
            if (p.glow && this.settings.particles !== 'low') {
                ctx.shadowBlur = p.size * 2;
                ctx.shadowColor = p.color;
            }

            ctx.fillStyle = p.color;
            ctx.globalAlpha = pulseAlpha;
            ctx.beginPath();
            ctx.arc(x, y, p.size, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
        });

        ctx.globalAlpha = 1;

        // 渲染爆炸粒子
        if (this.settings.particles !== 'low') {
            this.explosionParticles.forEach(p => {
                const x = p.x * w;
                const y = p.y * h;

                // 渲染拖尾
                if (p.trail && p.trail.length > 1) {
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = p.size * 0.5;
                    ctx.globalAlpha = p.alpha * 0.5;
                    ctx.beginPath();
                    ctx.moveTo(p.trail[0].x * w, p.trail[0].y * h);
                    for (let i = 1; i < p.trail.length; i++) {
                        ctx.lineTo(p.trail[i].x * w, p.trail[i].y * h);
                    }
                    ctx.lineTo(x, y);
                    ctx.stroke();
                }

                // 发光效果
                if (p.glow) {
                    ctx.shadowBlur = p.size * 3;
                    ctx.shadowColor = p.color;
                }

                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                ctx.arc(x, y, p.size, 0, Math.PI * 2);
                ctx.fill();

                ctx.shadowBlur = 0;
            });
        }

        // 渲染引擎尾焰
        if (this.settings.particles !== 'low') {
            this.engineTrails.forEach(p => {
                const x = p.x * w;
                const y = p.y * h;

                // 发光效果
                if (p.glow) {
                    ctx.shadowBlur = p.size * 2;
                    ctx.shadowColor = p.color;
                }

                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                ctx.arc(x, y, p.size, 0, Math.PI * 2);
                ctx.fill();

                ctx.shadowBlur = 0;
            });
        }

        // 渲染能量场粒子
        if (this.settings.particles === 'high') {
            this.energyFieldParticles.forEach(p => {
                const x = p.x * w;
                const y = p.y * h;
                const pulseAlpha = p.alpha * (0.7 + Math.sin(p.pulsePhase) * 0.3);

                // 发光效果
                if (p.glow) {
                    ctx.shadowBlur = p.size * 4;
                    ctx.shadowColor = p.color;
                }

                ctx.fillStyle = p.color;
                ctx.globalAlpha = pulseAlpha;
                ctx.beginPath();
                ctx.arc(x, y, p.size, 0, Math.PI * 2);
                ctx.fill();

                ctx.shadowBlur = 0;
            });
        }

        // 渲染收集粒子
        if (this.settings.particles === 'high') {
            this.collectionParticles.forEach(p => {
                const x = p.x * w;
                const y = p.y * h;

                // 发光效果
                if (p.glow) {
                    ctx.shadowBlur = p.size * 2;
                    ctx.shadowColor = p.color;
                }

                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                ctx.arc(x, y, p.size, 0, Math.PI * 2);
                ctx.fill();

                ctx.shadowBlur = 0;
            });
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        // 渲染波纹
        this.rippleEffects.forEach(r => {
            ctx.strokeStyle = r.color;
            ctx.globalAlpha = r.alpha * 0.5;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(r.x * w, r.y * h, r.radius, 0, Math.PI * 2);
            ctx.stroke();
        });

        ctx.globalAlpha = 1;
    }

    _initSpaceBackgroundData() {
        const seed = 12345;
        const rand = (i, m = 1) => {
            const v = Math.sin(i * 127.1 + seed * 311.7 + m * 437.58) * 43758.5453;
            return v - Math.floor(v);
        };

        // 星星数据：200颗，每颗有独立闪烁周期和相位
        this._stars = [];
        for (let i = 0; i < 200; i++) {
            this._stars.push({
                x: rand(i, 1),
                y: rand(i, 2),
                size: rand(i, 3) * 2 + 0.5, // 0.5 - 2.5px
                baseAlpha: rand(i, 4) * 0.5 + 0.3,
                twinkleSpeed: rand(i, 5) * 2 + 1, // 闪烁速度
                twinklePhase: rand(i, 6) * Math.PI * 2
            });
        }

        // 星尘微粒：50个
        this._dustParticles = [];
        for (let i = 0; i < 50; i++) {
            this._dustParticles.push({
                x: rand(i + 200, 1),
                y: rand(i + 200, 2),
                size: rand(i + 200, 3) * 0.5 + 0.5, // 0.5 - 1px
                alpha: rand(i + 200, 4) * 0.2 + 0.2, // 0.2 - 0.4
                driftX: (rand(i + 200, 5) - 0.5) * 0.02,
                driftY: (rand(i + 200, 6) - 0.5) * 0.02,
                driftPhase: rand(i + 200, 7) * Math.PI * 2
            });
        }

        // 彩色星云团：3个大型径向渐变团
        this._nebulaClouds = [];
        const nebulaColors = [
            { inner: 'rgba(139, 92, 246, ', outer: 'rgba(59, 130, 246, ' }, // 紫->蓝
            { inner: 'rgba(6, 182, 212, ', outer: 'rgba(59, 130, 246, ' }, // 青->蓝
            { inner: 'rgba(168, 85, 247, ', outer: 'rgba(139, 92, 246, ' }  // 紫->紫
        ];
        for (let i = 0; i < 3; i++) {
            this._nebulaClouds.push({
                x: rand(i + 300, 1),
                y: rand(i + 300, 2),
                radius: rand(i + 300, 3) * 200 + 300, // 300-500px
                alpha: rand(i + 300, 4) * 0.05 + 0.05, // 0.05 - 0.1
                colors: nebulaColors[i],
                parallaxSpeed: 0.05 + i * 0.02
            });
        }

        // 3层视差星云缓存
        this._nebulaLayers = [
            { speed: 0.1, color: 'rgba(30, 58, 138, ', alpha: 0.15, blobs: 8, blobRadius: 250 },
            { speed: 0.3, color: 'rgba(88, 28, 135, ', alpha: 0.12, blobs: 6, blobRadius: 200 },
            { speed: 0.6, color: 'rgba(8, 145, 178, ', alpha: 0.1, blobs: 5, blobRadius: 180 }
        ];
        this._nebulaCanvases = [null, null, null];
        this._nebulaCanvasSize = { w: 0, h: 0 };
        this._nebulaCloudCanvas = null;
        this._nebulaCloudCanvasSize = { w: 0, h: 0 };
    }

    _ensureNebulaCanvases(w, h) {
        const buffer = 400;
        const cw = w + buffer * 2;
        const ch = h + buffer * 2;

        if (this._nebulaCanvases[0] && this._nebulaCanvasSize.w === cw && this._nebulaCanvasSize.h === ch) {
            return;
        }

        this._nebulaCanvasSize = { w: cw, h: ch };
        const seed = 12345;
        const rand = (i, m = 1) => {
            const v = Math.sin(i * 127.1 + seed * 311.7 + m * 437.58) * 43758.5453;
            return v - Math.floor(v);
        };

        for (let layerIdx = 0; layerIdx < 3; layerIdx++) {
            const layer = this._nebulaLayers[layerIdx];
            const canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            const ctx = canvas.getContext('2d');

            for (let b = 0; b < layer.blobs; b++) {
                const bx = rand(layerIdx * 10 + b, 1) * cw;
                const by = rand(layerIdx * 10 + b, 2) * ch;
                const r = layer.blobRadius + rand(layerIdx * 10 + b, 3) * 100;

                const gradient = ctx.createRadialGradient(bx, by, 0, bx, by, r);
                gradient.addColorStop(0, layer.color + layer.alpha + ')');
                gradient.addColorStop(0.5, layer.color + (layer.alpha * 0.5) + ')');
                gradient.addColorStop(1, layer.color + '0)');

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(bx, by, r, 0, Math.PI * 2);
                ctx.fill();
            }

            this._nebulaCanvases[layerIdx] = canvas;
        }
    }

    setGameCore(gameCore) {
        this.gameCore = gameCore;
        // 将 gameCore 传递给 HUDSystem
        if (this.hudSystem) {
            this.hudSystem.setGameCore(gameCore);
        }
    }

    async init() {
        this._setupCanvas();
        this.menuSystem.init();
        this.hudSystem.init(this.input);
        // 设备模式缩放：读取 window.deviceMode（此时可能尚未选择，默认为 desktop）
        const mode = window.deviceMode || 'desktop';
        if (mode === 'phone') this.hudSystem.setDeviceScale(1.5);
        else if (mode === 'tablet') this.hudSystem.setDeviceScale(1.2);
        else this.hudSystem.setDeviceScale(1.0);
        this._bindEvents();
        this._onResize();
    }

    _setupCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';

        // 设置抗锯齿
        this._applyAntialiasing();
    }

    _applyAntialiasing() {
        if (this.settings.antialiasing) {
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
        } else {
            this.ctx.imageSmoothingEnabled = false;
        }
    }

    _onResize() {
        const dpr = window.devicePixelRatio || 1;
        const parent = this.canvas.parentElement;
        const w = parent ? parent.clientWidth : window.innerWidth;
        const h = parent ? parent.clientHeight : window.innerHeight;

        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this._applyAntialiasing();
        this.menuSystem.resize(w, h);
        this.hudSystem.resize(w, h);

        // 调整分层 Canvas 大小
        this._resizeLayers();

        // 重置窗口大小相关的缓存
        this._menuBgGradient = null;
        this._starsCanvas = null;
        this._cachedSpaceBg = null;
        this._cachedSpaceBgKey = null;

        if (this.gameCore) {
            this.gameCore.canvasWidth = w;
            this.gameCore.canvasHeight = h;
        }
    }

    _bindEvents() {
        this.menuSystem.onStartGame = () => {
            this._startGameWithLoading();
        };
        this.menuSystem.onSettings = () => {
            this._toggleSettings();
        };
        this.menuSystem.onQuit = () => {
            window.close();
        };

        this.input.on('mouseMove', (data) => {
            if (!this.pauseMenuOpen) return;
            this._onPauseMenuMouseMove(data);
        });
        this.input.on('mouseClick', (data) => {
            if (!this.pauseMenuOpen) return;
            if (data.wasDragging) return;
            this._handlePauseMenuClick(data);
        });

        // 设置面板点击事件
        this.input.on('mouseClick', (data) => {
            if (data.wasDragging) return;
            if (this._settingsJustOpened) {
                this._settingsJustOpened = false;
                return;
            }
            if (this.settingsOpen) {
                this._handleSettingsClick(data.x, data.y);
            }
        });

        // 添加滚轮缩放事件
        this.canvas.addEventListener('wheel', (e) => {
            if (this.gameState !== 'PLAYING' || !this.gameCore) return;
            e.preventDefault();
            // 等待区大小调整模式：滚轮调整巡逻半径
            if (window.commandMode === 'waiting_area') {
                const delta = e.deltaY;
                const currentRadius = window.waitingAreaRadius || 25;
                window.waitingAreaRadius = Math.max(10, Math.min(75, currentRadius + delta * 0.1));
                return;
            }
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            this.gameCore.zoomBy(-e.deltaY, mouseX, mouseY);
        }, { passive: false });
    }

    _startGameWithLoading() {
        // 启动加载动画
        this.isLoading = true;
        this.loadingStage = 0;
        this.loadingProgress = 0;
        this.loadingStartTime = performance.now();
        this.loadingComplete = false;
        this.loadingFadeOut = 0;
        this._loadingStageTime = 0;
        this._gameContentLoaded = false;

        // 禁用菜单输入，防止加载期间点击穿透
        if (this.menuSystem) {
            this.menuSystem.inputDisabled = true;
        }

        // 在后台异步加载游戏内容
        this._loadGameContentInBackground();
    }

    /**
     * 后台加载游戏内容
     */
    async _loadGameContentInBackground() {
        // 重置游戏核心
        if (this.gameCore && this.gameCore.gameOver) {
            this.gameCore.reset();
        }

        // 模拟游戏内容加载（实际项目中这里可以是资源加载、地图生成等）
        // 使用 Promise 让加载过程异步进行
        await new Promise(resolve => {
            // 在加载动画的第3-4阶段之间完成内容加载
            const checkLoadComplete = () => {
                if (this.loadingStage >= 3) {
                    resolve();
                } else if (this.isLoading) {
                    setTimeout(checkLoadComplete, 50);
                }
            };
            checkLoadComplete();
        });

        this._gameContentLoaded = true;
    }

    updateLoadingAnimation(dt) {
        if (!this.isLoading) return;

        const dtSec = dt / 1000;

        if (this.loadingComplete) {
            // 使用 ease-out 缓动函数使淡出更平滑
            this.loadingFadeOut += dtSec * 1.2;

            // 在淡出开始时（fadeOut > 0）就切换到游戏状态，让游戏在动画下方渲染
            if (this.loadingFadeOut > 0 && this.gameState !== 'PLAYING') {
                this.setGameState('PLAYING');
            }

            if (this.loadingFadeOut >= 1) {
                this.loadingFadeOut = 1;
                this.isLoading = false;
                // 调用加载完成回调（如果存在）
                if (this.onLoadingComplete) {
                    this.onLoadingComplete();
                }
            }
            return;
        }

        this._loadingStageTime += dtSec;

        // 阶段持续时间，最后一个阶段停留更久
        const stageDuration = this.loadingStage === this.loadingStages.length - 2 ? 0.5 : 0.35;

        // 计算进度（使用线性插值，避免缓动函数造成的回弹）
        const totalStages = this.loadingStages.length;
        const progressPerStage = 100 / totalStages;
        const stageProgress = Math.min(1, this._loadingStageTime / stageDuration);

        // 计算目标进度
        const targetProgress = this.loadingStage * progressPerStage + stageProgress * progressPerStage;
        // 确保进度只增不减，防止回弹
        this.loadingProgress = Math.max(this.loadingProgress, Math.min(100, targetProgress));

        if (this._loadingStageTime >= stageDuration) {
            this._loadingStageTime = 0;
            this.loadingStage++;

            if (this.loadingStage >= this.loadingStages.length - 1) {
                this.loadingStage = this.loadingStages.length - 1;
                this.loadingProgress = 100;
                // 立即标记加载完成，进入淡出
                this.completeLoadingAnimation();
            }
        }
    }

    renderLoadingAnimation() {
        if (!this.isLoading) return;

        const ctx = this.ctx;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);

        ctx.save();

        const alpha = 1 - this.loadingFadeOut;
        ctx.globalAlpha = alpha;

        // 背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
        ctx.fillRect(0, 0, w, h);

        // 华丽特效：粒子效果
        if (this.settings.fancyEffects) {
            this._renderParticles(ctx, w, h);
        }

        const centerX = w / 2;
        const centerY = h / 2;

        // 扫描线效果（纯色替代渐变）
        const scanLineY = (performance.now() / 20) % h;
        ctx.fillStyle = 'rgba(14, 165, 233, 0.04)';
        ctx.fillRect(0, scanLineY - 50, w, 100);

        // 华丽特效：能量波纹
        if (this.settings.fancyEffects) {
            const time = performance.now() / 1000;
            for (let i = 0; i < 3; i++) {
                const rippleRadius = ((time * 50 + i * 40) % 200);
                const rippleAlpha = 1 - (rippleRadius / 200);
                ctx.strokeStyle = `rgba(14, 165, 233, ${rippleAlpha * 0.3})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(centerX, centerY, rippleRadius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        const showLogo = this.loadingStage >= 1 && this.loadingStage <= 4;
        const logoY = centerY - 80;

        if (showLogo) {
            // ===== 天穹 Logo 赛博朋克未来科技风格 =====
            const time = performance.now() / 1000;
            const logoRadius = 75;

            // 核心配色 - 电光蓝紫渐变
            const coreColors = {
                cyan: '#00f5ff',
                magenta: '#ff00ff',
                electric: '#7b2dff',
                deepBlue: '#0a0e27',
                glowCyan: 'rgba(0, 245, 255, 0.8)',
                glowMagenta: 'rgba(255, 0, 255, 0.6)'
            };

            // 外层六边形框架 - 缓慢旋转
            ctx.save();
            ctx.translate(centerX, logoY);
            ctx.rotate(time * 0.15);

            const hexRadius = logoRadius + 25;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
                const x = Math.cos(angle) * hexRadius;
                const y = Math.sin(angle) * hexRadius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();

            // 六边形霓虹描边
            ctx.strokeStyle = coreColors.cyan;
            ctx.lineWidth = 2;
            ctx.shadowColor = coreColors.cyan;
            ctx.shadowBlur = 15;
            ctx.stroke();

            // 六边形内部填充 - 微弱渐变（预创建）
            if (!this._hexGradient) {
                this._hexGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 100);
                this._hexGradient.addColorStop(0, 'rgba(0, 245, 255, 0.05)');
                this._hexGradient.addColorStop(0.5, 'rgba(123, 45, 255, 0.03)');
                this._hexGradient.addColorStop(1, 'rgba(0, 245, 255, 0.08)');
            }
            ctx.fillStyle = this._hexGradient;
            ctx.fill();

            ctx.restore();

            // 中层三角环 - 反向快速旋转
            ctx.save();
            ctx.translate(centerX, logoY);
            ctx.rotate(-time * 0.4);

            const triRadius = logoRadius + 10;
            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2;
                const x = Math.cos(angle) * triRadius;
                const y = Math.sin(angle) * triRadius;

                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = coreColors.magenta;
                ctx.shadowColor = coreColors.magenta;
                ctx.shadowBlur = 10;
                ctx.fill();

                // 连接线
                const nextAngle = ((i + 1) / 3) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(Math.cos(nextAngle) * triRadius, Math.sin(nextAngle) * triRadius);
                ctx.strokeStyle = 'rgba(255, 0, 255, 0.4)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            ctx.restore();

            // 内层核心圆环 - 脉冲呼吸效果
            const breathe = 1 + Math.sin(time * 2) * 0.08;
            ctx.save();
            ctx.translate(centerX, logoY);
            ctx.scale(breathe, breathe);

            // 主圆环
            ctx.beginPath();
            ctx.arc(0, 0, logoRadius * 0.6, 0, Math.PI * 2);
            ctx.strokeStyle = coreColors.electric;
            ctx.lineWidth = 3;
            ctx.shadowColor = coreColors.electric;
            ctx.shadowBlur = 20;
            ctx.stroke();

            // 内圆环虚线
            ctx.beginPath();
            ctx.arc(0, 0, logoRadius * 0.45, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 245, 255, 0.6)';
            ctx.lineWidth = 1;
            ctx.setLineDash([8, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.restore();

            // 四角能量标记 - 动态闪烁
            const cornerDist = logoRadius + 35;
            const cornerSize = 18;
            const flicker = Math.sin(time * 8) * 0.3 + 0.7;

            ctx.shadowBlur = 12 * flicker;
            ctx.lineWidth = 2;

            const corners = [
                { x: -1, y: -1 },
                { x: 1, y: -1 },
                { x: -1, y: 1 },
                { x: 1, y: 1 }
            ];

            corners.forEach((corner, idx) => {
                const cx = centerX + corner.x * cornerDist;
                const cy = logoY + corner.y * cornerDist;
                const offset = idx * Math.PI / 2;
                const phase = Math.sin(time * 3 + offset) * 0.5 + 0.5;

                ctx.strokeStyle = `rgba(0, 245, 255, ${0.4 + phase * 0.6})`;
                ctx.shadowColor = coreColors.cyan;

                // L型角标
                ctx.beginPath();
                if (corner.x < 0) {
                    ctx.moveTo(cx - cornerSize, cy + cornerSize * corner.y * 0.3);
                    ctx.lineTo(cx - cornerSize, cy);
                    ctx.lineTo(cx - cornerSize * 0.3, cy);
                } else {
                    ctx.moveTo(cx + cornerSize, cy + cornerSize * corner.y * 0.3);
                    ctx.lineTo(cx + cornerSize, cy);
                    ctx.lineTo(cx + cornerSize * 0.3, cy);
                }
                ctx.stroke();

                // 小圆点
                ctx.fillStyle = `rgba(255, 0, 255, ${0.6 + phase * 0.4})`;
                ctx.shadowColor = coreColors.magenta;
                ctx.beginPath();
                ctx.arc(cx + corner.x * cornerSize * 0.5, cy + corner.y * cornerSize * 0.5, 2, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.shadowBlur = 0;

            // "天穹"文字 - 立体霓虹效果
            const textGlow = 25 + Math.sin(time * 2.5) * 8;

            // 文字外发光层
            ctx.shadowColor = coreColors.cyan;
            ctx.shadowBlur = textGlow;

            // 文字渐变（预创建）
            if (!this._logoTextGradient) {
                this._logoTextGradient = ctx.createLinearGradient(-50, -25, 50, 25);
                this._logoTextGradient.addColorStop(0, '#00f5ff');
                this._logoTextGradient.addColorStop(0.5, '#ffffff');
                this._logoTextGradient.addColorStop(1, '#ff00ff');
            }

            ctx.fillStyle = this._logoTextGradient;
            ctx.font = 'bold 44px "Microsoft YaHei", "SimHei", sans-serif';
            ctx.textBaseline = 'middle';

            // "天"字
            ctx.textAlign = 'right';
            ctx.fillText('天', centerX - 4, logoY);

            // "穹"字
            ctx.textAlign = 'left';
            ctx.fillText('穹', centerX + 4, logoY);

            ctx.shadowBlur = 0;

            // 底部能量扫描线
            const scanY = logoY + 42;
            const scanWidth = 100;
            const scanProgress = (time * 0.5) % 1;

            // 扫描线渐变（预创建）
            if (!this._logoScanGradient) {
                this._logoScanGradient = ctx.createLinearGradient(-scanWidth/2, 0, scanWidth/2, 0);
                this._logoScanGradient.addColorStop(0, 'transparent');
                this._logoScanGradient.addColorStop(0.3, 'rgba(0, 245, 255, 0.3)');
                this._logoScanGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
                this._logoScanGradient.addColorStop(0.7, 'rgba(255, 0, 255, 0.3)');
                this._logoScanGradient.addColorStop(1, 'transparent');
            }

            ctx.strokeStyle = this._logoScanGradient;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(centerX - scanWidth/2, scanY);
            ctx.lineTo(centerX + scanWidth/2, scanY);
            ctx.stroke();

            // 扫描点
            const scanX = centerX - scanWidth/2 + scanWidth * scanProgress;
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = coreColors.cyan;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(scanX, scanY, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // 英文副标题 - 科技感字体
            ctx.fillStyle = 'rgba(0, 245, 255, 0.7)';
            ctx.font = '10px "Consolas", "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.letterSpacing = '3px';

            // 字符逐个闪烁效果
            const subtitle = 'SKY·DOME·COMMAND';
            let displayText = '';
            for (let i = 0; i < subtitle.length; i++) {
                const charPhase = Math.sin(time * 4 + i * 0.5) * 0.5 + 0.5;
                displayText += charPhase > 0.3 ? subtitle[i] : '·';
            }
            ctx.fillText(displayText, centerX, logoY + 58);

            // 中心核心点 - 多层脉冲
            const corePulse1 = 4 + Math.sin(time * 3) * 2;
            const corePulse2 = 8 + Math.sin(time * 3 + Math.PI) * 3;

            // 外层脉冲
            ctx.fillStyle = 'rgba(0, 245, 255, 0.2)';
            ctx.beginPath();
            ctx.arc(centerX, logoY, corePulse2, 0, Math.PI * 2);
            ctx.fill();

            // 内层核心
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = coreColors.cyan;
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(centerX, logoY, corePulse1 * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // 数据流装饰线 - 两侧
            const dataLineY = logoY - 20;
            const dataLineLength = 40;
            const dataOffset = (time * 20) % 15;

            ctx.strokeStyle = 'rgba(0, 245, 255, 0.3)';
            ctx.lineWidth = 1;

            // 左侧数据流
            ctx.beginPath();
            ctx.moveTo(centerX - logoRadius - 50, dataLineY);
            ctx.lineTo(centerX - logoRadius - 10, dataLineY);
            ctx.stroke();

            // 右侧数据流
            ctx.beginPath();
            ctx.moveTo(centerX + logoRadius + 10, dataLineY);
            ctx.lineTo(centerX + logoRadius + 50, dataLineY);
            ctx.stroke();

            // 流动的小方块
            ctx.fillStyle = 'rgba(0, 245, 255, 0.8)';
            for (let i = 0; i < 3; i++) {
                const offset = (dataOffset + i * 5) % 40;
                // 左侧
                ctx.fillRect(centerX - logoRadius - 10 - offset, dataLineY - 2, 3, 4);
                // 右侧
                ctx.fillRect(centerX + logoRadius + 10 + offset - 3, dataLineY - 2, 3, 4);
            }
        }

        const barY = centerY + 70;
        const barWidth = 300;
        const barHeight = 4;
        const barX = centerX - barWidth / 2;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const progressWidth = barWidth * (this.loadingProgress / 100);
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(barX, barY, progressWidth, barHeight);

        ctx.strokeStyle = 'rgba(14, 165, 233, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '12px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.floor(this.loadingProgress)}%`, centerX, barY + 20);

        for (let i = 0; i < 3; i++) {
            const dotX = centerX - 20 + i * 20;
            const dotY = barY + 45;
            const dotAlpha = (Math.sin(performance.now() / 200 + i * 1.5) + 1) / 2 * 0.5 + 0.3;
            ctx.fillStyle = `rgba(14, 165, 233, ${dotAlpha})`;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.restore();
    }

    completeLoadingAnimation() {
        this.loadingComplete = true;
        this.loadingStage = this.loadingStages.length - 1;
        this.loadingProgress = 100;
    }

    startLoadingAnimation() {
        this.isLoading = true;
        this.loadingStage = 0;
        this.loadingProgress = 0;
        this.loadingStartTime = performance.now();
        this.loadingComplete = false;
        this.loadingFadeOut = 0;
        this._loadingStageTime = 0;
    }

    _onPauseMenuMouseMove(data) {
        this._pauseMenuHoverIndex = -1;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);
        const panelW = 280;
        const panelH = 320;
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;
        const btnW = 220;
        const btnH = 52;
        const btnX = (w - btnW) / 2;
        const startY = panelY + 80;
        const gap = 64;

        const buttons = [
            { y: startY },
            { y: startY + gap },
            { y: startY + gap * 2 }
        ];

        for (let i = 0; i < buttons.length; i++) {
            const btn = buttons[i];
            if (data.x >= btnX && data.x <= btnX + btnW &&
                data.y >= btn.y && data.y <= btn.y + btnH) {
                this._pauseMenuHoverIndex = i;
                break;
            }
        }
    }

    _handlePauseMenuClick(data) {
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);
        const panelW = 280;
        const panelH = 320;
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;
        const btnW = 220;
        const btnH = 52;
        const btnX = (w - btnW) / 2;
        const startY = panelY + 80;
        const gap = 64;

        const buttons = [
            { y: startY, action: 'resume' },
            { y: startY + gap, action: 'settings' },
            { y: startY + gap * 2, action: 'mainmenu' }
        ];

        for (const btn of buttons) {
            if (data.x >= btnX && data.x <= btnX + btnW &&
                data.y >= btn.y && data.y <= btn.y + btnH) {
                if (btn.action === 'resume') {
                    this.pauseMenuOpen = false;
                    this._pauseMenuHoverIndex = -1;
                } else if (btn.action === 'settings') {
                    this._wasPausedBeforeSettings = true;
                    this.pauseMenuOpen = false;
                    this._pauseMenuHoverIndex = -1;
                    this._toggleSettings();
                } else if (btn.action === 'mainmenu') {
                    this.pauseMenuOpen = false;
                    this._pauseMenuHoverIndex = -1;
                    if (this.onReturnToMenu) {
                        this.onReturnToMenu();
                    } else {
                        if (this.gameCore) {
                            this.gameCore.reset();
                        }
                        this.setGameState('MENU');
                    }
                }
                break;
            }
        }
    }

    _renderDisconnectNotice(countdown) {
        const ctx = this.ctx;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const colors = this.theme.colors;

        const barH = 48;
        const barW = 520;
        const barX = (w - barW) / 2;

        ctx.fillStyle = 'rgba(185, 28, 28, 0.92)';
        ctx.fillRect(barX, 0, barW, barH);

        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, 0, barW, barH);

        const warningPulse = Math.sin(performance.now() / 300) * 0.3 + 0.7;
        ctx.fillStyle = '#fef2f2';
        ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = warningPulse;
        ctx.fillText('⚠ 对方已断开与服务器的连接', w / 2, barH / 2 - 2);
        ctx.globalAlpha = 1;

        if (countdown !== undefined && countdown > 0) {
            ctx.fillStyle = '#fecaca';
            ctx.font = '13px "Segoe UI", Arial, sans-serif';
            ctx.fillText(`判负倒计时: ${countdown}s`, w / 2, barH / 2 + 16);
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    _renderPauseMenu() {
        const ctx = this.ctx;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);
        const colors = this.theme.colors;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(0, 0, w, h);

        const panelW = 280;
        const panelH = 320;
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
        ctx.fillRect(panelX, panelY, panelW, panelH);

        if (!this._panelBorderGradient) {
            this._panelBorderGradient = ctx.createLinearGradient(0, 0, 280, 0);
            this._panelBorderGradient.addColorStop(0, 'rgba(14, 165, 233, 0.6)');
            this._panelBorderGradient.addColorStop(0.5, 'rgba(14, 165, 233, 0.2)');
            this._panelBorderGradient.addColorStop(1, 'rgba(14, 165, 233, 0.6)');
        }
        ctx.strokeStyle = this._panelBorderGradient;
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        ctx.strokeStyle = 'rgba(14, 165, 233, 0.1)';
        ctx.lineWidth = 6;
        ctx.strokeRect(panelX - 3, panelY - 3, panelW + 6, panelH + 6);

        ctx.fillStyle = colors.text;
        ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('游戏暂停', w / 2, panelY + 42);

        ctx.strokeStyle = 'rgba(14, 165, 233, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(panelX + 30, panelY + 64);
        ctx.lineTo(panelX + panelW - 30, panelY + 64);
        ctx.stroke();

        const btnW = 220;
        const btnH = 52;
        const btnX = (w - btnW) / 2;
        const startY = panelY + 80;
        const gap = 64;

        const buttonDefs = [
            {
                label: '回到游戏',
                icon: (cx, cy, s) => {
                    ctx.fillStyle = '#22c55e';
                    ctx.beginPath();
                    ctx.moveTo(cx - s * 0.3, cy - s * 0.5);
                    ctx.lineTo(cx + s * 0.5, cy);
                    ctx.lineTo(cx - s * 0.3, cy + s * 0.5);
                    ctx.closePath();
                    ctx.fill();
                }
            },
            {
                label: '游戏设置',
                icon: (cx, cy, s) => {
                    ctx.strokeStyle = '#fbbf24';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(cx, cy, s * 0.4, 0, Math.PI * 2);
                    ctx.stroke();
                    for (let i = 0; i < 6; i++) {
                        const angle = (i / 6) * Math.PI * 2;
                        ctx.beginPath();
                        ctx.moveTo(cx + Math.cos(angle) * s * 0.4, cy + Math.sin(angle) * s * 0.4);
                        ctx.lineTo(cx + Math.cos(angle) * s * 0.6, cy + Math.sin(angle) * s * 0.6);
                        ctx.stroke();
                    }
                    ctx.fillStyle = '#fbbf24';
                    ctx.beginPath();
                    ctx.arc(cx, cy, s * 0.15, 0, Math.PI * 2);
                    ctx.fill();
                }
            },
            {
                label: '返回主界面',
                icon: (cx, cy, s) => {
                    ctx.fillStyle = '#94a3b8';
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - s * 0.5);
                    ctx.lineTo(cx + s * 0.45, cy);
                    ctx.lineTo(cx + s * 0.15, cy);
                    ctx.lineTo(cx + s * 0.15, cy + s * 0.5);
                    ctx.lineTo(cx - s * 0.15, cy + s * 0.5);
                    ctx.lineTo(cx - s * 0.15, cy);
                    ctx.lineTo(cx - s * 0.45, cy);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        ];

        for (let i = 0; i < buttonDefs.length; i++) {
            const btn = buttonDefs[i];
            const by = startY + i * gap;
            const isHover = i === this._pauseMenuHoverIndex;

            const r = 8;
            ctx.beginPath();
            ctx.moveTo(btnX + r, by);
            ctx.lineTo(btnX + btnW - r, by);
            ctx.quadraticCurveTo(btnX + btnW, by, btnX + btnW, by + r);
            ctx.lineTo(btnX + btnW, by + btnH - r);
            ctx.quadraticCurveTo(btnX + btnW, by + btnH, btnX + btnW - r, by + btnH);
            ctx.lineTo(btnX + r, by + btnH);
            ctx.quadraticCurveTo(btnX, by + btnH, btnX, by + btnH - r);
            ctx.lineTo(btnX, by + r);
            ctx.quadraticCurveTo(btnX, by, btnX + r, by);
            ctx.closePath();

            ctx.fillStyle = isHover ? 'rgba(14, 165, 233, 0.15)' : 'rgba(15, 23, 42, 0.8)';
            ctx.fill();

            if (isHover) {
                ctx.strokeStyle = '#0ea5e9';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.strokeStyle = 'rgba(14, 165, 233, 0.3)';
                ctx.lineWidth = 4;
                ctx.stroke();
            } else {
                ctx.strokeStyle = 'rgba(14, 165, 233, 0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            const iconCx = btnX + 36;
            const iconCy = by + btnH / 2;
            const iconSize = 18;
            btn.icon(iconCx, iconCy, iconSize);

            ctx.fillStyle = isHover ? '#0ea5e9' : colors.text;
            ctx.font = '16px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(btn.label, btnX + 62, by + btnH / 2);
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    _toggleSettings() {
        this.settingsOpen = !this.settingsOpen;
        this.menuSystem.inputDisabled = this.settingsOpen;
        if (this.settingsOpen && this.hudSystem) {
            this.hudSystem._showBattleReport = false;
            this.hudSystem._battleReportTarget = 0;
        }
        if (this.settingsOpen) {
            this._settingsJustOpened = true;
        }
        if (!this.settingsOpen && this._wasPausedBeforeSettings) {
            this.pauseMenuOpen = true;
            this._wasPausedBeforeSettings = false;
        }
        console.log('[UIManager] 设置面板:', this.settingsOpen ? '打开' : '关闭');
    }

    _renderSettingsPanel() {
        const ctx = this.ctx;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);
        const colors = this.theme.colors;

        // 半透明背景遮罩
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, w, h);

        // 面板区域
        const panelW = 400;
        const panelH = 480;
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        // 面板背景
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        // 标题
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('游戏设置', w / 2, panelY + 40);

        // 抗锯齿开关
        const aaY = panelY + 90;
        ctx.fillStyle = colors.text;
        ctx.font = this.theme.fonts.menu;
        ctx.textAlign = 'left';
        ctx.fillText('抗锯齿', panelX + 40, aaY);

        // 开关按钮
        const toggleX = panelX + panelW - 90;
        const toggleW = 50;
        const toggleH = 26;
        ctx.fillStyle = this.settings.antialiasing ? colors.success : colors.border;
        ctx.fillRect(toggleX, aaY - 20, toggleW, toggleH);
        ctx.fillStyle = '#ffffff';
        if (this.settings.antialiasing) {
            ctx.fillRect(toggleX + toggleW - 22, aaY - 17, 16, 20);
        } else {
            ctx.fillRect(toggleX + 6, aaY - 17, 16, 20);
        }

        // 粒子效果等级选择
        const particleY = panelY + 140;
        ctx.fillStyle = colors.text;
        ctx.fillText('粒子效果', panelX + 40, particleY);

        // 更新过渡动画
        const levelMap = { off: 0, low: 1, medium: 2, high: 3 };
        this._particleTransition.targetLevel = levelMap[this.settings.particles] || 3;
        const diff = this._particleTransition.targetLevel - this._particleTransition.currentLevel;
        if (Math.abs(diff) > 0.01) {
            this._particleTransition.currentLevel += diff * this._particleTransition.transitionSpeed;
        } else {
            this._particleTransition.currentLevel = this._particleTransition.targetLevel;
        }

        // 绘制下拉选择框（添加'关'选项）
        const particleOptions = ['off', 'low', 'medium', 'high'];
        const particleLabels = { off: '关', low: '低', medium: '中', high: '高' };
        const particleColors = { off: colors.text, low: colors.warning, medium: colors.primary, high: colors.success };
        const optionWidth = 44;
        const optionSpacing = 6;
        const optionsStartX = panelX + panelW - 40 - (particleOptions.length * optionWidth + (particleOptions.length - 1) * optionSpacing);

        particleOptions.forEach((opt, i) => {
            const optX = optionsStartX + i * (optionWidth + optionSpacing);
            const isSelected = this.settings.particles === opt;
            const optLevel = levelMap[opt];
            const currentLevel = this._particleTransition.currentLevel;
            
            // 计算过渡状态（0-1）
            // 当 currentLevel 接近 optLevel 时，transitionState 接近 1
            // 使用最大级别距离进行归一化，确保任何级别切换都有动画
            const maxLevelDistance = 3; // high(3) 到 off(0) 的最大距离
            const distance = Math.abs(currentLevel - optLevel);
            const transitionState = Math.max(0, 1 - distance / maxLevelDistance);
            
            // 背景颜色插值
            const baseColor = particleColors[opt];
            const borderColor = colors.border;
            
            // 计算背景透明度：选中时最亮，过渡时根据接近程度
            // 使用平滑的过渡，确保低级别和高级别切换都有动画
            const bgAlpha = isSelected ? 1 : (transitionState > 0.01 ? 0.15 + 0.35 * transitionState : 0);
            
            if (bgAlpha > 0) {
                // 选中状态或过渡状态
                ctx.globalAlpha = Math.min(1, bgAlpha);
                ctx.fillStyle = baseColor;
                ctx.fillRect(optX, particleY - 20, optionWidth, toggleH);
                
                // 高亮边框
                ctx.globalAlpha = isSelected ? 1 : Math.min(1, transitionState * 0.6);
                ctx.strokeStyle = baseColor;
                ctx.lineWidth = isSelected ? 2 : 1;
                ctx.strokeRect(optX, particleY - 20, optionWidth, toggleH);
            } else {
                // 未选中状态
                ctx.globalAlpha = 1;
                ctx.fillStyle = borderColor;
                ctx.fillRect(optX, particleY - 20, optionWidth, toggleH);
            }
            ctx.globalAlpha = 1;

            ctx.fillStyle = '#ffffff';
            ctx.font = '12px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(particleLabels[opt], optX + optionWidth / 2, particleY - 5);
        });
        ctx.textAlign = 'left';

        // 显示FPS开关
        const fpsY = panelY + 190;
        ctx.fillStyle = colors.text;
        ctx.fillText('显示FPS', panelX + 40, fpsY);

        ctx.fillStyle = this.settings.showFPS ? colors.success : colors.border;
        ctx.fillRect(toggleX, fpsY - 20, toggleW, toggleH);
        ctx.fillStyle = '#ffffff';
        if (this.settings.showFPS) {
            ctx.fillRect(toggleX + toggleW - 22, fpsY - 17, 16, 20);
        } else {
            ctx.fillRect(toggleX + 6, fpsY - 17, 16, 20);
        }

        // 更华丽的特效（beta）开关
        const fancyY = panelY + 240;
        ctx.fillStyle = colors.text;
        ctx.fillText('更华丽的特效（beta）', panelX + 40, fancyY);

        ctx.fillStyle = this.settings.fancyEffects ? colors.success : colors.border;
        ctx.fillRect(toggleX, fancyY - 20, toggleW, toggleH);
        ctx.fillStyle = '#ffffff';
        if (this.settings.fancyEffects) {
            ctx.fillRect(toggleX + toggleW - 22, fancyY - 17, 16, 20);
        } else {
            ctx.fillRect(toggleX + 6, fancyY - 17, 16, 20);
        }

        // 音乐开关
        const musicY = panelY + 290;
        ctx.fillStyle = colors.text;
        ctx.fillText('背景音乐', panelX + 40, musicY);

        ctx.fillStyle = this.settings.music ? colors.success : colors.border;
        ctx.fillRect(toggleX, musicY - 20, toggleW, toggleH);
        ctx.fillStyle = '#ffffff';
        if (this.settings.music) {
            ctx.fillRect(toggleX + toggleW - 22, musicY - 17, 16, 20);
        } else {
            ctx.fillRect(toggleX + 6, musicY - 17, 16, 20);
        }

        // 帧率限制
        const frameRateY = panelY + 340;
        ctx.fillStyle = colors.text;
        ctx.fillText('帧率限制', panelX + 40, frameRateY);

        // 帧率限制说明
        ctx.fillStyle = colors.textMuted;
        ctx.font = '11px "Segoe UI", Arial, sans-serif';
        ctx.fillText('"无限制"上限 300fps，防止画面撕裂', panelX + 40, frameRateY + 18);

        // 帧率选择按钮组
        const frameRateOptions = [25, 30, 60, 90, 0];
        const frameRateLabels = ['25', '30', '60', '90', '无限制'];
        const btnWidth = 44;
        const btnHeight = 26;
        const btnSpacing = 6;
        const btnStartX = panelX + panelW - 40 - (frameRateOptions.length * btnWidth + (frameRateOptions.length - 1) * btnSpacing);

        for (let i = 0; i < frameRateOptions.length; i++) {
            const btnX = btnStartX + i * (btnWidth + btnSpacing);
            const isSelected = this.settings.frameRateLimit === frameRateOptions[i];
            const isDisabled = this.settings.vSyncEnabled;

            if (isDisabled) {
                ctx.fillStyle = isSelected ? colors.textMuted : colors.border;
                ctx.globalAlpha = 0.5;
            } else {
                ctx.fillStyle = isSelected ? colors.success : colors.border;
                ctx.globalAlpha = 1.0;
            }
            ctx.fillRect(btnX, frameRateY - 20, btnWidth, btnHeight);
            ctx.globalAlpha = 1.0;

            ctx.fillStyle = isSelected && !isDisabled ? '#ffffff' : colors.text;
            ctx.font = this.theme.fonts.small;
            ctx.textAlign = 'center';
            ctx.fillText(frameRateLabels[i], btnX + btnWidth / 2, frameRateY - 4);
        }

        // 垂直同步开关
        const vSyncY = panelY + 390;
        ctx.fillStyle = colors.text;
        ctx.font = this.theme.fonts.menu;
        ctx.textAlign = 'left';
        ctx.fillText('垂直同步', panelX + 40, vSyncY);

        ctx.fillStyle = this.settings.vSyncEnabled ? colors.success : colors.border;
        ctx.fillRect(toggleX, vSyncY - 20, toggleW, toggleH);
        ctx.fillStyle = '#ffffff';
        if (this.settings.vSyncEnabled) {
            ctx.fillRect(toggleX + toggleW - 22, vSyncY - 17, 16, 20);
        } else {
            ctx.fillRect(toggleX + 6, vSyncY - 17, 16, 20);
        }

        // 关闭提示
        ctx.fillStyle = colors.textMuted;
        ctx.font = this.theme.fonts.small;
        ctx.textAlign = 'center';
        ctx.fillText('按 ESC 或点击设置按钮关闭', w / 2, panelY + panelH - 30);

        ctx.textAlign = 'left';
    }

    _handleSettingsClick(x, y) {
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);
        const panelW = 400;
        const panelH = 480;
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;
        const toggleX = panelX + panelW - 90;
        const toggleW = 50;
        const toggleH = 26;

        if (x < panelX || x > panelX + panelW || y < panelY || y > panelY + panelH) {
            this._toggleSettings();
            return;
        }

        const aaY = panelY + 90;
        if (x >= toggleX && x <= toggleX + toggleW && y >= aaY - 20 && y <= aaY - 20 + toggleH) {
            this.settings.antialiasing = !this.settings.antialiasing;
            this._applyAntialiasing();
            return;
        }

        const particleY = panelY + 140;
        const particleOptions = ['off', 'low', 'medium', 'high'];
        const optionWidth = 44;
        const optionSpacing = 6;
        const optionsStartX = panelX + panelW - 40 - (particleOptions.length * optionWidth + (particleOptions.length - 1) * optionSpacing);

        for (let i = 0; i < particleOptions.length; i++) {
            const optX = optionsStartX + i * (optionWidth + optionSpacing);
            if (x >= optX && x <= optX + optionWidth && y >= particleY - 20 && y <= particleY - 20 + toggleH) {
                this.settings.particles = particleOptions[i];
                return;
            }
        }

        const fpsY = panelY + 190;
        if (x >= toggleX && x <= toggleX + toggleW && y >= fpsY - 20 && y <= fpsY - 20 + toggleH) {
            this.settings.showFPS = !this.settings.showFPS;
            return;
        }

        const fancyY = panelY + 240;
        if (x >= toggleX && x <= toggleX + toggleW && y >= fancyY - 20 && y <= fancyY - 20 + toggleH) {
            this.settings.fancyEffects = !this.settings.fancyEffects;
            return;
        }

        const musicY = panelY + 290;
        if (x >= toggleX && x <= toggleX + toggleW && y >= musicY - 20 && y <= musicY - 20 + toggleH) {
            this.settings.music = !this.settings.music;
            this._applyMusicSetting();
            return;
        }

        // 帧率限制按钮组点击处理
        const frameRateY = panelY + 340;
        const frameRateOptions = [25, 30, 60, 90, 0];
        const btnWidth = 44;
        const btnHeight = 26;
        const btnSpacing = 6;
        const btnStartX = panelX + panelW - 40 - (frameRateOptions.length * btnWidth + (frameRateOptions.length - 1) * btnSpacing);

        if (!this.settings.vSyncEnabled) {
            for (let i = 0; i < frameRateOptions.length; i++) {
                const btnX = btnStartX + i * (btnWidth + btnSpacing);
                if (x >= btnX && x <= btnX + btnWidth && y >= frameRateY - 20 && y <= frameRateY - 20 + btnHeight) {
                    this.settings.frameRateLimit = frameRateOptions[i];
                    return;
                }
            }
        }

        // 垂直同步开关点击处理
        const vSyncY = panelY + 390;
        if (x >= toggleX && x <= toggleX + toggleW && y >= vSyncY - 20 && y <= vSyncY - 20 + toggleH) {
            this.settings.vSyncEnabled = !this.settings.vSyncEnabled;
            return;
        }
    }

    _applyMusicSetting() {
        if (window.musicManager) {
            if (this.settings.music) {
                window.musicManager.resume();
            } else {
                window.musicManager.pause();
            }
        }
    }

    setGameState(state) {
        this.gameState = state;
        switch (state) {
            case 'MENU':
                this.menuSystem.show();
                this.menuSystem.inputDisabled = false;
                this.hudSystem.hide();
                break;
            case 'PLAYING':
                this.menuSystem.hide();
                this.hudSystem.show();
                break;
            case 'PAUSED':
                this.menuSystem.show();
                this.menuSystem.inputDisabled = false;
                this.hudSystem.hide();
                break;
            case 'GAMEOVER':
                this.menuSystem.show();
                this.menuSystem.inputDisabled = false;
                this.hudSystem.hide();
                break;
        }
    }

    start() {
        this.running = true;
        this.lastTime = performance.now();
        this._loopGuard = false;

        // Safari 帧率修复：使用 setInterval 突破 rAF ~30fps 节流
        if (this._isSafari && !this.settings.vSyncEnabled) {
            this._startSafariInterval();
        }

        this._scheduleNextFrame();
    }

    stop() {
        this.running = false;
        this._stopSafariInterval();
        if (this._frameTimeout) {
            clearTimeout(this._frameTimeout);
            this._frameTimeout = null;
        }
    }

    _startSafariInterval() {
        this._stopSafariInterval();
        const cap = this.settings.frameRateLimit === 0 ? 300 : this.settings.frameRateLimit;
        const interval = Math.max(1, Math.floor(1000 / cap));
        this._currentSafariInterval = interval;
        const self = this;
        this._safariTimer = setInterval(function() {
            if (!self.running || self._loopGuard) return;
            self._loop();
        }, interval);
    }

    _stopSafariInterval() {
        if (this._safariTimer) {
            clearInterval(this._safariTimer);
            this._safariTimer = null;
            this._currentSafariInterval = 0;
        }
    }

    _scheduleNextFrame() {
        if (!this.running) return;
        // 统一使用 requestAnimationFrame 与显示器刷新率同步
        // 帧率限制由 _loop 内部通过 frameSkip 实现
        requestAnimationFrame(this._boundLoop);
    }

    _loop() {
        if (!this.running || this._loopGuard) return;
        this._loopGuard = true;

        const now = performance.now();

        // 帧率限制：rAF 基础上的帧跳过
        if (!this.settings.vSyncEnabled) {
            const cap = this.settings.frameRateLimit === 0 ? 300 : this.settings.frameRateLimit;
            const minInterval = 1000 / cap;

            // Safari 帧率修复：设置变更时动态调整 setInterval 间隔
            if (this._isSafari) {
                const expectedInterval = Math.max(1, Math.floor(minInterval));
                if (this._safariTimer && expectedInterval !== this._currentSafariInterval) {
                    this._startSafariInterval();
                } else if (!this._safariTimer) {
                    this._startSafariInterval();
                }
            }

            if (now - this.lastTime < minInterval * 0.95) {
                this._loopGuard = false;
                this._scheduleNextFrame();
                return;
            }
        } else {
            // vSync 开启时停止 Safari setInterval，仅用 rAF
            if (this._isSafari && this._safariTimer) {
                this._stopSafariInterval();
            }
        }

        let dt = now - this.lastTime;
        this.lastTime = now;

        // 防止标签页切换等导致的大时间跳跃（上限 200ms）
        if (dt > 200) dt = 16.67;

        // 更新动画
        this.animations.basePulse += dt * 0.002;
        this.animations.zonePulse += dt * 0.001;

        // 计算FPS
        if (this.settings.showFPS) {
            this._fpsFrameCount++;
            this._fpsElapsed += dt;
            if (this._fpsElapsed >= 1000) {
                this._currentFPS = Math.round(this._fpsFrameCount * 1000 / this._fpsElapsed);
                this._fpsFrameCount = 0;
                this._fpsElapsed = 0;
            }
        }

        this.update(dt);
        this.render();

        this._loopGuard = false;
        this._scheduleNextFrame();
    }

    update(dt) {
        const dtSec = dt / 1000;

        // 更新加载动画
        this.updateLoadingAnimation(dt);

        // 更新粒子系统
        this._updateParticles(dt);

        if (this.hudSystem) {
            this.hudSystem.update(dtSec);
        }

        if (this.menuSystem) {
            this.menuSystem.update(dt);
        }

        if (this.consoleOpen) {
            this.consoleAnimProgress = Math.min(1, this.consoleAnimProgress + dt * 0.004);
        } else if (this.consoleAnimProgress > 0) {
            this.consoleAnimProgress = Math.max(0, this.consoleAnimProgress - dt * 0.006);
        }
        this.consoleCursorBlink += dt;
        this.consoleScanOffset += dt * 0.03;

        // 华丽特效开关过渡：当开关状态变化时，使用 0.5 秒过渡时间平滑切换
        const transitionTarget = this.settings.fancyEffects ? 1 : 0;
        if (this._fancyEffectsTransition.target !== transitionTarget) {
            this._fancyEffectsTransition.target = transitionTarget;
        }
        const transDiff = this._fancyEffectsTransition.target - this._fancyEffectsTransition.current;
        if (Math.abs(transDiff) > 0.001) {
            const step = dtSec / this._fancyEffectsTransition.duration;
            this._fancyEffectsTransition.current += transDiff * Math.min(step, 1);
        } else {
            this._fancyEffectsTransition.current = this._fancyEffectsTransition.target;
        }
    }

    render() {
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);

        this.ctx.clearRect(0, 0, w, h);

        if (this.gameState === 'MENU' || this.gameState === 'PAUSED') {
            this.menuSystem.render();
        }

        if (this.gameState === 'GAMEOVER') {
            this._renderGameOver();
        }

        if (this.gameState === 'PLAYING') {
            this._renderGameScene();
            this.hudSystem.render();
        }

        if (this.pauseMenuOpen) {
            this._renderPauseMenu();
        }

        if (this.settingsOpen) {
            this._renderSettingsPanel();
        }

        if (this.consoleOpen || this.consoleAnimProgress > 0) {
            this._renderConsole();
        }

        // 显示FPS
        if (this.settings.showFPS) {
            this._renderFPS();
        }

        // 渲染加载动画
        this.renderLoadingAnimation();
    }

    _renderGameScene() {
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);

        // 绘制太空背景
        this._renderSpaceBackground(w, h);

        if (this.gameCore) {
            this.ctx.save();
            const cam = this.gameCore.camera;
            this.ctx.scale(cam.zoom, cam.zoom);
            this.ctx.translate(-cam.x, -cam.y);

            // 绘制网格
            this._renderGrid();

            // 绘制控制区域
            this._renderControlZones();

            this._renderArtilleryStrikes();

            this._renderAsteroidBelts();

            this._renderResourceBeacons();

            this._renderBase();
            this._renderOutposts();

            // 绘制粒子效果
            if (this.settings.particles !== 'low') {
                this._renderParticles();
            }

            // 绘制激光特效
            this._renderLaserEffects();

            // 绘制敌方单位
            this._renderEnemyUnits();

            // 绘制玩家单位
            this._renderUnits();

            // 绘制命令指示器
            this._renderCommandIndicators();

            // 绘制等待区（独立于命令指示器，不受 hasActive 条件限制）
            this._renderWaitingAreas();

            this.ctx.restore();

            this._renderFogOfWar();

            // 敌方基地在战争迷雾之后渲染，确保即使无视野也可见
            // 需要重新应用相机变换，因为 _renderEnemyBase 使用世界坐标
            this.ctx.save();
            const enemyBaseCam = this.gameCore.camera;
            this.ctx.scale(enemyBaseCam.zoom, enemyBaseCam.zoom);
            this.ctx.translate(-enemyBaseCam.x, -enemyBaseCam.y);
            this._renderEnemyBase();
            this.ctx.restore();
        }
    }

    _renderFogOfWar() {
        if (!this.gameCore) return;

        const ctx = this.ctx;
        const cam = this.gameCore.camera;
        const zoom = cam.zoom || 1;
        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.width / dpr;
        const h = this.canvas.height / dpr;

        if (!this._fogCanvas) {
            this._fogCanvas = document.createElement('canvas');
            this._fogCtx = this._fogCanvas.getContext('2d');
        }

        if (this._fogCanvas.width !== this.canvas.width || this._fogCanvas.height !== this.canvas.height) {
            this._fogCanvas.width = this.canvas.width;
            this._fogCanvas.height = this.canvas.height;
            this._fogCacheKey = null;
        }

        const visibleAreas = this.gameCore.getVisibleAreas();
        // 对每个可见区域的位置计算滚动哈希，单位移动时哈希值变化 → 缓存自动失效
        let posHash = 0;
        for (const area of visibleAreas) {
            const hx = Math.round(area.x / 5);
            const hy = Math.round(area.y / 5);
            posHash = ((posHash << 5) - posHash) + hx + (hy << 8);
            posHash = posHash >>> 0;
        }
        const cacheKey = visibleAreas.length + '|' + posHash + '|' + Math.round(cam.x / 5) + '|' + Math.round(cam.y / 5) + '|' + zoom.toFixed(2);

        if (this._fogCacheKey === cacheKey) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(this._fogCanvas, 0, 0);
            ctx.restore();
            return;
        }

        this._fogCacheKey = cacheKey;

        const fogCtx = this._fogCtx;
        fogCtx.setTransform(1, 0, 0, 1, 0, 0);
        fogCtx.clearRect(0, 0, this._fogCanvas.width, this._fogCanvas.height);
        fogCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        fogCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        fogCtx.fillRect(0, 0, w, h);

        fogCtx.globalCompositeOperation = 'destination-out';
        fogCtx.fillStyle = 'rgba(0, 0, 0, 1)';

        for (const area of visibleAreas) {
            const screenX = (area.x - cam.x) * zoom;
            const screenY = (area.y - cam.y) * zoom;
            fogCtx.beginPath();
            fogCtx.arc(screenX, screenY, area.radius * zoom, 0, Math.PI * 2);
            fogCtx.fill();
        }

        fogCtx.globalCompositeOperation = 'source-over';

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(this._fogCanvas, 0, 0);
        ctx.restore();
    }

    _renderSpaceBackground(w, h) {
        // 深空渐变背景（缓存）
        if (!this._menuBgGradient) {
            const gradient = this.ctx.createRadialGradient(
                w / 2, h / 2, 0,
                w / 2, h / 2, Math.max(w, h)
            );
            gradient.addColorStop(0, '#0f172a');
            gradient.addColorStop(0.5, '#0a0e17');
            gradient.addColorStop(1, '#020617');
            this._menuBgGradient = gradient;
        }

        this.ctx.fillStyle = this._menuBgGradient;
        this.ctx.fillRect(0, 0, w, h);

        const time = performance.now() / 1000;
        const cam = this.gameCore ? this.gameCore.camera : { x: 0, y: 0 };

        // 使用过渡值控制特效强度，避免突然消失/出现
        const fancyAlpha = this._fancyEffectsTransition.current;

        if (fancyAlpha > 0) {
            // 缓存复合背景画布，减少每帧 drawImage 调用
            const bgCacheKey = `${Math.round(cam.x / 10)}_${Math.round(cam.y / 10)}_${w}_${h}`;
            if (!this._cachedSpaceBg || this._cachedSpaceBgKey !== bgCacheKey) {
                this._cachedSpaceBg = this._cachedSpaceBg || document.createElement('canvas');
                this._cachedSpaceBg.width = w;
                this._cachedSpaceBg.height = h;
                this._cachedSpaceBgKey = bgCacheKey;
                const bgCtx = this._cachedSpaceBg.getContext('2d');

                // 3层视差星云（预渲染缓存）
                this._ensureNebulaCanvases(w, h);
                for (let layerIdx = 0; layerIdx < 3; layerIdx++) {
                    const layer = this._nebulaLayers[layerIdx];
                    const canvas = this._nebulaCanvases[layerIdx];
                    const offsetX = -(cam.x * layer.speed) % canvas.width;
                    const offsetY = -(cam.y * layer.speed) % canvas.height;

                    for (let tx = -1; tx <= 1; tx++) {
                        for (let ty = -1; ty <= 1; ty++) {
                            bgCtx.drawImage(
                                canvas,
                                offsetX + tx * canvas.width,
                                offsetY + ty * canvas.height
                            );
                        }
                    }
                }

                // 彩色星云团（预渲染缓存）
                if (!this._nebulaCloudCanvas || this._nebulaCloudCanvasSize.w !== w || this._nebulaCloudCanvasSize.h !== h) {
                    const cloudCanvas = document.createElement('canvas');
                    cloudCanvas.width = w;
                    cloudCanvas.height = h;
                    const cctx = cloudCanvas.getContext('2d');
                    for (const cloud of this._nebulaClouds) {
                        const cx = (cloud.x * w % (w + 400)) - 200;
                        const cy = (cloud.y * h % (h + 400)) - 200;
                        const gradient = cctx.createRadialGradient(cx, cy, 0, cx, cy, cloud.radius);
                        gradient.addColorStop(0, cloud.colors.inner + cloud.alpha + ')');
                        gradient.addColorStop(0.5, cloud.colors.outer + (cloud.alpha * 0.5) + ')');
                        gradient.addColorStop(1, cloud.colors.outer + '0)');
                        cctx.fillStyle = gradient;
                        cctx.beginPath();
                        cctx.arc(cx, cy, cloud.radius, 0, Math.PI * 2);
                        cctx.fill();
                    }
                    this._nebulaCloudCanvas = cloudCanvas;
                    this._nebulaCloudCanvasSize = { w, h };
                }

                const cloudCam = this.gameCore ? this.gameCore.camera : { x: 0, y: 0 };
                for (let tx = -1; tx <= 1; tx++) {
                    for (let ty = -1; ty <= 1; ty++) {
                        const cx = ((-(cloudCam.x * 0.05) % (w + 400)) - 200) + tx * (w + 400);
                        const cy = ((-(cloudCam.y * 0.05) % (h + 400)) - 200) + ty * (h + 400);
                        bgCtx.drawImage(this._nebulaCloudCanvas, cx, cy);
                    }
                }
            }

            this.ctx.save();
            this.ctx.globalAlpha = fancyAlpha;
            this.ctx.drawImage(this._cachedSpaceBg, 0, 0);
            this.ctx.restore();
        }

        // 绘制星星
        this._renderStars(w, h, time, cam);

        if (fancyAlpha > 0) {
            this.ctx.save();
            this.ctx.globalAlpha = fancyAlpha;
            // 星尘微粒
            this._renderDustParticles(w, h, time, cam);
            this._renderShootingStars(w, h, time);
            this.ctx.restore();
        }
    }

    _renderStarsToCanvas(w, h) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        const fancyAlpha = this._fancyEffectsTransition.current;
        const starCount = fancyAlpha > 0.5 ? 200 : 100;

        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < starCount; i++) {
            const star = this._stars[i];
            const x = star.x * w;
            const y = star.y * h;
            ctx.globalAlpha = star.baseAlpha;
            ctx.beginPath();
            ctx.arc(x, y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        this._starsCanvas = canvas;
    }

    _renderStars(w, h, time, cam) {
        const ctx = this.ctx;
        const fancyAlpha = this._fancyEffectsTransition.current;

        if (!this._starsCanvas) {
            this._renderStarsToCanvas(w, h);
        }

        if (this._starsCanvas) {
            const parallaxX = -(cam.x * 0.05 * fancyAlpha) % w;
            const parallaxY = -(cam.y * 0.05 * fancyAlpha) % h;
            for (let tx = -1; tx <= 1; tx++) {
                for (let ty = -1; ty <= 1; ty++) {
                    ctx.drawImage(
                        this._starsCanvas,
                        parallaxX + tx * w,
                        parallaxY + ty * h
                    );
                }
            }
        }

        if (fancyAlpha > 0) {
            const starCount = fancyAlpha > 0.5 ? 50 : 25;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < starCount; i++) {
                const star = this._stars[i];
                const parallaxX = cam.x * 0.05 * fancyAlpha;
                const parallaxY = cam.y * 0.05 * fancyAlpha;
                const x = (star.x * w - parallaxX) % w;
                const y = (star.y * h - parallaxY) % h;
                const wrapX = x < 0 ? x + w : x;
                const wrapY = y < 0 ? y + h : y;
                const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase) * 0.4 + 0.6;
                const alpha = star.baseAlpha * (1 - (1 - twinkle) * fancyAlpha);
                const size = star.size * (1 + (twinkle - 1) * 0.2 * fancyAlpha);
                ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
                ctx.beginPath();
                ctx.arc(wrapX, wrapY, size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
    }

    _renderDustParticles(w, h, time, cam) {
        const ctx = this.ctx;
        ctx.fillStyle = '#ffffff';

        for (const dust of this._dustParticles) {
            const driftTime = time * 0.5 + dust.driftPhase;
            const driftOffsetX = Math.sin(driftTime) * 20 + dust.driftX * time * 10;
            const driftOffsetY = Math.cos(driftTime * 0.7) * 20 + dust.driftY * time * 10;

            const parallaxX = cam.x * 0.08;
            const parallaxY = cam.y * 0.08;

            let x = (dust.x * w - parallaxX + driftOffsetX) % w;
            let y = (dust.y * h - parallaxY + driftOffsetY) % h;
            if (x < 0) x += w;
            if (y < 0) y += h;

            ctx.globalAlpha = dust.alpha;
            ctx.beginPath();
            ctx.arc(x, y, dust.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    _renderShootingStars(w, h, time) {
        const ctx = this.ctx;
        const shootingStarCount = 3;
        for (let i = 0; i < shootingStarCount; i++) {
            const cycle = (time * 0.3 + i * 3.7) % 10;
            if (cycle > 1.5) continue;
            const progress = cycle / 1.5;
            const startX = ((i * 137 + 500) % 1000) / 1000 * w;
            const startY = ((i * 89 + 200) % 1000) / 1000 * h * 0.5;
            const x = startX + progress * 150;
            const y = startY + progress * 80;
            const alpha = 1 - progress;

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - 20, y - 10);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    _renderGrid() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const gridSize = 100;
        const worldW = this.gameCore.worldWidth;
        const worldH = this.gameCore.worldHeight;
        const cam = this.gameCore.camera;
        const zoom = cam.zoom || 1;
        const dpr = window.devicePixelRatio || 1;
        const canvasW = this.canvas.width / dpr;
        const canvasH = this.canvas.height / dpr;

        // 计算可见世界区域（视锥剔除）
        const visibleLeft = Math.max(0, cam.x - canvasW / 2 / zoom);
        const visibleRight = Math.min(worldW, cam.x + canvasW / 2 / zoom);
        const visibleTop = Math.max(0, cam.y - canvasH / 2 / zoom);
        const visibleBottom = Math.min(worldH, cam.y + canvasH / 2 / zoom);

        // 对齐到网格
        const startX = Math.floor(visibleLeft / gridSize) * gridSize;
        const endX = Math.ceil(visibleRight / gridSize) * gridSize;
        const startY = Math.floor(visibleTop / gridSize) * gridSize;
        const endY = Math.ceil(visibleBottom / gridSize) * gridSize;

        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.3;

        ctx.beginPath();
        for (let x = startX; x <= endX; x += gridSize) {
            ctx.moveTo(x, Math.max(0, startY));
            ctx.lineTo(x, Math.min(worldH, endY));
        }
        for (let y = startY; y <= endY; y += gridSize) {
            ctx.moveTo(Math.max(0, startX), y);
            ctx.lineTo(Math.min(worldW, endX), y);
        }
        ctx.stroke();

        ctx.globalAlpha = 1;
    }

    _renderControlZones() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const zones = this.gameCore.getControlZones();

        ctx.save();
        for (const zone of zones) {
            const pulse = Math.sin(this.animations.zonePulse) * 0.1 + 0.9;

            let zoneColor = colors.border;
            let fillAlpha = 0.1;

            if (zone.isContested) {
                zoneColor = colors.warning;
                fillAlpha = 0.15;
            } else if (zone.owner === 'player') {
                zoneColor = colors.primary;
                fillAlpha = 0.2;
            } else if (zone.owner === 'enemy') {
                zoneColor = colors.danger;
                fillAlpha = 0.2;
            } else if (zone.captureProgress > 0) {
                zoneColor = colors.warning;
                fillAlpha = 0.15;
            }

            const fancyAlpha = this._fancyEffectsTransition.current;
            if (fancyAlpha > 0 && !zone.isBlocked && zone.owner) {
                const breathe = Math.sin(this.animations.zonePulse * 1.5) * 0.05 + 1;
                const cacheKey = `zone_${zone.x}_${zone.y}_${zone.radius}_${zoneColor}_${fancyAlpha.toFixed(2)}`;
                const gradient = this._getCachedGradient(cacheKey, () => {
                    const g = ctx.createRadialGradient(zone.x, zone.y, zone.radius * 0.3, zone.x, zone.y, zone.radius);
                    const hexToRgba = (hex, a) => {
                        const r = parseInt(hex.slice(1, 3), 16);
                        const g = parseInt(hex.slice(3, 5), 16);
                        const b = parseInt(hex.slice(5, 7), 16);
                        return `rgba(${r}, ${g}, ${b}, ${a})`;
                    };
                    g.addColorStop(0, hexToRgba(zoneColor, 0.08 * fancyAlpha));
                    g.addColorStop(1, hexToRgba(zoneColor, 0));
                    return g;
                });
                ctx.fillStyle = gradient;
                ctx.globalAlpha = fancyAlpha;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zone.radius * breathe, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.strokeStyle = zoneColor;
            ctx.lineWidth = 2;
            ctx.globalAlpha = pulse;
            ctx.beginPath();
            ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = zoneColor;
            ctx.globalAlpha = fillAlpha * pulse;
            ctx.fill();

            if (zone.isBlocked) {
                const sawRadius = zone.radius + 10;
                const sawCount = 12;
                const rotation = this.animations.zonePulse;
                ctx.strokeStyle = colors.primary;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                for (let i = 0; i < sawCount * 2; i++) {
                    const angle = (i / (sawCount * 2)) * Math.PI * 2 + rotation;
                    const r = i % 2 === 0 ? sawRadius : sawRadius - 8;
                    const sx = zone.x + Math.cos(angle) * r;
                    const sy = zone.y + Math.sin(angle) * r;
                    if (i === 0) {
                        ctx.moveTo(sx, sy);
                    } else {
                        ctx.lineTo(sx, sy);
                    }
                }
                ctx.closePath();
                ctx.stroke();

                const fancyAlpha = this._fancyEffectsTransition.current;
                if (fancyAlpha > 0) {
                    const ringRadius = zone.radius + 22;
                    const ringGradient = ctx.createRadialGradient(zone.x, zone.y, ringRadius - 4, zone.x, zone.y, ringRadius + 4);
                    ringGradient.addColorStop(0, 'rgba(59, 130, 246, 0)');
                    ringGradient.addColorStop(0.5, `rgba(59, 130, 246, ${0.5 * fancyAlpha})`);
                    ringGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
                    ctx.strokeStyle = ringGradient;
                    ctx.lineWidth = 3;
                    ctx.globalAlpha = 0.6 * fancyAlpha;
                    ctx.setLineDash([6, 6]);
                    ctx.beginPath();
                    ctx.arc(zone.x, zone.y, ringRadius, rotation, rotation + Math.PI * 1.5);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            } else if (zone.captureProgress > 0 && zone.captureProgress < zone.maxCaptureProgress) {
                ctx.strokeStyle = colors.warning;
                ctx.lineWidth = 4;
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.arc(zone.x, zone.y, zone.radius - 5,
                    -Math.PI / 2,
                    -Math.PI / 2 + (zone.captureProgress / zone.maxCaptureProgress) * Math.PI * 2
                );
                ctx.stroke();
            }

            ctx.globalAlpha = 1;
            ctx.fillStyle = zoneColor;
            ctx.beginPath();
            ctx.arc(zone.x, zone.y, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = colors.text;
            ctx.font = this.theme.fonts.small;
            ctx.textAlign = 'center';
            ctx.fillText(zone.name, zone.x, zone.y - zone.radius - 10);
        }

        ctx.textAlign = 'left';
        ctx.restore();
    }

    _renderParticles() {
        const ctx = this.ctx;
        const particles = this.gameCore.getParticles();

        const byType = {};
        for (const p of particles) {
            if (p.delay !== undefined && p.delay > 0) continue;
            if (!byType[p.type]) byType[p.type] = [];
            byType[p.type].push(p);
        }

        if (byType.explosion) {
            for (const p of byType.explosion) {
                const alpha = p.life / p.maxLife;
                const elapsed = p.maxLife - p.life;
                const explosionProgress = elapsed / p.maxLife;
                const currentSize = p.startSize + (p.endSize - p.startSize) * explosionProgress;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = alpha * 0.9;
                ctx.beginPath();
                ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        if (byType.debris) {
            for (const p of byType.debris) {
                const alpha = p.life / p.maxLife;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation || 0);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                const sides = p.sides || 3;
                for (let s = 0; s < sides; s++) {
                    const angle = (s / sides) * Math.PI * 2;
                    const px = Math.cos(angle) * p.size * alpha;
                    const py = Math.sin(angle) * p.size * alpha;
                    if (s === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }

        if (byType.shockwave) {
            ctx.lineWidth = 3;
            for (const p of byType.shockwave) {
                const alpha = p.life / p.maxLife;
                const elapsed = p.maxLife - p.life;
                const waveProgress = elapsed / p.maxLife;
                const currentRadius = p.startRadius + (p.endRadius - p.startRadius) * waveProgress;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = (p.lineWidth || 3) * alpha;
                ctx.globalAlpha = alpha * 0.8;
                ctx.beginPath();
                ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        if (byType.smoke) {
            ctx.fillStyle = '#888888';
            for (const p of byType.smoke) {
                const alpha = p.life / p.maxLife;
                const elapsed = p.maxLife - p.life;
                ctx.globalAlpha = alpha * 0.5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * (1 + elapsed * 0.5), 0, Math.PI * 2);
                ctx.fill();
            }
        }

        if (byType.ripple) {
            ctx.lineWidth = 2;
            for (const p of byType.ripple) {
                const alpha = p.life / p.maxLife;
                const elapsed = p.maxLife - p.life;
                const rippleProgress = elapsed / p.maxLife;
                const rippleRadius = p.size * rippleProgress;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = (p.lineWidth || 2) * alpha;
                ctx.globalAlpha = alpha * 0.7;
                ctx.beginPath();
                ctx.arc(p.x, p.y, rippleRadius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        if (byType.hit_flash) {
            for (const p of byType.hit_flash) {
                const alpha = p.life / p.maxLife;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        if (byType.shield_shard) {
            for (const p of byType.shield_shard) {
                const alpha = p.life / p.maxLife;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation || 0);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = alpha * 0.8;
                ctx.beginPath();
                ctx.moveTo(p.size, 0);
                ctx.lineTo(-p.size * 0.5, p.size * 0.5);
                ctx.lineTo(-p.size * 0.5, -p.size * 0.5);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }

        if (byType.laser) {
            for (const p of byType.laser) {
                if (p.sourceX === undefined || p.targetX === undefined) continue;
                const alpha = p.life / p.maxLife;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = p.size * alpha;
                ctx.globalAlpha = alpha * 0.9;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 10 * alpha;
                ctx.beginPath();
                ctx.moveTo(p.sourceX, p.sourceY);
                ctx.lineTo(p.targetX, p.targetY);
                ctx.stroke();
            }
            ctx.shadowBlur = 0;
        }

        const defaultParticles = byType.default || byType[undefined];
        if (defaultParticles) {
            const fancyAlpha = this._fancyEffectsTransition.current;
            for (const p of defaultParticles) {
                const alpha = p.life / p.maxLife;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
                ctx.fill();

                if (fancyAlpha > 0 && p.maxLife - p.life < 0.3 && p.size > 2) {
                    const flashAlpha = (0.3 - (p.maxLife - p.life)) / 0.3;
                    ctx.fillStyle = '#ffffff';
                    ctx.globalAlpha = flashAlpha * 0.8 * fancyAlpha;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size * 2 * flashAlpha, 0, Math.PI * 2);
                    ctx.fill();

                    for (let s = 0; s < 4; s++) {
                        const angle = (s / 4) * Math.PI * 2 + this.animations.basePulse;
                        const dist = p.size * 3 * flashAlpha;
                        ctx.fillStyle = p.color;
                        ctx.globalAlpha = flashAlpha * 0.6 * fancyAlpha;
                        ctx.beginPath();
                        ctx.arc(p.x + Math.cos(angle) * dist, p.y + Math.sin(angle) * dist, p.size * 0.4 * flashAlpha, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    /**
     * 渲染攻击激光特效
     */
    _renderLaserEffects() {
        const fancyAlpha = this._fancyEffectsTransition.current;
        if (fancyAlpha <= 0) return;
        if (!this.gameCore) return;

        const ctx = this.ctx;
        const time = this.animations.basePulse;

        const allUnits = [...this.gameCore.units, ...this.gameCore.enemyUnits];
        const playerLasers = [];
        const enemyLasers = [];
        const shieldRipples = [];

        for (const unit of allUnits) {
            if (unit.hp <= 0) continue;
            if (unit.state !== 'attack' && unit.state !== 'attack_base') continue;
            if (!unit.targetUnit || unit.targetUnit.hp <= 0) continue;
            if (unit.attackCooldown <= 0) continue;

            const cooldownRatio = unit.attackCooldown / unit.attackInterval;
            if (cooldownRatio < 0.9) continue;

            const target = unit.targetUnit;
            const isPlayer = unit.team === 'player';
            const laser = { ux: unit.x, uy: unit.y, tx: target.x, ty: target.y, ratio: cooldownRatio };
            if (isPlayer) {
                playerLasers.push(laser);
            } else {
                enemyLasers.push(laser);
            }

            if (target.shield > 0 || target.shieldHitTimer > 0) {
                shieldRipples.push({ x: target.x, y: target.y, size: target.size, ratio: cooldownRatio });
            }
        }

        if (playerLasers.length === 0 && enemyLasers.length === 0) {
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            return;
        }

        ctx.save();

        if (playerLasers.length > 0) {
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#60a5fa';
            for (const l of playerLasers) {
                ctx.globalAlpha = l.ratio * fancyAlpha;
                ctx.shadowBlur = 15 * l.ratio * fancyAlpha;
                ctx.beginPath();
                ctx.moveTo(l.ux, l.uy);
                ctx.lineTo(l.tx, l.ty);
                ctx.stroke();
            }
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            for (const l of playerLasers) {
                ctx.globalAlpha = l.ratio * 0.8 * fancyAlpha;
                ctx.shadowBlur = 5 * l.ratio * fancyAlpha;
                ctx.beginPath();
                ctx.moveTo(l.ux, l.uy);
                ctx.lineTo(l.tx, l.ty);
                ctx.stroke();
            }
        }

        if (enemyLasers.length > 0) {
            ctx.strokeStyle = '#f87171';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#f87171';
            for (const l of enemyLasers) {
                ctx.globalAlpha = l.ratio * fancyAlpha;
                ctx.shadowBlur = 15 * l.ratio * fancyAlpha;
                ctx.beginPath();
                ctx.moveTo(l.ux, l.uy);
                ctx.lineTo(l.tx, l.ty);
                ctx.stroke();
            }
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            for (const l of enemyLasers) {
                ctx.globalAlpha = l.ratio * 0.8 * fancyAlpha;
                ctx.shadowBlur = 5 * l.ratio * fancyAlpha;
                ctx.beginPath();
                ctx.moveTo(l.ux, l.uy);
                ctx.lineTo(l.tx, l.ty);
                ctx.stroke();
            }
        }

        ctx.shadowBlur = 0;

        if (playerLasers.length > 0 || enemyLasers.length > 0) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            for (const l of playerLasers) {
                const flashAlpha = l.ratio;
                ctx.globalAlpha = flashAlpha * 0.9 * fancyAlpha;
                ctx.shadowBlur = 20 * flashAlpha * fancyAlpha;
                ctx.beginPath();
                ctx.arc(l.tx, l.ty, 8 * flashAlpha, 0, Math.PI * 2);
                ctx.fill();
            }
            for (const l of enemyLasers) {
                const flashAlpha = l.ratio;
                ctx.globalAlpha = flashAlpha * 0.9 * fancyAlpha;
                ctx.shadowBlur = 20 * flashAlpha * fancyAlpha;
                ctx.beginPath();
                ctx.arc(l.tx, l.ty, 8 * flashAlpha, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        }

        if (shieldRipples.length > 0) {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#3b82f6';
            for (const r of shieldRipples) {
                const flashAlpha = r.ratio;
                for (let i = 0; i < 2; i++) {
                    const ripplePhase = (time * 3 + i * 0.5) % 1;
                    const rippleRadius = (r.size + 10) + ripplePhase * 25;
                    const rippleAlpha = (1 - ripplePhase) * flashAlpha * 0.6 * fancyAlpha;
                    ctx.globalAlpha = rippleAlpha;
                    ctx.shadowBlur = 8 * rippleAlpha;
                    ctx.beginPath();
                    ctx.arc(r.x, r.y, rippleRadius, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            ctx.shadowBlur = 0;
        }

        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    _renderResourceBeacons() {
        const ctx = this.ctx;
        if (!this.gameCore) return;
        const beacons = this.gameCore.getResourceBeacons();
        const time = this.animations.basePulse;

        for (const beacon of beacons) {
            const bx = beacon.x;
            const by = beacon.y;
            const visionR = beacon.visionRadius || 100;
            const pulse = Math.sin(time * 3) * 0.2 + 0.8;
            const slowPulse = Math.sin(time * 1.5) * 0.15 + 0.85;

            ctx.save();

            const visionGrad = ctx.createRadialGradient(bx, by, visionR * 0.6, bx, by, visionR);
            visionGrad.addColorStop(0, 'rgba(251, 191, 36, 0.06)');
            visionGrad.addColorStop(0.7, 'rgba(251, 191, 36, 0.03)');
            visionGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
            ctx.fillStyle = visionGrad;
            ctx.beginPath();
            ctx.arc(bx, by, visionR, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.2 * pulse;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.arc(bx, by, visionR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            for (let i = 0; i < 3; i++) {
                const ringPulse = ((time * 2 + i * 1.2) % 3) / 3;
                const ringR = 12 + ringPulse * 30;
                const ringAlpha = (1 - ringPulse) * 0.5;
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 1.5 * (1 - ringPulse);
                ctx.globalAlpha = ringAlpha;
                ctx.beginPath();
                ctx.arc(bx, by, ringR, 0, Math.PI * 2);
                ctx.stroke();
            }

            const towerH = 18;
            const towerW = 6;
            const baseW = 14;
            const baseH = 4;

            ctx.globalAlpha = 1;

            ctx.fillStyle = '#78350f';
            ctx.beginPath();
            ctx.moveTo(bx - baseW / 2, by + towerH / 2);
            ctx.lineTo(bx + baseW / 2, by + towerH / 2);
            ctx.lineTo(bx + baseW / 2 - 2, by + towerH / 2 + baseH);
            ctx.lineTo(bx - baseW / 2 + 2, by + towerH / 2 + baseH);
            ctx.closePath();
            ctx.fill();

            const towerGrad = ctx.createLinearGradient(bx - towerW / 2, by - towerH / 2, bx + towerW / 2, by + towerH / 2);
            towerGrad.addColorStop(0, '#fbbf24');
            towerGrad.addColorStop(0.5, '#d97706');
            towerGrad.addColorStop(1, '#92400e');
            ctx.fillStyle = towerGrad;
            ctx.beginPath();
            ctx.moveTo(bx - towerW / 2, by + towerH / 2);
            ctx.lineTo(bx + towerW / 2, by + towerH / 2);
            ctx.lineTo(bx + towerW / 4, by - towerH / 2 + 4);
            ctx.lineTo(bx - towerW / 4, by - towerH / 2 + 4);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#fcd34d';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(bx - towerW / 2, by + towerH / 2);
            ctx.lineTo(bx + towerW / 2, by + towerH / 2);
            ctx.lineTo(bx + towerW / 4, by - towerH / 2 + 4);
            ctx.lineTo(bx - towerW / 4, by - towerH / 2 + 4);
            ctx.closePath();
            ctx.stroke();

            const tipY = by - towerH / 2 + 2;
            const tipGlowR = 6 + Math.sin(time * 4) * 2;
            const tipGrad = ctx.createRadialGradient(bx, tipY, 0, bx, tipY, tipGlowR * 2);
            tipGrad.addColorStop(0, 'rgba(251, 191, 36, 0.8)');
            tipGrad.addColorStop(0.4, 'rgba(251, 191, 36, 0.3)');
            tipGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
            ctx.fillStyle = tipGrad;
            ctx.beginPath();
            ctx.arc(bx, tipY, tipGlowR * 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#fef3c7';
            ctx.beginPath();
            ctx.arc(bx, tipY, 3, 0, Math.PI * 2);
            ctx.fill();

            const rayCount = 4;
            for (let i = 0; i < rayCount; i++) {
                const angle = (i / rayCount) * Math.PI * 2 + time * 0.8;
                const rayLen = 10 + Math.sin(time * 3 + i) * 3;
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.6 * slowPulse;
                ctx.beginPath();
                ctx.moveTo(bx + Math.cos(angle) * 5, tipY + Math.sin(angle) * 5);
                ctx.lineTo(bx + Math.cos(angle) * rayLen, tipY + Math.sin(angle) * rayLen);
                ctx.stroke();
            }

            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }

    _renderAsteroidBelts() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const belts = this.gameCore.getAsteroidBelts();

        for (const belt of belts) {
            const img = this.resourceManager.get('asteroidBelt');
            if (img) {
                ctx.drawImage(img, belt.x - belt.radius, belt.y - belt.radius, belt.radius * 2, belt.radius * 2);
            } else {
                ctx.fillStyle = '#8B4513';
                ctx.beginPath();
                ctx.arc(belt.x, belt.y, belt.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = colors.text;
                ctx.font = this.theme.fonts.small;
                ctx.textAlign = 'center';
                ctx.fillText(`${Math.floor(belt.resources)}`, belt.x, belt.y);
                ctx.textAlign = 'left';
            }

        }
    }

    _renderBase() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const isPlayer2 = this.gameCore.isMultiplayer && this.gameCore.playerTeam === 'player2';
        const base = isPlayer2 ? this.gameCore.enemyBase : this.gameCore.base;
        if (!base || base.hp <= 0) return;

        const size = base.size;

        const pulse = Math.sin(this.animations.basePulse) * 0.1 + 1;

        const fancyAlpha = this._fancyEffectsTransition.current;
        if (fancyAlpha > 0) {
            const hpRatio = base.hp / base.maxHp;
            const urgency = 1 + (1 - hpRatio) * 2;
            const fancyPulse = Math.sin(this.animations.basePulse * urgency) * 0.15 + 1;
            const glowRadius = size * 2.0 * fancyPulse;

            const gradient = ctx.createRadialGradient(base.x, base.y, size * 0.5, base.x, base.y, glowRadius);
            gradient.addColorStop(0, `rgba(34, 197, 94, ${0.4 * fancyAlpha})`);
            gradient.addColorStop(0.5, `rgba(34, 197, 94, ${0.15 * fancyAlpha})`);
            gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
            ctx.fillStyle = gradient;
            ctx.globalAlpha = 0.6 * fancyAlpha;
            ctx.beginPath();
            ctx.arc(base.x, base.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = `rgba(34, 197, 94, ${0.3 * fancyAlpha})`;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.4 * fancyPulse * fancyAlpha;
            ctx.beginPath();
            ctx.arc(base.x, base.y, size * 1.6 * fancyPulse, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 绘制基地光环
        ctx.strokeStyle = colors.success;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5 * pulse;
        ctx.beginPath();
        ctx.arc(base.x, base.y, size * 1.2 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        // 绘制基地主体
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.success;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y - size / 2);
        ctx.lineTo(base.x + size / 2, base.y);
        ctx.lineTo(base.x, base.y + size / 2);
        ctx.lineTo(base.x - size / 2, base.y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = colors.text;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 绘制护盾条（如果有护盾）
        if (base.maxShield && base.maxShield > 0) {
            const shieldRatio = base.shield / base.maxShield;
            const barWidth = size * 1.5;
            const shieldBarHeight = 4;
            const barX = base.x - barWidth / 2;
            const shieldBarY = base.y - size / 2 - 28;

            ctx.fillStyle = colors.border;
            ctx.fillRect(barX, shieldBarY, barWidth, shieldBarHeight);
            ctx.fillStyle = colors.shieldBar;
            ctx.fillRect(barX, shieldBarY, barWidth * shieldRatio, shieldBarHeight);
        }

        // 绘制耐久条
        const hpRatio = base.hp / base.maxHp;
        const barWidth = size * 1.5;
        const barHeight = 6;
        const barX = base.x - barWidth / 2;
        const barY = base.y - size / 2 - 20;

        ctx.fillStyle = colors.border;
        ctx.fillRect(barX, barY, barWidth, barHeight);

        ctx.fillStyle = hpRatio > 0.5 ? colors.success : hpRatio > 0.25 ? colors.warning : colors.danger;
        ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

        // 绘制名称
        ctx.fillStyle = colors.text;
        ctx.font = this.theme.fonts.small;
        ctx.textAlign = 'center';
        ctx.fillText(base.name, base.x, base.y - size / 2 - 40);
        ctx.textAlign = 'left';
    }

    _renderEnemyBase() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const isPlayer2 = this.gameCore.isMultiplayer && this.gameCore.playerTeam === 'player2';
        const base = isPlayer2 ? this.gameCore.base : this.gameCore.enemyBase;
        if (!base || base.hp <= 0) return;

        const size = base.size;
        const pulse = Math.sin(this.animations.basePulse + Math.PI) * 0.1 + 1;

        const fancyAlphaEnemy = this._fancyEffectsTransition.current;
        if (fancyAlphaEnemy > 0) {
            const hpRatio = base.hp / base.maxHp;
            const urgency = 1 + (1 - hpRatio) * 2;
            const fancyPulse = Math.sin(this.animations.basePulse * urgency + Math.PI) * 0.15 + 1;
            const glowRadius = size * 2.0 * fancyPulse;

            const gradient = ctx.createRadialGradient(base.x, base.y, size * 0.5, base.x, base.y, glowRadius);
            gradient.addColorStop(0, `rgba(239, 68, 68, ${0.4 * fancyAlphaEnemy})`);
            gradient.addColorStop(0.5, `rgba(239, 68, 68, ${0.15 * fancyAlphaEnemy})`);
            gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
            ctx.fillStyle = gradient;
            ctx.globalAlpha = 0.6 * fancyAlphaEnemy;
            ctx.beginPath();
            ctx.arc(base.x, base.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 * fancyAlphaEnemy})`;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.4 * fancyPulse * fancyAlphaEnemy;
            ctx.beginPath();
            ctx.arc(base.x, base.y, size * 1.6 * fancyPulse, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 绘制基地光环
        ctx.strokeStyle = colors.danger;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5 * pulse;
        ctx.beginPath();
        ctx.arc(base.x, base.y, size * 1.2 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        // 绘制基地主体
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.danger;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y - size / 2);
        ctx.lineTo(base.x + size / 2, base.y);
        ctx.lineTo(base.x, base.y + size / 2);
        ctx.lineTo(base.x - size / 2, base.y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = colors.text;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 绘制护盾条（如果有护盾）
        if (base.maxShield && base.maxShield > 0) {
            const shieldRatio = base.shield / base.maxShield;
            const barWidth = size * 1.5;
            const shieldBarHeight = 4;
            const barX = base.x - barWidth / 2;
            const shieldBarY = base.y - size / 2 - 28;

            ctx.fillStyle = colors.border;
            ctx.fillRect(barX, shieldBarY, barWidth, shieldBarHeight);
            ctx.fillStyle = colors.shieldBar;
            ctx.fillRect(barX, shieldBarY, barWidth * shieldRatio, shieldBarHeight);
        }

        // 绘制耐久条
        const hpRatio = base.hp / base.maxHp;
        const barWidth = size * 1.5;
        const barHeight = 6;
        const barX = base.x - barWidth / 2;
        const barY = base.y - size / 2 - 20;

        ctx.fillStyle = colors.border;
        ctx.fillRect(barX, barY, barWidth, barHeight);

        ctx.fillStyle = hpRatio > 0.5 ? colors.success : hpRatio > 0.25 ? colors.warning : colors.danger;
        ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

        // 绘制名称
        ctx.fillStyle = colors.text;
        ctx.font = this.theme.fonts.small;
        ctx.textAlign = 'center';
        ctx.fillText(base.name, base.x, base.y - size / 2 - 40);
        ctx.textAlign = 'left';
    }

    _renderOutposts() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        if (!this.gameCore) return;
        const outposts = this.gameCore.getOutposts();
        for (const outpost of outposts) {
            if (outpost.hp <= 0) continue;
            const pulse = Math.sin(this.animations.basePulse) * 0.15 + 0.85;
            const halfSize = outpost.size / 2;
            ctx.save();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.3 * pulse;
            ctx.strokeRect(
                outpost.x - outpost.blockadeRadius,
                outpost.y - outpost.blockadeRadius,
                outpost.blockadeRadius * 2,
                outpost.blockadeRadius * 2
            );
            ctx.restore();
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = pulse;
            ctx.fillRect(outpost.x - halfSize, outpost.y - halfSize, outpost.size, outpost.size);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 1;
            ctx.strokeRect(outpost.x - halfSize, outpost.y - halfSize, outpost.size, outpost.size);
            if (outpost.isBlocked) {
                const sawRadius = outpost.blockadeRadius + 5;
                const sawCount = 8;
                const rotation = this.animations.zonePulse;
                ctx.strokeStyle = colors.primary;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                for (let i = 0; i < sawCount * 2; i++) {
                    const angle = (i / (sawCount * 2)) * Math.PI * 2 + rotation;
                    const r = i % 2 === 0 ? sawRadius : sawRadius - 6;
                    const sx = outpost.x + Math.cos(angle) * r;
                    const sy = outpost.y + Math.sin(angle) * r;
                    if (i === 0) ctx.moveTo(sx, sy);
                    else ctx.lineTo(sx, sy);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
            ctx.fillStyle = colors.text;
            ctx.font = this.theme.fonts.small;
            ctx.textAlign = 'center';
            ctx.fillText(outpost.name, outpost.x, outpost.y - halfSize - 10);
            ctx.textAlign = 'left';

            // 绘制护盾条（如果有护盾）
            if (outpost.maxShield && outpost.maxShield > 0) {
                const shieldRatio = outpost.shield / outpost.maxShield;
                const barWidth = outpost.size * 1.5;
                const shieldBarHeight = 3;
                const barX = outpost.x - barWidth / 2;
                const shieldBarY = outpost.y + halfSize + 6;

                ctx.fillStyle = colors.border;
                ctx.fillRect(barX, shieldBarY, barWidth, shieldBarHeight);
                ctx.fillStyle = colors.shieldBar;
                ctx.fillRect(barX, shieldBarY, barWidth * shieldRatio, shieldBarHeight);
            }

            // 绘制血条
            const hpRatio = outpost.hp / outpost.maxHp;
            const barWidth = outpost.size * 1.5;
            const barHeight = 4;
            const barX = outpost.x - barWidth / 2;
            const barY = outpost.y + halfSize + 10;
            ctx.fillStyle = colors.border;
            ctx.fillRect(barX, barY, barWidth, barHeight);
            ctx.fillStyle = hpRatio > 0.5 ? colors.success : hpRatio > 0.25 ? colors.warning : colors.danger;
            ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
        }
    }

    _renderEnemyUnits() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const fighterImg = this.resourceManager.get('fighter');
        const battleshipImg = this.resourceManager.get('battleship');
        const isPlayer2 = this.gameCore.isMultiplayer && this.gameCore.playerTeam === 'player2';
        const enemyUnits = isPlayer2 ? this.gameCore.units : this.gameCore.enemyUnits;

        for (const unit of enemyUnits) {
            if (unit.hp <= 0) continue;
            if (!this.gameCore.isVisible(unit.x, unit.y)) continue;
            const size = unit.size;
            const x = unit.x - size / 2;
            const y = unit.y - size / 2;

            // 引擎尾焰效果（增强版）
            const fancyAlphaEnemy = this._fancyEffectsTransition.current;
            if (fancyAlphaEnemy > 0 && (unit.state === 'move' || unit.state === 'patrol' || unit.state === 'attack' || unit.state === 'reroute')) {
                // 计算速度用于尾焰长度
                let speed = 0;
                if (unit.vx !== undefined && unit.vy !== undefined) {
                    speed = Math.sqrt(unit.vx * unit.vx + unit.vy * unit.vy);
                }
                // 如果没有速度数据，根据状态估算
                if (speed < 0.5) speed = unit.speed * 0.02;

                if (speed > 0.3) {
                    const tailLen = Math.min(speed * 12, 50);
                    const tailWidth = size * 0.35;
                    const backX = unit.x - Math.cos(unit.angle) * size * 0.4;
                    const backY = unit.y - Math.sin(unit.angle) * size * 0.4;

                    // 1. 推进器尾焰：红色渐变，长度与速度成正比
                    const flameKey = `flame_e_${Math.round(tailLen)}_${Math.round(unit.angle * 10)}_${fancyAlphaEnemy.toFixed(2)}`;
                    const flameGradient = this._getCachedGradient(flameKey, () => {
                        const g = ctx.createLinearGradient(
                            unit.x, unit.y,
                            unit.x - Math.cos(unit.angle) * tailLen,
                            unit.y - Math.sin(unit.angle) * tailLen
                        );
                        g.addColorStop(0, `rgba(239, 68, 68, ${0.6 * fancyAlphaEnemy})`);
                        g.addColorStop(0.4, `rgba(248, 113, 113, ${0.3 * fancyAlphaEnemy})`);
                        g.addColorStop(1, 'rgba(254, 202, 202, 0)');
                        return g;
                    });

                    ctx.save();
                    ctx.fillStyle = flameGradient;
                    ctx.beginPath();
                    // 尾焰形状：从单位后方展开的锥形
                    const tipX = unit.x - Math.cos(unit.angle) * (size * 0.4 + tailLen);
                    const tipY = unit.y - Math.sin(unit.angle) * (size * 0.4 + tailLen);
                    const perpX = -Math.sin(unit.angle) * tailWidth;
                    const perpY = Math.cos(unit.angle) * tailWidth;

                    ctx.moveTo(backX + perpX, backY + perpY);
                    ctx.lineTo(tipX, tipY);
                    ctx.lineTo(backX - perpX, backY - perpY);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();

                    // 2. 离子尾迹：半透明红色拖尾，持续0.5秒
                    const ionKey = `ion_e_${Math.round(tailLen)}_${Math.round(unit.angle * 10)}_${fancyAlphaEnemy.toFixed(2)}`;
                    const ionGradient = this._getCachedGradient(ionKey, () => {
                        const g = ctx.createLinearGradient(unit.x, unit.y, backX, backY);
                        g.addColorStop(0, `rgba(252, 165, 165, ${0.25 * fancyAlphaEnemy})`);
                        g.addColorStop(1, 'rgba(252, 165, 165, 0)');
                        return g;
                    });

                    ctx.strokeStyle = ionGradient;
                    ctx.lineWidth = tailWidth * 0.6;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(unit.x, unit.y);
                    ctx.lineTo(backX - Math.cos(unit.angle) * tailLen * 0.5, backY - Math.sin(unit.angle) * tailLen * 0.5);
                    ctx.stroke();
                }
            }

            // 护盾能量环：半透明蓝色六边形（护盾值小于0.1视为无护盾）
            if (fancyAlphaEnemy > 0 && unit.shield > 0.1) {
                const shieldRatio = unit.shield / unit.maxShield;
                const hexRadius = size * 0.85;
                const hexAlpha = (0.3 + shieldRatio * 0.3) * fancyAlphaEnemy;

                ctx.save();
                ctx.strokeStyle = `rgba(96, 165, 250, ${hexAlpha})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2 + this.animations.basePulse * 0.5;
                    const hx = unit.x + Math.cos(angle) * hexRadius;
                    const hy = unit.y + Math.sin(angle) * hexRadius;
                    if (i === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.stroke();

                // 护盾填充
                ctx.fillStyle = `rgba(96, 165, 250, ${hexAlpha * 0.2})`;
                ctx.fill();

                // 护盾受击涟漪
                if (unit.shieldHitTimer > 0) {
                    const hitProgress = 1 - (unit.shieldHitTimer / 0.3);
                    const hitRadius = hexRadius + hitProgress * 15;
                    const hitAlpha = unit.shieldHitTimer / 0.3 * 0.6 * fancyAlphaEnemy;
                    ctx.strokeStyle = `rgba(147, 197, 253, ${hitAlpha})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const angle = (i / 6) * Math.PI * 2;
                        const hx = unit.x + Math.cos(angle) * hitRadius;
                        const hy = unit.y + Math.sin(angle) * hitRadius;
                        if (i === 0) ctx.moveTo(hx, hy);
                        else ctx.lineTo(hx, hy);
                    }
                    ctx.closePath();
                    ctx.stroke();
                }
                ctx.restore();
            }

            const unitImg = unit.type === 'battleship' ? battleshipImg : fighterImg;
            if (unitImg) {
                ctx.save();
                ctx.translate(unit.x, unit.y);
                ctx.rotate(unit.angle + Math.PI / 2);
                ctx.filter = 'hue-rotate(150deg) saturate(1.5)';
                ctx.drawImage(unitImg, -size / 2, -size / 2, size, size);
                ctx.restore();
            } else {
                ctx.save();
                ctx.translate(unit.x, unit.y);
                ctx.rotate(unit.angle + Math.PI / 2);
                ctx.fillStyle = colors.danger;
                ctx.fillRect(-size / 2, -size / 2, size, size);
                ctx.strokeStyle = colors.borderHover;
                ctx.lineWidth = 1;
                ctx.strokeRect(-size / 2, -size / 2, size, size);
                ctx.restore();
            }

            if (unit.type === 'battleship' && unit.artilleryCooldown > 0) {
                const cooldownRatio = unit.artilleryCooldown / (unit.artilleryMaxCooldown || 10);
                const cdRadius = 12;
                const cdX = unit.x;
                const cdY = unit.y - size / 2 - 16;

                ctx.fillStyle = '#374151';
                ctx.beginPath();
                ctx.arc(cdX, cdY, cdRadius, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = '#f97316';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cdX, cdY, cdRadius, -Math.PI / 2, -Math.PI / 2 + (1 - cooldownRatio) * Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(Math.ceil(unit.artilleryCooldown), cdX, cdY);
            }

            if (unit.shield > 0.1) {
                const shieldRatio = unit.shield / unit.maxShield;
                ctx.fillStyle = colors.shieldBar;
                ctx.globalAlpha = 0.6;
                ctx.fillRect(x, y - 8, size * shieldRatio, 4);
                ctx.globalAlpha = 1;
            }

            const hpRatio = unit.hp / unit.maxHp;
            ctx.fillStyle = colors.border;
            ctx.fillRect(x, y - 4, size, 4);
            ctx.fillStyle = hpRatio > 0.5 ? colors.success : hpRatio > 0.25 ? colors.warning : colors.danger;
            ctx.fillRect(x, y - 4, size * hpRatio, 4);

            ctx.fillStyle = colors.text;
            ctx.font = this.theme.fonts.small;
            ctx.textAlign = 'center';
            ctx.fillText(unit.name, unit.x, y + size + 12);
        }

        ctx.textAlign = 'left';
    }

    _renderUnits() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const fighterImg = this.resourceManager.get('fighter');
        const battleshipImg = this.resourceManager.get('battleship');
        const isPlayer2 = this.gameCore.isMultiplayer && this.gameCore.playerTeam === 'player2';
        const myUnits = isPlayer2 ? this.gameCore.enemyUnits : this.gameCore.units;

        // 单位移动拖尾效果（中效果以上）
        const enableMoveTrail = this.settings.particles === 'medium' || this.settings.particles === 'high';

        for (const unit of myUnits) {
            if (unit.hp <= 0) continue;
            const size = unit.size;
            const x = unit.x - size / 2;
            const y = unit.y - size / 2;

            // 单位移动拖尾粒子效果（中效果以上，且单位在移动状态）
            if (enableMoveTrail && (unit.state === 'move' || unit.state === 'patrol' || unit.state === 'attack' || unit.state === 'reroute')) {
                // 计算速度
                let speed = 0;
                if (unit.vx !== undefined && unit.vy !== undefined) {
                    speed = Math.sqrt(unit.vx * unit.vx + unit.vy * unit.vy);
                }
                if (speed < 0.5) speed = unit.speed * 0.02;

                // 速度足够快时生成拖尾粒子
                if (speed > 0.3) {
                    // 根据粒子效果等级决定生成频率和数量
                    const spawnChance = this.settings.particles === 'high' ? 0.4 : 0.2;
                    if (Math.random() < spawnChance) {
                        const trailColor = unit.type === 'fighter' ? '#60a5fa' : '#3b82f6';
                        this.createEngineTrail(unit.x, unit.y, unit.angle + Math.PI, trailColor);
                    }
                }
            }

            // 引擎尾焰效果（增强版）- 高粒子效果时显示
            const isHighParticles = this.settings.particles === 'high';
            const fancyAlphaPlayer = this._fancyEffectsTransition.current;
            // 高粒子效果时始终显示，中粒子效果时依赖华丽特效开关
            const trailAlpha = isHighParticles ? 1 : fancyAlphaPlayer;
            if (trailAlpha > 0 && (unit.state === 'move' || unit.state === 'patrol' || unit.state === 'attack' || unit.state === 'reroute')) {
                // 计算速度用于尾焰长度
                let speed = 0;
                if (unit.vx !== undefined && unit.vy !== undefined) {
                    speed = Math.sqrt(unit.vx * unit.vx + unit.vy * unit.vy);
                }
                // 如果没有速度数据，根据状态估算
                if (speed < 0.5) speed = unit.speed * 0.02;

                if (speed > 0.3) {
                    const tailLen = Math.min(speed * 12, 50);
                    const tailWidth = size * 0.35;
                    const backX = unit.x - Math.cos(unit.angle) * size * 0.4;
                    const backY = unit.y - Math.sin(unit.angle) * size * 0.4;

                    // 1. 推进器尾焰：蓝色渐变，长度与速度成正比
                    const flameKey = `flame_${Math.round(tailLen)}_${Math.round(unit.angle * 10)}_${trailAlpha.toFixed(2)}`;
                    const flameGradient = this._getCachedGradient(flameKey, () => {
                        const g = ctx.createLinearGradient(
                            unit.x, unit.y,
                            unit.x - Math.cos(unit.angle) * tailLen,
                            unit.y - Math.sin(unit.angle) * tailLen
                        );
                        g.addColorStop(0, `rgba(59, 130, 246, ${0.6 * trailAlpha})`);
                        g.addColorStop(0.4, `rgba(96, 165, 250, ${0.3 * trailAlpha})`);
                        g.addColorStop(1, 'rgba(191, 219, 254, 0)');
                        return g;
                    });

                    ctx.save();
                    ctx.fillStyle = flameGradient;
                    ctx.beginPath();
                    // 尾焰形状：从单位后方展开的锥形
                    const tipX = unit.x - Math.cos(unit.angle) * (size * 0.4 + tailLen);
                    const tipY = unit.y - Math.sin(unit.angle) * (size * 0.4 + tailLen);
                    const perpX = -Math.sin(unit.angle) * tailWidth;
                    const perpY = Math.cos(unit.angle) * tailWidth;

                    ctx.moveTo(backX + perpX, backY + perpY);
                    ctx.lineTo(tipX, tipY);
                    ctx.lineTo(backX - perpX, backY - perpY);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();

                    // 2. 离子尾迹：半透明蓝色拖尾，持续0.5秒
                    const ionKey = `ion_${Math.round(tailLen)}_${Math.round(unit.angle * 10)}_${trailAlpha.toFixed(2)}`;
                    const ionGradient = this._getCachedGradient(ionKey, () => {
                        const g = ctx.createLinearGradient(unit.x, unit.y, backX, backY);
                        g.addColorStop(0, `rgba(147, 197, 253, ${0.25 * trailAlpha})`);
                        g.addColorStop(1, 'rgba(147, 197, 253, 0)');
                        return g;
                    });

                    ctx.strokeStyle = ionGradient;
                    ctx.lineWidth = tailWidth * 0.6;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(unit.x, unit.y);
                    ctx.lineTo(backX - Math.cos(unit.angle) * tailLen * 0.5, backY - Math.sin(unit.angle) * tailLen * 0.5);
                    ctx.stroke();
                }
            }

            // 护盾能量环：半透明蓝色六边形
            if (fancyAlphaPlayer > 0 && unit.shield > 0.1) {
                const shieldRatio = unit.shield / unit.maxShield;
                const hexRadius = size * 0.85;
                const hexAlpha = (0.3 + shieldRatio * 0.3) * fancyAlphaPlayer;

                ctx.save();
                ctx.strokeStyle = `rgba(96, 165, 250, ${hexAlpha})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2 + this.animations.basePulse * 0.5;
                    const hx = unit.x + Math.cos(angle) * hexRadius;
                    const hy = unit.y + Math.sin(angle) * hexRadius;
                    if (i === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.stroke();

                // 护盾填充
                ctx.fillStyle = `rgba(96, 165, 250, ${hexAlpha * 0.2})`;
                ctx.fill();

                // 护盾受击涟漪
                if (unit.shieldHitTimer > 0) {
                    const hitProgress = 1 - (unit.shieldHitTimer / 0.3);
                    const hitRadius = hexRadius + hitProgress * 15;
                    const hitAlpha = unit.shieldHitTimer / 0.3 * 0.6 * fancyAlphaPlayer;
                    ctx.strokeStyle = `rgba(147, 197, 253, ${hitAlpha})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const angle = (i / 6) * Math.PI * 2;
                        const hx = unit.x + Math.cos(angle) * hitRadius;
                        const hy = unit.y + Math.sin(angle) * hitRadius;
                        if (i === 0) ctx.moveTo(hx, hy);
                        else ctx.lineTo(hx, hy);
                    }
                    ctx.closePath();
                    ctx.stroke();
                }
                ctx.restore();
            }

            if (unit.type === 'engineer') {
                ctx.save();
                ctx.translate(unit.x, unit.y);
                ctx.rotate(unit.angle + Math.PI / 2);
                ctx.fillStyle = '#3b82f6';
                ctx.beginPath();
                ctx.moveTo(0, -size / 2);
                ctx.lineTo(size / 2, 0);
                ctx.lineTo(0, size / 2);
                ctx.lineTo(-size / 2, 0);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#93c5fd';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();
                if (unit.state === 'collecting') {
                    const collectPulse = Math.sin(this.animations.zonePulse * 3) * 0.3 + 0.7;
                    ctx.strokeStyle = '#fbbf24';
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = collectPulse;
                    ctx.beginPath();
                    ctx.arc(unit.x, unit.y, size * 0.8, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
                if (unit.state === 'building' && unit.buildTimer !== undefined) {
                    const buildProgress = 1 - (unit.buildTimer / 5);
                    const barW = size * 1.5;
                    const barH = 4;
                    const barX = unit.x - barW / 2;
                    const barY = unit.y - size / 2 - 12;
                    ctx.fillStyle = colors.border;
                    ctx.fillRect(barX, barY, barW, barH);
                    ctx.fillStyle = '#fbbf24';
                    ctx.fillRect(barX, barY, barW * buildProgress, barH);
                }
                if (unit.storage > 0 && unit.maxStorage > 0) {
                    const storageRatio = unit.storage / unit.maxStorage;
                    const barW = size * 1.2;
                    const barH = 3;
                    const barX = unit.x - barW / 2;
                    const barY = unit.y + size / 2 + 6;
                    ctx.fillStyle = colors.border;
                    ctx.fillRect(barX, barY, barW, barH);
                    ctx.fillStyle = '#22c55e';
                    ctx.fillRect(barX, barY, barW * storageRatio, barH);
                }
            } else {
                const unitImg = unit.type === 'battleship' ? battleshipImg : fighterImg;
                if (unitImg) {
                    ctx.save();
                    ctx.translate(unit.x, unit.y);
                    ctx.rotate(unit.angle + Math.PI / 2);
                    ctx.drawImage(unitImg, -size / 2, -size / 2, size, size);
                    ctx.restore();
                } else {
                    ctx.save();
                    ctx.translate(unit.x, unit.y);
                    ctx.rotate(unit.angle + Math.PI / 2);
                    ctx.fillStyle = colors.primary;
                    ctx.fillRect(-size / 2, -size / 2, size, size);
                    ctx.strokeStyle = colors.borderHover;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(-size / 2, -size / 2, size, size);
                    ctx.restore();
                }
            }

            if (unit.type === 'battleship' && unit.artilleryCooldown > 0) {
                const cooldownRatio = unit.artilleryCooldown / (unit.artilleryMaxCooldown || 10);
                const cdRadius = 12;
                const cdX = unit.x;
                const cdY = unit.y - size / 2 - 16;

                ctx.fillStyle = '#374151';
                ctx.beginPath();
                ctx.arc(cdX, cdY, cdRadius, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = '#f97316';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cdX, cdY, cdRadius, -Math.PI / 2, -Math.PI / 2 + (1 - cooldownRatio) * Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(Math.ceil(unit.artilleryCooldown), cdX, cdY);
            }

            if (unit.shield > 0.1) {
                const shieldRatio = unit.shield / unit.maxShield;
                ctx.fillStyle = colors.shieldBar;
                ctx.globalAlpha = 0.6;
                ctx.fillRect(x, y - 8, size * shieldRatio, 4);
                ctx.globalAlpha = 1;
            }

            const hpRatio = unit.hp / unit.maxHp;
            ctx.fillStyle = colors.border;
            ctx.fillRect(x, y - 4, size, 4);
            ctx.fillStyle = hpRatio > 0.5 ? colors.success : hpRatio > 0.25 ? colors.warning : colors.danger;
            ctx.fillRect(x, y - 4, size * hpRatio, 4);

            ctx.fillStyle = colors.text;
            ctx.font = this.theme.fonts.small;
            ctx.textAlign = 'center';
            ctx.fillText(unit.name, unit.x, y + size + 12);
        }

        ctx.textAlign = 'left';
    }

    _renderArtilleryStrikes() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        if (!this.gameCore) return;
        
        const strikes = this.gameCore.getArtilleryStrikes();
        const time = this.animations.zonePulse;

        const mergeThreshold = 30;
        const groups = [];
        for (const strike of strikes) {
            let merged = false;
            for (const group of groups) {
                const dx = group.targetX - strike.targetX;
                const dy = group.targetY - strike.targetY;
                if (Math.sqrt(dx * dx + dy * dy) < mergeThreshold) {
                    group.strikes.push(strike);
                    merged = true;
                    break;
                }
            }
            if (!merged) {
                groups.push({
                    targetX: strike.targetX,
                    targetY: strike.targetY,
                    strikes: [strike]
                });
            }
        }

        for (const group of groups) {
            const count = group.strikes.length;
            const primary = group.strikes[0];
            const radius = primary.radius;

            ctx.save();

            const warningPulse = Math.sin(time * 5) * 0.3 + 0.7;

            const hasWarning = group.strikes.some(s => s.phase === 'warning' || s.phase === 'impact');
            if (hasWarning) {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = count > 1 ? 3 : 2;
                ctx.globalAlpha = warningPulse;
                ctx.setLineDash([8, 8]);
                ctx.beginPath();
                ctx.arc(group.targetX, group.targetY, radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);

                if (count > 1) {
                    ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = warningPulse * 0.5;
                    ctx.beginPath();
                    ctx.arc(group.targetX, group.targetY, radius + 8, 0, Math.PI * 2);
                    ctx.stroke();
                }

                let minRemaining = Infinity;
                for (const s of group.strikes) {
                    const nextStrikeTime = (s.currentRound + 1) * s.interval;
                    const remaining = Math.max(0, nextStrikeTime - s.timer);
                    if (remaining < minRemaining) minRemaining = remaining;
                }

                ctx.globalAlpha = 1;
                ctx.fillStyle = '#ef4444';
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(minRemaining.toFixed(1), group.targetX, group.targetY - (count > 1 ? 10 : 0));

                if (count > 1) {
                    const countBgW = 28;
                    const countBgH = 18;
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
                    ctx.beginPath();
                    ctx.roundRect(group.targetX - countBgW / 2, group.targetY + 4, countBgW, countBgH, 4);
                    ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 12px sans-serif';
                    ctx.fillText('x' + count, group.targetX, group.targetY + 4 + countBgH / 2);
                }
            }

            for (const strike of group.strikes) {
                if (strike.phase === 'impact' && strike.impactTimer !== undefined && strike.impactTimer < 0.5) {
                    const impactProgress = strike.impactTimer / 0.5;
                    const impactRadius = radius * (0.5 + impactProgress * 0.8);
                    const impactAlpha = 1 - impactProgress;

                    ctx.strokeStyle = '#f97316';
                    ctx.lineWidth = 4;
                    ctx.globalAlpha = impactAlpha;
                    ctx.beginPath();
                    ctx.arc(group.targetX, group.targetY, impactRadius, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.strokeStyle = '#fbbf24';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(group.targetX, group.targetY, impactRadius * 0.7, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }

            ctx.restore();
        }
    }

    _renderCommandIndicators() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const isPlayer2 = this.gameCore.isMultiplayer && this.gameCore.playerTeam === 'player2';
        const myUnits = isPlayer2 ? this.gameCore.enemyUnits : this.gameCore.units;

        // 基于 patrolTaskGroups 渲染巡逻虚线，避免同一任务组重复渲染
        const renderedTaskIds = new Set();
        if (this.gameCore.patrolTaskGroups) {
            for (const group of this.gameCore.patrolTaskGroups) {
                if (renderedTaskIds.has(group.taskId)) continue;
                renderedTaskIds.add(group.taskId);

                // 只渲染还有活跃单位的任务组
                const hasActive = group.units.some(t => t.status === 'patrolling' || t.status === 'waiting');
                if (!hasActive || !group.waypoints || group.waypoints.length < 2) continue;

                ctx.strokeStyle = colors.warning;
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(group.waypoints[0].x, group.waypoints[0].y);
                for (let i = 1; i < group.waypoints.length; i++) {
                    ctx.lineTo(group.waypoints[i].x, group.waypoints[i].y);
                }
                ctx.stroke();
                ctx.setLineDash([]);

                // 巡逻点标记
                for (const pt of group.waypoints) {
                    ctx.fillStyle = colors.warning;
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                }

            }
        }

        for (const unit of myUnits) {
            if (unit.hp <= 0) continue;

            // 移动/撤退目标点
            if ((unit.state === 'move' || unit.state === 'retreat') && unit.targetX !== null) {
                ctx.strokeStyle = unit.retreating ? colors.warning : colors.primary;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(unit.targetX, unit.targetY, 6, 0, Math.PI * 2);
                ctx.stroke();

                // 绘制连线
                ctx.setLineDash([4, 4]);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(unit.x, unit.y);
                ctx.lineTo(unit.targetX, unit.targetY);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // 攻击目标连线
            if (unit.state === 'attack' && unit.targetUnit && unit.targetUnit.hp > 0) {
                ctx.strokeStyle = colors.danger;
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(unit.x, unit.y);
                ctx.lineTo(unit.targetUnit.x, unit.targetUnit.y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }

    _renderGameOver() {
        const ctx = this.ctx;
        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);
        const colors = this.theme.colors;

        // 半透明背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, w, h);

        const isVictory = this.gameCore && this.gameCore.winner === 'player';

        // 标题
        ctx.fillStyle = isVictory ? colors.success : colors.danger;
        ctx.font = 'bold 48px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isVictory ? '胜利！' : '失败！', w / 2, h / 2 - 60);

        // 统计信息
        ctx.fillStyle = colors.text;
        ctx.font = this.theme.fonts.menu;
        const stats = this.gameCore ? this.gameCore.stats : {};
        ctx.fillText(`游戏时间: ${Math.floor(this.gameCore.gameTime)}秒`, w / 2, h / 2);
        ctx.fillText(`己方损失: ${stats.playerUnitsLost || 0} 单位`, w / 2, h / 2 + 40);
        ctx.fillText(`敌方损失: ${stats.enemyUnitsLost || 0} 单位`, w / 2, h / 2 + 80);

        // 提示文字
        ctx.fillStyle = colors.textMuted;
        ctx.font = this.theme.fonts.hud;
        ctx.fillText('点击"开始游戏"重新开始', w / 2, h / 2 + 140);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // 渲染菜单
        this.menuSystem.render();
    }

    _renderWaitingAreas() {
        if (!this.gameCore || !this.gameCore.patrolTaskGroups) return;
        const ctx = this.ctx;

        for (const group of this.gameCore.patrolTaskGroups) {
            if (!group.waitingArea || !group.waitingArea.enabled) continue;

            const wa = group.waitingArea;
            const screenPos = this.gameCore.worldToScreen(wa.centerX, wa.centerY);
            const radius = wa.radius * this.gameCore.camera.zoom;

            ctx.save();
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
            ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);

            // 绘制圆形
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 绘制中心点
            ctx.fillStyle = 'rgba(168, 85, 247, 0.8)';
            ctx.beginPath();
            ctx.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
            ctx.fill();

            // 显示等待区单位数量
            const count = wa.units.length;
            if (count > 0) {
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${count}`, screenPos.x, screenPos.y);
            }

            ctx.restore();
        }
    }

    _renderFPS() {
        const ctx = this.ctx;
        const colors = this.theme.colors;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(10, 50, 80, 28);
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(10, 50, 80, 28);

        ctx.fillStyle = colors.text;
        ctx.font = this.theme.fonts.hud;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`FPS: ${this._currentFPS}`, 50, 64);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    toggleConsole() {
        this.consoleOpen = !this.consoleOpen;
        if (this.consoleOpen) {
            this.menuSystem.inputDisabled = true;
        } else {
            if (!this.settingsOpen) {
                this.menuSystem.inputDisabled = false;
            }
            this.consoleInput = '';
        }
    }

    _renderConsole() {
        const ctx = this.ctx;
        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.width / dpr;
        const h = this.canvas.height / dpr;
        const colors = this.theme.colors;
        const progress = this.consoleAnimProgress;
        if (progress <= 0) return;

        const panelW = 560;
        const panelH = 320;
        const panelX = (w - panelW) / 2;
        const panelY = h - panelH - 60;

        const easedOpen = 1 - Math.pow(1 - progress, 3);
        const currentH = panelH * easedOpen;
        const currentY = panelY + panelH - currentH;
        const currentAlpha = easedOpen;

        ctx.save();
        ctx.globalAlpha = currentAlpha;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(2, 6, 23, 0.96)';
        ctx.fillRect(panelX, currentY, panelW, currentH);

        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX, currentY, panelW, currentH);

        ctx.strokeStyle = 'rgba(14, 165, 233, 0.3)';
        ctx.lineWidth = 3;
        ctx.strokeRect(panelX - 2, currentY - 2, panelW + 4, currentH + 4);

        if (progress > 0.3) {
            const innerAlpha = Math.min(1, (progress - 0.3) / 0.4);
            ctx.globalAlpha = innerAlpha * currentAlpha;

            const headerH = 32;
            ctx.fillStyle = 'rgba(14, 165, 233, 0.12)';
            ctx.fillRect(panelX + 1, currentY + 1, panelW - 2, headerH);

            ctx.fillStyle = '#0ea5e9';
            ctx.fillRect(panelX + 1, currentY + headerH, panelW - 2, 1);

            ctx.font = 'bold 13px "Consolas", "Courier New", monospace';
            ctx.fillStyle = '#0ea5e9';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('◆ COMMAND TERMINAL v2.1', panelX + 14, currentY + headerH / 2);

            const statusDot = this.consoleOpen ? '#22c55e' : '#ef4444';
            ctx.fillStyle = statusDot;
            ctx.beginPath();
            ctx.arc(panelX + panelW - 20, currentY + headerH / 2, 4, 0, Math.PI * 2);
            ctx.fill();

            const scanY = currentY + (this.consoleScanOffset % currentH);
            const scanGrad = ctx.createLinearGradient(panelX, scanY - 15, panelX, scanY + 15);
            scanGrad.addColorStop(0, 'rgba(14, 165, 233, 0)');
            scanGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.06)');
            scanGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
            ctx.fillStyle = scanGrad;
            ctx.fillRect(panelX + 1, scanY - 15, panelW - 2, 30);

            const contentY = currentY + headerH + 8;
            const contentH = currentH - headerH - 48;
            const lineH = 18;
            const maxLines = Math.floor(contentH / lineH);
            const visibleHistory = this.consoleHistory.slice(-maxLines);

            ctx.font = '13px "Consolas", "Courier New", monospace';
            ctx.textBaseline = 'top';

            for (let i = 0; i < visibleHistory.length; i++) {
                const entry = visibleHistory[i];
                const lineY = contentY + i * lineH;
                if (lineY + lineH > currentY + currentH - 44) break;

                if (entry.type === 'input') {
                    ctx.fillStyle = '#94a3b8';
                    ctx.fillText('> ' + entry.text, panelX + 14, lineY);
                } else if (entry.type === 'success') {
                    ctx.fillStyle = '#22c55e';
                    ctx.fillText('  ✓ ' + entry.text, panelX + 14, lineY);
                } else if (entry.type === 'error') {
                    ctx.fillStyle = '#ef4444';
                    ctx.fillText('  ✗ ' + entry.text, panelX + 14, lineY);
                } else {
                    ctx.fillStyle = '#64748b';
                    ctx.fillText('  ' + entry.text, panelX + 14, lineY);
                }
            }

            const inputY = currentY + currentH - 36;
            ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';
            ctx.fillRect(panelX + 1, inputY - 4, panelW - 2, 32);

            ctx.fillStyle = '#0ea5e9';
            ctx.font = 'bold 13px "Consolas", "Courier New", monospace';
            ctx.fillText('>', panelX + 14, inputY + 4);

            ctx.fillStyle = '#e2e8f0';
            ctx.font = '13px "Consolas", "Courier New", monospace';
            ctx.fillText(this.consoleInput, panelX + 30, inputY + 4);

            const cursorVisible = Math.floor(this.consoleCursorBlink / 530) % 2 === 0;
            if (cursorVisible && this.consoleOpen) {
                const textWidth = ctx.measureText(this.consoleInput).width;
                ctx.fillStyle = '#0ea5e9';
                ctx.fillRect(panelX + 30 + textWidth + 1, inputY + 3, 8, 15);
            }

            ctx.fillStyle = 'rgba(14, 165, 233, 0.5)';
            ctx.font = '11px "Consolas", "Courier New", monospace';
            ctx.textAlign = 'right';
            ctx.fillText('按 · 关闭 | timespeed [n] | check | stop | start | restart', panelX + panelW - 14, inputY + 6);
            ctx.textAlign = 'left';
        }

        const glowSize = 20 + Math.sin(this.animations.basePulse * 2) * 5;
        const topGlow = ctx.createLinearGradient(panelX, currentY - glowSize, panelX, currentY);
        topGlow.addColorStop(0, 'rgba(14, 165, 233, 0)');
        topGlow.addColorStop(1, 'rgba(14, 165, 233, 0.15)');
        ctx.fillStyle = topGlow;
        ctx.fillRect(panelX, currentY - glowSize, panelW, glowSize);

        ctx.restore();
    }

    destroy() {
        this.stop();
        window.removeEventListener('resize', this._resizeHandler);
        this.input.destroy();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
}
