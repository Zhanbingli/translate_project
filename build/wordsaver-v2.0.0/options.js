document.addEventListener('DOMContentLoaded', function() {
    // 加载保存的设置
    loadSettings();

    // 设置按钮点击事件
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    document.getElementById('clearCache').addEventListener('click', clearTranslationCache);
    
    // 设置标签页切换
    setupTabs();
    
    // 设置悬停翻译白名单功能
    document.getElementById('addToWhitelist').addEventListener('click', addToWhitelist);
    
    // 显示当前缓存大小
    updateCacheSize();
});

// 设置标签页切换逻辑
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有活跃状态
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // 添加当前活跃状态
            button.classList.add('active');
            const contentId = button.id.replace('tab-', 'content-');
            document.getElementById(contentId).classList.add('active');
        });
    });
}

// 加载保存的设置
function loadSettings() {
    chrome.storage.local.get({
        promptTemplate: '',
        hoverTranslateEnabled: true,
        phraseSelectionMode: false,
        keyboardShortcutEnabled: true,
        isAutoHide: true,
        whiteList: [],
        autoPlayAudio: false,
        hoverDelay: 300,
        maxCacheSize: 500
    }, function(items) {
        document.getElementById('promptTemplate').value = items.promptTemplate;
        document.getElementById('hoverTranslateEnabled').checked = items.hoverTranslateEnabled;
        document.getElementById('phraseSelectionMode').checked = items.phraseSelectionMode;
        document.getElementById('keyboardShortcutEnabled').checked = items.keyboardShortcutEnabled;
        document.getElementById('isAutoHide').checked = items.isAutoHide;
        document.getElementById('autoPlayAudio').checked = items.autoPlayAudio;
        document.getElementById('hoverDelay').value = items.hoverDelay;
        document.getElementById('maxCacheSize').value = items.maxCacheSize;
        
        // 渲染白名单
        renderWhiteList(items.whiteList);
    });
}

// 渲染白名单列表
function renderWhiteList(whiteList) {
    const container = document.getElementById('whiteListContainer');
    container.innerHTML = '';
    
    if (whiteList.length === 0) {
        container.innerHTML = '<p class="text-muted">暂无白名单网站</p>';
        return;
    }
    
    whiteList.forEach(site => {
        const item = document.createElement('div');
        item.className = 'site-list-item';
        
        const siteText = document.createElement('span');
        siteText.textContent = site;
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '删除';
        removeBtn.addEventListener('click', () => removeFromWhitelist(site));
        
        item.appendChild(siteText);
        item.appendChild(removeBtn);
        container.appendChild(item);
    });
}

// 添加网站到白名单
function addToWhitelist() {
    const input = document.getElementById('newWebsite');
    const site = input.value.trim();
    
    if (!site) {
        showStatus('请输入网站地址', 'error');
        return;
    }
    
    chrome.storage.local.get({ whiteList: [] }, function(items) {
        if (items.whiteList.includes(site)) {
            showStatus('该网站已在白名单中', 'warning');
            return;
        }
        
        const newWhiteList = [...items.whiteList, site];
        chrome.storage.local.set({ whiteList: newWhiteList }, function() {
            renderWhiteList(newWhiteList);
            input.value = '';
            showStatus('已添加到白名单', 'success');
        });
    });
}

// 从白名单删除网站
function removeFromWhitelist(site) {
    chrome.storage.local.get({ whiteList: [] }, function(items) {
        const newWhiteList = items.whiteList.filter(s => s !== site);
        chrome.storage.local.set({ whiteList: newWhiteList }, function() {
            renderWhiteList(newWhiteList);
            showStatus('已从白名单移除', 'success');
        });
    });
}

// 保存所有设置
function saveSettings() {
    const settings = {
        promptTemplate: document.getElementById('promptTemplate').value,
        hoverTranslateEnabled: document.getElementById('hoverTranslateEnabled').checked,
        phraseSelectionMode: document.getElementById('phraseSelectionMode').checked,
        keyboardShortcutEnabled: document.getElementById('keyboardShortcutEnabled').checked,
        isAutoHide: document.getElementById('isAutoHide').checked,
        autoPlayAudio: document.getElementById('autoPlayAudio').checked,
        hoverDelay: parseInt(document.getElementById('hoverDelay').value || 300),
        maxCacheSize: parseInt(document.getElementById('maxCacheSize').value || 500)
    };
    
    chrome.storage.local.set(settings, function() {
        showStatus('设置已保存', 'success');
    });
}

// 清除翻译缓存
function clearTranslationCache() {
    chrome.storage.local.get('translations', function(data) {
        const count = data.translations ? Object.keys(data.translations).length : 0;
        
        chrome.storage.local.remove('translations', function() {
            showStatus(`已清除 ${count} 条翻译缓存`, 'success');
            updateCacheSize();
        });
    });
}

// 更新缓存大小显示
function updateCacheSize() {
    chrome.storage.local.get('translations', function(data) {
        const count = data.translations ? Object.keys(data.translations).length : 0;
        document.getElementById('cacheSize').textContent = `(当前缓存: ${count} 条)`;
    });
}

// 显示状态消息
function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status ' + type;
    status.style.display = 'block';
    
    setTimeout(function() {
        status.style.display = 'none';
    }, 3000);
}

// 测试API功能（保留原有功能）
function testApiKey() {
    const apiKey = document.getElementById('apiKey').value;
    if (!apiKey) {
        showStatus('请输入API密钥', 'error');
        return;
    }

    const testWord = 'hello';
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent?key=${apiKey}`;
    
    // 构建请求体
    const requestBody = {
        contents: [{
            parts: [{
                text: `简短翻译英文单词到中文："${testWord}"`
            }]
        }]
    };

    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('请求失败，状态码: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        // 尝试从响应中提取翻译结果
        if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            const translationText = data.candidates[0].content.parts[0].text;
            showStatus(`API密钥有效! 测试翻译: ${testWord} → ${translationText}`, 'success');
        } else {
            showStatus('API密钥可能有效，但无法获取翻译结果', 'warning');
            console.log('API响应:', data);
        }
    })
    .catch(error => {
        console.error('测试API时出错:', error);
        testBackupEndpoint(apiKey, testWord);
    });
}

// 测试备用API端点
function testBackupEndpoint(apiKey, testWord) {
    // 尝试备用端点
    const backupEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    
    const requestBody = {
        contents: [{
            parts: [{
                text: `简短翻译英文单词到中文："${testWord}"`
            }]
        }]
    };

    fetch(backupEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('备用端点请求失败，状态码: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            const translationText = data.candidates[0].content.parts[0].text;
            showStatus(`API密钥有效 (备用端点)! 测试翻译: ${testWord} → ${translationText}`, 'success');
        } else {
            showStatus('API密钥可能有效 (备用端点)，但无法获取翻译结果', 'warning');
        }
    })
    .catch(error => {
        console.error('测试备用API端点时出错:', error);
        showStatus('API密钥无效或请求失败: ' + error.message, 'error');
    });
} 