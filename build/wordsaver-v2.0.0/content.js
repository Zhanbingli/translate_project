// 通知后台脚本该内容脚本已加载
console.log("WordSaver 插件已加载！");
chrome.runtime.sendMessage({ action: "contentScriptLoaded" });

// 全局设置变量
let isHoverTranslateEnabled = true;
let phraseSelectionMode = false;
let keyboardShortcutEnabled = false; // 默认关闭快捷键, 方便调试
let keyboardShortcut = { key: 'Alt', pressed: false };
let isAutoHide = true;
let whiteList = [];
let autoPlayAudio = false;
let hoverDelay = 300;
let translationCache = {};
let lastHoveredWord = '';
let lastTranslation = '';
let hoverTimeout = null;
let currentHostname = window.location.hostname;

// 创建样式元素
const highlightStyle = document.createElement('style');
highlightStyle.textContent = `
.wordsaver-highlight {
    background-color: rgba(255, 255, 0, 0.3);
    border-radius: 2px;
    cursor: pointer;
}`;
document.head.appendChild(highlightStyle);

// 创建工具提示元素
const tooltip = document.createElement('div');
tooltip.id = 'wordsaver-tooltip';
tooltip.style.cssText = `
    position: absolute;
    display: none;
    z-index: 99999;
    background-color: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 3px 15px rgba(0,0,0,0.2);
    padding: 15px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 16px;
    max-width: 350px;
    line-height: 1.6;
    color: #222;
`;

// 创建箭头元素
const tooltipArrow = document.createElement('div');
tooltipArrow.id = 'wordsaver-tooltip-arrow';
tooltipArrow.style.cssText = `
    position: absolute;
    width: 0; 
    height: 0; 
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 8px solid white;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    filter: drop-shadow(0 -1px 0 #ddd);
    z-index: 99999;
    display: none;
`;
tooltip.appendChild(tooltipArrow);
document.body.appendChild(tooltip);

// 创建悬停控制区域
const hoverControlArea = document.createElement('div');
hoverControlArea.id = 'wordsaver-hover-control';
hoverControlArea.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 99998;
    width: 40px;
    height: 40px;
    opacity: 1; /* 修改为默认可见 */
    transition: opacity 0.3s ease;
`;
document.body.appendChild(hoverControlArea);

// 创建悬停切换按钮
const hoverToggle = document.createElement('div');
hoverToggle.id = 'wordsaver-hover-toggle';
hoverToggle.style.cssText = `
    position: absolute;
    bottom: 0;
    right: 0;
    width: 40px;
    height: 40px;
    background-color: #4285f4;
    border-radius: 50%;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    color: white;
    text-align: center;
    line-height: 40px;
    font-weight: bold;
    cursor: pointer;
    font-size: 18px;
    user-select: none;
`;
hoverToggle.innerHTML = 'W';
hoverToggle.title = '悬停翻译设置';
hoverControlArea.appendChild(hoverToggle);

// 创建悬停菜单
const hoverMenu = document.createElement('div');
hoverMenu.id = 'wordsaver-hover-menu';
hoverMenu.style.cssText = `
    position: absolute;
    bottom: 50px;
    right: 0;
    width: 200px;
    background-color: white;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    padding: 10px;
    display: none;
