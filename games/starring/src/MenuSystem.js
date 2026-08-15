/**
 * MenuSystem - 主菜单、暂停菜单等菜单界面系统
 * 简约科技风格，深色背景+简洁线条
 */
class MenuSystem {
    constructor(ctx, theme, input) {
        this.ctx = ctx;
        this.theme = theme;
        this.input = input;
        this.width = ctx.canvas.width;
        this.height = ctx.canvas.height;
        this.buttons = [];
        this.visible = true;
        this.onStartGame = null;
        this.onSettings = null;
        this.onQuit = null;
        this.onMultiplayerStart = null;
        this.onTutorial = null;
        this._hoverIndex = -1;
        this.bgImage = null;
        this.animationTime = 0;

        // 联机大厅状态
        this.showMultiplayerLobby = false;
        this.multiplayerMode = null;
        this._hoverModeBtn = -1;
        this.connectionStatus = 'idle'; // idle, waiting, connected, failed
        this.statusText = '';

        // 科技树面板状态
        this.showTechTreePanel = false;
        this._hoverTechTreeBackBtn = false;

        // 服务器连接状态指示器
        this.serverConnectionStatus = 'disconnected';
        this.serverPing = -1;
        this.serverPacketLoss = 0;
        this.roomIdInput = '';
        this.ipInput = '';
        this.portInput = '';
        this._focusedInput = null;
        this._hoverLobbyButton = -1;

        // 房间列表
        this.roomList = [];
        this._hoverRoomIndex = -1;
        this._roomListRefreshInterval = null;
        this.onRefreshRoomList = null;

        // 账户系统
        this.isLoggedIn = false;
        this.currentUser = null;
        this.showAccountPanel = false;
        this.accountPanelView = 'login';
        this.accountPanelAnimation = 0;
        this.accountInputs = {
            loginUsername: '',
            loginPassword: '',
            regUsername: '',
            regPassword: '',
            regConfirmPassword: '',
            regCaptcha: ''
        };
        this.accountCursorIndex = {
            loginUsername: 0,
            loginPassword: 0,
            regUsername: 0,
            regPassword: 0,
            regConfirmPassword: 0,
            regCaptcha: 0
        };
        this.accountFocusedInput = null;
        this.accountErrorMsg = '';
        this.captchaCode = '';
        this.captchaCanvas = null;
        this._hoverAccountBtn = false;
        this._hoverAccountPanelBtn = -1;
        this._hoverCaptcha = false;
        this._hoverSwitchLink = false;
        this.accountBtnRect = null;
    }

    setBgImage(img) {
        this.bgImage = img;
    }

    init() {
        this._createButtons();
        this._createAccountBtn();
        this._generateCaptcha();
        this.input.on('mouseMove', this._onMouseMove.bind(this));
        this.input.on('mouseClick', this._onMouseClick.bind(this));
        this.input.on('keyDown', this._onKeyDown.bind(this));
    }

    _generateCaptcha() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.captchaCode = code;

        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 40;
        const c = canvas.getContext('2d');

        // 背景
        c.fillStyle = '#1e293b';
        c.fillRect(0, 0, 100, 40);

        // 噪点
        for (let i = 0; i < 30; i++) {
            c.fillStyle = `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.3)`;
            c.beginPath();
            c.arc(Math.random() * 100, Math.random() * 40, Math.random() * 2 + 1, 0, Math.PI * 2);
            c.fill();
        }

        // 干扰线
        for (let i = 0; i < 3; i++) {
            c.strokeStyle = `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.4)`;
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(Math.random() * 100, Math.random() * 40);
            c.lineTo(Math.random() * 100, Math.random() * 40);
            c.stroke();
        }

        // 文字
        for (let i = 0; i < code.length; i++) {
            c.save();
            c.translate(15 + i * 20, 20);
            c.rotate((Math.random() - 0.5) * 0.6);
            c.fillStyle = `hsl(${Math.random() * 60 + 180}, 80%, 65%)`;
            c.font = 'bold 22px monospace';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(code[i], 0, 0);
            c.restore();
        }

