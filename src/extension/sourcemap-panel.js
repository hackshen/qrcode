// SourceMap 注入 Panel 核心逻辑
const tabId = chrome.devtools.inspectedWindow.tabId;

let isRunning = false;
let interceptCount = 0;
let injectCount = 0;
let sourcemapRules = [];
let sourcemapEnabled = false;

// DOM 元素
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const refreshRulesBtn = document.getElementById('refreshRulesBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const interceptCountEl = document.getElementById('interceptCount');
const injectCountEl = document.getElementById('injectCount');
const rulesList = document.getElementById('rulesList');
const logsContainer = document.getElementById('logsContainer');

// 初始化
init();

function init() {
    loadRules();
    setupEventListeners();
    addLog('info', '✅ SourceMap 注入工具已加载');
}

// 设置事件监听
function setupEventListeners() {
    startBtn.addEventListener('click', startInjection);
    stopBtn.addEventListener('click', stopInjection);
    clearLogsBtn.addEventListener('click', clearLogs);
    refreshRulesBtn.addEventListener('click', loadRules);
}

// 加载规则
function loadRules() {
    chrome.storage.sync.get('extensionConfig', (result) => {
        const config = result.extensionConfig || {};
        sourcemapEnabled = config.sourcemap?.enabled || false;
        sourcemapRules = config.sourcemap?.rules || [];
        
        renderRules();
        
        if (sourcemapEnabled && sourcemapRules.length > 0) {
            addLog('success', `✅ 已加载 ${sourcemapRules.length} 条规则`);
        } else if (!sourcemapEnabled) {
            addLog('warning', '⚠️ SourceMap 注入未启用，请在设置页面启用');
        } else {
            addLog('warning', '⚠️ 暂无注入规则，请在设置页面添加');
        }
    });
}

// 渲染规则列表
function renderRules() {
    if (!sourcemapRules || sourcemapRules.length === 0) {
        rulesList.innerHTML = '<div class="empty-state"><p>暂无规则，请在设置页面添加</p></div>';
        return;
    }

    const enabledRules = sourcemapRules.filter(r => r.enabled);
    
    rulesList.innerHTML = sourcemapRules.map(rule => `
        <div class="rule-item ${rule.enabled ? 'enabled' : ''}">
            <div class="rule-name">
                ${rule.enabled ? '✅' : '⭕'} ${rule.name}
            </div>
            <div class="rule-pattern">
                匹配: ${rule.urlPattern}
            </div>
            <div class="rule-sourcemap">
                SourceMap: ${rule.sourceMapUrl || '${url}.map (自动)'}
            </div>
        </div>
    `).join('');
    
    addLog('info', `📋 当前有 ${enabledRules.length}/${sourcemapRules.length} 条规则已启用`);
}

// 启动注入
function startInjection() {
    if (!sourcemapEnabled) {
        alert('❌ SourceMap 注入未启用，请在设置页面启用后重试');
        return;
    }

    if (!sourcemapRules || sourcemapRules.length === 0) {
        alert('❌ 暂无注入规则，请在设置页面添加规则后重试');
        return;
    }

    const enabledRules = sourcemapRules.filter(r => r.enabled);
    if (enabledRules.length === 0) {
        alert('❌ 没有启用的规则，请在设置页面启用至少一条规则');
        return;
    }

    addLog('info', '🚀 正在启动 SourceMap 注入...');

    // 附加调试器
    chrome.debugger.attach({ tabId }, '1.3', () => {
        if (chrome.runtime.lastError) {
            addLog('error', `❌ 附加调试器失败: ${chrome.runtime.lastError.message}`);
            return;
        }

        addLog('success', '✅ 调试器已附加');

        // 启用 Fetch 域
        chrome.debugger.sendCommand({ tabId }, 'Fetch.enable', {
            patterns: enabledRules.map(rule => ({
                urlPattern: rule.urlPattern,
                requestStage: 'Response' // 在响应阶段拦截
            })),
            handleAuthRequests: false
        }, () => {
            if (chrome.runtime.lastError) {
                addLog('error', `❌ 启用 Fetch 失败: ${chrome.runtime.lastError.message}`);
                chrome.debugger.detach({ tabId });
                return;
            }

            isRunning = true;
            updateUI();
            addLog('success', `✅ SourceMap 注入已启动，监控 ${enabledRules.length} 条规则`);
            addLog('info', `💡 请刷新页面以拦截 JS 文件请求`);
            
            // 打印监控的规则
            enabledRules.forEach((rule, index) => {
                addLog('info', `📌 规则 ${index + 1}: ${rule.urlPattern}`);
            });
            
            // 监听调试器事件
            chrome.debugger.onEvent.addListener(handleDebuggerEvent);
        });
    });
}

// 停止注入
function stopInjection() {
    addLog('info', '⏹️ 正在停止 SourceMap 注入...');

    chrome.debugger.onEvent.removeListener(handleDebuggerEvent);
    chrome.debugger.detach({ tabId }, () => {
        isRunning = false;
        updateUI();
        addLog('success', '✅ SourceMap 注入已停止');
    });
}

// 处理调试器事件
function handleDebuggerEvent(source, method, params) {
    if (source.tabId !== tabId) return;

    // 记录所有 Fetch 相关事件
    if (method.startsWith('Fetch.')) {
        addLog('info', `🔔 收到事件: ${method}`);
    }

    if (method === 'Fetch.requestPaused') {
        interceptCount++;
        updateStats();

        const url = params.request.url;
        addLog('info', `🔍 拦截请求: ${url}`);
        
        // 打印拦截阶段信息
        if (params.responseStatusCode) {
            addLog('info', `📡 响应状态: ${params.responseStatusCode}`);
            addLog('info', `📋 响应头数量: ${params.responseHeaders?.length || 0}`);
        } else {
            addLog('warning', `⚠️ 未获取到响应信息，可能在请求阶段拦截`);
        }

        // 查找匹配的规则
        const matchedRule = findMatchingRule(url);

        if (matchedRule) {
            addLog('success', `✅ 匹配规则: ${matchedRule.name}`);
            injectSourceMap(source, params, matchedRule);
        } else {
            addLog('warning', `⚠️ 未匹配任何规则: ${url}`);
            // 没有匹配的规则，直接继续
            chrome.debugger.sendCommand(source, 'Fetch.continueRequest', {
                requestId: params.requestId
            });
        }
    }
}

// 查找匹配的规则
function findMatchingRule(url) {
    const enabledRules = sourcemapRules.filter(r => r.enabled);
    
    for (const rule of enabledRules) {
        if (matchPattern(url, rule.urlPattern)) {
            return rule;
        }
    }
    
    return null;
}

// 匹配 URL 模式
function matchPattern(url, pattern) {
    // 将通配符模式转换为正则表达式
    const regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
        .replace(/\*/g, '.*'); // * 转换为 .*
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(url);
}

// 注入 SourceMap
function injectSourceMap(source, params, rule) {
    const url = params.request.url;
    
    // 生成 SourceMap URL
    const sourceMapUrl = generateSourceMapUrl(url, rule.sourceMapUrl);
    
    addLog('info', `💉 准备注入 SourceMap: ${sourceMapUrl}`);

    // 获取响应体（用于 fulfillRequest）
    chrome.debugger.sendCommand(source, 'Fetch.getResponseBody', {
        requestId: params.requestId
    }, (result) => {
        if (chrome.runtime.lastError) {
            addLog('error', `❌ 获取响应体失败: ${chrome.runtime.lastError.message}`);
            // 失败时尝试只用 continueRequest
            fallbackToContinueRequest(source, params, sourceMapUrl);
            return;
        }

        try {
            // 修改响应头，添加 SourceMap
            const headers = params.responseHeaders || [];
            
            // 检查是否已有 SourceMap 头
            const hasSourceMap = headers.some(h => 
                h.name.toLowerCase() === 'sourcemap' || 
                h.name.toLowerCase() === 'x-sourcemap'
            );

            if (hasSourceMap) {
                addLog('warning', `⚠️ 已存在 SourceMap 头，跳过注入: ${url}`);
                chrome.debugger.sendCommand(source, 'Fetch.continueRequest', {
                    requestId: params.requestId
                });
                return;
            }

            // 添加 SourceMap 响应头
            headers.push({
                name: 'SourceMap',
                value: sourceMapUrl
            });

            addLog('info', `📋 添加响应头: SourceMap: ${sourceMapUrl}`);

            // 使用 fulfillRequest 返回响应（保持原始内容，只修改响应头）
            chrome.debugger.sendCommand(source, 'Fetch.fulfillRequest', {
                requestId: params.requestId,
                responseCode: params.responseStatusCode || 200,
                responseHeaders: headers,
                body: result.body,
                base64Encoded: result.base64Encoded
            }, () => {
                if (chrome.runtime.lastError) {
                    addLog('error', `❌ 注入失败: ${chrome.runtime.lastError.message}`);
                } else {
                    injectCount++;
                    updateStats();
                    addLog('success', `✅ 注入成功（仅响应头）: ${url} → ${sourceMapUrl}`);
                    addLog('info', `💡 提示: 响应头已修改，但 Network 面板可能不显示`);
                }
            });
        } catch (error) {
            addLog('error', `❌ 处理失败: ${error.message}`);
            fallbackToContinueRequest(source, params, sourceMapUrl);
        }
    });
}

// 备用方案：使用 continueRequest
function fallbackToContinueRequest(source, params, sourceMapUrl) {
    addLog('warning', `⚠️ 使用备用方案：continueRequest`);
    
    const headers = params.responseHeaders || [];
    
    // 检查是否已有 SourceMap 头
    const hasSourceMap = headers.some(h => 
        h.name.toLowerCase() === 'sourcemap' || 
        h.name.toLowerCase() === 'x-sourcemap'
    );

    if (!hasSourceMap) {
        headers.push({
            name: 'SourceMap',
            value: sourceMapUrl
        });
    }

    chrome.debugger.sendCommand(source, 'Fetch.continueRequest', {
        requestId: params.requestId,
        responseHeaders: headers
    }, () => {
        if (chrome.runtime.lastError) {
            addLog('error', `❌ 备用方案失败: ${chrome.runtime.lastError.message}`);
        } else {
            injectCount++;
            updateStats();
            addLog('success', `✅ 备用方案成功: ${url} → ${sourceMapUrl}`);
        }
    });
}

// 生成 SourceMap URL
function generateSourceMapUrl(jsUrl, template) {
    if (!template || template.trim() === '') {
        // 默认：在原 URL 后添加 .map
        return jsUrl + '.map';
    }

    // 支持变量替换
    const url = new URL(jsUrl);
    const pathname = url.pathname; // 例如：/static/js/app.js
    const pathParts = pathname.split('/');
    const filename = pathParts.pop(); // 例如：app.js
    const path = pathParts.join('/'); // 例如：/static/js
    const basename = filename.replace(/\.[^.]+$/, ''); // 去掉扩展名，例如：app

    return template
        .replace(/\$\{url\}/g, jsUrl)
        .replace(/\$\{path\}/g, path)
        .replace(/\$\{filename\}/g, filename)
        .replace(/\$\{basename\}/g, basename);
}

// 更新 UI 状态
function updateUI() {
    if (isRunning) {
        statusIndicator.classList.add('active');
        statusText.textContent = '运行中';
        startBtn.disabled = true;
        stopBtn.disabled = false;
    } else {
        statusIndicator.classList.remove('active');
        statusText.textContent = '未启动';
        startBtn.disabled = false;
        stopBtn.disabled = true;
    }
}

// 更新统计
function updateStats() {
    interceptCountEl.textContent = interceptCount;
    injectCountEl.textContent = injectCount;
}

// 添加日志
function addLog(type, message) {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

// 清空日志
function clearLogs() {
    logsContainer.innerHTML = '';
    interceptCount = 0;
    injectCount = 0;
    updateStats();
    addLog('info', '🗑️ 日志已清空');
}

// 监听调试器分离事件
chrome.debugger.onDetach.addListener((source, reason) => {
    if (source.tabId === tabId) {
        isRunning = false;
        updateUI();
        addLog('warning', `⚠️ 调试器已分离: ${reason}`);
    }
});