`;

// 添加菜单项
const menuItems = [
    { id: 'toggle-hover', text: '开启悬停翻译', checked: true },
    { id: 'toggle-phrase', text: '短语翻译模式', checked: false },
    { id: 'toggle-shortcut', text: '键盘快捷键 (Alt)', checked: true },
    { id: 'toggle-autohide', text: '自动隐藏按钮', checked: true },
    { id: 'add-site', text: '将本站添加到白名单', checked: false },
    { id: 'remove-site', text: '从白名单移除本站', checked: false }
];

menuItems.forEach(item => {
    const menuItem = document.createElement('div');
    menuItem.className = 'wordsaver-menu-item';
    menuItem.dataset.id = item.id;
    menuItem.style.cssText = `
        padding: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        border-bottom: 1px solid #eee;
    `;
    
    if (item.id === 'add-site' || item.id === 'remove-site') {
        menuItem.innerHTML = item.text;
    } else {
        const checkbox = document.createElement('span');
        checkbox.className = 'wordsaver-checkbox';
        checkbox.style.cssText = `
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 1px solid #ccc;
            border-radius: 3px;
            margin-right: 8px;
            background-color: ${item.checked ? '#4285f4' : 'white'};
        `;
        
        menuItem.appendChild(checkbox);
        menuItem.appendChild(document.createTextNode(item.text));
    }
    
    menuItem.addEventListener('click', () => handleMenuItemClick(item.id));
    hoverMenu.appendChild(menuItem);
});

hoverControlArea.appendChild(hoverMenu);

// 显示通知
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 70px;
        right: 20px;
        padding: 10px 15px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        border-radius: 4px;
        z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        max-width: 250px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s ease';
        setTimeout(() => notification.remove(), 500);
    }, 2000);
}

// 处理菜单项点击
function handleMenuItemClick(id) {
    switch (id) {
        case 'toggle-hover':
            isHoverTranslateEnabled = !isHoverTranslateEnabled;
            updateMenuCheckbox('toggle-hover', isHoverTranslateEnabled);
            showNotification(`悬停翻译已${isHoverTranslateEnabled ? '开启' : '关闭'}`);
            break;
        case 'toggle-phrase':
            phraseSelectionMode = !phraseSelectionMode;
            updateMenuCheckbox('toggle-phrase', phraseSelectionMode);
            showNotification(`短语翻译模式已${phraseSelectionMode ? '开启' : '关闭'}`);
            break;
        case 'toggle-shortcut':
            keyboardShortcutEnabled = !keyboardShortcutEnabled;
            updateMenuCheckbox('toggle-shortcut', keyboardShortcutEnabled);
            showNotification(`键盘快捷键已${keyboardShortcutEnabled ? '开启' : '关闭'}`);
            break;
        case 'toggle-autohide':
            isAutoHide = !isAutoHide;
            updateMenuCheckbox('toggle-autohide', isAutoHide);
            showNotification(`自动隐藏按钮已${isAutoHide ? '开启' : '关闭'}`);
            break;
        case 'add-site':
            if (!whiteList.includes(currentHostname)) {
                whiteList.push(currentHostname);
                showNotification(`已将 ${currentHostname} 添加到白名单`);
                updateSiteMenuVisibility();
            }
            break;
        case 'remove-site':
            whiteList = whiteList.filter(site => site !== currentHostname);
            showNotification(`已将 ${currentHostname} 从白名单移除`);
            updateSiteMenuVisibility();
            break;
    }
    
    saveSettings();
}

// 更新菜单复选框
function updateMenuCheckbox(id, checked) {
    const menuItem = hoverMenu.querySelector(`[data-id="${id}"]`);
    if (menuItem) {
        const checkbox = menuItem.querySelector('.wordsaver-checkbox');
        if (checkbox) {
            checkbox.style.backgroundColor = checked ? '#4285f4' : 'white';
        }
    }
}

// 更新网站菜单项可见性
function updateSiteMenuVisibility() {
    const addSiteItem = hoverMenu.querySelector('[data-id="add-site"]');
    const removeSiteItem = hoverMenu.querySelector('[data-id="remove-site"]');
    
    if (whiteList.includes(currentHostname)) {
        addSiteItem.style.display = 'none';
        removeSiteItem.style.display = 'flex';
    } else {
        addSiteItem.style.display = 'flex';
        removeSiteItem.style.display = 'none';
    }
}

// 保存设置到本地存储
function saveSettings() {
    chrome.storage.local.set({
        hoverTranslateEnabled: isHoverTranslateEnabled,
        phraseSelectionMode: phraseSelectionMode,
        keyboardShortcutEnabled: keyboardShortcutEnabled,
        isAutoHide: isAutoHide,
        whiteList: whiteList,
        autoPlayAudio: autoPlayAudio
    });
}

// 从本地存储加载设置
function loadSettings() {
    chrome.storage.local.get({
        hoverTranslateEnabled: true,
        phraseSelectionMode: false,
        keyboardShortcutEnabled: false, // 默认关闭快捷键
        isAutoHide: true,
        whiteList: [],
        autoPlayAudio: false,
        hoverDelay: 300,
        translations: {}
    }, function(items) {
        isHoverTranslateEnabled = items.hoverTranslateEnabled;
        phraseSelectionMode = items.phraseSelectionMode;
        keyboardShortcutEnabled = items.keyboardShortcutEnabled;
        isAutoHide = items.isAutoHide;
        whiteList = items.whiteList;
        autoPlayAudio = items.autoPlayAudio;
        hoverDelay = items.hoverDelay;
        translationCache = items.translations || {};
        
        console.log("加载设置:", {
            hoverTranslateEnabled: isHoverTranslateEnabled,
            phraseSelectionMode: phraseSelectionMode,
            keyboardShortcutEnabled: keyboardShortcutEnabled,
            whiteList: whiteList,
            currentHostname: currentHostname
        });
        
        // 更新菜单状态
        updateMenuCheckbox('toggle-hover', isHoverTranslateEnabled);
        updateMenuCheckbox('toggle-phrase', phraseSelectionMode);
        updateMenuCheckbox('toggle-shortcut', keyboardShortcutEnabled);
        updateMenuCheckbox('toggle-autohide', isAutoHide);
        updateSiteMenuVisibility();
        
        // 根据自动隐藏设置调整按钮可见性
        if (isAutoHide) {
            // 即使自动隐藏，也先短暂显示按钮提示用户
            hoverControlArea.style.opacity = '1';
            setTimeout(() => {
                // 2秒后如果菜单未打开，则开始自动隐藏
                if (hoverMenu.style.display !== 'block') {
                    hoverControlArea.style.opacity = '0.3'; // 不完全隐藏，保留轻微可见度
                }
            }, 2000);
        } else {
            // 不自动隐藏时，始终显示
            hoverControlArea.style.opacity = '1';
        }
    });
}

// 页面加载时初始化设置
loadSettings();

// 显示工具提示
function showTooltip(word, translation, x, y) {
    // 清除前一个翻译的暂存
    lastHoveredWord = word;
    lastTranslation = translation;
    
    // 显示翻译内容
    tooltip.innerHTML = `
        <div id="wordsaver-tooltip-arrow" style="
            position: absolute;
            width: 0; 
            height: 0; 
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-bottom: 8px solid white;
            top: -8px;
            left: 50%;
            transform: translateX(-50%);
            filter: drop-shadow(0 -1px 0 #ddd);
            z-index: 99999;
        "></div>
        <div style="margin-bottom: 12px; font-weight: 600; font-size: 20px; color: #4285f4; border-bottom: 1px solid #eee; padding-bottom: 8px;">${word}</div>
        <div style="font-size: 15px; color: #333; max-height: 300px; overflow-y: auto; padding-right: 5px;">${translation}</div>
        <div class="tooltip-actions" style="display: flex; margin-top: 12px; justify-content: space-between; padding-top: 8px; border-top: 1px solid #eee;">
            <button id="wordsaver-speak" style="background-color: #4285f4; color: white; border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer; font-size: 14px; font-weight: 500;">
                <span style="font-size: 16px;">🔊</span> 发音
            </button>
            <button id="wordsaver-save" style="background-color: #0f9d58; color: white; border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer; font-size: 14px; font-weight: 500;">
                保存单词
            </button>
        </div>
    `;
    
    // 设置工具提示位置，确保不超出屏幕边界
    const tooltipWidth = 350; // 最大宽度
    const tooltipHeight = 200; // 估计高度
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // 计算正确的位置 - 优先显示在单词下方
    let tooltipX = x - tooltipWidth / 2; // 居中显示在鼠标位置下方
    let tooltipY = y + 20; // 默认显示在单词下方，有一定的间距
    let arrowTop = true; // 箭头是否在顶部
    
    // 确保不超出左边界
    if (tooltipX < 10) {
        tooltipX = 10;
    }
    
    // 确保不超出右边界
    if (tooltipX + tooltipWidth > windowWidth - 10) {
        tooltipX = windowWidth - tooltipWidth - 10;
    }
    
    // 如果下方空间不足，则显示在单词上方
    if (tooltipY + tooltipHeight > windowHeight - 10) {
        tooltipY = y - tooltipHeight - 10;
        arrowTop = false; // 箭头应该在底部
        
        // 如果上方也不够，尽量显示在视窗内
        if (tooltipY < 10) {
            tooltipY = 10;
            arrowTop = true; // 恢复到顶部箭头
            
            // 如果窗口太小，考虑减小工具提示高度或调整位置
            if (tooltipHeight > windowHeight - 20) {
                tooltip.style.maxHeight = `${windowHeight - 20}px`;
                tooltip.style.overflowY = 'auto';
            }
        }
    }
    
    tooltip.style.left = `${tooltipX}px`;
    tooltip.style.top = `${tooltipY}px`;
    tooltip.style.display = 'block';
    
    // 获取并配置箭头
    const arrow = document.getElementById('wordsaver-tooltip-arrow');
    if (arrow) {
        if (arrowTop) {
            // 箭头在顶部（指向上方）
            arrow.style.top = '-8px';
            arrow.style.bottom = 'auto';
            arrow.style.borderTop = '0';
            arrow.style.borderBottom = '8px solid white';
            
            // 计算箭头水平位置（跟随光标）
            let arrowX = Math.max(Math.min(x - tooltipX, tooltipWidth - 20), 20);
            arrow.style.left = `${arrowX}px`;
            arrow.style.transform = 'translateX(-50%)';
        } else {
            // 箭头在底部（指向下方）
            arrow.style.top = 'auto';
            arrow.style.bottom = '-8px';
            arrow.style.borderTop = '8px solid white';
            arrow.style.borderBottom = '0';
            
            // 计算箭头水平位置（跟随光标）
            let arrowX = Math.max(Math.min(x - tooltipX, tooltipWidth - 20), 20);
            arrow.style.left = `${arrowX}px`;
            arrow.style.transform = 'translateX(-50%)';
        }
        arrow.style.display = 'block';
    }
    
    // 添加发音按钮事件监听
    document.getElementById('wordsaver-speak').addEventListener('click', () => speakWord(word));
    
    // 添加保存按钮事件监听
    document.getElementById('wordsaver-save').addEventListener('click', () => saveWord(word, translation));
    
    // 如果设置了自动发音，自动播放
    if (autoPlayAudio) {
        speakWord(word);
    }
}

// 隐藏工具提示
function hideTooltip() {
    tooltip.style.display = 'none';
}

// 生成语音播放单词
function speakWord(word) {
    if (!window.speechSynthesis) {
        console.error('您的浏览器不支持语音合成API');
        return;
    }
    
    // 停止任何当前播放的语音
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    
    // 获取可用的语音列表
    const voices = window.speechSynthesis.getVoices();
    
    // 尝试找到英语语音
    let englishVoice = voices.find(voice => voice.lang.includes('en') && voice.name.includes('Google'));
    if (!englishVoice) {
        englishVoice = voices.find(voice => voice.lang.includes('en'));
    }
    
    if (englishVoice) {
        utterance.voice = englishVoice;
    }
    
    window.speechSynthesis.speak(utterance);
}

// 获取中文翻译
function fetchChineseTranslation(word) {
    return new Promise((resolve, reject) => {
        console.log(`正在获取中文翻译: ${word}`);
        
        // 使用Google翻译API
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(word)}`;
        
        fetch(url, {
            signal: AbortSignal.timeout(5000)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`翻译请求失败: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (Array.isArray(data) && data[0] && Array.isArray(data[0]) && data[0][0]) {
                const translation = data[0][0][0];
                console.log(`获取到中文翻译: ${translation}`);
                resolve(translation);
            } else {
                console.warn("Google翻译返回数据格式不正确");
                resolve("");
            }
        })
        .catch(error => {
            console.error("获取中文翻译出错:", error);
            resolve(""); // 返回空字符串而不是失败，让流程继续
        });
    });
}

// 获取英文词典定义
function fetchDictionaryDefinition(word) {
    return new Promise((resolve, reject) => {
        console.log(`正在获取英文定义: ${word}`);
        
        fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
            signal: AbortSignal.timeout(5000)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`词典API请求失败: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (Array.isArray(data) && data.length > 0 && data[0].meanings) {
                // 创建一个格式优美的定义内容
                let definitionHtml = '';
                
                for (let i = 0; i < Math.min(data[0].meanings.length, 3); i++) {
                    const meaning = data[0].meanings[i];
                    if (meaning.partOfSpeech && meaning.definitions && meaning.definitions.length > 0) {
                        definitionHtml += `
                            <div style="margin-bottom: 8px;">
                                <span style="color: #4285f4; font-weight: 500;">[${meaning.partOfSpeech}]</span> 
                                <span style="color: #333;">${meaning.definitions[0].definition}</span>
                            </div>`;
                        
                        // 添加一个例句（如果有）
                        if (meaning.definitions[0].example) {
                            definitionHtml += `
                                <div style="color: #666; font-style: italic; margin-left: 15px; margin-bottom: 8px; font-size: 14px;">
                                    "${meaning.definitions[0].example}"
                                </div>`;
                        }
                    }
                }
                
                // 添加音标（如果有）
                if (data[0].phonetics && data[0].phonetics.length > 0) {
                    const phonetic = data[0].phonetics.find(p => p.text) || data[0].phonetics[0];
                    if (phonetic && phonetic.text) {
                        definitionHtml = `
                            <div style="margin-bottom: 8px; color: #666;">
                                ${phonetic.text}
                            </div>` + definitionHtml;
                    }
                }
                
                resolve(definitionHtml);
            } else {
                resolve("");
            }
        })
        .catch(error => {
            console.error("获取英文定义出错:", error);
            resolve(""); // 返回空字符串而不是失败，让流程继续
        });
    });
}

