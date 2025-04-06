document.addEventListener("DOMContentLoaded", () => {
    const wordList = document.getElementById("wordList");
    const clearBtn = document.getElementById("clearWords") || document.getElementById("clearButton");
    const exportBtn = document.getElementById("exportWords") || document.getElementById("exportButton");
    const searchInput = document.getElementById("searchInput");
    const noWordsMessage = document.getElementById("noWordsMessage");
    const openOptionsBtn = document.getElementById("openOptions") || document.getElementById("openOptionsBtn") || document.getElementById("settingsButton");
    const importButton = document.getElementById('importButton');
    const importFileInput = document.getElementById('importFileInput');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const settingsButton = document.getElementById('settingsButton');
    const hoverTranslateToggle = document.getElementById('hoverTranslateToggle');

    // 添加日志，用于调试元素查找问题
    console.log("DOM Elements found:", {
        wordList: !!wordList,
        clearBtn: !!clearBtn,
        exportBtn: !!exportBtn,
        searchInput: !!searchInput,
        noWordsMessage: !!noWordsMessage,
        openOptionsBtn: !!openOptionsBtn,
        importButton: !!importButton,
        importFileInput: !!importFileInput,
        loadingIndicator: !!loadingIndicator,
        settingsButton: !!settingsButton,
        hoverTranslateToggle: !!hoverTranslateToggle
    });

    let allWords = []; // 存储所有单词
    let translationCache = {}; // 添加翻译缓存
    
    // 初始化时加载缓存
    loadTranslationCache();
    
    // 加载翻译缓存
    function loadTranslationCache() {
        chrome.storage.local.get(["translationCache"], function(result) {
            if (result.translationCache) {
                translationCache = result.translationCache;
                console.log("已加载翻译缓存，包含", Object.keys(translationCache).length, "个条目");
            } else {
                translationCache = {};
                saveTranslationCache();
            }
        });
    }
    
    // 保存翻译缓存
    function saveTranslationCache() {
        // 限制缓存大小，防止过大
        const cacheEntries = Object.entries(translationCache);
        if (cacheEntries.length > 500) {
            // 如果缓存条目超过500，只保留最近的300个
            const sortedEntries = cacheEntries.sort((a, b) => 
                (b[1].timestamp || 0) - (a[1].timestamp || 0)
            );
            translationCache = Object.fromEntries(sortedEntries.slice(0, 300));
        }
        
        chrome.storage.local.set({ translationCache: translationCache }, function() {
            console.log("翻译缓存已保存，当前包含", Object.keys(translationCache).length, "个条目");
        });
    }
    
    // 从缓存获取翻译，如果不存在则返回null
    function getTranslationFromCache(word) {
        const lowerWord = word.toLowerCase();
        if (translationCache[lowerWord]) {
            // 检查缓存是否过期（7天）
            const cacheAge = Date.now() - (translationCache[lowerWord].timestamp || 0);
            if (cacheAge < 7 * 24 * 60 * 60 * 1000) {
                console.log(`使用缓存的翻译：${word}`);
                return translationCache[lowerWord];
            } else {
                // 删除过期缓存
                delete translationCache[lowerWord];
                saveTranslationCache();
            }
        }
        return null;
    }
    
    // 添加翻译到缓存
    function addTranslationToCache(word, chineseTranslation, englishContent) {
        const lowerWord = word.toLowerCase();
        translationCache[lowerWord] = {
            chinese: chineseTranslation,
            english: englishContent,
            timestamp: Date.now()
        };
        saveTranslationCache();
    }
    
    // 根据关键字渲染单词列表
    function renderWordList(words) {
        // 隐藏加载指示器
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // 清空现有列表
        if (wordList) {
            wordList.innerHTML = '';
        }
        
        // 更新全局单词列表变量
        allWords = words;
        
        // 显示提示信息（如果没有单词）
        if (!words || words.length === 0) {
            if (noWordsMessage) {
                noWordsMessage.style.display = 'block';
            }
            return;
        }
        
        // 隐藏提示信息（如果有单词）
        if (noWordsMessage) {
            noWordsMessage.style.display = 'none';
        }
        
        // 按时间倒序排序单词
        const sortedWords = [...words].sort((a, b) => b.timestamp - a.timestamp);
        
        // 获取翻译数据
        chrome.storage.local.get({translations: {}}, function(items) {
            const translations = items.translations || {};
            
            // 创建单词项
            sortedWords.forEach(item => {
                console.log(`渲染单词: ${item.word}`, item);
                
                // 创建单词项容器
                const wordItem = document.createElement('div');
                wordItem.className = 'word-item';
                
                // 获取翻译（如果有）
                const translation = translations[item.word] || '';
                
                const sourceTitle = item.source ? (item.source.title || item.source.url || '') : '';
                
                // 设置HTML内容
                wordItem.innerHTML = `
                    <div class="word-box">
                        <div class="word-text">${item.word}</div>
                        <div class="word-details">
                            <span class="word-date">${item.date || ''}</span>
                            <span class="word-source" title="${sourceTitle}">${truncateText(sourceTitle, 30)}</span>
                        </div>
                    </div>
                    <div class="action-box">
                        <div class="translation-box">
                            <div id="translation-${item.word.replace(/\s+/g, '-')}" class="translation"></div>
                        </div>
                        <div class="buttons-box">
                            <button class="translate-button">翻译</button>
                            <button class="delete-button" title="删除">×</button>
                        </div>
                    </div>
                `;
                
                // 添加翻译按钮事件
                const translateBtn = wordItem.querySelector('.translate-button');
                translateBtn.addEventListener('click', () => translateWord(item.word));
                
                // 添加删除按钮事件
                const deleteBtn = wordItem.querySelector('.delete-button');
                deleteBtn.addEventListener('click', () => deleteWord(item.word, wordItem));
                
                // 添加到单词列表
                if (wordList) {
                    wordList.appendChild(wordItem);
                }
                
                // 如果有翻译，预先显示
                if (translation) {
                    const translationElement = wordItem.querySelector(`#translation-${item.word.replace(/\s+/g, '-')}`);
                    if (translationElement) {
                        // 将已有翻译直接添加到缓存
                        addTranslationToCache(item.word, translation, "");
                        translationElement.innerHTML = `<div>${translation}</div>`;
                    }
                }
            });
        });
    }
    
    // 删除单个单词
    function deleteWord(word, wordItemElement) {
        chrome.storage.local.get({words: [], translations: {}}, function(items) {
            // 过滤掉要删除的单词
            const updatedWords = items.words.filter(item => item.word !== word);
            
            // 删除翻译
            const updatedTranslations = items.translations;
            delete updatedTranslations[word];
            
            // 保存更新后的数据
            chrome.storage.local.set({
                words: updatedWords,
                translations: updatedTranslations
            }, function() {
                // 从UI中移除
                wordItemElement.remove();
                
                // 如果没有单词了，显示提示信息
                if (updatedWords.length === 0) {
                    noWordsMessage.style.display = 'block';
                }
                
                console.log(`单词已删除: ${word}`);
            });
        });
    }
    
    // 翻译单词
    function translateWord(word) {
        const translationElement = document.getElementById(`translation-${word.replace(/\s+/g, '-')}`);
        
        if (translationElement.innerHTML) {
            // 如果已经有翻译，则切换显示/隐藏
            translationElement.innerHTML = "";
            return;
        }
        
        translationElement.innerHTML = "正在获取翻译...";
        console.log(`正在翻译: ${word}`);
        
        // 先尝试从本地存储获取翻译
        const savedWord = allWords.find(item => item.word === word);
        if (savedWord && savedWord.translation) {
            console.log(`使用已保存的翻译: ${savedWord.translation}`);
            fetchTranslation(word, translationElement, savedWord.translation);
            return;
        }
        
        // 尝试从缓存获取
        const cachedTranslation = getTranslationFromCache(word);
        if (cachedTranslation) {
            // 如果有缓存，直接使用缓存内容
            console.log(`使用缓存翻译`, cachedTranslation);
            displayCachedTranslation(word, translationElement, cachedTranslation);
            
            // 如果单词没有保存翻译，更新它
            if (!savedWord || !savedWord.translation) {
                updateWordTranslation(word, cachedTranslation.chinese);
            }
            return;
        }
        
        // 如果本地和缓存都没有，则从API获取
        fetchTranslation(word, translationElement);
    }
    
    // 显示缓存的翻译
    function displayCachedTranslation(word, translationElement, cachedTranslation) {
        let finalContent = `
            <div class="full-translation">
                <div class="translation-header">
                    <span class="word-text-big">${word}</span>
                    <button class="speak-btn" data-word="${word}" title="朗读单词">🔊</button>
                </div>
                ${cachedTranslation.chinese ? `<div class="chinese-translation">中文: ${cachedTranslation.chinese}</div>` : ''}
                ${cachedTranslation.english ? `<div class="english-definitions">${cachedTranslation.english}</div>` : ''}
            </div>`;
        
        translationElement.innerHTML = finalContent || "未找到翻译信息";
        
        // 为朗读按钮添加事件监听
        const speakBtn = translationElement.querySelector('.speak-btn');
        if (speakBtn) {
            speakBtn.addEventListener('click', function() {
                const wordToSpeak = this.getAttribute('data-word');
                speakWord(wordToSpeak);
            });
        }
    }
    
    // 通用翻译函数 - 整合了所有翻译功能
    function fetchTranslation(word, translationElement, existingTranslation = null) {
        console.log(`开始获取英文单词 ${word} 的释义`);
        
        // 如果已有翻译，直接使用
        if (existingTranslation) {
            displayTranslation(existingTranslation, "");
            // 添加到缓存
            addTranslationToCache(word, existingTranslation, "");
            return;
        }
        
        // 显示加载中状态
        if (translationElement && typeof translationElement.innerHTML !== 'undefined') {
            translationElement.innerHTML = "正在获取翻译...";
        }
        
        // 尝试从词典API获取英文解释
        fetchDictionaryData(word, 1);
        
        // 尝试从词典API获取数据（带重试）
        function fetchDictionaryData(word, attempt = 1) {
            console.log(`尝试从词典API获取数据，第${attempt}次尝试`);
            
            fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                // 设置超时
                signal: AbortSignal.timeout(5000)
            })
            .then(response => {
                if (!response.ok) {
                    console.error(`英文词典API请求失败: ${response.status} ${response.statusText}`);
                    throw new Error(`词典API请求失败: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log(`收到英文词典API响应:`, data);
                // 处理英文释义
                let englishContent = "";
                if (Array.isArray(data) && data.length > 0) {
                    let meanings = data[0].meanings || [];
                    if (meanings.length > 0) {
                        englishContent = meanings.map(m => {
                            if (m.definitions && m.definitions.length > 0) {
                                // 获取例句
                                const example = m.definitions[0].example ? 
                                    `<div class="example">例: ${m.definitions[0].example}</div>` : '';
                                
                                return `<div class="definition-group">
                                    <div class="part-of-speech">${m.partOfSpeech}</div>
                                    <div class="definition">${m.definitions[0].definition}</div>
                                    ${example}
                                </div>`;
                            }
                            return '';
                        }).join('');
                    }
                }
                
                // 获取中文翻译
                console.log(`开始获取中文翻译`);
                getChineseTranslation(word, (chineseTranslation) => {
                    if (chineseTranslation) {
                        console.log(`更新单词翻译: ${chineseTranslation}`);
                        updateWordTranslation(word, chineseTranslation);
                        // 添加到缓存
                        addTranslationToCache(word, chineseTranslation, englishContent);
                    }
                    displayTranslation(chineseTranslation, englishContent);
                });
            })
            .catch(error => {
                console.error(`获取英文翻译失败 (尝试 ${attempt}): ${error.message}`);
                
                // 如果失败且尝试次数小于3，则重试
                if (attempt < 3) {
                    console.log(`等待1秒后重试...`);
                    setTimeout(() => {
                        fetchDictionaryData(word, attempt + 1);
                    }, 1000);
                } else {
                    // 尝试获取中文翻译作为备选
                    console.log(`词典API请求彻底失败，尝试直接获取中文翻译`);
                    getChineseTranslation(word, (chineseTranslation) => {
                        if (chineseTranslation) {
                            updateWordTranslation(word, chineseTranslation);
                            displayTranslation(chineseTranslation, "");
                            // 添加到缓存
                            addTranslationToCache(word, chineseTranslation, "");
                        } else {
                            // 提供所有可能的备用链接
                            const googleTranslateUrl = `https://translate.google.com/?sl=en&tl=zh-CN&text=${encodeURIComponent(word)}`;
                            const cambridgeUrl = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word)}`;
                            const oxfordUrl = `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(word)}`;
                            
                            const fallbackContent = `
                                <div class="full-translation">
                                    <div class="translation-header">
                                        <span class="word-text-big">${word}</span>
                                        <button class="speak-btn" data-word="${word}" title="朗读单词">🔊</button>
                                    </div>
                                    <div class="translation-links">
                                        <div>无法连接词典服务，请尝试：</div>
                                        <div style="margin-top: 8px;">
                                            <a href="${googleTranslateUrl}" target="_blank">Google翻译</a> | 
                                            <a href="${cambridgeUrl}" target="_blank">剑桥词典</a> | 
                                            <a href="${oxfordUrl}" target="_blank">牛津词典</a>
                                        </div>
                                    </div>
                                </div>`;
                                
                            translationElement.innerHTML = fallbackContent;
                            
                            // 为朗读按钮添加事件监听
                            const speakBtn = translationElement.querySelector('.speak-btn');
                            if (speakBtn) {
                                speakBtn.addEventListener('click', function() {
                                    const wordToSpeak = this.getAttribute('data-word');
                                    speakWord(wordToSpeak);
                                });
                            }
                        }
                    });
                }
            });
        }
        
        // 用于显示翻译的内部函数
        function displayTranslation(chineseTranslation, englishContent) {
            let finalContent = `
                <div class="full-translation">
                    <div class="translation-header">
                        <span class="word-text-big">${word}</span>
                        <button class="speak-btn" data-word="${word}" title="朗读单词">🔊</button>
                    </div>
                    ${chineseTranslation ? `<div class="chinese-translation">中文: ${chineseTranslation}</div>` : ''}
                    ${englishContent ? `<div class="english-definitions">${englishContent}</div>` : ''}
                </div>`;
            
            if (translationElement && typeof translationElement.innerHTML !== 'undefined') {
                translationElement.innerHTML = finalContent || "未找到翻译信息";
                
                // 为翻译结果中的朗读按钮添加事件监听
                const speakBtn = translationElement.querySelector('.speak-btn');
                if (speakBtn) {
                    speakBtn.addEventListener('click', function() {
                        const wordToSpeak = this.getAttribute('data-word');
                        speakWord(wordToSpeak);
                    });
                }
            }
        }
    }
    
    // 获取中文翻译 (使用Google翻译前端方法)
    function getChineseTranslation(word, callback) {
        console.log("尝试使用Google翻译前端方法获取中文翻译...");
        
        // 构建Google翻译API请求（不需要API密钥）
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(word)}`;
        
        fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            // 设置超时
            signal: AbortSignal.timeout(5000)
        })
        .then(response => {
            if (!response.ok) {
                console.error(`Google翻译请求失败: ${response.status}`);
                return Promise.reject("Google翻译请求失败");
            }
            return response.json();
        })
        .then(data => {
            try {
                // Google翻译返回的格式：
                // [[["中文翻译","英文原文",null,null,1]],null,"en"]
                if (Array.isArray(data) && data.length > 0 && 
                    Array.isArray(data[0]) && data[0].length > 0 && 
                    Array.isArray(data[0][0]) && data[0][0].length > 0) {
                    
                    const translation = data[0][0][0];
                    console.log(`获取到中文翻译: ${translation}`);
                    callback(translation);
                } else {
                    console.error("Google翻译响应格式不正确:", data);
                    // 如果Google翻译失败，提供谷歌翻译链接
                    const googleTranslateUrl = `https://translate.google.com/?sl=en&tl=zh-CN&text=${encodeURIComponent(word)}`;
                    callback(`<a href="${googleTranslateUrl}" target="_blank">查看谷歌翻译</a>`);
                }
            } catch (error) {
                console.error("处理Google翻译数据错误:", error);
                // 翻译失败时返回谷歌翻译链接
                const googleTranslateUrl = `https://translate.google.com/?sl=en&tl=zh-CN&text=${encodeURIComponent(word)}`;
                callback(`<a href="${googleTranslateUrl}" target="_blank">查看谷歌翻译</a>`);
            }
        })
        .catch(error => {
            console.error("Google翻译API错误:", error);
            // 失败时返回谷歌翻译链接
            const googleTranslateUrl = `https://translate.google.com/?sl=en&tl=zh-CN&text=${encodeURIComponent(word)}`;
            callback(`<a href="${googleTranslateUrl}" target="_blank">查看谷歌翻译</a>`);
        });
    }
    
    // 更新单词的翻译
    function updateWordTranslation(word, translation) {
        if (!translation) return;
        
        chrome.storage.local.get(['wordItems'], function(result) {
            const words = result.wordItems || [];
            const updatedWords = words.map(item => {
                if (item.word === word) {
                    return { ...item, translation: translation };
                }
                return item;
            });
            
            chrome.storage.local.set({ wordItems: updatedWords }, function() {
                allWords = updatedWords;
            });
        });
    }
    
    // 添加复习模式按钮
    const reviewBtn = document.createElement('button');
    reviewBtn.id = 'reviewWords';
    reviewBtn.className = 'review-btn';
    reviewBtn.textContent = '复习模式';
    
    // 创建按钮容器（如果不存在）并添加复习按钮
    let buttonContainer = document.querySelector('.buttons-container');
    if (buttonContainer) {
        buttonContainer.appendChild(reviewBtn);
    } else {
        // 如果找不到.buttons-container，则添加到搜索栏容器或其他合适的父元素
        const searchBar = document.querySelector('.search-bar');
        if (searchBar) {
            // 创建一个新的按钮容器
            buttonContainer = document.createElement('div');
            buttonContainer.className = 'buttons-container review-container';
            buttonContainer.appendChild(reviewBtn);
            searchBar.appendChild(buttonContainer);
        } else {
            // 最后的备选方案：添加到顶部容器
            const container = document.querySelector('.container');
            if (container) {
                buttonContainer = document.createElement('div');
                buttonContainer.className = 'buttons-container review-container';
                buttonContainer.style.cssText = 'margin-top: 10px; display: flex; justify-content: flex-end;';
                buttonContainer.appendChild(reviewBtn);
                container.insertBefore(buttonContainer, document.getElementById('wordList'));
            }
        }
    }
    
    // 复习模式
    let isReviewMode = false;
    let currentWordIndex = 0;
    let reviewWords = [];
    
    reviewBtn.addEventListener('click', () => {
        if (allWords.length === 0) {
            alert('没有单词可以复习');
            return;
        }
        
        isReviewMode = !isReviewMode;
        
        if (isReviewMode) {
            // 开始复习模式
            reviewBtn.textContent = '退出复习';
            reviewBtn.classList.add('active');
            
            // 修复：确保.search-container元素存在，如果不存在则不执行该代码
            const searchContainer = document.querySelector('.search-container');
            if (searchContainer) {
                searchContainer.style.display = 'none';
            } else {
                // 如果搜索容器不存在，尝试隐藏搜索栏相关元素
                const searchBar = document.querySelector('.search-bar');
                if (searchBar) {
                    searchBar.style.display = 'none';
                }
            }
            
            // 准备复习单词
            prepareReviewWords();
            startReviewMode();
        } else {
            // 退出复习模式
            reviewBtn.textContent = '复习模式';
            reviewBtn.classList.remove('active');
            
            // 修复：确保.search-container元素存在，如果不存在则不执行该代码
            const searchContainer = document.querySelector('.search-container');
            if (searchContainer) {
                searchContainer.style.display = 'flex';
            } else {
                // 如果搜索容器不存在，尝试显示搜索栏相关元素
                const searchBar = document.querySelector('.search-bar');
                if (searchBar) {
                    searchBar.style.display = 'flex';
                }
            }
            
            // 恢复正常显示
            displayWords(allWords);
        }
    });
    
    // 准备复习单词列表（应用间隔重复算法）
    function prepareReviewWords() {
        // 获取单词记忆状态
        chrome.storage.local.get(["wordMemoryStatus"], function(result) {
            let wordMemoryStatus = result.wordMemoryStatus || {};
            const now = Date.now();
            
            // 按照间隔重复算法筛选需要复习的单词
            reviewWords = allWords.filter(wordItem => {
                const word = wordItem.word;
                const status = wordMemoryStatus[word.toLowerCase()] || { level: 0, nextReview: 0 };
                
                // 如果下次复习时间已到或尚未设置复习级别，则加入复习列表
                return status.nextReview <= now || status.level === 0;
            });
            
            // 如果没有到期的单词，选择一些随机单词
            if (reviewWords.length < 5 && allWords.length > 0) {
                console.log("没有足够的到期单词，添加一些随机单词");
                
                // 随机选择5个单词加入复习
                const remainingWords = allWords.filter(word => 
                    !reviewWords.some(rw => rw.word === word.word)
                );
                
                // 随机排序
                const shuffled = remainingWords.sort(() => 0.5 - Math.random());
                // 取前几个
                const additionalWords = shuffled.slice(0, Math.min(5, remainingWords.length));
                reviewWords = [...reviewWords, ...additionalWords];
            }
            
            // 随机排序复习单词
            reviewWords = reviewWords.sort(() => 0.5 - Math.random());
            
            // 确保至少有1个单词
            if (reviewWords.length === 0 && allWords.length > 0) {
                reviewWords = [allWords[0]];
            }
            
            currentWordIndex = 0;
            console.log(`准备复习 ${reviewWords.length} 个单词`);
        });
    }
    
    // 开始复习模式
    function startReviewMode() {
        if (reviewWords.length === 0) {
            wordList.innerHTML = `<div class="review-complete">所有单词都已复习完毕!</div>`;
            return;
        }
        
        displayReviewWord(currentWordIndex);
    }
    
    // 显示复习单词
    function displayReviewWord(index) {
        if (index >= reviewWords.length) {
            // 复习完成
            wordList.innerHTML = `
                <div class="review-complete">
                    <h3>复习完成!</h3>
                    <p>你已完成 ${reviewWords.length} 个单词的复习</p>
                    <button id="restartReview" class="review-btn">重新开始</button>
                </div>
            `;
            
            document.getElementById('restartReview').addEventListener('click', () => {
                currentWordIndex = 0;
                // 重新随机排序
                reviewWords = reviewWords.sort(() => 0.5 - Math.random());
                displayReviewWord(currentWordIndex);
            });
            
            return;
        }
        
        const wordItem = reviewWords[index];
        
        // 显示复习界面
        wordList.innerHTML = `
            <div class="review-container">
                <div class="review-progress">
                    <span>${index + 1} / ${reviewWords.length}</span>
                    <div class="progress-bar">
                        <div class="progress" style="width: ${(index + 1) / reviewWords.length * 100}%"></div>
                    </div>
                </div>
                
                <div class="review-word">
                    <h2>${wordItem.word}</h2>
                    <button class="speak-btn review-speak" data-word="${wordItem.word}" title="朗读单词">🔊</button>
                </div>
                
                <div class="review-translation" style="display: none;">
                    ${wordItem.translation || '没有保存翻译'}
                </div>
                
                <div class="review-actions">
                    <button class="show-translation-btn">显示翻译</button>
                    <div class="memory-rating" style="display: none;">
                        <p>这个单词你记得怎么样?</p>
                        <div class="rating-buttons">
                            <button class="rating-btn" data-rating="1">不熟悉</button>
                            <button class="rating-btn" data-rating="2">有点印象</button>
                            <button class="rating-btn" data-rating="3">比较熟悉</button>
                            <button class="rating-btn" data-rating="4">完全记住</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 添加事件监听
        // 发音按钮
        document.querySelector('.review-speak').addEventListener('click', function() {
            const wordToSpeak = this.getAttribute('data-word');
            speakWord(wordToSpeak);
        });
        
        // 显示翻译按钮
        document.querySelector('.show-translation-btn').addEventListener('click', function() {
            document.querySelector('.review-translation').style.display = 'block';
            this.style.display = 'none';
            document.querySelector('.memory-rating').style.display = 'block';
        });
        
        // 记忆评级按钮
        document.querySelectorAll('.rating-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const rating = parseInt(this.getAttribute('data-rating'));
                updateMemoryStatus(wordItem.word, rating);
                
                // 延迟一点再进入下一个单词，给用户一点反馈时间
                setTimeout(() => {
                    currentWordIndex++;
                    displayReviewWord(currentWordIndex);
                }, 500);
            });
        });
    }
    
    // 更新单词记忆状态
    function updateMemoryStatus(word, rating) {
        chrome.storage.local.get(["wordMemoryStatus"], function(result) {
            let wordMemoryStatus = result.wordMemoryStatus || {};
            const lowerWord = word.toLowerCase();
            
            // 获取当前状态
            let status = wordMemoryStatus[lowerWord] || { level: 0, nextReview: 0 };
            
            // 根据评级更新记忆级别
            // 级别范围: 0-5，表示记忆熟悉度
            // 1-3评级: 降低或略微提高级别
            // 4评级: 显著提高级别
            if (rating === 1) {
                // 不熟悉: 重置为级别0
                status.level = 0;
            } else if (rating === 2) {
                // 有点印象: 维持当前级别或略微降低
                status.level = Math.max(0, status.level - 1);
            } else if (rating === 3) {
                // 比较熟悉: 略微提高级别
                status.level = Math.min(5, status.level + 1);
            } else if (rating === 4) {
                // 完全记住: 显著提高级别
                status.level = Math.min(5, status.level + 2);
            }
            
            // 计算下次复习时间（使用指数间隔）
            // 级别0: 1小时后
            // 级别1: 1天后
            // 级别2: 3天后
            // 级别3: 7天后
            // 级别4: 14天后
            // 级别5: 30天后
            const intervals = [
                1 * 60 * 60 * 1000,     // 1小时
                1 * 24 * 60 * 60 * 1000, // 1天
                3 * 24 * 60 * 60 * 1000, // 3天
                7 * 24 * 60 * 60 * 1000, // 7天
                14 * 24 * 60 * 60 * 1000, // 14天
                30 * 24 * 60 * 60 * 1000  // 30天
            ];
            
            status.nextReview = Date.now() + intervals[status.level];
            status.lastReviewed = Date.now();
            
            // 保存更新后的状态
            wordMemoryStatus[lowerWord] = status;
            chrome.storage.local.set({ wordMemoryStatus: wordMemoryStatus }, function() {
                console.log(`更新 ${word} 的记忆状态: 级别 ${status.level}, 下次复习: ${new Date(status.nextReview).toLocaleString()}`);
            });
        });
    }
    
    // 导出单词列表
    if (exportBtn) {
        exportBtn.addEventListener("click", () => {
            if (allWords.length === 0) {
                alert("没有可导出的单词");
                return;
            }
            
            const exportData = allWords.map(item => {
                return `${item.word},${item.translation || ''},${item.date || ''}`;
            }).join("\n");
            
            const blob = new Blob([exportData], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'words_export.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    } else {
        console.warn("导出按钮元素未找到，无法添加事件监听器");
    }

    // 读取存储的单词
    chrome.storage.local.get({ wordItems: [] }, (data) => {
        allWords = data.wordItems || [];
        renderWordList(allWords);
    });

    // 搜索单词
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const searchTerm = searchInput.value.toLowerCase();
            if (searchTerm) {
                const filteredWords = allWords.filter(item => 
                    item.word.toLowerCase().includes(searchTerm) || 
                    (item.translation && item.translation.includes(searchTerm))
                );
                renderWordList(filteredWords);
            } else {
                renderWordList(allWords);
            }
        });
    } else {
        console.warn("搜索输入框元素未找到，无法添加事件监听器");
    }

    // 清空单词
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (confirm("确定要清空所有单词吗？")) {
                chrome.storage.local.set({ wordItems: [] }, () => {
                    allWords = [];
                    renderWordList(allWords);
                });
            }
        });
    } else {
        console.warn("清空按钮元素未找到，无法添加事件监听器");
    }

    // 打开设置页面
    if (openOptionsBtn) {
        openOptionsBtn.addEventListener('click', function() {
            if (chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                window.open(chrome.runtime.getURL('options.html'));
            }
        });
    } else {
        console.warn("设置按钮元素未找到，无法添加事件监听器");
    }

    // 朗读单词
    function speakWord(word) {
        console.log(`朗读单词: ${word}`);
        
        // 使用浏览器内置的语音合成API
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US'; // 设置英语发音
        utterance.rate = 0.9; // 稍微放慢速度
        utterance.pitch = 1;
        
        // 获取可用的语音列表
        const voices = speechSynthesis.getVoices();
        // 尝试寻找更好的英语语音
        const englishVoice = voices.find(voice => 
            voice.lang.includes('en') && 
            (voice.name.includes('Google') || voice.name.includes('Female') || voice.name.includes('Male'))
        );
        
        if (englishVoice) {
            utterance.voice = englishVoice;
        }
        
        speechSynthesis.speak(utterance);
    }

    // 显示所有单词（修复函数名错误）
    function displayWords(words) {
        renderWordList(words);
    }

    // 导入功能
    if (importButton && importFileInput) {
        importButton.addEventListener('click', function() {
            importFileInput.click();
        });
        
        importFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            // 检查文件类型
            if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
                alert('请选择CSV文件');
                return;
            }
            
            // 显示加载指示器
            if (loadingIndicator) {
                loadingIndicator.style.display = 'block';
            }
            
            const reader = new FileReader();
            reader.onload = function(event) {
                const csvData = event.target.result;
                
                chrome.runtime.getBackgroundPage(function(bg) {
                    if (bg && typeof bg.importWordList === 'function') {
                        bg.importWordList(csvData, function(result) {
                            // 隐藏加载指示器
                            if (loadingIndicator) {
                                loadingIndicator.style.display = 'none';
                            }
                            
                            if (result.success) {
                                alert(`成功导入 ${result.count} 个新单词`);
                                // 重新加载单词列表
                                loadWords();
                            } else {
                                alert('导入失败: ' + result.message);
                            }
                        });
                    } else {
                        if (loadingIndicator) {
                            loadingIndicator.style.display = 'none';
                        }
                        alert('无法访问后台导入功能');
                    }
                });
            };
            
            reader.onerror = function() {
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
                alert('读取文件时出错');
            };
            
            reader.readAsText(file);
        });
    } else {
        console.warn("导入按钮或文件输入元素未找到，无法添加事件监听器");
    }

    // 加载单词列表
    function loadWords() {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
        
        try {
            // 使用消息传递代替直接访问background页面
            chrome.runtime.sendMessage({ action: "performSearch", searchTerm: "" }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error("发送消息失败:", chrome.runtime.lastError);
                    // 备用方案：直接从存储读取单词
                    loadWordsFromStorage();
                    return;
                }
                
                if (response && response.success && response.results) {
                    console.log(`加载到 ${response.results.length} 个单词`);
                    renderWordList(response.results);
                } else {
                    console.warn("无法从后台获取单词列表，使用备用方法");
                    loadWordsFromStorage();
                }
            });
        } catch (error) {
            console.error("加载单词列表时出错:", error);
            // 出错时也使用备用方案
            loadWordsFromStorage();
        }
    }

    // 直接从存储加载单词的备用函数
    function loadWordsFromStorage() {
        console.log("直接从存储加载单词列表");
        chrome.storage.local.get({words: []}, function(items) {
            if (chrome.runtime.lastError) {
                console.error("从存储加载单词失败:", chrome.runtime.lastError);
                // 最后的备选方案：显示空列表
                renderWordList([]);
                return;
            }

            console.log(`从存储加载到 ${items.words ? items.words.length : 0} 个单词`);
            const sortedWords = items.words.sort((a, b) => b.timestamp - a.timestamp);
            renderWordList(sortedWords);
        });
    }

    // 截断文本
    function truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    // 设置按钮
    if (settingsButton) {
        settingsButton.addEventListener('click', function() {
            if (chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                window.open(chrome.runtime.getURL('options.html'));
            }
        });
    } else {
        console.warn("设置按钮元素未找到，无法添加事件监听器");
    }

    // 初始化悬停翻译开关
    if (hoverTranslateToggle) {
        // 从存储加载悬停翻译设置
        chrome.storage.local.get({hoverTranslateEnabled: true}, function(result) {
            hoverTranslateToggle.checked = result.hoverTranslateEnabled;
            
            // 监听开关变化
            hoverTranslateToggle.addEventListener('change', function() {
                const isEnabled = this.checked;
                // 保存设置到存储
                chrome.storage.local.set({hoverTranslateEnabled: isEnabled}, function() {
                    console.log(`悬停翻译已${isEnabled ? '启用' : '禁用'}`);
                    
                    // 通知所有标签页更新悬停翻译设置
                    chrome.tabs.query({}, function(tabs) {
                        tabs.forEach(tab => {
                            if (tab.id) {
                                chrome.tabs.sendMessage(tab.id, {
                                    action: "updateHoverTranslate", 
                                    enabled: isEnabled
                                }).catch(err => {
                                    // 忽略不能发送消息的标签页（通常是系统页面）
                                    console.log(`无法发送消息到标签页 ${tab.id}: ${err.message}`);
                                });
                            }
                        });
                    });
                });
            });
        });
    }

    // 添加一个直接保存单词的功能
    function saveWordDirectly(word, translation, source, callback) {
        console.log(`直接保存单词: "${word}"`);
        
        // 先尝试通过消息发送到background.js
        try {
            chrome.runtime.sendMessage({
                action: 'saveWord',
                word: word,
                translation: translation || '',
                source: source?.url || '',
                pageTitle: source?.title || '手动添加'
            }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error("发送保存消息失败:", chrome.runtime.lastError);
                    // 备用方案：直接保存到存储
                    saveWordToStorageDirectly(word, translation, source, callback);
                    return;
                }
                
                if (response && response.success) {
                    console.log(`通过后台保存单词成功: ${word}`);
                    loadWords(); // 刷新列表
                    if (callback) callback(true, response.exists);
                } else {
                    console.warn("后台保存单词失败，使用备用方法");
                    saveWordToStorageDirectly(word, translation, source, callback);
                }
            });
        } catch (error) {
            console.error("尝试保存单词时出错:", error);
            saveWordToStorageDirectly(word, translation, source, callback);
        }
    }

    // 直接保存到存储的内部函数
    function saveWordToStorageDirectly(word, translation, source, callback) {
        // 格式化数据
        const timestamp = new Date().getTime();
        const wordData = {
            word: word,
            timestamp: timestamp,
            date: new Date().toLocaleDateString(),
            source: {
                url: source?.url || "",
                title: source?.title || source?.url || "从扩展添加"
            }
        };
        
        // 保存到存储
        chrome.storage.local.get({words: [], translations: {}}, function(items) {
            if (chrome.runtime.lastError) {
                console.error("获取存储数据失败:", chrome.runtime.lastError);
                if (callback) callback(false);
                return;
            }
            
            // 检查单词是否已存在
            const existingWordIndex = items.words.findIndex(item => 
                item.word.toLowerCase() === word.toLowerCase()
            );
            
            let exists = false;
            
            // 如果存在，则更新时间戳和来源
            if (existingWordIndex !== -1) {
                exists = true;
                items.words[existingWordIndex].timestamp = timestamp;
                items.words[existingWordIndex].date = wordData.date;
                // 只有在提供了新来源的情况下才更新
                if (source && (source.url || source.title)) {
                    items.words[existingWordIndex].source = wordData.source;
                }
            } else {
                // 否则添加新单词
                items.words.push(wordData);
            }
            
            // 保存翻译（如果有）
            if (translation) {
                items.translations[word] = translation;
            }
            
            // 更新存储
            chrome.storage.local.set({
                words: items.words,
                translations: items.translations
            }, function() {
                if (chrome.runtime.lastError) {
                    console.error("保存到存储失败:", chrome.runtime.lastError);
                    if (callback) callback(false);
                    return;
                }
                
                console.log(`直接保存单词成功: ${word}`);
                
                // 更新allWords和UI
                allWords = items.words;
                
                // 刷新单词列表
                loadWords();
                
                if (callback) callback(true, exists);
            });
        });
    }

    // 添加单词按钮
    const addWordBtn = document.createElement('button');
    addWordBtn.id = 'addWord';
    addWordBtn.className = 'action-button';
    addWordBtn.textContent = '添加单词';
    addWordBtn.title = '手动添加单词';

    // 将按钮添加到按钮容器
    const buttonsContainer = document.querySelector('.buttons-container');
    if (buttonsContainer) {
        buttonsContainer.prepend(addWordBtn);
    }

    // 添加单词按钮点击事件
    addWordBtn.addEventListener('click', handleAddWordClick);

    // 添加单词按钮点击事件处理函数
    function handleAddWordClick() {
        const word = prompt('请输入要添加的单词:');
        if (word && word.trim()) {
            const trimmedWord = word.trim();
            // 直接尝试保存单词
            saveWordDirectly(trimmedWord, '', null, function(success) {
                if (success) {
                    alert(`已添加单词: ${trimmedWord}`);
                } else {
                    alert('添加单词失败');
                }
            });
        }
    }

    // 在初始化完成后，立即加载单词列表
    loadWords();
});
