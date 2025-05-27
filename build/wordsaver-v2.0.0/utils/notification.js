/**
 * 通知系统 - 提供统一的用户反馈
 */
export class NotificationSystem {
    constructor() {
        this.notifications = new Map();
        this.container = null;
        this.defaultDuration = 3000;
        this.maxNotifications = 5;
    }

    /**
     * 初始化通知容器
     */
    init() {
        if (this.container) return;
        
        this.container = document.createElement('div');
        this.container.id = 'wordsaver-notifications';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            pointer-events: none;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;
        document.body.appendChild(this.container);
    }

    /**
     * 显示通知
     * @param {string} message 消息内容
     * @param {string} type 通知类型: success, error, warning, info
     * @param {number} duration 显示时长（毫秒）
     * @param {Object} options 额外选项
     */
    show(message, type = 'info', duration = this.defaultDuration, options = {}) {
        this.init();
        
        const id = this.generateId();
        const notification = this.createNotification(id, message, type, options);
        
        // 限制通知数量
        if (this.notifications.size >= this.maxNotifications) {
            const oldestId = this.notifications.keys().next().value;
            this.remove(oldestId);
        }
        
        this.notifications.set(id, notification);
        this.container.appendChild(notification.element);
        
        // 添加动画
        requestAnimationFrame(() => {
            notification.element.style.transform = 'translateX(0)';
            notification.element.style.opacity = '1';
        });
        
        // 自动移除
        if (duration > 0) {
            notification.timer = setTimeout(() => {
                this.remove(id);
            }, duration);
        }
        
        return id;
    }

    /**
     * 创建通知元素
     */
    createNotification(id, message, type, options) {
        const element = document.createElement('div');
        element.className = `wordsaver-notification notification-${type}`;
        element.style.cssText = `
            background: ${this.getTypeColor(type)};
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: auto;
            cursor: pointer;
            max-width: 320px;
            word-break: break-word;
            position: relative;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        // 添加图标
        const icon = document.createElement('span');
        icon.innerHTML = this.getTypeIcon(type);
        icon.style.fontSize = '16px';
        element.appendChild(icon);
        
        // 添加消息
        const messageEl = document.createElement('span');
        messageEl.textContent = message;
        messageEl.style.flex = '1';
        element.appendChild(messageEl);
        
        // 添加关闭按钮
        if (options.closable !== false) {
            const closeBtn = document.createElement('span');
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
                font-size: 18px;
                cursor: pointer;
                opacity: 0.7;
                margin-left: 8px;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s ease;
            `;
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.remove(id);
            });
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.backgroundColor = 'rgba(255,255,255,0.2)';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.backgroundColor = 'transparent';
            });
            element.appendChild(closeBtn);
        }
        
        // 点击通知的处理
        if (options.onClick) {
            element.addEventListener('click', options.onClick);
            element.style.cursor = 'pointer';
        } else {
            element.addEventListener('click', () => this.remove(id));
        }
        
        return { element, timer: null };
    }

    /**
     * 移除通知
     */
    remove(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;
        
        if (notification.timer) {
            clearTimeout(notification.timer);
        }
        
        // 添加移除动画
        notification.element.style.transform = 'translateX(100%)';
        notification.element.style.opacity = '0';
        
        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            this.notifications.delete(id);
        }, 300);
    }

    /**
     * 清除所有通知
     */
    clear() {
        for (const id of this.notifications.keys()) {
            this.remove(id);
        }
    }

    /**
     * 快捷方法
     */
    success(message, duration, options) {
        return this.show(message, 'success', duration, options);
    }

    error(message, duration, options) {
        return this.show(message, 'error', duration, options);
    }

    warning(message, duration, options) {
        return this.show(message, 'warning', duration, options);
    }

    info(message, duration, options) {
        return this.show(message, 'info', duration, options);
    }

    /**
     * 获取类型颜色
     */
    getTypeColor(type) {
        const colors = {
            success: '#0f9d58',
            error: '#d32f2f',
            warning: '#ff9800',
            info: '#4285f4'
        };
        return colors[type] || colors.info;
    }

    /**
     * 获取类型图标
     */
    getTypeIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    /**
     * 生成唯一ID
     */
    generateId() {
        return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// 创建全局实例
export const notification = new NotificationSystem(); 