// 获取备用链接
function getFallbackLinks(word) {
    console.log('使用备用链接');
    
    const googleTranslateLink = `<a href="https://translate.google.com/?sl=en&tl=zh-CN&text=${encodeURIComponent(word)}" target="_blank" style="color: #1a73e8; text-decoration: none;">Google翻译</a>`;
    const cambridgeLink = `<a href="https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word)}" target="_blank" style="color: #1a73e8; text-decoration: none;">剑桥词典</a>`;
    const oxfordLink = `<a href="https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(word)}" target="_blank" style="color: #1a73e8; text-decoration: none;">牛津词典</a>`;
    
    return `
        <div style="padding: 5px; background-color: #f9f9f9; border-radius: 5px; margin-top: 5px;">
            <div style="color: #666;">无法获取翻译，请尝试：</div>
            <div style="margin-top: 8px; display: flex; justify-content: space-between;">
                ${googleTranslateLink} · ${cambridgeLink} · ${oxfordLink}
            </div>
        </div>
    `;
}

// 保存翻译缓存
function saveTranslationCache() {
    // 检查缓存大小
    chrome.storage.local.get(['maxCacheSize'], function(items) {
        const maxCacheSize = items.maxCacheSize || 500;
        
        // 如果缓存超过大小限制，删除最旧的条目
        const entries = Object.entries(translationCache);
        if (entries.length > maxCacheSize) {
            // 排序按最新添加时间，删除最旧的条目
            translationCache = Object.fromEntries(entries.slice(-maxCacheSize));
        }
        
        // 保存到存储
        chrome.storage.local.set({ translations: translationCache });
    });
}

