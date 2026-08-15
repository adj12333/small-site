/**
 * NetworkManager - P2P网络管理类
 * 基于WebRTC RTCPeerConnection + DataChannel实现双人联机对战
 */
class NetworkManager {
    constructor() {
        this.pc = null;
        this.dataChannel = null;
        this.signalingUrl = '';
        this.roomId = null;
        this.isHost = false;
        this.connected = false;
        this.connectionState = 'new';

        this._messageCallback = null;
        this._stateCallback = null;
        this._pollInterval = null;
        this._localCandidateQueue = [];
        this._answerPollTimer = null;

        // 心跳检测
        this._heartbeatInterval = null;
        this._heartbeatTimeout = null;
        this._lastHeartbeatTime = 0;
        this.HEARTBEAT_INTERVAL = 2000; // 2秒发送一次心跳
        this.HEARTBEAT_TIMEOUT = 8000; // 8秒未收到心跳认为断开

        // 断线重连
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 3;
        this._reconnectDelay = 3000; // 3秒后重连
        this._reconnectTimer = null;

        // 消息队列
        this._messageQueue = [];
        this._sendQueueInterval = null;
    }

    /**
     * 设置信令服务器地址
     * @param {string} ip - IP地址
     * @param {string} port - 端口
     */
    setSignalingUrl(ip, port) {
        if (ip.startsWith('http://') || ip.startsWith('https://')) {
            this.signalingUrl = ip;
        } else {
            this.signalingUrl = `http://${ip}:${port}`;
        }
        console.log('[NetworkManager] 信令服务器地址设置为:', this.signalingUrl);
    }

    /**
     * 生成随机房间ID
     */
    _generateRoomId() {
        return Math.random().toString(36).substring(2, 10);
    }

