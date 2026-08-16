/**
 * main.js - 游戏入口文件
 * 初始化UIManager并启动游戏循环
 */

(async function() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('[Main] Canvas element not found');
        return;
    }

    // ========== 性能监控 ==========
    const performanceMonitor = {
        frameCount: 0,
        lastTime: performance.now(),
        fps: 0,
        memoryUsage: 0,
        gcCount: 0,

        update() {
            this.frameCount++;
            const now = performance.now();
            if (now - this.lastTime >= 1000) {
                this.fps = this.frameCount;
                this.frameCount = 0;
                this.lastTime = now;

                // 获取内存使用情况（如果可用）
                if (performance.memory) {
                    this.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1048576);
                }
            }
        },

        log() {
            if (this.frameCount % 300 === 0) { // 每5秒记录一次
                console.log(`[Performance] FPS: ${this.fps}, Memory: ${this.memoryUsage}MB`);
            }
        }
    };

    // ========== 内存管理器 ==========
    const memoryManager = {
        objectPools: new Map(),
        activeObjects: new Set(),
        gcThreshold: 100, // 对象池大小阈值

        // 获取对象池中的对象
        acquire(type, factory) {
            if (!this.objectPools.has(type)) {
                this.objectPools.set(type, []);
            }
            const pool = this.objectPools.get(type);
            let obj;
            if (pool.length > 0) {
                obj = pool.pop();
            } else {
                obj = factory();
            }
            this.activeObjects.add(obj);
            return obj;
        },

        // 归还对象到对象池
        release(type, obj) {
            this.activeObjects.delete(obj);
            if (!this.objectPools.has(type)) {
                this.objectPools.set(type, []);
            }
            const pool = this.objectPools.get(type);
            // 限制池大小
            if (pool.length < this.gcThreshold) {
                // 重置对象状态
                if (obj.reset) obj.reset();
                pool.push(obj);
            }
        },

        // 清理对象池
        clearPool(type) {
            if (this.objectPools.has(type)) {
                this.objectPools.set(type, []);
            }
        },

        // 获取统计信息
        getStats() {
            const stats = {};
            for (const [type, pool] of this.objectPools.entries()) {
                stats[type] = pool.length;
            }
            return {
                pools: stats,
                activeObjects: this.activeObjects.size
            };
        }
    };

    // ========== 批量渲染管理器 ==========
    const batchRenderer = {
        batches: new Map(),
        maxBatchSize: 100,

        // 添加渲染命令
        add(key, renderFn) {
            if (!this.batches.has(key)) {
                this.batches.set(key, []);
            }
            const batch = this.batches.get(key);
            batch.push(renderFn);

            // 达到批次大小时执行
            if (batch.length >= this.maxBatchSize) {
                this.execute(key);
            }
        },

        // 执行特定批次的渲染
        execute(key) {
            if (!this.batches.has(key)) return;
            const batch = this.batches.get(key);
            if (batch.length === 0) return;

            // 批量执行渲染命令
            for (const fn of batch) {
                fn();
            }
            batch.length = 0; // 清空批次
        },

        // 执行所有批次
        executeAll() {
            for (const key of this.batches.keys()) {
                this.execute(key);
            }
        },

        // 清空所有批次
        clear() {
            this.batches.clear();
        }
    };

    // ========== 资源预加载优化 ==========
    const resourcePreloader = {
        async preloadAll(uiManager) {
            const resources = {
                'menuBg': 'main_menu.jpg',
                'panelBg': 'dialog_interface.jpg',
                'fighter': 'fight_airplane.png',
                'battleship': 'warship.png',
                'asteroidBelt': 'asteroid_resource_belt.jpg'
            };

            console.log('[ResourcePreloader] Starting resource preloading...');
            const startTime = performance.now();

            await uiManager.resourceManager.preload(resources, (loaded, total) => {
                const progress = Math.round((loaded / total) * 100);
                console.log(`[ResourcePreloader] Progress: ${progress}% (${loaded}/${total})`);
            });

            const elapsed = Math.round(performance.now() - startTime);
            console.log(`[ResourcePreloader] Preloading completed in ${elapsed}ms`);

            // 输出资源统计
            const stats = uiManager.resourceManager.getStats();
            console.log('[ResourcePreloader] Resource stats:', stats);
        }
    };

    // 加载画面控制
    const loading = window.loadingScreen;

    // 阶段1: 初始化UI管理器
    loading.setProgress(10, '正在初始化界面系统');
    const uiManager = new UIManager(canvas);
    await uiManager.init();
    await new Promise(r => setTimeout(r, 200));

    // 阶段2: 预加载资源（使用优化后的预加载器）
    loading.setProgress(30, '正在加载游戏资源');
    await resourcePreloader.preloadAll(uiManager);
    await new Promise(r => setTimeout(r, 200));

    const menuBg = uiManager.resourceManager.get('menuBg');
    if (menuBg) uiManager.menuSystem.setBgImage(menuBg);

    const panelBg = uiManager.resourceManager.get('panelBg');
    if (panelBg) uiManager.hudSystem.setPanelBgImage(panelBg);

    // 阶段3: 初始化游戏核心和音乐系统
    loading.setProgress(60, '正在初始化游戏核心');
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const gameCore = new GameCore();
    gameCore.init(w, h);
    await new Promise(r => setTimeout(r, 200));

    // 初始化音乐管理器（在加载界面初始化）
    loading.setProgress(65, '正在初始化音乐系统');
    const musicManager = new MusicManager();
    musicManager.init('music/normal.mp3', 'music/fight.mp3');
    window.musicManager = musicManager; // 暴露到全局以便设置面板访问
    await new Promise(r => setTimeout(r, 100));

    let mailSystem = null;
    if (typeof MailSystem !== 'undefined') {
        mailSystem = new MailSystem();
        uiManager.hudSystem.setMailSystem(mailSystem);
        console.log('[Main] 邮件系统已初始化');
    } else {
        console.warn('[Main] MailSystem not available');
    }

    // ================== 账户系统与数据同步 ==================
    const ACCOUNT_TOKEN_KEY = 'stellar_strategy_account_token';
    const ACCOUNT_USER_KEY = 'stellar_strategy_account_user';

    let ACCOUNT_API_URL = 'http://localhost:3001';
    let serverConfig = null;

    async function loadServerConfig() {
        const CONFIG_CACHE_KEY = 'stellar_strategy_server_config';
        const CONFIG_CACHE_TTL = 300000;

        function applyConfig(config) {
            if (config.accountServer) {
                ACCOUNT_API_URL = config.accountServer;
                console.log('[Main] 服务器配置已加载，账户服务端:', ACCOUNT_API_URL);
            }
            if (config.signalingServer) {
                try {
                    const sigUrl = new URL(config.signalingServer);
                    const sigPort = config.signalingPort || sigUrl.port || (sigUrl.protocol === 'https:' ? '443' : '80');
                    if (typeof networkManager !== 'undefined' && networkManager) {
                        networkManager.setSignalingUrl(config.signalingServer, sigPort);
                    }
                    if (uiManager && uiManager.menuSystem) {
                        uiManager.menuSystem.ipInput = sigUrl.hostname;
                        uiManager.menuSystem.portInput = sigPort;
                    }
                    console.log('[Main] 服务器配置已加载，信令服务器:', config.signalingServer);
                } catch (urlErr) {
                    console.error('[Main] 信令服务器URL解析失败:', urlErr);
                    if (typeof networkManager !== 'undefined' && networkManager) {
                        networkManager.setSignalingUrl('localhost', '3001');
                    }
                    if (uiManager && uiManager.menuSystem) {
                        uiManager.menuSystem.ipInput = 'localhost';
                        uiManager.menuSystem.portInput = '3001';
                    }
                }
            }
            serverConfig = config;
        }

        function applyDefaults() {
            if (typeof networkManager !== 'undefined' && networkManager) {
                networkManager.setSignalingUrl('localhost', '3001');
            }
            if (uiManager && uiManager.menuSystem) {
                uiManager.menuSystem.ipInput = 'localhost';
                uiManager.menuSystem.portInput = '3001';
            }
        }

        try {
            const cached = localStorage.getItem(CONFIG_CACHE_KEY);
            if (cached) {
                try {
                    const { config: cachedConfig, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CONFIG_CACHE_TTL) {
                        applyConfig(cachedConfig);
                        console.log('[Main] 使用缓存的服务器配置');
                    }
                } catch (e) {}
            }

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3000);
            const res = await fetch('server-config.json', { signal: controller.signal });
            clearTimeout(timer);

            if (res.ok) {
                const config = await res.json();
                applyConfig(config);
                try {
                    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({
                        config,
                        timestamp: Date.now()
                    }));
                } catch (e) {}
                return config;
            }
        } catch (err) {
            console.log('[Main] 未找到服务器配置文件，使用默认地址');
            if (!serverConfig) {
                applyDefaults();
            }
        }
        return null;
    }

    // 玩家数据同步管理 - 所有数据保存在服务端，客户端仅做展示
    let playerDataSync = {
        enabled: false,
        interval: null,
        lastSyncTime: 0
    };

    async function loadPlayerDataFromServer() {
        const token = localStorage.getItem(ACCOUNT_TOKEN_KEY);
        if (!token) return null;
        try {
            const res = await fetch(`${ACCOUNT_API_URL}/api/player/data?token=${token}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.data) {
                    return data.data;
                }
            }
        } catch (err) {
            console.error('[Main] 从服务端加载玩家数据失败:', err);
        }
        return null;
    }

    async function saveProximaCoinToServer(proximaCoin) {
        const token = localStorage.getItem(ACCOUNT_TOKEN_KEY);
        if (!token) return false;
        const maxRetries = 2;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const res = await fetch(`${ACCOUNT_API_URL}/api/player/data?token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ proximaCoin })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) return true;
                    console.warn('[Main] 同步比邻星币到服务端失败:', data.error || '未知错误');
                } else {
                    console.warn('[Main] 同步比邻星币到服务端失败，HTTP状态:', res.status);
                }
            } catch (err) {
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 1000));
                } else {
                    console.warn('[Main] 同步比邻星币到服务端失败:', err.message);
                }
            }
        }
        return false;
    }

    async function loadMailsFromServer() {
        const token = localStorage.getItem(ACCOUNT_TOKEN_KEY);
        try {
            const url = token
                ? `${ACCOUNT_API_URL}/api/mails?token=${token}`
                : `${ACCOUNT_API_URL}/api/mails`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.success && mailSystem) {
                    mailSystem.clearAll();
                    const mails = data.mails || [];
                    const mailStates = data.mailStates || {};
                    for (const mail of mails) {
                        const state = mailStates[mail.id];
                        const entry = {
                            id: mail.id,
                            type: 'official',
                            title: mail.title || '官方消息',
                            content: mail.content || '',
                            data: { timestamp: mail.timestamp },
                            read: state ? state.read : false,
                            claimed: state ? state.claimed : false
                        };
                        const giftAmount = mailSystem.parseGiftCommand(mail.content || '');
                        entry.attachment = mail.attachment || (giftAmount !== null ? { type: 'proximaCoin', amount: giftAmount } : null);
                        mailSystem.mails.push(entry);
                    }
                    mailSystem.mails.sort((a, b) => {
                        const ta = a.data && a.data.timestamp ? a.data.timestamp : 0;
                        const tb = b.data && b.data.timestamp ? b.data.timestamp : 0;
                        return tb - ta;
                    });
                    mailSystem.unreadCount = mailSystem.mails.filter(m => !m.read).length;
                    console.log(`[Main] 从服务端加载了 ${mails.length} 封邮件`);
                }
            }
        } catch (err) {
            console.error('[Main] 从服务端加载邮件失败:', err);
        }
    }

    async function claimMailAttachment(mailId) {
        const token = localStorage.getItem(ACCOUNT_TOKEN_KEY);
        if (!token) return { success: false };
        try {
            const res = await fetch(`${ACCOUNT_API_URL}/api/mails/claim?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mailId })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && gameCore) {
                    gameCore.resources.proximaCoin = data.proximaCoin;
                }
                return data;
            }
        } catch (err) {
            console.error('[Main] 领取邮件附件失败:', err);
        }
        return { success: false };
    }

    async function markMailAsRead(mailId) {
        const token = localStorage.getItem(ACCOUNT_TOKEN_KEY);
        if (!token) return;
        try {
            await fetch(`${ACCOUNT_API_URL}/api/mails/read?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mailId })
            });
        } catch (err) {
            console.error('[Main] 标记邮件已读失败:', err);
        }
    }

    async function markAllMailsAsRead() {
        const token = localStorage.getItem(ACCOUNT_TOKEN_KEY);
        if (!token) return;
        try {
            await fetch(`${ACCOUNT_API_URL}/api/mails/readall?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (err) {
            console.error('[Main] 标记所有邮件已读失败:', err);
        }
    }

    function startDataSync() {
        if (playerDataSync.interval) return;
        playerDataSync.enabled = true;
        let lastSyncedCoin = -1;
        playerDataSync.interval = setInterval(async () => {
            if (gameCore) {
                const currentCoin = gameCore.resources.proximaCoin;
                if (currentCoin !== lastSyncedCoin) {
                    const success = await saveProximaCoinToServer(currentCoin);
                    if (success) {
                        lastSyncedCoin = currentCoin;
                    }
                }
            }
        }, 10000);
        console.log('[Main] 玩家数据同步已启动（每10秒）');
    }

    function stopDataSync() {
        if (playerDataSync.interval) {
            clearInterval(playerDataSync.interval);
            playerDataSync.interval = null;
        }
        playerDataSync.enabled = false;
        console.log('[Main] 玩家数据同步已停止');
    }

    uiManager.setGameCore(gameCore);

    musicManager.start();

    uiManager.onLoadingComplete = function() {
        console.log('[Main] 加载完成，游戏启动');
    };

    gameCore.onProximaCoinChange = (newAmount) => {
        if (playerDataSync.enabled) {
            saveProximaCoinToServer(newAmount);
        }
    };

    async function checkAccountSession() {
        const token = localStorage.getItem(ACCOUNT_TOKEN_KEY);
        if (!token) return;
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${ACCOUNT_API_URL}/api/me?token=${token}`, {
                signal: controller.signal
            });
            clearTimeout(timer);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    uiManager.menuSystem.isLoggedIn = true;
                    uiManager.menuSystem.currentUser = { username: data.username };
                    const playerData = await loadPlayerDataFromServer();
                    if (playerData) {
                        if (playerData.proximaCoin !== undefined && gameCore) {
                            gameCore.resources.proximaCoin = playerData.proximaCoin;
                        }
                        console.log('[Main] 玩家数据已加载');
                    }
                    await loadMailsFromServer();
                    startDataSync();
                }
            } else {
                localStorage.removeItem(ACCOUNT_TOKEN_KEY);
                localStorage.removeItem(ACCOUNT_USER_KEY);
            }
        } catch (err) {
            console.log('[Main] 检查账户会话失败（服务器不可达）:', err.message || err);
        }
    }
    await checkAccountSession();

    uiManager.menuSystem.onLogin = async (username, password) => {
        try {
            const res = await fetch(`${ACCOUNT_API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                localStorage.setItem(ACCOUNT_TOKEN_KEY, data.token);
                localStorage.setItem(ACCOUNT_USER_KEY, JSON.stringify({ username: data.username }));
                uiManager.menuSystem.isLoggedIn = true;
                uiManager.menuSystem.currentUser = { username: data.username };
                uiManager.menuSystem.accountPanelView = 'profile';
                uiManager.menuSystem.accountErrorMsg = '';
                uiManager.menuSystem.accountInputs.loginUsername = '';
                uiManager.menuSystem.accountInputs.loginPassword = '';
                const playerData = await loadPlayerDataFromServer();
                if (playerData && playerData.proximaCoin !== undefined && gameCore) {
                    gameCore.resources.proximaCoin = playerData.proximaCoin;
                }
                await loadMailsFromServer();
                startDataSync();
            } else {
                uiManager.menuSystem.accountErrorMsg = data.error || '登录失败';
            }
        } catch (err) {
            console.error('[Main] 登录请求失败:', err);
            uiManager.menuSystem.accountErrorMsg = '网络错误，请稍后重试';
        }
    };

    uiManager.menuSystem.onRegister = async (username, password) => {
        try {
            const res = await fetch(`${ACCOUNT_API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                localStorage.setItem(ACCOUNT_TOKEN_KEY, data.token);
                localStorage.setItem(ACCOUNT_USER_KEY, JSON.stringify({ username: data.username }));
                uiManager.menuSystem.isLoggedIn = true;
                uiManager.menuSystem.currentUser = { username: data.username };
                uiManager.menuSystem.accountPanelView = 'profile';
                uiManager.menuSystem.accountErrorMsg = '';
                uiManager.menuSystem.accountInputs.regUsername = '';
                uiManager.menuSystem.accountInputs.regPassword = '';
                uiManager.menuSystem.accountInputs.regConfirmPassword = '';
                uiManager.menuSystem.accountInputs.regCaptcha = '';
                if (gameCore) {
                    saveProximaCoinToServer(gameCore.resources.proximaCoin);
                }
                await loadMailsFromServer();
                startDataSync();
            } else {
                uiManager.menuSystem.accountErrorMsg = data.error || '注册失败';
            }
        } catch (err) {
            console.error('[Main] 注册请求失败:', err);
            uiManager.menuSystem.accountErrorMsg = '网络错误，请稍后重试';
        }
    };

    uiManager.menuSystem.onLogout = async () => {
        if (gameCore && gameCore.resources.proximaCoin > 0) {
            await saveProximaCoinToServer(gameCore.resources.proximaCoin);
        }
        stopDataSync();
        localStorage.removeItem(ACCOUNT_TOKEN_KEY);
        localStorage.removeItem(ACCOUNT_USER_KEY);
        uiManager.menuSystem.isLoggedIn = false;
        uiManager.menuSystem.currentUser = null;
        uiManager.menuSystem.showAccountPanel = false;
        uiManager.menuSystem.accountPanelView = 'login';
        if (mailSystem) {
            mailSystem.clearAll();
        }
    };

    uiManager.onReturnToMenu = () => {
        if (networkSyncInterval) {
            clearInterval(networkSyncInterval);
            networkSyncInterval = null;
        }
        if (isMultiplayer && networkManager.connected) {
            networkManager.send({ type: 'player_leave' }, true);
        }
        if (gameCore && gameCore.resources.proximaCoin > 0) {
            saveProximaCoinToServer(gameCore.resources.proximaCoin);
        }
        if (gameCore) gameCore.reset();
        uiManager.setGameState('MENU');
        isMultiplayer = false;
        opponentDisconnected = false;
        disconnectCountdown = 0;
    };
    // ================== 账户系统结束 ==================

    if (mailSystem) {
        const oldOnMailRead = mailSystem.onMailRead;
        const oldOnAttachmentClaimed = mailSystem.onAttachmentClaimed;

        mailSystem.onMailRead = (mail) => {
            if (oldOnMailRead) oldOnMailRead(mail);
            markMailAsRead(mail.id);
        };
        mailSystem.onAttachmentClaimed = (mailId, amount) => {
            if (oldOnAttachmentClaimed) oldOnAttachmentClaimed(mailId, amount);
            claimMailAttachment(mailId);
        };
    }

    // 重规划失败回调：显示通知
    gameCore.onRerouteFail = (unit) => {
        uiManager.hudSystem.addNotification(`${unit.name}重规划失败！`, '#fbbf24', 3);
    };

    // 战报回调：传递到HUD系统
    gameCore.onBattleReport = (report) => {
        uiManager.hudSystem.addBattleReport(report);
    };

    // 暴露到window对象以便测试和外部调用
    window.uiManager = uiManager;
    window.gameCore = gameCore;
    window.playerDataSync = playerDataSync;
    window.loadPlayerDataFromServer = loadPlayerDataFromServer;
    window.loadMailsFromServer = loadMailsFromServer;
    window.claimMailAttachment = claimMailAttachment;
    window.markMailAsRead = markMailAsRead;
    window.startDataSync = startDataSync;
    window.stopDataSync = stopDataSync;

    uiManager.hudSystem.updateResources(gameCore.resources);
    uiManager.hudSystem.updateMinimapUnits(gameCore.getMinimapUnits());
    uiManager.hudSystem.updateMinimapZones(gameCore.getMinimapZones());
    uiManager.hudSystem.updateMinimapAsteroidBelts(gameCore.getAsteroidBelts());
    uiManager.hudSystem.setCamera(gameCore.camera);

    // 阶段4: 完成加载
    loading.setProgress(90, '正在准备游戏场景');
    await new Promise(r => setTimeout(r, 300));
    loading.setProgress(100, '加载完成');
    loading.complete();

    // ========== 设备模式选择 ==========
    window.deviceMode = 'desktop'; // 默认
    let deviceSelectionResolve = null;
    const deviceSelectionPromise = new Promise((resolve) => {
        deviceSelectionResolve = resolve;
    });

    const deviceSelectScreen = document.getElementById('device-select-screen');
    const deviceCards = deviceSelectScreen.querySelectorAll('.device-card');
    const deviceConfirmBtn = document.getElementById('device-confirm-btn');
    const gameContainer = document.getElementById('game-container');

    // 设备卡片点击事件
    deviceCards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const mode = card.getAttribute('data-mode');
            deviceCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            deviceConfirmBtn.disabled = false;
            window._selectedDeviceMode = mode;
        });
    });

    // 确认按钮点击事件
    deviceConfirmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const mode = window._selectedDeviceMode || 'desktop';
        window.deviceMode = mode;
        deviceSelectScreen.classList.remove('visible');
        // 恢复游戏容器的指针事件
        if (gameContainer) gameContainer.style.pointerEvents = 'auto';
        // 通知 HUDSystem 更新缩放
        if (uiManager && uiManager.hudSystem) {
            if (mode === 'phone') uiManager.hudSystem.setDeviceScale(1.5);
            else if (mode === 'tablet') uiManager.hudSystem.setDeviceScale(1.2);
            else uiManager.hudSystem.setDeviceScale(1.0);
        }
        if (deviceSelectionResolve) deviceSelectionResolve(mode);
    });

    // 显示设备选择面板
    deviceSelectScreen.classList.add('visible');
    // 绘制设备图标替代 emoji
    const deviceIconCanvases = deviceSelectScreen.querySelectorAll('.device-icon-canvas');
    deviceIconCanvases.forEach(canvas => {
        const card = canvas.closest('.device-card');
        const mode = card.getAttribute('data-mode');
        const ctx = canvas.getContext('2d');
        const size = Math.min(canvas.width, canvas.height);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        IconRenderer.drawIcon(ctx, mode, size / 2, size / 2, size * 0.8, '#e2e8f0');
    });
    // 同时禁用游戏容器的所有指针事件，防止鼠标穿透
    if (gameContainer) gameContainer.style.pointerEvents = 'none';
    // 等待用户选择设备模式
    await deviceSelectionPromise;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    // 命令模式状态机
    let commandMode = 'normal';
    let patrolPoints = [];

    const COMMAND_MODE_TEXT = {
        'normal': '',
        'move_target': '选择移动目标位置（左键确认，ESC取消）',
        'attack_target': '选择攻击目标（左键确认，ESC取消）',
        'patrol_point1': '选择巡逻起点（左键确认，ESC取消）',
        'patrol_point2': '选择巡逻终点（左键确认，ESC取消）',
        'attack_base': '点击敌方基地进行攻击（左键确认，ESC取消）',
        'collect_target': '选择要采集的小行星资源带（左键确认，ESC取消）',
        'build_target': '选择前哨站建造位置（左键确认，ESC取消）',
        'blockade_target': '选择要封锁的区域（左键确认，ESC取消）',
        'artillery_target': '选择炮火打击目标区域（左键确认，ESC取消）',
        'waiting_area': '选择等待区位置（滚轮调整大小，左键确认，ESC取消）',
        'patrol_count_select': '选择巡逻单位数量（1-N，ESC取消）'
    };

    function setCommandMode(mode) {
        commandMode = mode;
        window.commandMode = mode; // 暴露到全局供HUDSystem访问
        if (mode !== 'patrol_point2') {
            patrolPoints = [];
        }
    }

    function getCommandModeText() {
        return COMMAND_MODE_TEXT[commandMode] || '';
    }

    // 右键拖拽视角移动
    let isRightMouseDown = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    // 网络管理
    const networkManager = new NetworkManager();
    await loadServerConfig();
    let networkSyncInterval = null;
    let isMultiplayer = false;
    let isHost = false;
    let isServerMode = false;
    let serverGameClient = null;
    let disconnected = false;
    let opponentDisconnected = false;
    let disconnectCountdown = 0;
    let gameSpeed = 1;
    let consoleErrors = [];

    const pingTracker = {
        sent: 0,
        received: 0,
        lastPing: -1,
        pings: [],
        maxSamples: 10,
        checking: false,
        consecutiveFails: 0,
        consecutiveSuccess: 0,
        baseInterval: 3000,
        currentInterval: 3000,
        minInterval: 1500,
        maxInterval: 15000,
        jitter: 0,
        quality: 'unknown',
        lastCheckTime: 0,
        _timerId: null
    };

    function getConnectionQuality(avgPing, loss, jitter) {
        if (avgPing < 0) return 'offline';
        if (loss > 10 || avgPing > 300) return 'poor';
        if (loss > 3 || avgPing > 150 || jitter > 50) return 'fair';
        if (loss > 0 || avgPing > 50 || jitter > 20) return 'good';
        return 'excellent';
    }

    function scheduleNextPing() {
        if (pingTracker._timerId) clearTimeout(pingTracker._timerId);

        let interval = pingTracker.currentInterval;

        if (pingTracker.consecutiveFails > 0) {
            interval = Math.min(
                pingTracker.baseInterval * Math.pow(1.5, pingTracker.consecutiveFails),
                pingTracker.maxInterval
            );
        } else if (pingTracker.consecutiveSuccess >= 3) {
            interval = Math.max(pingTracker.minInterval, pingTracker.baseInterval * 0.7);
        } else if (pingTracker.consecutiveSuccess >= 5) {
            interval = Math.max(pingTracker.minInterval, pingTracker.baseInterval * 0.5);
        }

        pingTracker.currentInterval = interval;

        pingTracker._timerId = setTimeout(() => {
            pingTracker.sent++;
            checkServerConnection();
        }, interval);
    }

    async function checkServerConnection() {
        if (pingTracker.checking) {
            scheduleNextPing();
            return;
        }
        pingTracker.checking = true;

        try {
            const start = performance.now();
            const controller = new AbortController();
            const timeout = Math.min(pingTracker.currentInterval * 0.8, 5000);
            const timer = setTimeout(() => controller.abort(), timeout);

            const res = await fetch(`${ACCOUNT_API_URL}/api/status`, {
                signal: controller.signal
            });
            clearTimeout(timer);

            if (res.ok) {
                const elapsed = Math.round(performance.now() - start);
                pingTracker.received++;
                pingTracker.lastPing = elapsed;
                pingTracker.pings.push(elapsed);
                if (pingTracker.pings.length > pingTracker.maxSamples) {
                    pingTracker.pings.shift();
                }
                pingTracker.consecutiveFails = 0;
                pingTracker.consecutiveSuccess++;

                const avgPing = Math.round(pingTracker.pings.reduce((a, b) => a + b, 0) / pingTracker.pings.length);
                const packetLoss = pingTracker.sent > 0
                    ? Math.max(0, ((pingTracker.sent - pingTracker.received) / pingTracker.sent) * 100)
                    : 0;

                if (pingTracker.pings.length >= 2) {
                    const diffs = [];
                    for (let i = 1; i < pingTracker.pings.length; i++) {
                        diffs.push(Math.abs(pingTracker.pings[i] - pingTracker.pings[i - 1]));
                    }
                    pingTracker.jitter = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
                }

                pingTracker.quality = getConnectionQuality(avgPing, packetLoss, pingTracker.jitter);

                if (uiManager && uiManager.menuSystem) {
                    uiManager.menuSystem.serverConnectionStatus = 'connected';
                    uiManager.menuSystem.serverPing = avgPing;
                    uiManager.menuSystem.serverPacketLoss = packetLoss;
                }
            } else {
                pingTracker.consecutiveFails++;
                pingTracker.consecutiveSuccess = 0;
                pingTracker.quality = 'offline';

                if (uiManager && uiManager.menuSystem) {
                    uiManager.menuSystem.serverConnectionStatus = 'disconnected';
                    uiManager.menuSystem.serverPing = -1;
                    uiManager.menuSystem.serverPacketLoss = 0;
                }
            }
        } catch (e) {
            pingTracker.consecutiveFails++;
            pingTracker.consecutiveSuccess = 0;
            pingTracker.quality = 'offline';

            if (uiManager && uiManager.menuSystem) {
                uiManager.menuSystem.serverConnectionStatus = 'disconnected';
                uiManager.menuSystem.serverPing = -1;
                uiManager.menuSystem.serverPacketLoss = 0;
            }
        }

        pingTracker.checking = false;
        pingTracker.lastCheckTime = Date.now();
        scheduleNextPing();
    }

    pingTracker.sent++;
    checkServerConnection();

    async function getLocalIP() {
        return new Promise((resolve) => {
            try {
                const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
                pc.createDataChannel('');
                pc.createOffer().then(offer => pc.setLocalDescription(offer));
                const timeout = setTimeout(() => {
                    pc.close();
                    resolve(null);
                }, 3000);
                pc.onicecandidate = (e) => {
                    if (!e.candidate) return;
                    const match = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
                    if (match && match[1] !== '0.0.0.0') {
                        clearTimeout(timeout);
                        pc.close();
                        resolve(match[1]);
                    }
                };
            } catch (e) {
                resolve(null);
            }
        });
    }

    async function scanLanNetwork(menu) {
        if (menu.lanScanning) return;
        menu.lanScanning = true;
        menu.lanScanResults = [];
        menu.lanScanProgress = 0;

        const localIP = await getLocalIP();
        if (!localIP) {
            menu.lanScanning = false;
            menu.lanScanProgress = 0;
            return;
        }

        const parts = localIP.split('.');
        const subnet = parts.slice(0, 3).join('.');
        const totalHosts = 254;
        menu.lanScanTotal = totalHosts;

        const concurrency = 30;
        const timeout = 600;
        let scanned = 0;

        const scanBatch = async (host) => {
            const url = `http://${subnet}.${host}:3000/rooms`;
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeout);
                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(timer);
                if (res.ok) {
                    const data = await res.json();
                    if (data.rooms && data.rooms.length > 0) {
                        menu.lanScanResults.push({
                            ip: `${subnet}.${host}`,
                            port: '3000',
                            rooms: data.rooms
                        });
                    }
                }
            } catch (e) {}
            scanned++;
            menu.lanScanProgress = scanned;
        };

        const hosts = [];
        for (let i = 1; i <= totalHosts; i++) {
            hosts.push(i);
        }

        for (let i = 0; i < hosts.length; i += concurrency) {
            const batch = hosts.slice(i, i + concurrency);
            await Promise.all(batch.map(h => scanBatch(h)));
        }

        menu.lanScanning = false;
    }

    uiManager.menuSystem.onMultiplayerModeSelect = (mode) => {
        console.log('[Main] 联机模式选择:', mode);
        if (mode === 'lan') {
            scanLanNetwork(uiManager.menuSystem);
        }
    };

    uiManager.menuSystem.onLanServerSelect = (server) => {
        console.log('[Main] 选择局域网服务器:', server.ip);
        uiManager.menuSystem.ipInput = server.ip;
        uiManager.menuSystem.portInput = server.port;
    };

    uiManager.menuSystem.onLanScanStart = () => {
        scanLanNetwork(uiManager.menuSystem);
    };

    // 拦截 console.error 以捕获所有错误输出
    const originalConsoleError = console.error;
    console.error = function(...args) {
        const message = args.map(arg => {
            if (arg instanceof Error) return arg.message + (arg.stack ? '\n' + arg.stack : '');
            if (typeof arg === 'object') return JSON.stringify(arg);
            return String(arg);
        }).join(' ');

        consoleErrors.push({
            time: Date.now(),
            message: message,
            source: 'console.error',
            line: 0
        });
        if (consoleErrors.length > 50) consoleErrors.shift();

        originalConsoleError.apply(console, args);
    };

    window.addEventListener('error', (e) => {
        consoleErrors.push({
            time: Date.now(),
            message: e.message || String(e),
            source: e.filename ? e.filename.split('/').pop() : '',
            line: e.lineno || 0
        });
        if (consoleErrors.length > 50) consoleErrors.shift();
    });

    window.addEventListener('unhandledrejection', (e) => {
        consoleErrors.push({
            time: Date.now(),
            message: 'Promise: ' + (e.reason ? e.reason.message || String(e.reason) : 'Unknown'),
            source: '',
            line: 0
        });
        if (consoleErrors.length > 50) consoleErrors.shift();
    });

    /**
     * 启动联机游戏
     * @param {string} team - 'player1' 或 'player2'
     */
    function startMultiplayerGame(team) {
        isMultiplayer = true;
        isServerMode = uiManager.menuSystem.multiplayerMode === 'server';
        isHost = isServerMode ? (team === 'player1') : networkManager.isHost;
        gameCore.isMultiplayer = true;
        gameCore.isHost = isHost;
        gameCore.playerTeam = team;

        gameCore.reset();

        if (team === 'player2') {
            gameCore.camera.x = Math.max(0, gameCore.base.x - gameCore.canvasWidth / 2);
            gameCore.camera.y = Math.max(0, gameCore.base.y - gameCore.canvasHeight / 2);
            gameCore._clampCamera();
        }

        uiManager.menuSystem.showMultiplayerLobby = false;
        uiManager._startGameWithLoading();

        if (isServerMode) {
            serverGameClient.onMessage((msg) => {
                if (!msg || !msg.type) return;

                if (msg.type === 'state') {
                    gameCore.deserializeState(msg.data);
                } else if (msg.type === 'game_over') {
                    gameCore.gameOver = true;
                    gameCore.winner = msg.winner;
                } else if (msg.type === 'opponent_disconnected') {
                    handleDisconnect();
                }
            });

            serverGameClient.onConnectionStateChange((state) => {
                if (state === 'disconnected' || state === 'failed') {
                    handleDisconnect();
                }
            });
        } else {
            if (isHost) {
                let lastSyncTime = 0;
                let initialSyncDone = false;
                networkSyncInterval = setInterval(() => {
                    if (networkManager.connected) {
                        const now = Date.now();
                        if (!initialSyncDone) {
                            const fullState = gameCore.serializeState();
                            networkManager.send({ type: 'state', data: fullState, timestamp: now }, true);
                            initialSyncDone = true;
                            lastSyncTime = now;
                            console.log('[Main] 已发送完整初始状态给客户端');
                        } else {
                            const delta = gameCore.getStateDelta(lastSyncTime);
                            if (delta && delta.hasChanges) {
                                networkManager.send({ type: 'delta', data: delta, timestamp: now });
                                lastSyncTime = now;
                            }
                        }
                    }
                }, 50);
            }

            networkManager.onMessage((msg) => {
                if (!msg || !msg.type) return;

                if (msg.type === 'state' && !isHost) {
                    gameCore.deserializeState(msg.data);
                } else if (msg.type === 'delta' && !isHost) {
                    gameCore.applyStateDelta(msg.data);
                } else if (msg.type === 'input' && isHost) {
                    gameCore.applyRemoteInput(msg.data);
                } else if (msg.type === 'request_full_state' && isHost) {
                    const fullState = gameCore.serializeState();
                    networkManager.send({ type: 'state', data: fullState }, true);
                    console.log('[Main] 已响应完整状态请求');
                } else if (msg.type === 'disconnect') {
                    handleDisconnect();
                } else if (msg.type === 'player_leave') {
                    handleDisconnect();
                }
            });

            networkManager.onConnectionStateChange((state) => {
                if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                    handleDisconnect();
                } else if (state === 'connected') {
                    opponentDisconnected = false;
                    disconnected = false;
                    disconnectCountdown = 0;
                    console.log('[Main] 连接状态:', state);
                    if (!isHost) {
                        networkManager.send({ type: 'request_full_state' }, true);
                    }
                }
            });
        }
    }

    /**
     * 处理断线
     */
    function handleDisconnect() {
        if (opponentDisconnected) return;
        opponentDisconnected = true;
        disconnectCountdown = 10;
        // 清理网络同步定时器
        if (networkSyncInterval) {
            clearInterval(networkSyncInterval);
            networkSyncInterval = null;
        }
        console.log('[Main] 对方已断开连接，10秒后判负');
    }

    /**
     * 发送本地操作到主机（客户端模式）
     * @param {string} type - 操作类型
     * @param {Object} data - 操作数据
     */
    function sendLocalInput(type, data) {
        if (isServerMode && serverGameClient && serverGameClient.connected) {
            serverGameClient.sendInput(type, data);
        } else if (isMultiplayer && !isHost && !isServerMode && networkManager.connected) {
            networkManager.send({ type: 'input', data: { type, ...data } });
        }
    }

    function getServerSignalingUrl() {
        if (serverConfig && serverConfig.signalingServer) {
            return { url: serverConfig.signalingServer, port: serverConfig.signalingPort };
        }
        if (ACCOUNT_API_URL && ACCOUNT_API_URL !== 'http://localhost:3001') {
            return { url: ACCOUNT_API_URL, port: '443' };
        }
        return { url: 'http://localhost:3001', port: '3001' };
    }

    function getGameServerUrl() {
        if (serverConfig && serverConfig.controlServer) {
            const ctrl = serverConfig.controlServer;
            return ctrl.replace('http://', 'ws://').replace('https://', 'wss://').replace(':3002', ':3003');
        }
        return 'ws://localhost:3003';
    }

    // 菜单系统联机回调
    uiManager.menuSystem.onCreateRoom = async () => {
        uiManager.menuSystem.stopRoomListRefresh();

        if (uiManager.menuSystem.multiplayerMode === 'server') {
            const gameServerUrl = getGameServerUrl();
            serverGameClient = new ServerGameClient();
            serverGameClient.setServerUrl(gameServerUrl);

            uiManager.menuSystem.setConnectionStatus('waiting', '正在创建房间，等待玩家加入...');
            try {
                const roomId = await serverGameClient.createRoom();
                uiManager.menuSystem.roomIdInput = roomId;
                uiManager.menuSystem.setConnectionStatus('waiting', `房间已创建，ID: ${roomId}，等待玩家加入...`);

                serverGameClient.onMessage((msg) => {
                    if (msg.type === 'player_joined') {
                        uiManager.menuSystem.setConnectionStatus('connected', '连接成功！正在启动游戏...');
                        startMultiplayerGame('player1');
                    }
                });

                serverGameClient.onConnectionStateChange((state) => {
                    if (state === 'failed' || state === 'disconnected') {
                        uiManager.menuSystem.setConnectionStatus('failed', '连接失败，请重试');
                    }
                });
            } catch (err) {
                console.error('[Main] 创建房间失败:', err);
                uiManager.menuSystem.setConnectionStatus('failed', '创建房间失败: ' + err.message);
            }
        } else {
            const defaultHost = networkManager.signalingUrl ? new URL(networkManager.signalingUrl).hostname : 'localhost';
            const defaultPort = networkManager.signalingUrl ? new URL(networkManager.signalingUrl).port || '3000' : '3000';
            const ip = uiManager.menuSystem.ipInput || defaultHost;
            const port = uiManager.menuSystem.portInput || defaultPort;
            if (ip && port) networkManager.setSignalingUrl(ip, port);

            uiManager.menuSystem.setConnectionStatus('waiting', '正在创建房间，等待玩家加入...');
            try {
                const roomId = await networkManager.createRoom();
                uiManager.menuSystem.roomIdInput = roomId;
                uiManager.menuSystem.setConnectionStatus('waiting', `房间已创建，ID: ${roomId}，等待玩家加入...`);

                networkManager.onConnectionStateChange((state) => {
                    if (state === 'connected') {
                        uiManager.menuSystem.setConnectionStatus('connected', '连接成功！正在启动游戏...');
                        startMultiplayerGame('player1');
                    } else if (state === 'failed' || state === 'closed') {
                        uiManager.menuSystem.setConnectionStatus('failed', '连接失败，请重试');
                    }
                });
            } catch (err) {
                console.error('[Main] 创建房间失败:', err);
                uiManager.menuSystem.setConnectionStatus('failed', '创建房间失败: ' + err.message);
            }
        }
    };

    // 刷新房间列表
    uiManager.menuSystem.onRefreshRoomList = async () => {
        let fetchUrl;
        if (uiManager.menuSystem.multiplayerMode === 'server') {
            const sig = getServerSignalingUrl();
            fetchUrl = sig.url;
        } else {
            const defaultHost = networkManager.signalingUrl ? new URL(networkManager.signalingUrl).hostname : 'localhost';
            const defaultPort = networkManager.signalingUrl ? new URL(networkManager.signalingUrl).port || '3000' : '3000';
            const ip = uiManager.menuSystem.ipInput || defaultHost;
            const port = uiManager.menuSystem.portInput || defaultPort;
            fetchUrl = `http://${ip}:${port}`;
        }

        try {
            const res = await fetch(`${fetchUrl}/rooms`);
            if (res.ok) {
                const data = await res.json();
                uiManager.menuSystem.setRoomList(data.rooms || []);
            } else {
                uiManager.menuSystem.setRoomList([]);
            }
        } catch (err) {
            console.error('[Main] 获取房间列表失败:', err);
            uiManager.menuSystem.setRoomList([]);
        }
    };

    uiManager.menuSystem.onJoinRoom = async (roomId) => {
        if (!roomId) {
            uiManager.menuSystem.setConnectionStatus('failed', '请输入房间ID');
            return;
        }

        uiManager.menuSystem.stopRoomListRefresh();

        if (uiManager.menuSystem.multiplayerMode === 'server') {
            const gameServerUrl = getGameServerUrl();
            serverGameClient = new ServerGameClient();
            serverGameClient.setServerUrl(gameServerUrl);

            uiManager.menuSystem.setConnectionStatus('waiting', '正在加入房间...');
            try {
                await serverGameClient.joinRoom(roomId);
                uiManager.menuSystem.setConnectionStatus('connected', '连接成功！正在启动游戏...');
                startMultiplayerGame(serverGameClient.team);
            } catch (err) {
                console.error('[Main] 加入房间失败:', err);
                uiManager.menuSystem.setConnectionStatus('failed', '加入房间失败: ' + err.message);
            }
        } else {
            const defaultHost = networkManager.signalingUrl ? new URL(networkManager.signalingUrl).hostname : 'localhost';
            const defaultPort = networkManager.signalingUrl ? new URL(networkManager.signalingUrl).port || '3000' : '3000';
            const ip = uiManager.menuSystem.ipInput || defaultHost;
            const port = uiManager.menuSystem.portInput || defaultPort;
            if (ip && port) networkManager.setSignalingUrl(ip, port);

            uiManager.menuSystem.setConnectionStatus('waiting', '正在加入房间...');
            try {
                await networkManager.joinRoom(roomId);
                uiManager.menuSystem.setConnectionStatus('waiting', '正在连接，等待主机响应...');

                networkManager.onConnectionStateChange((state) => {
                    if (state === 'connected') {
                        uiManager.menuSystem.setConnectionStatus('connected', '连接成功！正在启动游戏...');
                        startMultiplayerGame('player2');
                    } else if (state === 'failed' || state === 'closed') {
                        uiManager.menuSystem.setConnectionStatus('failed', '连接失败，请检查房间ID');
                    }
                });
            } catch (err) {
                console.error('[Main] 加入房间失败:', err);
                uiManager.menuSystem.setConnectionStatus('failed', '加入房间失败: ' + err.message);
            }
        }
    };

    uiManager.input.on('mouseDown', (data) => {
        if (uiManager.gameState !== 'PLAYING') return;
        // 如果点击在HUD区域，不处理地图操作
        if (uiManager.hudSystem.isPointOnHUD(data.x, data.y)) return;
        if (data.button === 0) {
            dragStartX = data.x;
            dragStartY = data.y;
        } else if (data.button === 2) {
            isRightMouseDown = true;
            lastMouseX = data.x;
            lastMouseY = data.y;
        }
    });

    uiManager.input.on('mouseUp', (data) => {
        if (data.button === 2) {
            isRightMouseDown = false;
        }
        if (data.button === 0 && isDragging) {
            isDragging = false;
            if (uiManager.selectionRenderer) {
                uiManager.selectionRenderer.clearDragRect();
            }
        }
    });

    uiManager.input.on('mouseMove', (data) => {
        if (uiManager.gameState !== 'PLAYING') return;

        // 右键拖拽移动视角
        if (isRightMouseDown) {
            const dx = lastMouseX - data.x;
            const dy = lastMouseY - data.y;
            gameCore.moveCamera(dx, dy);
            lastMouseX = data.x;
            lastMouseY = data.y;
            return;
        }

        if (isDragging && uiManager.selectionRenderer) {
            uiManager.selectionRenderer.setDragRect(dragStartX, dragStartY, data.x, data.y);
        }
    });

    uiManager.input.on('dragStart', (data) => {
        if (uiManager.gameState !== 'PLAYING') return;
        // 只有左键可以框选，右键仅用于移动视角
        if (data.button !== 0) return;
        // 命令模式下不允许框选
        if (commandMode !== 'normal') return;
        // 如果拖拽起点在HUD区域，不开始框选
        if (uiManager.hudSystem.isPointOnHUD(data.x, data.y)) return;
        isDragging = true;
    });

    uiManager.input.on('dragEnd', (data) => {
        if (uiManager.gameState !== 'PLAYING') return;
        // 只有左键框选生效
        if (data.button !== 0) return;
        isDragging = false;
        // 如果拖拽终点在HUD区域，不执行框选
        if (uiManager.hudSystem.isPointOnHUD(data.endX, data.endY)) {
            if (uiManager.selectionRenderer) {
                uiManager.selectionRenderer.clearDragRect();
            }
            return;
        }
        const startWorld = gameCore.screenToWorld(data.startX, data.startY);
        const endWorld = gameCore.screenToWorld(data.endX, data.endY);
        gameCore.selectUnitsInRect(startWorld.x, startWorld.y, endWorld.x, endWorld.y);
        uiManager.hudSystem.updateSelectedUnits(gameCore.selectedUnits);
        if (uiManager.selectionRenderer) {
            uiManager.selectionRenderer.clearDragRect();
            uiManager.selectionRenderer.setSelectedUnits(gameCore.selectedUnits);
        }
    });

    uiManager.input.on('mouseClick', (data) => {
        if (uiManager.gameState !== 'PLAYING') return;
        if (data.wasDragging) return;
        // 如果HUDSystem已经处理了此点击（如面板按钮），不再处理地图操作
        if (data.hudHandled) return;

        if (data.button === 0) {
            // 如果点击在HUD区域，不处理地图操作
            if (uiManager.hudSystem.isPointOnHUD(data.x, data.y)) return;

            const worldPos = gameCore.screenToWorld(data.x, data.y);

            // 处理多步骤命令模式
            if (commandMode === 'move_target') {
                gameCore.issueCommand('move', { x: worldPos.x, y: worldPos.y });
                if (isMultiplayer && !isHost && !isServerMode) {
                    sendLocalInput('move', {
                        unitIds: gameCore.selectedUnits.map(u => u.id),
                        target: { x: worldPos.x, y: worldPos.y }
                    });
                }
                setCommandMode('normal');
                return;
            }

            if (commandMode === 'attack_target') {
                // 检查是否点击了敌方单位
                const targetUnit = gameCore.enemyUnits.find(u => {
                    if (u.hp <= 0) return false;
                    const dx = u.x - worldPos.x;
                    const dy = u.y - worldPos.y;
                    return Math.sqrt(dx * dx + dy * dy) < 30;
                });

                // 检查是否点击了敌方基地
                const targetBase = gameCore.enemyBase && gameCore.enemyBase.hp > 0 &&
                    Math.sqrt(
                        Math.pow(gameCore.enemyBase.x - worldPos.x, 2) +
                        Math.pow(gameCore.enemyBase.y - worldPos.y, 2)
                    ) < gameCore.enemyBase.size;

                if (targetUnit) {
                    gameCore.issueCommand('attack', { unit: targetUnit });
                    if (isMultiplayer && !isHost && !isServerMode) {
                        sendLocalInput('attack', {
                            unitIds: gameCore.selectedUnits.map(u => u.id),
                            targetUnitId: targetUnit.id
                        });
                    }
                } else if (targetBase) {
                    gameCore.issueCommand('attack_base', { base: gameCore.enemyBase });
                    if (isMultiplayer && !isHost && !isServerMode) {
                        sendLocalInput('attack_base', {
                            unitIds: gameCore.selectedUnits.map(u => u.id)
                        });
                    }
                }
                setCommandMode('normal');
                return;
            }

            if (commandMode === 'patrol_point1') {
                patrolPoints.push({ x: worldPos.x, y: worldPos.y });
                setCommandMode('patrol_point2');
                return;
            }

            if (commandMode === 'patrol_point2') {
                patrolPoints.push({ x: worldPos.x, y: worldPos.y });
                gameCore.issueCommand('patrol', { points: patrolPoints });
                if (isMultiplayer && !isHost && !isServerMode) {
                    sendLocalInput('patrol', {
                        unitIds: gameCore.selectedUnits.map(u => u.id),
                        points: patrolPoints
                    });
                }
                if (window.patrolWithWaitingArea) {
                    window.patrolWithWaitingArea = false;
                    setCommandMode('waiting_area');
                } else {
                    setCommandMode('normal');
                }
                return;
            }

            if (commandMode === 'waiting_area') {
                // 确认等待区位置
                const radius = window.waitingAreaRadius || 25;
                const groupIndex = window.selectedPatrolGroupForWaitingArea;
                const groups = gameCore.patrolTaskGroups;
                if (groupIndex >= 0 && groupIndex < groups.length) {
                    // 对齐到格点
                    const snappedPos = snapToGrid(worldPos.x, worldPos.y);
                    // 检查等待区是否与其他等待区重叠
                    let overlap = false;
                    for (let i = 0; i < groups.length; i++) {
                        if (i === groupIndex) continue;
                        const other = groups[i].waitingArea;
                        if (other && other.enabled) {
                            const dx = other.centerX - snappedPos.x;
                            const dy = other.centerY - snappedPos.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist < other.radius + radius) {
                                overlap = true;
                                break;
                            }
                        }
                    }
                    if (overlap) {
                        // 等待区重叠，不设置并保持在 waiting_area 模式
                        return;
                    }
                    gameCore.setWaitingArea(groupIndex, snappedPos.x, snappedPos.y, radius);
                    window.selectedPatrolGroupForWaitingArea = -1;
                    // 进入数量选择模式
                    setCommandMode('patrol_count_select');
                }
                return;
            }

            if (commandMode === 'collect_target') {
                const targetBelt = gameCore.getAsteroidBelts().find(belt => {
                    const dx = belt.x - worldPos.x;
                    const dy = belt.y - worldPos.y;
                    return Math.sqrt(dx * dx + dy * dy) < belt.radius + 20;
                });
                if (targetBelt) {
                    for (const unit of gameCore.selectedUnits) {
                        if (unit.type === 'engineer') {
                            gameCore.collectBelt(unit, targetBelt);
                        }
                    }
                    if (isMultiplayer && !isHost && !isServerMode) {
                        sendLocalInput('collect', {
                            unitIds: gameCore.selectedUnits.filter(u => u.type === 'engineer').map(u => u.id),
                            beltId: targetBelt.id
                        });
                    }
                }
                setCommandMode('normal');
                return;
            }

            if (commandMode === 'build_target') {
                // 对齐到格点
                const snappedPos = snapToGrid(worldPos.x, worldPos.y);
                for (const unit of gameCore.selectedUnits) {
                    if (unit.type === 'engineer') {
                        gameCore.buildOutpost(unit, snappedPos.x, snappedPos.y);
                    }
                }
                if (isMultiplayer && !isHost && !isServerMode) {
                    sendLocalInput('build_outpost', {
                        unitIds: gameCore.selectedUnits.filter(u => u.type === 'engineer').map(u => u.id),
                        targetX: snappedPos.x,
                        targetY: snappedPos.y
                    });
                }
                setCommandMode('normal');
                return;
            }

            if (commandMode === 'blockade_target') {
                let targetZone = gameCore.getControlZones().find(zone => {
                    const dx = zone.x - worldPos.x;
                    const dy = zone.y - worldPos.y;
                    return Math.sqrt(dx * dx + dy * dy) < zone.radius + 20;
                });
                if (!targetZone) {
                    targetZone = gameCore.getOutposts().find(outpost => {
                        const dx = outpost.x - worldPos.x;
                        const dy = outpost.y - worldPos.y;
                        return Math.sqrt(dx * dx + dy * dy) < outpost.blockadeRadius + 20;
                    });
                }
                if (targetZone) {
                    gameCore.blockadeZone(gameCore.selectedUnits, targetZone);
                    if (isMultiplayer && !isHost && !isServerMode) {
                        sendLocalInput('blockade', {
                            unitIds: gameCore.selectedUnits.map(u => u.id),
                            targetId: targetZone.id
                        });
                    }
                }
                setCommandMode('normal');
                return;
            }

            if (commandMode === 'artillery_target') {
                const worldPos = gameCore.screenToWorld(data.x, data.y);
                const battleships = gameCore.selectedUnits.filter(u => u.type === 'battleship');
                for (const bs of battleships) {
                    gameCore.startArtilleryStrike(bs, worldPos.x, worldPos.y);
                }
                if (isMultiplayer && !isHost && !isServerMode) {
                    sendLocalInput('artillery', {
                        unitIds: battleships.map(u => u.id),
                        targetX: worldPos.x,
                        targetY: worldPos.y
                    });
                }
                setCommandMode('normal');
            }

            // 普通选择模式 - 检查是否点击了单位或基地
            let clickedUnit = gameCore.getAllUnits().find(u => {
                if (u.hp <= 0) return false;
                const dx = u.x - worldPos.x;
                const dy = u.y - worldPos.y;
                return Math.sqrt(dx * dx + dy * dy) < 30;
            });

            // 检查是否点击了基地
            if (!clickedUnit) {
                if (gameCore.base && gameCore.base.hp > 0) {
                    const dx = gameCore.base.x - worldPos.x;
                    const dy = gameCore.base.y - worldPos.y;
                    if (Math.sqrt(dx * dx + dy * dy) < gameCore.base.size) {
                        // 选中己方基地，可以显示基地信息
                        console.log('[Main] 选中己方基地');
                    }
                }
                if (gameCore.enemyBase && gameCore.enemyBase.hp > 0) {
                    const dx = gameCore.enemyBase.x - worldPos.x;
                    const dy = gameCore.enemyBase.y - worldPos.y;
                    if (Math.sqrt(dx * dx + dy * dy) < gameCore.enemyBase.size) {
                        gameCore.selectedEnemy = gameCore.enemyBase;
                        uiManager.hudSystem.updateSelectedEnemy(gameCore.selectedEnemy);
                    }
                }
            }

            if (clickedUnit && clickedUnit.team === 'player') {
                gameCore.selectUnit(clickedUnit, data.ctrl);
                gameCore.selectedEnemy = null;
            } else if (clickedUnit && clickedUnit.team === 'enemy') {
                // 点击敌方单位：设为selectedEnemy，保持友方选择不变
                gameCore.selectedEnemy = clickedUnit;
            } else if (!data.ctrl) {
                // 点击空白处，取消选择
                gameCore.selectUnit(null, false);
                gameCore.selectedEnemy = null;
            }

            uiManager.hudSystem.updateSelectedUnits(gameCore.selectedUnits);
            uiManager.hudSystem.updateSelectedEnemy(gameCore.selectedEnemy);
            if (uiManager.selectionRenderer) {
                uiManager.selectionRenderer.setSelectedUnits(gameCore.selectedUnits);
            }
        } else if (data.button === 2) {
            // 右键直接移动
            const worldPos = gameCore.screenToWorld(data.x, data.y);
            gameCore.issueCommand('move', { x: worldPos.x, y: worldPos.y });
            if (isMultiplayer && !isHost && !isServerMode) {
                sendLocalInput('move', {
                    unitIds: gameCore.selectedUnits.map(u => u.id),
                    target: { x: worldPos.x, y: worldPos.y }
                });
            }
            setCommandMode('normal');
        }
    });

    uiManager.input.on('keyDown', (data) => {
        if (data.key === '`') {
            uiManager.toggleConsole();
            return;
        }

        if (uiManager.consoleOpen) {
            if (data.keyLower === 'escape') {
                uiManager.toggleConsole();
                return;
            }
            if (data.keyLower === 'enter') {
                const cmd = uiManager.consoleInput.trim();
                uiManager.consoleHistory.push({ type: 'input', text: cmd });
                if (cmd.length > 0) {
                    executeConsoleCommand(cmd);
                }
                uiManager.consoleInput = '';
                return;
            }
            if (data.keyLower === 'backspace') {
                uiManager.consoleInput = uiManager.consoleInput.slice(0, -1);
                return;
            }
            return;
        }

        if (data.keyLower === 'escape') {
            if (uiManager.settingsOpen) {
                uiManager._toggleSettings();
                return;
            }
            if (uiManager.pauseMenuOpen) {
                uiManager.pauseMenuOpen = false;
                uiManager._pauseMenuHoverIndex = -1;
                return;
            }
            // 命令菜单打开时优先关闭菜单
            if (uiManager.hudSystem._showCommandMenu) {
                uiManager.hudSystem.closeCommandMenu();
                return;
            }
            if (commandMode !== 'normal') {
                setCommandMode('normal');
                return;
            }
            if (uiManager.gameState === 'PLAYING') {
                uiManager.pauseMenuOpen = true;
                uiManager._pauseMenuHoverIndex = -1;
            }
        }

        if (uiManager.gameState === 'PLAYING') {
            const hud = uiManager.hudSystem;
            const selectedUnits = gameCore.selectedUnits || [];
            const hasSelection = selectedUnits.length > 0;
            const allEngineers = hasSelection && selectedUnits.every(u => u.type === 'engineer');
            const hasCombat = hasSelection && selectedUnits.some(u => u.type !== 'engineer');
            const hasBattleship = hasSelection && selectedUnits.some(u => u.type === 'battleship');

            // 空格键/Backspace键：切换命令菜单
            if (data.keyLower === ' ' || data.keyLower === 'backspace') {
                hud.toggleCommandMenu();
                return;
            }

            // 命令菜单打开时，快捷键直接执行对应命令
            if (hud._showCommandMenu) {
                const commands = hud.getAvailableCommands();
                const cmd = commands.find(c => c.shortcut.toLowerCase() === data.keyLower);
                if (cmd) {
                    hud._executeCommand(cmd.key);
                    hud.closeCommandMenu();
                    return;
                }
                // ESC 关闭命令菜单
                if (data.keyLower === 'escape') {
                    hud.closeCommandMenu();
                    return;
                }
            }

            // ESC 关闭巡逻面板
            if (data.keyLower === 'escape') {
                if (hud.isPatrolPanelOpen && hud.isPatrolPanelOpen()) {
                    hud.closePatrolPanel();
                    return;
                }
            }

            // 巡逻单位数量选择模式 - 数字键输入
            if (commandMode === 'patrol_count_select') {
                const num = parseInt(data.key);
                if (!isNaN(num) && num >= 1) {
                    const groups = gameCore.patrolTaskGroups;
                    if (groups.length > 0) {
                        const lastGroup = groups[groups.length - 1];
                        const maxCount = lastGroup.units.length - 1;
                        if (num <= maxCount) {
                            gameCore.assignUnitsToWaitingArea(groups.length - 1, num);
                            setCommandMode('normal');
                        }
                    }
                }
                return;
            }

            switch (data.keyLower) {
                case 'a':
                    if (hasCombat) setCommandMode('attack_target');
                    break;
                case 'm':
                    if (hasSelection) setCommandMode('move_target');
                    break;
                case 's':
                    if (hasSelection) {
                        gameCore.issueCommand('stop', null);
                        if (isMultiplayer && !isHost && !isServerMode) {
                            sendLocalInput('stop', {
                                unitIds: selectedUnits.map(u => u.id)
                            });
                        }
                        setCommandMode('normal');
                    }
                    break;
                case 'p':
                    if (hasCombat) {
                        if (hud.isPatrolPanelOpen && hud.isPatrolPanelOpen()) {
                            hud.closePatrolPanel();
                        } else {
                            hud.togglePatrolPanel();
                        }
                    }
                    break;
                case 'l':
                    if (hasCombat) setCommandMode('blockade_target');
                    break;
                case 'c':
                    if (allEngineers) setCommandMode('collect_target');
                    break;
                case 'o':
                    if (allEngineers) setCommandMode('build_target');
                    break;
                case 'f':
                    if (hasCombat) {
                        if (isMultiplayer && !isHost && !isServerMode) {
                            sendLocalInput('build', { unitType: 'fighter' });
                        } else {
                            gameCore.buildUnit('fighter');
                        }
                    }
                    break;
                case 'b':
                    if (hasCombat) {
                        if (isMultiplayer && !isHost && !isServerMode) {
                            sendLocalInput('build', { unitType: 'battleship' });
                        } else {
                            gameCore.buildUnit('battleship');
                        }
                    }
                    break;
                case 'e':
                    if (isMultiplayer && !isHost && !isServerMode) {
                        sendLocalInput('build', { unitType: 'engineer' });
                    } else {
                        gameCore.buildUnit('engineer');
                    }
                    break;
                case 'u':
                    hud._showUnitList = !hud._showUnitList;
                    hud._unitListTarget = hud._showUnitList ? 1 : 0;
                    break;
                case 'g':
                    if (hasBattleship) setCommandMode('artillery_target');
                    break;
            }
        }
    });

    uiManager.input.on('keyPress', (data) => {
        if (uiManager.consoleOpen && data.char) {
            if (data.char !== '`') {
                uiManager.consoleInput += data.char;
            }
        }
    });

    // 双指捏合缩放（触控设备）
    uiManager.input.on('touchPinch', (data) => {
        if (uiManager.gameState !== 'PLAYING' || commandMode === 'waiting_area') return;
        const zoomFactor = 1 + (data.scale - 1) * 0.5;
        const newZoom = gameCore.camera.zoom * zoomFactor;
        gameCore.camera.zoom = Math.max(0.3, Math.min(3.0, newZoom));
    });

    // 滚轮事件已由 UIManager 统一处理（包含地图缩放和等待区半径调整）
    // 避免重复注册 wheel 事件

    function executeConsoleCommand(cmd) {
        const parts = cmd.split(/\s+/);
        const command = parts[0].toLowerCase();

        switch (command) {
            case 'timespeed': {
                const speed = parseFloat(parts[1]);
                if (isNaN(speed) || speed <= 0) {
                    uiManager.consoleHistory.push({ type: 'error', text: '用法: timespeed [数字] (正数)' });
                } else if (speed > 10) {
                    uiManager.consoleHistory.push({ type: 'error', text: '速度倍率上限为 10x' });
                } else {
                    gameSpeed = speed;
                    uiManager.consoleHistory.push({ type: 'success', text: `游戏速度已设为 ${speed}x` });
                }
                break;
            }
            case 'check': {
                if (consoleErrors.length === 0) {
                    uiManager.consoleHistory.push({ type: 'success', text: '当前无报错' });
                } else {
                    uiManager.consoleHistory.push({ type: 'error', text: `发现 ${consoleErrors.length} 个错误:` });
                    const recent = consoleErrors.slice(-5);
                    for (const err of recent) {
                        const src = err.source ? ` [${err.source}:${err.line}]` : '';
                        uiManager.consoleHistory.push({ type: 'error', text: `${err.message}${src}` });
                    }
                }
                break;
            }
            case 'stop': {
                if (uiManager.gameState === 'PAUSED') {
                    uiManager.consoleHistory.push({ type: 'info', text: '游戏已处于暂停状态' });
                } else if (uiManager.gameState === 'PLAYING') {
                    uiManager.setGameState('PAUSED');
                    uiManager.consoleHistory.push({ type: 'success', text: '游戏已暂停' });
                } else {
                    uiManager.consoleHistory.push({ type: 'error', text: '当前状态无法暂停' });
                }
                break;
            }
            case 'start': {
                if (uiManager.gameState === 'PLAYING') {
                    uiManager.consoleHistory.push({ type: 'info', text: '游戏已在运行中' });
                } else if (uiManager.gameState === 'PAUSED') {
                    uiManager.setGameState('PLAYING');
                    uiManager.consoleHistory.push({ type: 'success', text: '游戏继续' });
                } else {
                    uiManager.consoleHistory.push({ type: 'error', text: '当前状态无法继续' });
                }
                break;
            }
            case 'restart': {
                if (gameCore) {
                    gameCore.init(gameCore.worldWidth, gameCore.worldHeight);
                    gameSpeed = 1;
                    if (uiManager.gameState === 'PAUSED') {
                        uiManager.setGameState('PLAYING');
                    }
                    uiManager.consoleHistory.push({ type: 'success', text: '游戏已重新开始' });
                } else {
                    uiManager.consoleHistory.push({ type: 'error', text: '游戏核心未初始化' });
                }
                break;
            }
            default:
                uiManager.consoleHistory.push({ type: 'error', text: `未知指令: ${command}` });
                uiManager.consoleHistory.push({ type: 'info', text: '可用指令: timespeed [n], check, stop, start, restart' });
        }
    }

    uiManager.hudSystem.onControlClick = (key) => {
        switch (key) {
            case 'move':
                setCommandMode('move_target');
                break;
            case 'attack':
                setCommandMode('attack_target');
                break;
            case 'stop':
                gameCore.issueCommand('stop', null);
                if (isMultiplayer && !isHost && !isServerMode) {
                    sendLocalInput('stop', {
                        unitIds: gameCore.selectedUnits.map(u => u.id)
                    });
                }
                setCommandMode('normal');
                break;
            case 'patrol':
                setCommandMode('patrol_point1');
                break;
            case 'blockade':
                setCommandMode('blockade_target');
                break;
            case 'artillery':
                setCommandMode('artillery_target');
                break;
            case 'collect':
                setCommandMode('collect_target');
                break;
            case 'build_outpost':
                setCommandMode('build_target');
                break;
        }
    };

    uiManager.hudSystem.onRetreatClick = () => {
        gameCore.issueCommand('retreat', null);
        if (isMultiplayer && !isHost && !isServerMode) {
            sendLocalInput('retreat', {
                unitIds: gameCore.selectedUnits.map(u => u.id)
            });
        }
        setCommandMode('normal');
    };

    uiManager.hudSystem.onBuildClick = (type) => {
        if (isMultiplayer && !isHost && !isServerMode) {
            sendLocalInput('build', { unitType: type });
        } else {
            gameCore.buildUnit(type);
        }
    };

    uiManager.hudSystem.onPatrolCreate = () => {
        uiManager.hudSystem.closePatrolPanel();
        setTimeout(() => {
            setCommandMode('patrol_point1');
        }, 0);
    };

    uiManager.hudSystem.onPatrolWaitingArea = (groupIndex) => {
        uiManager.hudSystem.closePatrolPanel();
        window.selectedPatrolGroupForWaitingArea = groupIndex;
        setTimeout(() => {
            setCommandMode('waiting_area');
        }, 0);
    };

    gameCore.onUpdate = () => {
        uiManager.hudSystem.updateResources(gameCore.resources);
        uiManager.hudSystem.updateSelectedUnits(gameCore.selectedUnits);
        uiManager.hudSystem.updateMinimapUnits(gameCore.getMinimapUnits());
        uiManager.hudSystem.updateMinimapZones(gameCore.getMinimapZones());
        uiManager.hudSystem.updateMinimapAsteroidBelts(gameCore.getAsteroidBelts());
        // 更新舰船详情面板中的单位列表
        uiManager.hudSystem.updateAllUnits(gameCore.units);

        // 接敌时自动显示敌方信息
        const attackingUnit = gameCore.selectedUnits.find(u => u.state === 'attack' && u.targetUnit && u.targetUnit.hp > 0);
        if (attackingUnit && !gameCore.selectedEnemy) {
            gameCore.selectedEnemy = attackingUnit.targetUnit;
            uiManager.hudSystem.updateSelectedEnemy(gameCore.selectedEnemy);
        }
    };

    // 舰船详情面板中选择单位的回调
    uiManager.hudSystem.onUnitSelect = (unit) => {
        gameCore.selectUnit(unit, false);
        uiManager.hudSystem.updateSelectedUnits(gameCore.selectedUnits);
        if (uiManager.selectionRenderer) {
            uiManager.selectionRenderer.setSelectedUnits(gameCore.selectedUnits);
        }
    };

    // ========== ESC 按钮回调（触摸屏设备模拟 ESC 键）==========
    uiManager.hudSystem.onEscClick = () => {
        // 直接执行 ESC 逻辑（与键盘 keyDown(Escape) 行为一致）
        if (uiManager.settingsOpen) {
            uiManager._toggleSettings();
            return;
        }
        if (uiManager.pauseMenuOpen) {
            uiManager.pauseMenuOpen = false;
            uiManager._pauseMenuHoverIndex = -1;
            return;
        }
        if (uiManager.hudSystem._showCommandMenu) {
            uiManager.hudSystem.closeCommandMenu();
            return;
        }
        if (commandMode !== 'normal') {
            setCommandMode('normal');
            return;
        }
        if (uiManager.gameState === 'PLAYING') {
            uiManager.pauseMenuOpen = true;
            uiManager._pauseMenuHoverIndex = -1;
            return;
        }
        // 同时发送 keyDown 事件（兼容其他监听 keyDown 的系统）
        uiManager.input.emit('keyDown', { key: 'Escape', keyLower: 'escape', code: 'Escape', ctrl: false });
    };

    // ========== 框选模式切换回调 ==========
    uiManager.hudSystem.onBoxSelectToggle = (isActive) => {
        const modeName = isActive ? '框选模式' : '点击模式';
        uiManager.hudSystem.addNotification('已切换到' + modeName, '#22c55e', 2);
        // 同步到 InputSystem，触控拖拽行为根据模式切换
        if (uiManager.input && uiManager.input.setBoxSelectMode) {
            uiManager.input.setBoxSelectMode(isActive);
        }
    };

    gameCore.onGameOver = (winner) => {
        uiManager.setGameState('GAMEOVER');
        console.log(`[Main] 游戏结束，获胜方: ${winner}`);
        if (gameCore.resources.proximaCoin > 0) {
            saveProximaCoinToServer(gameCore.resources.proximaCoin);
        }
    };

    const selectionRenderer = new SelectionRenderer(uiManager.ctx, uiManager.theme, gameCore);
    uiManager.selectionRenderer = selectionRenderer;

    // 格点大小
    const GRID_SIZE = 5;

    // 将世界坐标对齐到格点
    function snapToGrid(worldX, worldY) {
        return {
            x: Math.round(worldX / GRID_SIZE) * GRID_SIZE,
            y: Math.round(worldY / GRID_SIZE) * GRID_SIZE
        };
    }

    // 网格线缓存画布
    let _gridCanvas = null;
    let _gridCanvasZoom = 0;
    let _gridCanvasOffsetX = 0;
    let _gridCanvasOffsetY = 0;

    function _ensureGridCanvas(w, h, zoom, offsetX, offsetY) {
        const worldW = w / zoom;
        const worldH = h / zoom;
        const cacheW = Math.ceil(worldW);
        const cacheH = Math.ceil(worldH);

        if (_gridCanvas && _gridCanvas.width === cacheW && _gridCanvas.height === cacheH) {
            return _gridCanvas;
        }

        const gc = document.createElement('canvas');
        gc.width = cacheW;
        gc.height = cacheH;
        const gctx = gc.getContext('2d');

        const worldLeft = offsetX;
        const worldTop = offsetY;
        const worldRight = offsetX + worldW;
        const worldBottom = offsetY + worldH;

        const startX = Math.floor(worldLeft / GRID_SIZE) * GRID_SIZE;
        const startY = Math.floor(worldTop / GRID_SIZE) * GRID_SIZE;
        const endX = Math.ceil(worldRight / GRID_SIZE) * GRID_SIZE;
        const endY = Math.ceil(worldBottom / GRID_SIZE) * GRID_SIZE;

        gctx.save();

        gctx.strokeStyle = 'rgba(0, 212, 255, 0.03)';
        gctx.lineWidth = 0.5;
        for (let x = startX; x <= endX; x += GRID_SIZE) {
            const localX = x - offsetX;
            gctx.beginPath();
            gctx.moveTo(localX, 0);
            gctx.lineTo(localX, cacheH);
            gctx.stroke();
        }
        for (let y = startY; y <= endY; y += GRID_SIZE) {
            const localY = y - offsetY;
            gctx.beginPath();
            gctx.moveTo(0, localY);
            gctx.lineTo(cacheW, localY);
            gctx.stroke();
        }

        const bigGridSize = GRID_SIZE * 5;
        const bigStartX = Math.floor(worldLeft / bigGridSize) * bigGridSize;
        const bigStartY = Math.floor(worldTop / bigGridSize) * bigGridSize;
        const bigEndX = Math.ceil(worldRight / bigGridSize) * bigGridSize;
        const bigEndY = Math.ceil(worldBottom / bigGridSize) * bigGridSize;

        gctx.strokeStyle = 'rgba(0, 212, 255, 0.06)';
        gctx.lineWidth = 0.8;
        for (let x = bigStartX; x <= bigEndX; x += bigGridSize) {
            const localX = x - offsetX;
            gctx.beginPath();
            gctx.moveTo(localX, 0);
            gctx.lineTo(localX, cacheH);
            gctx.stroke();
        }
        for (let y = bigStartY; y <= bigEndY; y += bigGridSize) {
            const localY = y - offsetY;
            gctx.beginPath();
            gctx.moveTo(0, localY);
            gctx.lineTo(cacheW, localY);
            gctx.stroke();
        }

        gctx.fillStyle = 'rgba(0, 212, 255, 0.08)';
        for (let x = bigStartX; x <= bigEndX; x += bigGridSize) {
            for (let y = bigStartY; y <= bigEndY; y += bigGridSize) {
                const localX = x - offsetX;
                const localY = y - offsetY;
                gctx.beginPath();
                gctx.arc(localX, localY, 1.2, 0, Math.PI * 2);
                gctx.fill();
            }
        }

        gctx.restore();
        _gridCanvas = gc;
        _gridCanvasZoom = zoom;
        _gridCanvasOffsetX = offsetX;
        _gridCanvasOffsetY = offsetY;
        return gc;
    }

    // 渲染格点线
    function renderGridLines() {
        const ctx = uiManager.ctx;
        const zoom = gameCore.camera.zoom;
        const offsetX = gameCore.camera.x;
        const offsetY = gameCore.camera.y;
        const w = canvas.width / (window.devicePixelRatio || 1);
        const h = canvas.height / (window.devicePixelRatio || 1);

        const worldW = w / zoom;
        const worldH = h / zoom;

        const maxLines = 800;
        const estimatedLines = Math.ceil(worldW / GRID_SIZE) + Math.ceil(worldH / GRID_SIZE);

        if (estimatedLines > maxLines) {
            const gc = _ensureGridCanvas(w, h, zoom, offsetX, offsetY);
            ctx.save();
            ctx.drawImage(gc, 0, 0, gc.width, gc.height, 0, 0, w, h);
            ctx.restore();
        } else {
            const worldLeft = offsetX;
            const worldTop = offsetY;
            const worldRight = offsetX + worldW;
            const worldBottom = offsetY + worldH;

            const startX = Math.floor(worldLeft / GRID_SIZE) * GRID_SIZE;
            const startY = Math.floor(worldTop / GRID_SIZE) * GRID_SIZE;
            const endX = Math.ceil(worldRight / GRID_SIZE) * GRID_SIZE;
            const endY = Math.ceil(worldBottom / GRID_SIZE) * GRID_SIZE;

            ctx.save();

            ctx.strokeStyle = 'rgba(0, 212, 255, 0.03)';
            ctx.lineWidth = 0.5;

            for (let x = startX; x <= endX; x += GRID_SIZE) {
                const screenX = (x - offsetX) * zoom;
                ctx.beginPath();
                ctx.moveTo(screenX, 0);
                ctx.lineTo(screenX, h);
                ctx.stroke();
            }

            for (let y = startY; y <= endY; y += GRID_SIZE) {
                const screenY = (y - offsetY) * zoom;
                ctx.beginPath();
                ctx.moveTo(0, screenY);
                ctx.lineTo(w, screenY);
                ctx.stroke();
            }

            const bigGridSize = GRID_SIZE * 5;
            const bigStartX = Math.floor(worldLeft / bigGridSize) * bigGridSize;
            const bigStartY = Math.floor(worldTop / bigGridSize) * bigGridSize;
            const bigEndX = Math.ceil(worldRight / bigGridSize) * bigGridSize;
            const bigEndY = Math.ceil(worldBottom / bigGridSize) * bigGridSize;

            ctx.strokeStyle = 'rgba(0, 212, 255, 0.06)';
            ctx.lineWidth = 0.8;

            for (let x = bigStartX; x <= bigEndX; x += bigGridSize) {
                const screenX = (x - offsetX) * zoom;
                ctx.beginPath();
                ctx.moveTo(screenX, 0);
                ctx.lineTo(screenX, h);
                ctx.stroke();
            }

            for (let y = bigStartY; y <= bigEndY; y += bigGridSize) {
                const screenY = (y - offsetY) * zoom;
                ctx.beginPath();
                ctx.moveTo(0, screenY);
                ctx.lineTo(w, screenY);
                ctx.stroke();
            }

            ctx.fillStyle = 'rgba(0, 212, 255, 0.08)';
            for (let x = bigStartX; x <= bigEndX; x += bigGridSize) {
                for (let y = bigStartY; y <= bigEndY; y += bigGridSize) {
                    const screenX = (x - offsetX) * zoom;
                    const screenY = (y - offsetY) * zoom;
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, 1.2 * zoom, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.restore();
        }
    }

    // 命令模式提示渲染
    function renderCommandHint() {
        const hint = getCommandModeText();
        if (!hint) return;
        const ctx = uiManager.ctx;
        const colors = uiManager.theme.colors;
        const w = canvas.width / (window.devicePixelRatio || 1);

        // 背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(w / 2 - 200, 50, 400, 36);
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 1;
        ctx.strokeRect(w / 2 - 200, 50, 400, 36);

        // 文字
        ctx.fillStyle = colors.text;
        ctx.font = uiManager.theme.fonts.hud;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hint, w / 2, 68);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    // 等待区预览渲染
    function renderWaitingAreaPreview() {
        if (commandMode !== 'waiting_area') return;
        const ctx = uiManager.ctx;
        const mousePos = uiManager.input.getMousePos();
        const worldPos = gameCore.screenToWorld(mousePos.x, mousePos.y);
        // 对齐到格点
        const snappedPos = snapToGrid(worldPos.x, worldPos.y);
        const radius = window.waitingAreaRadius || 25;
        const screenPos = gameCore.worldToScreen(snappedPos.x, snappedPos.y);
        const zoom = gameCore.camera.zoom;
        ctx.save();
        // 外圈发光效果
        ctx.shadowColor = 'rgba(168, 85, 247, 0.6)';
        ctx.shadowBlur = 15 * zoom;
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.9)';
        ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, radius * zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        // 内圈虚线
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4 * zoom, 4 * zoom]);
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, (radius - 5) * zoom, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // 十字准星
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
        ctx.lineWidth = 1;
        const crossSize = 6 * zoom;
        ctx.beginPath();
        ctx.moveTo(screenPos.x - crossSize, screenPos.y);
        ctx.lineTo(screenPos.x + crossSize, screenPos.y);
        ctx.moveTo(screenPos.x, screenPos.y - crossSize);
        ctx.lineTo(screenPos.x, screenPos.y + crossSize);
        ctx.stroke();
        // 格点标记
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, 2 * zoom, 0, Math.PI * 2);
        ctx.fill();
        // 坐标文字
        ctx.fillStyle = 'rgba(168, 85, 247, 0.8)';
        ctx.font = `${10 * zoom}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(`(${snappedPos.x}, ${snappedPos.y})`, screenPos.x, screenPos.y + radius * zoom + 14 * zoom);
        ctx.textAlign = 'left';
        ctx.restore();
    }

    // 前哨站建造虚影渲染
    function renderBuildPreview() {
        if (commandMode !== 'build_target') return;
        const ctx = uiManager.ctx;
        const mousePos = uiManager.input.getMousePos();
        const worldPos = gameCore.screenToWorld(mousePos.x, mousePos.y);
        // 对齐到格点
        const snappedPos = snapToGrid(worldPos.x, worldPos.y);
        const screenPos = gameCore.worldToScreen(snappedPos.x, snappedPos.y);
        const zoom = gameCore.camera.zoom;
        const size = 40 * zoom;
        const halfSize = size / 2;
        ctx.save();
        // 外圈发光
        ctx.shadowColor = 'rgba(34, 197, 94, 0.5)';
        ctx.shadowBlur = 20 * zoom;
        // 填充
        ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
        ctx.fillRect(screenPos.x - halfSize, screenPos.y - halfSize, size, size);
        ctx.shadowBlur = 0;
        // 边框
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenPos.x - halfSize, screenPos.y - halfSize, size, size);
        // 内部十字
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screenPos.x - halfSize + 4 * zoom, screenPos.y);
        ctx.lineTo(screenPos.x + halfSize - 4 * zoom, screenPos.y);
        ctx.moveTo(screenPos.x, screenPos.y - halfSize + 4 * zoom);
        ctx.lineTo(screenPos.x, screenPos.y + halfSize - 4 * zoom);
        ctx.stroke();
        // 角标
        const cornerSize = 8 * zoom;
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
        ctx.lineWidth = 2;
        // 左上
        ctx.beginPath();
        ctx.moveTo(screenPos.x - halfSize, screenPos.y - halfSize + cornerSize);
        ctx.lineTo(screenPos.x - halfSize, screenPos.y - halfSize);
        ctx.lineTo(screenPos.x - halfSize + cornerSize, screenPos.y - halfSize);
        ctx.stroke();
        // 右上
        ctx.beginPath();
        ctx.moveTo(screenPos.x + halfSize - cornerSize, screenPos.y - halfSize);
        ctx.lineTo(screenPos.x + halfSize, screenPos.y - halfSize);
        ctx.lineTo(screenPos.x + halfSize, screenPos.y - halfSize + cornerSize);
        ctx.stroke();
        // 左下
        ctx.beginPath();
        ctx.moveTo(screenPos.x - halfSize, screenPos.y + halfSize - cornerSize);
        ctx.lineTo(screenPos.x - halfSize, screenPos.y + halfSize);
        ctx.lineTo(screenPos.x - halfSize + cornerSize, screenPos.y + halfSize);
        ctx.stroke();
        // 右下
        ctx.beginPath();
        ctx.moveTo(screenPos.x + halfSize - cornerSize, screenPos.y + halfSize);
        ctx.lineTo(screenPos.x + halfSize, screenPos.y + halfSize);
        ctx.lineTo(screenPos.x + halfSize, screenPos.y + halfSize - cornerSize);
        ctx.stroke();
        // 中心点
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, 2 * zoom, 0, Math.PI * 2);
        ctx.fill();
        // 文字
        ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
        ctx.font = `bold ${11 * zoom}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('前哨站', screenPos.x, screenPos.y - halfSize - 8 * zoom);
        ctx.font = `${9 * zoom}px monospace`;
        ctx.fillStyle = 'rgba(34, 197, 94, 0.7)';
        ctx.fillText(`(${snappedPos.x}, ${snappedPos.y})`, screenPos.x, screenPos.y + halfSize + 14 * zoom);
        ctx.textAlign = 'left';
        ctx.restore();
    }

    // 游戏帮助提示
    let helpPanelExpanded = false;

    function renderHelpHint() {
        const ctx = uiManager.ctx;
        const colors = uiManager.theme.colors;
        const w = canvas.width / (window.devicePixelRatio || 1);

        const panelW = 200;
        const headerH = 24;
        const lineH = 14;
        const hints = [
            '左键 - 选择单位',
            '右键拖拽 - 移动视角',
            '右键点击 - 移动单位',
            'A - 攻击模式',
            'M - 移动模式',
            'S - 停止',
            'P - 巡逻',
            'L - 封锁',
            'ESC - 暂停'
        ];
        const contentH = hints.length * lineH + 8;
        const panelH = helpPanelExpanded ? headerH + contentH : headerH;
        const panelX = w - panelW - 10;
        const panelY = 40;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        ctx.fillStyle = helpPanelExpanded ? colors.primary : colors.textMuted;
        ctx.font = uiManager.theme.fonts.small;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const arrow = helpPanelExpanded ? '▾' : '▸';
        ctx.fillText(`${arrow} 操作说明`, panelX + 8, panelY + headerH / 2);

        if (helpPanelExpanded) {
            ctx.fillStyle = colors.textMuted;
            let y = panelY + headerH + 10;
            for (const hint of hints) {
                ctx.fillText(hint, panelX + 12, y);
                y += lineH;
            }
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    uiManager.input.on('mouseClick', (data) => {
        if (uiManager.gameState !== 'PLAYING') return;
        if (data.button !== 0) return;
        if (data.wasDragging) return;
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width / dpr;
        const panelW = 200;
        const panelX = w - panelW - 10;
        const panelY = 40;
        const headerH = 24;
        if (data.x >= panelX && data.x <= panelX + panelW && data.y >= panelY && data.y <= panelY + headerH) {
            helpPanelExpanded = !helpPanelExpanded;
        }
    });


    const originalRender = uiManager.render.bind(uiManager);
    uiManager.render = function() {
        // 更新性能监控
        performanceMonitor.update();
        performanceMonitor.log();

        // 执行批量渲染
        batchRenderer.executeAll();

        originalRender();
        if (this.gameState === 'PLAYING') {
            renderGridLines();
            renderBuildPreview();
            selectionRenderer.render();
            renderCommandHint();
            renderWaitingAreaPreview();
            renderHelpHint();
        }
        if (this.gameState === 'PLAYING' && opponentDisconnected && !gameCore.gameOver) {
            uiManager._renderDisconnectNotice(Math.ceil(disconnectCountdown));
        }
    };

    const originalUpdate = uiManager.update.bind(uiManager);
    uiManager.update = function(dt) {
        originalUpdate(dt);
        if (this.gameState === 'PLAYING' && gameCore && !disconnected) {
            if (isMultiplayer || !this.pauseMenuOpen) {
                const scaledDt = dt * gameSpeed;
                gameCore.update(scaledDt);
                selectionRenderer.update(scaledDt);

                // 检测战斗状态并更新音乐
                const inCombat = gameCore.checkCombatStatus();
                if (inCombat) {
                    musicManager.enterCombat();
                } else {
                    musicManager.exitCombat();
                }
                musicManager.update(scaledDt / 1000, true);

                // 定期清理内存（每10秒）
                if (performanceMonitor.frameCount % 600 === 0) {
                    // 清理未使用的资源
                    const activeResources = ['menuBg', 'panelBg', 'fighter', 'battleship', 'asteroidBelt'];
                    uiManager.resourceManager.releaseUnused(activeResources);

                    // 输出内存统计
                    const memStats = memoryManager.getStats();
                    const resStats = uiManager.resourceManager.getStats();
                    console.log('[Memory] Object pools:', memStats);
                    console.log('[Memory] Resources:', resStats);
                }
            }
            if (opponentDisconnected) {
                disconnectCountdown -= dt / 1000;
                if (disconnectCountdown <= 0) {
                    opponentDisconnected = false;
                    gameCore.winner = gameCore.playerTeam === 'player1' ? 'player' : 'enemy';
                    gameCore.gameOver = true;
                    uiManager.setGameState('GAMEOVER');
                }
            }
        } else if (this.gameState === 'MENU') {
            // 在主菜单时保持normal音乐
            musicManager.update(dt / 1000, false);
        }
    };

    uiManager.start();
    console.log('[Main] Game started');
    console.log('[Main] Performance optimizations enabled:');
    console.log('  - Resource preloading with ImageBitmap');
    console.log('  - Layered rendering system');
    console.log('  - Batch rendering');
    console.log('  - Object pooling');
    console.log('  - Memory management');
    console.log('  - Performance monitoring');
})();