// 处理键盘事件
document.addEventListener('keydown', function(e) {
    // 支持多种快捷键: Alt, Shift, Ctrl
    if ((e.key === 'Alt' || e.key === 'Control' || e.key === 'Shift') && keyboardShortcutEnabled) {
        keyboardShortcut.pressed = true;
        console.log(`快捷键 ${e.key} 已按下，悬停翻译激活`);
        
        // 显示视觉提示
        hoverControlArea.style.opacity = '1';
        
        // 5秒后自动恢复隐藏状态
        setTimeout(() => {
            if (isAutoHide && hoverMenu.style.display !== 'block') {
                hoverControlArea.style.opacity = '0';
            }
        }, 5000);
    }
});

document.addEventListener('keyup', function(e) {
    if ((e.key === 'Alt' || e.key === 'Control' || e.key === 'Shift') && keyboardShortcutEnabled) {
        keyboardShortcut.pressed = false;
        console.log(`快捷键 ${e.key} 已释放，悬停翻译停用`);
    }
});

// 点击工具提示外部时隐藏
document.addEventListener('click', function(e) {
    if (tooltip.style.display === 'block' && !e.target.closest('#wordsaver-tooltip')) {
        hideTooltip();
    }
});

// 处理控制区域相关的事件
hoverToggle.addEventListener('click', function(e) {
    e.stopPropagation();
    if (hoverMenu.style.display === 'block') {
        hoverMenu.style.display = 'none';
    } else {
        hoverMenu.style.display = 'block';
    }
});

