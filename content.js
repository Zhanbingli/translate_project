// WordSaver 内容脚本 - 修复版
// 修复快捷键功能和翻译质量问题

console.log("WordSaver 插件已加载！");
chrome.runtime.sendMessage({ action: "contentScriptLoaded" });

// 用户偏好设置
let isHoverTranslateEnabled = false; // 默认关闭自动悬停翻译
let keyboardShortcutEnabled = true; // 默认启用快捷键
let currentShortcutKey = 'Alt'; // 默认Alt键
let isShortcutPressed = false;
let translationCache = {};
let hoverDelay = 800; // 增加延迟，避免过于敏感

// 创建样式
const style = document.createElement('style');
style.textContent = `
.wordsaver-highlight {
    background-color: rgba(255, 235, 59, 0.4) !important;
    border-radius: 3px !important;
    cursor: pointer !important;
    transition: background-color 0.2s ease !important;
}

.wordsaver-tooltip {
    position: absolute !important;
    z-index: 999999 !important;
    background: white !important;
    border: 1px solid #e0e0e0 !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
    padding: 16px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 14px !important;
    max-width: 350px !important;
    line-height: 1.5 !important;
    color: #333 !important;
}

.wordsaver-control {
    position: fixed !important;
    bottom: 20px !important;
    right: 20px !important;
    z-index: 999998 !important;
    opacity: 0.8 !important;
    transition: opacity 0.3s ease !important;
}

.wordsaver-control:hover {
    opacity: 1 !important;
}

.wordsaver-toggle {
    width: 45px !important;
    height: 45px !important;
    background: #4285f4 !important;
    border-radius: 50% !important;
    color: white !important;
    text-align: center !important;
    line-height: 45px !important;
    font-weight: bold !important;
    cursor: pointer !important;
    font-size: 16px !important;
    user-select: none !important;
    box-shadow: 0 2px 15px rgba(0,0,0,0.3) !important;
}

.wordsaver-menu {
    position: absolute !important;
    bottom: 55px !important;
    right: 0 !important;
    width: 240px !important;
    background: white !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
    padding: 12px !important;
    display: none !important;
    border: 1px solid #e0e0e0 !important;
}

.wordsaver-menu-item {
    padding: 10px 12px !important;
    cursor: pointer !important;
    border-radius: 6px !important;
    font-size: 13px !important;
    color: #333 !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    margin-bottom: 4px !important;
}

.wordsaver-menu-item:hover {
    background: #f5f5f5 !important;
}

.wordsaver-status {
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    background: rgba(0,0,0,0.8) !important;
    color: white !important;
    padding: 10px 16px !important;
    border-radius: 6px !important;
    font-size: 13px !important;
    z-index: 999999 !important;
    display: none !important;
    max-width: 300px !important;
    white-space: pre-line !important;
}
`;
document.head.appendChild(style);

// 创建工具提示
const tooltip = document.createElement('div');
tooltip.className = 'wordsaver-tooltip';
tooltip.style.display = 'none';
document.body.appendChild(tooltip);

// 创建控制面板
const control = document.createElement('div');
control.className = 'wordsaver-control';
control.innerHTML = `
    <div class="wordsaver-toggle" title="WordSaver 设置">W</div>
    <div class="wordsaver-menu">
        <div class="wordsaver-menu-item" data-action="toggle-hover">
            <span>🖱️</span>
            <span>自动悬停翻译 ${isHoverTranslateEnabled ? '✓' : '✗'}</span>
        </div>
        <div class="wordsaver-menu-item" data-action="toggle-shortcut">
            <span>⌨️</span>
            <span>快捷键翻译 (${currentShortcutKey}) ${keyboardShortcutEnabled ? '✓' : '✗'}</span>
        </div>
        <div class="wordsaver-menu-item" data-action="change-key">
            <span>🔄</span>
            <span>更换快捷键</span>
        </div>
        <div class="wordsaver-menu-item" data-action="help">
            <span>❓</span>
            <span>使用帮助</span>
        </div>
    </div>
`;
document.body.appendChild(control);

// 创建状态提示
const status = document.createElement('div');
status.className = 'wordsaver-status';
document.body.appendChild(status);

// 显示状态信息
function showStatus(message, duration = 3000) {
    status.textContent = message;
    status.style.display = 'block';
    setTimeout(() => {
        status.style.display = 'none';
    }, duration);
}

// 更新菜单显示
function updateMenu() {
    const menu = control.querySelector('.wordsaver-menu');
    menu.innerHTML = `
        <div class="wordsaver-menu-item" data-action="toggle-hover">
            <span>🖱️</span>
            <span>自动悬停翻译 ${isHoverTranslateEnabled ? '✓' : '✗'}</span>
        </div>
        <div class="wordsaver-menu-item" data-action="toggle-shortcut">
            <span>⌨️</span>
            <span>快捷键翻译 (${currentShortcutKey}) ${keyboardShortcutEnabled ? '✓' : '✗'}</span>
        </div>
        <div class="wordsaver-menu-item" data-action="change-key">
            <span>🔄</span>
            <span>更换快捷键</span>
        </div>
        <div class="wordsaver-menu-item" data-action="help">
            <span>❓</span>
            <span>使用帮助</span>
        </div>
    `;
}

