/**
 * API Mock Panel 逻辑
 */

let mockRules = [];
let interceptCount = 0;
let mockEnabled = false;

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
    console.log('🎭 API Mock Panel 初始化...');
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
        // DevTools Panel 需要通过 background 访问 storage
        chrome.runtime.sendMessage({ action: 'getMockRules' }, (response) => {
            console.log('📦 收到响应:', response);
            if (chrome.runtime.lastError) {
                console.error('❌ 消息发送失败:', chrome.runtime.lastError);
                showStatus('加载规则失败: ' + chrome.runtime.lastError.message, 'error');
                return;
            }
            
            if (response) {
                mockRules = response.mockRules || [];
                mockEnabled = response.mockEnabled || false;
                interceptCount = response.interceptCount || 0;
                
                elements.enableMock.checked = mockEnabled;
                renderRules();
                updateStats();
                
                console.log('✅ 规则加载成功，共', mockRules.length, '条');
                
                if (mockEnabled) {
                    injectMockScript();
                }
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
        injectMockScript();
        showStatus('✅ API Mock 已启用', 'success');
    } else {
        removeMockScript();
        showStatus('⚠️ API Mock 已禁用', 'info');
    }
    
    updateStats();
}

// 注入 Mock 脚本到页面
function injectMockScript() {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (rules) => {
            // 避免重复注入
            if (window.__API_MOCK_INJECTED__) {
                return;
            }
            window.__API_MOCK_INJECTED__ = true;
            
            // 保存原始 fetch
            const originalFetch = window.fetch;
            
            // 匹配 URL 模式
            function matchPattern(url, pattern) {
                const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                return regex.test(url);
            }
            
            // 重写 fetch
            window.fetch = async function(...args) {
                const url = args[0];
                const options = args[1] || {};
                const method = (options.method || 'GET').toUpperCase();
                
                // 查找匹配的规则
                const rule = rules.find(r => {
                    if (!r.enabled) return false;
                    const methodMatch = r.method === '*' || r.method === method;
                    const urlMatch = matchPattern(url, r.urlPattern);
                    return methodMatch && urlMatch;
                });
                
                if (rule) {
                    console.log('🎭 [API Mock] 拦截请求:', url, rule);
                    
                    // 延迟
                    if (rule.delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, rule.delay));
                    }
                    
                    // 返回 Mock 数据
                    return Promise.resolve({
                        ok: rule.statusCode >= 200 && rule.statusCode < 300,
                        status: rule.statusCode,
                        statusText: 'OK',
                        headers: new Headers({
                            'Content-Type': 'application/json',
                            'X-Mock': 'true'
                        }),
                        json: async () => rule.mockData,
                        text: async () => JSON.stringify(rule.mockData),
                        blob: async () => new Blob([JSON.stringify(rule.mockData)]),
                        arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(rule.mockData)).buffer,
                        clone: function() { return this; }
                    });
                }
                
                // 没有匹配的规则，使用原始 fetch
                return originalFetch.apply(this, args);
            };
            
            // 重写 XMLHttpRequest
            const originalXHROpen = XMLHttpRequest.prototype.open;
            const originalXHRSend = XMLHttpRequest.prototype.send;
            
            XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                this._method = method;
                this._url = url;
                return originalXHROpen.call(this, method, url, ...rest);
            };
            
            XMLHttpRequest.prototype.send = function(...args) {
                const rule = rules.find(r => {
                    if (!r.enabled) return false;
                    const methodMatch = r.method === '*' || r.method === this._method;
                    const urlMatch = matchPattern(this._url, r.urlPattern);
                    return methodMatch && urlMatch;
                });
                
                if (rule) {
                    console.log('🎭 [API Mock] 拦截 XHR 请求:', this._url, rule);
                    
                    setTimeout(() => {
                        Object.defineProperty(this, 'readyState', { value: 4, writable: false });
                        Object.defineProperty(this, 'status', { value: rule.statusCode, writable: false });
                        Object.defineProperty(this, 'statusText', { value: 'OK', writable: false });
                        Object.defineProperty(this, 'responseText', { value: JSON.stringify(rule.mockData), writable: false });
                        Object.defineProperty(this, 'response', { value: rule.mockData, writable: false });
                        
                        if (this.onreadystatechange) {
                            this.onreadystatechange();
                        }
                        if (this.onload) {
                            this.onload();
                        }
                    }, rule.delay || 0);
                    
                    return;
                }
                
                return originalXHRSend.apply(this, args);
            };
            
            console.log('✅ [API Mock] Mock 脚本已注入，规则数:', rules.length);
        },
        args: [mockRules.filter(r => r.enabled)]
    }).catch(error => {
        console.error('❌ 注入 Mock 脚本失败:', error);
        showStatus('注入 Mock 脚本失败', 'error');
    });
}

// 移除 Mock 脚本
function removeMockScript() {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
            window.__API_MOCK_INJECTED__ = false;
            console.log('⚠️ [API Mock] Mock 已禁用，请刷新页面恢复原始请求');
        }
    }).catch(error => {
        console.error('❌ 移除 Mock 脚本失败:', error);
    });
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
    
    // 如果 Mock 已启用，重新注入脚本
    if (mockEnabled) {
        injectMockScript();
    }
}

// 测试规则
function handleTestRule() {
    const urlPattern = elements.urlPattern.value.trim();
    const testUrl = prompt('请输入要测试的 URL:');
    
    if (!testUrl) return;
    
    const regex = new RegExp('^' + urlPattern.replace(/\*/g, '.*') + '$');
    const matched = regex.test(testUrl);
    
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
            
            if (mockEnabled) {
                injectMockScript();
            }
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
    a.download = `api-mock-rules-${Date.now()}.json`;
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
        
        if (mockEnabled) {
            injectMockScript();
        }
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
    
    if (mockEnabled) {
        injectMockScript();
    }
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
    elements.mockStatus.textContent = mockEnabled ? '✅ 已启用' : '❌ 未启用';
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

