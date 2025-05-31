// 当插件安装或更新时执行
chrome.runtime.onInstalled.addListener(function() {
    console.log("WordSaver 插件已安装");
    
    // 确保右键菜单被创建
    ensureContextMenuCreated();
    
    // 初始化存储
    chrome.storage.local.get(['words', 'translations'], function(items) {
        if (!items.words) {
            chrome.storage.local.set({words: []});
        }
        if (!items.translations) {
            chrome.storage.local.set({translations: {}});
        }
    });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.menuItemId === "saveWord") {
        const selectedText = info.selectionText.trim();
        if (selectedText) {
            // 向当前标签页的内容脚本请求翻译
            chrome.tabs.sendMessage(tab.id, {action: "getClickedWord"}, function(response) {
                if (response && response.word) {
                    const word = response.word;
                    const translation = response.translation || null;
                    
                    saveWordToStorage(word, translation, tab.url, tab.title);
                }
            });
        }
    }
});

// 处理来自content.js的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "contentScriptLoaded") {
        console.log("Content script loaded in tab:", sender.tab?.id);
        // 确保右键菜单被创建
        ensureContextMenuCreated();
        sendResponse({ success: true });
        return true;
    }
    else if (message.action === "saveWord") {
        const word = message.word?.trim();
        if (!word) {
            sendResponse({ error: "无效的单词" });
            return true;
        }
        
        const translation = message.translation || "";
        const pageUrl = message.source || sender.tab?.url || "";
        const pageTitle = message.pageTitle || sender.tab?.title || "";
        
        console.log(`接收到保存单词请求: "${word}", 翻译: "${translation}"`);
        
        saveWordToStorage(word, translation, pageUrl, pageTitle, function(success, exists) {
            if (success) {
                console.log(`单词保存成功: ${word}`);
                sendResponse({ success: true, exists: exists });
            } else {
                console.error(`单词保存失败: ${word}`);
                sendResponse({ error: "保存失败" });
            }
        });
        
        // 返回true表示会异步响应
        return true;
    }
    else if (message.action === "performSearch") {
        const searchTerm = message.searchTerm || "";
        
        performSearch(searchTerm, function(results) {
            sendResponse({ success: true, results: results });
        });
        
        return true;
    }
    else if (message.action === "exportWordList") {
        exportWordList(function(csv) {
            sendResponse({ success: true, csv: csv });
        });
        
        return true;
    }
    else if (message.action === "importWordList") {
        if (!message.csvData) {
            sendResponse({ success: false, message: "未提供数据" });
            return true;
        }
        
        importWordList(message.csvData, function(result) {
            sendResponse(result);
        });
        
        return true;
    }
    else if (message.action === "ping") {
        // 处理ping请求，用于检查扩展状态
        console.log("接收到ping请求，响应以确认扩展正在运行");
        sendResponse({ success: true, action: "pong" });
        return true;
    }
    else if (message.action === "deleteWord") {
        const word = message.word?.trim();
        if (!word) {
            sendResponse({ error: "无效的单词" });
            return true;
        }
        
        console.log(`接收到删除单词请求: "${word}"`);
        
        deleteWordFromStorage(word, function(success) {
            if (success) {
                console.log(`单词删除成功: ${word}`);
                sendResponse({ success: true });
            } else {
                console.error(`单词删除失败: ${word}`);
                sendResponse({ error: "删除失败" });
            }
        });
        
        return true;
    }
    else if (message.action === "getTranslation") {
        const word = message.word?.trim();
        if (!word) {
            sendResponse({ error: "无效的单词" });
            return true;
        }
        
        console.log(`接收到翻译请求: "${word}"`);
        
        // 获取上下文信息
        const context = message.context || {};
        const pageTitle = message.pageTitle || '';
        const pageUrl = message.pageUrl || '';
        
        fetchChineseTranslation(word, context, pageTitle, pageUrl, function(translation) {
            if (translation) {
                console.log(`翻译成功: ${word} -> ${translation}`);
                sendResponse({ success: true, translation: translation });
            } else {
                console.error(`翻译失败: ${word}`);
                sendResponse({ error: "翻译失败" });
            }
        });
        
        return true;
    }
    return false;
});

// 确保右键菜单被创建
function ensureContextMenuCreated() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "saveWord",
            title: "保存这个单词",
            contexts: ["selection"]
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("创建右键菜单失败:", chrome.runtime.lastError.message);
            } else {
                console.log("右键菜单创建成功");
            }
        });
    });
}

