/**
 * GameCore - 游戏核心逻辑与数据模型
 * 管理单位、资源、命令分发、基地、敌方单位等核心状态
 */
class GameCore {
    constructor() {
        this.units = [];
        this.enemyUnits = [];
        this.selectedUnits = [];
        this.selectedEnemy = null;
        this.base = null;
        this.enemyBase = null;
        this.controlZones = [];
        this.asteroidBelts = [];
        this.outposts = [];
        this.resourceBeacons = [];
        this.gameOver = false;
        this.winner = null;
        this.gameTime = 0;

        this.resources = {
            energy: 1000,
            crystal: 500,
            supply: 200,
            population: 0,
            popCap: 50,
            proximaCoin: 0  // 比邻星币
        };

        this.enemyResources = {
            energy: 1000,
            crystal: 500,
            supply: 200,
            population: 0,
            popCap: 50,
            proximaCoin: 0  // 比邻星币
        };

        this.onUpdate = null;
        this.onGameOver = null;

        // 摄像机/视角偏移
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1.0,
            minZoom: 0.5,
            maxZoom: 2.0
        };

        // 基地修复计时器
        this.baseRepairTimer = 0;
        this.enemyBaseRepairTimer = 0;

        // 粒子效果
        this.particles = [];

        // 战斗统计
        this.stats = {
            playerKills: 0,
            enemyKills: 0,
            playerUnitsLost: 0,
            enemyUnitsLost: 0
        };

        // 战报系统
        this.battleReports = [];
        this.onBattleReport = null;
        this._battleReportIdCounter = 0;

        // 联机模式属性
        this.isMultiplayer = false;
        this.isHost = false;
        this.playerTeam = 'player1';

        this.artilleryStrikes = [];
        this.artilleryWarnings = [];

        // 巡逻任务组（支持多任务并存）
        this.patrolTaskGroups = [];
        this._patrolTaskIdCounter = 0;

        // 巡逻任务状态常量
        this.PATROL_STATUS = {
            WAITING: 'waiting',
            PATROLLING: 'patrolling',
            COMPLETED: 'completed'
        };