    /**
     * 创建RTCPeerConnection
     */
    _createPeerConnection() {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this._sendCandidate(event.candidate);
            }
        };

        pc.onconnectionstatechange = () => {
            this.connectionState = pc.connectionState;
            if (pc.connectionState === 'connected') {
                this.connected = true;
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                this.connected = false;
            }
            if (this._stateCallback) {
                this._stateCallback(pc.connectionState);
            }
        };

        return pc;
    }

    /**
     * 发送ICE候选到信令服务器
     */
    async _sendCandidate(candidate) {
        try {
            await fetch(`${this.signalingUrl}/candidate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: this.roomId, candidate: candidate })
            });
        } catch (err) {
            console.error('[NetworkManager] 发送ICE候选失败:', err);
        }
    }

    /**
     * 轮询获取ICE候选
     */
    async _pollCandidates() {
        try {
            const res = await fetch(`${this.signalingUrl}/candidate?roomId=${this.roomId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.candidate && this.pc) {
                    await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            }
        } catch (err) {
            // 忽略轮询错误
        }
    }

    /**
     * 创建房间（作为主机）
     */
    async createRoom() {
        this.isHost = true;
        this.roomId = this._generateRoomId();
        console.log('[NetworkManager] 开始创建房间, ID:', this.roomId);

        try {
            this.pc = this._createPeerConnection();

            // 创建DataChannel
            this.dataChannel = this.pc.createDataChannel('game', {
                ordered: true
            });
            this._setupDataChannel(this.dataChannel);

            // 创建offer
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);
            console.log('[NetworkManager] Offer已创建并设置本地描述');

            // 等待ICE收集完成
            await this._waitForIceGathering();
            console.log('[NetworkManager] ICE收集完成, 本地描述:', this.pc.localDescription);

            // 发布offer到信令服务器
            const offerRes = await fetch(`${this.signalingUrl}/offer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: this.roomId, offer: this.pc.localDescription })
            });

            if (!offerRes.ok) {
                const errText = await offerRes.text();
                throw new Error(`信令服务器返回错误: ${offerRes.status} - ${errText}`);
            }

            const offerData = await offerRes.json();
            if (!offerData.success) {
                throw new Error('信令服务器未成功存储offer');
            }
            console.log('[NetworkManager] Offer已发布到信令服务器');

            // 轮询获取answer
            this._startPollingAnswer();

            // 启动ICE候选轮询
            this._pollInterval = setInterval(() => this._pollCandidates(), 1000);

            return this.roomId;
        } catch (err) {
            console.error('[NetworkManager] createRoom内部错误:', err);
            throw err;
        }
    }

    /**
     * 加入房间（作为客户端）
     * @param {string} roomId - 房间ID
     */
    async joinRoom(roomId) {
        this.isHost = false;
        this.roomId = roomId;
        console.log('[NetworkManager] 开始加入房间, ID:', roomId);

        try {
            this.pc = this._createPeerConnection();

            // 监听DataChannel
            this.pc.ondatachannel = (event) => {
                this.dataChannel = event.channel;
                this._setupDataChannel(this.dataChannel);
            };

            // 获取offer
            const res = await fetch(`${this.signalingUrl}/offer?roomId=${roomId}`);
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`房间不存在或已过期: ${res.status} - ${errText}`);
            }
            const data = await res.json();
            if (!data.offer) {
                throw new Error('未找到房间offer');
            }
            console.log('[NetworkManager] 已获取主机offer');

            await this.pc.setRemoteDescription(new RTCSessionDescription(data.offer));

            // 创建answer
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            console.log('[NetworkManager] Answer已创建并设置本地描述');

            // 等待ICE收集完成
            await this._waitForIceGathering();

            // 发布answer
            const answerRes = await fetch(`${this.signalingUrl}/answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: this.roomId, answer: this.pc.localDescription })
            });

            if (!answerRes.ok) {
                const errText = await answerRes.text();
                throw new Error(`发布answer失败: ${answerRes.status} - ${errText}`);
            }
            console.log('[NetworkManager] Answer已发布到信令服务器');

            // 启动ICE候选轮询
            this._pollInterval = setInterval(() => this._pollCandidates(), 1000);
        } catch (err) {
            console.error('[NetworkManager] joinRoom内部错误:', err);
            throw err;
        }
    }

    /**
     * 等待ICE收集完成
     */
    _waitForIceGathering() {
        return new Promise((resolve) => {
            if (this.pc.iceGatheringState === 'complete') {
                resolve();
                return;
            }
            const check = () => {
                if (this.pc.iceGatheringState === 'complete') {
                    this.pc.removeEventListener('icegatheringstatechange', check);
                    resolve();
                }
            };
            this.pc.addEventListener('icegatheringstatechange', check);
            // 超时保护
            setTimeout(() => {
                this.pc.removeEventListener('icegatheringstatechange', check);
                resolve();
            }, 3000);
        });
    }

    /**
     * 轮询获取answer
     */
    _startPollingAnswer() {
        const poll = async () => {
            if (!this.isHost || this.connected) return;
            try {
                const res = await fetch(`${this.signalingUrl}/answer?roomId=${this.roomId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.answer && this.pc && this.pc.signalingState !== 'stable') {
                        await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                        console.log('[NetworkManager] 已设置远程描述(answer)');
                    }
                }
            } catch (err) {
                // 忽略轮询错误
            }
            if (!this.connected && this.isHost) {
                this._answerPollTimer = setTimeout(poll, 1000);
            }
        };
        poll();
    }

    /**
     * 设置DataChannel事件
     */
    _setupDataChannel(channel) {
        channel.onopen = () => {
            this.connected = true;
            this.connectionState = 'connected';
            this._reconnectAttempts = 0; // 重置重连计数
            this._startHeartbeat(); // 启动心跳
            this._startSendQueue(); // 启动发送队列
            if (this._stateCallback) {
                this._stateCallback('connected');
            }
        };

        channel.onclose = () => {
            this.connected = false;
            this.connectionState = 'closed';
            this._stopHeartbeat();
            this._stopSendQueue();
            if (this._stateCallback) {
                this._stateCallback('closed');
            }
            // 尝试重连
            this._attemptReconnect();
        };

        channel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // 处理心跳
                if (data.type === 'heartbeat') {
                    this._lastHeartbeatTime = Date.now();
                    // 回复心跳
                    if (data.reply !== true) {
                        this._sendHeartbeatReply();
                    }
                    return;
                }
                if (this._messageCallback) {
                    this._messageCallback(data);
                }
            } catch (err) {
                console.error('[NetworkManager] 消息解析失败:', err);
            }
        };

        channel.onerror = (err) => {
            console.error('[NetworkManager] DataChannel错误:', err);
        };
    }

    /**
     * 启动心跳检测
     */
    _startHeartbeat() {
        this._lastHeartbeatTime = Date.now();
        // 定期发送心跳
        this._heartbeatInterval = setInterval(() => {
            this._sendHeartbeat();
        }, this.HEARTBEAT_INTERVAL);
        // 检测心跳超时
        this._heartbeatTimeout = setInterval(() => {
            const now = Date.now();
            if (now - this._lastHeartbeatTime > this.HEARTBEAT_TIMEOUT) {
                console.warn('[NetworkManager] 心跳超时，连接可能已断开');
                this._handleDisconnect();
            }
        }, this.HEARTBEAT_INTERVAL);
    }

    /**
     * 停止心跳检测
     */
    _stopHeartbeat() {
        if (this._heartbeatInterval) {
            clearInterval(this._heartbeatInterval);
            this._heartbeatInterval = null;
        }
        if (this._heartbeatTimeout) {
            clearInterval(this._heartbeatTimeout);
            this._heartbeatTimeout = null;
        }
    }

    /**
     * 发送心跳
     */
    _sendHeartbeat() {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
        }
    }

    /**
     * 发送心跳回复
     */
    _sendHeartbeatReply() {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify({ type: 'heartbeat', reply: true, timestamp: Date.now() }));
        }
    }

    /**
     * 处理断开连接
     */
    _handleDisconnect() {
        if (this.connected) {
            this.connected = false;
            this.connectionState = 'disconnected';
            if (this._stateCallback) {
                this._stateCallback('disconnected');
            }
        }
        this._attemptReconnect();
    }

    /**
     * 尝试重连
     */
    _attemptReconnect() {
        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            console.error('[NetworkManager] 重连次数已达上限');
            if (this._stateCallback) {
                this._stateCallback('failed');
            }
            return;
        }
        this._reconnectAttempts++;
        console.log(`[NetworkManager] ${this._reconnectDelay}ms后尝试第${this._reconnectAttempts}次重连...`);
        this._reconnectTimer = setTimeout(() => {
            if (this.isHost) {
                this.createRoom().catch(err => console.error('[NetworkManager] 重连失败:', err));
            } else {
                this.joinRoom(this.roomId).catch(err => console.error('[NetworkManager] 重连失败:', err));
            }
        }, this._reconnectDelay);
    }

    /**
     * 启动发送队列
     */
    _startSendQueue() {
        this._sendQueueInterval = setInterval(() => {
            this._processSendQueue();
        }, 16); // 约60fps
    }

    /**
     * 停止发送队列
     */
    _stopSendQueue() {
        if (this._sendQueueInterval) {
            clearInterval(this._sendQueueInterval);
            this._sendQueueInterval = null;
        }
    }

    /**
     * 处理发送队列
     */
    _processSendQueue() {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;
        // 批量发送消息，最多一次发送10条
        const batchSize = Math.min(10, this._messageQueue.length);
        for (let i = 0; i < batchSize; i++) {
            const data = this._messageQueue.shift();
            try {
                this.dataChannel.send(JSON.stringify(data));
            } catch (err) {
                console.error('[NetworkManager] 发送消息失败:', err);
                // 发送失败的消息重新放入队列
                this._messageQueue.unshift(data);
                break;
            }
        }
    }

    /**
     * 发送数据
     * @param {Object} data - 要发送的JSON对象
     * @param {boolean} immediate - 是否立即发送（不加入队列）
     */
    send(data, immediate = false) {
        if (immediate && this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(data));
        } else {
            // 加入发送队列
            this._messageQueue.push(data);
            // 限制队列大小，防止内存溢出
            if (this._messageQueue.length > 1000) {
                this._messageQueue = this._messageQueue.slice(-500);
                console.warn('[NetworkManager] 消息队列已满，丢弃旧消息');
            }
        }
    }

    /**
     * 注册消息接收回调
     * @param {Function} callback - 回调函数(data)
     */
    onMessage(callback) {
        this._messageCallback = callback;
    }

    /**
     * 注册连接状态变化回调
     * @param {Function} callback - 回调函数(state)
     */
    onConnectionStateChange(callback) {
        this._stateCallback = callback;
    }

    /**
     * 关闭连接
     */
    close() {
        // 停止重连
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
        // 停止心跳
        this._stopHeartbeat();
        // 停止发送队列
        this._stopSendQueue();
        // 清空消息队列
        this._messageQueue = [];
        if (this._pollInterval) {
            clearInterval(this._pollInterval);
            this._pollInterval = null;
        }
        if (this._answerPollTimer) {
            clearTimeout(this._answerPollTimer);
            this._answerPollTimer = null;
        }
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }
        this.connected = false;
        this.connectionState = 'closed';
        this._reconnectAttempts = 0;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetworkManager;
}