// 使用Google翻译前端方法获取中文翻译
function fetchChineseTranslation(word, context, pageTitle, pageUrl, callback) {
    console.log(`正在翻译: ${word}`);
    
    // 使用Google翻译前端方法
    fetchGoogleTranslation(word, context, pageTitle, pageUrl, callback);
}

// 使用Google翻译前端方法获取翻译
function fetchGoogleTranslation(word, context, pageTitle, pageUrl, callback) {
    console.log("尝试使用Google翻译前端方法...");
    
    // 构建Google翻译API请求（不需要API密钥）
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(word)}`;
    
    fetch(url)
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
                    
                    // 同时获取英文定义以提供更丰富的信息
                    tryOnlineDictionary(word, context, pageTitle, pageUrl, (engDefinition) => {
                        // 结合上下文信息构建完整翻译
                        const fullTranslation = buildContextualTranslation(word, translation, engDefinition, context, pageTitle, pageUrl);
                        callback(fullTranslation);
                    });
                } else {
                    console.error("Google翻译响应格式不正确:", data);
                    // 如果Google翻译失败，尝试使用词典API
                    tryOnlineDictionary(word, context, pageTitle, pageUrl, callback);
                }
            } catch (error) {
                console.error("处理Google翻译数据错误:", error);
                // 如果发生错误，尝试使用词典API
                tryOnlineDictionary(word, context, pageTitle, pageUrl, callback);
            }
        })
        .catch(error => {
            console.error("Google翻译API错误:", error);
            // 如果Google翻译彻底失败，尝试使用词典API
            tryOnlineDictionary(word, context, pageTitle, pageUrl, callback);
        });
}

// 根据上下文构建翻译结果
function buildContextualTranslation(word, basicTranslation, engDefinition, context, pageTitle, pageUrl) {
    let result = basicTranslation;
    
    // 添加英文定义
    if (engDefinition && engDefinition !== basicTranslation) {
        result += `\n\n📖 英文释义: ${engDefinition}`;
    }
    
    // 添加上下文信息
    if (context.sentence) {
        result += `\n\n📝 句子语境: "${context.sentence.substring(0, 100)}${context.sentence.length > 100 ? '...' : ''}"`;
    }
    
    // 根据页面类型提供特定建议
    if (context.pageType) {
        const typeHints = {
            'news': '📰 新闻语境中',
            'academic': '🎓 学术语境中',
            'blog': '📝 博客语境中',
            'wiki': '📚 百科语境中',
            'documentation': '📋 技术文档中'
        };
        
        if (typeHints[context.pageType]) {
            result += `\n\n${typeHints[context.pageType]}，此词可能有特定含义`;
        }
    }
    
    // 如果页面标题相关，添加主题提示
    if (pageTitle) {
        const titleWords = pageTitle.toLowerCase().split(/\s+/);
        const isRelated = titleWords.some(titleWord => 
            titleWord.includes(word.toLowerCase()) || 
            word.toLowerCase().includes(titleWord)
        );
        
        if (isRelated) {
            result += `\n\n🎯 与页面主题 "${pageTitle.substring(0, 50)}${pageTitle.length > 50 ? '...' : ''}" 相关`;
        }
    }
    
    return result;
}

// 尝试使用在线词典
function tryOnlineDictionary(word, context, pageTitle, pageUrl, callback) {
    console.log("尝试使用在线词典...");
    
    // 使用免费的词典API
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
    .then(response => {
        if (!response.ok) {
            console.error(`词典API请求失败: ${response.status}`);
            return Promise.reject("词典API请求失败");
        }
        return response.json();
    })
    .then(data => {
        try {
            if (Array.isArray(data) && data.length > 0) {
                // 提取定义并构建"翻译"
                let translation = "";
                
                // 从词典结果构建翻译
                if (data[0].meanings && data[0].meanings.length > 0) {
                    const meanings = data[0].meanings;
                    for (let i = 0; i < Math.min(meanings.length, 2); i++) {
                        const meaning = meanings[i];
                        if (meaning.partOfSpeech) {
                            translation += `[${meaning.partOfSpeech}] `;
                        }
                        if (meaning.definitions && meaning.definitions.length > 0) {
                            translation += meaning.definitions[0].definition;
                            if (i < Math.min(meanings.length, 2) - 1) {
                                translation += "; ";
                            }
                        }
                    }
                }
                
                if (translation) {
                    console.log(`词典定义: ${translation}`);
                    // 使用上下文信息增强翻译
                    const contextualTranslation = buildContextualTranslation(word, translation, '', context, pageTitle, pageUrl);
                    callback(contextualTranslation);
                } else {
                    // 如果没有找到定义，尝试使用谷歌翻译网页
                    fallbackToDirectLink(word, context, pageTitle, pageUrl, callback);
                }
            } else {
                console.error("词典API响应格式不正确:", data);
                fallbackToDirectLink(word, context, pageTitle, pageUrl, callback);
            }
        } catch (error) {
            console.error("处理词典数据错误:", error);
            fallbackToDirectLink(word, context, pageTitle, pageUrl, callback);
        }
    })
    .catch(error => {
        console.error("词典API错误:", error);
        fallbackToDirectLink(word, context, pageTitle, pageUrl, callback);
    });
}

// 最后的备选方案：返回一个谷歌翻译链接
function fallbackToDirectLink(word, context, pageTitle, pageUrl, callback) {
    console.log("使用翻译链接作为最后的备选方案");
    let translation = `请点击查看: https://translate.google.com/?sl=en&tl=zh-CN&text=${encodeURIComponent(word)}`;
    
    // 即使是备选方案，也添加上下文信息
    if (context.sentence) {
        translation += `\n\n📝 出现在: "${context.sentence.substring(0, 80)}${context.sentence.length > 80 ? '...' : ''}"`;
    }
    
    callback(translation);
}

