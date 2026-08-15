/**
 * HUDSystem - 游戏内HUD渲染系统
 * 包含资源栏、小地图、单位信息面板、控制按钮
 */
class HUDSystem {
    constructor(ctx, theme) {
        this.ctx = ctx;
        this.theme = theme;
        this.width = ctx.canvas.width;
        this.height = ctx.canvas.height;
        this.visible = false;

        this.resources = { energy: 0, crystal: 0, supply: 0, population: 0, popCap: 0, proximaCoin: 0 };
        this.selectedUnits = [];
        this.proximaCoinRenderer = new ProximaCoinRenderer();
        this.minimapUnits = [];
        this.minimapZones = [];
        this.minimapAsteroidBelts = [];
        this._hoverRetreat = false;
        this.canBlockade = false;
        this.outpostCount = 0;

        this.onControlClick = null;
        this.onRetreatClick = null;
        this.onBuildClick = null;
        this.onUnitSelect = null;
        this.panelBgImage = null;
        this.selectedEnemy = null;
        this.camera = null;

        // 舰船详情下拉面板
        this._showUnitList = false;
        this._unitListAnim = 0; // 0=关闭, 1=展开
        this._unitListTarget = 0;
        this._unitListHoverIdx = -1;
        this._allUnits = [];

        // 状态标签配置
        this._stateConfig = {
            idle:        { label: '空闲',     color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' },
            move:        { label: '调动中',   color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
            attack:      { label: '战斗中',   color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
            attack_base: { label: '攻击基地', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
            patrol:      { label: '巡逻中',   color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
            retreat:     { label: '撤退中',   color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
            reroute:     { label: '重规划中', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
            collecting:  { label: '采集中',   color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
            building:    { label: '建造中',   color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
            blockading:  { label: '封锁中',   color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
            bombarding:  { label: '炮击中',   color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
            waiting_patrol: { label: '等待巡逻中', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
            submitting:  { label: '提交资源', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
            returning:   { label: '基地停泊中', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
            evading:     { label: '规避中',   color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
            dead:        { label: '已损毁',   color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' }
        };

        // 子状态标签配置（显示在主状态标签左侧）
        this._subStateConfig = {
            powerCoordination: { label: '动力协调', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
            reroute:           { label: '重规划',   color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
        };

        // 通知系统
        this._notifications = [];

        // 战报系统
        this._battleReports = [];          // 战报列表
        this._showBattleReport = false;    // 面板展开状态
        this._battleReportAnim = 0;        // 展开动画进度 0-1
        this._battleReportTarget = 0;      // 目标动画值
        this._battleReportNewCount = 0;    // 未读战报数量
        this._battleReportPulse = 0;       // 脉冲动画计时器
        this._battleReportPulseCount = 0;  // 脉冲循环计数
        this._battleReportHover = false;   // 图标悬停状态
        this._battleReportIconScale = 1;   // 图标当前缩放

        // 邮件系统
        this.mailSystem = null;            // 邮件系统引用
        this._showMailPanel = false;       // 邮件面板展开状态
        this._mailPanelAnim = 0;           // 展开动画进度 0-1
        this._mailPanelTarget = 0;         // 目标动画值
        this._mailIconHover = false;       // 邮件图标悬停状态
        this._mailIconScale = 1;           // 图标当前缩放
        this._mailPulse = 0;               // 脉冲动画计时器
        this._mailHoverIndex = -1;         // 邮件列表悬停索引
        this._mailScrollOffset = 0;        // 邮件列表滚动偏移
        this._selectedMailId = null;       // 当前选中的邮件ID
        this._mailClaimBtnHover = false;   // 领取按钮悬停状态
        this._mailBackBtnHover = false;    // 返回按钮悬停状态
        this.gameCore = null;              // GameCore 引用

        // 命令菜单面板
        this._showCommandMenu = false;     // 命令菜单展开状态
        this._commandMenuAnim = 0;         // 展开动画进度 0-1
        this._commandMenuTarget = 0;       // 目标动画值
        this._commandMenuHoverIdx = -1;    // 命令菜单悬停索引
        this._commandMenuClickIdx = -1;    // 命令菜单点击索引

        // 指令按钮（底部中央）
        this._hoverCommandBtn = false;
        this._commandBtnClickAnim = 0;

        // 设备模式缩放因子（手机1.5x，平板1.2x，电脑1.0x）
        this.deviceScale = 1.0;
        if (window.deviceMode === 'phone') this.deviceScale = 1.5;
        else if (window.deviceMode === 'tablet') this.deviceScale = 1.2;

        // 巡逻控制面板
        this._showPatrolPanel = false;
        this._patrolPanelAnim = 0;
        this._patrolPanelTarget = 0;
        this._patrolPanelExpandedGroups = new Set(); // 展开的编队索引
        this._patrolPanelHoverIdx = -1; // 悬停的编队索引
        this._patrolPanelBtnHover = -1; // 悬停的按钮索引 (0=创建, 1=等待区)
        this._patrolPanelDisbandHover = -1; // 悬停的解散按钮
        this._selectedPatrolGroupIndex = -1; // 选中的编队索引（用于设置等待区）

        this.onPatrolCreate = null;
        this.onPatrolWaitingArea = null;

        this.commandMode = 'normal';
        this.cancelBtnRect = { x: 0, y: 0, w: 0, h: 0 };

        // ESC 按钮（左上角 - 模拟键盘 ESC 键）
        this._escBtnHover = false;
        this._escBtnClickAnim = 0;
        this.onEscClick = null;

        // 框选模式切换按钮（底部指令区左侧）
        this._boxSelectBtnHover = false;
        this._boxSelectBtnClickAnim = 0;
        this.boxSelectMode = false;
        this.onBoxSelectToggle = null;
    }

    /**
     * 动态设置设备缩放因子
     * @param {number} scale - 缩放因子
     */
    setDeviceScale(scale) {
        this.deviceScale = scale;
    }

    /**
     * 是否为触控设备（手机/平板），桌面端已有键盘和鼠标无需触控按钮
     * @returns {boolean}
     */
    _isMobileDevice() {
        return window.deviceMode === 'phone' || window.deviceMode === 'tablet';
    }

    /**
     * 添加战报
     * @param {Object} report - 战报对象 { id, time, type, text, color }
     */
    addBattleReport(report) {
        const entry = {
            ...report,
            animOffset: 30,   // 入场动画偏移
            animAlpha: 0,     // 入场动画透明度
            animTimer: 0      // 入场动画计时器
        };
        this._battleReports.unshift(entry);
        // 最多保留20条
        if (this._battleReports.length > 20) {
            this._battleReports.pop();
        }
        // 未读计数增加，触发脉冲
        this._battleReportNewCount++;
        this._battleReportPulse = 0;
        this._battleReportPulseCount = 0;
    }

    /**
     * 设置邮件系统
     * @param {MailSystem} mailSystem - 邮件系统实例
     */
    setMailSystem(mailSystem) {
        this.mailSystem = mailSystem;
        // 监听新邮件事件
        if (this.mailSystem) {
            this.mailSystem.onNewMail = (mail) => {
                this._mailPulse = 0;
                // 添加通知提示
                this.addNotification(`新邮件: ${mail.title}`, mail.color, 3);
            };
            // 监听附件领取事件
            this.mailSystem.onAttachmentClaimed = (mailId, amount) => {
                if (this.gameCore) {
                    this.gameCore.addProximaCoin(amount);
                }
                this.addNotification(`领取成功: ${amount} 比邻星币`, '#a855f7', 3);
            };
        }
    }

    /**
     * 设置 GameCore 引用
     * @param {GameCore} gameCore - GameCore 实例
     */
    setGameCore(gameCore) {
        this.gameCore = gameCore;
    }

    /**
     * 添加通知消息
     * @param {string} text - 通知文本
     * @param {string} color - 字体颜色
     * @param {number} duration - 显示时长(秒)
     */
    addNotification(text, color = '#fbbf24', duration = 3) {
        this._notifications.push({
            text,
            color,
            duration,
            timer: 0,
            alpha: 0,
            yOffset: 20,
            progress: 1
        });
        // 最多保留5条通知
        if (this._notifications.length > 5) {
            this._notifications.shift();
        }
    }

    /**
     * 更新通知动画
     * @param {number} dt - 时间增量(秒)
     */
    _updateNotifications(dt) {
        for (let i = this._notifications.length - 1; i >= 0; i--) {
            const n = this._notifications[i];
            n.timer += dt;

            // 入场动画 (前0.3秒) - stagger：多条通知依次进入，每条延迟 0.1 秒
            const staggerDelay = i * 0.1;
            const adjustedTimer = Math.max(0, n.timer - staggerDelay);

            if (adjustedTimer < 0.3) {
                const t = adjustedTimer / 0.3;
                // easeOutCubic
                const easedT = 1 - Math.pow(1 - t, 3);
                n.alpha = easedT;
                n.yOffset = 20 * (1 - easedT);
                n.progress = 1;
            }
            // 停留阶段（进度条减少）
            else if (n.timer < n.duration - 0.5) {
                n.alpha = 1;
                n.yOffset = 0;
                n.progress = 1 - (n.timer - 0.3) / (n.duration - 0.8);
            }
            // 退场动画 (最后0.5秒)
            else if (n.timer < n.duration) {
                const t = (n.timer - (n.duration - 0.5)) / 0.5;
                n.alpha = 1 - t;
                n.yOffset = -10 * t;
                n.progress = 0;
            }
            // 移除
            else {
                this._notifications.splice(i, 1);
            }
        }
    }

    /**
     * 渲染通知消息（右下角）
     */
    _renderNotifications() {
        if (this._notifications.length === 0) return;

        const ctx = this.ctx;
        const ds = this.deviceScale;
        const pad = Math.round(20 * ds);
        const lineH = Math.round(44 * ds);
        const maxW = Math.round(420 * ds);
        const startX = this.width - maxW - pad;
        const startY = this.height - Math.round(500 * ds);

        ctx.save();
        ctx.font = `bold ${Math.round(18 * ds)}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < this._notifications.length; i++) {
            const n = this._notifications[i];
            const y = startY - i * lineH + n.yOffset;

            // 测量文本宽度
            const textW = ctx.measureText(n.text).width;
            const boxW = textW + pad * 2;
            const boxH = Math.round(38 * ds);
            const boxX = startX + maxW - boxW;
            const boxY = y - boxH / 2;

            // 背景面板
            ctx.fillStyle = `rgba(17, 24, 39, ${0.92 * n.alpha})`;
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, Math.round(8 * ds));
            ctx.fill();

            // 左边黄色指示条
            ctx.fillStyle = `rgba(251, 191, 36, ${n.alpha})`;
            ctx.fillRect(boxX, boxY, Math.round(5 * ds), boxH);

            // 文字
            ctx.fillStyle = this._hexToRgba(n.color, n.alpha);
            ctx.fillText(n.text, boxX + pad + Math.round(6 * ds), y);

            // 底部进度条
            const barH = Math.round(3 * ds);
            const barY = boxY + boxH - barH;
            const barW = boxW * Math.max(0, n.progress);
            // 进度条背景
            ctx.fillStyle = `rgba(255, 255, 255, ${0.1 * n.alpha})`;
            ctx.fillRect(boxX, barY, boxW, barH);
            // 进度条填充
            ctx.fillStyle = `rgba(251, 191, 36, ${0.8 * n.alpha})`;
            ctx.fillRect(boxX, barY, barW, barH);
        }

        ctx.restore();
    }

    _hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    updateSelectedEnemy(enemy) {
        this.selectedEnemy = enemy || null;
    }

    setPanelBgImage(img) {
        this.panelBgImage = img;
    }

    init(input) {
        this.input = input;
        input.on('mouseMove', this._onMouseMove.bind(this));
        input.on('mouseClick', this._onMouseClick.bind(this));
    }

    /**
     * 更新所有单位列表（用于舰船详情面板）
     * @param {Array} units - 所有友方单位
     */
    updateAllUnits(units) {
        this._allUnits = units || [];
    }

    /**
     * 获取当前可用命令列表（用于命令菜单）
     * @returns {Array} - 命令列表 { key, label, text, shortcut }
     */
    getAvailableCommands() {
        const commands = [];
        const hasSelection = this.selectedUnits.length > 0;
        const allEngineers = hasSelection && this.selectedUnits.every(u => u.type === 'engineer');
        const hasCombat = hasSelection && this.selectedUnits.some(u => u.type !== 'engineer');
        const hasBattleship = hasSelection && this.selectedUnits.some(u => u.type === 'battleship');

        if (hasSelection) {
            commands.push(
                { key: 'move', label: 'M', text: '移动', shortcut: 'M' },
                { key: 'stop', label: 'S', text: '停止', shortcut: 'S' }
            );

            if (hasCombat) {
                commands.push(
                    { key: 'attack', label: 'A', text: '攻击', shortcut: 'A' },
                    { key: 'patrol', label: 'P', text: '巡逻', shortcut: 'P' },
                    { key: 'blockade', label: 'L', text: '封锁', shortcut: 'L' }
                );
                if (hasBattleship) {
                    commands.push({ key: 'artillery', label: 'G', text: '炮火打击', shortcut: 'G' });
                }
            }

            if (allEngineers) {
                commands.push(
                    { key: 'collect', label: 'C', text: '采集资源', shortcut: 'C' },
                    { key: 'build_outpost', label: 'O', text: '建造前哨站', shortcut: 'O' }
                );
            }

            if (hasCombat) {
                commands.push(
                    { key: 'build_fighter', label: 'F', text: '建造战机', shortcut: 'F', cost: '100能量 50晶体' },
                    { key: 'build_battleship', label: 'B', text: '建造战舰', shortcut: 'B', cost: '200能量 100晶体' }
                );
            }

            commands.push(
                { key: 'build_engineer', label: 'E', text: '建造工程船', shortcut: 'E', cost: '80能量 40晶体' }
            );
        } else {
            commands.push(
                { key: 'build_fighter', label: 'F', text: '建造战机', shortcut: 'F', cost: '100能量 50晶体' },
                { key: 'build_battleship', label: 'B', text: '建造战舰', shortcut: 'B', cost: '200能量 100晶体' },
                { key: 'build_engineer', label: 'E', text: '建造工程船', shortcut: 'E', cost: '80能量 40晶体' }
            );
        }

        return commands;
    }

    /**
     * 切换命令菜单显示状态
     */
    toggleCommandMenu() {
        this._showCommandMenu = !this._showCommandMenu;
        this._commandMenuTarget = this._showCommandMenu ? 1 : 0;
        this._commandMenuHoverIdx = -1;
        this._commandMenuClickIdx = -1;
    }

    /**
     * 关闭命令菜单
     */
    closeCommandMenu() {
        this._showCommandMenu = false;
        this._commandMenuTarget = 0;
        this._commandMenuHoverIdx = -1;
        this._commandMenuClickIdx = -1;
    }

    /**
     * 切换巡逻控制面板显示状态
     */
    togglePatrolPanel() {
        this._showPatrolPanel = !this._showPatrolPanel;
        this._patrolPanelTarget = this._showPatrolPanel ? 1 : 0;
        if (!this._showPatrolPanel) {
            this._patrolPanelHoverIdx = -1;
            this._patrolPanelBtnHover = -1;
            this._patrolPanelDisbandHover = -1;
        }
    }

    /**
     * 关闭巡逻控制面板
     */
    closePatrolPanel() {
        this._showPatrolPanel = false;
        this._patrolPanelTarget = 0;
        this._patrolPanelHoverIdx = -1;
        this._patrolPanelBtnHover = -1;
        this._patrolPanelDisbandHover = -1;
    }

    handleCancelTap() {
        this.commandMode = 'normal';
    }

    /**
     * 返回巡逻控制面板是否打开
     * @returns {boolean}
     */
    isPatrolPanelOpen() {
        return this._showPatrolPanel;
    }

    _onMouseMove(data) {
        if (!this.visible) return;
        this._hoverRetreat = false;
        this._unitListHoverIdx = -1;
        this._battleReportHover = false;
        this._commandMenuHoverIdx = -1;
        this._hoverCommandBtn = false;
        this._patrolPanelHoverIdx = -1;
        this._patrolPanelBtnHover = -1;
        this._patrolPanelDisbandHover = -1;
        this._escBtnHover = false;
        this._boxSelectBtnHover = false;

        if (this._isMobileDevice()) {
            // 检查 ESC 按钮悬停
            const escBtn = this._getEscButtonRect();
            if (data.x >= escBtn.x && data.x <= escBtn.x + escBtn.w &&
                data.y >= escBtn.y && data.y <= escBtn.y + escBtn.h) {
                this._escBtnHover = true;
                return;
            }

            // 检查框选按钮悬停
            const boxBtn = this._getBoxSelectButtonRect();
            if (data.x >= boxBtn.x && data.x <= boxBtn.x + boxBtn.w &&
                data.y >= boxBtn.y && data.y <= boxBtn.y + boxBtn.h) {
                this._boxSelectBtnHover = true;
                return;
            }
        }

        // 检查指令按钮悬停
        const cmdBtn = this._getCommandButtonRect();
        if (data.x >= cmdBtn.x && data.x <= cmdBtn.x + cmdBtn.w &&
            data.y >= cmdBtn.y && data.y <= cmdBtn.y + cmdBtn.h) {
            this._hoverCommandBtn = true;
            return;
        }

        // 检查命令菜单悬停
        if (this._showCommandMenu && this._commandMenuAnim > 0.5) {
            const rect = this._getCommandMenuRect();
            if (data.x >= rect.x && data.x <= rect.x + rect.w &&
                data.y >= rect.y && data.y <= rect.y + rect.h) {
                const commands = this.getAvailableCommands();
                const itemY = rect.y + rect.headerH + rect.pad;
                const idx = Math.floor((data.y - itemY) / rect.itemH);
                if (idx >= 0 && idx < commands.length) {
                    this._commandMenuHoverIdx = idx;
                }
                return;
            }
        }

        // 检查战报图标悬停
        const brBtn = this._getBattleReportIconRect();
        if (data.x >= brBtn.x && data.x <= brBtn.x + brBtn.w &&
            data.y >= brBtn.y && data.y <= brBtn.y + brBtn.h) {
            this._battleReportHover = true;
            return;
        }

        // 检查撤退按钮悬停
        if (this.selectedUnits.length > 0) {
            const panelW = this.theme.layout.unitPanelWidth;
            const pad = this.theme.layout.padding;
            const x = this.width - panelW - pad;
            const y = this.height - 220 - pad;
            const h = 220;
            const retreatW = panelW - pad * 2;
            const retreatH = 28;
            const retreatX = x + pad;
            const retreatY = y + h - retreatH - pad;
            if (data.x >= retreatX && data.x <= retreatX + retreatW &&
                data.y >= retreatY && data.y <= retreatY + retreatH) {
                this._hoverRetreat = true;
            }
        }

        // 检查舰船详情下拉列表项悬停
        if (this._showUnitList && this._unitListAnim > 0.5) {
            const listRect = this._getUnitListRect();
            const headerH = 36;
            const itemH = 28;
            if (data.x >= listRect.x && data.x <= listRect.x + listRect.w &&
                data.y >= listRect.y + headerH && data.y <= listRect.y + listRect.h) {
                const idx = Math.floor((data.y - listRect.y - headerH) / itemH);
                if (idx >= 0 && idx < this._allUnits.length) {
                    this._unitListHoverIdx = idx;
                }
            }
        }

        // 检查巡逻控制面板悬停
        if (this._showPatrolPanel && this._patrolPanelAnim > 0.5) {
            const rect = this._getPatrolPanelRect();
            if (data.x >= rect.x && data.x <= rect.x + rect.w &&
                data.y >= rect.y && data.y <= rect.y + rect.h) {
                const groups = this.gameCore ? this.gameCore.patrolTaskGroups : [];
                const headerH = 52;
                const sectionTitleH = 32;
                const itemH = 36;
                const pad = 20;
                let currentY = rect.y + headerH;

                // 编队详情区域
                currentY += sectionTitleH;
                for (let i = 0; i < groups.length; i++) {
                    const groupY = currentY;
                    if (data.y >= groupY && data.y <= groupY + itemH) {
                        // 检查解散按钮悬停
                        const disbandW = 52;
                        const disbandX = rect.x + rect.w - pad - disbandW;
                        if (data.x >= disbandX && data.x <= disbandX + disbandW) {
                            this._patrolPanelDisbandHover = i;
                        } else {
                            this._patrolPanelHoverIdx = i;
                        }
                        return;
                    }
                    currentY += itemH;
                    // 展开的单位列表
                    if (this._patrolPanelExpandedGroups.has(i)) {
                        const unitCount = groups[i].units ? groups[i].units.length : 0;
                        currentY += unitCount * 26 + 10;
                    }
                }

                // 空列表时调整currentY
                if (groups.length === 0) {
                    currentY += 70;
                }

                // 底部按钮
                currentY += 20;
                const btnH = 40;
                const btnW = (rect.w - pad * 3) / 2;
                for (let i = 0; i < 2; i++) {
                    const btnX = rect.x + pad + i * (btnW + pad);
                    if (data.x >= btnX && data.x <= btnX + btnW &&
                        data.y >= currentY && data.y <= currentY + btnH) {
                        this._patrolPanelBtnHover = i;
                        return;
                    }
                }
            }
        }
    }

    /**
     * 获取舰船详情下拉面板矩形区域
     * @returns {{x:number, y:number, w:number, h:number}}
     */
    _getUnitListRect() {
        const ds = this.deviceScale;
        const pad = this.theme.layout.padding;
        const listW = Math.round(200 * ds);
        const listMaxH = Math.min(this._allUnits.length * Math.round(28 * ds) + Math.round(36 * ds), Math.round(280 * ds));
        const x = this.width / 2 - listW / 2;
        const y = this.height - Math.round(60 * ds) - pad - listMaxH;
        return { x, y, w: listW, h: listMaxH };
    }

    /**
     * 检查坐标是否在HUD交互区域内（控制按钮、单位面板、小地图、资源栏、舰船详情下拉）
     * @param {number} x - 屏幕X坐标
     * @param {number} y - 屏幕Y坐标
     * @returns {boolean}
     */
    isPointOnHUD(x, y) {
        if (!this.visible) return false;

        // 检查资源栏
        if (y <= this.theme.layout.resourceBarHeight) return true;

        // 检查指令按钮区域
        const cmdBtn = this._getCommandButtonRect();
        if (x >= cmdBtn.x && x <= cmdBtn.x + cmdBtn.w &&
            y >= cmdBtn.y && y <= cmdBtn.y + cmdBtn.h) {
            return true;
        }

        // 检查小地图区域
        const minimapSize = this.theme.layout.minimapSize;
        const pad = this.theme.layout.padding;
        const minimapX = pad;
        const minimapY = this.height - minimapSize - pad;
        if (x >= minimapX && x <= minimapX + minimapSize &&
            y >= minimapY && y <= minimapY + minimapSize) {
            return true;
        }

        // 检查单位面板区域
        const panelW = this.theme.layout.unitPanelWidth;
        const panelX = this.width - panelW - pad;
        const panelY = this.height - 220 - pad;
        const panelH = 220;
        if (x >= panelX && x <= panelX + panelW &&
            y >= panelY && y <= panelY + panelH) {
            return true;
        }

        // 检查舰船详情下拉面板
        if (this._showUnitList && this._unitListAnim > 0.01) {
            const listRect = this._getUnitListRect();
            if (x >= listRect.x && x <= listRect.x + listRect.w &&
                y >= listRect.y && y <= listRect.y + listRect.h) {
                return true;
            }
        }

        // 检查战报图标和面板区域
        const brBtn = this._getBattleReportIconRect();
        if (x >= brBtn.x && x <= brBtn.x + brBtn.w &&
            y >= brBtn.y && y <= brBtn.y + brBtn.h) {
            return true;
        }
        if (this._showBattleReport && this._battleReportAnim > 0.01) {
            const panelRect = this._getBattleReportPanelRect();
            if (x >= panelRect.x && x <= panelRect.x + panelRect.w &&
                y >= panelRect.y && y <= panelRect.y + panelRect.h) {
                return true;
            }
        }

        // 检查邮件图标和面板区域
        if (this.handleMailMouseMove(x, y)) {
            return true;
        }

        // 检查命令菜单区域
        if (this._showCommandMenu && this._commandMenuAnim > 0.01) {
            const rect = this._getCommandMenuRect();
            if (x >= rect.x && x <= rect.x + rect.w &&
                y >= rect.y && y <= rect.y + rect.h) {
                return true;
            }
        }

        // 检查巡逻控制面板区域
        if (this._showPatrolPanel && this._patrolPanelAnim > 0.01) {
            const rect = this._getPatrolPanelRect();
            if (x >= rect.x && x <= rect.x + rect.w &&
                y >= rect.y && y <= rect.y + rect.h) {
                return true;
            }
        }

        return false;
    }

    _onMouseClick(data) {
        if (!this.visible || data.button !== 0) return;

        // 检查 ESC 按钮点击（仅触控设备）
        if (this._isMobileDevice()) {
            const escBtn = this._getEscButtonRect();
            if (data.x >= escBtn.x && data.x <= escBtn.x + escBtn.w &&
                data.y >= escBtn.y && data.y <= escBtn.y + escBtn.h) {
                this._escBtnClickAnim = 1;
                setTimeout(() => this._escBtnClickAnim = 0, 150);
                if (this.onEscClick) this.onEscClick();
                data.hudHandled = true;
                return;
            }
        }

        // 检查框选模式切换按钮点击（仅触控设备）
        if (this._isMobileDevice()) {
            const boxBtn = this._getBoxSelectButtonRect();
            if (data.x >= boxBtn.x && data.x <= boxBtn.x + boxBtn.w &&
                data.y >= boxBtn.y && data.y <= boxBtn.y + boxBtn.h) {
                this._boxSelectBtnClickAnim = 1;
                setTimeout(() => this._boxSelectBtnClickAnim = 0, 150);
                this.boxSelectMode = !this.boxSelectMode;
                if (this.onBoxSelectToggle) this.onBoxSelectToggle(this.boxSelectMode);
                data.hudHandled = true;
                return;
            }
        }

        // 检查指令按钮点击
        const cmdBtn = this._getCommandButtonRect();
        if (data.x >= cmdBtn.x && data.x <= cmdBtn.x + cmdBtn.w &&
            data.y >= cmdBtn.y && data.y <= cmdBtn.y + cmdBtn.h) {
            this._commandBtnClickAnim = 1;
            setTimeout(() => this._commandBtnClickAnim = 0, 150);
            this.toggleCommandMenu();
            data.hudHandled = true;
            return;
        }

        // 检查命令菜单点击
        if (this._showCommandMenu && this._commandMenuAnim > 0.5) {
            const rect = this._getCommandMenuRect();
            if (data.x >= rect.x && data.x <= rect.x + rect.w &&
                data.y >= rect.y && data.y <= rect.y + rect.h) {
                const itemY = rect.y + rect.headerH + rect.pad;
                const idx = Math.floor((data.y - itemY) / rect.itemH);
                const commands = this.getAvailableCommands();
                if (idx >= 0 && idx < commands.length) {
                    this._commandMenuClickIdx = idx;
                    setTimeout(() => this._commandMenuClickIdx = -1, 100);
                    this._executeCommand(commands[idx].key);
                }
                data.hudHandled = true;
                return;
            }
            // 点击命令菜单外部关闭菜单
            this.closeCommandMenu();
            data.hudHandled = true;
            return;
        }

        // 检查战报图标点击
        const brBtn = this._getBattleReportIconRect();
        if (data.x >= brBtn.x && data.x <= brBtn.x + brBtn.w &&
            data.y >= brBtn.y && data.y <= brBtn.y + brBtn.h) {
            this._showBattleReport = !this._showBattleReport;
            this._battleReportTarget = this._showBattleReport ? 1 : 0;
            if (this._showBattleReport) {
                this._battleReportNewCount = 0;
            }
            data.hudHandled = true;
            return;
        }

        // 战报面板展开时，点击面板外部关闭面板
        if (this._showBattleReport && this._battleReportAnim > 0.5) {
            const panelRect = this._getBattleReportPanelRect();
            if (data.x < panelRect.x || data.x > panelRect.x + panelRect.w ||
                data.y < panelRect.y || data.y > panelRect.y + panelRect.h) {
                this._showBattleReport = false;
                this._battleReportTarget = 0;
                data.hudHandled = true;
                return;
            }
        }

        // 检查邮件图标和面板点击
        if (this.handleMailMouseClick(data.x, data.y)) {
            data.hudHandled = true;
            return;
        }

        // 检查舰船详情下拉列表项点击
        if (this._showUnitList && this._unitListAnim > 0.5) {
            const listRect = this._getUnitListRect();
            if (data.x >= listRect.x && data.x <= listRect.x + listRect.w &&
                data.y >= listRect.y && data.y <= listRect.y + listRect.h) {
                const itemH = 28;
                const headerH = 36;
                if (data.y >= listRect.y + headerH) {
                    const idx = Math.floor((data.y - listRect.y - headerH) / itemH);
                    if (idx >= 0 && idx < this._allUnits.length) {
                        const unit = this._allUnits[idx];
                        if (this.onUnitSelect) this.onUnitSelect(unit);
                    }
                }
                data.hudHandled = true;
                return;
            }
        }

        // 检查巡逻控制面板点击
        if (this._showPatrolPanel && this._patrolPanelAnim > 0.5) {
            const rect = this._getPatrolPanelRect();
            if (data.x >= rect.x && data.x <= rect.x + rect.w &&
                data.y >= rect.y && data.y <= rect.y + rect.h) {
                const groups = this.gameCore ? this.gameCore.patrolTaskGroups : [];
                const headerH = 52;
                const sectionTitleH = 32;
                const itemH = 36;
                const pad = 20;
                let currentY = rect.y + headerH;

                // 编队详情区域
                currentY += sectionTitleH;
                for (let i = 0; i < groups.length; i++) {
                    const groupY = currentY;
                    if (data.y >= groupY && data.y <= groupY + itemH) {
                        const disbandW = 52;
                        const disbandX = rect.x + rect.w - pad - disbandW;
                        if (data.x >= disbandX && data.x <= disbandX + disbandW) {
                            // 点击解散按钮
                            if (this.gameCore && this.gameCore.disbandPatrolGroup) {
                                this.gameCore.disbandPatrolGroup(i);
                            }
                        } else {
                            // 点击编队名称 - 选中该编队并展开/收起
                            this._selectedPatrolGroupIndex = i;
                            if (this._patrolPanelExpandedGroups.has(i)) {
                                this._patrolPanelExpandedGroups.delete(i);
                            } else {
                                this._patrolPanelExpandedGroups.add(i);
                            }
                        }
                        data.hudHandled = true;
                        return;
                    }
                    currentY += itemH;
                    if (this._patrolPanelExpandedGroups.has(i)) {
                        const unitCount = groups[i].units ? groups[i].units.length : 0;
                        currentY += unitCount * 26 + 10;
                    }
                }

                // 空列表时调整currentY
                if (groups.length === 0) {
                    currentY += 70;
                }

                // 底部按钮
                currentY += 20;
                const btnH = 40;
                const btnW = (rect.w - pad * 3) / 2;
                for (let i = 0; i < 2; i++) {
                    const btnX = rect.x + pad + i * (btnW + pad);
                    if (data.x >= btnX && data.x <= btnX + btnW &&
                        data.y >= currentY && data.y <= currentY + btnH) {
                        if (i === 0) {
                            // 创建新巡逻编队
                            this.closePatrolPanel();
                            if (this.onPatrolCreate) this.onPatrolCreate();
                        } else {
                            // 加入等待区 - 需要选中一个编队
                            // 如果用户未选中编队但只有一个编队，自动选中该编队
                            const groups = this.gameCore ? this.gameCore.patrolTaskGroups : [];
                            if (this._selectedPatrolGroupIndex < 0) {
                                if (groups.length === 1) {
                                    this._selectedPatrolGroupIndex = 0;
                                } else {
                                    // 未选中编队且有多于一个编队，提示用户
                                    console.log('[HUDSystem] 请先点击选中一个编队，再点击"加入等待区"按钮');
                                    data.hudHandled = true;
                                    return;
                                }
                            }
                            this.closePatrolPanel();
                            if (this.onPatrolWaitingArea) this.onPatrolWaitingArea(this._selectedPatrolGroupIndex);
                        }
                        data.hudHandled = true;
                        return;
                    }
                }
                data.hudHandled = true;
                return;
            }
            // 点击面板外部关闭面板
            this.closePatrolPanel();
            data.hudHandled = true;
            return;
        }

        // 检查撤退按钮点击
        if (this.selectedUnits.length > 0) {
            const panelW = this.theme.layout.unitPanelWidth;
            const pad = this.theme.layout.padding;
            const x = this.width - panelW - pad;
            const y = this.height - 220 - pad;
            const h = 220;
            const retreatW = panelW - pad * 2;
            const retreatH = 28;
            const retreatX = x + pad;
            const retreatY = y + h - retreatH - pad;
            if (data.x >= retreatX && data.x <= retreatX + retreatW &&
                data.y >= retreatY && data.y <= retreatY + retreatH) {
                if (this.onRetreatClick) this.onRetreatClick();
                data.hudHandled = true;
                return;
            }
        }
    }

    /**
     * 执行命令（通过命令菜单或快捷键）
     * @param {string} key - 命令键
     */
    _executeCommand(key) {
        switch (key) {
            case 'move':
                if (this.onControlClick) this.onControlClick('move');
                break;
            case 'attack':
                if (this.onControlClick) this.onControlClick('attack');
                break;
            case 'stop':
                if (this.onControlClick) this.onControlClick('stop');
                break;
            case 'patrol':
                this.togglePatrolPanel();
                break;
            case 'blockade':
                if (this.onControlClick) this.onControlClick('blockade');
                break;
            case 'artillery':
                if (this.onControlClick) this.onControlClick('artillery');
                break;
            case 'collect':
                if (this.onControlClick) this.onControlClick('collect');
                break;
            case 'build_outpost':
                if (this.onControlClick) this.onControlClick('build_outpost');
                break;
            case 'build_fighter':
                if (this.onBuildClick) this.onBuildClick('fighter');
                break;
            case 'build_battleship':
                if (this.onBuildClick) this.onBuildClick('battleship');
                break;
            case 'build_engineer':
                if (this.onBuildClick) this.onBuildClick('engineer');
                break;
        }
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
    }

    render() {
        if (!this.visible) return;
        this._renderResourceBar();
        this._renderMinimap();
        this._renderUnitPanel();
        this._renderUnitList();
        this._renderNotifications();
        this._renderBattleReport();
        this._renderMailPanel();
        this._renderCommandMenu();
        this._renderPatrolControlPanel();
        this._renderPatrolCountSelector();
        this._renderCancelButton();
        this._renderCommandButton();
        this._renderBoxSelectButton();
        this._renderEscButton();
    }

    /**
     * 更新下拉动画
     * @param {number} dt - 时间增量(秒)
     */
    update(dt) {
        if (!this.visible) return;
        // 平滑动画插值 - easeOutBack 缓动用于舰船列表面板
        const diff = this._unitListTarget - this._unitListAnim;
        if (Math.abs(diff) > 0.001) {
            // 使用 easeOutBack 缓动，更流畅的展开/收起
            const t = Math.min(1, 8 * dt);
            this._unitListAnim += diff * t;
        } else {
            this._unitListAnim = this._unitListTarget;
        }
        // 更新通知动画
        this._updateNotifications(dt);
        // 更新战报动画
        this._updateBattleReport(dt);
        // 更新邮件面板动画
        this._updateMailPanel(dt);
        // 更新命令菜单动画
        this._updateCommandMenu(dt);
        // 更新巡逻控制面板动画
        this._updatePatrolPanel(dt);
        // 更新指令按钮点击动画
        if (this._commandBtnClickAnim > 0) {
            this._commandBtnClickAnim = Math.max(0, this._commandBtnClickAnim - dt * 8);
        }
        // 更新 ESC 按钮点击动画
        if (this._escBtnClickAnim > 0) {
            this._escBtnClickAnim = Math.max(0, this._escBtnClickAnim - dt * 8);
        }
        // 更新框选按钮点击动画
        if (this._boxSelectBtnClickAnim > 0) {
            this._boxSelectBtnClickAnim = Math.max(0, this._boxSelectBtnClickAnim - dt * 8);
        }
    }

    /**
     * 更新巡逻控制面板动画
     * @param {number} dt - 时间增量(秒)
     */
    _updatePatrolPanel(dt) {
        const diff = this._patrolPanelTarget - this._patrolPanelAnim;
        if (Math.abs(diff) > 0.001) {
            const t = Math.min(1, 12 * dt);
            this._patrolPanelAnim += diff * t;
        } else {
            this._patrolPanelAnim = this._patrolPanelTarget;
        }
    }

    /**
     * 更新命令菜单动画
     * @param {number} dt - 时间增量(秒)
     */
    _updateCommandMenu(dt) {
        const diff = this._commandMenuTarget - this._commandMenuAnim;
        if (Math.abs(diff) > 0.001) {
            const t = Math.min(1, 12 * dt);
            this._commandMenuAnim += diff * t;
        } else {
            this._commandMenuAnim = this._commandMenuTarget;
        }
    }

    /**
     * 获取巡逻控制面板矩形区域
     * @returns {{x:number, y:number, w:number, h:number}}
     */
    _getPatrolPanelRect() {
        const ds = this.deviceScale;
        const panelW = Math.round(420 * ds);
        const groups = this.gameCore ? this.gameCore.patrolTaskGroups : [];
        const pad = Math.round(20 * ds);
        const headerH = Math.round(52 * ds);
        const sectionTitleH = Math.round(32 * ds);
        const itemH = Math.round(36 * ds);
        const btnH = Math.round(40 * ds);
        let contentH = sectionTitleH;
        for (let i = 0; i < groups.length; i++) {
            contentH += itemH;
            if (this._patrolPanelExpandedGroups.has(i)) {
                const unitCount = groups[i].units ? groups[i].units.length : 0;
                contentH += unitCount * Math.round(26 * ds) + Math.round(10 * ds);
            }
        }
        contentH += Math.round(20 * ds) + btnH + pad;
        const panelH = Math.min(Math.max(headerH + contentH, Math.round(220 * ds)), this.height - Math.round(100 * ds));
        const x = (this.width - panelW) / 2;
        const y = (this.height - panelH) / 2;
        return { x, y, w: panelW, h: panelH };
    }

    /**
     * 绘制六边形切角面板路径
     */
    _drawHexPanelPath(ctx, x, y, w, h, cornerCut) {
        ctx.beginPath();
        ctx.moveTo(x + cornerCut, y);
        ctx.lineTo(x + w - cornerCut, y);
        ctx.lineTo(x + w, y + cornerCut);
        ctx.lineTo(x + w, y + h - cornerCut);
        ctx.lineTo(x + w - cornerCut, y + h);
        ctx.lineTo(x + cornerCut, y + h);
        ctx.lineTo(x, y + h - cornerCut);
        ctx.lineTo(x, y + cornerCut);
        ctx.closePath();
    }

    /**
     * 绘制三角形按钮路径
     */
    _drawTriButtonPath(ctx, x, y, w, h, direction) {
        ctx.beginPath();
        if (direction === 'right') {
            ctx.moveTo(x, y);
            ctx.lineTo(x + w - 8, y + h / 2);
            ctx.lineTo(x, y + h);
        } else if (direction === 'left') {
            ctx.moveTo(x + w, y);
            ctx.lineTo(x + 8, y + h / 2);
            ctx.lineTo(x + w, y + h);
        } else {
            ctx.moveTo(x + w / 2, y);
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x, y + h);
        }
        ctx.closePath();
    }

    /**
     * 绘制扫描线效果
     */
    _drawScanLine(ctx, x, y, w, h, time) {
        const scanY = y + (time % 3000) / 3000 * h;
        const gradient = ctx.createLinearGradient(0, scanY - 10, 0, scanY + 10);
        gradient.addColorStop(0, 'rgba(0, 212, 255, 0)');
        gradient.addColorStop(0.5, 'rgba(0, 212, 255, 0.15)');
        gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, scanY - 10, w, 20);
        ctx.fillStyle = 'rgba(0, 212, 255, 0.4)';
        ctx.fillRect(x, scanY, w, 1);
    }

    /**
     * 绘制星空背景纹理
     */
    _drawStarfield(ctx, x, y, w, h, seed) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        const stars = [
            { sx: 0.12, sy: 0.08, sr: 1.2 }, { sx: 0.35, sy: 0.15, sr: 0.8 },
            { sx: 0.67, sy: 0.05, sr: 1.0 }, { sx: 0.88, sy: 0.22, sr: 0.6 },
            { sx: 0.05, sy: 0.35, sr: 0.9 }, { sx: 0.45, sy: 0.42, sr: 1.1 },
            { sx: 0.72, sy: 0.38, sr: 0.7 }, { sx: 0.92, sy: 0.48, sr: 1.0 },
            { sx: 0.18, sy: 0.58, sr: 0.8 }, { sx: 0.55, sy: 0.65, sr: 1.2 },
            { sx: 0.82, sy: 0.72, sr: 0.6 }, { sx: 0.25, sy: 0.78, sr: 1.0 },
            { sx: 0.62, sy: 0.88, sr: 0.9 }, { sx: 0.95, sy: 0.92, sr: 0.7 },
            { sx: 0.08, sy: 0.95, sr: 1.1 }
        ];
        for (const star of stars) {
            const px = x + star.sx * w;
            const py = y + star.sy * h;
            const pulse = Math.sin((Date.now() / 1000 + star.sx * 10) * 2) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(200, 220, 255, ${0.4 * pulse})`;
            ctx.beginPath();
            ctx.arc(px, py, star.sr, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    /**
     * 统一面板背景绘制方法
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {number} x - 面板左上角X
     * @param {number} y - 面板左上角Y
     * @param {number} w - 面板宽度
     * @param {number} h - 面板高度
     * @param {string} topColor - 顶部装饰色（如 colors.primary, colors.danger 等）
     */
    _drawPanelBackground(ctx, x, y, w, h, topColor) {
        const colors = this.theme.colors;
        const ds = this.deviceScale;
        const cornerSize = Math.round(4 * ds);

        // 面板背景 - 深色渐变
        const gradient = ctx.createLinearGradient(x, y, x, y + h);
        gradient.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
        gradient.addColorStop(1, 'rgba(11, 15, 25, 0.97)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, w, h);

        // 边框
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);

        // 四角切角装饰 - 小三角
        ctx.fillStyle = topColor || colors.primary;
        this._drawCornerCut(ctx, x, y, cornerSize, 'tl'); // 左上
        this._drawCornerCut(ctx, x + w, y, cornerSize, 'tr'); // 右上
        this._drawCornerCut(ctx, x, y + h, cornerSize, 'bl'); // 左下
        this._drawCornerCut(ctx, x + w, y + h, cornerSize, 'br'); // 右下

        // 顶部发光横线
        const lineGradient = ctx.createLinearGradient(x, y, x + w, y);
        lineGradient.addColorStop(0, 'rgba(96, 165, 250, 0)');
        lineGradient.addColorStop(0.2, 'rgba(96, 165, 250, 0.6)');
        lineGradient.addColorStop(0.5, topColor || colors.primary);
        lineGradient.addColorStop(0.8, 'rgba(96, 165, 250, 0.6)');
        lineGradient.addColorStop(1, 'rgba(96, 165, 250, 0)');
        ctx.fillStyle = lineGradient;
        ctx.fillRect(x, y, w, Math.round(2 * ds));
    }

    _drawCornerCut(ctx, x, y, size, corner) {
        // 绘制角落小三角装饰
        const dx = (corner === 'tr' || corner === 'br') ? -size : size;
        const dy = (corner === 'bl' || corner === 'br') ? -size : size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dx, y);
        ctx.lineTo(x, y + dy);
        ctx.closePath();
        ctx.fill();
    }

    /**
     * 渲染巡逻控制面板 - 科幻太空风格
     */
    _renderPatrolControlPanel() {
        if (this._patrolPanelAnim <= 0.001) return;

        const ctx = this.ctx;
        const colors = this.theme.colors;
        const ds = this.deviceScale;
        const anim = this._patrolPanelAnim;
        const rect = this._getPatrolPanelRect();
        const groups = this.gameCore ? this.gameCore.patrolTaskGroups : [];

        ctx.save();

        const easedAnim = this._easeOutCubic(anim);
        const panelAlpha = anim;
        const cornerCut = Math.round(16 * ds);
        const glowColor = '#00d4ff';
        const glowDim = '#00a8e8';

        ctx.globalAlpha = panelAlpha;

        // 深空背景 + 星空
        ctx.fillStyle = 'rgba(6, 10, 20, 0.92)';
        this._drawHexPanelPath(ctx, rect.x, rect.y, rect.w, rect.h, cornerCut);
        ctx.fill();
        this._drawStarfield(ctx, rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);

        // 外发光边框
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = isFinite(easedAnim) ? 12 * easedAnim : 0;
        ctx.strokeStyle = glowDim;
        ctx.lineWidth = 1.5;
        this._drawHexPanelPath(ctx, rect.x, rect.y, rect.w, rect.h, cornerCut);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 内边框
        ctx.strokeStyle = 'rgba(0, 168, 232, 0.3)';
        ctx.lineWidth = 0.5;
        this._drawHexPanelPath(ctx, rect.x + Math.round(4 * ds), rect.y + Math.round(4 * ds), rect.w - Math.round(8 * ds), rect.h - Math.round(8 * ds), cornerCut - Math.round(2 * ds));
        ctx.stroke();

        // 扫描线动画
        this._drawScanLine(ctx, rect.x + Math.round(6 * ds), rect.y + Math.round(6 * ds), rect.w - Math.round(12 * ds), rect.h - Math.round(12 * ds), Date.now());

        // 顶部装饰条
        const headerH = Math.round(52 * ds);
        const topBarGradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y);
        topBarGradient.addColorStop(0, 'rgba(0, 212, 255, 0)');
        topBarGradient.addColorStop(0.3, 'rgba(0, 212, 255, 0.25)');
        topBarGradient.addColorStop(0.7, 'rgba(0, 212, 255, 0.25)');
        topBarGradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
        ctx.fillStyle = topBarGradient;
        ctx.fillRect(rect.x + cornerCut, rect.y + headerH - 2, rect.w - cornerCut * 2, 2);

        // 标题栏 - 科幻字体
        ctx.fillStyle = glowColor;
        ctx.font = `bold ${Math.round(16 * ds)}px "Orbitron", "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 8;
        ctx.fillText('◈ 巡逻控制 ◈', rect.x + rect.w / 2, rect.y + headerH / 2);
        ctx.shadowBlur = 0;

        // 标题下方小字
        ctx.fillStyle = 'rgba(0, 212, 255, 0.5)';
        ctx.font = `${Math.round(10 * ds)}px "Orbitron", "Courier New", monospace`;
        ctx.fillText('PATROL CONTROL SYSTEM', rect.x + rect.w / 2, rect.y + headerH - Math.round(8 * ds));

        // 编队详情标题
        const sectionTitleH = Math.round(32 * ds);
        let currentY = rect.y + headerH + Math.round(4 * ds);
        ctx.fillStyle = glowDim;
        ctx.font = `${Math.round(11 * ds)}px "Orbitron", "Courier New", monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('▸ 编队详情', rect.x + Math.round(20 * ds), currentY + sectionTitleH / 2);
        currentY += sectionTitleH;

        // 编队列表
        const itemH = Math.round(36 * ds);
        const pad = Math.round(20 * ds);
        const disbandW = Math.round(52 * ds);

        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const isHover = i === this._patrolPanelHoverIdx;
            const isExpanded = this._patrolPanelExpandedGroups.has(i);
            const groupY = currentY;

            // 编队项背景 - 交替色 + 悬停发光
            if (isHover) {
                ctx.fillStyle = 'rgba(0, 212, 255, 0.12)';
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 6;
            } else if (i % 2 === 0) {
                ctx.fillStyle = 'rgba(10, 20, 40, 0.6)';
            } else {
                ctx.fillStyle = 'rgba(8, 16, 32, 0.4)';
            }
            ctx.fillRect(rect.x + pad, groupY, rect.w - pad * 2, itemH);
            ctx.shadowBlur = 0;

            // 左侧状态LED条
            const ledColor = isHover ? glowColor : 'rgba(0, 168, 232, 0.4)';
            ctx.fillStyle = ledColor;
            ctx.fillRect(rect.x + pad, groupY, 3, itemH);

            // 展开/收起指示 - 三角形
            ctx.fillStyle = isHover ? glowColor : 'rgba(148, 163, 184, 0.7)';
            ctx.beginPath();
            const triCx = rect.x + pad + Math.round(14 * ds);
            const triCy = groupY + itemH / 2;
            if (isExpanded) {
                ctx.moveTo(triCx - Math.round(4 * ds), triCy - Math.round(3 * ds));
                ctx.lineTo(triCx + Math.round(4 * ds), triCy - Math.round(3 * ds));
                ctx.lineTo(triCx, triCy + Math.round(3 * ds));
            } else {
                ctx.moveTo(triCx - Math.round(2 * ds), triCy - Math.round(4 * ds));
                ctx.lineTo(triCx + Math.round(4 * ds), triCy);
                ctx.lineTo(triCx - Math.round(2 * ds), triCy + Math.round(4 * ds));
            }
            ctx.closePath();
            ctx.fill();

            // 编队名称
            ctx.fillStyle = isHover ? glowColor : colors.text;
            ctx.font = `${Math.round(12 * ds)}px "Orbitron", "Courier New", monospace`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const groupName = `编队-${String(i + 1).padStart(2, '0')}`;
            ctx.fillText(groupName, rect.x + pad + Math.round(26 * ds), groupY + itemH / 2);

            // 单位数量
            const unitCount = group.units ? group.units.length : 0;
            ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
            ctx.font = `${Math.round(10 * ds)}px "Orbitron", "Courier New", monospace`;
            ctx.textAlign = 'right';
            ctx.fillText(`${unitCount} 艘`, rect.x + rect.w - pad - disbandW - Math.round(10 * ds), groupY + itemH / 2);

            // 解散按钮 - 六边形切角
            const disbandX = rect.x + rect.w - pad - disbandW;
            const isDisbandHover = i === this._patrolPanelDisbandHover;
            ctx.fillStyle = isDisbandHover ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.08)';
            this._drawHexPanelPath(ctx, disbandX, groupY + Math.round(6 * ds), disbandW, itemH - Math.round(12 * ds), Math.round(4 * ds));
            ctx.fill();
            ctx.strokeStyle = isDisbandHover ? '#ef4444' : 'rgba(239, 68, 68, 0.35)';
            ctx.lineWidth = 1;
            this._drawHexPanelPath(ctx, disbandX, groupY + Math.round(6 * ds), disbandW, itemH - Math.round(12 * ds), Math.round(4 * ds));
            ctx.stroke();
            ctx.fillStyle = isDisbandHover ? '#ef4444' : 'rgba(239, 68, 68, 0.65)';
            ctx.font = `${Math.round(10 * ds)}px "Orbitron", "Courier New", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('解散', disbandX + disbandW / 2, groupY + itemH / 2);

            currentY += itemH;

            // 展开的单位列表
            if (isExpanded && group.units) {
                const unitListY = currentY + Math.round(5 * ds);
                const unitStepH = Math.round(26 * ds);
                for (let j = 0; j < group.units.length; j++) {
                    const task = group.units[j];
                    const unit = task.unit || task;
                    const unitY = unitListY + j * unitStepH;

                    // 子项背景
                    ctx.fillStyle = 'rgba(15, 25, 45, 0.5)';
                    ctx.fillRect(rect.x + pad + Math.round(20 * ds), unitY, rect.w - pad * 2 - Math.round(20 * ds), Math.round(24 * ds));

                    // 状态LED点 - 带颜色
                    const stateCfg = this._stateConfig[unit.state] || this._stateConfig.idle;
                    const ledDotColor = unit.hp > 0 ? stateCfg.color : '#64748b';
                    ctx.fillStyle = ledDotColor;
                    ctx.shadowColor = ledDotColor;
                    ctx.shadowBlur = 4;
                    ctx.beginPath();
                    ctx.arc(rect.x + pad + Math.round(34 * ds), unitY + Math.round(12 * ds), Math.round(3.5 * ds), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;

                    // 单位名称
                    ctx.fillStyle = unit.hp > 0 ? colors.text : 'rgba(148, 163, 184, 0.5)';
                    ctx.font = `${Math.round(11 * ds)}px "Orbitron", "Courier New", monospace`;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(unit.name || '未知单位', rect.x + pad + Math.round(46 * ds), unitY + Math.round(12 * ds));

                    // HP条 - 科幻风格细条
                    const barW = Math.round(64 * ds);
                    const barH = Math.round(3 * ds);
                    const barX = rect.x + rect.w - pad - barW;
                    const barY = unitY + Math.round(10 * ds);
                    ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
                    ctx.fillRect(barX, barY, barW, barH);
                    const hpRatio = Math.max(0, Math.min(1, (unit.hp || 0) / (unit.maxHp || 100)));
                    const hpColor = hpRatio > 0.5 ? '#22c55e' : (hpRatio > 0.25 ? '#f59e0b' : '#ef4444');
                    ctx.fillStyle = hpColor;
                    ctx.fillRect(barX, barY, barW * hpRatio, barH);
                    // HP条发光
                    if (hpRatio > 0) {
                        ctx.shadowColor = hpColor;
                        ctx.shadowBlur = 3;
                        ctx.fillRect(barX, barY, barW * hpRatio, barH);
                        ctx.shadowBlur = 0;
                    }
                }
                currentY += group.units.length * unitStepH + Math.round(10 * ds);
            }
        }

        // 空列表提示
        if (groups.length === 0) {
            ctx.fillStyle = 'rgba(0, 168, 232, 0.4)';
            ctx.font = `${Math.round(12 * ds)}px "Orbitron", "Courier New", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('◈ 暂无巡逻编队 ◈', rect.x + rect.w / 2, currentY + Math.round(40 * ds));
            currentY += Math.round(70 * ds);
        }

        // 底部按钮区域 - 六边形切角按钮
        currentY += Math.round(20 * ds);
        const btnH = Math.round(40 * ds);
        const btnW = (rect.w - pad * 3) / 2;
        const btnLabels = ['创建编队', '等待区'];
        const btnIcons = ['+', '◈'];

        for (let i = 0; i < 2; i++) {
            const btnX = rect.x + pad + i * (btnW + pad);
            const btnY = currentY;
            const isHover = i === this._patrolPanelBtnHover;

            // 按钮背景 - 六边形切角
            if (isHover) {
                ctx.fillStyle = 'rgba(0, 212, 255, 0.18)';
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 10;
            } else {
                ctx.fillStyle = 'rgba(10, 25, 45, 0.7)';
            }
            this._drawHexPanelPath(ctx, btnX, btnY, btnW, btnH, Math.round(8 * ds));
            ctx.fill();
            ctx.shadowBlur = 0;

            // 按钮边框
            ctx.strokeStyle = isHover ? glowColor : 'rgba(0, 168, 232, 0.4)';
            ctx.lineWidth = isHover ? 1.5 : 1;
            this._drawHexPanelPath(ctx, btnX, btnY, btnW, btnH, Math.round(8 * ds));
            ctx.stroke();

            // 按钮图标 + 文字
            ctx.fillStyle = isHover ? glowColor : 'rgba(200, 220, 255, 0.85)';
            ctx.font = `bold ${isHover ? Math.round(14 * ds) : Math.round(13 * ds)}px "Orbitron", "Courier New", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${btnIcons[i]} ${btnLabels[i]}`, btnX + btnW / 2, btnY + btnH / 2);
        }

        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    /**
     * 渲染巡逻单位数量选择界面 - 科幻太空风格
     */
    _renderPatrolCountSelector() {
        if (this.commandMode !== 'patrol_count_select') return;

        const ctx = this.ctx;
        const colors = this.theme.colors;
        const ds = this.deviceScale;
        const groups = this.gameCore ? this.gameCore.patrolTaskGroups : [];
        if (groups.length === 0) return;

        const lastGroup = groups[groups.length - 1];
        const maxCount = lastGroup.units ? lastGroup.units.length - 1 : 0;
        if (maxCount < 1) return;

        const panelW = Math.round(380 * ds);
        const panelH = Math.round(240 * ds);
        const x = (this.width - panelW) / 2;
        const y = (this.height - panelH) / 2;
        const pad = Math.round(24 * ds);
        const cornerCut = Math.round(14 * ds);
        const glowColor = '#00d4ff';
        const glowDim = '#00a8e8';

        ctx.save();

        // 半透明遮罩背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(0, 0, this.width, this.height);

        // 面板背景 - 六边形切角
        ctx.fillStyle = 'rgba(6, 10, 20, 0.94)';
        this._drawHexPanelPath(ctx, x, y, panelW, panelH, cornerCut);
        ctx.fill();
        this._drawStarfield(ctx, x + 2, y + 2, panelW - 4, panelH - 4);

        // 外发光边框
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = glowDim;
        ctx.lineWidth = 1.5;
        this._drawHexPanelPath(ctx, x, y, panelW, panelH, cornerCut);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 内边框
        ctx.strokeStyle = 'rgba(0, 168, 232, 0.25)';
        ctx.lineWidth = 0.5;
        this._drawHexPanelPath(ctx, x + Math.round(4 * ds), y + Math.round(4 * ds), panelW - Math.round(8 * ds), panelH - Math.round(8 * ds), cornerCut - Math.round(2 * ds));
        ctx.stroke();

        // 扫描线
        this._drawScanLine(ctx, x + Math.round(6 * ds), y + Math.round(6 * ds), panelW - Math.round(12 * ds), panelH - Math.round(12 * ds), Date.now() + 500);

        // 顶部装饰条
        const headerH = Math.round(52 * ds);
        const topBarGradient = ctx.createLinearGradient(x, y, x + panelW, y);
        topBarGradient.addColorStop(0, 'rgba(0, 212, 255, 0)');
        topBarGradient.addColorStop(0.3, 'rgba(0, 212, 255, 0.25)');
        topBarGradient.addColorStop(0.7, 'rgba(0, 212, 255, 0.25)');
        topBarGradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
        ctx.fillStyle = topBarGradient;
        ctx.fillRect(x + cornerCut, y + headerH - 2, panelW - cornerCut * 2, 2);

        // 标题
        ctx.fillStyle = glowColor;
        ctx.font = `bold ${Math.round(15 * ds)}px "Orbitron", "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 8;
        ctx.fillText('◈ 选择巡逻单位数量 ◈', x + panelW / 2, y + headerH / 2);
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(0, 212, 255, 0.45)';
        ctx.font = `${Math.round(10 * ds)}px "Orbitron", "Courier New", monospace`;
        ctx.fillText('UNIT DEPLOYMENT SELECTOR', x + panelW / 2, y + headerH - Math.round(8 * ds));

        // 提示文本
        ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
        ctx.font = `${Math.round(11 * ds)}px "Orbitron", "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`可选范围: 1 - ${maxCount} [数字键选择 / ESC取消]`, x + panelW / 2, y + headerH + Math.round(26 * ds));

        // 数字按钮区域 - 六边形切角按钮
        const btnSize = Math.round(44 * ds);
        const btnGap = Math.round(14 * ds);
        const cols = Math.min(maxCount, 6);
        const rows = Math.ceil(maxCount / cols);
        const gridW = cols * btnSize + (cols - 1) * btnGap;
        const gridH = rows * btnSize + (rows - 1) * btnGap;
        const startX = x + (panelW - gridW) / 2;
        const startY = y + headerH + Math.round(54 * ds);

        for (let i = 1; i <= maxCount; i++) {
            const col = (i - 1) % cols;
            const row = Math.floor((i - 1) / cols);
            const btnX = startX + col * (btnSize + btnGap);
            const btnY = startY + row * (btnSize + btnGap);

            // 按钮背景 - 六边形切角
            ctx.fillStyle = 'rgba(10, 25, 45, 0.7)';
            this._drawHexPanelPath(ctx, btnX, btnY, btnSize, btnSize, Math.round(6 * ds));
            ctx.fill();

            // 按钮边框
            ctx.strokeStyle = 'rgba(0, 168, 232, 0.4)';
            ctx.lineWidth = 1;
            this._drawHexPanelPath(ctx, btnX, btnY, btnSize, btnSize, Math.round(6 * ds));
            ctx.stroke();

            // 数字文字
            ctx.fillStyle = 'rgba(200, 220, 255, 0.9)';
            ctx.font = `bold ${Math.round(15 * ds)}px "Orbitron", "Courier New", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(i.toString(), btnX + btnSize / 2, btnY + btnSize / 2);
        }

        // 底部提示
        ctx.fillStyle = 'rgba(0, 168, 232, 0.4)';
        ctx.font = `${Math.round(10 * ds)}px "Orbitron", "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('◈ 选择要分配到等待区的单位数量 ◈', x + panelW / 2, y + panelH - Math.round(26 * ds));

        ctx.restore();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    _renderResourceBar() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const ds = this.deviceScale;
        const h = this.theme.layout.resourceBarHeight;
        const pad = this.theme.layout.padding;

        // 使用统一背景绘制方法
        this._drawPanelBackground(ctx, 0, 0, this.width, h, colors.primary);

        const items = [
            { label: '能量', value: Math.floor(this.resources.energy), color: colors.energy },
            { label: '晶体', value: Math.floor(this.resources.crystal), color: colors.crystal },
            { label: '补给', value: this.resources.supply, color: colors.supply },
            { label: '人口', value: `${this.resources.population}/${this.resources.popCap}`, color: colors.population }
        ];

        ctx.font = this.theme.fonts.hud;
        ctx.textBaseline = 'middle';
        let x = pad;
        const iconSize = Math.round(12 * ds);
        for (const item of items) {
            ctx.fillStyle = item.color;
            ctx.fillRect(x, h / 2 - Math.round(6 * ds), iconSize, iconSize);
            x += iconSize + Math.round(6 * ds);
            ctx.fillStyle = colors.text;
            ctx.fillText(`${item.label}: ${item.value}`, x, h / 2);
            x += ctx.measureText(`${item.label}: ${item.value}`).width + Math.round(32 * ds);
        }

        // 比邻星币显示
        const coinSize = Math.round(16 * ds);
        const coinX = x;
        const coinY = h / 2 - coinSize / 2;
        this.proximaCoinRenderer.draw(ctx, coinX, coinY, coinSize);
        x += coinSize + Math.round(6 * ds);
        ctx.fillStyle = colors.text;
        ctx.fillText(`${this.resources.proximaCoin || 0}`, x, h / 2);

        ctx.textBaseline = 'top';
    }

    _renderMinimap() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const size = this.theme.layout.minimapSize;
        const pad = this.theme.layout.padding;
        const x = pad;
        const y = this.height - size - pad;

        // 获取地图尺寸（优先从 gameCore 获取，否则使用默认值）
        const worldWidth = this.gameCore ? this.gameCore.worldWidth : 6000;
        const worldHeight = this.gameCore ? this.gameCore.worldHeight : 4500;
        const zoom = this.camera ? this.camera.zoom : 1.0;

        // 绘制小地图背景
        ctx.fillStyle = colors.minimapBg;
        ctx.fillRect(x, y, size, size);
        ctx.strokeStyle = colors.borderHover;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, size, size);

        // 绘制控制区域
        for (const zone of this.minimapZones) {
            const mx = x + (zone.x / worldWidth) * size;
            const my = y + (zone.y / worldHeight) * size;

            let zoneColor = colors.border;
            if (zone.owner === 'player') zoneColor = colors.primary;
            else if (zone.owner === 'enemy') zoneColor = colors.danger;
            else if (zone.captureProgress > 0) zoneColor = colors.warning;

            ctx.fillStyle = zoneColor;
            ctx.beginPath();
            ctx.arc(mx, my, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        for (const belt of this.minimapAsteroidBelts) {
            const mx = x + (belt.x / worldWidth) * size;
            const my = y + (belt.y / worldHeight) * size;

            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(mx, my, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // 绘制单位
        for (const u of this.minimapUnits) {
            const mx = x + (u.x / worldWidth) * size;
            const my = y + (u.y / worldHeight) * size;

            if (u.team === 'player') {
                ctx.fillStyle = colors.primary;
            } else if (u.team === 'enemy') {
                ctx.fillStyle = colors.danger;
            } else if (u.team === 'base') {
                ctx.fillStyle = colors.success;
            } else if (u.team === 'enemyBase') {
                ctx.fillStyle = colors.warning;
            } else {
                ctx.fillStyle = colors.textMuted;
            }

            const dotSize = u.type === 'base' ? 4 : 2;
            ctx.fillRect(mx - dotSize / 2, my - dotSize / 2, dotSize, dotSize);
        }

        // 绘制当前视野矩形（考虑缩放）
        if (this.camera) {
            // 视野大小需要除以缩放级别，因为缩放越大，实际可见的世界区域越小
            const viewW = (this.width / zoom / worldWidth) * size;
            const viewH = (this.height / zoom / worldHeight) * size;
            const viewX = x + (this.camera.x / worldWidth) * size;
            const viewY = y + (this.camera.y / worldHeight) * size;

            ctx.strokeStyle = colors.text;
            ctx.lineWidth = 1;
            ctx.strokeRect(viewX, viewY, viewW, viewH);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(viewX, viewY, viewW, viewH);
        }
    }

    setCamera(camera) {
        this.camera = camera;
    }

    _renderUnitPanel() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const ds = this.deviceScale;
        const panelW = this.theme.layout.unitPanelWidth;
        const pad = this.theme.layout.padding;
        const x = this.width - panelW - pad;
        const y = this.height - Math.round(220 * ds) - pad;
        const h = Math.round(220 * ds);

        // 如果有敌方单位被选中，优先显示敌方信息（红色主题）
        if (this.selectedEnemy && this.selectedEnemy.hp > 0) {
            this._drawPanelBackground(ctx, x, y, panelW, h, colors.danger);

            const enemy = this.selectedEnemy;
            let ty = y + pad;

            ctx.fillStyle = colors.danger;
            ctx.font = this.theme.fonts.hud;
            ctx.fillText('[敌方] ' + (enemy.name || '未知敌机'), x + pad, ty);
            ty += Math.round(28 * ds);

            this._renderBar(ctx, x + pad, ty, panelW - pad * 2, Math.round(14 * ds), enemy.hp || 0, enemy.maxHp || 100, colors.danger, 'HP', 'hp');
            ty += Math.round(24 * ds);

            if (enemy.maxShield > 0) {
                this._renderBar(ctx, x + pad, ty, panelW - pad * 2, Math.round(14 * ds), enemy.shield || 0, enemy.maxShield || 100, colors.shieldBar, '护盾', 'shield');
                ty += Math.round(24 * ds);
            }

            ctx.fillStyle = colors.textMuted;
            ctx.font = this.theme.fonts.small;
            ctx.fillText(`攻击: ${enemy.attack || 0}`, x + pad, ty);
            ty += Math.round(20 * ds);
            const speedIconSize = Math.round(14 * ds);
            IconRenderer.drawIcon(ctx, 'speed', x + pad + speedIconSize / 2, ty + speedIconSize / 2, speedIconSize, colors.textMuted);
            ctx.fillText(`移速: ${enemy.speed || 0}`, x + pad + speedIconSize + Math.round(4 * ds), ty);
            return;
        }

        // 统一面板背景
        this._drawPanelBackground(ctx, x, y, panelW, h, colors.primary);

        if (this.selectedUnits.length === 0) {
            ctx.fillStyle = colors.textMuted;
            ctx.font = this.theme.fonts.hud;
            ctx.textAlign = 'center';
            ctx.fillText('未选择单位', x + panelW / 2, y + h / 2);
            ctx.textAlign = 'left';
            return;
        }

        const unit = this.selectedUnits[0];
        let ty = y + pad;

        ctx.fillStyle = colors.text;
        ctx.font = this.theme.fonts.hud;
        ctx.fillText(unit.name || '未知单位', x + pad, ty);
        ty += Math.round(22 * ds);

        // 状态显示
        const stateCfg = this._stateConfig[unit.state] || this._stateConfig.idle;
        const stateLabelH = Math.round(18 * ds);
        let stateLabelX = x + pad;

        // 获取子状态标签（从 GameCore 查询）
        const subStates = this.gameCore ? this.gameCore.getUnitSubStates(unit.id) : [];
        // 子状态渲染在主状态左侧，从左到右：动力协调 → 重规划 → 主状态
        const renderOrder = [];
        if (subStates.includes('powerCoordination')) renderOrder.push('powerCoordination');
        if (subStates.includes('reroute')) renderOrder.push('reroute');

        for (const subKey of renderOrder) {
            const subCfg = this._subStateConfig[subKey];
            if (!subCfg) continue;
            const subLabelW = ctx.measureText(subCfg.label).width + Math.round(10 * ds);
            ctx.fillStyle = subCfg.bg;
            ctx.beginPath();
            ctx.roundRect(stateLabelX, ty, subLabelW, stateLabelH, Math.round(4 * ds));
            ctx.fill();
            ctx.strokeStyle = subCfg.color;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = subCfg.color;
            ctx.font = this.theme.fonts.small;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(subCfg.label, stateLabelX + subLabelW / 2, ty + stateLabelH / 2);
            stateLabelX += subLabelW + Math.round(4 * ds);
        }

        const stateLabelW = ctx.measureText(stateCfg.label).width + Math.round(12 * ds);
        ctx.fillStyle = stateCfg.bg;
        ctx.beginPath();
        ctx.roundRect(stateLabelX, ty, stateLabelW, stateLabelH, Math.round(4 * ds));
        ctx.fill();
        ctx.strokeStyle = stateCfg.color;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = stateCfg.color;
        ctx.font = this.theme.fonts.small;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stateCfg.label, stateLabelX + stateLabelW / 2, ty + stateLabelH / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ty += Math.round(24 * ds);

        this._renderBar(ctx, x + pad, ty, panelW - pad * 2, Math.round(14 * ds), unit.hp || 0, unit.maxHp || 100, colors.hpBar, 'HP', 'hp');
        ty += Math.round(24 * ds);

        if (unit.maxShield > 0) {
            this._renderBar(ctx, x + pad, ty, panelW - pad * 2, Math.round(14 * ds), unit.shield || 0, unit.maxShield || 100, colors.shieldBar, '护盾', 'shield');
            ty += Math.round(24 * ds);
        }

        ctx.fillStyle = colors.textMuted;
        ctx.font = this.theme.fonts.small;
        ctx.fillText(`攻击: ${unit.attack || 0}`, x + pad, ty);
        ty += Math.round(18 * ds);
        const speedIconSize = Math.round(14 * ds);
        IconRenderer.drawIcon(ctx, 'speed', x + pad + speedIconSize / 2, ty + speedIconSize / 2, speedIconSize, colors.textMuted);
        ctx.fillText(`移速: ${unit.speed || 0}`, x + pad + speedIconSize + Math.round(4 * ds), ty);
        ty += Math.round(20 * ds);

        // 工程船仓储显示
        if (unit.type === 'engineer' && unit.maxStorage > 0) {
            this._renderBar(ctx, x + pad, ty, panelW - pad * 2, Math.round(14 * ds), unit.storage || 0, unit.maxStorage, '#22c55e', '仓储');
            ty += Math.round(24 * ds);
        }

        // 撤退按钮
        const retreatW = panelW - pad * 2;
        const retreatH = Math.round(28 * ds);
        const retreatX = x + pad;
        const retreatY = y + h - retreatH - pad;
        this._drawButton(ctx, retreatX, retreatY, retreatW, retreatH, '撤退至基地', this._hoverRetreat, false, colors.danger);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    _renderBar(ctx, x, y, w, h, value, max, color, label, iconName) {
        const colors = this.theme.colors;
        const ds = this.deviceScale;
        const COLORS = window.COLORS;
        if (iconName) {
            const iconSize = Math.round(14 * ds);
            IconRenderer.drawIcon(ctx, iconName, x + iconSize / 2, y + h / 2, iconSize, color);
            const shift = iconSize + Math.round(4 * ds);
            x += shift;
            w -= shift;
        }
        const ratio = Math.max(0, Math.min(1, value / max));
        // Background
        ctx.fillStyle = 'rgba(30, 41, 59, 0.5)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(75, 85, 99, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, w, h);
        ctx.save();
        // Low HP pulse
        if (ratio < 0.25) {
            const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 200);
            ctx.globalAlpha = pulse;
        }
        // Gradient fill
        const fillGradient = ctx.createLinearGradient(x, y, x + w * ratio, y);
        const actualColor = ratio < 0.25 ? COLORS.hpBarLow : color;
        fillGradient.addColorStop(0, actualColor);
        fillGradient.addColorStop(1, ratio < 0.25 ? '#fca5a5' : COLORS.primaryLight);
        ctx.fillStyle = fillGradient;
        ctx.fillRect(x, y, w * ratio, h);
        // Flowing light effect
        const now = performance.now() / 1000;
        const shinePos = (now * 0.3) % 1.0;
        const shineX = x + (w * ratio) * shinePos;
        if (ratio > 0.05) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(shineX, y, Math.round(2 * ds), h);
        }
        ctx.restore();
        // Label
        ctx.font = this.theme.fonts.small;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillText(`${label}: ${Math.floor(value)}/${max}`, x + Math.round(4 * ds) + 1, y + h / 2 + 1);
        ctx.fillStyle = colors.text;
        ctx.fillText(`${label}: ${Math.floor(value)}/${max}`, x + Math.round(4 * ds), y + h / 2);
        ctx.textBaseline = 'top';
    }

    _drawButton(ctx, x, y, w, h, text, hover, disabled, accentColor) {
        const ds = this.deviceScale;
        const radius = Math.round(6 * ds);
        const color = accentColor || window.COLORS.primary;

        ctx.save();

        if (disabled) {
            ctx.globalAlpha = 0.4;
        }

        let drawY = y;
        if (hover && !disabled) {
            drawY = y - Math.round(2 * ds);
        }

        // 背景
        if (hover && !disabled) {
            ctx.fillStyle = window.COLORS.bgCard;
            ctx.shadowColor = color;
            ctx.shadowBlur = Math.round(8 * ds);
        } else {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        }

        this._roundRect(ctx, x, drawY, w, h, radius);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // 边框
        ctx.strokeStyle = hover && !disabled ? window.COLORS.borderHover : window.COLORS.border;
        ctx.lineWidth = 1;
        this._roundRect(ctx, x, drawY, w, h, radius);
        ctx.stroke();

        // 文字
        ctx.fillStyle = disabled ? window.COLORS.textMuted : (hover ? window.COLORS.textPrimary : window.COLORS.textSecondary);
        ctx.font = `bold ${Math.round(12 * ds)}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w / 2, drawY + h / 2);

        ctx.restore();
    }

    _roundRect(ctx, x, y, w, h, r) {
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

    _renderUnitList() {
        if (this._unitListAnim <= 0.001) return;

        const ctx = this.ctx;
        const colors = this.theme.colors;
        const ds = this.deviceScale;
        const anim = this._unitListAnim;
        const listRect = this._getUnitListRect();
        const pad = Math.round(8 * ds);
        const headerH = Math.round(36 * ds);
        const itemH = Math.round(28 * ds);

        // 动画：从底部向上展开，使用 easeOutBack 缓动
        const easedAnim = this._easeOutBack(anim);
        const currentH = listRect.h * easedAnim;
        const drawY = listRect.y + listRect.h - currentH;
        const panelAlpha = anim; // 透明度渐变 0→1

        ctx.save();
        ctx.globalAlpha = panelAlpha;
        // 裁剪区域实现展开效果
        ctx.beginPath();
        ctx.rect(listRect.x, drawY, listRect.w, currentH);
        ctx.clip();

        // 面板背景
        this._drawPanelBackground(ctx, listRect.x, listRect.y, listRect.w, listRect.h, colors.primary);

        // 标题栏
        ctx.fillStyle = colors.primary;
        ctx.fillRect(listRect.x, listRect.y, listRect.w, headerH);
        ctx.fillStyle = colors.text;
        ctx.font = this.theme.fonts.hud;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('舰船详情', listRect.x + listRect.w / 2, listRect.y + headerH / 2);

        // 单位列表 - stagger 动画：列表项依次进入，每项延迟 0.03 秒
        let itemY = listRect.y + headerH;
        for (let i = 0; i < this._allUnits.length; i++) {
            const unit = this._allUnits[i];
            const isHover = i === this._unitListHoverIdx;
            const isSelected = this.selectedUnits.some(u => u.id === unit.id);

            // stagger 延迟计算：每项延迟 0.03 秒，基于 easedAnim
            const staggerDelay = i * 0.03;
            const staggerDuration = 0.3;
            let itemAnim = Math.max(0, Math.min(1, (easedAnim - staggerDelay) / staggerDuration));
            // 使用 easeOutCubic 让每项的进入更平滑
            itemAnim = 1 - Math.pow(1 - itemAnim, 3);
            const itemAlpha = itemAnim;
            const itemXOffset = (1 - itemAnim) * Math.round(10 * ds); // 轻微从右滑入

            ctx.save();
            ctx.globalAlpha = itemAlpha;

            // 背景
            if (isSelected) {
                ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
            } else if (isHover) {
                ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
            } else if (i % 2 === 0) {
                ctx.fillStyle = 'rgba(17, 24, 39, 0.6)';
            } else {
                ctx.fillStyle = 'rgba(17, 24, 39, 0.3)';
            }
            ctx.fillRect(listRect.x + itemXOffset, itemY, listRect.w, itemH);

            // 分割线
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(listRect.x + pad + itemXOffset, itemY + itemH);
            ctx.lineTo(listRect.x + listRect.w - pad + itemXOffset, itemY + itemH);
            ctx.stroke();

            // 状态配置
            const stateCfg = this._stateConfig[unit.state] || this._stateConfig.idle;

            // 状态指示点（带脉动效果）
            const dotBaseColor = unit.hp > 0 ? stateCfg.color : colors.textMuted;
            ctx.fillStyle = dotBaseColor;
            ctx.beginPath();
            ctx.arc(listRect.x + pad + Math.round(4 * ds) + itemXOffset, itemY + itemH / 2, Math.round(3 * ds), 0, Math.PI * 2);
            ctx.fill();
            // 战斗中状态添加脉动光环
            if (unit.hp > 0 && (unit.state === 'attack' || unit.state === 'attack_base' || unit.state === 'bombarding')) {
                const pulseColor = unit.state === 'bombarding' ? 'rgba(249, 115, 22,' : 'rgba(239, 68, 68,';
                const pulse = Math.sin(adapter.performance.now() / 200) * 0.3 + 0.7;
                ctx.fillStyle = `${pulseColor} ${0.4 * pulse})`;
                ctx.beginPath();
                ctx.arc(listRect.x + pad + Math.round(4 * ds) + itemXOffset, itemY + itemH / 2, Math.round(5 * ds) * pulse, 0, Math.PI * 2);
                ctx.fill();
            }

            // 单位名称
            ctx.fillStyle = unit.hp > 0 ? colors.text : colors.textMuted;
            ctx.font = this.theme.fonts.small;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const nameText = unit.name || '未知单位';
            ctx.fillText(nameText, listRect.x + pad + Math.round(14 * ds) + itemXOffset, itemY + itemH / 2);

            // 状态标签（中间偏右）
            const tagW = ctx.measureText(stateCfg.label).width + Math.round(10 * ds);
            let tagX = listRect.x + listRect.w - Math.round(58 * ds) - tagW + itemXOffset;
            const tagH = Math.round(16 * ds);
            const tagY = itemY + (itemH - tagH) / 2;

            // 获取子状态标签（从 GameCore 查询）
            const subStates = this.gameCore ? this.gameCore.getUnitSubStates(unit.id) : [];
            // 子状态渲染在主状态左侧，从左到右：动力协调 → 重规划 → 主状态
            const renderOrder = [];
            if (subStates.includes('powerCoordination')) renderOrder.push('powerCoordination');
            if (subStates.includes('reroute')) renderOrder.push('reroute');

            for (const subKey of renderOrder) {
                const subCfg = this._subStateConfig[subKey];
                if (!subCfg) continue;
                const subLabelW = ctx.measureText(subCfg.label).width + Math.round(10 * ds);
                const subX = tagX - subLabelW - Math.round(4 * ds);
                ctx.fillStyle = subCfg.bg;
                ctx.beginPath();
                ctx.roundRect(subX, tagY, subLabelW, tagH, Math.round(3 * ds));
                ctx.fill();
                ctx.strokeStyle = subCfg.color;
                ctx.lineWidth = 0.5;
                ctx.stroke();
                ctx.fillStyle = subCfg.color;
                ctx.font = `${Math.round(10 * ds)}px "Segoe UI", Arial, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(subCfg.label, subX + subLabelW / 2, tagY + tagH / 2);
                tagX = subX;
            }

            // 主状态标签
            ctx.fillStyle = stateCfg.bg;
            ctx.beginPath();
            ctx.roundRect(tagX, tagY, tagW, tagH, Math.round(3 * ds));
            ctx.fill();
            ctx.strokeStyle = stateCfg.color;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.fillStyle = stateCfg.color;
            ctx.font = `${Math.round(10 * ds)}px "Segoe UI", Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(stateCfg.label, tagX + tagW / 2, tagY + tagH / 2);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            // HP条（右侧）
            const barW = Math.round(44 * ds);
            const barH = Math.round(5 * ds);
            const barX = listRect.x + listRect.w - barW - pad + itemXOffset;
            const barY = itemY + (itemH - barH) / 2;
            ctx.fillStyle = colors.border;
            ctx.fillRect(barX, barY, barW, barH);
            const hpRatio = Math.max(0, Math.min(1, (unit.hp || 0) / (unit.maxHp || 100)));
            ctx.fillStyle = hpRatio > 0.5 ? colors.success : (hpRatio > 0.25 ? colors.warning : colors.danger);
            ctx.fillRect(barX, barY, barW * hpRatio, barH);

            ctx.restore();

            itemY += itemH;
        }

        // 空列表提示
        if (this._allUnits.length === 0) {
            ctx.fillStyle = colors.textMuted;
            ctx.font = this.theme.fonts.small;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('暂无舰船', listRect.x + listRect.w / 2, listRect.y + headerH + Math.round(20 * ds));
        }

        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    /**
     * 缓动函数：easeOutBack，带有轻微回弹效果
     */
    _easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    updateResources(data) {
        Object.assign(this.resources, data);
    }

    setCanBlockade(canBlockade) {
        this.canBlockade = canBlockade;
    }

    setOutpostCount(count) {
        this.outpostCount = count;
    }

    updateSelectedUnits(units) {
        this.selectedUnits = units || [];
    }

    updateMinimapUnits(units) {
        this.minimapUnits = units || [];
    }

    updateMinimapZones(zones) {
        this.minimapZones = zones || [];
    }

    updateMinimapAsteroidBelts(belts) {
        this.minimapAsteroidBelts = belts || [];
    }

    /**
     * 获取战报图标矩形区域
     * @returns {{x:number, y:number, w:number, h:number}}
     */
    _getBattleReportIconRect() {
        const ds = this.deviceScale;
        const pad = this.theme.layout.padding;
        const size = this.theme.layout.minimapSize;
        const iconSize = Math.round(48 * ds);
        const x = pad + size + Math.round(8 * ds);
        const y = this.height - iconSize - pad;
        return { x, y, w: iconSize, h: iconSize };
    }

    /**
     * 获取战报面板矩形区域
     * @returns {{x:number, y:number, w:number, h:number}}
     */
    _getBattleReportPanelRect() {
        const ds = this.deviceScale;
        const pad = this.theme.layout.padding;
        const size = this.theme.layout.minimapSize;
        const panelW = Math.round(200 * ds);
        const panelH = Math.round(180 * ds);
        const x = pad + size + Math.round(8 * ds);
        const y = this.height - panelH - pad;
        return { x, y, w: panelW, h: panelH };
    }

    /**
     * 更新战报动画 - 克制、有目的的动效
     * @param {number} dt - 时间增量(秒)
     */
    _updateBattleReport(dt) {
        // 面板展开/收起动画 - 使用 easeOutBack 缓动
        const diff = this._battleReportTarget - this._battleReportAnim;
        if (Math.abs(diff) > 0.001) {
            const t = Math.min(1, 10 * dt);
            this._battleReportAnim += diff * t;
        } else {
            this._battleReportAnim = this._battleReportTarget;
        }

        // 图标脉冲动画 - 仅一次微弱呼吸，不循环
        if (this._battleReportNewCount > 0 && this._battleReportPulseCount < 1) {
            this._battleReportPulse += dt;
            const pulseDuration = 0.8;
            if (this._battleReportPulse >= pulseDuration) {
                this._battleReportPulse = pulseDuration;
                this._battleReportPulseCount = 1;
            }
            const t = this._battleReportPulse / pulseDuration;
            // 仅 1.03 的微弱缩放，几乎不可察觉但提供反馈
            this._battleReportIconScale = 1 + Math.sin(t * Math.PI) * 0.03;
        } else {
            // 平滑回到 1.0
            this._battleReportIconScale += (1 - this._battleReportIconScale) * Math.min(8 * dt, 1);
        }

        // 新战报入场动画 - 仅淡入，无位移
        for (const report of this._battleReports) {
            if (report.animTimer < 0.25) {
                report.animTimer += dt;
                const t = Math.min(1, report.animTimer / 0.25);
                // easeOutCubic
                report.animAlpha = 1 - Math.pow(1 - t, 3);
            } else {
                report.animAlpha = 1;
            }
        }
    }

    /**
     * 渲染战报图标和面板 - 简约科幻风格
     */
    _renderBattleReport() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const ds = this.deviceScale;
        const iconRect = this._getBattleReportIconRect();

        ctx.save();

        // 图标脉冲缩放
        const scale = this._battleReportIconScale;
        const cx = iconRect.x + iconRect.w / 2;
        const cy = iconRect.y + iconRect.h / 2;

        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);

        // 图标背景 - 极简，无圆角，仅边框
        ctx.fillStyle = this._battleReportHover ? 'rgba(30, 41, 59, 0.9)' : 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(iconRect.x, iconRect.y, iconRect.w, iconRect.h);

        // 边框：有新战报时高亮
        ctx.strokeStyle = this._battleReportNewCount > 0 ? colors.primary : 'rgba(75, 85, 99, 0.4)';
        ctx.lineWidth = this._battleReportNewCount > 0 ? 1.5 : 0.5;
        ctx.strokeRect(iconRect.x, iconRect.y, iconRect.w, iconRect.h);

        // 绘制六边形数据节点图标
        const iconColor = this._battleReportNewCount > 0 ? colors.primary : 'rgba(148, 163, 184, 0.8)';
        this._drawBattleReportIcon(ctx, cx, cy, iconColor);

        ctx.restore();

        // 未读指示 - 简约小圆点（替代数字角标）
        if (this._battleReportNewCount > 0 && !this._showBattleReport) {
            const dotX = iconRect.x + iconRect.w - Math.round(6 * ds);
            const dotY = iconRect.y + Math.round(6 * ds);
            ctx.fillStyle = colors.danger;
            ctx.beginPath();
            ctx.arc(dotX, dotY, Math.round(4 * ds), 0, Math.PI * 2);
            ctx.fill();
            // 微光效果
            ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
            ctx.beginPath();
            ctx.arc(dotX, dotY, Math.round(6 * ds), 0, Math.PI * 2);
            ctx.fill();
        }

        // 绘制展开面板
        if (this._battleReportAnim > 0.001) {
            this._renderBattleReportPanel();
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    /**
     * 绘制战报图标 - 简约科幻风格：六边形数据节点
     */
    _drawBattleReportIcon(ctx, cx, cy, color) {
        const ds = this.deviceScale;
        const size = Math.round(28 * ds);
        IconRenderer.drawIcon(ctx, 'battleReport', cx, cy, size, color);
    }

    /**
     * 绘制战报类型图标 - 极简几何符号
     */
    _drawReportTypeIcon(ctx, x, y, type, color) {
        const ds = this.deviceScale;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        switch (type) {
            case 'kill': // 向上箭头（进攻）
                ctx.save();
                ctx.translate(x, y);
                ctx.beginPath();
                ctx.moveTo(0, Math.round(-4 * ds));
                ctx.lineTo(0, Math.round(3 * ds));
                ctx.moveTo(Math.round(-3 * ds), Math.round(-1 * ds));
                ctx.lineTo(0, Math.round(-4 * ds));
                ctx.lineTo(Math.round(3 * ds), Math.round(-1 * ds));
                ctx.stroke();
                ctx.restore();
                break;
            case 'loss': // 向下箭头（损失）
                ctx.save();
                ctx.translate(x, y);
                ctx.beginPath();
                ctx.moveTo(0, Math.round(4 * ds));
                ctx.lineTo(0, Math.round(-3 * ds));
                ctx.moveTo(Math.round(-3 * ds), Math.round(1 * ds));
                ctx.lineTo(0, Math.round(4 * ds));
                ctx.lineTo(Math.round(3 * ds), Math.round(1 * ds));
                ctx.stroke();
                ctx.restore();
                break;
            case 'capture': // 菱形（占领）
                ctx.save();
                ctx.translate(x, y);
                ctx.beginPath();
                ctx.moveTo(0, Math.round(-4 * ds));
                ctx.lineTo(Math.round(4 * ds), 0);
                ctx.lineTo(0, Math.round(4 * ds));
                ctx.lineTo(Math.round(-4 * ds), 0);
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
                break;
            default: // 圆点（信息）
                ctx.beginPath();
                ctx.arc(x, y, Math.round(2 * ds), 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    }

    /**
     * 渲染战报展开面板 - 简约科幻风格
     */
    _renderBattleReportPanel() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const ds = this.deviceScale;
        const panelRect = this._getBattleReportPanelRect();
        const anim = this._battleReportAnim;

        // 使用 easeOutBack 缓动（更流畅）
        const easedAnim = this._easeOutBack(anim);
        const currentH = panelRect.h * easedAnim;
        const drawY = panelRect.y + panelRect.h - currentH;
        const panelAlpha = anim; // 透明度渐变 0→1

        ctx.save();
        ctx.globalAlpha = panelAlpha;
        // 裁剪区域实现展开效果
        ctx.beginPath();
        ctx.rect(panelRect.x, drawY, panelRect.w, currentH);
        ctx.clip();

        // 使用统一面板背景
        this._drawPanelBackground(ctx, panelRect.x, panelRect.y, panelRect.w, panelRect.h, colors.primary);

        // 标题栏 - 无背景色，纯文字
        const headerH = Math.round(24 * ds);
        ctx.fillStyle = colors.textMuted;
        ctx.font = `${Math.round(11 * ds)}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('BATTLE LOG', panelRect.x + Math.round(12 * ds), panelRect.y + headerH / 2);

        // 标题下方细线
        ctx.strokeStyle = 'rgba(75, 85, 99, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(panelRect.x + Math.round(12 * ds), panelRect.y + headerH);
        ctx.lineTo(panelRect.x + panelRect.w - Math.round(12 * ds), panelRect.y + headerH);
        ctx.stroke();

        // 战报列表 - stagger 动画：列表项依次进入，每项延迟 0.03 秒
        const itemH = Math.round(24 * ds);
        const maxItems = Math.floor((panelRect.h - headerH - Math.round(8 * ds)) / itemH);
        const itemsToShow = Math.min(this._battleReports.length, maxItems);
        const pad = Math.round(12 * ds);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < itemsToShow; i++) {
            const report = this._battleReports[i];
            const itemY = panelRect.y + headerH + Math.round(4 * ds) + i * itemH;

            // stagger 延迟计算：每项延迟 0.03 秒
            const staggerDelay = i * 0.03;
            const staggerDuration = 0.3;
            let itemAnim = Math.max(0, Math.min(1, (easedAnim - staggerDelay) / staggerDuration));
            itemAnim = 1 - Math.pow(1 - itemAnim, 3); // easeOutCubic
            const alpha = report.animAlpha * itemAnim;

            if (alpha <= 0) continue;

            ctx.save();
            ctx.globalAlpha = alpha;
            const itemXOffset = (1 - itemAnim) * Math.round(8 * ds); // 轻微从右滑入

            // 类型图标
            const iconX = panelRect.x + pad + Math.round(4 * ds) + itemXOffset;
            const iconY = itemY + itemH / 2;
            this._drawReportTypeIcon(ctx, iconX, iconY, report.type, report.color);

            // 战报文本 - 更小的字号
            ctx.fillStyle = report.color || colors.text;
            ctx.font = `${Math.round(11 * ds)}px "Segoe UI", Arial, sans-serif`;
            const textX = iconX + Math.round(14 * ds);
            const textY = itemY + itemH / 2;
            ctx.fillText(report.text, textX + report.animOffset * itemAnim, textY);

            ctx.restore();
        }

        // 空列表提示
        if (this._battleReports.length === 0) {
            ctx.globalAlpha = anim;
            ctx.fillStyle = colors.textMuted;
            ctx.font = `${Math.round(11 * ds)}px "Segoe UI", Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('NO DATA', panelRect.x + panelRect.w / 2, panelRect.y + headerH + Math.round(50 * ds));
        }

        ctx.restore();
        ctx.globalAlpha = 1;
    }

    /**
     * 缓动函数：easeOutCubic，更克制的展开效果
     */
    _easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    /**
     * 获取邮件图标矩形区域
     * @returns {{x:number, y:number, w:number, h:number}}
     */
    _getMailIconRect() {
        const ds = this.deviceScale;
        const pad = this.theme.layout.padding;
        const size = this.theme.layout.minimapSize;
        const iconSize = Math.round(44 * ds);
        // 在战报图标上方
        const x = pad + size + Math.round(10 * ds);
        const y = this.height - iconSize * 2 - pad - Math.round(8 * ds);
        return { x, y, w: iconSize, h: iconSize };
    }

    /**
     * 获取邮件面板矩形区域
     * @returns {{x:number, y:number, w:number, h:number}}
     */
    _getMailPanelRect() {
        const ds = this.deviceScale;
        const pad = this.theme.layout.padding;
        const size = this.theme.layout.minimapSize;
        const panelW = Math.round(350 * ds);
        const panelH = Math.round(400 * ds);
        const x = this.width - panelW - pad;
        const y = this.height - panelH - pad - Math.round(60 * ds);
        return { x, y, w: panelW, h: panelH };
    }

    /**
     * 更新邮件面板动画
     * @param {number} dt - 时间增量(秒)
     */
    _updateMailPanel(dt) {
        // 面板展开/收起动画
        const diff = this._mailPanelTarget - this._mailPanelAnim;
        if (Math.abs(diff) > 0.001) {
            this._mailPanelAnim += diff * Math.min(12 * dt, 1);
        } else {
            this._mailPanelAnim = this._mailPanelTarget;
        }

        // 图标脉冲动画
        const unreadCount = this.mailSystem ? this.mailSystem.getUnreadCount() : 0;
        if (unreadCount > 0) {
            this._mailPulse += dt;
            const pulseDuration = 2.0;
            const t = (this._mailPulse % pulseDuration) / pulseDuration;
            // 正弦波脉冲
            this._mailIconScale = 1 + Math.sin(t * Math.PI * 2) * 0.08;
        } else {
            this._mailIconScale = 1;
            this._mailPulse = 0;
        }
    }

    /**
     * 绘制邮件面板
     */
    _renderMailPanel() {
        const ctx = this.ctx;
        const colors = this.theme.colors;

        // 绘制邮件图标
        this._renderMailIcon();

        // 绘制展开面板
        if (this._mailPanelAnim > 0.001) {
            this._renderMailListPanel();
        }
    }

    /**
     * 绘制邮件图标 - 简约科技风信封
     */
    _renderMailIcon() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const ds = this.deviceScale;
        const iconRect = this._getMailIconRect();
        const unreadCount = this.mailSystem ? this.mailSystem.getUnreadCount() : 0;

        ctx.save();

        // 图标背景 - 圆角矩形
        const r = Math.round(6 * ds);
        ctx.fillStyle = this._mailIconHover ? 'rgba(14, 165, 233, 0.15)' : 'rgba(15, 23, 42, 0.8)';
        ctx.strokeStyle = unreadCount > 0 ? colors.primary : colors.border;
        ctx.lineWidth = unreadCount > 0 ? 1.5 : 1;

        // 应用脉冲缩放
        const scale = this._mailIconScale;
        const cx = iconRect.x + iconRect.w / 2;
        const cy = iconRect.y + iconRect.h / 2;
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);

        // 绘制圆角矩形背景
        ctx.beginPath();
        ctx.moveTo(iconRect.x + r, iconRect.y);
        ctx.lineTo(iconRect.x + iconRect.w - r, iconRect.y);
        ctx.quadraticCurveTo(iconRect.x + iconRect.w, iconRect.y, iconRect.x + iconRect.w, iconRect.y + r);
        ctx.lineTo(iconRect.x + iconRect.w, iconRect.y + iconRect.h - r);
        ctx.quadraticCurveTo(iconRect.x + iconRect.w, iconRect.y + iconRect.h, iconRect.x + iconRect.w - r, iconRect.y + iconRect.h);
        ctx.lineTo(iconRect.x + r, iconRect.y + iconRect.h);
        ctx.quadraticCurveTo(iconRect.x, iconRect.y + iconRect.h, iconRect.x, iconRect.y + iconRect.h - r);
        ctx.lineTo(iconRect.x, iconRect.y + r);
        ctx.quadraticCurveTo(iconRect.x, iconRect.y, iconRect.x + r, iconRect.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 绘制邮箱图标
        const mailIconSize = Math.round(28 * ds);
        const mailColor = unreadCount > 0 ? colors.primary : colors.textMuted;
        IconRenderer.drawIcon(ctx, 'mail', cx, cy, mailIconSize, mailColor);

        // 未读指示 - 右上角小圆点
        if (unreadCount > 0) {
            const dotX = iconRect.x + iconRect.w - Math.round(8 * ds);
            const dotY = iconRect.y + Math.round(8 * ds);

            // 发光效果
            ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
            ctx.beginPath();
            ctx.arc(dotX, dotY, Math.round(8 * ds), 0, Math.PI * 2);
            ctx.fill();

            // 圆点
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.arc(dotX, dotY, Math.round(5 * ds), 0, Math.PI * 2);
            ctx.fill();

            // 数字
            if (unreadCount > 1) {
                ctx.fillStyle = '#0f172a';
                ctx.font = `bold ${Math.round(9 * ds)}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(unreadCount > 9 ? '9+' : unreadCount.toString(), dotX, dotY);
            }
        }

        ctx.restore();
    }

    /**
     * 绘制邮件列表面板
     */
    _renderMailListPanel() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const ds = this.deviceScale;
        const panelRect = this._getMailPanelRect();
        const anim = this._mailPanelAnim;

        ctx.save();

        // 面板滑入动画
        const slideOffset = (1 - this._easeOutCubic(anim)) * Math.round(100 * ds);
        ctx.translate(slideOffset, 0);

        // 使用统一面板背景
        this._drawPanelBackground(ctx, panelRect.x, panelRect.y, panelRect.w, panelRect.h, colors.primary);

        // 顶部标题栏
        const headerH = Math.round(40 * ds);
        ctx.fillStyle = 'rgba(30, 41, 59, 0.5)';
        ctx.fillRect(panelRect.x, panelRect.y, panelRect.w, headerH);

        // 标题
        ctx.fillStyle = colors.text;
        ctx.font = `${Math.round(14 * ds)}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('消息中心', panelRect.x + Math.round(16 * ds), panelRect.y + headerH / 2);

        // 未读数量
        const unreadCount = this.mailSystem ? this.mailSystem.getUnreadCount() : 0;
        if (unreadCount > 0) {
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.arc(panelRect.x + Math.round(90 * ds), panelRect.y + headerH / 2, Math.round(10 * ds), 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0f172a';
            ctx.font = `bold ${Math.round(10 * ds)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(unreadCount.toString(), panelRect.x + Math.round(90 * ds), panelRect.y + headerH / 2);
        }

        // 全部已读按钮
        const btnX = panelRect.x + panelRect.w - Math.round(80 * ds);
        const btnY = panelRect.y + Math.round(10 * ds);
        const btnW = Math.round(70 * ds);
        const btnH = Math.round(20 * ds);
        this._drawButton(ctx, btnX, btnY, btnW, btnH, '全部已读', this._mailHoverIndex === -2, false);

        // 分隔线
        ctx.strokeStyle = 'rgba(75, 85, 99, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(panelRect.x, panelRect.y + headerH);
        ctx.lineTo(panelRect.x + panelRect.w, panelRect.y + headerH);
        ctx.stroke();

        // 邮件列表
        const mails = this.mailSystem ? this.mailSystem.getMails() : [];
        const itemH = Math.round(60 * ds);
        const listY = panelRect.y + headerH;
        const maxItems = Math.floor((panelRect.h - headerH) / itemH);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        for (let i = 0; i < Math.min(mails.length, maxItems); i++) {
            const mail = mails[i];
            const itemY = listY + i * itemH;
            const isHover = this._mailHoverIndex === i;
            const isUnread = !mail.read;

            // 背景
            if (isHover) {
                ctx.fillStyle = 'rgba(14, 165, 233, 0.1)';
                ctx.fillRect(panelRect.x, itemY, panelRect.w, itemH);
            } else if (isUnread) {
                ctx.fillStyle = 'rgba(34, 197, 94, 0.05)';
                ctx.fillRect(panelRect.x, itemY, panelRect.w, itemH);
            }

            // 左侧类型指示条
            ctx.fillStyle = mail.color || colors.textMuted;
            ctx.fillRect(panelRect.x, itemY + Math.round(10 * ds), 3, itemH - Math.round(20 * ds));

            // 类型图标
            ctx.fillStyle = mail.color || colors.textMuted;
            ctx.font = `${Math.round(12 * ds)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(mail.icon || '◉', panelRect.x + Math.round(20 * ds), itemY + Math.round(15 * ds));

            // 标题
            ctx.fillStyle = isUnread ? colors.text : colors.textMuted;
            ctx.font = isUnread ? `bold ${Math.round(13 * ds)}px Arial` : `${Math.round(13 * ds)}px Arial`;
            ctx.textAlign = 'left';
            ctx.fillText(mail.title, panelRect.x + Math.round(35 * ds), itemY + Math.round(12 * ds));

            // 内容摘要（过滤掉 gift 命令）
            ctx.fillStyle = colors.textMuted;
            ctx.font = `${Math.round(11 * ds)}px Arial`;
            let displayContent = mail.content.replace(/\/\/gift\s+\d+/gi, '').trim();
            const summary = displayContent.length > 35 ? displayContent.substring(0, 35) + '...' : displayContent;
            ctx.fillText(summary, panelRect.x + Math.round(35 * ds), itemY + Math.round(30 * ds));

            // 附件标识（紫色六边形）
            if (mail.attachment && mail.attachment.type === 'proximaCoin') {
                const hexX = panelRect.x + panelRect.w - Math.round(50 * ds);
                const hexY = itemY + Math.round(25 * ds);
                const hexR = Math.round(8 * ds);
                
                // 绘制紫色六边形
                ctx.fillStyle = '#8b5cf6';
                ctx.beginPath();
                for (let j = 0; j < 6; j++) {
                    const angle = (Math.PI / 3) * j - Math.PI / 2;
                    const hx = hexX + hexR * Math.cos(angle);
                    const hy = hexY + hexR * Math.sin(angle);
                    if (j === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.fill();
                
                // 显示数量
                ctx.fillStyle = '#c4b5fd';
                ctx.font = `bold ${Math.round(9 * ds)}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(mail.attachment.amount.toString(), hexX, hexY);
            }

            // 时间
            ctx.fillStyle = colors.textMuted;
            ctx.font = `${Math.round(10 * ds)}px Arial`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            const timeStr = this.mailSystem ? this.mailSystem.formatTime(mail.timestamp) : '';
            ctx.fillText(timeStr, panelRect.x + panelRect.w - Math.round(12 * ds), itemY + Math.round(12 * ds));

            // 分隔线
            ctx.strokeStyle = 'rgba(75, 85, 99, 0.2)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(panelRect.x + Math.round(10 * ds), itemY + itemH - 1);
            ctx.lineTo(panelRect.x + panelRect.w - Math.round(10 * ds), itemY + itemH - 1);
            ctx.stroke();
        }

        // 空列表提示
        if (mails.length === 0) {
            ctx.fillStyle = colors.textMuted;
            ctx.font = `${Math.round(13 * ds)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('暂无消息', panelRect.x + panelRect.w / 2, panelRect.y + headerH + Math.round(100 * ds));
        }

        // 如果选中了邮件，显示详情
        if (this._selectedMailId) {
            this._renderMailDetail(ctx, panelRect, colors);
        }

        ctx.restore();
    }

    /**
     * 绘制邮件详情
     */
    _renderMailDetail(ctx, panelRect, colors) {
        const ds = this.deviceScale;
        const pad = Math.round(16 * ds);
        const mail = this.mailSystem ? this.mailSystem.getMails().find(m => m.id === this._selectedMailId) : null;
        if (!mail) return;

        // 绘制详情背景（覆盖列表）
        this._drawPanelBackground(ctx, panelRect.x, panelRect.y + Math.round(40 * ds), panelRect.w, panelRect.h - Math.round(40 * ds), colors.primary);

        // 返回按钮
        const backBtnX = panelRect.x + Math.round(12 * ds);
        const backBtnY = panelRect.y + Math.round(50 * ds);
        const backBtnW = Math.round(50 * ds);
        const backBtnH = Math.round(24 * ds);
        this._drawButton(ctx, backBtnX, backBtnY, backBtnW, backBtnH, '← 返回', this._mailBackBtnHover, false);

        // 标题
        ctx.fillStyle = colors.text;
        ctx.font = `bold ${Math.round(14 * ds)}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(mail.title, panelRect.x + pad, panelRect.y + Math.round(100 * ds));

        // 时间
        ctx.fillStyle = colors.textMuted;
        ctx.font = `${Math.round(11 * ds)}px Arial`;
        ctx.textAlign = 'right';
        const timeStr = this.mailSystem ? this.mailSystem.formatTime(mail.timestamp) : '';
        ctx.fillText(timeStr, panelRect.x + panelRect.w - pad, panelRect.y + Math.round(100 * ds));

        // 内容（过滤掉 gift 命令）
        ctx.fillStyle = colors.text;
        ctx.font = `${Math.round(13 * ds)}px Arial`;
        ctx.textAlign = 'left';
        let displayContent = mail.content.replace(/\/\/gift\s+\d+/gi, '').trim();
        
        // 自动换行绘制内容
        const maxWidth = panelRect.w - pad * 2;
        const lineHeight = Math.round(18 * ds);
        let y = panelRect.y + Math.round(130 * ds);
        let line = '';
        
        for (let i = 0; i < displayContent.length; i++) {
            const testLine = line + displayContent[i];
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && i > 0) {
                ctx.fillText(line, panelRect.x + pad, y);
                line = displayContent[i];
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, panelRect.x + pad, y);

        // 附件区域
        if (mail.attachment && mail.attachment.type === 'proximaCoin') {
            const attachmentY = panelRect.y + panelRect.h - Math.round(100 * ds);
            
            // 附件背景
            ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
            ctx.fillRect(panelRect.x + pad, attachmentY, panelRect.w - pad * 2, Math.round(70 * ds));
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 1;
            ctx.strokeRect(panelRect.x + pad, attachmentY, panelRect.w - pad * 2, Math.round(70 * ds));

            // 附件图标（紫色六边形）
            const hexX = panelRect.x + pad + Math.round(25 * ds);
            const hexY = attachmentY + Math.round(35 * ds);
            const hexR = Math.round(15 * ds);
            
            ctx.fillStyle = '#8b5cf6';
            ctx.beginPath();
            for (let j = 0; j < 6; j++) {
                const angle = (Math.PI / 3) * j - Math.PI / 2;
                const hx = hexX + hexR * Math.cos(angle);
                const hy = hexY + hexR * Math.sin(angle);
                if (j === 0) ctx.moveTo(hx, hy);
                else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.fill();
            
            // 数量
            ctx.fillStyle = '#c4b5fd';
            ctx.font = `bold ${Math.round(12 * ds)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(mail.attachment.amount.toString(), hexX, hexY);

            // 附件文字
            ctx.fillStyle = colors.text;
            ctx.font = `${Math.round(13 * ds)}px Arial`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`比邻星币 × ${mail.attachment.amount}`, panelRect.x + pad + Math.round(50 * ds), attachmentY + Math.round(25 * ds));

            // 领取按钮或已领取状态
            if (!mail.claimed) {
                const claimBtnX = panelRect.x + panelRect.w - pad - Math.round(80 * ds);
                const claimBtnY = attachmentY + Math.round(25 * ds);
                const claimBtnW = Math.round(70 * ds);
                const claimBtnH = Math.round(28 * ds);
                this._drawButton(ctx, claimBtnX, claimBtnY, claimBtnW, claimBtnH, '领取', this._mailClaimBtnHover, false, '#8b5cf6');
            } else {
                ctx.fillStyle = '#22c55e';
                ctx.font = `${Math.round(12 * ds)}px Arial`;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText('✓ 已领取', panelRect.x + panelRect.w - pad, attachmentY + Math.round(40 * ds));
            }
        }
    }

    /**
     * 处理邮件相关的鼠标移动
     * @param {number} x - 鼠标X坐标
     * @param {number} y - 鼠标Y坐标
     * @returns {boolean} 是否处理了事件
     */
    handleMailMouseMove(x, y) {
        const ds = this.deviceScale;
        const iconRect = this._getMailIconRect();
        const panelRect = this._getMailPanelRect();

        // 检查图标悬停
        this._mailIconHover = x >= iconRect.x && x <= iconRect.x + iconRect.w &&
                              y >= iconRect.y && y <= iconRect.y + iconRect.h;

        // 重置按钮悬停状态
        this._mailClaimBtnHover = false;
        this._mailBackBtnHover = false;

        // 检查面板内悬停
        if (this._showMailPanel) {
            // 如果正在显示邮件详情
            if (this._selectedMailId) {
                return this._handleMailDetailMouseMove(x, y, panelRect);
            }

            // 检查"全部已读"按钮
            const btnX = panelRect.x + panelRect.w - Math.round(80 * ds);
            const btnY = panelRect.y + Math.round(10 * ds);
            const btnW = Math.round(70 * ds);
            const btnH = Math.round(20 * ds);
            if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
                this._mailHoverIndex = -2;
                return true;
            }

            // 检查邮件列表项
            const mails = this.mailSystem ? this.mailSystem.getMails() : [];
            const itemH = Math.round(60 * ds);
            const headerH = Math.round(40 * ds);
            const listY = panelRect.y + headerH;

            for (let i = 0; i < mails.length; i++) {
                const itemY = listY + i * itemH;
                if (x >= panelRect.x && x <= panelRect.x + panelRect.w &&
                    y >= itemY && y <= itemY + itemH) {
                    this._mailHoverIndex = i;
                    return true;
                }
            }
        }

        this._mailHoverIndex = -1;
        return this._mailIconHover || (this._showMailPanel &&
               x >= panelRect.x && x <= panelRect.x + panelRect.w &&
               y >= panelRect.y && y <= panelRect.y + panelRect.h);
    }

    /**
     * 处理邮件详情面板的鼠标移动
     */
    _handleMailDetailMouseMove(x, y, panelRect) {
        const ds = this.deviceScale;
        const pad = Math.round(16 * ds);
        const headerH = Math.round(40 * ds);

        // 检查返回按钮悬停
        const backBtnX = panelRect.x + Math.round(12 * ds);
        const backBtnY = panelRect.y + Math.round(50 * ds);
        const backBtnW = Math.round(50 * ds);
        const backBtnH = Math.round(24 * ds);
        if (x >= backBtnX && x <= backBtnX + backBtnW && y >= backBtnY && y <= backBtnY + backBtnH) {
            this._mailBackBtnHover = true;
            return true;
        }

        // 检查领取按钮悬停
        const mail = this.mailSystem ? this.mailSystem.getMails().find(m => m.id === this._selectedMailId) : null;
        if (mail && mail.attachment && !mail.claimed) {
            const attachmentY = panelRect.y + panelRect.h - Math.round(100 * ds);
            const claimBtnX = panelRect.x + panelRect.w - pad - Math.round(80 * ds);
            const claimBtnY = attachmentY + Math.round(25 * ds);
            const claimBtnW = Math.round(70 * ds);
            const claimBtnH = Math.round(28 * ds);
            if (x >= claimBtnX && x <= claimBtnX + claimBtnW && y >= claimBtnY && y <= claimBtnY + claimBtnH) {
                this._mailClaimBtnHover = true;
                return true;
            }
        }

        // 检查是否在面板内
        return x >= panelRect.x && x <= panelRect.x + panelRect.w &&
               y >= panelRect.y && y <= panelRect.y + panelRect.h;
    }

    /**
     * 处理邮件相关的鼠标点击
     * @param {number} x - 鼠标X坐标
     * @param {number} y - 鼠标Y坐标
     * @returns {boolean} 是否处理了事件
     */
    handleMailMouseClick(x, y) {
        const ds = this.deviceScale;
        const iconRect = this._getMailIconRect();

        // 点击图标 - 切换面板显示
        if (x >= iconRect.x && x <= iconRect.x + iconRect.w &&
            y >= iconRect.y && y <= iconRect.y + iconRect.h) {
            this._showMailPanel = !this._showMailPanel;
            this._mailPanelTarget = this._showMailPanel ? 1 : 0;
            // 打开面板时重置选中状态
            if (!this._showMailPanel) {
                this._selectedMailId = null;
            }
            return true;
        }

        // 面板内点击
        if (this._showMailPanel) {
            const panelRect = this._getMailPanelRect();

            // 如果正在显示邮件详情
            if (this._selectedMailId) {
                return this._handleMailDetailMouseClick(x, y, panelRect);
            }

            // 点击"全部已读"按钮
            const btnX = panelRect.x + panelRect.w - Math.round(80 * ds);
            const btnY = panelRect.y + Math.round(10 * ds);
            const btnW = Math.round(70 * ds);
            const btnH = Math.round(20 * ds);
            if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
                if (this.mailSystem) {
                    this.mailSystem.markAllAsRead();
                }
                return true;
            }

            // 点击邮件项 - 打开详情
            const mails = this.mailSystem ? this.mailSystem.getMails() : [];
            const itemH = Math.round(60 * ds);
            const headerH = Math.round(40 * ds);
            const listY = panelRect.y + headerH;

            for (let i = 0; i < mails.length; i++) {
                const itemY = listY + i * itemH;
                if (x >= panelRect.x && x <= panelRect.x + panelRect.w &&
                    y >= itemY && y <= itemY + itemH) {
                    const mail = mails[i];
                    if (mail) {
                        this._selectedMailId = mail.id;
                        // 标记为已读
                        if (this.mailSystem) {
                            this.mailSystem.markAsRead(mail.id);
                        }
                    }
                    return true;
                }
            }

            // 点击面板外部关闭面板
            if (!(x >= panelRect.x && x <= panelRect.x + panelRect.w &&
                  y >= panelRect.y && y <= panelRect.y + panelRect.h)) {
                this._showMailPanel = false;
                this._mailPanelTarget = 0;
                this._selectedMailId = null;
                return false;
            }

            return true;
        }

        return false;
    }

    /**
     * 处理邮件详情面板的鼠标点击
     */
    _handleMailDetailMouseClick(x, y, panelRect) {
        const ds = this.deviceScale;
        const pad = Math.round(16 * ds);

        // 检查返回按钮点击
        const backBtnX = panelRect.x + Math.round(12 * ds);
        const backBtnY = panelRect.y + Math.round(50 * ds);
        const backBtnW = Math.round(50 * ds);
        const backBtnH = Math.round(24 * ds);
        if (x >= backBtnX && x <= backBtnX + backBtnW && y >= backBtnY && y <= backBtnY + backBtnH) {
            this._selectedMailId = null;
            return true;
        }

        // 检查领取按钮点击
        const mail = this.mailSystem ? this.mailSystem.getMails().find(m => m.id === this._selectedMailId) : null;
        if (mail && mail.attachment && !mail.claimed) {
            const attachmentY = panelRect.y + panelRect.h - Math.round(100 * ds);
            const claimBtnX = panelRect.x + panelRect.w - pad - Math.round(80 * ds);
            const claimBtnY = attachmentY + Math.round(25 * ds);
            const claimBtnW = Math.round(70 * ds);
            const claimBtnH = Math.round(28 * ds);
            if (x >= claimBtnX && x <= claimBtnX + claimBtnW && y >= claimBtnY && y <= claimBtnY + claimBtnH) {
                if (this.mailSystem) {
                    this.mailSystem.claimAttachment(mail.id);
                }
                return true;
            }
        }

        // 点击面板外部关闭面板
        if (!(x >= panelRect.x && x <= panelRect.x + panelRect.w &&
              y >= panelRect.y && y <= panelRect.y + panelRect.h)) {
            this._showMailPanel = false;
            this._mailPanelTarget = 0;
            this._selectedMailId = null;
            return false;
        }

        return true;
    }

    /**
     * 获取命令菜单面板矩形区域
     * @returns {{x:number, y:number, w:number, h:number}}
     */
    _getCommandMenuRect() {
        const ds = this.deviceScale;
        const commands = this.getAvailableCommands();
        const itemH = Math.round(36 * ds);
        const headerH = Math.round(32 * ds);
        const pad = Math.round(12 * ds);
        const panelW = Math.round(200 * ds);
        const panelH = headerH + commands.length * itemH + pad * 2;
        // 面板显示在屏幕中央偏左（避免与任何控件重叠）
        const x = this.width * 0.25 - panelW / 2;
        const y = this.height - panelH - Math.round(60 * ds);
        return { x, y, w: panelW, h: panelH, itemH, headerH, pad };
    }

    /**
     * 渲染命令菜单面板
     */
    _renderCommandMenu() {
        if (this._commandMenuAnim <= 0.001) return;

        const ctx = this.ctx;
        const colors = this.theme.colors;
        const ds = this.deviceScale;
        const anim = this._commandMenuAnim;
        const rect = this._getCommandMenuRect();
        const commands = this.getAvailableCommands();

        ctx.save();

        // 动画：从底部向上展开
        const easedAnim = this._easeOutCubic(anim);
        const currentH = rect.h * easedAnim;
        const drawY = rect.y + rect.h - currentH;
        const panelAlpha = anim;

        ctx.globalAlpha = panelAlpha;
        ctx.beginPath();
        ctx.rect(rect.x, drawY, rect.w, currentH);
        ctx.clip();

        // 使用统一面板背景
        this._drawPanelBackground(ctx, rect.x, rect.y, rect.w, rect.h, colors.primary);

        // 标题栏
        ctx.fillStyle = colors.text;
        ctx.font = `bold ${Math.round(13 * ds)}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('命令菜单 (空格)', rect.x + rect.w / 2, rect.y + rect.headerH / 2);

        // 标题下方细线
        ctx.strokeStyle = 'rgba(75, 85, 99, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(rect.x + rect.pad, rect.y + rect.headerH);
        ctx.lineTo(rect.x + rect.w - rect.pad, rect.y + rect.headerH);
        ctx.stroke();

        // 命令列表中英图标映射
        const COMMAND_ICON_MAP = {
            '移动': 'move',
            '攻击': 'attack',
            '巡逻': 'patrol',
            '撤退': 'retreat',
            '建造基地': 'build',
            '封锁区域': 'blockade',
            '采集资源': 'collect',
            '炮火压制': 'bombard',
            '封锁': 'blockade',
            '炮火打击': 'bombard',
            '建造前哨站': 'build',
            '建造战机': 'build',
            '建造战舰': 'build',
            '建造工程船': 'build',
        };

        let itemY = rect.y + rect.headerH + rect.pad;
        for (let i = 0; i < commands.length; i++) {
            const cmd = commands[i];
            const isHover = i === this._commandMenuHoverIdx;
            const isClick = i === this._commandMenuClickIdx;

            // stagger 延迟
            const staggerDelay = i * 0.02;
            const staggerDuration = 0.2;
            let itemAnim = Math.max(0, Math.min(1, (easedAnim - staggerDelay) / staggerDuration));
            itemAnim = 1 - Math.pow(1 - itemAnim, 3);
            const itemAlpha = itemAnim;
            const itemXOffset = (1 - itemAnim) * Math.round(6 * ds);

            ctx.save();
            ctx.globalAlpha = itemAlpha;

            const itemX = rect.x + rect.pad + itemXOffset;
            const itemW = rect.w - rect.pad * 2;

            // 背景
            if (isClick) {
                ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
            } else if (isHover) {
                ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
            } else if (i % 2 === 0) {
                ctx.fillStyle = 'rgba(17, 24, 39, 0.6)';
            } else {
                ctx.fillStyle = 'rgba(17, 24, 39, 0.3)';
            }
            ctx.fillRect(itemX, itemY, itemW, rect.itemH);

            // 快捷键标签背景
            const keyLabelW = Math.round(22 * ds);
            const keyLabelH = Math.round(18 * ds);
            const keyLabelX = itemX + Math.round(6 * ds);
            const keyLabelY = itemY + (rect.itemH - keyLabelH) / 2;
            ctx.fillStyle = isHover ? colors.primary : 'rgba(75, 85, 99, 0.5)';
            ctx.beginPath();
            ctx.roundRect(keyLabelX, keyLabelY, keyLabelW, keyLabelH, Math.round(3 * ds));
            ctx.fill();

            // 快捷键文字
            ctx.fillStyle = colors.text;
            ctx.font = `bold ${Math.round(11 * ds)}px "Segoe UI", Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(cmd.label, keyLabelX + keyLabelW / 2, keyLabelY + keyLabelH / 2);

            // 命令名称
            ctx.fillStyle = isHover ? colors.primaryHover : colors.text;
            ctx.font = `${Math.round(13 * ds)}px "Segoe UI", Arial, sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const iconSize = Math.round(18 * ds);
            const iconX = itemX + Math.round(34 * ds) + iconSize / 2;
            const centerY = itemY + rect.itemH / 2;
            const iconColor = isHover ? colors.primary : colors.text;
            
            // 绘制命令图标
            const iconName = COMMAND_ICON_MAP[cmd.text];
            if (iconName && IconRenderer.iconExists(iconName)) {
                IconRenderer.drawIcon(ctx, iconName, iconX, centerY, iconSize, iconColor);
            }
            
            const nameX = itemX + Math.round(34 * ds) + iconSize + Math.round(8 * ds);
            ctx.fillText(cmd.text, nameX, centerY);

            // 成本（如果有）- 显示在右侧
            if (cmd.cost) {
                const nameW = ctx.measureText(cmd.text).width;
                ctx.fillStyle = colors.energy;
                ctx.font = `${Math.round(10 * ds)}px "Segoe UI", Arial, sans-serif`;
                ctx.textAlign = 'left';
                ctx.fillText(cmd.cost, nameX + nameW + Math.round(8 * ds), centerY);
            }

            ctx.restore();

            itemY += rect.itemH;
        }

        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    /**
     * 渲染底部中央指令按钮
     */
    _renderCommandButton() {
        const ctx = this.ctx;
        const ds = this.deviceScale;
        const btnW = Math.round(120 * ds);
        const btnH = Math.round(32 * ds);
        const x = (this.width - btnW) / 2;
        const y = this.height - btnH - Math.round(8 * ds);
        const isHover = this._hoverCommandBtn;
        const isActive = this._showCommandMenu;

        ctx.save();

        // 点击动画缩放
        const clickScale = 1 - this._commandBtnClickAnim * 0.05;
        const cx = x + btnW / 2;
        const cy = y + btnH / 2;
        ctx.translate(cx, cy);
        ctx.scale(clickScale, clickScale);
        ctx.translate(-cx, -cy);

        this._drawButton(ctx, x, y, btnW, btnH, '指令 (Backspace)', isHover || isActive, false, isActive ? window.COLORS.primary : undefined);

        ctx.restore();
    }

    /**
     * 获取指令按钮矩形区域（用于碰撞检测）
     * @returns {{x:number, y:number, w:number, h:number}}
     */
    _getCommandButtonRect() {
        const ds = this.deviceScale;
        const btnW = Math.round(120 * ds);
        const btnH = Math.round(32 * ds);
        const x = (this.width - btnW) / 2;
        const y = this.height - btnH - Math.round(8 * ds);
        return { x, y, w: btnW, h: btnH };
    }

    _renderCancelButton() {
        if (this.commandMode === 'normal') return;

        const ctx = this.ctx;
        const ds = this.deviceScale;
        const btnW = Math.round(80 * ds);
        const btnH = Math.round(36 * ds);
        const pad = this.theme.layout.padding;
        const x = this.width - btnW - pad;
        const y = this.height - btnH - pad - Math.round(50 * ds);

        this.cancelBtnRect = { x, y, w: btnW, h: btnH };

        this._drawButton(ctx, x, y, btnW, btnH, '取消', false, false, window.COLORS.danger);
    }

    /**
     * 渲染左上角 ESC 按钮
     */
    _renderEscButton() {
        if (!this._isMobileDevice()) return;
        const ctx = this.ctx;
        const ds = this.deviceScale;
        const btnW = Math.round(42 * ds);
        const btnH = Math.round(34 * ds);
        const x = Math.round(8 * ds);
        const y = Math.round(8 * ds);
        const isHover = this._escBtnHover;
        const colors = window.COLORS;

        ctx.save();

        // 点击动画缩放
        const clickScale = 1 - this._escBtnClickAnim * 0.08;
        const cx = x + btnW / 2;
        const cy = y + btnH / 2;
        ctx.translate(cx, cy);
        ctx.scale(clickScale, clickScale);
        ctx.translate(-cx, -cy);

        // 背景
        if (isHover) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
            ctx.shadowColor = colors.danger;
            ctx.shadowBlur = Math.round(6 * ds);
        } else {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        }
        const radius = Math.round(6 * ds);
        this._roundRect(ctx, x, y, btnW, btnH, radius);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // 边框
        ctx.strokeStyle = isHover ? colors.danger : 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = Math.round(1.5 * ds);
        this._roundRect(ctx, x, y, btnW, btnH, radius);
        ctx.stroke();

        // ESC 文字
        ctx.fillStyle = isHover ? colors.danger : '#ef4444';
        ctx.font = `bold ${Math.round(14 * ds)}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ESC', cx, cy);

        ctx.restore();
    }

    /**
     * 获取 ESC 按钮矩形区域（用于碰撞检测）
     * @returns {{x:number, y:number, w:number, h:number}}
     */
    _getEscButtonRect() {
        const ds = this.deviceScale;
        const btnW = Math.round(42 * ds);
        const btnH = Math.round(34 * ds);
        return {
            x: Math.round(8 * ds),
            y: Math.round(8 * ds),
            w: btnW,
            h: btnH
        };
    }

    /**
     * 渲染底部指令区左侧的框选模式切换按钮
     */
    _renderBoxSelectButton() {
        if (!this._isMobileDevice()) return;
        const ctx = this.ctx;
        const ds = this.deviceScale;
        const btnW = Math.round(90 * ds);
        const btnH = Math.round(32 * ds);
        const cmdBtn = this._getCommandButtonRect();
        const gap = Math.round(8 * ds);
        const x = cmdBtn.x - btnW - gap;
        const y = cmdBtn.y;
        const isHover = this._boxSelectBtnHover;
        const isActive = this.boxSelectMode;
        const colors = window.COLORS;

        ctx.save();

        // 点击动画缩放
        const clickScale = 1 - this._boxSelectBtnClickAnim * 0.05;
        const cx = x + btnW / 2;
        const cy = y + btnH / 2;
        ctx.translate(cx, cy);
        ctx.scale(clickScale, clickScale);
        ctx.translate(-cx, -cy);

        const accentColor = isActive ? colors.success : colors.primary;
        const label = isActive ? '框选中' : '框选';
        this._drawButton(ctx, x, y, btnW, btnH, label, isHover || isActive, false, accentColor);

        ctx.restore();
    }

    /**
     * 获取框选按钮矩形区域（用于碰撞检测）
     * @returns {{x:number, y:number, w:number, h:number}}
     */
    _getBoxSelectButtonRect() {
        const ds = this.deviceScale;
        const btnW = Math.round(90 * ds);
        const btnH = Math.round(32 * ds);
        const cmdBtn = this._getCommandButtonRect();
        const gap = Math.round(8 * ds);
        return {
            x: cmdBtn.x - btnW - gap,
            y: cmdBtn.y,
            w: btnW,
            h: btnH
        };
    }

    show() {
        this.visible = true;
    }

    hide() {
        this.visible = false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HUDSystem, ProximaCoinRenderer };
}
