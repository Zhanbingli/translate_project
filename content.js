// WordSaver 内容脚本 - 修复版
// 修复快捷键功能和翻译质量问题

console.log("WordSaver 插件已加载！");

// 用户偏好设置
let isHoverTranslateEnabled = false; // 默认关闭自动悬停翻译
let keyboardShortcutEnabled = true; // 默认启用快捷键
let currentShortcutKey = 'Alt'; // 默认Alt键
let isShortcutPressed = false;
let translationCache = {};
let hoverDelay = 800; // 增加延迟，避免过于敏感

// 扩展状态跟踪
let extensionContextValid = true;
let contextCheckFailCount = 0;
const MAX_CONTEXT_CHECK_FAILS = 3; // 最大连续检查失败次数

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
    max-width: 400px !important;
    max-height: 500px !important;
    overflow-y: auto !important;
    line-height: 1.5 !important;
    color: #333 !important;
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

// 事件处理
let hoverTimeout = null;
let lastTranslatedWord = '';

// 鼠标移动事件 - 改进版，减少干扰
document.addEventListener('mousemove', function(e) {
    // 如果扩展上下文已失效，停止处理
    if (!extensionContextValid) {
        return;
    }
    
    // 如果既没有启用自动悬停，也没有按下快捷键，直接返回
    if (!isHoverTranslateEnabled && (!keyboardShortcutEnabled || !isShortcutPressed)) {
        return;
    }
    
    // 如果鼠标在工具提示上，不处理
    if (e.target.closest('.wordsaver-tooltip')) {
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

// 检查扩展上下文是否有效 - 改进版
function isExtensionContextValid() {
    try {
        // 检查chrome.runtime是否存在且有效
        if (!chrome.runtime || !chrome.runtime.id) {
            return false;
        }
        
        // 尝试访问扩展的manifest来确认上下文有效
        const manifest = chrome.runtime.getManifest();
        return manifest !== undefined;
    } catch (error) {
        console.warn('扩展上下文检查失败:', error.message);
        return false;
    }
}

// 处理扩展上下文失效
function handleExtensionContextInvalidated() {
    if (extensionContextValid) {
        extensionContextValid = false;
        console.warn('🚨 WordSaver 扩展上下文已失效');
        
        // 隐藏所有UI元素
        tooltip.style.display = 'none';
        
        // 清除所有高亮
        document.querySelectorAll('.wordsaver-highlight').forEach(el => {
            el.classList.remove('wordsaver-highlight');
        });
        
        // 显示持久的重新加载提示
        showPersistentReloadNotice();
    }
}

// 显示持久的重新加载提示
function showPersistentReloadNotice() {
    // 创建重新加载提示
    const reloadNotice = document.createElement('div');
    reloadNotice.id = 'wordsaver-reload-notice';
    reloadNotice.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: #ff5722 !important;
        color: white !important;
        padding: 16px 20px !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        z-index: 1000000 !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
        max-width: 350px !important;
        line-height: 1.4 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    `;
    
    reloadNotice.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px;">⚠️ WordSaver 需要刷新</div>
        <div style="margin-bottom: 12px;">扩展已更新或重新加载，请刷新此页面以继续使用翻译功能。</div>
        <button onclick="window.location.reload()" style="
            background: white; 
            color: #ff5722; 
            border: none; 
            padding: 8px 16px; 
            border-radius: 4px; 
            cursor: pointer; 
            font-weight: bold;
            margin-right: 8px;
        ">🔄 刷新页面</button>
        <button onclick="this.parentElement.remove()" style="
            background: transparent; 
            color: white; 
            border: 1px solid white; 
            padding: 8px 12px; 
            border-radius: 4px; 
            cursor: pointer;
        ">✕ 关闭</button>
    `;
    
    // 移除可能存在的旧提示
    const existingNotice = document.getElementById('wordsaver-reload-notice');
    if (existingNotice) {
        existingNotice.remove();
    }
    
    document.body.appendChild(reloadNotice);
}

// 安全发送消息给background script - 改进版
function safeRuntimeSendMessage(message, callback) {
    // 快速检查扩展状态
    if (!extensionContextValid) {
        console.warn('扩展上下文已标记为失效，跳过消息发送');
        callback && callback(null);
        return false;
    }
    
    if (!isExtensionContextValid()) {
        contextCheckFailCount++;
        console.warn(`扩展上下文检查失败 (${contextCheckFailCount}/${MAX_CONTEXT_CHECK_FAILS})`);
        
        if (contextCheckFailCount >= MAX_CONTEXT_CHECK_FAILS) {
            handleExtensionContextInvalidated();
        }
        
        callback && callback(null);
        return false;
    }
    
    // 重置失败计数
    contextCheckFailCount = 0;
    
    try {
        chrome.runtime.sendMessage(message, function(response) {
            if (chrome.runtime.lastError) {
                const error = chrome.runtime.lastError.message;
                console.warn('运行时错误:', error);
                
                if (error.includes('context invalidated') || 
                    error.includes('Extension context invalidated') ||
                    error.includes('message port closed')) {
                    handleExtensionContextInvalidated();
                } else {
                    console.error('其他运行时错误:', error);
                }
                callback && callback(null);
            } else {
                callback && callback(response);
            }
        });
        return true;
    } catch (error) {
        console.error('发送消息时出错:', error);
        if (error.message.includes('Extension context invalidated')) {
            handleExtensionContextInvalidated();
        }
        callback && callback(null);
        return false;
    }
}

// 处理鼠标位置的单词 - 改进的错误处理
function processMousePosition(e) {
    // 如果扩展上下文已失效，直接返回
    if (!extensionContextValid) {
        return;
    }
    
    try {
        // 检查扩展上下文是否有效
        if (!isExtensionContextValid()) {
            console.warn('扩展上下文已失效，停止处理鼠标事件');
            handleExtensionContextInvalidated();
            return;
        }
        
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
        getTranslation(word, e.pageX, e.pageY, textNode);
        
    } catch (error) {
        console.error('处理鼠标位置时出错:', error);
        
        // 如果是扩展上下文相关的错误，处理失效情况
        if (error.message && (
            error.message.includes('Extension context invalidated') ||
            error.message.includes('context invalidated')
        )) {
            handleExtensionContextInvalidated();
        }
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

// 获取翻译 - 使用安全的消息发送，结合上下文
function getTranslation(word, x, y, contextElement) {
    // 检查缓存
    if (translationCache[word]) {
        showTooltip(word, translationCache[word], x, y);
        return;
    }
    
    // 检查扩展上下文
    if (!isExtensionContextValid()) {
        showTooltip(word, '扩展需要刷新，请按F5', x, y);
        return;
    }
    
    // 显示加载状态
    showTooltip(word, '翻译中...', x, y);
    
    // 获取上下文信息
    const context = getWordContext(word, contextElement);
    
    // 安全地发送消息给background.js
    safeRuntimeSendMessage({
        action: 'getTranslation',
        word: word,
        context: context,
        pageTitle: document.title,
        pageUrl: window.location.href
    }, function(response) {
        if (response && response.success && response.translation) {
            const translation = response.translation;
            translationCache[word] = translation;
            showTooltip(word, translation, x, y);
        } else {
            showTooltip(word, '翻译失败，请重试', x, y);
        }
    });
}

// 获取单词上下文信息
function getWordContext(word, contextElement) {
    let context = {
        sentence: '',
        paragraph: '',
        pageType: getPageType()
    };
    
    try {
        if (contextElement && contextElement.nodeType === Node.TEXT_NODE) {
            // 获取所在句子
            const textContent = contextElement.textContent;
            context.sentence = extractSentence(textContent, word);
            
            // 获取所在段落
            let paragraphElement = contextElement.parentElement;
            while (paragraphElement && !['P', 'DIV', 'ARTICLE', 'SECTION'].includes(paragraphElement.tagName)) {
                paragraphElement = paragraphElement.parentElement;
            }
            
            if (paragraphElement) {
                context.paragraph = paragraphElement.textContent.substring(0, 300) + '...';
            }
        }
        
        // 如果没有获取到上下文，尝试从页面标题和描述获取
        if (!context.sentence && !context.paragraph) {
            context.sentence = document.title;
            const metaDescription = document.querySelector('meta[name="description"]');
            if (metaDescription) {
                context.paragraph = metaDescription.content;
            }
        }
    } catch (error) {
        console.warn('获取上下文时出错:', error);
    }
    
    return context;
}

// 从文本中提取包含指定单词的句子
function extractSentence(text, word) {
    const sentences = text.split(/[.!?。！？]+/);
    const wordLower = word.toLowerCase();
    
    for (let sentence of sentences) {
        if (sentence.toLowerCase().includes(wordLower)) {
            return sentence.trim();
        }
    }
    
    // 如果没找到完整句子，返回周围的文本
    const wordIndex = text.toLowerCase().indexOf(wordLower);
    if (wordIndex !== -1) {
        const start = Math.max(0, wordIndex - 50);
        const end = Math.min(text.length, wordIndex + word.length + 50);
        return text.substring(start, end).trim();
    }
    
    return '';
}

// 判断页面类型
function getPageType() {
    const url = window.location.href;
    const title = document.title.toLowerCase();
    
    if (url.includes('news') || title.includes('news')) return 'news';
    if (url.includes('blog') || title.includes('blog')) return 'blog';
    if (url.includes('academic') || url.includes('paper') || title.includes('research')) return 'academic';
    if (url.includes('wiki')) return 'wiki';
    if (url.includes('docs') || title.includes('documentation')) return 'documentation';
    
    return 'general';
}

// 显示工具提示
function showTooltip(word, translation, x, y) {
    // 清理翻译文本，移除多余的HTML标签
    const cleanTranslation = translation.replace(/<[^>]*>/g, '').trim();
    
    // 分析翻译内容，分离主要翻译和附加信息
    const translationParts = cleanTranslation.split('\n\n');
    const mainTranslation = translationParts[0];
    const additionalInfo = translationParts.slice(1);
    
    let tooltipContent = `
        <div style="margin-bottom: 10px;">
            <strong style="color: #1a73e8; font-size: 16px;">${word}</strong>
        </div>
        <div style="margin-bottom: 14px; color: #333; line-height: 1.4; font-weight: 500;">
            ${mainTranslation}
        </div>
    `;
    
    // 添加附加上下文信息
    if (additionalInfo.length > 0) {
        tooltipContent += `<div style="margin-bottom: 14px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-size: 12px; color: #5f6368; line-height: 1.3;">`;
        
        additionalInfo.forEach(info => {
            if (info.trim()) {
                tooltipContent += `<div style="margin-bottom: 6px;">${info.trim()}</div>`;
            }
        });
        
        tooltipContent += `</div>`;
    }
    
    tooltipContent += `
        <div style="text-align: right; border-top: 1px solid #f0f0f0; padding-top: 8px;">
            <button id="saveWordBtn" 
                    style="background: #4285f4; color: white; border: none; 
                           padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-right: 8px;">
                💾 保存单词
            </button>
            <span id="tooltipTimer" style="font-size: 11px; color: #999; opacity: 0.7;">
                📌 点击可固定
            </span>
        </div>
    `;
    
    tooltip.innerHTML = tooltipContent;
    
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
    
    // 添加保存按钮的事件监听器
    const saveBtn = tooltip.querySelector('#saveWordBtn');
    if (saveBtn) {
        saveBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            // 只保存主要翻译，不保存上下文信息
            saveCurrentWord(word, mainTranslation);
        };
    }
    
    // 设置自动隐藏逻辑
    setupTooltipAutoHide();
}

// 设置翻译框自动隐藏逻辑
function setupTooltipAutoHide() {
    let hideTimeout;
    let isPinned = false;
    const DISPLAY_TIME = 15000; // 增加到15秒
    const timerElement = tooltip.querySelector('#tooltipTimer');
    
    // 开始倒计时
    function startHideTimer() {
        if (isPinned) return;
        
        hideTimeout = setTimeout(() => {
            if (!isPinned) {
                tooltip.style.display = 'none';
            }
        }, DISPLAY_TIME);
        
        // 显示倒计时
        if (timerElement && !isPinned) {
            let remainingTime = DISPLAY_TIME / 1000;
            const countdownInterval = setInterval(() => {
                remainingTime--;
                if (remainingTime > 0 && !isPinned && tooltip.style.display !== 'none') {
                    timerElement.textContent = `${remainingTime}s 后隐藏 📌点击固定`;
                } else {
                    clearInterval(countdownInterval);
                    if (!isPinned) {
                        timerElement.textContent = '📌 点击可固定';
                    }
                }
            }, 1000);
        }
    }
    
    // 清除隐藏定时器
    function clearHideTimer() {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
    }
    
    // 鼠标进入翻译框时暂停隐藏
    tooltip.addEventListener('mouseenter', function() {
        clearHideTimer();
        if (timerElement && !isPinned) {
            timerElement.textContent = '悬停中... 📌点击固定';
        }
    });
    
    // 鼠标离开翻译框时重新开始倒计时
    tooltip.addEventListener('mouseleave', function() {
        if (!isPinned) {
            startHideTimer();
        }
    });
    
    // 点击翻译框可以固定/取消固定
    tooltip.addEventListener('click', function(e) {
        // 如果点击的是保存按钮，不处理固定逻辑
        if (e.target.closest('#saveWordBtn')) {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        isPinned = !isPinned;
        
        if (isPinned) {
            clearHideTimer();
            tooltip.style.borderColor = '#4285f4';
            tooltip.style.boxShadow = '0 4px 20px rgba(66, 133, 244, 0.3)';
            if (timerElement) {
                timerElement.textContent = '已固定 📌再次点击取消';
                timerElement.style.color = '#4285f4';
            }
        } else {
            tooltip.style.borderColor = '#e0e0e0';
            tooltip.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
            if (timerElement) {
                timerElement.style.color = '#999';
            }
            startHideTimer();
        }
    });
    
    // 开始初始倒计时
    startHideTimer();
}

// 保存单词 - 全局函数，使用安全的消息发送
window.saveCurrentWord = function(word, translation) {
    // 如果扩展上下文已失效，不执行保存
    if (!extensionContextValid) {
        console.warn('扩展上下文已失效，无法保存单词');
        return;
    }
    
    try {
        // 检查扩展上下文
        if (!isExtensionContextValid()) {
            handleExtensionContextInvalidated();
            return;
        }
        
        safeRuntimeSendMessage({
            action: 'saveWord',
            word: word,
            translation: translation,
            source: window.location.href,
            pageTitle: document.title
        }, function(response) {
            if (response && response.success) {
                showStatus('✅ 保存成功');
                tooltip.style.display = 'none';
            } else {
                showStatus('❌ 保存失败，请重试');
            }
        });
    } catch (error) {
        console.error('保存单词时出错:', error);
        if (error.message && error.message.includes('Extension context invalidated')) {
            handleExtensionContextInvalidated();
        } else {
            showStatus('❌ 保存失败');
        }
    }
};

// 修复后的键盘事件处理
document.addEventListener('keydown', function(e) {
    // 如果扩展上下文已失效，停止处理键盘事件
    if (!extensionContextValid || !keyboardShortcutEnabled) return;
    
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
    // 如果扩展上下文已失效，停止处理键盘事件
    if (!extensionContextValid || !keyboardShortcutEnabled) return;
    
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

// 点击页面其他地方隐藏工具提示
document.addEventListener('click', function(e) {
    if (!e.target.closest('.wordsaver-tooltip')) {
        tooltip.style.display = 'none';
    }
});

// 消息处理 - 安全版本
try {
    if (isExtensionContextValid()) {
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            try {
                if (request.action === 'ping') {
                    sendResponse({ success: true });
                    return true;
                }
            } catch (error) {
                console.error('处理消息时出错:', error);
                return false;
            }
        });
    }
} catch (error) {
    console.warn('设置消息监听器时出错:', error);
}

// 安全的初始化
function safeInitialize() {
    try {
        if (isExtensionContextValid()) {
            // 发送加载通知
            safeRuntimeSendMessage({ action: "contentScriptLoaded" });
            
            // 显示启用消息
            setTimeout(() => {
                if (extensionContextValid) {
                    showStatus(`🎉 WordSaver 已启用！\n按住 ${currentShortcutKey} 键 + 悬停单词即可翻译\n\n✨ 新功能：智能上下文翻译`, 4000);
                }
            }, 1000);
        } else {
            console.warn('扩展上下文无效，跳过初始化');
            handleExtensionContextInvalidated();
        }
    } catch (error) {
        console.error('初始化时出错:', error);
        if (error.message && error.message.includes('Extension context invalidated')) {
            handleExtensionContextInvalidated();
        }
    }
}

// 监听页面的visibilitychange事件，当页面重新可见时检查扩展状态
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && !extensionContextValid) {
        // 页面重新可见时，如果扩展上下文之前失效，尝试重新检查
        setTimeout(() => {
            if (isExtensionContextValid()) {
                console.log('扩展上下文已恢复，重新初始化');
                extensionContextValid = true;
                contextCheckFailCount = 0;
                
                // 移除重新加载提示
                const existingNotice = document.getElementById('wordsaver-reload-notice');
                if (existingNotice) {
                    existingNotice.remove();
                }
                
                showStatus('✅ WordSaver 已恢复正常！', 3000);
            }
        }, 500);
    }
});

// 执行安全初始化
safeInitialize();