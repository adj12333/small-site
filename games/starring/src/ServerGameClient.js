class ServerGameClient {
    constructor() {
        this.ws = null;
        this.serverUrl = '';
        this.roomId = null;
        this.team = null;
        this.connected = false;
        this.inRoom = false;

        this._messageCallback = null;
        this._stateCallback = null;
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 3;
        this._reconnectTimer = null;
        this._heartbeatInterval = null;
    }

    setServerUrl(url) {
        if (url.startsWith('ws://') || url.startsWith('wss://')) {
            this.serverUrl = url;
        } else if (url.startsWith('http://')) {
            this.serverUrl = url.replace('http://', 'ws://');
        } else if (url.startsWith('https://')) {
            this.serverUrl = url.replace('https://', 'wss://');
        } else {
            this.serverUrl = 'ws://' + url;
        }
    }

    async createRoom() {
        return new Promise((resolve, reject) => {
            this._connect((msg) => {
                if (msg.type === 'room_created') {
                    this.roomId = msg.roomId;
                    this.team = msg.team;
                    this.inRoom = true;
                    resolve(msg.roomId);
                } else if (msg.type === 'error') {
                    reject(new Error(msg.message));
                }
            });

            this._sendOnce({ type: 'create_room' });
        });
    }

    async joinRoom(roomId) {
        return new Promise((resolve, reject) => {
            this._connect((msg) => {
                if (msg.type === 'room_joined') {
                    this.roomId = msg.roomId;
                    this.team = msg.team;
                    this.inRoom = true;
                    resolve(msg);
                } else if (msg.type === 'error') {
                    reject(new Error(msg.message));
                }
            });

            this._connectPromise.then(() => {
                this.ws.send(JSON.stringify({ type: 'join_room', roomId }));
            });
        });
    }

    _connect(onFirstMessage) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            if (onFirstMessage) onFirstMessage({ type: 'already_connected' });
            return;
        }

        this._connectPromise = new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.serverUrl);
            } catch (err) {
                reject(err);
                return;
            }

            this.ws.onopen = () => {
                this.connected = true;
                this._reconnectAttempts = 0;
                this._startHeartbeat();
                resolve();
            };

            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'heartbeat') return;

                    if (onFirstMessage) {
                        onFirstMessage(msg);
                        onFirstMessage = null;
                    }

                    if (this._messageCallback) {
                        this._messageCallback(msg);
                    }
                } catch (err) {
                    console.error('[ServerGameClient] Message parse error:', err);
                }
            };

            this.ws.onclose = () => {
                this.connected = false;
                this._stopHeartbeat();
                if (this._stateCallback) {
                    this._stateCallback('disconnected');
                }
                this._attemptReconnect();
            };

            this.ws.onerror = (err) => {
                console.error('[ServerGameClient] WebSocket error');
                reject(err);
            };
        });
    }

    _sendOnce(data) {
        if (this._connectPromise) {
            this._connectPromise.then(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify(data));
                }
            });
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    sendInput(inputType, inputData) {
        this.send({ type: 'input', data: { type: inputType, ...inputData } });
    }

    onMessage(callback) {
        this._messageCallback = callback;
    }

    onConnectionStateChange(callback) {
        this._stateCallback = callback;
    }

    _startHeartbeat() {
        this._heartbeatInterval = setInterval(() => {
            this.send({ type: 'heartbeat', timestamp: Date.now() });
        }, 5000);
    }

    _stopHeartbeat() {
        if (this._heartbeatInterval) {
            clearInterval(this._heartbeatInterval);
            this._heartbeatInterval = null;
        }
    }

    _attemptReconnect() {
        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            if (this._stateCallback) {
                this._stateCallback('failed');
            }
            return;
        }
        this._reconnectAttempts++;
        this._reconnectTimer = setTimeout(() => {
            if (this.roomId) {
                this._connect();
                this._connectPromise.then(() => {
                    this.ws.send(JSON.stringify({ type: 'join_room', roomId: this.roomId }));
                });
            }
        }, 3000);
    }

    requestFullState() {
        this.send({ type: 'request_full_state' });
    }

    close() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
        this._stopHeartbeat();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.inRoom = false;
        this._reconnectAttempts = 0;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ServerGameClient;
}