// 事件处理
let hoverTimeout = null;
let lastTranslatedWord = '';

// 鼠标移动事件 - 改进版，减少干扰
document.addEventListener('mousemove', function(e) {
    // 如果既没有启用自动悬停，也没有按下快捷键，直接返回
    if (!isHoverTranslateEnabled && (!keyboardShortcutEnabled || !isShortcutPressed)) {
        return;
    }
    
    // 如果鼠标在工具提示或控制面板上，不处理
    if (e.target.closest('.wordsaver-tooltip') || e.target.closest('.wordsaver-control')) {
        return;
    }
    
    // 清除之前的超时
    if (hoverTimeout) {
        clearTimeout(hoverTimeout);
    }
    
    // 设置新的超时，避免过于频繁的翻译
    hoverTimeout = setTimeout(() => {
        processMousePosition(e);
    }, hoverDelay);
});

// 处理鼠标位置的单词
function processMousePosition(e) {
    try {
        // 获取鼠标位置的文本
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) {
            return;
        }
        
        const textNode = range.startContainer;
        const text = textNode.textContent;
        const offset = range.startOffset;
        
        // 查找单词
        const wordInfo = findWordAtPosition(text, offset);
        if (!wordInfo || !isValidEnglishWord(wordInfo.word)) {
            return;
        }
        
        const word = wordInfo.word.toLowerCase();
        
        // 避免重复翻译同一个单词
        if (word === lastTranslatedWord) {
            return;
        }
        
        lastTranslatedWord = word;
        
        // 高亮单词
        highlightWord(textNode, wordInfo.start, wordInfo.end);
        
        // 获取翻译
        getTranslation(word, e.pageX, e.pageY);
        
    } catch (error) {
        console.error('处理鼠标位置时出错:', error);
    }
}