// 统一的保存单词函数
function saveWordToStorage(word, translation, pageUrl, pageTitle, callback) {
    chrome.storage.local.get(['words', 'translations'], function(result) {
        const words = result.words || [];
        const translations = result.translations || {};
        
        // 检查是否已经存在
        const existingWordIndex = words.findIndex(item => item.word === word);
        const exists = existingWordIndex !== -1;
        
        const timestamp = Date.now();
        const date = new Date().toLocaleDateString();
        
        if (exists) {
            console.log(`单词 "${word}" 已存在，更新翻译`);
            // 更新时间戳和日期
            words[existingWordIndex].timestamp = timestamp;
            words[existingWordIndex].date = date;
        } else {
            // 添加新单词到数组
            words.push({
                word: word,
                timestamp: timestamp,
                date: date,
                source: {
                    url: pageUrl,
                    title: pageTitle
                }
            });
            console.log(`添加新单词到存储: ${word}`);
        }
        
        // 保存或更新翻译
        translations[word] = translation;
        
        // 保存到存储
        chrome.storage.local.set({
            words: words,
            translations: translations
        }, function() {
            if (chrome.runtime.lastError) {
                console.error("保存单词失败:", chrome.runtime.lastError);
                callback(false, exists);
            } else {
                console.log(`单词 "${word}" 保存成功`);
                callback(true, exists);
            }
        });
    });
}

// 从存储中删除单词
function deleteWordFromStorage(word, callback) {
    chrome.storage.local.get(['words', 'translations'], function(result) {
        const words = result.words || [];
        const translations = result.translations || {};
        
        // 检查单词是否存在
        const existingWordIndex = words.findIndex(item => item.word === word);
        if (existingWordIndex === -1) {
            console.log(`单词 "${word}" 不存在`);
            callback(false);
            return;
        }
        
        // 删除单词
        words.splice(existingWordIndex, 1);
        delete translations[word];
        
        // 保存更新后的数据
        chrome.storage.local.set({
            words: words,
            translations: translations
        }, function() {
            if (chrome.runtime.lastError) {
                console.error("删除单词失败:", chrome.runtime.lastError);
                callback(false);
            } else {
                console.log(`单词 "${word}" 删除成功`);
                callback(true);
            }
        });
    });
}

