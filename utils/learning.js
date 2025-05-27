/**
 * 学习功能模块 - 基于艾宾浩斯遗忘曲线的单词学习系统
 */

/**
 * 记忆曲线管理器
 */
export class MemoryCurveManager {
    constructor() {
        // 艾宾浩斯遗忘曲线复习间隔（天）
        this.reviewIntervals = [1, 3, 7, 15, 30, 90, 180, 365];
        this.difficultyLevels = {
            EASY: 0.8,      // 简单：延长复习间隔
            NORMAL: 1.0,    // 正常：标准间隔
            HARD: 1.3,      // 困难：缩短复习间隔
            AGAIN: 0.3      // 重新学习：大幅缩短间隔
        };
    }

    /**
     * 计算下次复习时间
     * @param {Object} wordData 单词数据
     * @param {string} difficulty 难度反馈：easy, normal, hard, again
     * @returns {Date} 下次复习时间
     */
    calculateNextReview(wordData, difficulty = 'normal') {
        const now = new Date();
        const reviewCount = wordData.reviewCount || 0;
        const multiplier = this.difficultyLevels[difficulty.toUpperCase()] || 1.0;
        
        let intervalIndex = reviewCount;
        
        // 如果选择"重新学习"，重置到第一个间隔
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

    /**
     * 检查是否需要复习
     * @param {Object} wordData 单词数据
     * @returns {boolean} 是否需要复习
     */
    needsReview(wordData) {
        if (!wordData.nextReview) return true;
        
        const now = new Date();
        const nextReview = new Date(wordData.nextReview);
        
        return now >= nextReview;
    }

    /**
     * 获取复习紧急程度
     * @param {Object} wordData 单词数据
     * @returns {string} urgent, due, upcoming, learned
     */
    getReviewUrgency(wordData) {
        if (!wordData.nextReview) return 'urgent';
        
        const now = new Date();
        const nextReview = new Date(wordData.nextReview);
        const diffDays = Math.ceil((nextReview - now) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return 'urgent';     // 逾期
        if (diffDays === 0) return 'due';      // 今天到期
        if (diffDays <= 3) return 'upcoming';  // 即将到期
        return 'learned';                       // 已掌握
    }
}

/**
 * 学习统计管理器
 */
export class LearningStatsManager {
    constructor() {
        this.storageKey = 'wordsaver_learning_stats';
    }

    /**
     * 获取学习统计
     * @returns {Object} 统计数据
     */
    async getStats() {
        try {
            const result = await chrome.storage.local.get(this.storageKey);
            return result[this.storageKey] || this.getDefaultStats();
        } catch (error) {
            console.error('获取学习统计失败:', error);
            return this.getDefaultStats();
        }
    }

    /**
     * 更新学习统计
     * @param {Object} updates 更新的数据
     */
    async updateStats(updates) {
        try {
            const currentStats = await this.getStats();
            const newStats = { ...currentStats, ...updates };
            
            // 更新今日统计
            const today = new Date().toDateString();
            if (!newStats.dailyStats[today]) {
                newStats.dailyStats[today] = {
                    reviewed: 0,
                    correct: 0,
                    streak: currentStats.currentStreak || 0
                };
            }
            
            await chrome.storage.local.set({
                [this.storageKey]: newStats
            });
        } catch (error) {
            console.error('更新学习统计失败:', error);
        }
    }

    /**
     * 记录复习结果
     * @param {boolean} correct 是否回答正确
     */
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

    /**
     * 获取默认统计数据
     */
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

    /**
     * 计算准确率
     * @param {Object} stats 统计数据
     * @returns {number} 准确率（百分比）
     */
    calculateAccuracy(stats) {
        if (stats.totalReviews === 0) return 0;
        return Math.round((stats.correctReviews / stats.totalReviews) * 100);
    }

    /**
     * 获取本周统计
     * @returns {Object} 本周数据
     */
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

/**
 * 测试生成器
 */
export class TestGenerator {
    constructor() {
        this.testTypes = ['multiple_choice', 'fill_blank', 'translation', 'listening'];
    }

    /**
     * 生成多选题
     * @param {Object} targetWord 目标单词
     * @param {Array} allWords 所有单词
     * @returns {Object} 测试题目
     */
    generateMultipleChoice(targetWord, allWords) {
        const options = [targetWord.chinese];
        const otherWords = allWords
            .filter(w => w.word !== targetWord.word)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);
        
        otherWords.forEach(word => {
            if (word.chinese && !options.includes(word.chinese)) {
                options.push(word.chinese);
            }
        });
        
        // 确保有4个选项
        while (options.length < 4) {
            options.push(`选项 ${options.length + 1}`);
        }
        
        // 打乱选项顺序
        const shuffledOptions = options.sort(() => Math.random() - 0.5);
        const correctIndex = shuffledOptions.indexOf(targetWord.chinese);
        
        return {
            type: 'multiple_choice',
            question: `"${targetWord.word}" 的中文意思是？`,
            options: shuffledOptions,
            correctIndex,
            word: targetWord.word,
            explanation: `${targetWord.word} 的意思是 "${targetWord.chinese}"`
        };
    }

    /**
     * 生成填空题
     * @param {Object} targetWord 目标单词
     * @returns {Object} 测试题目
     */
    generateFillBlank(targetWord) {
        const word = targetWord.word;
        const chinese = targetWord.chinese;
        
        // 随机隐藏部分字母
        const hiddenLength = Math.min(Math.max(2, Math.floor(word.length * 0.4)), word.length - 1);
        const startIndex = Math.floor(Math.random() * (word.length - hiddenLength + 1));
        
        const blankedWord = word.split('').map((char, index) => {
            if (index >= startIndex && index < startIndex + hiddenLength) {
                return '_';
            }
            return char;
        }).join('');
        
        return {
            type: 'fill_blank',
            question: `请补全单词：${blankedWord} (${chinese})`,
            answer: word.toLowerCase(),
            hint: `单词长度：${word.length} 个字母`,
            word: targetWord.word,
            explanation: `完整单词是 "${word}"，意思是 "${chinese}"`
        };
    }

    /**
     * 生成翻译题
     * @param {Object} targetWord 目标单词
     * @returns {Object} 测试题目
     */
    generateTranslation(targetWord) {
        const isChineseToEnglish = Math.random() > 0.5;
        
        if (isChineseToEnglish) {
            return {
                type: 'translation',
                question: `请翻译成英文：${targetWord.chinese}`,
                answer: targetWord.word.toLowerCase(),
                word: targetWord.word,
                explanation: `"${targetWord.chinese}" 的英文是 "${targetWord.word}"`
            };
        } else {
            return {
                type: 'translation',
                question: `请翻译成中文：${targetWord.word}`,
                answer: targetWord.chinese,
                word: targetWord.word,
                explanation: `"${targetWord.word}" 的中文是 "${targetWord.chinese}"`
            };
        }
    }

    /**
     * 生成测试题目
     * @param {Array} words 单词列表
     * @param {string} type 测试类型
     * @param {number} count 题目数量
     * @returns {Array} 测试题目列表
     */
    generateTest(words, type = 'mixed', count = 10) {
        if (words.length === 0) return [];
        
        const testWords = words
            .sort(() => Math.random() - 0.5)
            .slice(0, count);
        
        return testWords.map(word => {
            let testType = type;
            if (type === 'mixed') {
                testType = this.testTypes[Math.floor(Math.random() * this.testTypes.length)];
            }
            
            switch (testType) {
                case 'multiple_choice':
                    return this.generateMultipleChoice(word, words);
                case 'fill_blank':
                    return this.generateFillBlank(word);
                case 'translation':
                    return this.generateTranslation(word);
                default:
                    return this.generateMultipleChoice(word, words);
            }
        });
    }
}

/**
 * 复习提醒管理器
 */
export class ReviewReminderManager {
    constructor() {
        this.storageKey = 'wordsaver_review_reminders';
    }

    /**
     * 设置复习提醒
     * @param {Object} settings 提醒设置
     */
    async setReminder(settings) {
        try {
            await chrome.storage.local.set({
                [this.storageKey]: {
                    enabled: settings.enabled || true,
                    time: settings.time || '20:00',
                    frequency: settings.frequency || 'daily',
                    minWords: settings.minWords || 5
                }
            });
        } catch (error) {
            console.error('设置复习提醒失败:', error);
        }
    }

    /**
     * 获取复习提醒设置
     * @returns {Object} 提醒设置
     */
    async getReminder() {
        try {
            const result = await chrome.storage.local.get(this.storageKey);
            return result[this.storageKey] || {
                enabled: false,
                time: '20:00',
                frequency: 'daily',
                minWords: 5
            };
        } catch (error) {
            console.error('获取复习提醒失败:', error);
            return { enabled: false };
        }
    }

    /**
     * 检查是否需要发送提醒
     * @param {Array} wordsToReview 需要复习的单词
     * @returns {boolean} 是否需要提醒
     */
    async shouldSendReminder(wordsToReview) {
        const settings = await this.getReminder();
        
        if (!settings.enabled) return false;
        if (wordsToReview.length < settings.minWords) return false;
        
        // 检查是否已经在今天发送过提醒
        const today = new Date().toDateString();
        const lastReminder = await this.getLastReminderDate();
        
        return lastReminder !== today;
    }

    /**
     * 记录提醒发送时间
     */
    async recordReminder() {
        try {
            await chrome.storage.local.set({
                'wordsaver_last_reminder': new Date().toDateString()
            });
        } catch (error) {
            console.error('记录提醒时间失败:', error);
        }
    }

    /**
     * 获取最后提醒日期
     * @returns {string|null} 最后提醒日期
     */
    async getLastReminderDate() {
        try {
            const result = await chrome.storage.local.get('wordsaver_last_reminder');
            return result.wordsaver_last_reminder;
        } catch (error) {
            console.error('获取最后提醒日期失败:', error);
            return null;
        }
    }
}

// 创建全局实例
export const memoryCurve = new MemoryCurveManager();
export const learningStats = new LearningStatsManager();
export const testGenerator = new TestGenerator();
export const reviewReminder = new ReviewReminderManager(); 