        this._cachedVisibleAreas = null;
    }

    init(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth || 1200;
        this.canvasHeight = canvasHeight || 800;
        this.worldWidth = 6000;
        this.worldHeight = 4500;
        this._spawnBase();
        this._spawnEnemyBase();
        this._spawnControlZones();
        this._spawnAsteroidBelts();
        this._spawnTestUnits();
        // 联机模式下不生成AI敌方单位
        if (!this.isMultiplayer) {
            this._spawnEnemyUnits();
        }
        // 初始化摄像机位置到玩家基地附近
        this.camera.x = Math.max(0, this.base.x - this.canvasWidth / 2);
        this.camera.y = Math.max(0, this.base.y - this.canvasHeight / 2);
        this._clampCamera();
    }

    /**
     * 添加战报
     * @param {Object} report - 战报对象 { type, text, color }
     */
    _addBattleReport(report) {
        const id = ++this._battleReportIdCounter;
        const entry = {
            id,
            time: Date.now(),
            type: report.type || 'info',
            text: report.text || '',
            color: report.color || '#3b82f6'
        };
        this.battleReports.push(entry);
        // 最多保留20条
        if (this.battleReports.length > 20) {
            this.battleReports.shift();
        }
        if (this.onBattleReport) {
            this.onBattleReport(entry);
        }
    }

    /**
     * 移动摄像机视角
     * @param {number} dx - X方向偏移量
     * @param {number} dy - Y方向偏移量
     */
    moveCamera(dx, dy) {
        this.camera.x += dx / this.camera.zoom;
        this.camera.y += dy / this.camera.zoom;
        this._clampCamera();
    }

    _clampCamera() {
        const visibleWidth = this.canvasWidth / this.camera.zoom;
        const visibleHeight = this.canvasHeight / this.camera.zoom;
        this.camera.x = Math.max(0, Math.min(this.camera.x, this.worldWidth - visibleWidth));
        this.camera.y = Math.max(0, Math.min(this.camera.y, this.worldHeight - visibleHeight));
    }

    setZoom(newZoom, centerX, centerY) {
        const oldZoom = this.camera.zoom;
        newZoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, newZoom));
        const worldCenterX = centerX / oldZoom + this.camera.x;
        const worldCenterY = centerY / oldZoom + this.camera.y;
        this.camera.zoom = newZoom;
        this.camera.x = worldCenterX - centerX / newZoom;
        this.camera.y = worldCenterY - centerY / newZoom;
        this._clampCamera();
    }

    zoomBy(delta, mouseX, mouseY) {
        const zoomFactor = delta > 0 ? 1.1 : 0.9;
        const newZoom = this.camera.zoom * zoomFactor;
        this.setZoom(newZoom, mouseX, mouseY);
    }

    /**
     * 添加比邻星币
     * @param {number} amount - 增加的数量
     */
    addProximaCoin(amount) {
        if (amount > 0) {
            this.resources.proximaCoin = (this.resources.proximaCoin || 0) + amount;
            if (this.onUpdate) {
                this.onUpdate();
            }
            if (this.onProximaCoinChange) {
                this.onProximaCoinChange(this.resources.proximaCoin);
            }
        }
    }

    /**
     * 将世界坐标转换为屏幕坐标（考虑缩放）
     * @param {number} worldX
     * @param {number} worldY
     * @returns {{x: number, y: number}}
     */
    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.camera.x) * this.camera.zoom,
            y: (worldY - this.camera.y) * this.camera.zoom
        };
    }

    /**
     * 将屏幕坐标转换为世界坐标（考虑缩放）
     * @param {number} screenX
     * @param {number} screenY
     * @returns {{x: number, y: number}}
     */
    screenToWorld(screenX, screenY) {
        return {
            x: screenX / this.camera.zoom + this.camera.x,
            y: screenY / this.camera.zoom + this.camera.y
        };
    }

    _spawnBase() {
        const isPlayer2 = this.isMultiplayer && this.playerTeam === 'player2';
        this.base = {
            id: 'base',
            name: '主基地',
            x: isPlayer2 ? this.worldWidth * 0.9 : this.worldWidth * 0.1,
            y: this.worldHeight / 2,
            hp: 500,
            maxHp: 500,
            size: 50,
            team: 'player',
            repairRate: 5,
            lastRepair: 0,
            visionRadius: 150
        };
    }

    _spawnEnemyBase() {
        const isPlayer2 = this.isMultiplayer && this.playerTeam === 'player2';
        this.enemyBase = {
            id: 'enemyBase',
            name: '敌方基地',
            x: isPlayer2 ? this.worldWidth * 0.1 : this.worldWidth * 0.9,
            y: this.worldHeight / 2,
            hp: 500,
            maxHp: 500,
            size: 50,
            team: 'enemy',
            repairRate: 5,
            lastRepair: 0
        };
    }

    _spawnControlZones() {
        const zonePositions = [
            { x: this.worldWidth * 0.3, y: this.worldHeight * 0.25 },
            { x: this.worldWidth * 0.5, y: this.worldHeight * 0.5 },
            { x: this.worldWidth * 0.7, y: this.worldHeight * 0.75 }
        ];

        for (let i = 0; i < zonePositions.length; i++) {
            const pos = zonePositions[i];
            this.controlZones.push({
                id: `zone_${i}`,
                name: `战略节点 ${i + 1}`,
                x: pos.x,
                y: pos.y,
                radius: 80,
                owner: null,
                captureProgress: 0,
                maxCaptureProgress: 100,
                capturingTeam: null,
                energyBonus: 0.5,  // 削减90%，从5降到0.5
                crystalBonus: 0.2  // 削减90%，从2降到0.2
            });
        }
    }

    _spawnAsteroidBelts() {
        const beltPositions = [
            { x: this.worldWidth * 0.25, y: this.worldHeight * 0.3 },
            { x: this.worldWidth * 0.5, y: this.worldHeight * 0.7 },
            { x: this.worldWidth * 0.75, y: this.worldHeight * 0.4 }
        ];

        for (let i = 0; i < beltPositions.length; i++) {
            const pos = beltPositions[i];
            this.asteroidBelts.push({
                id: `belt_${i}`,
                x: pos.x,
                y: pos.y,
                radius: 80,
                resources: 1000,
                maxResources: 1000,
                name: `资源带 ${i + 1}`
            });
        }
    }

    getAsteroidBelts() {
        return this.asteroidBelts;
    }

    collectBelt(engineerUnit, belt) {
        engineerUnit.state = 'collecting';
        engineerUnit.targetBelt = belt;
        engineerUnit.targetX = belt.x;
        engineerUnit.targetY = belt.y;
    }

    _createResourceBeacon(belt) {
        const hasBeacon = this.resourceBeacons.some(b => b.sourceBeltId === belt.id);
        if (hasBeacon) {
            return this.resourceBeacons.find(b => b.sourceBeltId === belt.id);
        }
        const beacon = {
            id: 'beacon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            x: belt.x,
            y: belt.y,
            visionRadius: 100,
            sourceBeltId: belt.id
        };
        this.resourceBeacons.push(beacon);
        return beacon;
    }

    getResourceBeacons() {
        return this.resourceBeacons;
    }

    _spawnTestUnits() {
        // 轻型战机
        for (let i = 0; i < 4; i++) {
            this.units.push(this._createUnit(i, 350 + i * 80, this.worldHeight / 2 - 100 + (i % 2) * 60, 'player', 'fighter'));
        }
        // 重型战舰
        for (let i = 0; i < 2; i++) {
            this.units.push(this._createUnit(100 + i, 300 + i * 100, this.worldHeight / 2 + 100, 'player', 'battleship'));
        }
        this.units.push(this._createUnit(300, this.base.x + 60, this.base.y + 60, 'player', 'engineer'));
        this.resources.population = this.units.length;
    }

    /**
     * 建造单位
     * @param {string} type - 单位类型: 'fighter' 或 'battleship'
     * @returns {boolean} 是否建造成功
     */
    buildUnit(type) {
        const costs = {
            fighter: { energy: 100, crystal: 50 },
            battleship: { energy: 200, crystal: 100 },
            engineer: { energy: 80, crystal: 40 }
        };

        const cost = costs[type];
        if (!cost) return false;

        if (type === 'engineer' && this.units.filter(u => u.type === 'engineer' && u.hp > 0).length >= 5) {
            return false;
        }

        // 检查资源是否充足
        if (this.resources.energy < cost.energy || this.resources.crystal < cost.crystal) {
            return false;
        }

        // 检查人口上限
        if (this.resources.population >= this.resources.popCap) {
            return false;
        }

        // 扣除资源
        this.resources.energy -= cost.energy;
        this.resources.crystal -= cost.crystal;

        // 在基地附近随机位置生成新单位
        const angle = Math.random() * Math.PI * 2;
        const distance = 80 + Math.random() * 60;
        const spawnX = this.base.x + Math.cos(angle) * distance;
        const spawnY = this.base.y + Math.sin(angle) * distance;

        // 限制在世界范围内
        const clampedX = Math.max(20, Math.min(this.worldWidth - 20, spawnX));
        const clampedY = Math.max(20, Math.min(this.worldHeight - 20, spawnY));

        const newId = this.units.length + this.enemyUnits.length + 1;
        const newUnit = this._createUnit(newId, clampedX, clampedY, 'player', type);
        this.units.push(newUnit);

        // 更新人口
        this.resources.population = this.units.length;

        // 触发更新回调
        if (this.onUpdate) this.onUpdate();

        return true;
    }

    _spawnEnemyUnits() {
        const enemyPositions = [
            { x: this.worldWidth - 350, y: this.worldHeight / 2 - 150 },
            { x: this.worldWidth - 450, y: this.worldHeight / 2 - 50 },
            { x: this.worldWidth - 350, y: this.worldHeight / 2 + 50 }
        ];

        for (let i = 0; i < enemyPositions.length; i++) {
            const pos = enemyPositions[i];
            const type = i === 1 ? 'battleship' : 'fighter';
            this.enemyUnits.push(this._createUnit(200 + i, pos.x, pos.y, 'enemy', type));
        }
        this.enemyResources.population = this.enemyUnits.length;
    }

    _createUnit(id, x, y, team, type = 'fighter') {
        const configs = {
            fighter: {
                name: team === 'player' ? `战机 ${id + 1}` : `敌机 ${id - 199}`,
                hp: 80,
                maxHp: 80,
                shield: 40,
                maxShield: 40,
                attack: 12,
                speed: 60,
                attackRange: 60,
                attackInterval: 800,
                size: 24,
                visionRadius: 50
            },
            battleship: {
                name: team === 'player' ? `战舰 ${id - 99}` : `敌舰 ${id - 199}`,
                hp: 150,
                maxHp: 150,
                shield: 80,
                maxShield: 80,
                attack: 25,
                speed: 30,
                attackRange: 90,
                attackInterval: 1200,
                size: 32,
                visionRadius: 100,
                artilleryCooldown: 0,
                artilleryMaxCooldown: 10,
                artilleryRadius: 50,
                artilleryDamage: 20,
                artilleryRounds: 2,
                artilleryInterval: 3
            },
            engineer: {
                name: team === 'player' ? `工程船 ${id + 1}` : `敌工程船 ${id - 199}`,
                hp: 60,
                maxHp: 60,
                shield: 20,
                maxShield: 20,
                attack: 0,
                speed: 40,
                attackRange: 0,
                attackInterval: 0,
                size: 20,
                visionRadius: 30,
                storage: 0,
                maxStorage: 200
            }
        };

        const config = configs[type];

        return {
            id: id,
            name: config.name,
            type: type,
            x: x,
            y: y,
            hp: config.hp,
            maxHp: config.maxHp,
            shield: config.shield,
            maxShield: config.maxShield,
            attack: config.attack,
            speed: config.speed,
            attackRange: config.attackRange,
            attackCooldown: 0,
            attackInterval: config.attackInterval,
            team: team,
            state: 'idle',
            angle: 0,
            targetX: null,
            targetY: null,
            targetUnit: null,
            patrolPoints: [],
            patrolIndex: 0,
            retreating: false,
            size: config.size,
            shieldRegenCooldown: 0,
            lastAttackedTime: 0,
            visionRadius: config.visionRadius,
            storage: config.storage || 0,
            maxStorage: config.maxStorage || 0,
            rerouteCount: 0
        };
    }

    _updateAngle(unit, targetAngle, dt) {
        let angleDiff = targetAngle - unit.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        const turnSpeed = unit.type === 'fighter' ? 8 : unit.type === 'battleship' ? 3 : 5;
        unit.angle += angleDiff * Math.min(1, turnSpeed * dt);
    }

    _clearRerouteState(unit) {
        unit.rerouteTimer = 0;
        unit.rerouteOriginalTargetX = null;
        unit.rerouteOriginalTargetY = null;
        unit.rerouteOriginalState = null;
        unit.rerouteDirection = null;
        unit.reroutePhase = null;
        unit.rerouteOriginalAngle = null;
        unit.rerouteTargetX = null;
        unit.rerouteTargetY = null;
        unit.rerouteTarget2X = null;
        unit.rerouteTarget2Y = null;
    }

    _getMyTeam() {
        if (this.isMultiplayer && this.playerTeam === 'player2') return 'enemy';
        return 'player';
    }

    _getMyUnits() {
        if (this.isMultiplayer && this.playerTeam === 'player2') return this.enemyUnits;
        return this.units;
    }

    _getEnemyUnitsList() {
        if (this.isMultiplayer && this.playerTeam === 'player2') return this.units;
        return this.enemyUnits;
    }

    _getMyBase() {
        return this.base;
    }

    _getEnemyBaseObj() {
        return this.enemyBase;
    }

    _getAllUnitsList() {
        return [...this.units, ...this.enemyUnits];
    }

    selectUnit(unit, additive = false) {
        if (!additive) {
            this.selectedUnits = [];
        }
        const myTeam = this._getMyTeam();
        if (unit && unit.team === myTeam) {
            const idx = this.selectedUnits.indexOf(unit);
            if (idx === -1) {
                this.selectedUnits.push(unit);
            } else if (additive) {
                this.selectedUnits.splice(idx, 1);
            }
        }
        if (this.onUpdate) this.onUpdate();
    }

    selectUnitsInRect(x1, y1, x2, y2) {
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        const myTeam = this._getMyTeam();
        const myUnits = this._getMyUnits();
        this.selectedUnits = myUnits.filter(u =>
            u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY && u.team === myTeam && u.hp > 0
        );
        if (this.onUpdate) this.onUpdate();
    }

    issueCommand(type, target) {
        let validUnits = this.selectedUnits.filter(u => u.hp > 0);
        if (validUnits.length === 0) return;

        // 工程船无法执行巡逻/战斗/封锁任务，过滤掉工程船
        const combatTypes = ['patrol', 'attack', 'attack_base', 'blockade'];
        if (combatTypes.includes(type)) {
            validUnits = validUnits.filter(u => u.type !== 'engineer');
            if (validUnits.length === 0) return;
        }

        if (type === 'patrol') {
            // 先清理选中单位的旧巡逻状态，避免重复虚线
            this._clearPatrolStateForUnits(validUnits);
            if (target && target.points && target.points.length >= 2) {
                this.addToPatrolQueue(validUnits, target.points);
            }
            return;
        }

        // 非巡逻指令前也清理巡逻状态
        this._clearPatrolStateForUnits(validUnits);

        for (const unit of validUnits) {
            this._applyCommand(unit, type, target);
        }
    }

    _checkUnitCollision(unit, targetX, targetY, moveDist) {
        // 如果提供了目标位置，进行预测性碰撞检测
        if (targetX !== undefined && targetY !== undefined && moveDist !== undefined) {
            const dx = targetX - unit.x;
            const dy = targetY - unit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.001) return { collided: false };

            const nx = dx / dist;
            const ny = dy / dist;
            const stepCount = Math.ceil(dist / moveDist);
            const collisionRadius = unit.size * 0.5;
            const allUnits = this._getAllUnitsList();

            for (let i = 1; i <= stepCount; i++) {
                const checkDist = Math.min(i * moveDist, dist);
                const checkX = unit.x + nx * checkDist;
                const checkY = unit.y + ny * checkDist;

                for (const other of allUnits) {
                    if (other === unit || other.hp <= 0) continue;
                    const odx = other.x - checkX;
                    const ody = other.y - checkY;
                    const oDist = Math.sqrt(odx * odx + ody * ody);
                    const otherRadius = other.size * 0.5;
                    if (oDist < collisionRadius + otherRadius) {
                        return { collided: true, other, x: checkX, y: checkY };
                    }
                }
            }
            return { collided: false };
        }

        // 默认行为：检查当前位置是否碰撞
        const collisionRadius = unit.size * 0.5;
        const allUnits = this._getAllUnitsList();
        for (const other of allUnits) {
            if (other === unit || other.hp <= 0) continue;
            const dx = other.x - unit.x;
            const dy = other.y - unit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const otherRadius = other.size * 0.5;
            if (dist < collisionRadius + otherRadius) {
                return other;
            }
        }
        return null;
    }

    /**
     * 清理单位的巡逻状态（从巡逻队列移除并重置状态）
     * @param {Array} units - 要清理的单位数组
     */
    _clearPatrolStateForUnits(units) {
        const unitIds = new Set(units.map(u => u.id));

        // 从所有巡逻任务组中移除这些单位
        for (const group of this.patrolTaskGroups) {
            for (const task of group.units) {
                if (unitIds.has(task.unitId)) {
                    task.status = 'completed';
                }
            }
        }

        // 立即清理已完成的任务组（所有单位都完成或失败）
        this.patrolTaskGroups = this.patrolTaskGroups.filter(group => {
            const allDone = group.units.every(task =>
                task.status === 'completed' || task.status === 'failed'
            );
            return !allDone;
        });

        // 重置单位巡逻相关状态
        for (const unit of units) {
            if (!unit || unit.hp <= 0) continue;
            unit.patrolPoints = [];
            unit.patrolIndex = 0;
            if (unit.state === 'patrol' || unit.state === 'waiting') {
                unit.state = 'idle';
                unit.targetX = null;
                unit.targetY = null;
            }
        }
    }

    _applyCommand(unit, type, target) {
        if (unit.state === 'building' && type !== 'stop') return;

        // 工程船无法执行战斗/巡逻/封锁任务
        const combatTypes = ['patrol', 'attack', 'attack_base', 'blockade'];
        if (unit.type === 'engineer' && combatTypes.includes(type)) return;

        if (type === 'stop') {
            unit.targetX = null;
            unit.targetY = null;
            unit.targetUnit = null;
            unit.patrolPoints = [];
            unit.retreating = false;

            // 中断重规划状态
            if (unit.state === 'reroute') {
                unit.rerouteCount = 0;
                this._clearRerouteState(unit);
            }

            if (unit.state === 'collecting') {
                // 离开采集时创建信标
                if (unit.targetBelt && unit.storage > 0) {
                    const hasBeacon = this.resourceBeacons.some(b => b.sourceBeltId === unit.targetBelt.id);
                    if (!hasBeacon) {
                        this._createResourceBeacon(unit.targetBelt);
                    }
                }
                unit.targetBelt = null;
            } else if (unit.state === 'building') {
                unit.buildTarget = null;
                unit.buildTimer = null;
            } else if (unit.state === 'blockading') {
                if (unit.blockadeTarget) {
                    const target = unit.blockadeTarget;
                    if (target.blockadingUnits) {
                        target.blockadingUnits = target.blockadingUnits.filter(id => id !== unit.id);
                        if (target.blockadingUnits.length === 0) {
                            target.isBlocked = false;
                        }
                    }
                }
                unit.blockadeTarget = null;
            }

            // 清空 sourceBelt，防止提交后自动返回资源带
            unit.sourceBelt = null;

            // 工程船有资源时进入 submitting 状态
            if (unit.type === 'engineer' && unit.storage > 0) {
                unit.state = 'submitting';
            } else {
                unit.state = 'idle';
            }
            return;
        }

        unit.state = type;
        unit.retreating = false;

        switch (type) {
            case 'move':
                unit.targetX = target.x;
                unit.targetY = target.y;
                unit.targetUnit = null;
                break;
            case 'attack':
                if (target && target.unit) {
                    unit.targetUnit = target.unit;
                    unit.targetX = target.unit.x;
                    unit.targetY = target.unit.y;
                }
                break;
            case 'attack_base':
                if (target && target.base) {
                    unit.targetUnit = target.base;
                    unit.targetX = target.base.x;
                    unit.targetY = target.base.y;
                }
                break;
            case 'retreat':
                // 工程船特殊处理：如果有资源，优先提交资源
                if (unit.type === 'engineer') {
                    // 如果正在采集，创建信标
                    if (unit.state === 'collecting' && unit.targetBelt && unit.storage > 0) {
                        const hasBeacon = this.resourceBeacons.some(b => b.sourceBeltId === unit.targetBelt.id);
                        if (!hasBeacon) {
                            this._createResourceBeacon(unit.targetBelt);
                        }
                    }
                    // 清空采集相关状态
                    unit.targetBelt = null;
                    unit.sourceBelt = null;

                    // 如果有资源，进入 submitting 状态提交资源
                    if (unit.storage > 0) {
                        unit.state = 'submitting';
                        unit.targetX = this.base.x;
                        unit.targetY = this.base.y;
                        unit.targetUnit = null;
                        unit.patrolPoints = [];
                        unit.retreating = false;
                        return;
                    }
                }

                unit.retreating = true;
                const retreatBase = this._getMyBase();
                unit.targetX = retreatBase ? retreatBase.x : this.base.x;
                unit.targetY = retreatBase ? retreatBase.y : this.base.y;
                unit.targetUnit = null;
                unit.patrolPoints = [];
                break;
        }
    }

    update(dt) {
        if (this.gameOver) return;

        const seconds = dt / 1000;
        this.gameTime += seconds;

        // 更新单位
        for (const unit of this.units) {
            this._updateUnit(unit, seconds);
            // 脱战检测：5秒未受击则每秒回复0.5护盾
            if (unit.hp > 0 && unit.shield < unit.maxShield) {
                if (this.gameTime - unit.lastAttackedTime > 5) {
                    unit.shield = Math.min(unit.maxShield, unit.shield + 0.5 * seconds);
                }
            }
            // 更新护盾受击计时器
            if (unit.shieldHitTimer > 0) {
                unit.shieldHitTimer -= seconds;
            }
        }

        for (const enemy of this.enemyUnits) {
            this._updateEnemy(enemy, seconds);
            // 脱战检测：5秒未受击则每秒回复0.5护盾
            if (enemy.hp > 0 && enemy.shield < enemy.maxShield) {
                if (this.gameTime - enemy.lastAttackedTime > 5) {
                    enemy.shield = Math.min(enemy.maxShield, enemy.shield + 0.5 * seconds);
                }
            }
            // 更新护盾受击计时器
            if (enemy.shieldHitTimer > 0) {
                enemy.shieldHitTimer -= seconds;
            }
        }

        // 移除死亡单位
        const deadPlayerUnits = this.units.filter(u => u.hp <= 0);
        const deadEnemyUnits = this.enemyUnits.filter(u => u.hp <= 0);

        // 为死亡单位创建爆炸效果
        for (const unit of deadPlayerUnits) {
            this._createExplosion(unit.x, unit.y, unit.type === 'battleship' ? 1.5 : 1.0);
        }
        for (const unit of deadEnemyUnits) {
            this._createExplosion(unit.x, unit.y, unit.type === 'battleship' ? 1.5 : 1.0);
        }

        // 记录战报：友方单位损失
        for (const unit of deadPlayerUnits) {
            this._addBattleReport({
                type: 'loss',
                text: `${unit.name} 被击毁`,
                color: '#ef4444'
            });
        }
        // 记录战报：敌方单位击杀
        for (const enemy of deadEnemyUnits) {
            this._addBattleReport({
                type: 'kill',
                text: `击毁 ${enemy.name}`,
                color: '#22c55e'
            });
        }

        this.stats.playerUnitsLost += deadPlayerUnits.length;
        this.stats.enemyUnitsLost += deadEnemyUnits.length;

        this.units = this.units.filter(u => u.hp > 0);
        this.enemyUnits = this.enemyUnits.filter(u => u.hp > 0);

        // 更新选中单位列表（移除已死亡的）
        this.selectedUnits = this.selectedUnits.filter(u => u.hp > 0);
        if (this.selectedEnemy && this.selectedEnemy.hp <= 0) {
            this.selectedEnemy = null;
        }

        // 更新基地
        this._updateBase(seconds);
        this._updateEnemyBase(seconds);

        // 更新控制区域
        this._updateControlZones(seconds);

        this._updateBlockades(seconds);

        this._updateArtilleryStrikes(seconds);

        this.processPatrolQueue(seconds);

        this._updateParticles(seconds);

        this._cachedVisibleAreas = this._computeVisibleAreas();

        // 检查游戏结束
        this._checkGameOver();

        // 更新资源显示
        this.resources.population = this.units.length;
        this.enemyResources.population = this.enemyUnits.length;
    }

    _updateUnit(unit, dt) {
        if (unit.hp <= 0) {
            unit.state = 'dead';
            return;
        }

        // 护盾恢复
        if (unit.shield < unit.maxShield) {
            unit.shieldRegenCooldown -= dt;
            if (unit.shieldRegenCooldown <= 0) {
                unit.shield = Math.min(unit.maxShield, unit.shield + 5 * dt);
            }
        }

        unit.attackCooldown = Math.max(0, unit.attackCooldown - dt * 1000);

        if (unit.type === 'battleship' && unit.artilleryCooldown > 0) {
            unit.artilleryCooldown = Math.max(0, unit.artilleryCooldown - dt);
        }

        const inWarning = this.artilleryWarnings.some(w => {
            const dx = unit.x - w.x;
            const dy = unit.y - w.y;
            return Math.sqrt(dx * dx + dy * dy) <= w.radius;
        });

        if (inWarning && unit.state !== 'evading') {
            const nearestWarning = this.artilleryWarnings.reduce((nearest, w) => {
                const dx = unit.x - w.x;
                const dy = unit.y - w.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (!nearest || dist < nearest.dist) {
                    return { warning: w, dist };
                }
                return nearest;
            }, null);

            if (nearestWarning) {
                const w = nearestWarning.warning;
                const dx = unit.x - w.x;
                const dy = unit.y - w.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const safeX = w.x + (dx / dist) * (w.radius + 30);
                const safeY = w.y + (dy / dist) * (w.radius + 30);

                unit.evadeTarget = { x: safeX, y: safeY };
                unit.previousState = unit.state;
                unit.state = 'evading';
            }
        }

        if (unit.state === 'evading' && unit.evadeTarget) {
            const dx = unit.evadeTarget.x - unit.x;
            const dy = unit.evadeTarget.y - unit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 5) {
                unit.state = unit.previousState || 'idle';
                unit.evadeTarget = null;
                unit.previousState = null;
            } else {
                const speed = (unit.speed || 60) * dt;
                unit.x += (dx / dist) * speed;
                unit.y += (dy / dist) * speed;
                this._updateAngle(unit, Math.atan2(dy, dx), dt);
            }

            unit.x = Math.max(20, Math.min(this.worldWidth - 20, unit.x));
            unit.y = Math.max(20, Math.min(this.worldHeight - 20, unit.y));
            return;
        }

        if (unit.attack === 0) {
            if (unit.state === 'reroute') {
                unit.rerouteTimer = (unit.rerouteTimer || 0) + dt;
                if (unit.rerouteTimer > 3.0) {
                    if (unit.rerouteOriginalTargetX !== null && unit.rerouteOriginalTargetY !== null) {
                        unit.targetX = unit.rerouteOriginalTargetX;
                        unit.targetY = unit.rerouteOriginalTargetY;
                        unit.state = unit.rerouteOriginalState || 'move';
                    } else {
                        unit.state = 'idle';
                        unit.rerouteCount = 0;
                    }
                    this._clearRerouteState(unit);
                } else {
                    const phase = unit.reroutePhase || 1;
                    const moveDist = unit.speed * dt;
                    if (phase === 1) {
                        if (unit.rerouteTargetX !== null && unit.rerouteTargetY !== null) {
                            const rdx = unit.rerouteTargetX - unit.x;
                            const rdy = unit.rerouteTargetY - unit.y;
                            const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
                            if (rdist > 2) {
                                unit.x += (rdx / rdist) * moveDist;
                                unit.y += (rdy / rdist) * moveDist;
                                this._updateAngle(unit, Math.atan2(rdy, rdx), dt);
                            } else {
                                unit.reroutePhase = 2;
                            }
                        }
                    } else if (phase === 2) {
                        if (unit.rerouteTarget2X !== null && unit.rerouteTarget2Y !== null) {
                            const t2dx = unit.rerouteTarget2X - unit.x;
                            const t2dy = unit.rerouteTarget2Y - unit.y;
                            const t2dist = Math.sqrt(t2dx * t2dx + t2dy * t2dy);
                            if (t2dist > 2) {
                                unit.x += (t2dx / t2dist) * moveDist;
                                unit.y += (t2dy / t2dist) * moveDist;
                                this._updateAngle(unit, Math.atan2(t2dy, t2dx), dt);
                            } else {
                                if (unit.rerouteOriginalTargetX !== null && unit.rerouteOriginalTargetY !== null) {
                                    unit.targetX = unit.rerouteOriginalTargetX;
                                    unit.targetY = unit.rerouteOriginalTargetY;
                                    unit.state = unit.rerouteOriginalState || 'move';
                                } else {
                                    unit.state = 'idle';
                                    unit.rerouteCount = 0;
                                }
                                this._clearRerouteState(unit);
                            }
                        }
                    }
                }
                unit.x = Math.max(20, Math.min(this.worldWidth - 20, unit.x));
                unit.y = Math.max(20, Math.min(this.worldHeight - 20, unit.y));
                return;
            }
            if (unit.state === 'submitting') {
                const base = unit.team === 'player' ? this.base : this.enemyBase;
                const dx = base.x - unit.x;
                const dy = base.y - unit.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 30) {
                    const metal = unit.storage * 5;
                    const crystal = unit.storage * 1;
                    if (unit.team === 'player') {
                        this.resources.energy += metal;
                        this.resources.crystal += crystal;
                    } else {
                        this.enemyResources.energy += metal;
                        this.enemyResources.crystal += crystal;
                    }
                    unit.storage = 0;
                    unit.state = 'returning';
                    unit.x = Math.max(20, Math.min(this.worldWidth - 20, unit.x));
                    unit.y = Math.max(20, Math.min(this.worldHeight - 20, unit.y));
                    return;
                }
                // 未到达基地：使用与战舰完全一致的移动逻辑（含碰撞检测/重规划）
                const collider = this._checkUnitCollision(unit);
                if (collider) {
                    unit.rerouteCount = (unit.rerouteCount || 0) + 1;
                    if (unit.rerouteCount >= 5) {
                        unit.state = 'idle';
                        unit.targetX = null;
                        unit.targetY = null;
                        unit.rerouteCount = 0;
                        this._clearRerouteState(unit);
                        if (this.onRerouteFail) { this.onRerouteFail(unit); }
                    } else {
                        unit.rerouteOriginalTargetX = base.x;
                        unit.rerouteOriginalTargetY = base.y;
                        unit.rerouteOriginalState = unit.state;
                        unit.rerouteTimer = 0;
                        unit.rerouteDirection = Math.random() > 0.5 ? 1 : -1;
                        unit.reroutePhase = 1;
                        const origAngle = Math.atan2(dy, dx);
                        unit.rerouteOriginalAngle = origAngle;
                        const perpAngle = origAngle + (unit.rerouteDirection * Math.PI / 2);
                        const offsetDist = unit.size * 2;
                        unit.rerouteTargetX = unit.x + Math.cos(perpAngle) * offsetDist;
                        unit.rerouteTargetY = unit.y + Math.sin(perpAngle) * offsetDist;
                        unit.rerouteTarget2X = unit.rerouteTargetX + Math.cos(origAngle) * offsetDist;
                        unit.rerouteTarget2Y = unit.rerouteTargetY + Math.sin(origAngle) * offsetDist;
                        const pushDx = unit.x - collider.x;
                        const pushDy = unit.y - collider.y;
                        const pushDist = Math.sqrt(pushDx * pushDx + pushDy * pushDy) || 1;
                        const safeDist = (unit.size + collider.size) * 0.5 + 2;
                        const overlap = safeDist - pushDist;
                        if (overlap > 0) {
                            unit.x += (pushDx / pushDist) * overlap;
                            unit.y += (pushDy / pushDist) * overlap;
                        }
                        unit.state = 'reroute';
                    }
                }
                if (unit.state !== 'reroute') {
                    let speedMult = 3;
                    const nearBeacon = this.resourceBeacons.some(b => {
                        const bdx = b.x - unit.x;
                        const bdy = b.y - unit.y;
                        return Math.sqrt(bdx * bdx + bdy * bdy) <= (b.visionRadius || 100);
                    });
                    if (nearBeacon) speedMult = 5;
                    const moveDist = (unit.speed || 40) * speedMult * dt;
                    const angle = Math.atan2(dy, dx);
                    unit.x += Math.cos(angle) * moveDist;
                    unit.y += Math.sin(angle) * moveDist;
                    this._updateAngle(unit, angle, dt);
                }
                unit.x = Math.max(20, Math.min(this.worldWidth - 20, unit.x));
                unit.y = Math.max(20, Math.min(this.worldHeight - 20, unit.y));
                return;
            }

            if (unit.state === 'returning') {
                if (unit.sourceBelt) {
                    const dx = unit.sourceBelt.x - unit.x;
                    const dy = unit.sourceBelt.y - unit.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 50) {
                        unit.state = 'collecting';
                        unit.targetBelt = unit.sourceBelt;
                    } else {
                        const collider = this._checkUnitCollision(unit);
                        if (collider) {
                            unit.rerouteCount = (unit.rerouteCount || 0) + 1;
                            if (unit.rerouteCount >= 5) {
                                unit.state = 'idle';
                                unit.targetX = null;
                                unit.targetY = null;
                                unit.rerouteCount = 0;
                                this._clearRerouteState(unit);
                                if (this.onRerouteFail) { this.onRerouteFail(unit); }
                            } else {
                                unit.rerouteOriginalTargetX = unit.sourceBelt.x;
                                unit.rerouteOriginalTargetY = unit.sourceBelt.y;
                                unit.rerouteOriginalState = unit.state;
                                unit.rerouteTimer = 0;
                                unit.rerouteDirection = Math.random() > 0.5 ? 1 : -1;
                                unit.reroutePhase = 1;
                                const origAngle = Math.atan2(dy, dx);
                                unit.rerouteOriginalAngle = origAngle;
                                const perpAngle = origAngle + (unit.rerouteDirection * Math.PI / 2);
                                const offsetDist = unit.size * 2;
                                unit.rerouteTargetX = unit.x + Math.cos(perpAngle) * offsetDist;
                                unit.rerouteTargetY = unit.y + Math.sin(perpAngle) * offsetDist;
                                unit.rerouteTarget2X = unit.rerouteTargetX + Math.cos(origAngle) * offsetDist;
                                unit.rerouteTarget2Y = unit.rerouteTargetY + Math.sin(origAngle) * offsetDist;
                                const pushDx = unit.x - collider.x;
                                const pushDy = unit.y - collider.y;
                                const pushDist = Math.sqrt(pushDx * pushDx + pushDy * pushDy) || 1;
                                const safeDist = (unit.size + collider.size) * 0.5 + 2;
                                const overlap = safeDist - pushDist;
                                if (overlap > 0) {
                                    unit.x += (pushDx / pushDist) * overlap;
                                    unit.y += (pushDy / pushDist) * overlap;
                                }
                                unit.state = 'reroute';
                            }
                        }
                        if (unit.state !== 'reroute') {
                            const moveDist = (unit.speed || 40) * dt;
                            const angle = Math.atan2(dy, dx);
                            unit.x += Math.cos(angle) * moveDist;
                            unit.y += Math.sin(angle) * moveDist;
                            this._updateAngle(unit, angle, dt);
                        }
                    }
                    unit.x = Math.max(20, Math.min(this.worldWidth - 20, unit.x));
                    unit.y = Math.max(20, Math.min(this.worldHeight - 20, unit.y));
                } else {
                    unit.state = 'idle';
                }
                return;
            }

            if (unit.state === 'collecting') {
                if (!unit.targetBelt || !this.asteroidBelts.includes(unit.targetBelt)) {
                    if (unit.targetBelt && unit.storage > 0) {
                        const hasBeacon = this.resourceBeacons.some(b => b.sourceBeltId === unit.targetBelt.id);
                        if (!hasBeacon) {
                            this._createResourceBeacon(unit.targetBelt);
                        }
                    }
                    unit.state = 'idle';
                    unit.targetBelt = null;
                    unit.targetX = null;
                    unit.targetY = null;
                } else {
                    const belt = unit.targetBelt;
                    const dx = belt.x - unit.x;
                    const dy = belt.y - unit.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= belt.radius) {
                        const collectAmount = 10 * dt;
                        unit.storage = Math.min(unit.maxStorage, unit.storage + collectAmount);
                        if (unit.storage >= unit.maxStorage) {
                            unit.sourceBelt = belt;
                            const hasBeacon = this.resourceBeacons.some(b => b.sourceBeltId === belt.id);
                            if (!hasBeacon) {
                                this._createResourceBeacon(belt);
                            }
                            unit.state = 'submitting';
                            unit.targetX = this.base.x;
                            unit.targetY = this.base.y;
                            unit.targetBelt = null;
                        }
                    } else {
                        const collider = this._checkUnitCollision(unit);
                        if (collider) {
                            unit.rerouteCount = (unit.rerouteCount || 0) + 1;
                            if (unit.rerouteCount >= 5) {
                                unit.state = 'idle';
                                unit.targetX = null;
                                unit.targetY = null;
                                unit.rerouteCount = 0;
                                this._clearRerouteState(unit);
                                if (this.onRerouteFail) { this.onRerouteFail(unit); }
                            } else {
                                unit.rerouteOriginalTargetX = belt.x;
                                unit.rerouteOriginalTargetY = belt.y;
                                unit.rerouteOriginalState = unit.state;
                                unit.rerouteTimer = 0;
                                unit.rerouteDirection = Math.random() > 0.5 ? 1 : -1;
                                unit.reroutePhase = 1;
                                const origAngle = Math.atan2(dy, dx);
                                unit.rerouteOriginalAngle = origAngle;
                                const perpAngle = origAngle + (unit.rerouteDirection * Math.PI / 2);
                                const offsetDist = unit.size * 2;
                                unit.rerouteTargetX = unit.x + Math.cos(perpAngle) * offsetDist;
                                unit.rerouteTargetY = unit.y + Math.sin(perpAngle) * offsetDist;
                                unit.rerouteTarget2X = unit.rerouteTargetX + Math.cos(origAngle) * offsetDist;
                                unit.rerouteTarget2Y = unit.rerouteTargetY + Math.sin(origAngle) * offsetDist;
                                const pushDx = unit.x - collider.x;
                                const pushDy = unit.y - collider.y;
                                const pushDist = Math.sqrt(pushDx * pushDx + pushDy * pushDy) || 1;
                                const safeDist = (unit.size + collider.size) * 0.5 + 2;
                                const overlap = safeDist - pushDist;
                                if (overlap > 0) {
                                    unit.x += (pushDx / pushDist) * overlap;
                                    unit.y += (pushDy / pushDist) * overlap;
                                }
                                unit.state = 'reroute';
                            }
                        }
                        if (unit.state !== 'reroute') {
                            const moveDist = unit.speed * dt;
                            const angle = Math.atan2(dy, dx);
                            unit.x += Math.cos(angle) * moveDist;
                            unit.y += Math.sin(angle) * moveDist;
                            this._updateAngle(unit, angle, dt);
                        }
                    }
                }
                unit.x = Math.max(20, Math.min(this.worldWidth - 20, unit.x));
                unit.y = Math.max(20, Math.min(this.worldHeight - 20, unit.y));
            } else if (unit.state === 'building') {
                if (unit.buildTarget) {
                    const dx = unit.buildTarget.x - unit.x;
                    const dy = unit.buildTarget.y - unit.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 5) {
                        const collider = this._checkUnitCollision(unit);
                        if (collider) {
                            unit.rerouteCount = (unit.rerouteCount || 0) + 1;
                            if (unit.rerouteCount >= 5) {
                                unit.state = 'idle';
                                unit.targetX = null;
                                unit.targetY = null;
                                unit.rerouteCount = 0;
                                this._clearRerouteState(unit);
                                if (this.onRerouteFail) { this.onRerouteFail(unit); }
                            } else {
                                unit.rerouteOriginalTargetX = unit.buildTarget.x;
                                unit.rerouteOriginalTargetY = unit.buildTarget.y;
                                unit.rerouteOriginalState = unit.state;
                                unit.rerouteTimer = 0;
                                unit.rerouteDirection = Math.random() > 0.5 ? 1 : -1;
                                unit.reroutePhase = 1;
                                const origAngle = Math.atan2(dy, dx);
                                unit.rerouteOriginalAngle = origAngle;
                                const perpAngle = origAngle + (unit.rerouteDirection * Math.PI / 2);
                                const offsetDist = unit.size * 2;
                                unit.rerouteTargetX = unit.x + Math.cos(perpAngle) * offsetDist;
                                unit.rerouteTargetY = unit.y + Math.sin(perpAngle) * offsetDist;
                                unit.rerouteTarget2X = unit.rerouteTargetX + Math.cos(origAngle) * offsetDist;
                                unit.rerouteTarget2Y = unit.rerouteTargetY + Math.sin(origAngle) * offsetDist;
                                const pushDx = unit.x - collider.x;
                                const pushDy = unit.y - collider.y;
                                const pushDist = Math.sqrt(pushDx * pushDx + pushDy * pushDy) || 1;
                                const safeDist = (unit.size + collider.size) * 0.5 + 2;
                                const overlap = safeDist - pushDist;
                                if (overlap > 0) {
                                    unit.x += (pushDx / pushDist) * overlap;
                                    unit.y += (pushDy / pushDist) * overlap;
                                }
                                unit.state = 'reroute';
                            }
                        }
                        if (unit.state !== 'reroute') {
                            const moveDist = unit.speed * dt;
                            const angle = Math.atan2(dy, dx);
                            unit.x += Math.cos(angle) * moveDist;
                            unit.y += Math.sin(angle) * moveDist;
                            this._updateAngle(unit, angle, dt);
                        }
                    } else {
                        unit.buildTimer -= dt;
                        if (unit.buildTimer <= 0) {
                            const outpost = this._createOutpost(unit.buildTarget.x, unit.buildTarget.y);
                            this.outposts.push(outpost);
                            unit.state = 'idle';
                            unit.buildTarget = null;
                            unit.buildTimer = 0;
                            unit.targetX = null;
                            unit.targetY = null;
                        }
                    }
                }
                unit.x = Math.max(20, Math.min(this.worldWidth - 20, unit.x));
                unit.y = Math.max(20, Math.min(this.worldHeight - 20, unit.y));
            } else if (unit.state === 'blockading') {
                if (!unit.blockadeTarget || !unit.blockadeTarget.isBlocked) {
                    unit.state = 'idle';
                    unit.blockadeTarget = null;
                } else {
                    const target = unit.blockadeTarget;
                    const radius = target.blockadeRadius || target.radius || 80;

                    // 寻找封锁区域内的敌方目标
                    let nearestEnemy = null;
                    let nearestEnemyDist = Infinity;
                    for (const enemy of this.enemyUnits) {
                        if (enemy.hp <= 0) continue;
                        const ex = enemy.x - target.x;
                        const ey = enemy.y - target.y;
                        const eDist = Math.sqrt(ex * ex + ey * ey);
                        if (eDist <= radius) {
                            const dx = enemy.x - unit.x;
                            const dy = enemy.y - unit.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist < nearestEnemyDist) {
                                nearestEnemyDist = dist;
                                nearestEnemy = enemy;
                            }
                        }
                    }

                    // 如果有敌方目标在封锁区域内，以0.2倍移速向其靠近（直到可交战距离）
                    if (nearestEnemy && nearestEnemyDist > unit.attackRange) {
                        const dx = nearestEnemy.x - unit.x;
                        const dy = nearestEnemy.y - unit.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > 0) {
                            const moveDist = unit.speed * 0.2 * dt;
                            unit.x += (dx / dist) * moveDist;
                            unit.y += (dy / dist) * moveDist;
                            this._updateAngle(unit, Math.atan2(dy, dx), dt);
                        }
                    } else {
                        // 保持在封锁区域内（原有逻辑）
                        const dx = target.x - unit.x;
                        const dy = target.y - unit.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > radius) {
                            const collider = this._checkUnitCollision(unit);
                            if (collider) {
                                unit.rerouteCount = (unit.rerouteCount || 0) + 1;
                                if (unit.rerouteCount >= 5) {
                                    unit.state = 'idle';
                                    unit.targetX = null;
                                    unit.targetY = null;
                                    unit.rerouteCount = 0;
                                    this._clearRerouteState(unit);
                                    if (this.onRerouteFail) { this.onRerouteFail(unit); }
                                } else {
                                    unit.rerouteOriginalTargetX = target.x;
                                    unit.rerouteOriginalTargetY = target.y;
                                    unit.rerouteOriginalState = unit.state;
                                    unit.rerouteTimer = 0;
                                    unit.rerouteDirection = Math.random() > 0.5 ? 1 : -1;
                                    unit.reroutePhase = 1;
                                    const origAngle = Math.atan2(dy, dx);
                                    unit.rerouteOriginalAngle = origAngle;
                                    const perpAngle = origAngle + (unit.rerouteDirection * Math.PI / 2);
                                    const offsetDist = unit.size * 2;
                                    unit.rerouteTargetX = unit.x + Math.cos(perpAngle) * offsetDist;
                                    unit.rerouteTargetY = unit.y + Math.sin(perpAngle) * offsetDist;
                                    unit.rerouteTarget2X = unit.rerouteTargetX + Math.cos(origAngle) * offsetDist;
                                    unit.rerouteTarget2Y = unit.rerouteTargetY + Math.sin(origAngle) * offsetDist;
                                    const pushDx = unit.x - collider.x;
                                    const pushDy = unit.y - collider.y;
                                    const pushDist = Math.sqrt(pushDx * pushDx + pushDy * pushDy) || 1;
                                    const safeDist = (unit.size + collider.size) * 0.5 + 2;
                                    const overlap = safeDist - pushDist;
                                    if (overlap > 0) {
                                        unit.x += (pushDx / pushDist) * overlap;
                                        unit.y += (pushDy / pushDist) * overlap;
                                    }
                                    unit.state = 'reroute';
                                }
                            }
                            if (unit.state !== 'reroute') {
                                const moveDist = unit.speed * dt;
                                const angle = Math.atan2(dy, dx);
                                unit.x += Math.cos(angle) * moveDist;
                                unit.y += Math.sin(angle) * moveDist;
                                this._updateAngle(unit, angle, dt);
                            }
                        }
                    }
                }
                unit.x = Math.max(20, Math.min(this.worldWidth - 20, unit.x));
                unit.y = Math.max(20, Math.min(this.worldHeight - 20, unit.y));
            } else if ((unit.state === 'move' || unit.state === 'patrol' || unit.state === 'retreat') && unit.targetX !== null) {
                const dx = unit.targetX - unit.x;
                const dy = unit.targetY - unit.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 5) {
                    if (unit.state === 'patrol' && unit.patrolPoints.length > 0) {
                        // 检查是否在巡逻队列中
                        const patrolTask = this._findPatrolUnitTask(unit.id);
                        if (patrolTask && patrolTask.status === 'patrolling') {
                            // 使用巡逻队列的下一个点逻辑
                            const nextPoint = this._getNextPatrolPoint(patrolTask);
                            if (nextPoint) {
                                unit.targetX = nextPoint.x;
                                unit.targetY = nextPoint.y;
                            }
                        } else {
                            // 普通巡逻逻辑
                            unit.patrolIndex = (unit.patrolIndex + 1) % unit.patrolPoints.length;
                            unit.targetX = unit.patrolPoints[unit.patrolIndex].x;
                            unit.targetY = unit.patrolPoints[unit.patrolIndex].y;
                        }
                    } else {
                        unit.state = 'idle';
                        unit.targetX = null;
                        unit.targetY = null;
                        unit.rerouteCount = 0;
                        if (unit.retreating) unit.retreating = false;
                    }
                } else {
                    const collider = this._checkUnitCollision(unit);
                    if (collider) {
                        unit.rerouteCount = (unit.rerouteCount || 0) + 1;
                        const maxRerouteCount = unit.state === 'patrol' ? 3 : 5;
                        if (unit.rerouteCount >= maxRerouteCount) {
                            if (unit.state === 'patrol') {
                                this._failPatrolTask(unit);
                            } else {
                                unit.state = 'idle';
                                unit.targetX = null;
                                unit.targetY = null;
                            }
                            unit.rerouteCount = 0;
                            this._clearRerouteState(unit);
                            if (this.onRerouteFail) { this.onRerouteFail(unit); }
                        } else {
                            unit.rerouteOriginalTargetX = unit.targetX;
                            unit.rerouteOriginalTargetY = unit.targetY;
                            unit.rerouteOriginalState = unit.state;
                            unit.rerouteTimer = 0;
                            unit.rerouteDirection = Math.random() > 0.5 ? 1 : -1;
                            unit.reroutePhase = 1;
                            const origAngle = Math.atan2(dy, dx);
                            unit.rerouteOriginalAngle = origAngle;
                            const perpAngle = origAngle + (unit.rerouteDirection * Math.PI / 2);
                            const offsetDist = unit.size * 2;
                            unit.rerouteTargetX = unit.x + Math.cos(perpAngle) * offsetDist;
                            unit.rerouteTargetY = unit.y + Math.sin(perpAngle) * offsetDist;
                            unit.rerouteTarget2X = unit.rerouteTargetX + Math.cos(origAngle) * offsetDist;
                            unit.rerouteTarget2Y = unit.rerouteTargetY + Math.sin(origAngle) * offsetDist;
                            const pushDx = unit.x - collider.x;
                            const pushDy = unit.y - collider.y;
                            const pushDist = Math.sqrt(pushDx * pushDx + pushDy * pushDy) || 1;
                            const safeDist = (unit.size + collider.size) * 0.5 + 2;
                            const overlap = safeDist - pushDist;
                            if (overlap > 0) {
                                unit.x += (pushDx / pushDist) * overlap;
                                unit.y += (pushDy / pushDist) * overlap;
                            }
                            unit.state = 'reroute';
                        }
                    }
                    if (unit.state !== 'reroute') {
                        const patrolSpeed = this._getUnitPatrolSpeed(unit);
                        const moveDist = patrolSpeed * (unit.retreating ? 1.5 : 1) * dt;
                        unit.x += (dx / dist) * moveDist;
                        unit.y += (dy / dist) * moveDist;
                        this._updateAngle(unit, Math.atan2(dy, dx), dt);
                    }
                }
                unit.x = Math.max(20, Math.min(this.worldWidth - 20, unit.x));
                unit.y = Math.max(20, Math.min(this.worldHeight - 20, unit.y));
            } else {
                // 其他状态（如idle）统一边界限制
                unit.x = Math.max(20, Math.min(this.worldWidth - 20, unit.x));
                unit.y = Math.max(20, Math.min(this.worldHeight - 20, unit.y));
            }
            return;
        }

        if (unit.state === 'reroute') {
            unit.rerouteTimer = (unit.rerouteTimer || 0) + dt;
            if (unit.rerouteTimer > 3.0) {
                if (unit.rerouteOriginalTargetX !== null && unit.rerouteOriginalTargetY !== null) {
                    unit.targetX = unit.rerouteOriginalTargetX;
                    unit.targetY = unit.rerouteOriginalTargetY;
                    unit.state = unit.rerouteOriginalState || 'move';
                } else {
                    unit.state = 'idle';
                    unit.rerouteCount = 0;
                }
                this._clearRerouteState(unit);
            } else {
                const phase = unit.reroutePhase || 1;
                const moveDist = unit.speed * dt;
                if (phase === 1) {
                    if (unit.rerouteTargetX !== null && unit.rerouteTargetY !== null) {
                        const rdx = unit.rerouteTargetX - unit.x;
                        const rdy = unit.rerouteTargetY - unit.y;
                        const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
                        if (rdist > 2) {
                            unit.x += (rdx / rdist) * moveDist;
                            unit.y += (rdy / rdist) * moveDist;
                            this._updateAngle(unit, Math.atan2(rdy, rdx), dt);
                        } else {
                            unit.reroutePhase = 2;
                        }
                    }
                } else if (phase === 2) {
                    if (unit.rerouteTarget2X !== null && unit.rerouteTarget2Y !== null) {
                        const t2dx = unit.rerouteTarget2X - unit.x;
                        const t2dy = unit.rerouteTarget2Y - unit.y;
                        const t2dist = Math.sqrt(t2dx * t2dx + t2dy * t2dy);
                        if (t2dist > 2) {
                            unit.x += (t2dx / t2dist) * moveDist;
                            unit.y += (t2dy / t2dist) * moveDist;
                            this._updateAngle(unit, Math.atan2(t2dy, t2dx), dt);
                        } else {
                            if (unit.rerouteOriginalTargetX !== null && unit.rerouteOriginalTargetY !== null) {
                                unit.targetX = unit.rerouteOriginalTargetX;
                                unit.targetY = unit.rerouteOriginalTargetY;
                                unit.state = unit.rerouteOriginalState || 'move';
                            } else {
                                unit.state = 'idle';
                                unit.rerouteCount = 0;
                            }
                            this._clearRerouteState(unit);
                        }
                    }
                }
            }
            unit.x = Math.max(20, Math.min(this.worldWidth - 20, unit.x));
            unit.y = Math.max(20, Math.min(this.worldHeight - 20, unit.y));
            return;
        }

        if (unit.state === 'patrol') {
            const nearbyEnemy = this._findNearbyEnemy(unit);
            if (nearbyEnemy) {
                unit.targetUnit = nearbyEnemy;
                // 保存当前巡逻目标，以便攻击结束后恢复
                unit.patrolResumeX = unit.targetX;
                unit.patrolResumeY = unit.targetY;
                unit.state = 'attack';
            }
        }

        if (unit.state === 'blockading') {
            if (!unit.blockadeTarget || !unit.blockadeTarget.isBlocked) {
                unit.state = 'idle';
                unit.blockadeTarget = null;
            } else {
                const target = unit.blockadeTarget;
                const dx = target.x - unit.x;
                const dy = target.y - unit.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const radius = target.blockadeRadius || target.radius || 80;
                if (dist > radius) {
                    const moveDist = unit.speed * dt;
                    unit.x += (dx / dist) * moveDist;
                    unit.y += (dy / dist) * moveDist;
                    this._updateAngle(unit, Math.atan2(dy, dx), dt);
                }
            }
            unit.x = Math.max(20, Math.min(this.worldWidth - 20, unit.x));
            unit.y = Math.max(20, Math.min(this.worldHeight - 20, unit.y));
            return;
        }

        // 攻击逻辑 (attack 和 attack_base 共用相同的移动和攻击逻辑)
        if ((unit.state === 'attack' || unit.state === 'attack_base') && unit.targetUnit) {
            if (unit.targetUnit.hp <= 0) {
                unit.targetUnit = null;
                if (unit.patrolPoints.length > 0) {
                    unit.state = 'patrol';
                    // 优先使用保存的巡逻恢复目标（从巡逻状态进入攻击时保存的）
                    if (unit.patrolResumeX !== undefined && unit.patrolResumeY !== undefined) {
                        unit.targetX = unit.patrolResumeX;
                        unit.targetY = unit.patrolResumeY;
                        unit.patrolResumeX = undefined;
                        unit.patrolResumeY = undefined;
                    } else {
                        // 确保 patrolIndex 在有效范围内
                        unit.patrolIndex = Math.max(0, Math.min(unit.patrolIndex, unit.patrolPoints.length - 1));
                        unit.targetX = unit.patrolPoints[unit.patrolIndex].x;
                        unit.targetY = unit.patrolPoints[unit.patrolIndex].y;
                    }
                } else {
                    unit.state = 'idle';
                }
                return;
            }

            const dx = unit.targetUnit.x - unit.x;
            const dy = unit.targetUnit.y - unit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > unit.attackRange) {
                const moveDist = unit.speed * (unit.retreating ? 1.5 : 1) * dt;
                unit.x += (dx / dist) * moveDist;
                unit.y += (dy / dist) * moveDist;
                this._updateAngle(unit, Math.atan2(dy, dx), dt);
            } else {
                this._updateAngle(unit, Math.atan2(dy, dx), dt);
                if (unit.attackCooldown <= 0) {
                    this._dealDamage(unit.targetUnit, unit.attack);
                    unit.attackCooldown = unit.attackInterval;
                    // 重置护盾恢复计时
                    unit.targetUnit.shieldRegenCooldown = 3;
                }
            }
        } else if ((unit.state === 'move' || unit.state === 'patrol' || unit.state === 'retreat') && unit.targetX !== null) {
            // 碰撞检测
            const collider = this._checkUnitCollision(unit);
            if (collider) {
                const isEnemy = collider.team !== unit.team;
                // 进攻/巡逻时遇到敌方单位直接进入战斗
                if (isEnemy && unit.state === 'patrol') {
                    unit.targetUnit = collider;
                    unit.state = 'attack';
                } else if (!isEnemy || unit.state === 'move' || unit.state === 'retreat') {
                    // 友方单位碰撞，或调动/撤退时遇到敌方单位 → 重规划（激进直角绕路）
                    unit.rerouteCount = (unit.rerouteCount || 0) + 1;

                    // 巡逻状态：限制重规划次数为3次
                    const maxRerouteCount = unit.state === 'patrol' ? 3 : 5;

                    // 重规划次数过多，放弃并通知
                    if (unit.rerouteCount >= maxRerouteCount) {
                        // 巡逻状态：标记任务失败并从队列中移除
                        if (unit.state === 'patrol') {
                            this._failPatrolTask(unit);
                        } else {
                            unit.state = 'idle';
                            unit.targetX = null;
                            unit.targetY = null;
                        }
                        unit.rerouteCount = 0;
                        // 稍微偏移位置避免与碰撞单位重叠
                        const pushDx = unit.x - collider.x;
                        const pushDy = unit.y - collider.y;
                        const pushDist = Math.sqrt(pushDx * pushDx + pushDy * pushDy) || 1;
                        const safeDist = unit.size * 0.6;
                        unit.x += (pushDx / pushDist) * safeDist;
                        unit.y += (pushDy / pushDist) * safeDist;
                        this._clearRerouteState(unit);
                        if (this.onRerouteFail) {
                            this.onRerouteFail(unit);
                        }
                    } else {
                        unit.rerouteOriginalTargetX = unit.targetX;
                        unit.rerouteOriginalTargetY = unit.targetY;
                        unit.rerouteOriginalState = unit.state;
                        unit.rerouteTimer = 0;
                        unit.rerouteDirection = Math.random() > 0.5 ? 1 : -1;
                        unit.reroutePhase = 1;
                        const dx = unit.targetX - unit.x;
                        const dy = unit.targetY - unit.y;
                        const origAngle = Math.atan2(dy, dx);
                        unit.rerouteOriginalAngle = origAngle;
                        const perpAngle = origAngle + (unit.rerouteDirection * Math.PI / 2);
                        const offsetDist = unit.size * 2;
                        unit.rerouteTargetX = unit.x + Math.cos(perpAngle) * offsetDist;
                        unit.rerouteTargetY = unit.y + Math.sin(perpAngle) * offsetDist;
                        unit.rerouteTarget2X = unit.rerouteTargetX + Math.cos(origAngle) * offsetDist;
                        unit.rerouteTarget2Y = unit.rerouteTargetY + Math.sin(origAngle) * offsetDist;
                        const pushDx = unit.x - collider.x;
                        const pushDy = unit.y - collider.y;
                        const pushDist = Math.sqrt(pushDx * pushDx + pushDy * pushDy) || 1;
                        const safeDist = (unit.size + collider.size) * 0.5 + 2;
                        const overlap = safeDist - pushDist;
                        if (overlap > 0) {
                            unit.x += (pushDx / pushDist) * overlap;
                            unit.y += (pushDy / pushDist) * overlap;
                        }
                        unit.state = 'reroute';
                    }
                }
            }

            if (unit.state !== 'reroute') {
                const dx = unit.targetX - unit.x;
                const dy = unit.targetY - unit.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 5) {
                    if (unit.state === 'patrol' && unit.patrolPoints.length > 0) {
                        // 检查是否在巡逻队列中
                        const patrolTask = this._findPatrolUnitTask(unit.id);
                        if (patrolTask && patrolTask.status === 'patrolling') {
                            // 使用巡逻队列的下一个点逻辑
                            const nextPoint = this._getNextPatrolPoint(patrolTask);
                            if (nextPoint) {
                                unit.targetX = nextPoint.x;
                                unit.targetY = nextPoint.y;
                            }
                        } else {
                            // 普通巡逻逻辑
                            unit.patrolIndex = (unit.patrolIndex + 1) % unit.patrolPoints.length;
                            unit.targetX = unit.patrolPoints[unit.patrolIndex].x;
                            unit.targetY = unit.patrolPoints[unit.patrolIndex].y;
                        }
                    } else {
                        unit.state = 'idle';
                        unit.targetX = null;
                        unit.targetY = null;
                        if (unit.retreating) unit.retreating = false;
                    }
                } else {
                    const patrolSpeed = this._getUnitPatrolSpeed(unit);
                    const moveDist = patrolSpeed * (unit.retreating ? 1.5 : 1) * dt;
                    unit.x += (dx / dist) * moveDist;
                    unit.y += (dy / dist) * moveDist;
                    this._updateAngle(unit, Math.atan2(dy, dx), dt);
                }
            }
        }

        unit.x = Math.max(20, Math.min(this.worldWidth - 20, unit.x));
        unit.y = Math.max(20, Math.min(this.worldHeight - 20, unit.y));
    }

    _updateEnemy(enemy, dt) {
        if (enemy.hp <= 0) return;

        // 护盾恢复
        if (enemy.shield < enemy.maxShield) {
            enemy.shieldRegenCooldown -= dt;
            if (enemy.shieldRegenCooldown <= 0) {
                enemy.shield = Math.min(enemy.maxShield, enemy.shield + 0.5 * dt);
            }
        }

        enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt * 1000);

        // 敌方单位碰撞回避（激进）
        const enemyCollider = this._checkUnitCollision(enemy);
        if (enemyCollider) {
            const cdx = enemyCollider.x - enemy.x;
            const cdy = enemyCollider.y - enemy.y;
            const cdist = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
            const dir = Math.random() > 0.5 ? 1 : -1;
            const perpX = (-cdy / cdist) * dir;
            const perpY = (cdx / cdist) * dir;
            const offsetDist = enemy.size * 2.5;
            enemy.x += perpX * enemy.speed * dt;
            enemy.y += perpY * enemy.speed * dt;
            enemy.x = Math.max(20, Math.min(this.worldWidth - 20, enemy.x));
            enemy.y = Math.max(20, Math.min(this.worldHeight - 20, enemy.y));
            return;
        }

        // 检查敌方单位是否在任何封锁节点范围内（控制区或前哨站）
        let blockedZone = null;
        for (const zone of this.controlZones) {
            if (zone.isBlocked && this._isInZone(enemy, zone)) {
                blockedZone = zone;
                break;
            }
        }
        // 如果没有在控制区被封锁，检查前哨站
        if (!blockedZone) {
            for (const outpost of this.outposts) {
                if (outpost.isBlocked && this._isInZone(enemy, outpost)) {
                    blockedZone = outpost;
                    break;
                }
            }
        }

        // 如果在封锁节点内，被强制以3倍速度拉向我方封锁单位，并与所有封锁单位交战
        if (blockedZone && blockedZone.blockadingUnits && blockedZone.blockadingUnits.length > 0) {
            // 获取所有活跃的封锁单位
            const blockadingUnits = blockedZone.blockadingUnits
                .map(id => this.units.find(u => u.id === id))
                .filter(u => u && u.hp > 0);

            if (blockadingUnits.length > 0) {
                // 找到最近的封锁单位
                let nearestBlockader = null;
                let nearestDist = Infinity;
                for (const unit of blockadingUnits) {
                    const dx = unit.x - enemy.x;
                    const dy = unit.y - enemy.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestBlockader = unit;
                    }
                }

                // 以3倍速度被拉向最近的封锁单位
                if (nearestBlockader) {
                    const dx = nearestBlockader.x - enemy.x;
                    const dy = nearestBlockader.y - enemy.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > 0) {
                        // 强制以3倍航速牵引
                        enemy.x += (dx / dist) * enemy.speed * 3 * dt;
                        enemy.y += (dy / dist) * enemy.speed * 3 * dt;
                    }
                }

                // 与所有在攻击范围内的封锁单位交战
                for (const blockader of blockadingUnits) {
                    const dx = blockader.x - enemy.x;
                    const dy = blockader.y - enemy.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist <= enemy.attackRange) {
                        if (enemy.attackCooldown <= 0) {
                            this._applyDamage(blockader, enemy.attack, null, enemy, 'direct');
                            enemy.attackCooldown = enemy.attackInterval;
                            blockader.shieldRegenCooldown = 3;
                        }
                    }
                }

                // 限制在世界范围内
                enemy.x = Math.max(20, Math.min(this.worldWidth - 20, enemy.x));
                enemy.y = Math.max(20, Math.min(this.worldHeight - 20, enemy.y));
                return;
            }
        }

        // 简单的AI：寻找最近的目标
        let target = this._findNearbyPlayer(enemy);

        // 如果没有附近玩家，攻击玩家基地
        if (!target && this.base && this.base.hp > 0) {
            const dx = this.base.x - enemy.x;
            const dy = this.base.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > enemy.attackRange) {
                enemy.x += (dx / dist) * enemy.speed * dt;
                enemy.y += (dy / dist) * enemy.speed * dt;
            } else {
                if (enemy.attackCooldown <= 0) {
                    this._dealDamageToBase(this.base, enemy.attack);
                    enemy.attackCooldown = enemy.attackInterval;
                }
            }
            return;
        }

        if (target) {
            const dx = target.x - enemy.x;
            const dy = target.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > enemy.attackRange) {
                enemy.x += (dx / dist) * enemy.speed * dt;
                enemy.y += (dy / dist) * enemy.speed * dt;
            } else {
                if (enemy.attackCooldown <= 0) {
                    this._applyDamage(target, enemy.attack, null, enemy, 'direct');
                    enemy.attackCooldown = enemy.attackInterval;
                    target.shieldRegenCooldown = 3;
                }
            }
        }

        // 限制在世界范围内
        enemy.x = Math.max(20, Math.min(this.worldWidth - 20, enemy.x));
        enemy.y = Math.max(20, Math.min(this.worldHeight - 20, enemy.y));
    }

    _dealDamage(target, damage, sourceUnit = null) {
        const hadShield = target.shield > 0;
        if (target.shield > 0) {
            const shieldDamage = Math.min(target.shield, damage);
            target.shield -= shieldDamage;
            damage -= shieldDamage;

            // 护盾归零时触发破裂效果
            if (target.shield <= 0 && hadShield) {
                this._createShieldBreakEffect(target.x, target.y, target.size);
            }
        }

        if (damage > 0) {
            target.hp -= damage;
            this._createHitParticles(target.x, target.y);
        }

        // 创建护盾涟漪效果
        this._createShieldRipple(target.x, target.y, hadShield);

        // 记录护盾受击时间
        target.shieldHitTimer = 0.3;

        target.lastAttackedTime = this.gameTime;
    }

    _applyDamage(target, damage, source, sourceUnit, sourceType) {
        const hadShield = target.shield > 0;
        if (target.shield > 0) {
            const shieldDamage = Math.min(target.shield, damage);
            target.shield -= shieldDamage;
            damage -= shieldDamage;

            // 护盾归零时触发破裂效果
            if (target.shield <= 0 && hadShield) {
                this._createShieldBreakEffect(target.x, target.y, target.size);
            }
        }

        if (damage > 0) {
            target.hp -= damage;
            this._createHitParticles(target.x, target.y);
        }

        // 创建护盾涟漪效果
        this._createShieldRipple(target.x, target.y, hadShield);

        // 记录护盾受击时间
        target.shieldHitTimer = 0.3;

        target.lastAttackedTime = this.gameTime;

        if (target.hp > 0 && target.team === 'player' && sourceUnit && sourceType !== 'artillery') {
            if (target.state === 'idle' || target.state === 'move') {
                target.state = 'attack';
                target.targetUnit = sourceUnit;
                target.targetX = sourceUnit.x;
                target.targetY = sourceUnit.y;
            }
        }
    }

    _dealDamageToBase(base, damage) {
        base.hp -= damage;
        // 创建基地受击效果
        this._createHitParticles(base.x, base.y, 10, '#ff6b6b');
    }

    _createHitParticles(x, y, count = 5, color = null) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 30 + Math.random() * 30;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5,
                maxLife: 0.5,
                color: color || `hsl(${Math.random() * 60 + 10}, 100%, 60%)`,
                size: 2 + Math.random() * 3
            });
        }
    }

    /**
     * 创建爆炸特效（单位被摧毁时）
     * @param {number} x - 爆炸中心X
     * @param {number} y - 爆炸中心Y
     * @param {number} intensity - 爆炸强度（默认1.0）
     */
    _createExplosion(x, y, intensity = 1.0) {
        const count = Math.floor(intensity * 10);

        // 1. 核心闪光：白色圆形，快速扩散（0.3秒），半径从0到30
        this.particles.push({
            x: x,
            y: y,
            vx: 0,
            vy: 0,
            life: 0.3,
            maxLife: 0.3,
            color: '#ffffff',
            size: 30 * intensity,
            type: 'explosion',
            startSize: 0,
            endSize: 30 * intensity
        });

        // 2. 碎片飞溅：8-12个三角形/多边形碎片，带随机旋转和速度
        const debrisCount = 8 + Math.floor(Math.random() * 5);
        for (let i = 0; i < debrisCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (80 + Math.random() * 120) * intensity;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.6 + Math.random() * 0.4,
                maxLife: 1.0,
                color: `hsl(${Math.random() * 40 + 10}, 100%, 60%)`,
                size: 3 + Math.random() * 4,
                type: 'debris',
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 10,
                sides: 3 + Math.floor(Math.random() * 3) // 三角形到五边形
            });
        }

        // 3. 冲击波环：圆形环状扩散，透明度递减
        this.particles.push({
            x: x,
            y: y,
            vx: 0,
            vy: 0,
            life: 0.5,
            maxLife: 0.5,
            color: '#ffaa44',
            size: 20 * intensity,
            type: 'shockwave',
            startRadius: 5 * intensity,
            endRadius: 60 * intensity,
            lineWidth: 3 * intensity
        });

        // 4. 烟雾残留：10-15个灰色粒子，缓慢上升并消散
        const smokeCount = 10 + Math.floor(Math.random() * 6);
        for (let i = 0; i < smokeCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 10 + Math.random() * 20;
            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                vx: Math.cos(angle) * speed,
                vy: -20 - Math.random() * 30, // 缓慢上升
                life: 1.0 + Math.random() * 0.5,
                maxLife: 1.5,
                color: `rgba(${100 + Math.floor(Math.random() * 80)}, ${100 + Math.floor(Math.random() * 80)}, ${100 + Math.floor(Math.random() * 80)}, 0.6)`,
                size: 5 + Math.random() * 8,
                type: 'smoke',
                drag: 0.95
            });
        }
    }

    /**
     * 创建护盾受击涟漪效果
     * @param {number} x - 目标位置X
     * @param {number} y - 目标位置Y
     * @param {boolean} hasShield - 目标是否有护盾
     */
    _createShieldRipple(x, y, hasShield) {
        if (!hasShield) {
            // 无护盾时只创建命中闪光
            this.particles.push({
                x: x,
                y: y,
                vx: 0,
                vy: 0,
                life: 0.1,
                maxLife: 0.1,
                color: '#ffffff',
                size: 15,
                type: 'hit_flash'
            });
            return;
        }

        // 命中闪光
        this.particles.push({
            x: x,
            y: y,
            vx: 0,
            vy: 0,
            life: 0.1,
            maxLife: 0.1,
            color: '#ffffff',
            size: 15,
            type: 'hit_flash'
        });

        // 蓝色同心圆波纹扩散
        for (let i = 0; i < 2; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: 0,
                vy: 0,
                life: 0.4 + i * 0.15,
                maxLife: 0.4 + i * 0.15,
                color: '#3b82f6',
                size: 20 + i * 10,
                type: 'ripple',
                delay: i * 0.08,
                lineWidth: 2
            });
        }
    }

    /**
     * 创建护盾破裂特效
     * @param {number} x - 位置X
     * @param {number} y - 位置Y
     * @param {number} size - 单位大小
     */
    _createShieldBreakEffect(x, y, size) {
        const shardCount = 6 + Math.floor(Math.random() * 4);
        for (let i = 0; i < shardCount; i++) {
            const angle = (Math.PI * 2 * i) / shardCount + Math.random() * 0.5;
            const speed = 40 + Math.random() * 60;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5 + Math.random() * 0.3,
                maxLife: 0.8,
                color: '#60a5fa',
                size: 2 + Math.random() * 3,
                type: 'shield_shard',
                rotation: angle,
                rotationSpeed: (Math.random() - 0.5) * 8
            });
        }
    }

    /**
     * 创建资源传输效果
     * @param {number} x - 工程船位置X
     * @param {number} y - 工程船位置Y
     * @param {number} metal - 传输的金属量
     * @param {number} crystal - 传输的晶体量
     */
    _createResourceTransferEffect(x, y, metal, crystal) {
        // 创建向上的粒子效果表示资源传输
        for (let i = 0; i < 8; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5; // 向上扩散
            const speed = 40 + Math.random() * 30;
            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 10,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                maxLife: 1.0,
                color: i % 2 === 0 ? '#22c55e' : '#0ea5e9', // 绿色和青色交替
                size: 3 + Math.random() * 2,
                type: 'resource_transfer'
            });
        }
        // 添加资源数字飘字效果
        this.particles.push({
            x: x,
            y: y - 30,
            vx: 0,
            vy: -20,
            life: 1.5,
            maxLife: 1.5,
            color: '#22c55e',
            size: 14,
            type: 'resource_text',
            text: `+${Math.floor(metal)}⚡`
        });
        this.particles.push({
            x: x,
            y: y - 50,
            vx: 0,
            vy: -20,
            life: 1.5,
            maxLife: 1.5,
            color: '#0ea5e9',
            size: 12,
            type: 'resource_text',
            text: `+${Math.floor(crystal)}◆`
        });
    }

    _updateParticles(dt) {
        for (const p of this.particles) {
            // 处理延迟效果
            if (p.delay !== undefined && p.delay > 0) {
                p.delay -= dt;
                continue;
            }

            // 烟雾粒子有空气阻力
            if (p.type === 'smoke' && p.drag) {
                p.vx *= p.drag;
                p.vy *= p.drag;
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;

            // 更新碎片旋转
            if (p.type === 'debris' && p.rotationSpeed) {
                p.rotation += p.rotationSpeed * dt;
            }
            if (p.type === 'shield_shard' && p.rotationSpeed) {
                p.rotation += p.rotationSpeed * dt;
            }
        }
        this.particles = this.particles.filter(p => p.life > 0);
    }

    _updateBase(dt) {
        if (!this.base || this.base.hp <= 0) return;

        this.base.lastRepair += dt;
        if (this.base.lastRepair >= this.base.repairRate) {
            this.base.lastRepair = 0;
            if (this.base.hp < this.base.maxHp) {
                this.base.hp = Math.min(this.base.maxHp, this.base.hp + 10);
            }
        }
    }

    _updateEnemyBase(dt) {
        if (!this.enemyBase || this.enemyBase.hp <= 0) return;

        this.enemyBase.lastRepair += dt;
        if (this.enemyBase.lastRepair >= this.enemyBase.repairRate) {
            this.enemyBase.lastRepair = 0;
            if (this.enemyBase.hp < this.enemyBase.maxHp) {
                this.enemyBase.hp = Math.min(this.enemyBase.maxHp, this.enemyBase.hp + 10);
            }
        }
    }

    _updateControlZones(dt) {
        for (const zone of this.controlZones) {
            if (!zone.blockadingUnits) zone.blockadingUnits = [];
            const playerUnits = this.units.filter(u => u.hp > 0 && this._isInZone(u, zone));
            const enemyUnits = this.enemyUnits.filter(u => u.hp > 0 && this._isInZone(u, zone));

            const playerCount = playerUnits.length;
            const enemyCount = enemyUnits.length;

            const playerProgress = playerCount * 20 * dt;
            const enemyDecay = enemyCount * 15 * dt;

            zone.isContested = false;

            let prevOwner = zone.owner;

            if (playerCount > 0 && enemyCount === 0) {
                if (zone.owner !== 'player') {
                    zone.captureProgress += playerProgress;
                    zone.capturingTeam = 'player';
                    if (zone.captureProgress >= zone.maxCaptureProgress) {
                        zone.owner = 'player';
                        zone.captureProgress = zone.maxCaptureProgress;
                    }
                }
            } else if (enemyCount > 0 && playerCount === 0) {
                if (zone.owner !== 'enemy') {
                    zone.captureProgress += enemyCount * 20 * dt;
                    zone.capturingTeam = 'enemy';
                    if (zone.captureProgress >= zone.maxCaptureProgress) {
                        zone.owner = 'enemy';
                        zone.captureProgress = zone.maxCaptureProgress;
                    }
                }
            } else if (playerCount > 0 && enemyCount > 0) {
                zone.captureProgress += playerProgress - enemyDecay;
                zone.isContested = true;
                if (zone.captureProgress <= 0) {
                    zone.captureProgress = 0;
                    zone.owner = null;
                    zone.capturingTeam = null;
                } else if (zone.captureProgress >= zone.maxCaptureProgress) {
                    zone.captureProgress = zone.maxCaptureProgress;
                    zone.owner = 'player';
                }
            } else if (playerCount === 0 && enemyCount === 0) {
                if (zone.owner === null) {
                    zone.captureProgress = Math.max(0, zone.captureProgress - 10 * dt);
                }
            }

            if (zone.owner === 'player' && enemyCount > 0) {
                zone.captureProgress -= enemyDecay;
                zone.isContested = true;
                if (zone.captureProgress <= 0) {
                    zone.owner = null;
                    zone.captureProgress = 0;
                    zone.capturingTeam = null;
                }
            }

            if (zone.owner === 'enemy' && playerCount > 0) {
                zone.captureProgress -= playerProgress;
                zone.isContested = true;
                if (zone.captureProgress <= 0) {
                    zone.owner = null;
                    zone.captureProgress = 0;
                    zone.capturingTeam = null;
                }
            }

            // 战报：区域占领状态变化
            if (prevOwner !== zone.owner) {
                if (zone.owner === 'player') {
                    this._addBattleReport({
                        type: 'capture',
                        text: `占领 ${zone.name || '战略节点'}`,
                        color: '#3b82f6'
                    });
                } else if (zone.owner === 'enemy') {
                    this._addBattleReport({
                        type: 'capture',
                        text: `${zone.name || '战略节点'} 失守`,
                        color: '#f59e0b'
                    });
                }
            }

            if (zone.owner === 'player') {
                this.resources.energy += zone.energyBonus * dt;
                this.resources.crystal += zone.crystalBonus * dt;
            } else if (zone.owner === 'enemy') {
                this.enemyResources.energy += zone.energyBonus * dt;
                this.enemyResources.crystal += zone.crystalBonus * dt;
            }
        }
    }

    _isInZone(unit, zone) {
        const dx = unit.x - zone.x;
        const dy = unit.y - zone.y;
        return Math.sqrt(dx * dx + dy * dy) <= zone.radius;
    }

    _createOutpost(x, y) {
        return {
            id: 'outpost_' + this.outposts.length,
            name: `前哨站 ${this.outposts.length + 1}`,
            x: x,
            y: y,
            hp: 200,
            maxHp: 200,
            size: 40,
            blockadeRadius: 100,
            isBlocked: false,
            blockadingUnits: [],
            visionRadius: 150
        };
    }

    buildOutpost(engineerUnit, targetX, targetY) {
        if (this.outposts.length >= 3) return false;
        if (this.resources.energy < 800 || this.resources.crystal < 300 || this.resources.supply < 50) return false;
        this.resources.energy -= 800;
        this.resources.crystal -= 300;
        this.resources.supply -= 50;
        engineerUnit.state = 'building';
        engineerUnit.buildTarget = { x: targetX, y: targetY };
        engineerUnit.buildTimer = 5;
        engineerUnit.targetX = targetX;
        engineerUnit.targetY = targetY;
        return true;
    }

    getOutposts() {
        return this.outposts;
    }

    blockadeZone(units, zoneOrOutpost) {
        zoneOrOutpost.isBlocked = true;
        zoneOrOutpost.blockadingUnits = units.map(u => u.id);
        for (const unit of units) {
            unit.state = 'blockading';
            unit.blockadeTarget = zoneOrOutpost;
        }
    }

    startArtilleryStrike(battleship, targetX, targetY) {
        if (battleship.type !== 'battleship') return false;
        if (battleship.artilleryCooldown > 0) return false;

        const strike = {
            id: 'artillery_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            sourceUnit: battleship,
            targetX: targetX,
            targetY: targetY,
            radius: battleship.artilleryRadius || 50,
            damage: battleship.artilleryDamage || 20,
            rounds: battleship.artilleryRounds || 2,
            currentRound: 0,
            interval: battleship.artilleryInterval || 3,
            timer: 0,
            phase: 'warning',
            finished: false
        };

        this.artilleryStrikes.push(strike);

        this.artilleryWarnings.push({
            id: strike.id,
            x: targetX,
            y: targetY,
            radius: strike.radius,
            timer: 0,
            duration: strike.interval * strike.rounds
        });

        battleship.artilleryCooldown = battleship.artilleryMaxCooldown || 10;
        battleship.state = 'bombarding';
        battleship._prevBombardState = 'idle';

        return true;
    }

    _updateArtilleryStrikes(dt) {
        for (let i = this.artilleryStrikes.length - 1; i >= 0; i--) {
            const strike = this.artilleryStrikes[i];
            strike.timer += dt;

            const nextStrikeTime = (strike.currentRound + 1) * strike.interval;

            if (strike.timer >= nextStrikeTime && strike.currentRound < strike.rounds) {
                strike.currentRound++;
                strike.phase = 'impact';

                const targets = this.enemyUnits.filter(u => {
                    if (u.hp <= 0) return false;
                    const dx = u.x - strike.targetX;
                    const dy = u.y - strike.targetY;
                    return Math.sqrt(dx * dx + dy * dy) <= strike.radius;
                });

                for (const target of targets) {
                    this._applyDamage(target, strike.damage, 'artillery', strike.sourceUnit, 'artillery');
                }

                strike.impactTimer = 0;
            }

            if (strike.phase === 'impact') {
                strike.impactTimer = (strike.impactTimer || 0) + dt;
                if (strike.impactTimer >= 0.5) {
                    strike.phase = 'warning';
                }
            }

            if (strike.currentRound >= strike.rounds && strike.timer >= strike.rounds * strike.interval + 0.5) {
                strike.finished = true;
                if (strike.sourceUnit && strike.sourceUnit.state === 'bombarding') {
                    strike.sourceUnit.state = strike.sourceUnit._prevBombardState || 'idle';
                    delete strike.sourceUnit._prevBombardState;
                }
                this.artilleryStrikes.splice(i, 1);
            }
        }

        for (let i = this.artilleryWarnings.length - 1; i >= 0; i--) {
            const warning = this.artilleryWarnings[i];
            warning.timer += dt;
            if (warning.timer >= warning.duration + 0.5) {
                this.artilleryWarnings.splice(i, 1);
            }
        }
    }

    _updateBlockades(dt) {
        const allBlockadables = [...this.controlZones, ...this.outposts];
        const allUnits = this._getAllUnitsList();
        for (const zone of allBlockadables) {
            if (!zone.isBlocked) continue;
            if (!zone.blockadingUnits || zone.blockadingUnits.length === 0) {
                zone.isBlocked = false;
                zone.blockadingUnits = [];
                continue;
            }
            const activeBlockaders = zone.blockadingUnits.filter(uid => {
                const unit = allUnits.find(u => u.id === uid);
                if (!unit || unit.hp <= 0) return false;
                if (unit.state === 'blockading') return true;
                return false;
            });
            if (activeBlockaders.length === 0) {
                zone.isBlocked = false;
                zone.blockadingUnits = [];
            } else {
                zone.blockadingUnits = activeBlockaders;
            }
        }
    }

    _findNearbyEnemy(unit) {
        let nearest = null;
        let nearestDist = unit.attackRange * 1.5;
        for (const enemy of this.enemyUnits) {
            if (enemy.hp <= 0) continue;
            const dx = enemy.x - unit.x;
            const dy = enemy.y - unit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        }
        return nearest;
    }

    _findNearbyPlayer(enemy) {
        let nearest = null;
        let nearestDist = enemy.attackRange * 1.5;
        for (const unit of this.units) {
            if (unit.hp <= 0) continue;
            const dx = unit.x - enemy.x;
            const dy = unit.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = unit;
            }
        }
        return nearest;
    }

    _checkGameOver() {
        if (this.base.hp <= 0) {
            this.gameOver = true;
            this.winner = 'enemy';
            if (this.onGameOver) this.onGameOver('enemy');
        } else if (this.enemyBase.hp <= 0) {
            this.gameOver = true;
            this.winner = 'player';
            if (this.onGameOver) this.onGameOver('player');
        }
    }

    /**
     * 检查是否处于战斗状态
     * @returns {boolean} 是否有单位正在战斗
     */
    checkCombatStatus() {
        // 检查玩家单位是否处于攻击状态
        for (const unit of this.units) {
            if (unit.hp <= 0) continue;
            if (unit.state === 'attack' || unit.state === 'attack_base') {
                return true;
            }
        }

        // 检查敌方单位是否处于攻击状态
        for (const enemy of this.enemyUnits) {
            if (enemy.hp <= 0) continue;
            if (enemy.state === 'attack' || enemy.state === 'attack_base') {
                return true;
            }
        }

        // 检查是否有炮火打击正在进行
        if (this.artilleryStrikes && this.artilleryStrikes.length > 0) {
            return true;
        }

        return false;
    }

    getVisibleAreas() {
        return this._cachedVisibleAreas || [];
    }

    _computeVisibleAreas() {
        const areas = [];
        const myBase = this._getMyBase();
        const myUnits = this._getMyUnits();

        if (myBase && myBase.hp > 0) {
            areas.push({
                x: myBase.x,
                y: myBase.y,
                radius: myBase.visionRadius || 150
            });
        }
        for (const unit of myUnits) {
            if (unit.hp > 0) {
                areas.push({
                    x: unit.x,
                    y: unit.y,
                    radius: unit.visionRadius || 50
                });
            }
        }
        for (const outpost of this.outposts) {
            if (outpost.hp > 0) {
                const isMyOutpost = (this._getMyTeam() === 'player') ||
                    this.controlZones.some(z => z.id === outpost.id && z.owner === this._getMyTeam());
                if (isMyOutpost) {
                    areas.push({
                        x: outpost.x,
                        y: outpost.y,
                        radius: outpost.visionRadius || 150
                    });
                }
            }
        }

        for (const beacon of this.resourceBeacons) {
            areas.push({
                x: beacon.x,
                y: beacon.y,
                radius: beacon.visionRadius || 100
            });
        }

        return areas;
    }

    isVisible(x, y) {
        const areas = this.getVisibleAreas();
        for (const area of areas) {
            const dx = x - area.x;
            const dy = y - area.y;
            if (dx * dx + dy * dy <= area.radius * area.radius) {
                return true;
            }
        }
        return false;
    }

    getMinimapUnits() {
        const all = [
            ...this.units.filter(u => u.hp > 0).map(u => ({ x: u.x, y: u.y, team: u.team, type: u.type })),
            ...this.enemyUnits.filter(e => e.hp > 0 && this.isVisible(e.x, e.y)).map(e => ({ x: e.x, y: e.y, team: e.team, type: e.type }))
        ];
        if (this.base && this.base.hp > 0) {
            all.push({ x: this.base.x, y: this.base.y, team: 'base', type: 'base' });
        }
        if (this.enemyBase && this.enemyBase.hp > 0 && this.isVisible(this.enemyBase.x, this.enemyBase.y)) {
            all.push({ x: this.enemyBase.x, y: this.enemyBase.y, team: 'enemyBase', type: 'base' });
        }
        return all;
    }

    getMinimapZones() {
        return this.controlZones.map(z => ({
            x: z.x,
            y: z.y,
            owner: z.owner,
            captureProgress: z.captureProgress
        }));
    }

    getAllUnits() {
        return [...this.units, ...this.enemyUnits];
    }

    getParticles() {
        return this.particles;
    }

    getControlZones() {
        return this.controlZones;
    }

    getArtilleryStrikes() {
        return this.artilleryStrikes;
    }

    getArtilleryWarnings() {
        return this.artilleryWarnings;
    }

    /**
     * 计算编队动力协调航速
     * 公式：(战舰数量×战舰航速 + 战机数量×战机航速) / (战舰数量 + 战机数量)
     * @param {Array} units - 编队中的单位数组
     * @returns {number|null} 协调航速，无战机则返回 null
     */
    _calculateCoordinatedSpeed(units) {
        const battleships = units.filter(u => u.type === 'battleship');
        const fighters = units.filter(u => u.type === 'fighter');
        if (fighters.length === 0) return null;
        const totalSpeed = battleships.reduce((sum, u) => sum + u.speed, 0) +
                           fighters.reduce((sum, u) => sum + u.speed, 0);
        return totalSpeed / units.length;
    }

    /**
     * 查找单位所属巡逻任务组
     * @param {string} unitId - 单位ID
     * @returns {Object|null} 任务组
     */
    _findPatrolTaskGroup(unitId) {
        for (const group of this.patrolTaskGroups) {
            if (group.units.some(u => u.unitId === unitId)) {
                return group;
            }
        }
        return null;
    }

    /**
     * 获取单位实际巡逻航速（应用动力协调）
     * @param {Object} unit - 单位
     * @returns {number} 实际航速
     */
    _getUnitPatrolSpeed(unit) {
        if (unit.state !== 'patrol' && unit.state !== 'reroute' && unit.state !== 'waiting' && unit.state !== 'waiting_patrol') {
            return unit.speed;
        }
        const taskGroup = this._findPatrolTaskGroup(unit.id);
        if (taskGroup && taskGroup.hasFighter) {
            return taskGroup.coordinatedSpeed;
        }
        return unit.speed;
    }

    /**
     * 查找单位在巡逻任务组中的任务条目
     * @param {string} unitId - 单位ID
     * @returns {Object|null} 巡逻任务条目（含 _group 引用）
     */
    _findPatrolUnitTask(unitId) {
        for (const group of this.patrolTaskGroups) {
            const task = group.units.find(t => t.unitId === unitId);
            if (task) {
                task._group = group;
                return task;
            }
        }
        return null;
    }

    /**
     * 添加单位到巡逻队列
     * @param {Object} unit - 要巡逻的单位
     * @param {Array} waypoints - 巡逻路径点数组 [{x, y}, ...]
     */
    addToPatrolQueue(units, waypoints) {
        const unitArray = Array.isArray(units) ? units : [units];
        // 工程船无法执行巡逻任务
        const validUnits = unitArray.filter(u => u && u.hp > 0 && u.type !== 'engineer');
        if (validUnits.length === 0 || !waypoints || waypoints.length < 2) return;

        // 生成圆角矩形巡逻路径（以起点终点连线为中心线，两侧偏移40单位）
        const roundedRectPath = this._generateRoundedRectPatrolPath(waypoints[0], waypoints[1], 40);

        // 计算动力协调航速
        const coordinatedSpeed = this._calculateCoordinatedSpeed(validUnits);
        const hasFighter = validUnits.some(u => u.type === 'fighter');

        // 创建巡逻任务组
        this._patrolTaskIdCounter++;
        const taskGroup = {
            taskId: 'patrol_' + this._patrolTaskIdCounter,
            units: validUnits.map(unit => {
                const firstPoint = roundedRectPath[0];
                const dx = firstPoint.x - unit.x;
                const dy = firstPoint.y - unit.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                return {
                    unitId: unit.id,
                    unit: unit,
                    currentIndex: 0,
                    priority: distance,
                    status: 'waiting'
                };
            }),
            waypoints: roundedRectPath,
            originalPoints: waypoints,
            coordinatedSpeed: coordinatedSpeed,
            hasFighter: hasFighter,
            entryTimer: 0,
            entryIndex: 0,
            waitingArea: {
                enabled: false,
                centerX: 0,
                centerY: 0,
                radius: 25,
                units: []
            },
            activePatrolCount: validUnits.length
        };

        // 按优先级排序单位（距离近的优先）
        taskGroup.units.sort((a, b) => a.priority - b.priority);

        // 设置单位状态为 waiting
        for (const task of taskGroup.units) {
            task.unit.state = 'waiting';
        }

        // 添加到任务组列表
        this.patrolTaskGroups.push(taskGroup);
    }

    /**
     * 设置编队等待区参数
     * @param {number} groupIndex - 编队索引
     * @param {number} centerX - 等待区中心X坐标
     * @param {number} centerY - 等待区中心Y坐标
     * @param {number} radius - 等待区半径（默认25）
     * @returns {boolean} 是否设置成功
     */
    setWaitingArea(groupIndex, centerX, centerY, radius = 25) {
        if (groupIndex < 0 || groupIndex >= this.patrolTaskGroups.length) return false;
        if (typeof centerX !== 'number' || typeof centerY !== 'number') return false;
        if (typeof radius !== 'number' || radius <= 0) return false;

        const group = this.patrolTaskGroups[groupIndex];
        group.waitingArea.enabled = true;
        group.waitingArea.centerX = centerX;
        group.waitingArea.centerY = centerY;
        group.waitingArea.radius = radius;
        return true;
    }

    /**
     * 将编队中的单位分配到巡逻和等待区
     * @param {number} groupIndex - 编队索引
     * @param {number} patrolCount - 参与巡逻的单位数量
     * @returns {boolean} 是否分配成功
     */
    assignUnitsToWaitingArea(groupIndex, patrolCount) {
        if (groupIndex < 0 || groupIndex >= this.patrolTaskGroups.length) return false;
        if (typeof patrolCount !== 'number' || patrolCount < 0) return false;

        const group = this.patrolTaskGroups[groupIndex];
        const allTasks = group.units.filter(t => t.status !== 'failed');
        const patrolNum = Math.min(patrolCount, allTasks.length);

        // 重置所有单位状态为 waiting，清空等待区
        for (const task of allTasks) {
            task.status = 'waiting';
            task.unit.state = 'waiting';
        }
        group.waitingArea.units = [];

        // 按优先级排序，距离近的优先巡逻
        allTasks.sort((a, b) => a.priority - b.priority);

        // 前 patrolNum 个单位参与巡逻
        for (let i = 0; i < patrolNum; i++) {
            allTasks[i].status = 'waiting';
            allTasks[i].unit.state = 'waiting';
        }

        // 剩余单位放入等待区
        for (let i = patrolNum; i < allTasks.length; i++) {
            allTasks[i].status = 'waiting_patrol';
            allTasks[i].unit.state = 'waiting_patrol';
            group.waitingArea.units.push(allTasks[i].unit);
        }

        group.activePatrolCount = patrolNum;
        return true;
    }

    /**
     * 解散指定编队
     * @param {number} groupIndex - 编队索引
     * @returns {boolean} 是否解散成功
     */
    disbandPatrolGroup(groupIndex) {
        if (groupIndex < 0 || groupIndex >= this.patrolTaskGroups.length) return false;

        const group = this.patrolTaskGroups[groupIndex];

        // 将所有单位状态设为 idle
        for (const task of group.units) {
            const unit = task.unit;
            if (unit) {
                unit.state = 'idle';
                unit.targetX = null;
                unit.targetY = null;
                unit.patrolPoints = [];
                unit.patrolIndex = 0;
            }
            task.status = 'completed';
        }

        // 清空等待区单位引用
        if (group.waitingArea) {
            group.waitingArea.units = [];
        }

        // 从任务组列表中移除
        this.patrolTaskGroups.splice(groupIndex, 1);
        return true;
    }

    /**
     * 处理巡逻队列（支持多任务组）
     * @param {number} dt - 时间增量
     */
    processPatrolQueue(dt) {
        // 清理无效单位并标记状态
        for (const group of this.patrolTaskGroups) {
            for (const task of group.units) {
                const unit = task.unit;
                if (!unit || unit.hp <= 0) {
                    task.status = 'failed';
                } else if (task.status === 'patrolling') {
                    // 实时检测：单位状态被外部改为非巡逻状态时，标记任务完成
                    if (unit.state !== 'patrol') {
                        task.status = 'completed';
                    }
                } else if (task.status === 'waiting') {
                    // waiting 状态的单位如果被外部改变状态，也标记完成
                    if (unit.state !== 'patrol' && unit.state !== 'waiting') {
                        task.status = 'completed';
                    }
                } else if (task.status === 'waiting_patrol') {
                    // waiting_patrol 状态的单位如果被外部改变状态，也标记完成
                    if (unit.state !== 'waiting_patrol') {
                        task.status = 'completed';
                    }
                }
            }
        }

        // 检测巡逻单位损失并从等待区补充
        for (const group of this.patrolTaskGroups) {
            const patrolTasks = group.units.filter(t => t.status === 'patrolling');
            let lostCount = 0;
            for (const task of patrolTasks) {
                const unit = task.unit;
                if (!unit || unit.hp <= 0 || unit.state !== 'patrol') {
                    task.status = 'failed';
                    lostCount++;
                }
            }

            if (lostCount > 0 && group.waitingArea && group.waitingArea.enabled && group.waitingArea.units.length > 0) {
                // 从等待区随机抽取单位补充
                const need = Math.min(lostCount, group.waitingArea.units.length);
                for (let i = 0; i < need; i++) {
                    const randomIdx = Math.floor(Math.random() * group.waitingArea.units.length);
                    const replacementUnit = group.waitingArea.units.splice(randomIdx, 1)[0];
                    const task = group.units.find(t => t.unitId === replacementUnit.id);
                    if (task) {
                        task.status = 'waiting';
                        task.unit.state = 'waiting';
                    }
                }
                // 重新计算动力协调航速
                const activePatrolUnits = group.units
                    .filter(t => t.status === 'waiting' || t.status === 'patrolling')
                    .map(t => t.unit)
                    .filter(u => u && u.hp > 0);
                group.coordinatedSpeed = this._calculateCoordinatedSpeed(activePatrolUnits);
                group.activePatrolCount = activePatrolUnits.length;
            }
        }

        // 移除已完成或失败的任务组（所有单位都完成或失败）
        this.patrolTaskGroups = this.patrolTaskGroups.filter(group => {
            const allDone = group.units.every(task =>
                task.status === 'completed' || task.status === 'failed'
            );
            return !allDone;
        });

        // 处理每个任务组的单位进入
        for (const group of this.patrolTaskGroups) {
            const waitingUnits = group.units.filter(t => t.status === 'waiting');
            if (waitingUnits.length === 0) continue;

            const pathLength = this._calculatePatrolPathLength(group.waypoints);
            const activeUnits = group.units.filter(t => t.status !== 'failed');
            const entryInterval = Math.max(1.5, pathLength / Math.max(1, activeUnits.length) / 60);

            group.entryTimer += dt;

            // 每次从 waiting 单位中选择距离最近的优先进入
            while (waitingUnits.length > 0) {
                if (group.entryTimer < entryInterval) break;

                // 按优先级排序（距离近的优先）
                waitingUnits.sort((a, b) => a.priority - b.priority);
                const task = waitingUnits.shift();

                task.status = 'patrolling';
                const unit = task.unit;
                unit.patrolPoints = group.waypoints;
                unit.patrolIndex = 0;
                unit.targetX = group.waypoints[0].x;
                unit.targetY = group.waypoints[0].y;
                unit.state = 'patrol';

                group.entryTimer = 0;
            }
        }
    }

    /**
     * 计算巡逻路径总长度
     * @param {Array} waypoints - 路径点数组
     * @returns {number} 路径总长度
     */
    _calculatePatrolPathLength(waypoints) {
        if (!waypoints || waypoints.length < 2) return 0;
        let length = 0;
        for (let i = 1; i < waypoints.length; i++) {
            const dx = waypoints[i].x - waypoints[i - 1].x;
            const dy = waypoints[i].y - waypoints[i - 1].y;
            length += Math.sqrt(dx * dx + dy * dy);
        }
        // 加上回到起点的距离（环形路径）
        const dx = waypoints[0].x - waypoints[waypoints.length - 1].x;
        const dy = waypoints[0].y - waypoints[waypoints.length - 1].y;
        length += Math.sqrt(dx * dx + dy * dy);
        return length;
    }

    /**
     * 获取下一个巡逻点
     * @param {Object} task - 巡逻任务对象
     * @returns {Object} 下一个巡逻点 {x, y}
     */
    _getNextPatrolPoint(task) {
        const waypoints = task.waypoints || (task._group && task._group.waypoints);
        if (!task || !waypoints || waypoints.length === 0) {
            return null;
        }

        // 实现环形巡逻路线逻辑
        task.currentIndex = (task.currentIndex + 1) % waypoints.length;

        // 同步更新单位的 patrolIndex，确保攻击恢复后使用正确的索引
        if (task.unit) {
            task.unit.patrolIndex = task.currentIndex;
        }

        // 返回下一个巡逻点
        return waypoints[task.currentIndex];
    }

    /**
     * 生成圆角矩形巡逻路径
     * 以起点和终点的连线为中心线，向两侧偏移指定距离形成圆角矩形路径
     * @param {Object} startPoint - 起点 {x, y}
     * @param {Object} endPoint - 终点 {x, y}
     * @param {number} offset - 两侧偏移距离（默认10）
     * @returns {Array} 巡逻路径点数组 [{x, y}, ...]
     */
    _generateRoundedRectPatrolPath(startPoint, endPoint, offset = 10) {
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const angle = Math.atan2(dy, dx);
        const perpAngle = angle + Math.PI / 2;

        // 计算垂直于起点-终点连线的偏移方向
        const cosPerp = Math.cos(perpAngle);
        const sinPerp = Math.sin(perpAngle);

        // 起点两侧偏移点（垂直于连线）
        const startOffset1 = {
            x: startPoint.x + cosPerp * offset,
            y: startPoint.y + sinPerp * offset
        };
        const startOffset2 = {
            x: startPoint.x - cosPerp * offset,
            y: startPoint.y - sinPerp * offset
        };

        // 终点两侧偏移点（垂直于连线）
        const endOffset1 = {
            x: endPoint.x + cosPerp * offset,
            y: endPoint.y + sinPerp * offset
        };
        const endOffset2 = {
            x: endPoint.x - cosPerp * offset,
            y: endPoint.y - sinPerp * offset
        };

        // 矩形路径：startOffset1 → endOffset1 → endOffset2 → startOffset2 → 回到 startOffset1
        // 这样形成一个真正的矩形，长边平行于起点-终点连线，短边垂直于连线
        return [
            startOffset1,
            endOffset1,
            endOffset2,
            startOffset2
        ];
    }

    /**
     * 从巡逻队列中移除单位
     * @param {Object} unit - 要移除的单位
     */
    removeFromPatrolQueue(unit) {
        if (!unit) return;

        for (const group of this.patrolTaskGroups) {
            const idx = group.units.findIndex(u => u.unitId === unit.id);
            if (idx !== -1) {
                group.units[idx].status = 'failed';
                break;
            }
        }

        // 清理单位巡逻状态
        unit.patrolPoints = [];
        unit.patrolIndex = 0;
        if (unit.state === 'patrol' || unit.state === 'waiting') {
            unit.state = 'idle';
            unit.targetX = null;
            unit.targetY = null;
        }
    }

    /**
     * 标记巡逻任务失败并从队列中移除
     * @param {Object} unit - 巡逻失败的单位
     */
    _failPatrolTask(unit) {
        if (!unit) return;

        for (const group of this.patrolTaskGroups) {
            const idx = group.units.findIndex(u => u.unitId === unit.id);
            if (idx !== -1) {
                const task = group.units[idx];
                task.status = 'failed';
                break;
            }
        }

        // 重置单位状态
        unit.state = 'idle';
        unit.targetX = null;
        unit.targetY = null;
        unit.patrolPoints = [];
        unit.patrolIndex = 0;
    }

    /**
     * 获取巡逻队列状态
     * @returns {Object} 巡逻队列状态信息
     */
    getPatrolQueueStatus() {
        return {
            groupCount: this.patrolTaskGroups.length,
            groups: this.patrolTaskGroups.map(group => ({
                taskId: group.taskId,
                unitCount: group.units.length,
                hasFighter: group.hasFighter,
                coordinatedSpeed: group.coordinatedSpeed,
                units: group.units.map(task => ({
                    unitId: task.unitId,
                    status: task.status,
                    priority: task.priority,
                    currentIndex: task.currentIndex
                }))
            }))
        };
    }

    /**
     * 获取单位的子状态列表（用于 HUD 渲染）
     * @param {string} unitId - 单位ID
     * @returns {string[]} 子状态数组，如 ['powerCoordination', 'reroute']
     */
    getUnitSubStates(unitId) {
        const subStates = [];
        const unit = this.units.find(u => u.id === unitId) || this.enemyUnits.find(u => u.id === unitId);
        if (!unit) return subStates;

        if (unit.state === 'reroute') {
            subStates.push('reroute');
        }

        if (unit.state === 'patrol' || unit.state === 'reroute' || unit.state === 'waiting' || unit.state === 'waiting_patrol') {
            const group = this._findPatrolTaskGroup(unitId);
            if (group && group.hasFighter) {
                subStates.push('powerCoordination');
            }
        }

        return subStates;
    }

    reset() {
        this.units = [];
        this.enemyUnits = [];
        this.selectedUnits = [];
        this.selectedEnemy = null;
        this.controlZones = [];
        this.asteroidBelts = [];
        this.outposts = [];
        this.resourceBeacons = [];
        this.particles = [];
        this.gameOver = false;
        this.winner = null;
        this.gameTime = 0;
        this.artilleryStrikes = [];
        this.artilleryWarnings = [];

        // 巡逻任务组系统
        this.patrolTaskGroups = [];
        this._patrolTaskIdCounter = 0;

        this.stats = {
            playerKills: 0,
            enemyKills: 0,
            playerUnitsLost: 0,
            enemyUnitsLost: 0
        };
        this.resources = {
            energy: 1000,
            crystal: 500,
            supply: 200,
            population: 0,
            popCap: 50,
            proximaCoin: 0
        };
        this.camera = { x: 0, y: 0, zoom: 1.0, minZoom: 0.5, maxZoom: 2.0 };
        this.init(this.canvasWidth, this.canvasHeight);
    }

    /**
     * 序列化游戏状态（用于网络同步）
     * @returns {Object} 游戏状态对象
     */
    serializeState() {
        return {
            units: this.units.map(u => ({
                id: u.id,
                type: u.type,
                x: u.x,
                y: u.y,
                hp: u.hp,
                maxHp: u.maxHp,
                shield: u.shield,
                maxShield: u.maxShield,
                state: u.state,
                angle: u.angle,
                targetX: u.targetX,
                targetY: u.targetY,
                targetUnitId: u.targetUnit ? u.targetUnit.id : null,
                attackCooldown: u.attackCooldown,
                size: u.size
            })),
            enemyUnits: this.enemyUnits.map(u => ({
                id: u.id,
                type: u.type,
                x: u.x,
                y: u.y,
                hp: u.hp,
                maxHp: u.maxHp,
                shield: u.shield,
                maxShield: u.maxShield,
                state: u.state,
                angle: u.angle,
                targetX: u.targetX,
                targetY: u.targetY,
                targetUnitId: u.targetUnit ? u.targetUnit.id : null,
                attackCooldown: u.attackCooldown,
                size: u.size
            })),
            baseHp: this.base ? this.base.hp : 0,
            enemyBaseHp: this.enemyBase ? this.enemyBase.hp : 0,
            outposts: this.outposts.map(o => ({
                id: o.id,
                x: o.x,
                y: o.y,
                hp: o.hp,
                maxHp: o.maxHp,
                isBlocked: o.isBlocked,
                blockadingUnits: o.blockadingUnits ? [...o.blockadingUnits] : []
            })),
            controlZones: this.controlZones.map(z => ({
                id: z.id,
                owner: z.owner,
                captureProgress: z.captureProgress,
                isBlocked: z.isBlocked,
                blockadingUnits: z.blockadingUnits ? [...z.blockadingUnits] : []
            })),
            resources: { ...this.resources },
            enemyResources: { ...this.enemyResources },
            gameTime: this.gameTime,
            stats: { ...this.stats },
            camera: { x: this.camera.x, y: this.camera.y, zoom: this.camera.zoom }
        };
    }

    /**
     * 从状态对象恢复游戏状态（用于网络同步）
     * @param {Object} state - 序列化后的状态对象
     */
    deserializeState(state) {
        if (!state) return;

        const flipPerspective = this.isMultiplayer && !this.isHost;

        const stateUnits = flipPerspective ? state.enemyUnits : state.units;
        const stateEnemyUnits = flipPerspective ? state.units : state.enemyUnits;

        if (stateUnits) {
            const newUnits = [];
            for (const su of stateUnits) {
                const unit = this.units.find(u => u.id === su.id);
                if (unit) {
                    unit.x = su.x;
                    unit.y = su.y;
                    unit.hp = su.hp;
                    if (su.maxHp) unit.maxHp = su.maxHp;
                    unit.shield = su.shield;
                    if (su.maxShield) unit.maxShield = su.maxShield;
                    unit.state = su.state;
                    unit.angle = su.angle !== undefined ? su.angle : unit.angle;
                    unit.targetX = su.targetX;
                    unit.targetY = su.targetY;
                    if (su.attackCooldown !== undefined) unit.attackCooldown = su.attackCooldown;
                    if (su.type) unit.type = su.type;
                    if (su.size) unit.size = su.size;
                    newUnits.push(unit);
                } else {
                    newUnits.push({
                        id: su.id,
                        type: su.type || 'fighter',
                        name: su.name || `单位 ${su.id}`,
                        x: su.x,
                        y: su.y,
                        hp: su.hp,
                        maxHp: su.maxHp || 80,
                        shield: su.shield,
                        maxShield: su.maxShield || 40,
                        attack: su.type === 'battleship' ? 25 : 12,
                        speed: su.type === 'battleship' ? 60 : 120,
                        attackRange: su.type === 'battleship' ? 90 : 60,
                        attackCooldown: su.attackCooldown || 0,
                        attackInterval: su.type === 'battleship' ? 1200 : 800,
                        team: 'player',
                        state: su.state || 'idle',
                        angle: su.angle || 0,
                        targetX: su.targetX,
                        targetY: su.targetY,
                        targetUnit: null,
                        patrolPoints: [],
                        patrolIndex: 0,
                        retreating: false,
                        size: su.size || (su.type === 'battleship' ? 32 : 24),
                        shieldRegenCooldown: 0,
                        lastAttackedTime: 0,
                        visionRadius: su.type === 'battleship' ? 100 : 50
                    });
                }
            }
            this.units = newUnits;
        }

        if (stateEnemyUnits) {
            const newEnemyUnits = [];
            for (const eu of stateEnemyUnits) {
                const unit = this.enemyUnits.find(u => u.id === eu.id);
                if (unit) {
                    unit.x = eu.x;
                    unit.y = eu.y;
                    unit.hp = eu.hp;
                    if (eu.maxHp) unit.maxHp = eu.maxHp;
                    unit.shield = eu.shield;
                    if (eu.maxShield) unit.maxShield = eu.maxShield;
                    unit.state = eu.state;
                    unit.angle = eu.angle !== undefined ? eu.angle : unit.angle;
                    unit.targetX = eu.targetX;
                    unit.targetY = eu.targetY;
                    if (eu.attackCooldown !== undefined) unit.attackCooldown = eu.attackCooldown;
                    if (eu.type) unit.type = eu.type;
                    if (eu.size) unit.size = eu.size;
                    newEnemyUnits.push(unit);
                } else {
                    newEnemyUnits.push({
                        id: eu.id,
                        type: eu.type || 'fighter',
                        name: eu.name || `敌方单位 ${eu.id}`,
                        x: eu.x,
                        y: eu.y,
                        hp: eu.hp,
                        maxHp: eu.maxHp || 80,
                        shield: eu.shield,
                        maxShield: eu.maxShield || 40,
                        attack: eu.type === 'battleship' ? 25 : 12,
                        speed: eu.type === 'battleship' ? 60 : 120,
                        attackRange: eu.type === 'battleship' ? 90 : 60,
                        attackCooldown: eu.attackCooldown || 0,
                        attackInterval: eu.type === 'battleship' ? 1200 : 800,
                        team: 'enemy',
                        state: eu.state || 'idle',
                        angle: eu.angle || 0,
                        targetX: eu.targetX,
                        targetY: eu.targetY,
                        targetUnit: null,
                        patrolPoints: [],
                        patrolIndex: 0,
                        retreating: false,
                        size: eu.size || (eu.type === 'battleship' ? 32 : 24),
                        shieldRegenCooldown: 0,
                        lastAttackedTime: 0,
                        visionRadius: eu.type === 'battleship' ? 100 : 50
                    });
                }
            }
            this.enemyUnits = newEnemyUnits;
        }

        const stateBaseHp = flipPerspective ? state.enemyBaseHp : state.baseHp;
        const stateEnemyBaseHp = flipPerspective ? state.baseHp : state.enemyBaseHp;
        if (this.base && stateBaseHp !== undefined) {
            this.base.hp = stateBaseHp;
        }
        if (this.enemyBase && stateEnemyBaseHp !== undefined) {
            this.enemyBase.hp = stateEnemyBaseHp;
        }

        if (state.outposts) {
            this.outposts = state.outposts.map(o => {
                const existing = this.outposts.find(eo => eo.id === o.id);
                return {
                    id: o.id,
                    name: existing ? existing.name : `前哨站`,
                    x: o.x,
                    y: o.y,
                    hp: o.hp,
                    maxHp: o.maxHp || 200,
                    size: 40,
                    blockadeRadius: 100,
                    isBlocked: o.isBlocked || false,
                    blockadingUnits: o.blockadingUnits || [],
                    visionRadius: 150
                };
            });
        }

        if (state.controlZones) {
            for (const sz of state.controlZones) {
                const zone = this.controlZones.find(z => z.id === sz.id);
                if (zone) {
                    zone.owner = sz.owner;
                    zone.captureProgress = sz.captureProgress;
                    zone.isBlocked = sz.isBlocked;
                    if (sz.blockadingUnits) zone.blockadingUnits = sz.blockadingUnits;
                }
            }
        }

        const stateResources = flipPerspective ? state.enemyResources : state.resources;
        const stateEnemyResources = flipPerspective ? state.resources : state.enemyResources;
        if (stateResources) {
            this.resources = { ...stateResources };
        }
        if (stateEnemyResources) {
            this.enemyResources = { ...stateEnemyResources };
        }

        if (state.gameTime !== undefined) {
            this.gameTime = state.gameTime;
        }
        if (state.stats) {
            this.stats = { ...state.stats };
        }

        if (state.camera && !this.isMultiplayer) {
            this.camera.x = state.camera.x !== undefined ? state.camera.x : this.camera.x;
            this.camera.y = state.camera.y !== undefined ? state.camera.y : this.camera.y;
            if (state.camera.zoom !== undefined) this.camera.zoom = state.camera.zoom;
        }

        if (this.onUpdate) this.onUpdate();
    }

    /**
     * 获取状态增量（用于增量同步）
     * @param {number} lastSyncTime - 上次同步时间戳
     * @returns {Object} 状态增量对象
     */
    getStateDelta(lastSyncTime) {
        const delta = {
            hasChanges: false,
            unitUpdates: [],
            enemyUnitUpdates: [],
            baseHp: null,
            enemyBaseHp: null,
            resources: null,
            enemyResources: null,
            gameTime: this.gameTime
        };

        // 检查单位变化（只发送位置和状态变化）
        for (const u of this.units) {
            const lastUpdate = u._lastSyncTime || 0;
            if (lastUpdate < lastSyncTime) {
                delta.unitUpdates.push({
                    id: u.id,
                    x: u.x,
                    y: u.y,
                    hp: u.hp,
                    shield: u.shield,
                    state: u.state,
                    angle: u.angle,
                    targetX: u.targetX,
                    targetY: u.targetY
                });
                u._lastSyncTime = Date.now();
                delta.hasChanges = true;
            }
        }

        // 检查敌方单位变化
        for (const u of this.enemyUnits) {
            const lastUpdate = u._lastSyncTime || 0;
            if (lastUpdate < lastSyncTime) {
                delta.enemyUnitUpdates.push({
                    id: u.id,
                    x: u.x,
                    y: u.y,
                    hp: u.hp,
                    shield: u.shield,
                    state: u.state,
                    angle: u.angle,
                    targetX: u.targetX,
                    targetY: u.targetY
                });
                u._lastSyncTime = Date.now();
                delta.hasChanges = true;
            }
        }

        // 基地血量变化
        if (this.base) {
            delta.baseHp = this.base.hp;
            delta.hasChanges = true;
        }
        if (this.enemyBase) {
            delta.enemyBaseHp = this.enemyBase.hp;
            delta.hasChanges = true;
        }

        // 资源变化
        delta.resources = { ...this.resources };
        delta.enemyResources = { ...this.enemyResources };
        delta.hasChanges = true;

        return delta;
    }

    /**
     * 应用状态增量（客户端接收）
     * @param {Object} delta - 状态增量对象
     */
    applyStateDelta(delta) {
        if (!delta) return;

        const flipPerspective = this.isMultiplayer && !this.isHost;

        const unitUpdates = flipPerspective ? delta.enemyUnitUpdates : delta.unitUpdates;
        const enemyUnitUpdates = flipPerspective ? delta.unitUpdates : delta.enemyUnitUpdates;

        if (unitUpdates) {
            for (const update of unitUpdates) {
                const unit = this.units.find(u => u.id === update.id);
                if (unit) {
                    const dx = update.x - unit.x;
                    const dy = update.y - unit.y;
                    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                        unit.x = update.x;
                        unit.y = update.y;
                    } else {
                        unit.x += dx * 0.3;
                        unit.y += dy * 0.3;
                    }
                    unit.hp = update.hp;
                    unit.shield = update.shield;
                    unit.state = update.state;
                    unit.angle = update.angle;
                    unit.targetX = update.targetX;
                    unit.targetY = update.targetY;
                }
            }
        }

        if (enemyUnitUpdates) {
            for (const update of enemyUnitUpdates) {
                const unit = this.enemyUnits.find(u => u.id === update.id);
                if (unit) {
                    const dx = update.x - unit.x;
                    const dy = update.y - unit.y;
                    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                        unit.x = update.x;
                        unit.y = update.y;
                    } else {
                        unit.x += dx * 0.3;
                        unit.y += dy * 0.3;
                    }
                    unit.hp = update.hp;
                    unit.shield = update.shield;
                    unit.state = update.state;
                    unit.angle = update.angle;
                    unit.targetX = update.targetX;
                    unit.targetY = update.targetY;
                }
            }
        }

        const deltaBaseHp = flipPerspective ? delta.enemyBaseHp : delta.baseHp;
        const deltaEnemyBaseHp = flipPerspective ? delta.baseHp : delta.enemyBaseHp;
        if (deltaBaseHp !== undefined && this.base) {
            this.base.hp = deltaBaseHp;
        }
        if (deltaEnemyBaseHp !== undefined && this.enemyBase) {
            this.enemyBase.hp = deltaEnemyBaseHp;
        }

        const deltaResources = flipPerspective ? delta.enemyResources : delta.resources;
        const deltaEnemyResources = flipPerspective ? delta.resources : delta.enemyResources;
        if (deltaResources) {
            this.resources = { ...deltaResources };
        }
        if (deltaEnemyResources) {
            this.enemyResources = { ...deltaEnemyResources };
        }

        if (delta.gameTime !== undefined) {
            this.gameTime = delta.gameTime;
        }

        if (this.onUpdate) this.onUpdate();
    }

    /**
     * 应用远程玩家输入（客户端发送给主机）
     * @param {Object} input - 远程输入对象
     */
    applyRemoteInput(input) {
        if (!input || !input.type) return;

        switch (input.type) {
            case 'move':
                if (input.unitIds && input.target) {
                    for (const id of input.unitIds) {
                        const unit = this.enemyUnits.find(u => u.id === id);
                        if (unit) {
                            this._applyCommand(unit, 'move', input.target);
                        }
                    }
                }
                break;
            case 'attack':
                if (input.unitIds && input.targetUnitId) {
                    const target = this.units.find(u => u.id === input.targetUnitId);
                    if (target) {
                        for (const id of input.unitIds) {
                            const unit = this.enemyUnits.find(u => u.id === id);
                            if (unit) {
                                this._applyCommand(unit, 'attack', { unit: target });
                            }
                        }
                    }
                }
                break;
            case 'attack_base':
                if (input.unitIds && this.base) {
                    for (const id of input.unitIds) {
                        const unit = this.enemyUnits.find(u => u.id === id);
                        if (unit) {
                            this._applyCommand(unit, 'attack_base', { base: this.base });
                        }
                    }
                }
                break;
            case 'stop':
                if (input.unitIds) {
                    for (const id of input.unitIds) {
                        const unit = this.enemyUnits.find(u => u.id === id);
                        if (unit) {
                            this._applyCommand(unit, 'stop', null);
                        }
                    }
                }
                break;
            case 'build':
                if (input.unitType) {
                    this._remoteBuildUnit(input.unitType);
                }
                break;
            case 'patrol':
                if (input.unitIds && input.points && input.points.length >= 2) {
                    const patrolUnits = [];
                    for (const id of input.unitIds) {
                        const unit = this.enemyUnits.find(u => u.id === id);
                        if (unit) {
                            patrolUnits.push(unit);
                        }
                    }
                    if (patrolUnits.length > 0) {
                        this.addToPatrolQueue(patrolUnits, input.points);
                    }
                }
                break;
            case 'retreat':
                if (input.unitIds) {
                    for (const id of input.unitIds) {
                        const unit = this.enemyUnits.find(u => u.id === id);
                        if (unit) {
                            this._applyCommand(unit, 'retreat', null);
                        }
                    }
                }
                break;
            case 'blockade':
                if (input.unitIds && input.targetId) {
                    const allBlockadables = [...this.controlZones, ...this.outposts];
                    const target = allBlockadables.find(z => z.id === input.targetId);
                    if (target) {
                        const blockadingUnits = [];
                        for (const id of input.unitIds) {
                            const unit = this.enemyUnits.find(u => u.id === id);
                            if (unit) blockadingUnits.push(unit);
                        }
                        if (blockadingUnits.length > 0) {
                            this.blockadeZone(blockadingUnits, target);
                        }
                    }
                }
                break;
            case 'artillery':
                if (input.unitIds && input.targetX !== undefined && input.targetY !== undefined) {
                    for (const id of input.unitIds) {
                        const unit = this.enemyUnits.find(u => u.id === id);
                        if (unit && unit.type === 'battleship') {
                            this.startArtilleryStrike(unit, input.targetX, input.targetY);
                        }
                    }
                }
                break;
            case 'collect':
                if (input.unitIds && input.beltId) {
                    const belt = this.asteroidBelts.find(b => b.id === input.beltId);
                    if (belt) {
                        for (const id of input.unitIds) {
                            const unit = this.enemyUnits.find(u => u.id === id);
                            if (unit && unit.type === 'engineer') {
                                this.collectBelt(unit, belt);
                            }
                        }
                    }
                }
                break;
            case 'build_outpost':
                if (input.unitIds && input.targetX !== undefined && input.targetY !== undefined) {
                    for (const id of input.unitIds) {
                        const unit = this.enemyUnits.find(u => u.id === id);
                        if (unit && unit.type === 'engineer') {
                            this.buildOutpost(unit, input.targetX, input.targetY);
                        }
                    }
                }
                break;
        }
    }

    /**
     * 远程建造单位（用于联机模式敌方）
     * @param {string} type - 单位类型
     */
    _remoteBuildUnit(type) {
        const costs = {
            fighter: { energy: 100, crystal: 50 },
            battleship: { energy: 200, crystal: 100 }
        };

        const cost = costs[type];
        if (!cost) return false;

        if (this.enemyResources.energy < cost.energy || this.enemyResources.crystal < cost.crystal) {
            return false;
        }
        if (this.enemyResources.population >= this.enemyResources.popCap) {
            return false;
        }

        this.enemyResources.energy -= cost.energy;
        this.enemyResources.crystal -= cost.crystal;

        const angle = Math.random() * Math.PI * 2;
        const distance = 80 + Math.random() * 60;
        const spawnX = this.enemyBase.x + Math.cos(angle) * distance;
        const spawnY = this.enemyBase.y + Math.sin(angle) * distance;

        const clampedX = Math.max(20, Math.min(this.worldWidth - 20, spawnX));
        const clampedY = Math.max(20, Math.min(this.worldHeight - 20, spawnY));

        const newId = this.units.length + this.enemyUnits.length + 1;
        const newUnit = this._createUnit(newId, clampedX, clampedY, 'enemy', type);
        this.enemyUnits.push(newUnit);
        this.enemyResources.population = this.enemyUnits.length;

        if (this.onUpdate) this.onUpdate();
        return true;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameCore;
}
