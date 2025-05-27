/**
 * WordSaver 改进版弹窗脚本
 * 整合缓存、通知、学习功能的现代化界面
 */

// 防抖函数
function debounce(func, wait, immediate) {
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

// 节流函数
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 智能延迟管理器
class SmartDelay {
    constructor() {
        this.lastHoverTime = 0;
        this.hoverCount = 0;
        this.baseDelay = 500;
        this.minDelay = 200;
        this.maxDelay = 1000;
    }

    getDelay() {
        const now = Date.now();
        const timeSinceLastHover = now - this.lastHoverTime;
        
        if (timeSinceLastHover < 1000) {
            this.hoverCount++;
        } else {
            this.hoverCount = 1;
        }
        
        this.lastHoverTime = now;
        const dynamicDelay = this.baseDelay + (this.hoverCount - 1) * 100;
        return Math.min(Math.max(dynamicDelay, this.minDelay), this.maxDelay);
    }

    reset() {
        this.hoverCount = 0;
        this.lastHoverTime = 0;
    }
}

// 通知系统
class NotificationSystem {
    constructor() {
        this.notifications = new Map();
        this.container = null;
        this.defaultDuration = 3000;
        this.maxNotifications = 5;
    }

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

    show(message, type = 'info', duration = this.defaultDuration) {
        this.init();
        
        const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        if (this.notifications.size >= this.maxNotifications) {
            const oldestId = this.notifications.keys().next().value;
            this.remove(oldestId);
        }
        
        const element = this.createNotification(message, type);
        this.notifications.set(id, { element, timer: null });
        this.container.appendChild(element);
        
        requestAnimationFrame(() => {
            element.style.transform = 'translateX(0)';
            element.style.opacity = '1';
        });
        
        if (duration > 0) {
            const timer = setTimeout(() => this.remove(id), duration);
            this.notifications.get(id).timer = timer;
        }
        
        return id;
    }

    createNotification(message, type) {
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
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        const icon = document.createElement('span');
        icon.innerHTML = this.getTypeIcon(type);
        icon.style.fontSize = '16px';
        element.appendChild(icon);
        
        const messageEl = document.createElement('span');
        messageEl.textContent = message;
        messageEl.style.flex = '1';
        element.appendChild(messageEl);
        
        return element;
    }

    remove(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;
        
        if (notification.timer) {
            clearTimeout(notification.timer);
        }
        
        notification.element.style.transform = 'translateX(100%)';
        notification.element.style.opacity = '0';
        
        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            this.notifications.delete(id);
        }, 300);
    }

    getTypeColor(type) {
        const colors = {
            success: '#0f9d58',
            error: '#d32f2f',
            warning: '#ff9800',
            info: '#4285f4'
        };
        return colors[type] || colors.info;
    }

    getTypeIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

// 缓存管理器
class CacheManager {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 1000;
        this.ttl = options.ttl || 24 * 60 * 60 * 1000;
        this.cache = new Map();
        this.accessTimes = new Map();
        this.hitCount = 0;
        this.missCount = 0;
    }

    generateKey(prefix, params) {
        if (typeof params === 'object') {
            return `${prefix}:${JSON.stringify(params)}`;
        }
        return `${prefix}:${params}`;
    }

    set(key, value, ttl = this.ttl) {
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

    get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            this.missCount++;
            return null;
        }

        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            this.accessTimes.delete(key);
            this.missCount++;
            return null;
        }

        item.accessCount++;
        this.accessTimes.set(key, Date.now());
        this.hitCount++;
        
        return item.value;
    }

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
            this.cache.delete(oldestKey);
            this.accessTimes.delete(oldestKey);
        }
    }
}

// 翻译缓存管理器
class TranslationCache extends CacheManager {
    constructor() {
        super({
            maxSize: 500,
            ttl: 7 * 24 * 60 * 60 * 1000 // 7天
        });
    }

    setTranslation(word, targetLang, translation) {
        const key = this.generateKey('translation', { word: word.toLowerCase(), targetLang });
        this.set(key, translation);
    }