// 点击菜单外部时隐藏菜单
document.addEventListener('click', function(e) {
    if (hoverMenu.style.display === 'block' && !e.target.closest('#wordsaver-hover-control')) {
        hoverMenu.style.display = 'none';
    }
});

// 处理来自后台或弹出页面的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    try {
        if (request.action === 'getClickedWord') {
            const selection = window.getSelection();
            if (selection.toString().trim() !== '') {
                const word = selection.toString().trim();
                
                // 如果有缓存翻译，发送缓存
                if (translationCache[word]) {
                    sendResponse({ word: word, translation: translationCache[word] });
                } else {
                    sendResponse({ word: word });
                }
            } else {
                sendResponse({ word: null });
            }
            return true; // 异步响应
        } 
        else if (request.action === 'updateHoverTranslate') {
            // 更新悬停翻译设置
            isHoverTranslateEnabled = request.enabled;
            console.log(`悬停翻译已${isHoverTranslateEnabled ? '启用' : '禁用'}`);
            
            // 如果设置发生变化，更新UI显示
            if (isHoverTranslateEnabled) {
                // 如果启用了但控制区域是隐藏的，则稍微显示一下
                hoverControlArea.style.opacity = '1';
                setTimeout(() => {
                    if (isAutoHide) {
                        hoverControlArea.style.opacity = '0';
                    }
                }, 2000);
            } else {
                // 如果禁用了，隐藏任何可能显示的提示
                hideTooltip();
                // 如果菜单是打开的，关闭它
                if (hoverMenu.style.display === 'block') {
                    hoverMenu.style.display = 'none';
                }
            }
            
            // 更新菜单复选框状态
            updateMenuCheckbox('toggle-hover', isHoverTranslateEnabled);
            
            // 保存设置到本地存储
            saveSettings();
            
            sendResponse({success: true});
            return true;
        }
        else if (request.action === 'ping') {
            // 简单响应用于检查连接状态
            sendResponse({success: true, action: 'pong'});
            return true;
        }
        return false;
    } catch (e) {
        console.error("处理消息时出错:", e);
        sendResponse({error: e.message});
        return true;
    }
});