        this.captchaCanvas = canvas;
    }

    _createAccountBtn() {
        // 新按钮尺寸更大，为图标+文字预留空间
        this.accountBtnRect = { x: this.width - 150, y: 16, w: 130, h: 40 };
    }

    _renderAccountBtn() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const rect = this.accountBtnRect;
        if (!rect) return;

        const isHover = this._hoverAccountBtn;
        const time = Date.now() / 1000;

        ctx.save();

        // 外发光效果
        if (isHover) {
            ctx.shadowColor = 'rgba(59, 130, 246, 0.4)';
            ctx.shadowBlur = 15;
        }

        // 按钮背景 - 渐变
        const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
        if (isHover) {
            gradient.addColorStop(0, 'rgba(30, 41, 59, 0.95)');
            gradient.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
        } else {
            gradient.addColorStop(0, 'rgba(15, 23, 42, 0.8)');
            gradient.addColorStop(1, 'rgba(2, 6, 23, 0.8)');
        }

        // 圆角矩形路径
        const r = 20;
        ctx.beginPath();
        ctx.moveTo(rect.x + r, rect.y);
        ctx.lineTo(rect.x + rect.w - r, rect.y);
        ctx.quadraticCurveTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + r);
        ctx.lineTo(rect.x + rect.w, rect.y + rect.h - r);
        ctx.quadraticCurveTo(rect.x + rect.w, rect.y + rect.h, rect.x + rect.w - r, rect.y + rect.h);
        ctx.lineTo(rect.x + r, rect.y + rect.h);
        ctx.quadraticCurveTo(rect.x, rect.y + rect.h, rect.x, rect.y + rect.h - r);
        ctx.lineTo(rect.x, rect.y + r);
        ctx.quadraticCurveTo(rect.x, rect.y, rect.x + r, rect.y);
        ctx.closePath();

        ctx.fillStyle = gradient;
        ctx.fill();

        // 边框
        ctx.shadowBlur = 0;
        ctx.strokeStyle = isHover ? 'rgba(96, 165, 250, 0.6)' : 'rgba(59, 130, 246, 0.3)';
        ctx.lineWidth = isHover ? 1.5 : 1;
        ctx.stroke();

        // 顶部高光线
        ctx.beginPath();
        ctx.moveTo(rect.x + r, rect.y + 1);
        ctx.lineTo(rect.x + rect.w - r, rect.y + 1);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();

        // 绘制星环图标
        const iconSize = 18;
        const iconX = rect.x + 22;
        const iconY = rect.y + rect.h / 2;
        this._renderStarRingIcon(ctx, iconX, iconY, iconSize, isHover, time);

        // 文字
        ctx.fillStyle = isHover ? '#ffffff' : colors.text;
        ctx.font = '13px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const btnText = this.isLoggedIn && this.currentUser ? this._truncateText(this.currentUser.username, 8) : '登录/注册';
        ctx.fillText(btnText, iconX + iconSize / 2 + 8, iconY);

        // 已登录时显示在线指示点
        if (this.isLoggedIn && this.currentUser) {
            const dotX = rect.x + rect.w - 14;
            const dotY = rect.y + rect.h / 2;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#22c55e';
            ctx.fill();
            // 脉冲动画
            const pulseScale = 1 + Math.sin(time * 3) * 0.3;
            ctx.beginPath();
            ctx.arc(dotX, dotY, 3 * pulseScale, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(34, 197, 94, ${0.3 - Math.sin(time * 3) * 0.15})`;
            ctx.fill();
        }
    }

    /**
     * 绘制星环图标
     */
    _renderStarRingIcon(ctx, x, y, size, isHover, time) {
        ctx.save();
        ctx.translate(x, y);

        // 中心圆
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = isHover ? '#60a5fa' : '#3b82f6';
        ctx.fill();

        // 旋转的星环
        const rotation = time * 1.5;

        // 外环
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.55, size * 0.2, rotation, 0, Math.PI * 2);
        ctx.strokeStyle = isHover ? 'rgba(96, 165, 250, 0.8)' : 'rgba(59, 130, 246, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 内环（反向旋转）
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.4, size * 0.15, -rotation * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = isHover ? 'rgba(139, 92, 246, 0.6)' : 'rgba(139, 92, 246, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 轨道上的小光点
        const dotAngle = rotation * 2;
        const dotRx = size * 0.55;
        const dotRy = size * 0.2;
        const dotX = Math.cos(dotAngle) * dotRx * Math.cos(rotation) - Math.sin(dotAngle) * dotRy * Math.sin(rotation);
        const dotY = Math.cos(dotAngle) * dotRx * Math.sin(rotation) + Math.sin(dotAngle) * dotRy * Math.cos(rotation);

        ctx.beginPath();
        ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    /**
     * 截断文字
     */
    _truncateText(text, maxLen) {
        if (text.length <= maxLen) return text;
        return text.substring(0, maxLen) + '...';
    }

    _renderAccountPanel() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const panelW = 400;
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        // 半透明背景遮罩（带模糊效果暗示）
        ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
        ctx.fillRect(0, 0, this.width, this.height);

        let panelH = 0;
        if (this.accountPanelView === 'login') panelH = 360;
        else if (this.accountPanelView === 'register') panelH = 480;
        else if (this.accountPanelView === 'profile') panelH = 280;

        const panelX = centerX - panelW / 2;
        const panelY = centerY - panelH / 2;

        // 面板背景 - 深色玻璃质感
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fillRect(panelX, panelY, panelW, panelH);

        // 顶部装饰线
        ctx.fillStyle = colors.primary;
        ctx.fillRect(panelX, panelY, panelW, 2);

        // 面板边框
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        // 内发光效果
        ctx.shadowColor = 'rgba(59, 130, 246, 0.1)';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.05)';
        ctx.strokeRect(panelX + 4, panelY + 4, panelW - 8, panelH - 8);
        ctx.shadowBlur = 0;

        // 标题
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        let title = '';
        if (this.accountPanelView === 'login') title = '账户登录';
        else if (this.accountPanelView === 'register') title = '注册账户';
        else if (this.accountPanelView === 'profile') title = '个人中心';
        ctx.fillText(title, centerX, panelY + 24);

        // 标题下划线
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX - 40, panelY + 50);
        ctx.lineTo(centerX + 40, panelY + 50);
        ctx.stroke();

        if (this.accountPanelView === 'login') {
            const inputX = centerX - 140;
            const inputW = 280;
            const inputH = 40;
            const usernameY = panelY + 80;
            const passwordY = usernameY + 62;
            const btnY = passwordY + 68;

            this._renderInputBox('用户名', this.accountInputs.loginUsername, inputX, usernameY, inputW, inputH, this.accountFocusedInput === 'loginUsername', this.accountCursorIndex.loginUsername);
            this._renderInputBox('密码', this.accountInputs.loginPassword, inputX, passwordY, inputW, inputH, this.accountFocusedInput === 'loginPassword', this.accountCursorIndex.loginPassword);

            // 登录按钮
            const btnW = 280;
            const btnH = 44;
            const btnX = centerX - btnW / 2;
            const isHoverBtn = this._hoverAccountPanelBtn === 0;
            this._renderPrimaryButton('登 录', btnX, btnY, btnW, btnH, isHoverBtn);

            // 错误信息
            if (this.accountErrorMsg) {
                ctx.fillStyle = colors.danger;
                ctx.font = '12px "Segoe UI", Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(this.accountErrorMsg, centerX, btnY + btnH + 12);
            }

            // 切换链接
            const linkY = btnY + btnH + (this.accountErrorMsg ? 36 : 18);
            ctx.fillStyle = this._hoverSwitchLink ? colors.primaryHover : colors.primary;
            ctx.font = '12px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('还没有账号？去注册', centerX, linkY);
        } else if (this.accountPanelView === 'register') {
            const inputX = centerX - 140;
            const inputW = 280;
            const inputH = 38;
            const usernameY = panelY + 76;
            const passwordY = usernameY + 54;
            const confirmY = passwordY + 54;
            const captchaY = confirmY + 54;
            const btnY = captchaY + 64;

            this._renderInputBox('用户名', this.accountInputs.regUsername, inputX, usernameY, inputW, inputH, this.accountFocusedInput === 'regUsername', this.accountCursorIndex.regUsername);
            this._renderInputBox('密码', this.accountInputs.regPassword, inputX, passwordY, inputW, inputH, this.accountFocusedInput === 'regPassword', this.accountCursorIndex.regPassword);
            this._renderInputBox('确认密码', this.accountInputs.regConfirmPassword, inputX, confirmY, inputW, inputH, this.accountFocusedInput === 'regConfirmPassword', this.accountCursorIndex.regConfirmPassword);

            // 验证码区域
            const captchaX = inputX;
            const captchaImgY = captchaY;
            if (this.captchaCanvas) {
                ctx.drawImage(this.captchaCanvas, captchaX, captchaImgY);
            }
            // 验证码边框
            ctx.strokeStyle = this._hoverCaptcha ? colors.primary : 'rgba(148, 163, 184, 0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(captchaX, captchaImgY, 100, 40);

            // 验证码输入框
            const captchaInputX = captchaX + 114;
            const captchaInputW = 166;
            this._renderInputBox('验证码', this.accountInputs.regCaptcha, captchaInputX, captchaY + 2, captchaInputW, inputH - 4, this.accountFocusedInput === 'regCaptcha', this.accountCursorIndex.regCaptcha);

            // 注册按钮
            const btnW = 280;
            const btnH = 44;
            const btnX = centerX - btnW / 2;
            const isHoverBtn = this._hoverAccountPanelBtn === 0;
            this._renderPrimaryButton('注 册', btnX, btnY, btnW, btnH, isHoverBtn);

            // 错误信息
            if (this.accountErrorMsg) {
                ctx.fillStyle = colors.danger;
                ctx.font = '12px "Segoe UI", Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(this.accountErrorMsg, centerX, btnY + btnH + 12);
            }

            // 切换链接
            const linkY = btnY + btnH + (this.accountErrorMsg ? 36 : 18);
            ctx.fillStyle = this._hoverSwitchLink ? colors.primaryHover : colors.primary;
            ctx.font = '12px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('已有账号？去登录', centerX, linkY);
        } else if (this.accountPanelView === 'profile') {
            const msgY = panelY + 90;

            // 用户头像圆形背景
            ctx.beginPath();
            ctx.arc(centerX, msgY, 32, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
            ctx.fill();
            ctx.strokeStyle = colors.primary;
            ctx.lineWidth = 2;
            ctx.stroke();

            // 用户首字母
            const username = this.currentUser && this.currentUser.username ? this.currentUser.username : '';
            const initial = username.charAt(0).toUpperCase();
            ctx.fillStyle = colors.primary;
            ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(initial, centerX, msgY);

            // 欢迎文字
            ctx.fillStyle = colors.text;
            ctx.font = '14px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`欢迎回来，${username}`, centerX, msgY + 48);

            // 退出登录按钮
            const btnW = 280;
            const btnH = 44;
            const btnX = centerX - btnW / 2;
            const btnY = msgY + 100;
            const isHoverBtn = this._hoverAccountPanelBtn === 0;
            this._renderPrimaryButton('退出登录', btnX, btnY, btnW, btnH, isHoverBtn);
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    _renderTechTreePanel() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const panelW = 720;
        const panelH = 520;
        const panelX = centerX - panelW / 2;
        const panelY = centerY - panelH / 2;

        // 半透明深色背景遮罩
        ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
        ctx.fillRect(0, 0, this.width, this.height);

        // 面板背景
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fillRect(panelX, panelY, panelW, panelH);

        // 顶部装饰线
        ctx.fillStyle = colors.primary;
        ctx.fillRect(panelX, panelY, panelW, 2);

        // 面板边框
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        // 内发光效果
        ctx.shadowColor = 'rgba(59, 130, 246, 0.1)';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.05)';
        ctx.strokeRect(panelX + 4, panelY + 4, panelW - 8, panelH - 8);
        ctx.shadowBlur = 0;

        // 标题
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('科技研发', centerX, panelY + 20);

        // 标题下划线
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX - 50, panelY + 48);
        ctx.lineTo(centerX + 50, panelY + 48);
        ctx.stroke();

        // 科技树节点定义（3层结构）
        const nodeRadius = 32;
        const nodeYStart = panelY + 100;
        const nodeYGap = 120;
        const time = Date.now() / 1000;

        const techNodes = [
            // 第1层（根节点）
            { id: 0, name: '正在开发中', x: centerX, y: nodeYStart, layer: 0 },
            // 第2层
            { id: 1, name: '正在开发中', x: centerX - 180, y: nodeYStart + nodeYGap, layer: 1 },
            { id: 2, name: '正在开发中', x: centerX, y: nodeYStart + nodeYGap, layer: 1 },
            { id: 3, name: '正在开发中', x: centerX + 180, y: nodeYStart + nodeYGap, layer: 1 },
            // 第3层
            { id: 4, name: '正在开发中', x: centerX - 220, y: nodeYStart + nodeYGap * 2, layer: 2 },
            { id: 5, name: '正在开发中', x: centerX - 70, y: nodeYStart + nodeYGap * 2, layer: 2 },
            { id: 6, name: '正在开发中', x: centerX + 70, y: nodeYStart + nodeYGap * 2, layer: 2 },
            { id: 7, name: '正在开发中', x: centerX + 220, y: nodeYStart + nodeYGap * 2, layer: 2 }
        ];

        // 节点连接关系
        const connections = [
            { from: 0, to: 1 },
            { from: 0, to: 2 },
            { from: 0, to: 3 },
            { from: 1, to: 4 },
            { from: 1, to: 5 },
            { from: 2, to: 5 },
            { from: 2, to: 6 },
            { from: 3, to: 6 },
            { from: 3, to: 7 }
        ];

        // 绘制连接线
        for (const conn of connections) {
            const fromNode = techNodes[conn.from];
            const toNode = techNodes[conn.to];

            ctx.save();
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = -time * 10;

            ctx.beginPath();
            ctx.moveTo(fromNode.x, fromNode.y + nodeRadius);
            ctx.lineTo(toNode.x, toNode.y - nodeRadius);
            ctx.stroke();
            ctx.restore();
        }

        // 绘制节点
        for (const node of techNodes) {
            const pulseScale = 1 + Math.sin(time * 2 + node.id) * 0.03;
            const glowAlpha = 0.25 + Math.sin(time * 2 + node.id) * 0.1;

            ctx.save();

            // 外发光效果
            ctx.shadowColor = colors.primary;
            ctx.shadowBlur = 15 * glowAlpha * 4;
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeRadius * pulseScale, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.fill();
            ctx.shadowBlur = 0;

            // 节点边框 - 科技感发光边框
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeRadius * pulseScale, 0, Math.PI * 2);
            ctx.strokeStyle = colors.primary;
            ctx.lineWidth = 2;
            ctx.stroke();

            // 内部装饰环
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeRadius * 0.65, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // 中心点
            ctx.beginPath();
            ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = colors.primary;
            ctx.fill();

            // 节点文字
            ctx.fillStyle = colors.text;
            ctx.font = '12px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('正在开发功能', node.x, node.y);

            // 节点名称（下方）
            ctx.fillStyle = colors.textMuted;
            ctx.font = '11px "Segoe UI", Arial, sans-serif';
            ctx.fillText(node.name, node.x, node.y + nodeRadius + 16);

            ctx.restore();
        }

        // 返回按钮
        const backBtnW = 120;
        const backBtnH = 40;
        const backBtnX = centerX - backBtnW / 2;
        const backBtnY = panelY + panelH - 60;
        const isBackHover = this._hoverTechTreeBackBtn;

        this._drawButton(ctx, backBtnX, backBtnY, backBtnW, backBtnH, '返回', isBackHover, false);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    /**
     * 渲染主按钮（渐变背景）
     */
    _renderPrimaryButton(text, x, y, w, h, isHover) {
        this._drawButton(this.ctx, x, y, w, h, text, isHover, false, this.theme.colors.primary);
    }

    _drawButton(ctx, x, y, w, h, text, hover, disabled, accentColor) {
        const ds = 1.0;
        const radius = 6;
        const color = accentColor || window.COLORS.primary;

        ctx.save();

        if (disabled) {
            ctx.globalAlpha = 0.4;
        }

        let drawY = y;
        if (hover && !disabled) {
            drawY = y - 2;
        }

        // 背景
        if (hover && !disabled) {
            ctx.fillStyle = window.COLORS.bgCard;
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
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

    _onAccountMouseMove(data) {
        this._hoverAccountBtn = false;
        this._hoverAccountPanelBtn = -1;
        this._hoverCaptcha = false;
        this._hoverSwitchLink = false;

        if (this.accountBtnRect &&
            data.x >= this.accountBtnRect.x && data.x <= this.accountBtnRect.x + this.accountBtnRect.w &&
            data.y >= this.accountBtnRect.y && data.y <= this.accountBtnRect.y + this.accountBtnRect.h) {
            this._hoverAccountBtn = true;
            return;
        }

        if (!this.showAccountPanel) return;

        const panelW = 400;
        let panelH = 0;
        if (this.accountPanelView === 'login') panelH = 360;
        else if (this.accountPanelView === 'register') panelH = 480;
        else if (this.accountPanelView === 'profile') panelH = 280;

        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const panelX = centerX - panelW / 2;
        const panelY = centerY - panelH / 2;

        // 检查是否在面板内
        if (data.x < panelX || data.x > panelX + panelW || data.y < panelY || data.y > panelY + panelH) {
            return;
        }

        if (this.accountPanelView === 'login') {
            const inputX = centerX - 140;
            const inputW = 280;
            const inputH = 40;
            const usernameY = panelY + 80;
            const passwordY = usernameY + 62;
            const btnY = passwordY + 68;
            const btnW = 280;
            const btnH = 44;
            const btnX = centerX - btnW / 2;

            if (data.x >= btnX && data.x <= btnX + btnW && data.y >= btnY && data.y <= btnY + btnH) {
                this._hoverAccountPanelBtn = 0;
            }

            const linkY = btnY + btnH + 18;
            const linkText = '还没有账号？去注册';
            const ctxForLink = this.ctx;
            ctxForLink.font = '12px "Segoe UI", Arial, sans-serif';
            const linkWidth = ctxForLink.measureText(linkText).width;
            if (data.x >= centerX - linkWidth / 2 && data.x <= centerX + linkWidth / 2 &&
                data.y >= linkY && data.y <= linkY + 20) {
                this._hoverSwitchLink = true;
            }
        } else if (this.accountPanelView === 'register') {
            const inputX = centerX - 140;
            const inputW = 280;
            const inputH = 38;
            const usernameY = panelY + 76;
            const passwordY = usernameY + 54;
            const confirmY = passwordY + 54;
            const captchaY = confirmY + 54;
            const btnY = captchaY + 64;
            const btnW = 280;
            const btnH = 44;
            const btnX = centerX - btnW / 2;
            const captchaX = inputX;
            const captchaImgY = captchaY;

            if (data.x >= btnX && data.x <= btnX + btnW && data.y >= btnY && data.y <= btnY + btnH) {
                this._hoverAccountPanelBtn = 0;
            }

            if (data.x >= captchaX && data.x <= captchaX + 100 && data.y >= captchaImgY && data.y <= captchaImgY + 40) {
                this._hoverCaptcha = true;
            }

            const linkY = btnY + btnH + 18;
            const linkText = '已有账号？去登录';
            const ctxForLink2 = this.ctx;
            ctxForLink2.font = '12px "Segoe UI", Arial, sans-serif';
            const linkWidth = ctxForLink2.measureText(linkText).width;
            if (data.x >= centerX - linkWidth / 2 && data.x <= centerX + linkWidth / 2 &&
                data.y >= linkY && data.y <= linkY + 20) {
                this._hoverSwitchLink = true;
            }
        } else if (this.accountPanelView === 'profile') {
            const msgY = panelY + 90;
            const btnW = 280;
            const btnH = 44;
            const btnX = centerX - btnW / 2;
            const btnY = msgY + 100;

            if (data.x >= btnX && data.x <= btnX + btnW && data.y >= btnY && data.y <= btnY + btnH) {
                this._hoverAccountPanelBtn = 0;
            }
        }
    }

    _onAccountMouseClick(data) {
        if (data.button !== 0) return;
        if (data.wasDragging) return;

        // 点击账户按钮
        if (this.accountBtnRect &&
            data.x >= this.accountBtnRect.x && data.x <= this.accountBtnRect.x + this.accountBtnRect.w &&
            data.y >= this.accountBtnRect.y && data.y <= this.accountBtnRect.y + this.accountBtnRect.h) {
            if (this.isLoggedIn) {
                this.accountPanelView = 'profile';
            } else {
                this.accountPanelView = 'login';
            }
            this.showAccountPanel = !this.showAccountPanel;
            this.accountErrorMsg = '';
            this.accountFocusedInput = null;
            return true;
        }

        if (!this.showAccountPanel) return false;

        const panelW = 400;
        let panelH = 0;
        if (this.accountPanelView === 'login') panelH = 360;
        else if (this.accountPanelView === 'register') panelH = 480;
        else if (this.accountPanelView === 'profile') panelH = 280;

        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const panelX = centerX - panelW / 2;
        const panelY = centerY - panelH / 2;

        // 点击面板外部关闭
        if (data.x < panelX || data.x > panelX + panelW || data.y < panelY || data.y > panelY + panelH) {
            this.showAccountPanel = false;
            this.accountFocusedInput = null;
            return true;
        }

        if (this.accountPanelView === 'login') {
            const inputX = centerX - 140;
            const inputW = 280;
            const inputH = 40;
            const usernameY = panelY + 80;
            const passwordY = usernameY + 62;
            const btnY = passwordY + 68;
            const btnW = 280;
            const btnH = 44;
            const btnX = centerX - btnW / 2;
            const linkY = btnY + btnH + 18;

            if (data.x >= inputX && data.x <= inputX + inputW && data.y >= usernameY && data.y <= usernameY + inputH) {
                this.accountFocusedInput = 'loginUsername';
                this.accountCursorIndex.loginUsername = this._getCursorIndexFromClick(this.accountInputs.loginUsername, data.x, inputX + 12);
            } else if (data.x >= inputX && data.x <= inputX + inputW && data.y >= passwordY && data.y <= passwordY + inputH) {
                this.accountFocusedInput = 'loginPassword';
                this.accountCursorIndex.loginPassword = this._getCursorIndexFromClick(this.accountInputs.loginPassword, data.x, inputX + 12);
            } else if (data.x >= btnX && data.x <= btnX + btnW && data.y >= btnY && data.y <= btnY + btnH) {
                this._doLogin();
            } else if (this._hoverSwitchLink) {
                this.accountPanelView = 'register';
                this.accountErrorMsg = '';
                this.accountFocusedInput = null;
                this._generateCaptcha();
            } else {
                this.accountFocusedInput = null;
            }
        } else if (this.accountPanelView === 'register') {
            const inputX = centerX - 140;
            const inputW = 280;
            const inputH = 38;
            const usernameY = panelY + 76;
            const passwordY = usernameY + 54;
            const confirmY = passwordY + 54;
            const captchaY = confirmY + 54;
            const btnY = captchaY + 64;
            const btnW = 280;
            const btnH = 44;
            const btnX = centerX - btnW / 2;
            const captchaX = inputX;
            const captchaImgY = captchaY;
            const captchaInputX = captchaX + 114;
            const captchaInputW = 166;
            const linkY = btnY + btnH + 18;

            if (data.x >= inputX && data.x <= inputX + inputW && data.y >= usernameY && data.y <= usernameY + inputH) {
                this.accountFocusedInput = 'regUsername';
                this.accountCursorIndex.regUsername = this._getCursorIndexFromClick(this.accountInputs.regUsername, data.x, inputX + 12);
            } else if (data.x >= inputX && data.x <= inputX + inputW && data.y >= passwordY && data.y <= passwordY + inputH) {
                this.accountFocusedInput = 'regPassword';
                this.accountCursorIndex.regPassword = this._getCursorIndexFromClick(this.accountInputs.regPassword, data.x, inputX + 12);
            } else if (data.x >= inputX && data.x <= inputX + inputW && data.y >= confirmY && data.y <= confirmY + inputH) {
                this.accountFocusedInput = 'regConfirmPassword';
                this.accountCursorIndex.regConfirmPassword = this._getCursorIndexFromClick(this.accountInputs.regConfirmPassword, data.x, inputX + 12);
            } else if (data.x >= captchaInputX && data.x <= captchaInputX + captchaInputW && data.y >= captchaY + 2 && data.y <= captchaY + 2 + inputH - 4) {
                this.accountFocusedInput = 'regCaptcha';
                this.accountCursorIndex.regCaptcha = this._getCursorIndexFromClick(this.accountInputs.regCaptcha, data.x, captchaInputX + 12);
            } else if (data.x >= captchaX && data.x <= captchaX + 100 && data.y >= captchaImgY && data.y <= captchaImgY + 40) {
                this._generateCaptcha();
            } else if (data.x >= btnX && data.x <= btnX + btnW && data.y >= btnY && data.y <= btnY + btnH) {
                this._doRegister();
            } else if (this._hoverSwitchLink) {
                this.accountPanelView = 'login';
                this.accountErrorMsg = '';
                this.accountFocusedInput = null;
            } else {
                this.accountFocusedInput = null;
            }
        } else if (this.accountPanelView === 'profile') {
            const msgY = panelY + 90;
            const btnW = 280;
            const btnH = 44;
            const btnX = centerX - btnW / 2;
            const btnY = msgY + 100;

            if (data.x >= btnX && data.x <= btnX + btnW && data.y >= btnY && data.y <= btnY + btnH) {
                this.logout();
                this.showAccountPanel = false;
            }
        }

        return true;
    }

    _doLogin() {
        const username = this.accountInputs.loginUsername.trim();
        const password = this.accountInputs.loginPassword;
        if (!username || !password) {
            this.accountErrorMsg = '请输入用户名和密码';
            return;
        }
        if (this.onLogin) {
            this.onLogin(username, password);
        }
    }

    _doRegister() {
        const username = this.accountInputs.regUsername.trim();
        const password = this.accountInputs.regPassword;
        const confirm = this.accountInputs.regConfirmPassword;
        const captcha = this.accountInputs.regCaptcha.trim().toUpperCase();

        if (!username || !password || !confirm || !captcha) {
            this.accountErrorMsg = '请填写所有字段';
            return;
        }
        if (password !== confirm) {
            this.accountErrorMsg = '两次输入的密码不一致';
            return;
        }
        if (captcha !== this.captchaCode) {
            this.accountErrorMsg = '验证码错误';
            this._generateCaptcha();
            this.accountInputs.regCaptcha = '';
            return;
        }
        if (this.onRegister) {
            this.onRegister(username, password);
        }
    }

    _onAccountKeyDown(data) {
        if (!this.showAccountPanel) return;
        if (!this.accountFocusedInput) return;

        const inputKey = this.accountFocusedInput;
        let cursor = this.accountCursorIndex[inputKey];
        let value = this.accountInputs[inputKey];

        if (data.key === 'Backspace') {
            if (cursor > 0) {
                this.accountInputs[inputKey] = value.slice(0, cursor - 1) + value.slice(cursor);
                this.accountCursorIndex[inputKey] = cursor - 1;
            }
        } else if (data.key === 'Delete') {
            if (cursor < value.length) {
                this.accountInputs[inputKey] = value.slice(0, cursor) + value.slice(cursor + 1);
            }
        } else if (data.key === 'ArrowLeft') {
            this.accountCursorIndex[inputKey] = Math.max(0, cursor - 1);
        } else if (data.key === 'ArrowRight') {
            this.accountCursorIndex[inputKey] = Math.min(value.length, cursor + 1);
        } else if (data.key === 'Home') {
            this.accountCursorIndex[inputKey] = 0;
        } else if (data.key === 'End') {
            this.accountCursorIndex[inputKey] = value.length;
        } else if (data.key.length === 1) {
            this.accountInputs[inputKey] = value.slice(0, cursor) + data.key + value.slice(cursor);
            this.accountCursorIndex[inputKey] = cursor + 1;
        }
    }

    _getCursorIndexFromClick(value, clickX, textStartX) {
        const ctx = this.ctx;
        ctx.font = '13px "Segoe UI", Arial, sans-serif';
        const relX = clickX - textStartX;
        let bestIndex = 0;
        let bestDist = Infinity;
        for (let i = 0; i <= value.length; i++) {
            const width = ctx.measureText(value.slice(0, i)).width;
            const dist = Math.abs(width - relX);
            if (dist < bestDist) {
                bestDist = dist;
                bestIndex = i;
            }
        }
        return bestIndex;
    }

    setAccountUser(user) {
        this.isLoggedIn = true;
        this.currentUser = user;
        this.showAccountPanel = false;
        this.accountErrorMsg = '';
        this.accountFocusedInput = null;
    }

    logout() {
        this.isLoggedIn = false;
        this.currentUser = null;
        this.accountPanelView = 'login';
        this.accountErrorMsg = '';
        this.accountFocusedInput = null;
        if (this.onLogout) this.onLogout();
    }

    _createButtons() {
        const btnWidth = 260;
        const btnHeight = 56;
        const startY = this.height * 0.5;
        const gap = 72;
        const centerX = this.width / 2;

        this.buttons = [
            {
                text: '开始游戏',
                x: centerX - btnWidth / 2,
                y: startY,
                w: btnWidth,
                h: btnHeight,
                action: 'start',
                hoverOffset: { x: 0, y: 0 },
                targetOffset: { x: 0, y: 0 }
            },
            {
                text: '联机对战（beta）',
                x: centerX - btnWidth / 2,
                y: startY + gap,
                w: btnWidth,
                h: btnHeight,
                action: 'multiplayer',
                hoverOffset: { x: 0, y: 0 },
                targetOffset: { x: 0, y: 0 }
            },
            {
                text: '技术研发',
                x: centerX - btnWidth / 2,
                y: startY + gap * 2,
                w: btnWidth,
                h: btnHeight,
                action: 'techtree',
                hoverOffset: { x: 0, y: 0 },
                targetOffset: { x: 0, y: 0 }
            },
            {
                text: '游戏设置',
                x: centerX - btnWidth / 2,
                y: startY + gap * 3,
                w: btnWidth,
                h: btnHeight,
                action: 'settings',
                hoverOffset: { x: 0, y: 0 },
                targetOffset: { x: 0, y: 0 }
            },
            {
                text: '退出游戏',
                x: centerX - btnWidth / 2,
                y: startY + gap * 4,
                w: btnWidth,
                h: btnHeight,
                action: 'quit',
                hoverOffset: { x: 0, y: 0 },
                targetOffset: { x: 0, y: 0 }
            }
        ];
    }

    _createLobbyButtons() {
        const btnWidth = 140;
        const btnHeight = 36;
        const centerX = this.width / 2;
        const startY = this.height * 0.5 + 140;
        const gap = 48;

        this.lobbyButtons = [
            { text: '创建房间', x: centerX - btnWidth * 1.5 - 10, y: startY, w: btnWidth, h: btnHeight, action: 'create_room' },
            { text: '刷新列表', x: centerX - btnWidth * 0.5, y: startY, w: btnWidth, h: btnHeight, action: 'refresh_rooms' },
            { text: '加入房间', x: centerX + btnWidth * 0.5 + 10, y: startY, w: btnWidth, h: btnHeight, action: 'join_room' },
            { text: '返回', x: centerX - btnWidth / 2, y: startY + gap, w: btnWidth, h: btnHeight, action: 'back' }
        ];
    }

    /**
     * 设置房间列表
     * @param {Array} rooms - 房间列表
     */
    setRoomList(rooms) {
        this.roomList = rooms || [];
    }

    /**
     * 开始自动刷新房间列表
     */
    startRoomListRefresh() {
        if (this._roomListRefreshInterval) return;
        // 立即刷新一次
        if (this.onRefreshRoomList) this.onRefreshRoomList();
        // 每5秒刷新一次
        this._roomListRefreshInterval = setInterval(() => {
            if (this.onRefreshRoomList) this.onRefreshRoomList();
        }, 5000);
    }

    /**
     * 停止自动刷新房间列表
     */
    stopRoomListRefresh() {
        if (this._roomListRefreshInterval) {
            clearInterval(this._roomListRefreshInterval);
            this._roomListRefreshInterval = null;
        }
    }

    _onMouseMove(data) {
        if (!this.visible) return;
        if (this.inputDisabled) return;

        // 账户按钮在主菜单始终可交互
        if (!this.showMultiplayerLobby) {
            this._onAccountMouseMove(data);
            if (this.showAccountPanel) return;
        }

        // 科技树面板悬停检测
        if (this.showTechTreePanel) {
            this._hoverTechTreeBackBtn = false;
            const centerX = this.width / 2;
            const panelY = this.height / 2 - 520 / 2;
            const backBtnW = 120;
            const backBtnH = 40;
            const backBtnX = centerX - backBtnW / 2;
            const backBtnY = panelY + 520 - 60;
            if (data.x >= backBtnX && data.x <= backBtnX + backBtnW &&
                data.y >= backBtnY && data.y <= backBtnY + backBtnH) {
                this._hoverTechTreeBackBtn = true;
            }
            return;
        }

        if (this.showMultiplayerLobby) {
            this._hoverLobbyButton = -1;
            this._hoverRoomIndex = -1;
            this._hoverModeBtn = -1;

            if (!this.multiplayerMode) {
                const centerX = this.width / 2;
                const btnW = 280;
                const btnH = 64;
                const gap = 24;
                const startY = this.height * 0.5 - btnH - gap / 2;
                const modes = [
                    { text: '局域网联机', x: centerX - btnW / 2, y: startY, w: btnW, h: btnH },
                    { text: '服务器联机（beta）', x: centerX - btnW / 2, y: startY + btnH + gap, w: btnW, h: btnH }
                ];
                for (let i = 0; i < modes.length; i++) {
                    const btn = modes[i];
                    if (data.x >= btn.x && data.x <= btn.x + btn.w &&
                        data.y >= btn.y && data.y <= btn.y + btn.h) {
                        this._hoverModeBtn = i;
                        return;
                    }
                }
                return;
            }

            for (let i = 0; i < this.lobbyButtons.length; i++) {
                const btn = this.lobbyButtons[i];
                if (data.x >= btn.x && data.x <= btn.x + btn.w &&
                    data.y >= btn.y && data.y <= btn.y + btn.h) {
                    this._hoverLobbyButton = i;
                    return;
                }
            }

            // 检查房间列表悬停
            const centerX = this.width / 2;
            const listX = centerX - 150;
            const listY = this.height * 0.25;
            const listH = 120;
            const itemHeight = 28;

            if (data.x >= listX && data.x <= listX + 300 &&
                data.y >= listY && data.y <= listY + listH) {
                const index = Math.floor((data.y - listY) / itemHeight);
                if (index >= 0 && index < this.roomList.length && index < 4) {
                    this._hoverRoomIndex = index;
                }
            }
            return;
        }

        // 主菜单按钮悬停检测和鼠标跟随效果
        const prevHoverIndex = this._hoverIndex;
        this._hoverIndex = -1;

        for (let i = 0; i < this.buttons.length; i++) {
            const btn = this.buttons[i];
            // 使用原始位置检测悬停
            if (data.x >= btn.x && data.x <= btn.x + btn.w &&
                data.y >= btn.y && data.y <= btn.y + btn.h) {
                this._hoverIndex = i;

                // 计算鼠标相对于按钮中心的位置
                const btnCenterX = btn.x + btn.w / 2;
                const btnCenterY = btn.y + btn.h / 2;
                const mouseOffsetX = data.x - btnCenterX;
                const mouseOffsetY = data.y - btnCenterY;

                // 设置目标偏移量（限制在按钮尺寸的30%范围内）
                const maxOffsetX = btn.w * 0.15;
                const maxOffsetY = btn.h * 0.2;
                btn.targetOffset.x = Math.max(-maxOffsetX, Math.min(maxOffsetX, mouseOffsetX * 0.3));
                btn.targetOffset.y = Math.max(-maxOffsetY, Math.min(maxOffsetY, mouseOffsetY * 0.3)) - 8; // 向上悬浮8像素
            } else {
                // 非悬停状态，重置目标偏移
                btn.targetOffset.x = 0;
                btn.targetOffset.y = 0;
            }
        }
    }

    _onMouseClick(data) {
        if (!this.visible || data.button !== 0) return;
        if (this.inputDisabled) return;
        if (data.wasDragging) return;

        // 账户面板点击在主菜单始终优先处理
        if (!this.showMultiplayerLobby) {
            if (this._onAccountMouseClick(data)) return;
        }

        // 科技树面板点击处理
        if (this.showTechTreePanel) {
            const centerX = this.width / 2;
            const panelW = 720;
            const panelH = 520;
            const panelX = centerX - panelW / 2;
            const panelY = this.height / 2 - panelH / 2;
            const backBtnW = 120;
            const backBtnH = 40;
            const backBtnX = centerX - backBtnW / 2;
            const backBtnY = panelY + panelH - 60;

            // 点击返回按钮关闭面板
            if (data.x >= backBtnX && data.x <= backBtnX + backBtnW &&
                data.y >= backBtnY && data.y <= backBtnY + backBtnH) {
                this.showTechTreePanel = false;
                return;
            }

            // 点击面板外部关闭面板
            if (data.x < panelX || data.x > panelX + panelW || data.y < panelY || data.y > panelY + panelH) {
                this.showTechTreePanel = false;
                return;
            }
            return;
        }

        if (this.showMultiplayerLobby) {
            if (!this.multiplayerMode) {
                const centerX = this.width / 2;
                const btnW = 280;
                const btnH = 64;
                const gap = 24;
                const startY = this.height * 0.5 - btnH - gap / 2;
                const modes = [
                    { text: '局域网联机', x: centerX - btnW / 2, y: startY, w: btnW, h: btnH, mode: 'lan' },
                    { text: '服务器联机（beta）', x: centerX - btnW / 2, y: startY + btnH + gap, w: btnW, h: btnH, mode: 'server' }
                ];
                for (const btn of modes) {
                    if (data.x >= btn.x && data.x <= btn.x + btn.w &&
                        data.y >= btn.y && data.y <= btn.y + btn.h) {
                        this.multiplayerMode = btn.mode;
                        this._createLobbyButtons();
                        this.connectionStatus = 'idle';
                        this.statusText = '';
                        if (this.onMultiplayerModeSelect) this.onMultiplayerModeSelect(btn.mode);
                        return;
                    }
                }
                const backBtnW = 120;
                const backBtnH = 36;
                const backBtnX = centerX - backBtnW / 2;
                const backBtnY = startY + (btnH + gap) * 2 + 20;
                if (data.x >= backBtnX && data.x <= backBtnX + backBtnW &&
                    data.y >= backBtnY && data.y <= backBtnY + backBtnH) {
                    this.showMultiplayerLobby = false;
                    this.connectionStatus = 'idle';
                    this.statusText = '';
                }
                return;
            }

            for (const btn of this.lobbyButtons) {
                if (data.x >= btn.x && data.x <= btn.x + btn.w &&
                    data.y >= btn.y && data.y <= btn.y + btn.h) {
                    this._triggerLobbyAction(btn.action);
                    break;
                }
            }

            // 检测输入框点击
            const centerX = this.width / 2;
            const inputW = 260;
            const inputH = 32;
            const inputX = centerX - inputW / 2;

            if (this.multiplayerMode === 'lan') {
                const ipY = this.height * 0.5 - 60;
                const portY = ipY + 44;
                const roomIdY = portY + 44;

                if (data.x >= inputX && data.x <= inputX + inputW && data.y >= ipY && data.y <= ipY + inputH) {
                    this._focusedInput = 'ip';
                } else if (data.x >= inputX && data.x <= inputX + inputW && data.y >= portY && data.y <= portY + inputH) {
                    this._focusedInput = 'port';
                } else if (data.x >= inputX && data.x <= inputX + inputW && data.y >= roomIdY && data.y <= roomIdY + inputH) {
                    this._focusedInput = 'roomId';
                } else {
                    this._focusedInput = null;
                }
            } else {
                const listY = this.height * 0.25;
                const listH = 120;
                const roomIdY = listY + listH + 30;

                if (data.x >= inputX && data.x <= inputX + inputW && data.y >= roomIdY && data.y <= roomIdY + inputH) {
                    this._focusedInput = 'roomId';
                } else {
                    this._focusedInput = null;
                }
            }

            // 检查房间列表点击
            const listX = centerX - 150;
            const listY = this.height * 0.25;
            const listH = 120;
            const itemHeight = 28;

            if (data.x >= listX && data.x <= listX + 300 &&
                data.y >= listY && data.y <= listY + listH) {
                const index = Math.floor((data.y - listY) / itemHeight);
                if (index >= 0 && index < this.roomList.length && index < 4) {
                    this.roomIdInput = this.roomList[index].roomId;
                }
            }
            return;
        }

        for (const btn of this.buttons) {
            if (data.x >= btn.x && data.x <= btn.x + btn.w &&
                data.y >= btn.y && data.y <= btn.y + btn.h) {
                this._triggerAction(btn.action);
                break;
            }
        }
    }

    _onKeyDown(data) {
        if (!this.visible) return;

        // 账户面板键盘输入
        if (this.showAccountPanel) {
            this._onAccountKeyDown(data);
            return;
        }

        if (!this.showMultiplayerLobby) return;
        if (!this._focusedInput) return;

        if (data.key === 'backspace') {
            if (this._focusedInput === 'ip') {
                this.ipInput = this.ipInput.slice(0, -1);
            } else if (this._focusedInput === 'port') {
                this.portInput = this.portInput.slice(0, -1);
            } else if (this._focusedInput === 'roomId') {
                this.roomIdInput = this.roomIdInput.slice(0, -1);
            }
        } else if (data.key.length === 1) {
            if (this._focusedInput === 'ip') {
                this.ipInput += data.key;
            } else if (this._focusedInput === 'port') {
                this.portInput += data.key;
            } else if (this._focusedInput === 'roomId') {
                this.roomIdInput += data.key;
            }
        }
    }

    _triggerAction(action) {
        switch (action) {
            case 'start':
                if (this.onStartGame) this.onStartGame();
                break;
            case 'multiplayer':
                this.showMultiplayerLobby = true;
                this.multiplayerMode = null;
                this._hoverModeBtn = -1;
                this.connectionStatus = 'idle';
                this.statusText = '';
                break;
            case 'techtree':
                this.showTechTreePanel = true;
                break;
            case 'tutorial':
                if (this.onTutorial) this.onTutorial();
                break;
            case 'settings':
                if (this.onSettings) this.onSettings();
                break;
            case 'quit':
                if (this.onQuit) this.onQuit();
                break;
        }
    }

    _triggerLobbyAction(action) {
        switch (action) {
            case 'create_room':
                if (this.onCreateRoom) this.onCreateRoom();
                break;
            case 'join_room':
                if (this.onJoinRoom) this.onJoinRoom(this.roomIdInput.trim());
                break;
            case 'refresh_rooms':
                if (this.onRefreshRoomList) this.onRefreshRoomList();
                break;
            case 'back':
                if (this.multiplayerMode) {
                    this.multiplayerMode = null;
                    this._hoverModeBtn = -1;
                    this.connectionStatus = 'idle';
                    this.statusText = '';
                    this.stopRoomListRefresh();
                } else {
                    this.showMultiplayerLobby = false;
                    this.connectionStatus = 'idle';
                    this.statusText = '';
                    this.stopRoomListRefresh();
                }
                break;
        }
    }

    setConnectionStatus(status, text) {
        this.connectionStatus = status;
        this.statusText = text || '';
    }

    /**
     * 设置服务器连接状态
     * @param {string} status - 'connected', 'connecting', 'disconnected'
     */
    setServerConnectionStatus(status) {
        if (['connected', 'connecting', 'disconnected'].includes(status)) {
            this.serverConnectionStatus = status;
        }
    }

    /**
     * 渲染服务器连接状态指示器 - HUD风格
     */
    _renderConnectionStatus() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const x = 20;
        const y = 20;
        const panelW = 220;
        const panelH = 52;

        ctx.save();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(x, y, panelW, panelH);

        ctx.strokeStyle = 'rgba(14, 165, 233, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, panelW, panelH);

        ctx.strokeStyle = 'rgba(14, 165, 233, 0.15)';
        ctx.strokeRect(x + 1, y + 1, panelW - 2, panelH - 2);

        ctx.strokeStyle = 'rgba(14, 165, 233, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 2);
        ctx.lineTo(x + 2, y + 2);
        ctx.lineTo(x + 2, y + 8);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + panelW - 8, y + panelH - 2);
        ctx.lineTo(x + panelW - 2, y + panelH - 2);
        ctx.lineTo(x + panelW - 2, y + panelH - 8);
        ctx.stroke();

        const dotX = x + 16;
        const dotY = y + 16;
        const dotRadius = 4;

        let dotColor;
        let statusText;
        let pulseScale = 1;

        switch (this.serverConnectionStatus) {
            case 'connected':
                dotColor = '#22c55e';
                statusText = '已连接';
                pulseScale = 1 + Math.sin(this.animationTime / 300) * 0.1;
                break;
            case 'connecting':
                dotColor = '#eab308';
                statusText = '连接中';
                pulseScale = 1 + Math.sin(this.animationTime / 150) * 0.3;
                break;
            case 'disconnected':
            default:
                dotColor = '#ef4444';
                statusText = '离线';
                pulseScale = 1;
                break;
        }

        const glowRadius = dotRadius * pulseScale * 2;
        const glowGradient = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, glowRadius);
        glowGradient.addColorStop(0, dotColor);
        glowGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGradient;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(dotX, dotY, glowRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(dotX - 1, dotY - 1, dotRadius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fill();

        ctx.fillStyle = colors.text;
        ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(statusText, dotX + 12, dotY);

        const signalX = x + 90;
        const signalY = y + 10;
        const barWidths = [3, 4, 5];
        const barHeights = [5, 9, 13];
        const barGap = 2;

        let activeBars = 0;
        if (this.serverConnectionStatus === 'connected') {
            const ping = this.serverPing;
            if (ping < 0) activeBars = 0;
            else if (ping < 50) activeBars = 3;
            else if (ping < 150) activeBars = 2;
            else activeBars = 1;
        } else if (this.serverConnectionStatus === 'connecting') {
            activeBars = Math.floor(this.animationTime / 200) % 3 + 1;
        }

        let bx = signalX;
        for (let i = 0; i < 3; i++) {
            const by = signalY + 13 - barHeights[i];

            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(bx, by, barWidths[i], barHeights[i]);

            if (i < activeBars) {
                let barColor;
                if (this.serverConnectionStatus === 'connected') {
                    const ping = this.serverPing;
                    if (ping < 50) barColor = '#22c55e';
                    else if (ping < 150) barColor = '#eab308';
                    else barColor = '#ef4444';
                } else {
                    barColor = '#eab308';
                }
                ctx.fillStyle = barColor;
                ctx.fillRect(bx, by, barWidths[i], barHeights[i]);
            }

            bx += barWidths[i] + barGap;
        }

        const infoY = y + 34;
        ctx.font = '10px "Segoe UI", Arial, sans-serif';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = colors.textMuted;
        ctx.textAlign = 'left';
        ctx.fillText('PING', x + 10, infoY);

        const ping = this.serverPing;
        let pingColor;
        if (ping < 0) pingColor = colors.textMuted;
        else if (ping < 50) pingColor = '#22c55e';
        else if (ping < 150) pingColor = '#eab308';
        else pingColor = '#ef4444';
        ctx.fillStyle = pingColor;
        ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
        ctx.fillText(ping < 0 ? '--' : `${ping}ms`, x + 40, infoY);

        ctx.fillStyle = colors.textMuted;
        ctx.font = '10px "Segoe UI", Arial, sans-serif';
        ctx.fillText('LOSS', x + 95, infoY);

        const loss = this.serverPacketLoss;
        let lossColor;
        if (this.serverConnectionStatus !== 'connected') lossColor = colors.textMuted;
        else if (loss <= 0) lossColor = '#22c55e';
        else if (loss < 5) lossColor = '#eab308';
        else lossColor = '#ef4444';
        ctx.fillStyle = lossColor;
        ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
        ctx.fillText(this.serverConnectionStatus !== 'connected' ? '--' : `${loss.toFixed(1)}%`, x + 125, infoY);

        ctx.fillStyle = 'rgba(14, 165, 233, 0.3)';
        ctx.fillRect(x + 2, y + 26, panelW - 4, 1);

        ctx.restore();
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this._createButtons();
        this._createAccountBtn();
        if (this.showMultiplayerLobby) {
            this._createLobbyButtons();
        }
    }

    /**
     * 更新按钮动画
     */
    _updateButtonAnimations(dt) {
        const lerpFactor = 1 - Math.exp(-10 * dt / 1000); // 平滑插值因子

        for (const btn of this.buttons) {
            // 使用线性插值平滑过渡偏移量
            btn.hoverOffset.x += (btn.targetOffset.x - btn.hoverOffset.x) * lerpFactor;
            btn.hoverOffset.y += (btn.targetOffset.y - btn.hoverOffset.y) * lerpFactor;

            // 如果偏移量很小，直接设为0
            if (Math.abs(btn.hoverOffset.x) < 0.1) btn.hoverOffset.x = 0;
            if (Math.abs(btn.hoverOffset.y) < 0.1) btn.hoverOffset.y = 0;
        }
    }

    update(dt) {
        this.animationTime += dt;
        this._updateButtonAnimations(dt);
    }

    render() {
        if (!this.visible) return;
        const ctx = this.ctx;
        const colors = this.theme.colors;

        if (this.bgImage) {
            ctx.drawImage(this.bgImage, 0, 0, this.width, this.height);
        } else {
            // 深空背景
            const gradient = ctx.createRadialGradient(
                this.width / 2, this.height / 2, 0,
                this.width / 2, this.height / 2, Math.max(this.width, this.height)
            );
            gradient.addColorStop(0, '#0f172a');
            gradient.addColorStop(0.5, '#0a0e17');
            gradient.addColorStop(1, '#020617');

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, this.width, this.height);

            // 绘制星星
            this._renderStars();
        }

        if (this.showMultiplayerLobby) {
            this._renderMultiplayerLobby();
            return;
        }

        // 渲染服务器连接状态指示器
        this._renderConnectionStatus();

        // 标题动画效果
        const titlePulse = Math.sin(this.animationTime / 500) * 0.1 + 1;

        ctx.fillStyle = colors.text;
        ctx.font = this.theme.fonts.title;
        ctx.textAlign = 'center';
        ctx.globalAlpha = titlePulse;
        ctx.fillText('星环·天穹', this.width / 2, this.height * 0.25);
        ctx.globalAlpha = 1;

        ctx.font = this.theme.fonts.small;
        ctx.fillStyle = colors.textMuted;
        ctx.fillText('即时策略游戏', this.width / 2, this.height * 0.25 + 48);

        // 绘制按钮
        for (let i = 0; i < this.buttons.length; i++) {
            const btn = this.buttons[i];
            const isHover = i === this._hoverIndex;

            // 应用悬停偏移量
            const offsetX = btn.hoverOffset.x;
            const offsetY = btn.hoverOffset.y;
            const drawX = btn.x + offsetX;
            const drawY = btn.y + offsetY;

            // 保存上下文
            ctx.save();

            // 应用偏移后调用统一绘制
            this._drawButton(ctx, drawX, drawY, btn.w, btn.h, btn.text, isHover, false);

            // 恢复上下文
            ctx.restore();
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // 渲染账户按钮
        this._renderAccountBtn();

        // 渲染科技树面板
        if (this.showTechTreePanel) {
            this._renderTechTreePanel();
        }

        // 渲染账户面板
        if (this.showAccountPanel) {
            this._renderAccountPanel();
        }
    }

    _renderMultiplayerLobby() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const centerX = this.width / 2;

        if (!this.multiplayerMode) {
            this._renderModeSelect();
            return;
        }

        const modeLabel = this.multiplayerMode === 'lan' ? '局域网联机' : '服务器联机（beta）';

        ctx.fillStyle = colors.text;
        ctx.font = this.theme.fonts.title;
        ctx.textAlign = 'center';
        ctx.fillText(modeLabel, centerX, this.height * 0.15);

        if (this.multiplayerMode === 'server') {
            ctx.fillStyle = colors.textMuted;
            ctx.font = this.theme.fonts.small;
            ctx.fillText('通过公网服务器自动匹配，无需输入地址', centerX, this.height * 0.15 + 36);
        }

        const listX = centerX - 150;
        const listY = this.height * 0.25;
        const listW = 300;
        const listH = 120;
        const itemHeight = 28;

        ctx.fillStyle = colors.textMuted;
        ctx.font = this.theme.fonts.small;
        ctx.textAlign = 'center';
        ctx.fillText('可用房间列表（点击选择）', centerX, listY - 20);

        ctx.fillStyle = colors.panelBg;
        ctx.fillRect(listX, listY, listW, listH);
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(listX, listY, listW, listH);

        if (this.roomList.length === 0) {
            ctx.fillStyle = colors.textMuted;
            ctx.font = this.theme.fonts.hud;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('暂无可用房间', centerX, listY + listH / 2);
        } else {
            for (let i = 0; i < this.roomList.length && i < 4; i++) {
                const room = this.roomList[i];
                const y = listY + i * itemHeight;
                const isHover = i === this._hoverRoomIndex;

                if (isHover) {
                    ctx.fillStyle = colors.border;
                    ctx.fillRect(listX + 1, y + 1, listW - 2, itemHeight - 2);
                }

                ctx.fillStyle = isHover ? colors.primaryHover : colors.text;
                ctx.font = this.theme.fonts.hud;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(room.roomId.substring(0, 12), listX + 10, y + itemHeight / 2);

                ctx.fillStyle = colors.textMuted;
                ctx.font = this.theme.fonts.small;
                ctx.textAlign = 'right';
                ctx.fillText(`${room.age}s`, listX + listW - 10, y + itemHeight / 2);

                if (i < this.roomList.length - 1 && i < 3) {
                    ctx.strokeStyle = colors.border;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(listX + 5, y + itemHeight);
                    ctx.lineTo(listX + listW - 5, y + itemHeight);
                    ctx.stroke();
                }
            }

            if (this.roomList.length > 4) {
                ctx.fillStyle = colors.textMuted;
                ctx.font = this.theme.fonts.small;
                ctx.textAlign = 'center';
                ctx.fillText(`还有 ${this.roomList.length - 4} 个房间...`, centerX, listY + listH - 10);
            }
        }

        const inputW = 260;
        const inputH = 32;
        const inputX = centerX - inputW / 2;
        let nextY = listY + listH + 30;

        if (this.multiplayerMode === 'lan') {
            const ipY = nextY;
            const portY = ipY + 44;
            const roomIdY = portY + 44;
            this._renderInputBox('服务器地址', this.ipInput, inputX, ipY, inputW, inputH, this._focusedInput === 'ip');
            this._renderInputBox('端口', this.portInput, inputX, portY, inputW, inputH, this._focusedInput === 'port');
            this._renderInputBox('房间ID（加入时填写）', this.roomIdInput, inputX, roomIdY, inputW, inputH, this._focusedInput === 'roomId');
        } else {
            const roomIdY = nextY;
            this._renderInputBox('房间ID（加入时填写）', this.roomIdInput, inputX, roomIdY, inputW, inputH, this._focusedInput === 'roomId');
        }

        for (let i = 0; i < this.lobbyButtons.length; i++) {
            const btn = this.lobbyButtons[i];
            const isHover = i === this._hoverLobbyButton;
            this._drawButton(ctx, btn.x, btn.y, btn.w, btn.h, btn.text, isHover, false);
        }

        if (this.connectionStatus !== 'idle') {
            let statusColor = colors.textMuted;
            if (this.connectionStatus === 'waiting') statusColor = colors.warning;
            else if (this.connectionStatus === 'connected') statusColor = colors.success;
            else if (this.connectionStatus === 'failed') statusColor = colors.danger;

            ctx.fillStyle = statusColor;
            ctx.font = this.theme.fonts.hud;
            ctx.textAlign = 'center';
            ctx.fillText(this.statusText, centerX, this.height * 0.5 + 180);
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    _renderModeSelect() {
        const ctx = this.ctx;
        const colors = this.theme.colors;
        const centerX = this.width / 2;

        ctx.fillStyle = colors.text;
        ctx.font = this.theme.fonts.title;
        ctx.textAlign = 'center';
        ctx.fillText('选择联机方式', centerX, this.height * 0.15);

        ctx.fillStyle = colors.textMuted;
        ctx.font = this.theme.fonts.small;
        ctx.fillText('请选择你的联机模式', centerX, this.height * 0.15 + 36);

        const btnW = 280;
        const btnH = 64;
        const gap = 24;
        const startY = this.height * 0.5 - btnH - gap / 2;

        const modes = [
            {
                text: '局域网联机',
                desc: '同一WiFi下直接连接',
                icon: 'lan',
                x: centerX - btnW / 2,
                y: startY,
                w: btnW,
                h: btnH
            },
            {
                text: '服务器联机（beta）',
                desc: '通过公网服务器自动匹配',
                icon: 'server',
                x: centerX - btnW / 2,
                y: startY + btnH + gap,
                w: btnW,
                h: btnH
            }
        ];

        for (let i = 0; i < modes.length; i++) {
            const btn = modes[i];
            const isHover = i === this._hoverModeBtn;

            ctx.save();

            // 绘制统一按钮背景
            this._drawButton(ctx, btn.x, btn.y, btn.w, btn.h, '', isHover, false);

            // 绘制图标
            const iconX = btn.x + 36;
            const iconY = btn.y + btn.h / 2;

            if (btn.icon === 'lan') {
                ctx.strokeStyle = isHover ? '#60a5fa' : 'rgba(59, 130, 246, 0.6)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(iconX, iconY - 4, 8, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(iconX, iconY + 6, 6, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(iconX + 8, iconY - 4);
                ctx.lineTo(iconX + 16, iconY - 4);
                ctx.moveTo(iconX + 6, iconY + 6);
                ctx.lineTo(iconX + 16, iconY + 6);
                ctx.stroke();
            } else {
                ctx.strokeStyle = isHover ? '#60a5fa' : 'rgba(59, 130, 246, 0.6)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(iconX, iconY, 10, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(iconX, iconY, 3, 0, Math.PI * 2);
                ctx.fillStyle = isHover ? '#60a5fa' : 'rgba(59, 130, 246, 0.6)';
                ctx.fill();
                for (let a = 0; a < 4; a++) {
                    const angle = (a * Math.PI) / 2;
                    ctx.beginPath();
                    ctx.moveTo(iconX + Math.cos(angle) * 6, iconY + Math.sin(angle) * 6);
                    ctx.lineTo(iconX + Math.cos(angle) * 10, iconY + Math.sin(angle) * 10);
                    ctx.stroke();
                }
            }

            ctx.fillStyle = isHover ? '#ffffff' : colors.text;
            ctx.font = 'bold 16px "Segoe UI", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(btn.text, btn.x + 60, btn.y + btn.h / 2 - 10);

            ctx.fillStyle = isHover ? 'rgba(148, 163, 184, 0.9)' : colors.textMuted;
            ctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';
            ctx.fillText(btn.desc, btn.x + 60, btn.y + btn.h / 2 + 12);

            ctx.restore();
        }

        const backBtnW = 120;
        const backBtnH = 36;
        const backBtnX = centerX - backBtnW / 2;
        const backBtnY = startY + (btnH + gap) * 2 + 20;
        const isBackHover = false;

        this._drawButton(ctx, backBtnX, backBtnY, backBtnW, backBtnH, '返回', isBackHover, false);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    _renderInputBox(label, value, x, y, w, h, focused, cursorIndex = 0) {
        const ctx = this.ctx;
        const colors = this.theme.colors;

        // 标签（上方）
        ctx.fillStyle = focused ? colors.primary : colors.textMuted;
        ctx.font = '11px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, x, y - 4);

        // 输入框背景
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(x, y, w, h);

        // 输入框边框
        if (focused) {
            ctx.strokeStyle = colors.primary;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = 'rgba(59, 130, 246, 0.3)';
            ctx.shadowBlur = 8;
            ctx.strokeRect(x, y, w, h);
            ctx.shadowBlur = 0;
        } else {
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, w, h);
        }

        // 输入文字
        ctx.fillStyle = colors.text;
        ctx.font = '13px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // 密码显示为星号
        const displayValue = label.includes('密码') ? '•'.repeat(value.length) : value;
        ctx.fillText(displayValue, x + 12, y + h / 2);

        // 光标 - 根据光标位置显示
        if (focused) {
            const clampedIndex = Math.max(0, Math.min(cursorIndex, displayValue.length));
            const textBeforeCursor = displayValue.slice(0, clampedIndex);
            const cursorX = x + 12 + ctx.measureText(textBeforeCursor).width;
            ctx.strokeStyle = colors.primary;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cursorX + 2, y + 10);
            ctx.lineTo(cursorX + 2, y + h - 10);
            ctx.stroke();
        }
    }

    _renderStars() {
        const ctx = this.ctx;
        const seed = 12345;
        const starCount = 150;

        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < starCount; i++) {
            const x = ((i * 137.5 + seed) % 1000) / 1000 * this.width;
            const y = ((i * 89.7 + seed * 2) % 1000) / 1000 * this.height;
            const size = ((i * 53.3) % 100) / 100 * 2 + 0.5;
            const alpha = ((i * 31.1) % 100) / 100 * 0.5 + 0.3;

            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    show() {
        this.visible = true;
    }

    hide() {
        this.visible = false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MenuSystem;
}