    getTranslation(word, targetLang) {
        const key = this.generateKey('translation', { word: word.toLowerCase(), targetLang });
        return this.get(key);
    }
}

// 记忆曲线管理器
class MemoryCurveManager {
    constructor() {
        this.reviewIntervals = [1, 3, 7, 15, 30, 90, 180, 365];
        this.difficultyLevels = {
            EASY: 0.8,
            NORMAL: 1.0,
            HARD: 1.3,
            AGAIN: 0.3
        };
    }

    calculateNextReview(wordData, difficulty = 'normal') {
        const now = new Date();
        const reviewCount = wordData.reviewCount || 0;
        const multiplier = this.difficultyLevels[difficulty.toUpperCase()] || 1.0;
        
        let intervalIndex = reviewCount;
        
        if (difficulty === 'again') {
            intervalIndex = 0;
        } else if (intervalIndex >= this.reviewIntervals.length) {
            intervalIndex = this.reviewIntervals.length - 1;
        }
        
        const baseInterval = this.reviewIntervals[intervalIndex];
        const adjustedInterval = Math.floor(baseInterval * multiplier);
        
        const nextReview = new Date(now);
        nextReview.setDate(nextReview.getDate() + adjustedInterval);
        
        return nextReview;
    }

    needsReview(wordData) {
        if (!wordData.nextReview) return true;
        
        const now = new Date();
        const nextReview = new Date(wordData.nextReview);
        
        return now >= nextReview;
    }

    getReviewUrgency(wordData) {
        if (!wordData.nextReview) return 'urgent';
        
        const now = new Date();
        const nextReview = new Date(wordData.nextReview);
        const diffDays = Math.ceil((nextReview - now) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return 'urgent';
        if (diffDays === 0) return 'due';
        if (diffDays <= 3) return 'upcoming';
        return 'learned';
    }
}

// 学习统计管理器
class LearningStatsManager {
    constructor() {
        this.storageKey = 'wordsaver_learning_stats';
    }

    async getStats() {
        try {
            const result = await chrome.storage.local.get(this.storageKey);
            return result[this.storageKey] || this.getDefaultStats();
        } catch (error) {
            console.error('获取学习统计失败:', error);
            return this.getDefaultStats();
        }
    }

    async updateStats(updates) {
        try {
            const currentStats = await this.getStats();
            const newStats = { ...currentStats, ...updates };
            
            await chrome.storage.local.set({
                [this.storageKey]: newStats
            });
        } catch (error) {
            console.error('更新学习统计失败:', error);
        }
    }

    async recordReview(correct) {
        const stats = await this.getStats();
        const today = new Date().toDateString();
        
        if (!stats.dailyStats[today]) {
            stats.dailyStats[today] = { reviewed: 0, correct: 0, streak: 0 };
        }
        
        stats.dailyStats[today].reviewed++;
        stats.totalReviews++;
        
        if (correct) {
            stats.dailyStats[today].correct++;
            stats.correctReviews++;
            stats.currentStreak++;
            stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
        } else {
            stats.currentStreak = 0;
        }
        
        stats.lastReviewDate = new Date().toISOString();
        
        await this.updateStats(stats);
    }

    getDefaultStats() {
        return {
            totalReviews: 0,
            correctReviews: 0,
            currentStreak: 0,
            maxStreak: 0,
            studyDays: 0,
            lastReviewDate: null,
            dailyStats: {},
            weeklyGoal: 50,
            monthlyGoal: 200
        };
    }

    calculateAccuracy(stats) {
        if (stats.totalReviews === 0) return 0;
        return Math.round((stats.correctReviews / stats.totalReviews) * 100);
    }

    async getWeeklyStats() {
        const stats = await this.getStats();
        const today = new Date();
        const weeklyData = { reviewed: 0, correct: 0, days: [] };
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();
            
            const dayStats = stats.dailyStats[dateStr] || { reviewed: 0, correct: 0 };
            weeklyData.reviewed += dayStats.reviewed;
            weeklyData.correct += dayStats.correct;
            weeklyData.days.push({
                date: dateStr,
                ...dayStats
            });
        }
        