// 执行搜索
function performSearch(searchTerm, callback) {
    chrome.storage.local.get({words: []}, function(items) {
        if (!searchTerm || searchTerm.trim() === '') {
            // 按时间倒序返回所有单词
            const sortedWords = items.words.sort((a, b) => b.timestamp - a.timestamp);
            callback(sortedWords);
            return;
        }
        
        searchTerm = searchTerm.toLowerCase().trim();
        
        // 按匹配度和时间排序
        const results = items.words
            .filter(item => item.word.toLowerCase().includes(searchTerm))
            .sort((a, b) => {
                // 先按精确匹配排序
                const aExact = a.word.toLowerCase() === searchTerm;
                const bExact = b.word.toLowerCase() === searchTerm;
                
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                
                // 再按开头匹配排序
                const aStarts = a.word.toLowerCase().startsWith(searchTerm);
                const bStarts = b.word.toLowerCase().startsWith(searchTerm);
                
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                
                // 最后按时间倒序
                return b.timestamp - a.timestamp;
            });
        
        callback(results);
    });
}

// 导出单词列表
function exportWordList(callback) {
    chrome.storage.local.get({words: [], translations: {}}, function(items) {
        // 按字母顺序排序单词
        const sortedWords = items.words.sort((a, b) => 
            a.word.localeCompare(b.word, undefined, {sensitivity: 'base'})
        );
        
        // 创建导出数据
        const exportData = sortedWords.map(item => {
            const translation = items.translations[item.word] || '';
            // 清理HTML标签的简单方法
            const cleanTranslation = translation.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            
            return {
                word: item.word,
                translation: cleanTranslation,
                date: item.date,
                source: item.source.title
            };
        });
        
        // 转换为CSV格式
        let csv = 'Word,Translation,Date,Source\n';
        exportData.forEach(item => {
            // 格式化CSV字段（处理逗号和引号）
            const formatCSV = (field) => {
                if (field.includes(',') || field.includes('"') || field.includes('\n')) {
                    return `"${field.replace(/"/g, '""')}"`;
                }
                return field;
            };
            
            csv += `${formatCSV(item.word)},${formatCSV(item.translation)},${formatCSV(item.date)},${formatCSV(item.source)}\n`;
        });
        
        callback(csv);
    });
}

// 导入单词列表
function importWordList(csvData, callback) {
    try {
        // 解析CSV行
        const lines = csvData.split('\n');
        const header = lines[0].split(',');
        
        // 验证CSV格式
        if (header.length < 2 || !header[0].toLowerCase().includes('word')) {
            callback({success: false, message: 'CSV格式无效，需要至少包含Word和Translation列'});
            return;
        }
        
        // 从存储中获取现有数据
        chrome.storage.local.get({words: [], translations: {}}, function(items) {
            let wordList = items.words;
            let translationDict = items.translations;
            let importCount = 0;
            
            // 从第二行开始处理（跳过标题行）
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                
                // 解析行（考虑引号内的逗号）
                let fields = [];
                let inQuote = false;
                let field = '';
                
                for (let j = 0; j < lines[i].length; j++) {
                    const char = lines[i][j];
                    
                    if (char === '"') {
                        inQuote = !inQuote;
                    } else if (char === ',' && !inQuote) {
                        fields.push(field);
                        field = '';
                    } else {
                        field += char;
                    }
                }
                
                fields.push(field); // 添加最后一个字段
                
                // 提取单词和翻译
                if (fields.length >= 2) {
                    const word = fields[0].replace(/^"|"$/g, '').replace(/""/g, '"').trim();
                    const translation = fields[1].replace(/^"|"$/g, '').replace(/""/g, '"').trim();
                    
                    if (word) {
                        // 检查单词是否已存在
                        const existingIndex = wordList.findIndex(item => 
                            item.word.toLowerCase() === word.toLowerCase()
                        );
                        
                        const timestamp = new Date().getTime();
                        
                        if (existingIndex !== -1) {
                            // 更新现有单词
                            wordList[existingIndex].timestamp = timestamp;
                        } else {
                            // 添加新单词
                            wordList.push({
                                word: word,
                                timestamp: timestamp,
                                date: new Date().toLocaleDateString(),
                                source: {
                                    url: '',
                                    title: '导入的单词'
                                }
                            });
                            importCount++;
                        }
                        
                        // 保存翻译（如果有）
                        if (translation) {
                            translationDict[word] = translation;
                        }
                    }
                }
            }
            
            // 保存更新后的数据
            chrome.storage.local.set({
                words: wordList,
                translations: translationDict
            }, function() {
                callback({success: true, count: importCount});
            });
        });
    } catch (error) {
        console.error('导入单词时出错:', error);
        callback({success: false, message: '导入过程中出错: ' + error.message});
    }
}
