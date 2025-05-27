/**
 * 防抖函数 - 优化悬停翻译性能
 * @param {Function} func 要防抖的函数
 * @param {number} wait 延迟时间（毫秒）
 * @param {boolean} immediate 是否立即执行
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

/**
 * 节流函数 - 限制函数执行频率
 * @param {Function} func 要节流的函数
 * @param {number} limit 时间间隔（毫秒）
 * @returns {Function} 节流后的函数
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 智能延迟执行 - 根据用户行为动态调整延迟
 */
export class SmartDelay {
    constructor() {
        this.lastHoverTime = 0;
        this.hoverCount = 0;
        this.baseDelay = 500; // 基础延迟500ms
        this.minDelay = 200;   // 最小延迟200ms
        this.maxDelay = 1000;  // 最大延迟1000ms
    }

    /**
     * 获取智能延迟时间
     * @returns {number} 计算后的延迟时间
     */
    getDelay() {
        const now = Date.now();
        const timeSinceLastHover = now - this.lastHoverTime;
        
        // 如果用户快速连续悬停，增加延迟
        if (timeSinceLastHover < 1000) {
            this.hoverCount++;
        } else {
            this.hoverCount = 1;
        }
        
        this.lastHoverTime = now;
        
        // 根据悬停频率动态调整延迟
        const dynamicDelay = this.baseDelay + (this.hoverCount - 1) * 100;
        return Math.min(Math.max(dynamicDelay, this.minDelay), this.maxDelay);
    }

    /**
     * 重置计数器
     */
    reset() {
        this.hoverCount = 0;
        this.lastHoverTime = 0;
    }
} 