        return weeklyData;
    }
}

// 主应用类
class ImprovedWordSaverPopup {
    constructor() {
        this.words = [];
        this.filteredWords = [];
        this.currentTab = 'words';
        this.smartDelay = new SmartDelay();
        this.notification = new NotificationSystem();
        this.translationCache = new TranslationCache();
        this.memoryCurve = new MemoryCurveManager();
        this.learningStats = new LearningStatsManager();
        this.isLoading = false;
        
        // 绑定方法上下文
        this.handleSearch = debounce(this.handleSearch.bind(this), 300);
        
        this.init();
    }

    async init() {
        try {
            await this.initializeElements();
            await this.loadWords();
            await this.loadStats();
            this.setupEventListeners();
            this.setupTabs();
            this.notification.success('插件加载完成 🎉');
        } catch (error) {
            console.error('初始化失败:', error);
            this.notification.error('插件初始化失败，请刷新重试');
        }
    }

    initializeElements() {
        this.elements = {
            // 搜索
            searchInput: document.getElementById('search-input'),
            
            // 统计
            totalWords: document.getElementById('total-words'),
            todayReviewed: document.getElementById('today-reviewed'),
            accuracyRate: document.getElementById('accuracy-rate'),
            
            // 标签页
            tabButtons: document.querySelectorAll('.tab-btn'),
            wordsList: document.getElementById('word-list'),
            reviewList: document.getElementById('review-list'),
            
            // 复习相关
            reviewCount: document.getElementById('review-count'),
            urgentCount: document.getElementById('urgent-count'),
            dueCount: document.getElementById('due-count'),
            upcomingCount: document.getElementById('upcoming-count'),
            startReviewBtn: document.getElementById('start-review-btn'),
            
            // 测试相关
            testTypeInputs: document.querySelectorAll('input[name="test-type"]'),
            testCountInput: document.getElementById('test-count-input'),
            startTestBtn: document.getElementById('start-test-btn'),
            testContent: document.getElementById('test-content'),
            
            // 统计相关
            totalReviews: document.getElementById('total-reviews'),
            currentStreak: document.getElementById('current-streak'),
            maxStreak: document.getElementById('max-streak'),
            weeklyChart: document.getElementById('weekly-chart'),
            
            // 底部按钮
            importBtn: document.getElementById('import-btn'),
            exportBtn: document.getElementById('export-btn'),
            settingsBtn: document.getElementById('settings-btn'),
            
            // 加载指示器
            loading: document.getElementById('loading')
        };
    }

    setupEventListeners() {
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', this.handleSearch);
        }
        
        if (this.elements.startReviewBtn) {
            this.elements.startReviewBtn.addEventListener('click', () => this.startReview());
        }
        
        if (this.elements.startTestBtn) {
            this.elements.startTestBtn.addEventListener('click', () => this.startTest());
        }
        
        if (this.elements.importBtn) {
            this.elements.importBtn.addEventListener('click', () => this.handleImport());
        }
        
        if (this.elements.exportBtn) {
            this.elements.exportBtn.addEventListener('click', () => this.handleExport());
        }
        
