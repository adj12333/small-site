/**
 * signaling-server.js - Node.js HTTP/HTTPS 信令服务器
 * 用于WebRTC P2P连接的SDP和ICE候选交换
 */

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HTTPS_PORT = 3444;
const ROOM_EXPIRY_TIME = 10 * 60 * 1000;
const CERT_DIR = path.join(__dirname, '..', 'cert');

// 内存存储
const rooms = new Map();

/**
 * 解析请求体
 */
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(err);
            }
        });
    });
}

/**
 * 发送JSON响应
 */
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data));
}

/**
 * 清理过期房间
 */
function cleanupExpiredRooms() {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [roomId, room] of rooms.entries()) {
        if (now - room.lastActivity > ROOM_EXPIRY_TIME) {
            rooms.delete(roomId);
            cleanedCount++;
        }
    }
    if (cleanedCount > 0) {
        console.log(`[信令服务器] 清理了 ${cleanedCount} 个过期房间`);
    }
}

// 定期清理过期房间（每5分钟）
setInterval(cleanupExpiredRooms, 5 * 60 * 1000);

async function handleSignalingRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    // 处理OPTIONS预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    try {
        // GET /rooms - 获取房间列表
        if (pathname === '/rooms' && req.method === 'GET') {
            const roomList = [];
            const now = Date.now();
            for (const [roomId, room] of rooms.entries()) {
                // 只返回有offer但没有answer的房间（等待加入的房间）
                if (room.offer && !room.answer) {
                    roomList.push({
                        roomId: roomId,
                        createdAt: room.createdAt,
                        age: Math.floor((now - room.createdAt) / 1000) // 房间存在时间（秒）
                    });
                }
            }
            // 按创建时间排序，最新的在前
            roomList.sort((a, b) => b.createdAt - a.createdAt);
            sendJSON(res, 200, { rooms: roomList });
            return;
        }

        // POST /offer - 存储offer SDP
        if (pathname === '/offer' && req.method === 'POST') {
            const body = await parseBody(req);
            const roomId = body.roomId;
            if (!roomId || !body.offer) {
                sendJSON(res, 400, { error: '缺少roomId或offer' });
                return;
            }
            const now = Date.now();
            if (!rooms.has(roomId)) {
                rooms.set(roomId, { 
                    offer: null, 
                    answer: null, 
                    candidates: [],
                    createdAt: now,
                    lastActivity: now
                });
            }
            const room = rooms.get(roomId);
            room.offer = body.offer;
            room.lastActivity = now;
            sendJSON(res, 200, { success: true });
            console.log(`[信令服务器] 房间 ${roomId} 已存储offer`);
            return;
        }

        // GET /offer - 获取offer SDP
        if (pathname === '/offer' && req.method === 'GET') {
            const roomId = query.roomId;
            if (!roomId || !rooms.has(roomId)) {
                sendJSON(res, 404, { error: '房间不存在' });
                return;
            }
            const room = rooms.get(roomId);
            if (!room.offer) {
                sendJSON(res, 404, { error: 'offer不存在' });
                return;
            }
            room.lastActivity = Date.now();
            sendJSON(res, 200, { offer: room.offer });
            return;
        }

        // POST /answer - 存储answer SDP
        if (pathname === '/answer' && req.method === 'POST') {
            const body = await parseBody(req);
            const roomId = body.roomId;
            if (!roomId || !body.answer) {
                sendJSON(res, 400, { error: '缺少roomId或answer' });
                return;
            }
            if (!rooms.has(roomId)) {
                sendJSON(res, 404, { error: '房间不存在' });
                return;
            }
            const room = rooms.get(roomId);
            room.answer = body.answer;
            room.lastActivity = Date.now();
            sendJSON(res, 200, { success: true });
            console.log(`[信令服务器] 房间 ${roomId} 已存储answer`);
            return;
        }

        // GET /answer - 获取answer SDP
        if (pathname === '/answer' && req.method === 'GET') {
            const roomId = query.roomId;
            if (!roomId || !rooms.has(roomId)) {
                sendJSON(res, 404, { error: '房间不存在' });
                return;
            }
            const room = rooms.get(roomId);
            if (!room.answer) {
                sendJSON(res, 404, { error: 'answer不存在' });
                return;
            }
            room.lastActivity = Date.now();
            sendJSON(res, 200, { answer: room.answer });
            return;
        }

        // POST /candidate - 存储ICE候选
        if (pathname === '/candidate' && req.method === 'POST') {
            const body = await parseBody(req);
            const roomId = body.roomId;
            if (!roomId || !body.candidate) {
                sendJSON(res, 400, { error: '缺少roomId或candidate' });
                return;
            }
            if (!rooms.has(roomId)) {
                sendJSON(res, 404, { error: '房间不存在' });
                return;
            }
            const room = rooms.get(roomId);
            room.candidates.push(body.candidate);
            room.lastActivity = Date.now();
            sendJSON(res, 200, { success: true });
            return;
        }

        // GET /candidate - 获取ICE候选（批量）
        if (pathname === '/candidate' && req.method === 'GET') {
            const roomId = query.roomId;
            if (!roomId || !rooms.has(roomId)) {
                sendJSON(res, 404, { error: '房间不存在' });
                return;
            }
            const room = rooms.get(roomId);
            // 批量返回候选（最多10个）
            const batchSize = Math.min(10, room.candidates.length);
            const candidates = room.candidates.splice(0, batchSize);
            room.lastActivity = Date.now();
            sendJSON(res, 200, { candidates, remaining: room.candidates.length });
            return;
        }

        // DELETE /room - 删除房间
        if (pathname === '/room' && req.method === 'DELETE') {
            const roomId = query.roomId;
            if (!roomId || !rooms.has(roomId)) {
                sendJSON(res, 404, { error: '房间不存在' });
                return;
            }
            rooms.delete(roomId);
            sendJSON(res, 200, { success: true });
            console.log(`[信令服务器] 房间 ${roomId} 已删除`);
            return;
        }

        // 未知路径
        sendJSON(res, 404, { error: '未找到接口' });
    } catch (err) {
        console.error('[信令服务器] 处理请求出错:', err);
        sendJSON(res, 500, { error: '服务器内部错误' });
    }
}

const server = http.createServer(handleSignalingRequest);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[信令服务器] HTTP 已启动，监听端口: ${PORT} (0.0.0.0)`);
    console.log(`[信令服务器] API列表:`);
    console.log(`  GET  /rooms   - 获取房间列表`);
    console.log(`  POST /offer   - 存储offer SDP`);
    console.log(`  GET  /offer   - 获取offer SDP`);
    console.log(`  POST /answer  - 存储answer SDP`);
    console.log(`  GET  /answer  - 获取answer SDP`);
    console.log(`  POST /candidate - 存储ICE候选`);
    console.log(`  GET  /candidate - 获取ICE候选（批量）`);
    console.log(`  DELETE /room  - 删除房间`);
});

const keyFile = path.join(CERT_DIR, 'server-key.pem');
const certFile = path.join(CERT_DIR, 'server-cert.pem');

if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
    try {
        const httpsOptions = {
            key: fs.readFileSync(keyFile),
            cert: fs.readFileSync(certFile)
        };
        const httpsServer = https.createServer(httpsOptions, handleSignalingRequest);
        httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
            console.log(`[信令服务器] HTTPS 已启动，监听端口: ${HTTPS_PORT} (0.0.0.0)`);
        });
    } catch (err) {
        console.error('[信令服务器] HTTPS 启动失败:', err.message);
    }
}