// 从存储中获取语音合成的语音（确保浏览器支持）
if (window.speechSynthesis) {
    // 有些浏览器需要等待加载语音
    if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.addEventListener('voiceschanged', function() {
            // 语音已加载，准备就绪
        });
    }
}

// 保存单词到扩展存储
function saveWord(word, translation) {
    console.log(`尝试保存单词: "${word}", 翻译: "${translation}"`);
    
    // 清理HTML标签的简单方法，确保翻译文本可以正确存储
    let cleanTranslation = "";
    if (translation) {
        try {
            // 创建一个临时元素来解析HTML并获取纯文本
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = translation;
            cleanTranslation = tempDiv.textContent || tempDiv.innerText || translation;
            cleanTranslation = cleanTranslation.trim();
            
            // 如果清理后的翻译为空，则尝试保留原始内容
            if (!cleanTranslation && translation) {
                cleanTranslation = translation.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            }
        } catch (e) {
            console.error("清理翻译文本时出错:", e);
            cleanTranslation = translation;
        }
    }
    
    // 获取当前页面信息
    const pageUrl = window.location.href;
    const pageTitle = document.title;
    
    // 使用安全的消息发送方法
    trySendMessage({
        action: 'saveWord',
        word: word,
        translation: cleanTranslation,
        source: pageUrl,
        pageTitle: pageTitle
    }, function(response) {
        if (response && response.success) {
            showNotification(`已保存单词: ${word}`);
            // 缓存翻译结果（如果有）
            if (cleanTranslation && !translationCache[word]) {
                translationCache[word] = translation;
                saveTranslationCache();
            }
        } else if (response && response.exists) {
            showNotification(`单词 "${word}" 已更新`);
        } else {
            showNotification(`保存失败: ${response?.error || '未知错误'}`);
        }
    });
}

// 添加安全的消息发送方法，处理扩展上下文失效问题
function trySendMessage(message, callback) {
    try {
        chrome.runtime.sendMessage(message, function(response) {
            // 检查runtime.lastError，这是处理扩展通信错误的关键
            if (chrome.runtime.lastError) {
                console.error("发送消息时出错:", chrome.runtime.lastError);
                
                // 检查是否是上下文失效错误
                const errorMsg = chrome.runtime.lastError.message || "";
                if (errorMsg.includes("Extension context invalidated") || 
                    errorMsg.includes("disconnected") ||
                    errorMsg.includes("destroyed")) {
                    
                    console.log("检测到扩展上下文失效，尝试恢复...");
                    
                    // 尝试向用户显示一个通知
                    showNotification("扩展连接已断开，请重新加载页面或重启扩展");
                    
                    // 尝试重新建立连接（在某些情况下可能有效）
                    setTimeout(() => {
                        reconnectExtension();
                    }, 1000);
                }
                
                // 调用回调并传递错误信息
                if (callback) callback({ error: errorMsg });
                return;
            }
            
            // 成功，调用回调
            if (callback) callback(response);
        });
    } catch (e) {
        console.error("发送消息失败，可能是扩展上下文已失效:", e);
        showNotification("扩展连接已断开，请重新加载页面或重启扩展");
        
        // 尝试重新建立连接
        setTimeout(() => {
            reconnectExtension();
        }, 1000);
        
        // 调用回调并传递错误信息
        if (callback) callback({ error: e.message });
    }
}

// 尝试重新连接扩展
function reconnectExtension() {
    console.log("尝试重新连接扩展...");
    try {
        // 尝试发送一个简单的消息来检查连接
        chrome.runtime.sendMessage({ action: "ping" }, function(response) {
            if (chrome.runtime.lastError) {
                console.log("重新连接失败:", chrome.runtime.lastError.message);
                return;
            }
            
            if (response && response.success) {
                console.log("重新连接成功!");
                showNotification("扩展连接已恢复");
                
                // 重新加载设置
                loadSettings();
            }
        });
    } catch (e) {
        console.error("重新连接扩展失败:", e);
    }
}