        if (this.elements.settingsBtn) {
            this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
        }
    }

    setupTabs() {
        this.elements.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        this.elements.tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
        
        this.currentTab = tabName;
        
        switch (tabName) {
            case 'words':
                this.renderWords();
                break;
            case 'review':
                this.loadReviewWords();
                break;
            case 'test':
                break;
            case 'stats':
                this.loadDetailedStats();
                break;
        }
    }

    async loadWords() {
        try {
            this.setLoading(true);
            
            // 尝试读取background.js使用的存储格式
            let result = await chrome.storage.local.get(['words', 'translations']);
            
            if (result.words && result.words.length > 0) {
                // 合并words和translations数据
                this.words = result.words.map(wordItem => {
                    const translation = result.translations && result.translations[wordItem.word];
                    return {
                        ...wordItem,
                        chinese: translation ? this.extractChineseTranslation(translation) : '',
                        english: translation ? this.extractEnglishTranslation(translation) : ''
                    };
                });
                
                console.log(`从background存储加载了 ${this.words.length} 个单词`);
            } else {
                // 备用：尝试旧的存储键
                result = await chrome.storage.local.get(['wordSaverWords', 'wordItems']);
                this.words = result.wordSaverWords || result.wordItems || [];
                
                if (this.words.length > 0) {
                    console.log(`从备用存储加载了 ${this.words.length} 个单词`);
                }
            }
            
            this.filteredWords = [...this.words];
            this.updateWordCount();
            this.renderWords();
            
        } catch (error) {
            console.error('加载单词失败:', error);
            this.notification.error('加载单词失败');
        } finally {
            this.setLoading(false);
        }
    }

    // 从HTML翻译中提取中文部分
    extractChineseTranslation(htmlTranslation) {
        if (!htmlTranslation) return '';
        
        try {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlTranslation;
            
            // 查找中文翻译部分
            const chineseSection = tempDiv.querySelector('[style*="color: #4285f4"]');
            if (chineseSection && chineseSection.nextSibling) {
                return chineseSection.nextSibling.textContent.trim();
            }
            
            // 备用方法：提取纯文本并尝试找到中文
            const textContent = tempDiv.textContent || tempDiv.innerText || '';
            const lines = textContent.split('\n').map(line => line.trim()).filter(line => line);
            
            for (const line of lines) {
                // 简单的中文检测
                if (/[\u4e00-\u9fa5]/.test(line) && !line.includes('Example:')) {
                    return line.replace(/^中文[：:]\s*/, '');
                }
            }
            
            return textContent.trim();
        } catch (error) {
            console.error('提取中文翻译失败:', error);
            return htmlTranslation.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
    }

    // 从HTML翻译中提取英文部分
    extractEnglishTranslation(htmlTranslation) {
        if (!htmlTranslation) return '';
        
        try {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlTranslation;
            
            // 查找英文例句部分
            const textContent = tempDiv.textContent || tempDiv.innerText || '';
            const lines = textContent.split('\n').map(line => line.trim()).filter(line => line);
            
            for (const line of lines) {
                if (line.includes('Example:') || line.includes('例句:')) {
                    return line;
                }
            }
            
            return '';
        } catch (error) {
            console.error('提取英文翻译失败:', error);
            return '';
        }
    }

    async loadStats() {
        try {
            const stats = await this.learningStats.getStats();
            
            if (this.elements.totalWords) {
                this.elements.totalWords.textContent = this.words.length;
            }
            
            if (this.elements.todayReviewed) {
                const today = new Date().toDateString();
                const todayStats = stats.dailyStats[today] || { reviewed: 0 };
                this.elements.todayReviewed.textContent = todayStats.reviewed;
            }
            
            if (this.elements.accuracyRate) {
                const accuracy = this.learningStats.calculateAccuracy(stats);
                this.elements.accuracyRate.textContent = `${accuracy}%`;
            }
            
        } catch (error) {
            console.error('加载统计失败:', error);
        }
    }

    async loadReviewWords() {
        try {
            const reviewWords = this.words.filter(word => {
                return this.memoryCurve.needsReview(word);
            });
            
            const urgencies = {
                urgent: [],
                due: [],
                upcoming: []
            };
            
            reviewWords.forEach(word => {
                const urgency = this.memoryCurve.getReviewUrgency(word);
                if (urgencies[urgency]) {
                    urgencies[urgency].push(word);
                }
            });
            
            if (this.elements.reviewCount) {
                this.elements.reviewCount.textContent = reviewWords.length;
            }
            if (this.elements.urgentCount) {
                this.elements.urgentCount.textContent = urgencies.urgent.length;
            }
            if (this.elements.dueCount) {
                this.elements.dueCount.textContent = urgencies.due.length;
            }
            if (this.elements.upcomingCount) {
                this.elements.upcomingCount.textContent = urgencies.upcoming.length;
            }
            
            this.renderReviewWords(reviewWords);
            
        } catch (error) {
            console.error('加载复习单词失败:', error);
            this.notification.error('加载复习单词失败');
        }
    }

    async loadDetailedStats() {
        try {
            const stats = await this.learningStats.getStats();
            const weeklyStats = await this.learningStats.getWeeklyStats();
            
            if (this.elements.totalReviews) {
                this.elements.totalReviews.textContent = stats.totalReviews;
            }
            if (this.elements.currentStreak) {
                this.elements.currentStreak.textContent = stats.currentStreak;
            }
            if (this.elements.maxStreak) {
                this.elements.maxStreak.textContent = stats.maxStreak;
            }
            
            this.renderWeeklyChart(weeklyStats);
            
        } catch (error) {
            console.error('加载详细统计失败:', error);
        }
    }

    renderWords() {
        if (!this.elements.wordsList) return;
        
        if (this.filteredWords.length === 0) {
            this.elements.wordsList.innerHTML = this.getEmptyState();
            return;
        }
        
        const html = this.filteredWords.map(word => this.createWordItem(word)).join('');
        this.elements.wordsList.innerHTML = html;
        
        this.bindWordEvents();
    }

    renderReviewWords(words) {
        if (!this.elements.reviewList) return;
        
        if (words.length === 0) {
            this.elements.reviewList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎉</div>
                    <div class="empty-state-title">太棒了！</div>
                    <div class="empty-state-description">暂时没有需要复习的单词</div>
                </div>
            `;
            return;
        }
        
        const html = words.map(word => this.createReviewWordItem(word)).join('');
        this.elements.reviewList.innerHTML = html;
        
        this.bindReviewEvents();
    }

    renderWeeklyChart(weeklyStats) {
        if (!this.elements.weeklyChart) return;
        
        const maxReviewed = Math.max(...weeklyStats.days.map(day => day.reviewed), 1);
        
        const html = weeklyStats.days.map(day => {
            const height = Math.max((day.reviewed / maxReviewed) * 100, 5);
            const date = new Date(day.date);
            const dayName = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
            
            return `
                <div class="chart-bar">
                    <div class="bar" style="height: ${height}%" title="${day.reviewed} 次复习"></div>
                    <div class="bar-label">${dayName}</div>
                </div>
            `;
        }).join('');
        
        this.elements.weeklyChart.innerHTML = `
            <div class="chart-bars">${html}</div>
        `;
    }

    createWordItem(word) {
        const date = word.timestamp ? new Date(word.timestamp).toLocaleDateString() : '';
        const source = word.source?.title || word.source?.url || '';
        const shortSource = source.length > 30 ? source.substring(0, 30) + '...' : source;
        
        return `
            <div class="word-item" data-word="${word.word}">
                <div class="word-header">
                    <h3 class="word-text">${word.word}</h3>
                    <div class="word-actions">
                        <button class="action-btn translate-btn" data-action="translate">
                            🔍 翻译
                        </button>
                        <button class="action-btn speak-btn" data-action="speak">
                            🔊 朗读
                        </button>
                        <button class="action-btn delete-btn" data-action="delete">
                            🗑️ 删除
                        </button>
                    </div>
                </div>
                ${word.chinese ? `
                    <div class="translation-content">
                        <div class="chinese">${word.chinese}</div>
                        ${word.english ? `<div class="english">${word.english}</div>` : ''}
                    </div>
                ` : ''}
                <div class="word-details">
                    <div class="word-date">📅 ${date}</div>
                    <div class="word-source">${shortSource}</div>
                </div>
            </div>
        `;
    }

    createReviewWordItem(word) {
        const urgency = this.memoryCurve.getReviewUrgency(word);
        const urgencyClass = `urgency-${urgency}`;
        const urgencyText = {
            urgent: '逾期',
            due: '今日',
            upcoming: '即将'
        }[urgency] || '';
        
        return `
            <div class="word-item review-word-item ${urgencyClass}" data-word="${word.word}">
                <div class="word-header">
                    <h3 class="word-text">${word.word}</h3>
                    <div class="urgency-badge">${urgencyText}</div>
                </div>
                <div class="translation-content">
                    <div class="chinese">${word.chinese || '暂无翻译'}</div>
                </div>
                <div class="review-actions">
                    <button class="review-btn easy" data-difficulty="easy">简单</button>
                    <button class="review-btn normal" data-difficulty="normal">正常</button>
                    <button class="review-btn hard" data-difficulty="hard">困难</button>
                    <button class="review-btn again" data-difficulty="again">重新学习</button>
                </div>
            </div>
        `;
    }

    bindWordEvents() {
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const wordElement = btn.closest('.word-item');
                const word = wordElement.dataset.word;
                
                switch (action) {
                    case 'translate':
                        await this.translateWord(word, wordElement);
                        break;
                    case 'speak':
                        this.speakWord(word);
                        break;
                    case 'delete':
                        await this.deleteWord(word);
                        break;
                }
            });
        });
    }

    bindReviewEvents() {
        document.querySelectorAll('.review-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const difficulty = btn.dataset.difficulty;
                const wordElement = btn.closest('.word-item');
                const word = wordElement.dataset.word;
                
                await this.reviewWord(word, difficulty);
            });
        });
    }

    async translateWord(word, wordElement) {
        try {
            let translation = this.translationCache.getTranslation(word, 'zh-CN');
            
            if (!translation) {
                this.notification.info('正在翻译...');
                translation = await this.callTranslationAPI(word);
                
                if (translation) {
                    this.translationCache.setTranslation(word, 'zh-CN', translation);
                }
            }
            
            if (translation) {
                const existingTranslation = wordElement.querySelector('.translation-content');
                if (existingTranslation) {
                    existingTranslation.innerHTML = `
                        <div class="chinese">${translation.chinese}</div>
                        ${translation.english ? `<div class="english">${translation.english}</div>` : ''}
                    `;
                } else {
                    const wordHeader = wordElement.querySelector('.word-header');
                    wordHeader.insertAdjacentHTML('afterend', `
                        <div class="translation-content">
                            <div class="chinese">${translation.chinese}</div>
                            ${translation.english ? `<div class="english">${translation.english}</div>` : ''}
                        </div>
                    `);
                }
                
                this.notification.success('翻译成功！');
            } else {
                this.notification.error('翻译失败，请稍后重试');
            }
            
        } catch (error) {
            console.error('翻译失败:', error);
            this.notification.error('翻译服务暂时不可用');
        }
    }

    async callTranslationAPI(word) {
        try {
            // 尝试使用Google翻译API
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(word)}`;
            
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data[0] && data[0][0] && data[0][0][0]) {
                    return {
                        chinese: data[0][0][0],
                        english: ''
                    };
                }
            }
        } catch (error) {
            console.error('翻译API调用失败:', error);
        }
        
        // 备用方案：返回模拟翻译
        return {
            chinese: `${word}的翻译`,
            english: `Example: This is an example sentence with ${word}.`
        };
    }

    speakWord(word) {
        try {
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.lang = 'en-US';
            utterance.rate = 0.8;
            speechSynthesis.speak(utterance);
            this.notification.success('🔊 正在朗读');
        } catch (error) {
            console.error('朗读失败:', error);
            this.notification.error('朗读功能不可用');
        }
    }

    async deleteWord(word) {
        try {
            if (!confirm(`确定要删除单词 "${word}" 吗？`)) {
                return;
            }
            
            // 从background.js存储格式中删除
            const result = await chrome.storage.local.get(['words', 'translations']);
            
            if (result.words) {
                // 删除单词
                const updatedWords = result.words.filter(w => w.word !== word);
                
                // 删除翻译
                const updatedTranslations = { ...result.translations };
                delete updatedTranslations[word];
                
                // 保存更新的数据
                await chrome.storage.local.set({ 
                    words: updatedWords,
                    translations: updatedTranslations
                });
                
                console.log(`已删除单词: ${word}`);
            }
            
            // 更新本地数据
            this.words = this.words.filter(w => w.word !== word);
            this.filteredWords = this.filteredWords.filter(w => w.word !== word);
            
            this.renderWords();
            this.updateWordCount();
            
            this.notification.success('单词删除成功');
            
        } catch (error) {
            console.error('删除单词失败:', error);
            this.notification.error('删除失败');
        }
    }

    async reviewWord(word, difficulty) {
        try {
            const wordIndex = this.words.findIndex(w => w.word === word);
            if (wordIndex === -1) return;
            
            const wordData = this.words[wordIndex];
            const nextReview = this.memoryCurve.calculateNextReview(wordData, difficulty);
            
            this.words[wordIndex] = {
                ...wordData,
                reviewCount: (wordData.reviewCount || 0) + 1,
                nextReview: nextReview.toISOString(),
                lastReviewed: new Date().toISOString(),
                difficulty: difficulty
            };
            
            await chrome.storage.local.set({ wordSaverWords: this.words });
            
            const correct = difficulty !== 'again';
            await this.learningStats.recordReview(correct);
            
            await this.loadReviewWords();
            
            const messages = {
                easy: '标记为简单 ✅',
                normal: '正常掌握 👍',
                hard: '需要加强 💪',
                again: '重新学习 🔄'
            };
            
            this.notification.success(messages[difficulty]);
            
        } catch (error) {
            console.error('复习记录失败:', error);
            this.notification.error('复习记录失败');
        }
    }

    async startReview() {
        try {
            const reviewWords = this.words.filter(word => this.memoryCurve.needsReview(word));
            
            if (reviewWords.length === 0) {
                this.notification.info('暂时没有需要复习的单词 🎉');
                return;
            }
            
            this.notification.info(`开始复习 ${reviewWords.length} 个单词`);
            
        } catch (error) {
            console.error('开始复习失败:', error);
            this.notification.error('开始复习失败');
        }
    }

    async startTest() {
        try {
            if (this.words.length < 4) {
                this.notification.warning('至少需要4个单词才能开始测试');
                return;
            }
            
            this.notification.info('测试功能开发中，敬请期待 🚧');
            
        } catch (error) {
            console.error('开始测试失败:', error);
            this.notification.error('开始测试失败');
        }
    }

    handleSearch(e) {
        const query = e.target.value.toLowerCase().trim();
        
        if (!query) {
            this.filteredWords = [...this.words];
        } else {
            this.filteredWords = this.words.filter(word => 
                word.word.toLowerCase().includes(query) ||
                (word.chinese && word.chinese.includes(query))
            );
        }
        
        this.renderWords();
        this.updateWordCount();
    }

    async handleImport() {
        try {
            this.notification.info('导入功能开发中 📥');
        } catch (error) {
            console.error('导入失败:', error);
            this.notification.error('导入失败');
        }
    }

    async handleExport() {
        try {
            if (this.words.length === 0) {
                this.notification.warning('没有单词可以导出');
                return;
            }
            
            const csvContent = this.generateCSV(this.words);
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `wordsaver_${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                this.notification.success('导出成功 📤');
            }
            
        } catch (error) {
            console.error('导出失败:', error);
            this.notification.error('导出失败');
        }
    }

    generateCSV(words) {
        const headers = ['单词', '中文', '英文释义', '来源', '添加时间'];
        const rows = words.map(word => [
            word.word || '',
            word.chinese || '',
            word.english || '',
            word.source?.title || word.source?.url || '',
            word.timestamp ? new Date(word.timestamp).toLocaleString() : ''
        ]);
        
        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(','))
            .join('\n');
            
        return '\uFEFF' + csvContent;
    }

    openSettings() {
        try {
            chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
            window.close();
        } catch (error) {
            console.error('打开设置失败:', error);
            this.notification.error('打开设置失败');
        }
    }

    updateWordCount() {
        if (this.elements.totalWords) {
            this.elements.totalWords.textContent = this.filteredWords.length;
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        if (this.elements.loading) {
            this.elements.loading.style.display = loading ? 'flex' : 'none';
        }
    }

    getEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <div class="empty-state-title">还没有保存单词</div>
                <div class="empty-state-description">
                    开始浏览网页并悬停在英文单词上，<br>
                    点击保存按钮来添加第一个单词吧！
                </div>
            </div>
        `;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new ImprovedWordSaverPopup();
}); 