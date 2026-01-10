/**
 * API Mock Panel - CDP 版本
 * 使用 Chrome DevTools Protocol 拦截网络请求
 */

let mockRules = [];
let interceptCount = 0;
let mockEnabled = false;
let debuggerAttached = false;

// DOM 元素
const elements = {
    enableMock: document.getElementById('enableMock'),
    urlPattern: document.getElementById('urlPattern'),
    method: document.getElementById('method'),
    statusCode: document.getElementById('statusCode'),
    delay: document.getElementById('delay'),
    mockData: document.getElementById('mockData'),
    addRule: document.getElementById('addRule'),
    testRule: document.getElementById('testRule'),
    importRules: document.getElementById('importRules'),
    exportRules: document.getElementById('exportRules'),
    clearRules: document.getElementById('clearRules'),
    rulesList: document.getElementById('rulesList'),
    status: document.getElementById('status'),
    ruleCount: document.getElementById('ruleCount'),
    interceptCount: document.getElementById('interceptCount'),
    mockStatus: document.getElementById('mockStatus')
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎭 API Mock Panel (CDP 版本) 初始化...');
    loadRules();
    updateStats();
    
    // 事件监听
    elements.enableMock.addEventListener('change', handleToggleMock);
    elements.addRule.addEventListener('click', handleAddRule);
    elements.testRule.addEventListener('click', handleTestRule);
    elements.importRules.addEventListener('click', handleImportRules);
    elements.exportRules.addEventListener('click', handleExportRules);
    elements.clearRules.addEventListener('click', handleClearRules);
});

// 加载规则
async function loadRules() {
    try {
        console.log('📥 正在加载 Mock 规则...');
        chrome.runtime.sendMessage({ action: 'getMockRules' }, (response) => {
            console.log('📦 收到响应:', response);
            if (chrome.runtime.lastError) {
                console.error('❌ 消息发送失败:', chrome.runtime.lastError);
                showStatus('加载规则失败: ' + chrome.runtime.lastError.message, 'error');
                return;
            }
            
            if (response) {
                mockRules = response.mockRules || [];
                // 默认不启用，忽略保存的状态
                mockEnabled = false;
                interceptCount = response.interceptCount || 0;
                
                // 确保开关是未选中状态
                elements.enableMock.checked = false;
                renderRules();
                updateStats();
                
                console.log('✅ 规则加载成功，共', mockRules.length, '条');
                console.log('⚠️ API Mock 默认未启用，请手动勾选开关');
            }
        });
    } catch (error) {
        console.error('❌ 加载规则失败:', error);
        showStatus('加载规则失败', 'error');
    }
}

// 保存规则
async function saveRules() {
    try {
        chrome.runtime.sendMessage({
            action: 'saveMockRules',
            data: {
                mockRules: mockRules,
                mockEnabled: mockEnabled,
                interceptCount: interceptCount
            }
        }, (response) => {
            if (response && response.success) {
                console.log('✅ 规则已保存');
            }
        });
    } catch (error) {
        console.error('❌ 保存规则失败:', error);
        showStatus('保存规则失败', 'error');
    }
}

// 切换 Mock 开关
async function handleToggleMock() {
    mockEnabled = elements.enableMock.checked;
    await saveRules();
    
    if (mockEnabled) {
        attachDebugger();
        showStatus('✅ API Mock 已启用 (CDP 模式)', 'success');
    } else {
        detachDebugger();
        showStatus('⚠️ API Mock 已禁用', 'info');
    }
    
    updateStats();
}

// 附加调试器
function attachDebugger() {
    if (debuggerAttached) {
        console.log('⚠️ 调试器已附加');
        showStatus('⚠️ 调试器已经在运行中', 'info');
        return;
    }
    
    const tabId = chrome.devtools.inspectedWindow.tabId;
    console.log('🔧 正在附加调试器到 Tab:', tabId);
    console.log('📋 当前 Mock 规则:', mockRules);
    
    chrome.debugger.attach({ tabId }, '1.3', () => {
        if (chrome.runtime.lastError) {
            console.error('❌ 附加调试器失败:', chrome.runtime.lastError);
            showStatus('附加调试器失败: ' + chrome.runtime.lastError.message, 'error');
            elements.enableMock.checked = false;
            mockEnabled = false;
            return;
        }
        
        debuggerAttached = true;
        console.log('✅ 调试器已附加到 Tab:', tabId);
        showStatus('✅ 调试器已附加，正在启用网络拦截...', 'success');
        
        // 启用网络拦截
        chrome.debugger.sendCommand({ tabId }, 'Fetch.enable', {
            patterns: [{ urlPattern: '*' }]
        }, () => {
            if (chrome.runtime.lastError) {
                console.error('❌ 启用网络拦截失败:', chrome.runtime.lastError);
                showStatus('启用网络拦截失败: ' + chrome.runtime.lastError.message, 'error');
                return;
            }
            console.log('✅ 网络拦截已启用，开始监听所有请求');
            showStatus('✅ API Mock (CDP) 已启用，刷新页面生效', 'success');
        });
        
        // 监听网络请求
        chrome.debugger.onEvent.addListener(handleDebuggerEvent);
        console.log('✅ 事件监听器已添加');
    });
}