// 获取翻译
function getTranslation(word, x, y) {
    console.log(`尝试获取"${word}"的翻译, 坐标: x=${x}, y=${y}`);
    
    // 先检查缓存
    if (translationCache[word]) {
        console.log(`找到缓存的翻译：`, translationCache[word]);
        showTooltip(word, translationCache[word], x, y);
        return;
    }
    
    // 显示加载中的提示
    const loadingMessage = `<div>正在加载翻译...</div>`;
    showTooltip(word, loadingMessage, x, y);
    
    // 同时获取中文翻译和英文定义
    Promise.all([
        fetchChineseTranslation(word),
        fetchDictionaryDefinition(word)
    ])
    .then(([chineseTranslation, englishDefinition]) => {
        // 合并翻译结果
        let combinedTranslation = "";
        
        // 添加中文翻译（如果有）
        if (chineseTranslation) {
            combinedTranslation += `<div style="margin-bottom: 8px; color: #333; font-weight: 500;">
                <span style="color: #4285f4;">中文：</span>${chineseTranslation}
            </div>`;
        }
        
        // 添加英文定义（如果有）
        if (englishDefinition) {
            combinedTranslation += `${englishDefinition}`;
        }
        
        // 如果两者都没有，提供备用链接
        if (!combinedTranslation) {
            combinedTranslation = getFallbackLinks(word);
        }
        
        // 缓存并显示结果
        translationCache[word] = combinedTranslation;
        saveTranslationCache();
        showTooltip(word, combinedTranslation, x, y);
    })
    .catch(error => {
        console.error("获取翻译出错:", error);
        
        // 检查是否是扩展上下文失效错误
        if (error && error.message && (
            error.message.includes("Extension context invalidated") ||
            error.message.includes("disconnected") ||
            error.message.includes("destroyed")
        )) {
            // 显示更友好的错误消息
            const errorMsg = `
                <div style="color: #d32f2f; margin-bottom: 10px; font-weight: bold;">
                    🔄 扩展需要重新连接
                </div>
                <div style="color: #666; font-size: 14px; margin-bottom: 10px;">
                    请刷新页面以继续使用翻译功能
                </div>
                <div style="background: #f5f5f5; padding: 8px; border-radius: 4px; font-size: 12px;">
                    <strong>快捷方式:</strong> Ctrl+R (Windows) 或 Cmd+R (Mac)
                </div>
            `;
            showTooltip(word, errorMsg, x, y);
            
            // 尝试重新连接
            setTimeout(() => {
                reconnectExtension();
            }, 1000);
            return;
        }
        
        // 网络错误或API错误
        const errorMsg = `
            <div style="color: #d32f2f; margin-bottom: 10px;">
                📡 翻译服务暂时不可用
            </div>
            <div style="color: #666; font-size: 14px; margin-bottom: 10px;">
                您仍可以保存单词，稍后查看翻译
            </div>
            <div style="text-align: center; margin-top: 10px;">
                <button onclick="saveWord('${word}', '')" style="
                    background: #4285f4; 
                    color: white; 
                    border: none; 
                    padding: 6px 12px; 
                    border-radius: 4px; 
                    cursor: pointer;
                    font-size: 12px;
                ">保存单词</button>
            </div>
            ${getFallbackLinks(word)}
        `;
        showTooltip(word, errorMsg, x, y);
    });
}