// 查找指定位置的单词
function findWordAtPosition(text, position) {
    const wordRegex = /[a-zA-Z]+(?:[-'][a-zA-Z]+)*/g;
    let match;
    
    while ((match = wordRegex.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        
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

// 检查是否为有效英文单词
function isValidEnglishWord(word) {
    return /^[a-zA-Z]+(?:[-'][a-zA-Z]+)*$/.test(word) && word.length > 2;
}

// 高亮单词
function highlightWord(textNode, start, end) {
    try {
        // 清除之前的高亮
        document.querySelectorAll('.wordsaver-highlight').forEach(el => {
            el.classList.remove('wordsaver-highlight');
        });
        
        const parentElement = textNode.parentElement;
        if (parentElement) {
            parentElement.classList.add('wordsaver-highlight');
            // 3秒后自动取消高亮
            setTimeout(() => {
                parentElement.classList.remove('wordsaver-highlight');
            }, 3000);
        }
    } catch (error) {
        console.error('高亮单词时出错:', error);
    }
}

// 获取翻译
function getTranslation(word, x, y) {
    // 检查缓存
    if (translationCache[word]) {
        showTooltip(word, translationCache[word], x, y);
        return;
    }
    
    // 显示加载状态
    showTooltip(word, '翻译中...', x, y);
    
    // 通过background.js获取翻译
    chrome.runtime.sendMessage({
        action: 'getTranslation',
        word: word
    }, function(response) {
        if (chrome.runtime.lastError) {
            console.error('获取翻译失败:', chrome.runtime.lastError);
            showTooltip(word, '翻译失败', x, y);
            return;
        }
        
        if (response && response.success && response.translation) {
            const translation = response.translation;
            translationCache[word] = translation;
            showTooltip(word, translation, x, y);
        } else {
            showTooltip(word, '翻译失败', x, y);
        }
    });
}

// 显示工具提示
function showTooltip(word, translation, x, y) {
    // 清理翻译文本，移除多余的HTML标签
    const cleanTranslation = translation.replace(/<[^>]*>/g, '').trim();
    
    tooltip.innerHTML = `
        <div style="margin-bottom: 10px;">
            <strong style="color: #1a73e8; font-size: 16px;">${word}</strong>
        </div>
        <div style="margin-bottom: 14px; color: #5f6368; line-height: 1.4;">
            ${cleanTranslation}
        </div>
        <div style="text-align: right;">
            <button onclick="saveCurrentWord('${word}', '${translation.replace(/'/g, '&#39;')}')" 
                    style="background: #4285f4; color: white; border: none; 
                           padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px;">
                💾 保存单词
            </button>
        </div>
    `;
    
    // 计算位置
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // 临时显示以获取尺寸
    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';
    const tooltipRect = tooltip.getBoundingClientRect();
    
    let left = x + 15;
    let top = y - tooltipRect.height - 15;
    
    // 边界检查
    if (left + tooltipRect.width > windowWidth - 20) {
        left = x - tooltipRect.width - 15;
    }
    if (top < 20) {
        top = y + 15;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.style.visibility = 'visible';
    
    // 6秒后自动隐藏
    setTimeout(() => {
        tooltip.style.display = 'none';
    }, 6000);
}

// 保存单词 - 全局函数
window.saveCurrentWord = function(word, translation) {
    try {
        chrome.runtime.sendMessage({
            action: 'saveWord',
            word: word,
            translation: translation,
            source: window.location.href,
            pageTitle: document.title
        }, function(response) {
            if (chrome.runtime.lastError) {
                console.error('保存失败:', chrome.runtime.lastError);
                showStatus('❌ 保存失败');
            } else if (response && response.success) {
                showStatus('✅ 保存成功');
                tooltip.style.display = 'none';
            } else {
                showStatus('❌ 保存失败');
            }
        });
    } catch (error) {
        console.error('保存单词时出错:', error);
        showStatus('❌ 保存失败');
    }
};

// 修复后的键盘事件处理
document.addEventListener('keydown', function(e) {
    if (!keyboardShortcutEnabled) return;
    
    let isTargetKey = false;
    switch (currentShortcutKey) {
        case 'Alt':
            isTargetKey = e.altKey && !e.ctrlKey && !e.shiftKey;
            break;
        case 'Control':
            isTargetKey = e.ctrlKey && !e.altKey && !e.shiftKey;
            break;
        case 'Shift':
            isTargetKey = e.shiftKey && !e.altKey && !e.ctrlKey;
            break;
    }
    
    if (isTargetKey && !isShortcutPressed) {
        isShortcutPressed = true;
        showStatus(`🔥 ${currentShortcutKey} 翻译模式已激活\n将鼠标悬停在英文单词上即可翻译`);
    }
});

document.addEventListener('keyup', function(e) {
    if (!keyboardShortcutEnabled) return;
    
    let isTargetKey = false;
    switch (currentShortcutKey) {
        case 'Alt':
            isTargetKey = !e.altKey;
            break;
        case 'Control':
            isTargetKey = !e.ctrlKey;
            break;
        case 'Shift':
            isTargetKey = !e.shiftKey;
            break;
    }
    
    if (isTargetKey && isShortcutPressed) {
        isShortcutPressed = false;
        showStatus(`💤 ${currentShortcutKey} 翻译模式已关闭`);
        // 隐藏工具提示
        tooltip.style.display = 'none';
        // 清除高亮
        document.querySelectorAll('.wordsaver-highlight').forEach(el => {
            el.classList.remove('wordsaver-highlight');
        });
        lastTranslatedWord = '';
    }
});

// 控制面板事件
control.addEventListener('click', function(e) {
    const toggle = e.target.closest('.wordsaver-toggle');
    const menuItem = e.target.closest('.wordsaver-menu-item');
    const menu = control.querySelector('.wordsaver-menu');
    
    if (toggle) {
        e.stopPropagation();
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    } else if (menuItem) {
        const action = menuItem.dataset.action;
        handleMenuAction(action);
        menu.style.display = 'none';
    }
});

// 处理菜单操作
function handleMenuAction(action) {
    switch (action) {
        case 'toggle-hover':
            isHoverTranslateEnabled = !isHoverTranslateEnabled;
            updateMenu();
            showStatus(`🖱️ 自动悬停翻译 ${isHoverTranslateEnabled ? '已启用' : '已关闭'}`);
            break;
            
        case 'toggle-shortcut':
            keyboardShortcutEnabled = !keyboardShortcutEnabled;
            updateMenu();
            showStatus(`⌨️ 快捷键翻译 ${keyboardShortcutEnabled ? '已启用' : '已关闭'}`);
            break;
            
        case 'change-key':
            const keys = ['Alt', 'Control', 'Shift'];
            const currentIndex = keys.indexOf(currentShortcutKey);
            currentShortcutKey = keys[(currentIndex + 1) % keys.length];
            updateMenu();
            showStatus(`🔄 快捷键已更换为: ${currentShortcutKey}`);
            break;
            
        case 'help':
            showHelp();
            break;
    }
}

// 显示帮助信息
function showHelp() {
    const helpText = `📖 WordSaver 使用说明

⌨️ 快捷键翻译 (推荐)：
   按住 ${currentShortcutKey} 键，鼠标悬停单词即可翻译

🖱️ 自动悬停翻译：
   开启后鼠标悬停即可翻译 (可能干扰浏览)

💾 保存单词：
   点击翻译框中的"保存单词"按钮

🔧 设置：
   点击右下角的 W 按钮打开设置菜单

推荐使用快捷键模式，体验更好！`;
    
    showStatus(helpText, 10000);
}

// 点击页面其他地方隐藏菜单和工具提示
document.addEventListener('click', function(e) {
    if (!e.target.closest('.wordsaver-control')) {
        control.querySelector('.wordsaver-menu').style.display = 'none';
    }
    if (!e.target.closest('.wordsaver-tooltip')) {
        tooltip.style.display = 'none';
    }
});

// 消息处理
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'ping') {
        sendResponse({ success: true });
        return true;
    }
});

// 初始化
setTimeout(() => {
    showStatus(`🎉 WordSaver 已启用！\n按住 ${currentShortcutKey} 键 + 悬停单词即可翻译`, 4000);
}, 1000);
