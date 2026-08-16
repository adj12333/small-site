/**
 * InputSystem - 鼠标/键盘事件监听与分发系统
 * 实现高响应输入处理，无队列延迟
 */
class InputSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.mouse = {
            x: 0,
            y: 0,
            isDown: false,
            isDragging: false,
            dragStartX: 0,
            dragStartY: 0,
            button: -1
        };
        this.keys = new Map();
        this.callbacks = {
            mouseMove: [],
            mouseDown: [],
            mouseUp: [],
            mouseClick: [],
            dragStart: [],
            dragEnd: [],
            keyDown: [],
            keyUp: [],
            keyPress: [],
            touchPinch: []
        };

        this.touch = {
            startX: 0,
            startY: 0,
            lastX: 0,
            lastY: 0,
            active: false,
            pinchDist: 0,
            isPinching: false,
            lastTapTime: 0,
            longPressTimer: null,
            moved: false
        };

        this._boundHandlers = {};
        this._init();
    }

    _init() {
        this._boundHandlers.mouseMove = this._onMouseMove.bind(this);
        this._boundHandlers.mouseDown = this._onMouseDown.bind(this);
        this._boundHandlers.mouseUp = this._onMouseUp.bind(this);
        this._boundHandlers.keyDown = this._onKeyDown.bind(this);
        this._boundHandlers.keyUp = this._onKeyUp.bind(this);
        this._boundHandlers.keyPress = this._onKeyPress.bind(this);
        this._boundHandlers.mouseLeave = this._onMouseLeave.bind(this);
        this._boundHandlers.contextMenu = (e) => e.preventDefault();
        this._boundHandlers.resize = this._onResize.bind(this);
        this._boundHandlers.touchStart = this._onTouchStart.bind(this);
        this._boundHandlers.touchMove = this._onTouchMove.bind(this);
        this._boundHandlers.touchEnd = this._onTouchEnd.bind(this);

        // 框选模式：由外部设置，决定触控拖拽行为
        // false = 拖拽移动相机（默认），true = 拖拽框选单位
        this.boxSelectMode = false;

        this.canvas.addEventListener('mousemove', this._boundHandlers.mouseMove);
        this.canvas.addEventListener('mousedown', this._boundHandlers.mouseDown);
        document.addEventListener('mouseup', this._boundHandlers.mouseUp);
        this.canvas.addEventListener('mouseleave', this._boundHandlers.mouseLeave);
        document.addEventListener('keydown', this._boundHandlers.keyDown);
        document.addEventListener('keyup', this._boundHandlers.keyUp);
        document.addEventListener('keypress', this._boundHandlers.keyPress);
        this.canvas.addEventListener('contextmenu', this._boundHandlers.contextMenu);
        window.addEventListener('resize', this._boundHandlers.resize);

        this.canvas.addEventListener('touchstart', this._boundHandlers.touchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this._boundHandlers.touchMove, { passive: false });
        this.canvas.addEventListener('touchend', this._boundHandlers.touchEnd, { passive: false });

        // 缓存 canvas bounding rect，避免每次 mousemove 触发 reflow
        this._cachedRect = this.canvas.getBoundingClientRect();
    }

    _onResize() {
        this._cachedRect = this.canvas.getBoundingClientRect();
    }

    /**
     * 设置框选模式
     * @param {boolean} enabled - true 时触控拖拽框选单位，false 时拖拽移动相机
     */
    setBoxSelectMode(enabled) {
        this.boxSelectMode = enabled;
    }

    _getMousePos(e) {
        const rect = this._cachedRect;
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    _onMouseMove(e) {
        const pos = this._getMousePos(e);
        this.mouse.x = pos.x;
        this.mouse.y = pos.y;

        if (this.mouse.isDown && !this.mouse.isDragging) {
            const dx = this.mouse.x - this.mouse.dragStartX;
            const dy = this.mouse.y - this.mouse.dragStartY;
            if (Math.sqrt(dx * dx + dy * dy) > 5) {
                this.mouse.isDragging = true;
                this._emit('dragStart', {
                    x: this.mouse.dragStartX,
                    y: this.mouse.dragStartY,
                    button: this.mouse.button
                });
            }
        }

        this._emit('mouseMove', { x: this.mouse.x, y: this.mouse.y, button: this.mouse.button });
    }

    _onMouseDown(e) {
        const pos = this._getMousePos(e);
        this.mouse.x = pos.x;
        this.mouse.y = pos.y;
        this.mouse.isDown = true;
        this.mouse.button = e.button;
        this.mouse.dragStartX = pos.x;
        this.mouse.dragStartY = pos.y;

        this._emit('mouseDown', { x: pos.x, y: pos.y, button: e.button, ctrl: e.ctrlKey });
    }

    _onMouseUp(e) {
        const pos = this._getMousePos(e);
        this.mouse.isDown = false;

        const wasDragging = this.mouse.isDragging;
        if (this.mouse.isDragging) {
            this.mouse.isDragging = false;
            this._emit('dragEnd', {
                startX: this.mouse.dragStartX,
                startY: this.mouse.dragStartY,
                endX: pos.x,
                endY: pos.y,
                button: this.mouse.button
            });
        }

        this._emit('mouseClick', { x: pos.x, y: pos.y, button: e.button, ctrl: e.ctrlKey, wasDragging: wasDragging });

        this._emit('mouseUp', { x: pos.x, y: pos.y, button: e.button });
        this.mouse.button = -1;
    }

    _onMouseLeave(e) {
        if (this.mouse.isDown && this.mouse.isDragging) {
            const pos = this._getMousePos(e);
            this.mouse.isDown = false;
            this.mouse.isDragging = false;
            this._emit('dragEnd', {
                startX: this.mouse.dragStartX,
                startY: this.mouse.dragStartY,
                endX: pos.x,
                endY: pos.y,
                button: this.mouse.button
            });
        }
        this.mouse.isDown = false;
        this.mouse.isDragging = false;
        this._emit('mouseUp', { x: this.mouse.x, y: this.mouse.y, button: this.mouse.button });
        this.mouse.button = -1;
    }

    /**
     * 获取当前鼠标位置
     * @returns {{x: number, y: number}}
     */
    getMousePos() {
        return { x: this.mouse.x, y: this.mouse.y };
    }

    _onKeyDown(e) {
        this.keys.set(e.key.toLowerCase(), true);
        this._emit('keyDown', { key: e.key, keyLower: e.key.toLowerCase(), code: e.code, ctrl: e.ctrlKey });
    }

    _onKeyUp(e) {
        this.keys.set(e.key.toLowerCase(), false);
        this._emit('keyUp', { key: e.key, keyLower: e.key.toLowerCase(), code: e.code });
    }

    _onKeyPress(e) {
        if (e.key && e.key.length === 1) {
            this._emit('keyPress', { char: e.key });
        }
    }

    _onTouchStart(e) {
        e.preventDefault();
        const touches = e.touches;

        if (touches.length === 1) {
            // Single touch - simulate mouse drag for camera movement
            const touch = touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.touch.startX = touch.clientX - rect.left;
            this.touch.startY = touch.clientY - rect.top;
            this.touch.lastX = this.touch.startX;
            this.touch.lastY = this.touch.startY;
            this.touch.active = true;
            this.touch.moved = false;
            this.touch._dragStartFired = false;  // 重置框选拖拽标记

            // Long press detection
            this.touch.longPressTimer = setTimeout(() => {
                if (this.touch.active && !this.touch.moved) {
                    // Long press - fire right click (context menu equivalent)
                    this._emit('mouseDown', { x: this.touch.lastX, y: this.touch.lastY, button: 2 });
                    this._emit('mouseUp', { x: this.touch.lastX, y: this.touch.lastY, button: 2 });
                }
            }, 600);

            // Update mouse position for other systems
            this.mouse.x = this.touch.startX;
            this.mouse.y = this.touch.startY;

            // Fire mouse events for compatibility
            this._emit('mouseDown', { x: this.touch.startX, y: this.touch.startY, button: 0 });
        } else if (touches.length === 2) {
            // Two fingers - pinch to zoom
            clearTimeout(this.touch.longPressTimer);
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            this.touch.pinchDist = Math.sqrt(dx * dx + dy * dy);
            this.touch.isPinching = true;
            this.touch.active = true;
        }
    }

    _onTouchMove(e) {
        e.preventDefault();
        const touches = e.touches;

        if (touches.length === 1 && !this.touch.isPinching) {
            const touch = touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            // Check if we've moved enough to consider it a drag
            const dx = x - this.touch.startX;
            const dy = y - this.touch.startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                this.touch.moved = true;
                clearTimeout(this.touch.longPressTimer);

                if (this.boxSelectMode) {
                    // 框选模式：用左键拖拽框选单位（不移动相机）
                    // 只发 dragStart 一次（首次移动 > 阈值时）
                    if (!this.touch._dragStartFired) {
                        this.touch._dragStartFired = true;
                        this._emit('dragStart', {
                            x: this.touch.startX, y: this.touch.startY,
                            button: 0
                        });
                    }
                    this._emit('mouseMove', { x, y, button: 0 });
                } else {
                    // 默认模式：模拟右键拖拽移动相机
                    this._emit('mouseMove', { x, y, button: 2 });
                    this._emit('mouseDown', { x: this.touch.lastX, y: this.touch.lastY, button: 2 });
                }
            }

            this.touch.lastX = x;
            this.touch.lastY = y;
            this.mouse.x = x;
            this.mouse.y = y;
            this._emit('mouseMove', { x, y });
        } else if (touches.length === 2 && this.touch.isPinching) {
            // Pinch zoom
            clearTimeout(this.touch.longPressTimer);
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (this.touch.pinchDist > 0) {
                const scale = dist / this.touch.pinchDist;
                this._emit('touchPinch', { scale, centerX: (touches[0].clientX + touches[1].clientX) / 2, centerY: (touches[0].clientY + touches[1].clientY) / 2 });
            }
            this.touch.pinchDist = dist;
        }
    }

    _onTouchEnd(e) {
        clearTimeout(this.touch.longPressTimer);

        if (e.changedTouches.length === 1 && !this.touch.isPinching) {
            const touch = e.changedTouches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            this._emit('mouseUp', { x, y, button: 2 }); // End the drag
            this._emit('mouseUp', { x, y, button: 0 });

            // 计算拖拽总距离（判断是否算作"点击"）
            const totalDrag = Math.sqrt(
                Math.pow(x - this.touch.startX, 2) + Math.pow(y - this.touch.startY, 2)
            );

            if (!this.touch.moved || totalDrag < 15) {
                // 未移动或移动很小（< 15px）→ 视为点击
                const now = Date.now();
                if (now - this.touch.lastTapTime < 300) {
                    // Double tap - simulate double click
                    this._emit('mouseClick', { x, y, button: 0, wasDragging: false });
                }
                this.touch.lastTapTime = now;

                // Single click (always fire, double tap fires two clicks)
                this._emit('mouseClick', { x, y, button: 0, wasDragging: false });
            } else {
                // Was a drag - fire dragEnd
                if (this.boxSelectMode) {
                    // 框选模式：用左键 button 发送 dragEnd
                    this._emit('dragEnd', {
                        button: 0,
                        startX: this.touch.startX,
                        startY: this.touch.startY,
                        endX: x,
                        endY: y
                    });
                } else {
                    // 默认模式：右键相机拖拽
                    this._emit('dragEnd', {
                        button: 2,
                        startX: this.touch.startX,
                        startY: this.touch.startY,
                        endX: x,
                        endY: y
                    });
                }
            }
        } else if (this.touch.isPinching) {
            // Pinch ended
            this._emit('mouseUp', { x: 0, y: 0, button: 0 });
        }

        this.touch.active = false;
        this.touch.isPinching = false;
        this.touch.pinchDist = 0;
    }

    _emit(event, data) {
        const listeners = this.callbacks[event];
        if (listeners) {
            for (const cb of listeners) {
                cb(data);
            }
        }
    }

    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
        return this;
    }

    off(event, callback) {
        if (this.callbacks[event]) {
            const idx = this.callbacks[event].indexOf(callback);
            if (idx !== -1) {
                this.callbacks[event].splice(idx, 1);
            }
        }
        return this;
    }

    isKeyDown(key) {
        return !!this.keys.get(key.toLowerCase());
    }

    destroy() {
        this.canvas.removeEventListener('mousemove', this._boundHandlers.mouseMove);
        this.canvas.removeEventListener('mousedown', this._boundHandlers.mouseDown);
        document.removeEventListener('mouseup', this._boundHandlers.mouseUp);
        this.canvas.removeEventListener('mouseleave', this._boundHandlers.mouseLeave);
        document.removeEventListener('keydown', this._boundHandlers.keyDown);
        document.removeEventListener('keyup', this._boundHandlers.keyUp);
        document.removeEventListener('keypress', this._boundHandlers.keyPress);
        this.canvas.removeEventListener('contextmenu', this._boundHandlers.contextMenu);
        this.canvas.removeEventListener('touchstart', this._boundHandlers.touchStart);
        this.canvas.removeEventListener('touchmove', this._boundHandlers.touchMove);
        this.canvas.removeEventListener('touchend', this._boundHandlers.touchEnd);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = InputSystem;
}