// 处理鼠标移动
document.addEventListener('mousemove', function(e) {
    // 显示悬停控制区域
    if (isAutoHide) {
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 当鼠标靠近右下角时显示控制区域
        if (mouseX > windowWidth - 150 && mouseY > windowHeight - 150) {
            hoverControlArea.style.opacity = '1';
        } else {
            // 如果菜单未显示则半透明显示控制区域
            if (hoverMenu.style.display !== 'block') {
                hoverControlArea.style.opacity = '0.3'; // 不完全隐藏，保留轻微可见度
            }
        }
    } else {
        // 不自动隐藏时始终显示
        hoverControlArea.style.opacity = '1';
    }
    
    // 悬停翻译功能
    if (!isHoverTranslateEnabled) {
        return; // 如果悬停翻译功能关闭，直接返回
    }
    
    // 检查当前网站是否在白名单中
    // 只有当白名单不为空时才进行检查，如果白名单为空则允许所有网站
    if (whiteList.length > 0 && !whiteList.includes(currentHostname)) {
        // 如果白名单不为空且当前网站不在白名单中，我们可以检查快捷键是否按下
        // 即使网站不在白名单中，当快捷键按下时也允许翻译
        if (!keyboardShortcutEnabled || !keyboardShortcut.pressed) {
            return; // 只有当快捷键启用且已按下时才继续
        }
    } else {
        // 如果网站在白名单中或白名单为空
        // 如果启用了键盘快捷键但未按下，则不触发翻译
        if (keyboardShortcutEnabled && !keyboardShortcut.pressed) {
            return;
        }
    }

    // 清除之前的超时
    if (hoverTimeout) {
        clearTimeout(hoverTimeout);
    }
    
    // 设置新的超时
    hoverTimeout = setTimeout(() => {
        const element = e.target;
        
        // 如果鼠标位于工具提示上或悬停控制区域上，不做处理
        if (element.closest('#wordsaver-tooltip') || element.closest('#wordsaver-hover-control')) {
            return;
        }
        
        // 移除之前的高亮
        document.querySelectorAll('.wordsaver-highlight').forEach(el => {
            el.classList.remove('wordsaver-highlight');
        });
        
        let range;
        try {
            // 尝试获取光标范围，这在某些浏览器中可能会失败
            range = document.caretRangeFromPoint(e.clientX, e.clientY);
            if (!range) {
                console.warn("无法获取文本光标范围");
                return;
            }
        } catch (error) {
            console.error("获取文本光标范围时出错:", error);
            return;
        }

        // 处理短语或单词翻译
        if (phraseSelectionMode) {
            // 短语翻译模式：获取鼠标下的文本节点
            try {
                const textNode = range.startContainer;
                if (textNode.nodeType !== Node.TEXT_NODE) {
                    return;
                }
                
                // 获取包含该节点的元素
                const parentElement = textNode.parentElement;
                if (!parentElement) {
                    return;
                }
                
                // 获取文本内容并找到单词
                const text = parentElement.textContent;
                if (!text.trim()) {
                    return;
                }
                
                // 高亮整个元素
                parentElement.classList.add('wordsaver-highlight');
                
                // 提取需要翻译的文本
                const phrase = text.trim();
                if (phrase.length > 2) {
                    getTranslation(phrase, e.pageX, e.pageY);
                }
            } catch (error) {
                console.error("处理短语翻译时出错:", error);
            }
        } else {
            // 单词翻译模式：处理鼠标下文本节点的单个单词
            try {
                const textNode = range.startContainer;
                if (textNode.nodeType !== Node.TEXT_NODE) {
                    return;
                }
                
                // 获取文本内容并找到最接近鼠标位置的单词
                const text = textNode.textContent;
                const offset = range.startOffset;
                
                // 找到包含当前位置的单词
                const wordInfo = findWordAtPosition(text, offset);
                if (!wordInfo) {
                    return;
                }
                
                const { word, start, end } = wordInfo;
                
                // 检查是否为有效英文单词
                if (isValidEnglishWord(word)) {
                    // 高亮单词
                    try {
                        highlightWord(textNode, start, end);
                    } catch (hlError) {
                        console.error("高亮单词时出错:", hlError);
                    }
                    
                    // 获取翻译
                    getTranslation(word, e.pageX, e.pageY);
                }
            } catch (error) {
                console.error("处理单词翻译时出错:", error);
            }
        }
    }, hoverDelay);
});

// 查找指定位置的单词
function findWordAtPosition(text, position) {
    // 使用正则表达式匹配英文单词（只包含字母和连字符的序列）
    const wordRegex = /[a-zA-Z]+(-[a-zA-Z]+)*/g;
    let match;
    
    // 查找所有单词
    while ((match = wordRegex.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        
        // 检查当前位置是否在这个单词内
        if (position >= start && position <= end) {
            return {
                word: match[0],
                start: start,
                end: end
            };
        }
    }
    
    return null;
}

// 检查是否为有效的英文单词
function isValidEnglishWord(word) {
    // 仅包含英文字母和可能的连字符
    return /^[a-zA-Z]+(-[a-zA-Z]+)*$/.test(word) && word.length > 1;
}

// 高亮单词
function highlightWord(textNode, start, end) {
    // 创建一个范围选择器
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    
    // 添加高亮类
    const parentElement = textNode.parentElement;
    if (parentElement) {
        parentElement.classList.add('wordsaver-highlight');
    }
}