// 分离调试器
function detachDebugger() {
    if (!debuggerAttached) {
        return;
    }
    
    const tabId = chrome.devtools.inspectedWindow.tabId;
    
    chrome.debugger.detach({ tabId }, () => {
        debuggerAttached = false;
        console.log('✅ 调试器已分离');
    });
    
    chrome.debugger.onEvent.removeListener(handleDebuggerEvent);
}

// 处理调试器事件
function handleDebuggerEvent(source, method, params) {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    
    if (source.tabId !== tabId) {
        return;
    }
    
    // 请求暂停事件
    if (method === 'Fetch.requestPaused') {
        const { requestId, request } = params;
        const url = request.url;
        const requestMethod = request.method;
        
        console.log('🌐 [CDP] 拦截到请求:', requestMethod, url);
        
        // 查找匹配的规则
        const rule = mockRules.find(r => {
            if (!r.enabled) {
                console.log('  ⏸️ 规则已禁用:', r.urlPattern);
                return false;
            }
            const methodMatch = r.method === '*' || r.method === requestMethod;
            const urlMatch = matchPattern(url, r.urlPattern);
            console.log('  🔍 测试规则:', r.urlPattern, '方法匹配:', methodMatch, 'URL匹配:', urlMatch);
            return methodMatch && urlMatch;
        });
        
        if (rule) {
            console.log('🎭 [CDP Mock] ✅ 匹配成功！拦截请求:', url);
            console.log('  📋 使用规则:', rule);
            interceptCount++;
            updateStats();
            saveRules(); // 保存拦截次数
            
            // 延迟
            setTimeout(() => {
                // 构造 Mock 响应
                const mockResponse = {
                    requestId: requestId,
                    responseCode: rule.statusCode,
                    responseHeaders: [
                        { name: 'Content-Type', value: 'application/json' },
                        { name: 'X-Mock', value: 'true' },
                        { name: 'Access-Control-Allow-Origin', value: '*' }
                    ],
                    body: btoa(unescape(encodeURIComponent(JSON.stringify(rule.mockData))))
                };
                
                console.log('  📤 返回 Mock 响应:', mockResponse);
                
                // 返回 Mock 响应
                chrome.debugger.sendCommand({ tabId }, 'Fetch.fulfillRequest', mockResponse, () => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ 返回 Mock 响应失败:', chrome.runtime.lastError);
                    } else {
                        console.log('✅ Mock 响应已成功返回');
                    }
                });
            }, rule.delay || 0);
        } else {
            console.log('  ⏭️ 无匹配规则，继续正常请求');
            // 继续正常请求
            chrome.debugger.sendCommand({ tabId }, 'Fetch.continueRequest', {
                requestId: requestId
            });
        }
    }
}

// URL 模式匹配
function matchPattern(url, pattern) {
    try {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$');
        return regex.test(url);
    } catch (error) {
        console.error('❌ 正则表达式错误:', error);
        return false;
    }
}

// 添加规则
async function handleAddRule() {
    const urlPattern = elements.urlPattern.value.trim();
    const method = elements.method.value;
    const statusCode = parseInt(elements.statusCode.value);
    const delay = parseInt(elements.delay.value);
    const mockDataText = elements.mockData.value.trim();
    
    // 验证
    if (!urlPattern) {
        showStatus('❌ 请输入 URL 匹配规则', 'error');
        return;
    }
    
    let mockData;
    try {
        mockData = mockDataText ? JSON.parse(mockDataText) : {};
    } catch (error) {
        showStatus('❌ Mock 数据格式错误，请输入有效的 JSON', 'error');
        return;
    }
    
    // 创建规则
    const rule = {
        id: Date.now(),
        urlPattern,
        method,
        statusCode,
        delay,
        mockData,
        enabled: true,
        createdAt: new Date().toISOString()
    };
    
    mockRules.push(rule);
    await saveRules();
    renderRules();
    updateStats();
    
    // 清空表单
    elements.urlPattern.value = '';
    elements.mockData.value = '';
    
    showStatus('✅ Mock 规则已添加', 'success');
}

// 测试规则
function handleTestRule() {
    const urlPattern = elements.urlPattern.value.trim();
    const testUrl = prompt('请输入要测试的 URL:');
    
    if (!testUrl) return;
    
    const matched = matchPattern(testUrl, urlPattern);
    
    if (matched) {
        showStatus(`✅ URL "${testUrl}" 匹配规则 "${urlPattern}"`, 'success');
    } else {
        showStatus(`❌ URL "${testUrl}" 不匹配规则 "${urlPattern}"`, 'error');
    }
}

// 导入规则
function handleImportRules() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const importedRules = JSON.parse(text);
            
            if (!Array.isArray(importedRules)) {
                throw new Error('格式错误');
            }
            
            mockRules = importedRules;
            await saveRules();
            renderRules();
            updateStats();
            
            showStatus(`✅ 成功导入 ${importedRules.length} 条规则`, 'success');
        } catch (error) {
            console.error('❌ 导入失败:', error);
            showStatus('❌ 导入失败，请检查文件格式', 'error');
        }
    };
    
    input.click();
}

