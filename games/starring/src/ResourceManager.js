/**
 * ResourceManager - 图片资源加载与管理器
 * 从picture文件夹读取并管理所需图片资源
 * 优化：使用 createImageBitmap 预加载到显存，添加资源缓存池
 */
class ResourceManager {
    constructor(basePath = 'picture') {
        this.basePath = basePath;
        this.resources = new Map();
        this.loadingPromises = new Map();
        this.bitmapCache = new Map(); // ImageBitmap 缓存池
        this.objectPool = new Map(); // 对象池用于复用
        this.preloadQueue = []; // 预加载队列
        this.isPreloading = false;
    }

    /**
     * 使用 createImageBitmap 将图片预加载到显存
     * @param {HTMLImageElement} img - 已加载的图片
     * @returns {Promise<ImageBitmap>}
     */
    async _createBitmap(img) {
        try {
            // 使用 createImageBitmap 创建 GPU 加速的位图
            const bitmap = await createImageBitmap(img, {
                premultiplyAlpha: 'premultiply',
                colorSpaceConversion: 'none'
            });
            return bitmap;
        } catch (e) {
            console.warn('[ResourceManager] createImageBitmap failed, falling back to Image:', e);
            return null;
        }
    }

    /**
     * 加载单张图片
     * @param {string} name - 资源名称
     * @param {string} filename - 图片文件名
     * @returns {Promise<HTMLImageElement>}
     */
    load(name, filename) {
        if (this.resources.has(name)) {
            return Promise.resolve(this.resources.get(name));
        }

        if (this.loadingPromises.has(name)) {
            return this.loadingPromises.get(name);
        }

        const promise = new Promise(async (resolve, reject) => {
            const img = new Image();
            img.onload = async () => {
                console.log(`[ResourceManager] Loaded: ${filename} (${img.width}x${img.height})`);
                this.resources.set(name, img);
                
                // 预创建 ImageBitmap 到显存
                const bitmap = await this._createBitmap(img);
                if (bitmap) {
                    this.bitmapCache.set(name, bitmap);
                }
                
                this.loadingPromises.delete(name);
                resolve(img);
            };
            img.onerror = (err) => {
                console.error(`[ResourceManager] Failed to load: ${filename} from ${img.src}`);
                this.loadingPromises.delete(name);
                resolve(null);
            };
            // 使用绝对路径或相对于当前页面的路径
            img.src = `${this.basePath}/${filename}?t=${Date.now()}`;
        });

        this.loadingPromises.set(name, promise);
        return promise;
    }

    /**
     * 批量预加载图片资源到内存
     * @param {Object} resourceMap - { name: filename }
     * @param {Function} onProgress - 进度回调 (loaded, total)
     * @returns {Promise<void>}
     */
    async preload(resourceMap, onProgress = null) {
        const entries = Object.entries(resourceMap);
        const total = entries.length;
        let loaded = 0;

        // 添加到预加载队列
        this.preloadQueue = entries.map(([name, filename]) => ({ name, filename }));
        this.isPreloading = true;

        await Promise.all(
            entries.map(async ([name, filename]) => {
                await this.load(name, filename);
                loaded++;
                if (onProgress) {
                    onProgress(loaded, total);
                }
            })
        );

        this.isPreloading = false;
        console.log(`[ResourceManager] Preloaded ${loaded}/${total} resources`);
    }

    /**
     * 获取已加载的图片
     * @param {string} name - 资源名称
     * @returns {HTMLImageElement|null}
     */
    get(name) {
        return this.resources.get(name) || null;
    }

    /**
     * 获取 ImageBitmap（用于 GPU 加速渲染）
     * @param {string} name - 资源名称
     * @returns {ImageBitmap|null}
     */
    getBitmap(name) {
        return this.bitmapCache.get(name) || null;
    }

    /**
     * 检查资源是否已加载
     * @param {string} name - 资源名称
     * @returns {boolean}
     */
    has(name) {
        return this.resources.has(name);
    }

    /**
     * 检查 ImageBitmap 是否已缓存
     * @param {string} name - 资源名称
     * @returns {boolean}
     */
    hasBitmap(name) {
        return this.bitmapCache.has(name);
    }

    /**
     * 从对象池获取对象
     * @param {string} type - 对象类型
     * @param {Function} factory - 工厂函数
     * @returns {Object}
     */
    acquireObject(type, factory) {
        if (!this.objectPool.has(type)) {
            this.objectPool.set(type, []);
        }
        const pool = this.objectPool.get(type);
        if (pool.length > 0) {
            return pool.pop();
        }
        return factory();
    }

    /**
     * 归还对象到对象池
     * @param {string} type - 对象类型
     * @param {Object} obj - 对象
     */
    releaseObject(type, obj) {
        if (!this.objectPool.has(type)) {
            this.objectPool.set(type, []);
        }
        const pool = this.objectPool.get(type);
        // 限制池大小，防止内存泄漏
        if (pool.length < 100) {
            pool.push(obj);
        }
    }

    /**
     * 清空对象池
     */
    clearObjectPool() {
        this.objectPool.clear();
    }

    /**
     * 释放不再使用的资源
     * @param {Array<string>} keepNames - 需要保留的资源名称列表
     */
    releaseUnused(keepNames = []) {
        const keepSet = new Set(keepNames);
        
        // 释放 ImageBitmap
        for (const [name, bitmap] of this.bitmapCache.entries()) {
            if (!keepSet.has(name)) {
                bitmap.close(); // 释放 GPU 内存
                this.bitmapCache.delete(name);
            }
        }
        
        // 释放 Image 资源
        for (const [name, img] of this.resources.entries()) {
            if (!keepSet.has(name)) {
                img.src = ''; // 帮助垃圾回收
                this.resources.delete(name);
            }
        }
        
        console.log(`[ResourceManager] Released unused resources, kept: ${keepNames.length}`);
    }

    /**
     * 创建纯色降级画布（当图片加载失败时使用）
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {string} color - 颜色
     * @returns {HTMLCanvasElement}
     */
    createFallback(width, height, color) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: false });
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, height);
        return canvas;
    }

    /**
     * 获取资源统计信息
     * @returns {Object}
     */
    getStats() {
        return {
            images: this.resources.size,
            bitmaps: this.bitmapCache.size,
            objectPools: Object.fromEntries(
                Array.from(this.objectPool.entries()).map(([k, v]) => [k, v.length])
            ),
            loading: this.loadingPromises.size,
            preloading: this.isPreloading
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResourceManager;
}
