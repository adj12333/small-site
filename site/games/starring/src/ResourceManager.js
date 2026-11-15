/**
 * ResourceManager - 图片资源加载与管理器
 * 从 picture 文件夹读取并管理所需图片资源
 */
class ResourceManager {
    constructor(basePath = 'picture') {
        this.basePath = basePath;
        this.resources = new Map();
        this.loadingPromises = new Map();
        this.isPreloading = false;
    }

    /**
     * 加载单张图片
     * @param {string} name - 资源名称
     * @param {string} filename - 图片文件名
     * @returns {Promise<HTMLImageElement|null>}
     */
    load(name, filename) {
        if (this.resources.has(name)) {
            return Promise.resolve(this.resources.get(name));
        }
        if (this.loadingPromises.has(name)) {
            return this.loadingPromises.get(name);
        }

        const promise = new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                console.log(`[ResourceManager] Loaded: ${filename} (${img.width}x${img.height})`);
                this.resources.set(name, img);
                this.loadingPromises.delete(name);
                resolve(img);
            };
            img.onerror = () => {
                console.error(`[ResourceManager] Failed to load: ${filename} from ${img.src}`);
                this.loadingPromises.delete(name);
                resolve(null);
            };
            img.src = `${this.basePath}/${filename}`;
        });

        this.loadingPromises.set(name, promise);
        return promise;
    }

    /**
     * 批量预加载图片资源
     * @param {Object} resourceMap - { name: filename }
     * @param {Function} onProgress - 进度回调 (loaded, total)
     * @returns {Promise<void>}
     */
    async preload(resourceMap, onProgress = null) {
        const entries = Object.entries(resourceMap);
        const total = entries.length;
        let loaded = 0;

        this.isPreloading = true;
        await Promise.all(
            entries.map(async ([name, filename]) => {
                await this.load(name, filename);
                loaded++;
                if (onProgress) onProgress(loaded, total);
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
     * 检查资源是否已加载
     * @param {string} name - 资源名称
     * @returns {boolean}
     */
    has(name) {
        return this.resources.has(name);
    }

    /**
     * 释放不再使用的资源
     * @param {Array<string>} keepNames - 需要保留的资源名称列表
     */
    releaseUnused(keepNames = []) {
        const keepSet = new Set(keepNames);
        for (const [name, img] of this.resources.entries()) {
            if (!keepSet.has(name)) {
                img.src = 'data:,';
                this.resources.delete(name);
            }
        }
    }

    /**
     * 获取资源统计信息
     * @returns {Object}
     */
    getStats() {
        return {
            images: this.resources.size,
            loading: this.loadingPromises.size,
            preloading: this.isPreloading
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResourceManager;
}
