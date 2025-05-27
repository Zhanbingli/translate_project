/**
 * WordSaver 简化版弹窗脚本
 * 只保留核心功能：显示单词、搜索、删除
 */

class WordSaverPopup {
    constructor() {
        this.words = [];
        this.filteredWords = [];
        this.init();
    }

    async init() {
        try {
            await this.loadWords();
            this.setupEventListeners();
            this.renderWords();
        } catch (error) {
            console.error('初始化失败:', error);
            this.showMessage('插件加载失败');
        }
    }

    async loadWords() {
        try {
            // 从background.js存储格式读取
            const result = await chrome.storage.local.get(['words', 'translations']);
            
            if (result.words && result.words.length > 0) {
                this.words = result.words.map(wordItem => {
                    const translation = result.translations && result.translations[wordItem.word];
                    return {
                        ...wordItem,
                        translation: translation || ''
                    };
                });
                console.log(`加载了 ${this.words.length} 个单词`);
            } else {
                this.words = [];
            }
            
            this.filteredWords = [...this.words];
            this.updateWordCount();
            
        } catch (error) {
            console.error('加载单词失败:', error);
            this.words = [];
            this.filteredWords = [];
        }
    }

    setupEventListeners() {
        // 搜索功能
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // 清空按钮
        const clearBtn = document.getElementById('clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearAllWords();
            });
        }

        // 导出按钮
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportWords();
            });
        }
    }

    handleSearch(query) {
        const searchTerm = query.toLowerCase().trim();
        
        if (!searchTerm) {
            this.filteredWords = [...this.words];
        } else {
            this.filteredWords = this.words.filter(word => 
                word.word.toLowerCase().includes(searchTerm) ||
                (word.translation && word.translation.toLowerCase().includes(searchTerm))
            );
        }
        
        this.renderWords();
        this.updateWordCount();
    }

    renderWords() {
        const wordsList = document.getElementById('words-list');
        if (!wordsList) return;

        if (this.filteredWords.length === 0) {
            wordsList.innerHTML = `
                <div class="empty-state">
                    <h3>还没有保存单词</h3>
                    <p>在网页上悬停英文单词，点击保存按钮开始收集单词吧！</p>
                </div>
            `;
            return;
        }

        const html = this.filteredWords.map(word => this.createWordHTML(word)).join('');
        wordsList.innerHTML = html;
        
        // 绑定删除按钮事件
        this.bindDeleteEvents();
    }

    createWordHTML(word) {
        const date = word.timestamp ? new Date(word.timestamp).toLocaleDateString() : '';
        const source = word.source?.title || word.source?.url || '';
        const translation = this.extractTranslation(word.translation);
        
        return `
            <div class="word-item" data-word="${word.word}">
                <div class="word-header">
                    <span class="word-text">${word.word}</span>
                    <button class="delete-btn" data-word="${word.word}">删除</button>
                </div>
                ${translation ? `
                    <div class="word-translation">${translation}</div>
                ` : ''}
                <div class="word-info">
                    <span class="word-date">${date}</span>
                    ${source ? `<span class="word-source">${source}</span>` : ''}
                </div>
            </div>
        `;
    }

    extractTranslation(htmlTranslation) {
        if (!htmlTranslation) return '';
        
        try {
            // 去掉HTML标签，保留纯文本
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlTranslation;
            return tempDiv.textContent || tempDiv.innerText || '';
        } catch (error) {
            return htmlTranslation.replace(/<[^>]*>/g, '').trim();
        }
    }

    bindDeleteEvents() {
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const word = e.target.dataset.word;
                this.deleteWord(word);
            });
        });
    }

    async deleteWord(word) {
        if (!confirm(`确定要删除单词 "${word}" 吗？`)) {
            return;
        }

        try {
            // 发送删除请求到background script
            const response = await chrome.runtime.sendMessage({
                action: 'deleteWord',
                word: word
            });
            
            if (response && response.success) {
                console.log(`删除成功: ${word}`);
            } else {
                // 备用：直接从存储删除
                const result = await chrome.storage.local.get(['words', 'translations']);
                const words = result.words || [];
                const translations = result.translations || {};
                
                const updatedWords = words.filter(w => w.word !== word);
                delete translations[word];
                
                await chrome.storage.local.set({
                    words: updatedWords,
                    translations: translations
                });
            }
            
            // 更新本地数据
            this.words = this.words.filter(w => w.word !== word);
            this.filteredWords = this.filteredWords.filter(w => w.word !== word);
            
            this.renderWords();
            this.updateWordCount();
            this.showMessage('删除成功');
            
        } catch (error) {
            console.error('删除失败:', error);
            this.showMessage('删除失败');
        }
    }

    async clearAllWords() {
        if (!confirm('确定要清空所有单词吗？此操作不可恢复！')) {
            return;
        }

        try {
            await chrome.storage.local.set({
                words: [],
                translations: {}
            });
            
            this.words = [];
            this.filteredWords = [];
            this.renderWords();
            this.updateWordCount();
            this.showMessage('已清空所有单词');
            
        } catch (error) {
            console.error('清空失败:', error);
            this.showMessage('清空失败');
        }
    }

    exportWords() {
        if (this.words.length === 0) {
            this.showMessage('没有单词可以导出');
            return;
        }

        try {
            // 生成CSV内容
            let csv = 'Word,Translation,Date,Source\n';
            this.words.forEach(word => {
                const translation = this.extractTranslation(word.translation);
                const date = word.timestamp ? new Date(word.timestamp).toLocaleDateString() : '';
                const source = word.source?.title || word.source?.url || '';
                
                csv += `"${word.word}","${translation}","${date}","${source}"\n`;
            });
            
            // 下载文件
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.href = url;
            link.download = `wordsaver_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            
            URL.revokeObjectURL(url);
            this.showMessage('导出成功');
            
        } catch (error) {
            console.error('导出失败:', error);
            this.showMessage('导出失败');
        }
    }

    updateWordCount() {
        const countElement = document.getElementById('word-count');
        if (countElement) {
            countElement.textContent = `共 ${this.filteredWords.length} 个单词`;
        }
    }

    showMessage(message) {
        const messageEl = document.getElementById('message');
        if (messageEl) {
            messageEl.textContent = message;
            messageEl.style.display = 'block';
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 3000);
        }
        console.log(message);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new WordSaverPopup();
}); 