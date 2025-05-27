/**
 * 缓存管理系统 - 减少重复API调用，提升性能
 */
export class CacheManager {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 1000;
        this.ttl = options.ttl || 24 * 60 * 60 * 1000; // 24小时默认TTL
        this.cache = new Map();
        this.accessTimes = new Map();
        this.hitCount = 0;
        this.missCount = 0;
        
        // 定期清理过期缓存
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, options.cleanupInterval || 60 * 1000); // 每分钟清理一次
    }

    /**
     * 生成缓存键
     * @param {string} prefix 前缀
     * @param {*} params 参数
     * @returns {string} 缓存键
     */
    generateKey(prefix, params) {
        if (typeof params === 'object') {
            return `${prefix}:${JSON.stringify(params)}`;
        }
        return `${prefix}:${params}`;
    }

    /**
     * 设置缓存
     * @param {string} key 缓存键
     * @param {*} value 缓存值
     * @param {number} ttl 生存时间（毫秒）
     */
    set(key, value, ttl = this.ttl) {
        // 检查缓存大小
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }

        const expiresAt = Date.now() + ttl;
        this.cache.set(key, {
            value,
            expiresAt,
            createdAt: Date.now(),
            accessCount: 1
        });
        this.accessTimes.set(key, Date.now());
    }

    /**
     * 获取缓存
     * @param {string} key 缓存键
     * @returns {*} 缓存值或null
     */
    get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            this.missCount++;
            return null;
        }

        // 检查是否过期
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            this.accessTimes.delete(key);
            this.missCount++;
            return null;
        }

        // 更新访问时间和计数
        item.accessCount++;
        this.accessTimes.set(key, Date.now());
        this.hitCount++;
        
        return item.value;
    }

    /**
     * 删除缓存
     * @param {string} key 缓存键
     */
    delete(key) {
        this.cache.delete(key);
        this.accessTimes.delete(key);
    }

    /**
     * 检查缓存是否存在且未过期
     * @param {string} key 缓存键
     * @returns {boolean}
     */
    has(key) {
        const item = this.cache.get(key);
        if (!item) return false;
        
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            this.accessTimes.delete(key);
            return false;
        }
        
        return true;
    }

    /**
     * 清理过期缓存
     */
    cleanup() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiresAt) {
                this.cache.delete(key);
                this.accessTimes.delete(key);
                cleanedCount++;
            }
        }
        
        console.log(`[CacheManager] 清理了 ${cleanedCount} 个过期缓存项`);
        return cleanedCount;
    }

    /**
     * LRU 驱逐策略
     */
    evictLRU() {
        let oldestKey = null;
        let oldestTime = Date.now();
        
        for (const [key, time] of this.accessTimes.entries()) {
            if (time < oldestTime) {
                oldestTime = time;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            this.delete(oldestKey);
        }
    }

    /**
     * 清空所有缓存
     */
    clear() {
        this.cache.clear();
        this.accessTimes.clear();
        this.hitCount = 0;
        this.missCount = 0;
    }

    /**
     * 获取缓存统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        const totalRequests = this.hitCount + this.missCount;
        const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests * 100).toFixed(2) : 0;
        
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitCount: this.hitCount,
            missCount: this.missCount,
            hitRate: `${hitRate}%`,
            memoryUsage: this.getMemoryUsage()
        };
    }

    /**
     * 估算内存使用量
     * @returns {string} 内存使用量
     */
    getMemoryUsage() {
        let size = 0;
        for (const [key, item] of this.cache.entries()) {
            size += key.length * 2; // 字符串占用字节数（UTF-16）
            size += JSON.stringify(item.value).length * 2;
            size += 64; // 元数据开销估算
        }
        
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
        return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    }

    /**
     * 销毁缓存管理器
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
    }
}

/**
 * 翻译缓存管理器
 */
export class TranslationCache extends CacheManager {
    constructor() {
        super({
            maxSize: 500,
            ttl: 7 * 24 * 60 * 60 * 1000, // 翻译缓存7天
            cleanupInterval: 5 * 60 * 1000 // 5分钟清理一次
        });
    }

    /**
     * 缓存翻译结果
     * @param {string} word 单词
     * @param {string} targetLang 目标语言
     * @param {Object} translation 翻译结果
     */
    setTranslation(word, targetLang, translation) {
        const key = this.generateKey('translation', { word: word.toLowerCase(), targetLang });
        this.set(key, translation);
    }

    /**
     * 获取翻译缓存
     * @param {string} word 单词
     * @param {string} targetLang 目标语言
     * @returns {Object|null} 翻译结果
     */
    getTranslation(word, targetLang) {
        const key = this.generateKey('translation', { word: word.toLowerCase(), targetLang });
        return this.get(key);
    }
}

/**
 * 词典缓存管理器
 */
export class DictionaryCache extends CacheManager {
    constructor() {
        super({
            maxSize: 300,
            ttl: 30 * 24 * 60 * 60 * 1000, // 词典缓存30天
            cleanupInterval: 10 * 60 * 1000 // 10分钟清理一次
        });
    }

    /**
     * 缓存词典查询结果
     * @param {string} word 单词
     * @param {Object} definition 词典定义
     */
    setDefinition(word, definition) {
        const key = this.generateKey('definition', word.toLowerCase());
        this.set(key, definition);
    }

    /**
     * 获取词典缓存
     * @param {string} word 单词
     * @returns {Object|null} 词典定义
     */
    getDefinition(word) {
        const key = this.generateKey('definition', word.toLowerCase());
        return this.get(key);
    }
}

// 创建全局实例
export const translationCache = new TranslationCache();
export const dictionaryCache = new DictionaryCache(); 