// 导出规则
function handleExportRules() {
    if (mockRules.length === 0) {
        showStatus('⚠️ 没有可导出的规则', 'info');
        return;
    }
    
    const dataStr = JSON.stringify(mockRules, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-mock-rules-cdp-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showStatus(`✅ 已导出 ${mockRules.length} 条规则`, 'success');
}

// 清空规则
async function handleClearRules() {
    if (!confirm('确定要清空所有 Mock 规则吗？')) {
        return;
    }
    
    mockRules = [];
    interceptCount = 0;
    await saveRules();
    renderRules();
    updateStats();
    
    showStatus('✅ 已清空所有规则', 'success');
}

// 切换规则启用状态
async function toggleRule(id) {
    const rule = mockRules.find(r => r.id === id);
    if (rule) {
        rule.enabled = !rule.enabled;
        await saveRules();
        renderRules();
        updateStats();
    }
}

// 删除规则
async function deleteRule(id) {
    if (!confirm('确定要删除这条规则吗？')) {
        return;
    }
    
    mockRules = mockRules.filter(r => r.id !== id);
    await saveRules();
    renderRules();
    updateStats();
    
    showStatus('✅ 规则已删除', 'success');
}

// 编辑规则
function editRule(id) {
    const rule = mockRules.find(r => r.id === id);
    if (!rule) return;
    
    elements.urlPattern.value = rule.urlPattern;
    elements.method.value = rule.method;
    elements.statusCode.value = rule.statusCode;
    elements.delay.value = rule.delay;
    elements.mockData.value = JSON.stringify(rule.mockData, null, 2);
    
    // 删除旧规则
    mockRules = mockRules.filter(r => r.id !== id);
    saveRules();
    renderRules();
    updateStats();
    
    showStatus('✏️ 规则已加载到编辑器，修改后点击"添加 Mock 规则"保存', 'info');
}

// 渲染规则列表
function renderRules() {
    if (mockRules.length === 0) {
        elements.rulesList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
                <p>暂无 Mock 规则，点击上方"添加 Mock 规则"按钮创建</p>
            </div>
        `;
        return;
    }
    
    elements.rulesList.innerHTML = mockRules.map(rule => `
        <div class="rule-item ${rule.enabled ? '' : 'disabled'}" data-rule-id="${rule.id}">
            <div class="rule-header">
                <div class="rule-url">${escapeHtml(rule.urlPattern)}</div>
                <div class="rule-actions">
                    <button class="btn-secondary toggle-rule-btn" data-rule-id="${rule.id}">
                        ${rule.enabled ? '✅ 启用' : '⏸️ 禁用'}
                    </button>
                    <button class="btn-warning edit-rule-btn" data-rule-id="${rule.id}">✏️ 编辑</button>
                    <button class="btn-danger delete-rule-btn" data-rule-id="${rule.id}">🗑️ 删除</button>
                </div>
            </div>
            <div class="rule-meta">
                <span><strong>方法:</strong> ${rule.method}</span>
                <span><strong>状态码:</strong> ${rule.statusCode}</span>
                <span><strong>延迟:</strong> ${rule.delay}ms</span>
                <span><strong>创建时间:</strong> ${new Date(rule.createdAt).toLocaleString('zh-CN')}</span>
            </div>
            <div class="rule-body">
                <pre>${JSON.stringify(rule.mockData, null, 2)}</pre>
            </div>
        </div>
    `).join('');
    
    // 添加事件监听器
    attachRuleEventListeners();
}

// 为规则按钮添加事件监听器
function attachRuleEventListeners() {
    // 切换启用/禁用
    document.querySelectorAll('.toggle-rule-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const ruleId = parseInt(e.target.dataset.ruleId);
            toggleRule(ruleId);
        });
    });
    
    // 编辑规则
    document.querySelectorAll('.edit-rule-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const ruleId = parseInt(e.target.dataset.ruleId);
            editRule(ruleId);
        });
    });
    
    // 删除规则
    document.querySelectorAll('.delete-rule-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const ruleId = parseInt(e.target.dataset.ruleId);
            deleteRule(ruleId);
        });
    });
}

// 更新统计信息
function updateStats() {
    elements.ruleCount.textContent = mockRules.length;
    elements.interceptCount.textContent = interceptCount;
    elements.mockStatus.textContent = mockEnabled ? '✅ 已启用 (CDP)' : '❌ 未启用';
    elements.mockStatus.style.color = mockEnabled ? '#4CAF50' : '#999';
}

// 显示状态消息
function showStatus(message, type = 'info') {
    elements.status.textContent = message;
    elements.status.className = `status ${type}`;
    elements.status.style.display = 'block';
    
    setTimeout(() => {
        elements.status.style.display = 'none';
    }, 3000);
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 页面卸载时分离调试器
window.addEventListener('beforeunload', () => {
    if (debuggerAttached) {
        detachDebugger();
    }
});

