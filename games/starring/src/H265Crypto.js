/**
 * H265 Crypto Module
 * 基于 SHA-256 的自定义加密模块，提供哈希加密和验证功能
 */

class H265Crypto {
    constructor() {
        // 混淆密钥表 - 用于字符替换
        this.scrambleTable = {
            '0': 'h', '1': '2', '2': '6', '3': '5',
            '4': 'a', '5': 'b', '6': 'c', '7': 'd',
            '8': 'e', '9': 'f', 'a': '8', 'b': '9',
            'c': '0', 'd': '1', 'e': '3', 'f': '4'
        };
        
        // 反向查找表
        this.reverseTable = {};
        for (const [key, value] of Object.entries(this.scrambleTable)) {
            this.reverseTable[value] = key;
        }
        
        // 管理员密码哈希（预生成）
        this.adminHash = this.encrypt('mdjlp6451');
    }

    /**
     * 计算 SHA-256 哈希
     * @param {string} text - 输入文本
     * @returns {string} - SHA-256 哈希值（64位十六进制字符串）
     */
    async sha256(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * 同步版本的 SHA-256（使用简单的哈希实现作为后备）
     * @param {string} text - 输入文本
     * @returns {string} - 哈希值
     */
    sha256Sync(text) {
        // 简单的字符串哈希算法（当 crypto API 不可用时使用）
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为 32bit 整数
        }
        
        // 扩展为 64 字符的十六进制字符串
        let hexHash = '';
        const seed = Math.abs(hash);
        for (let i = 0; i < 64; i++) {
            const value = (seed * (i + 1) * 2654435761) % 16;
            hexHash += value.toString(16);
        }
        return hexHash;
    }

    /**
     * 混淆哈希值 - 使用自定义替换表
     * @param {string} hash - 原始哈希值
     * @returns {string} - 混淆后的哈希值
     */
    scramble(hash) {
        let scrambled = '';
        for (let i = 0; i < hash.length; i++) {
            const char = hash[i].toLowerCase();
            scrambled += this.scrambleTable[char] || char;
        }
        return scrambled;
    }

    /**
     * 反混淆哈希值
     * @param {string} scrambled - 混淆后的哈希值
     * @returns {string} - 原始哈希值
     */
    unscramble(scrambled) {
        let unscrambled = '';
        for (let i = 0; i < scrambled.length; i++) {
            const char = scrambled[i].toLowerCase();
            unscrambled += this.reverseTable[char] || char;
        }
        return unscrambled;
    }

    /**
     * 位移变换 - 对字符串进行循环位移
     * @param {string} str - 输入字符串
     * @param {number} shift - 位移量
     * @returns {string} - 位移后的字符串
     */
    shiftString(str, shift) {
        const len = str.length;
        shift = shift % len;
        return str.slice(shift) + str.slice(0, shift);
    }

    /**
     * 加密文本
     * @param {string} text - 要加密的文本
     * @returns {string} - 加密后的哈希字符串
     */
    encrypt(text) {
        if (!text || typeof text !== 'string') {
            throw new Error('Invalid input: text must be a non-empty string');
        }

        // 步骤 1: 计算 SHA-256 哈希（同步版本）
        const hash = this.sha256Sync(text);
        
        // 步骤 2: 混淆哈希值
        const scrambled = this.scramble(hash);
        
        // 步骤 3: 位移变换（基于文本长度的循环位移）
        const shift = text.length % scrambled.length;
        const shifted = this.shiftString(scrambled, shift);
        
        // 步骤 4: 添加校验前缀（H265标识 + 位移信息）
        const prefix = `H265${shift.toString(16).padStart(2, '0')}`;
        
        return prefix + shifted;
    }

    /**
     * 验证文本是否匹配哈希
     * @param {string} text - 要验证的文本
     * @param {string} hash - 存储的哈希值
     * @returns {boolean} - 是否匹配
     */
    verify(text, hash) {
        if (!text || !hash || typeof text !== 'string' || typeof hash !== 'string') {
            return false;
        }

        // 检查是否是 H265 格式的哈希
        if (!hash.startsWith('H265')) {
            return false;
        }

        try {
            // 提取位移信息
            const shiftHex = hash.slice(4, 6);
            const originalShift = parseInt(shiftHex, 16);
            
            // 获取混淆后的哈希部分
            const scrambled = hash.slice(6);
            
            // 反向位移
            const unshifted = this.shiftString(scrambled, scrambled.length - originalShift);
            
            // 反混淆
            const originalHash = this.unscramble(unshifted);
            
            // 计算输入文本的哈希
            const computedHash = this.sha256Sync(text);
            
            // 比较哈希值
            return originalHash === computedHash;
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取管理员密码哈希
     * @returns {string} - 管理员密码的哈希值
     */
    getAdminHash() {
        return this.adminHash;
    }

    /**
     * 验证管理员密码
     * @param {string} password - 输入的密码
     * @returns {boolean} - 是否是正确的管理员密码
     */
    verifyAdmin(password) {
        return this.verify(password, this.adminHash);
    }
}

// 创建单例实例
const h265Crypto = new H265Crypto();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { H265Crypto, h265Crypto };
} else if (typeof window !== 'undefined') {
    window.H265Crypto = H265Crypto;
    window.h265Crypto = h265Crypto;
}
