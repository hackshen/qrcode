// ============ Content Script 入口 ============
console.log('[Content Script] ✅ 已注入:', window.location.href);

// 默认配置对象
let CONFIG = {
    cdn: {
        jquery: 'https://libs.baidu.com/jquery/2.0.0/jquery.min.js',
    },
    api: {
        message: 'https://api.hackshen.com/message',
    },
    // SourceMap 监控域名（留空则不启用）
    sourcemapDomains: [],
    // 功能开关
    features: {
        doubleCopyClick: true,      // 双击复制
        passwordReveal: true,        // 密码框显示
        globalErrorMonitor: false,   // 全局错误监控
        sourcemapMonitor: false,     // SourceMap 监控
    },
};

// 从 storage 加载配置
async function loadConfig() {
    try {
        const result = await chrome.storage.sync.get('extensionConfig');
        if (result.extensionConfig) {
            CONFIG = { ...CONFIG, ...result.extensionConfig };
            console.log('[Content Script] 📋 配置已加载:', CONFIG);
        }
    } catch (error) {
        console.error('[Content Script] ❌ 加载配置失败:', error);
    }
}

// ============ 工具函数 ============

// 加载外部脚本
const loadScript = (src, callback) => {
    const script = document.createElement('script');
    script.src = src;
    script.type = 'text/javascript';
    script.onload = () => callback && callback(null, script);
    script.onerror = () => callback && callback(new Error(`Script load error for ${src}`));
    document.head.append(script);
};

// ============ SourceMap 监控（可选功能）============

function initSourceMapMonitor() {
    if (!CONFIG.features.sourcemapMonitor || CONFIG.sourcemapDomains.length === 0) {
        return;
    }

    function shouldReportJS(url) {
        try {
            const { hostname } = new URL(url);
            return CONFIG.sourcemapDomains.includes(hostname) && url.endsWith('.js');
        } catch {
            return false;
        }
    }

    function reportJSUrl(url) {
        chrome.runtime.sendMessage({
            action: 'add-sourcemap',
            url: url
        }).catch(() => {
            // 忽略错误（Service Worker 可能未启动）
        });
    }

    // 监听动态添加的 script 标签
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.tagName === 'SCRIPT' && node.src && shouldReportJS(node.src)) {
                    console.log('[SourceMap] 🔍 发现动态 JS:', node.src);
                    reportJSUrl(node.src);
                }
            });
        });
    });

    // 开始监听
    if (document.documentElement) {
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        });
    }

    // 页面加载时上报已存在的 JS
    window.addEventListener('load', () => {
        document.querySelectorAll('script[src]').forEach(script => {
            if (shouldReportJS(script.src)) {
                reportJSUrl(script.src);
            }
        });
    });

    console.log('[SourceMap] 👀 监听域名:', CONFIG.sourcemapDomains);
}

// ============ 全局错误监控（可选功能）============

function initGlobalErrorMonitor() {
    if (!CONFIG.features.globalErrorMonitor) {
        return;
    }

    // 注入独立的错误监控脚本到页面上下文
    // 这样可以捕获页面的 JavaScript 错误，而不违反 CSP
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('error-monitor.js');
    script.onload = function() {
        console.log('[Error Monitor] ✅ 错误监控脚本已注入');
        this.remove(); // 加载后移除 script 标签
    };
    script.onerror = function() {
        console.error('[Error Monitor] ❌ 错误监控脚本加载失败');
        this.remove();
    };
    
    // 注入到页面
    (document.head || document.documentElement).appendChild(script);
}

// ============ 消息处理器 ============

// 消息处理函数映射
const messageHandlers = {
    // 注入 jQuery
    inject: (request, sendResponse) => {
        loadScript(CONFIG.cdn.jquery, (error, script) => {
            if (error) {
                console.error('[jQuery] ❌ 加载失败:', error);
                sendResponse({ success: false, error: error.message });
            } else {
                console.log('[jQuery] ✅ 加载成功:', CONFIG.cdn.jquery);
                sendResponse({ success: true, msg: 'jQuery loaded' });
            }
        });
        return true; // 保持消息通道开启
    },

    // DNS 缓存清除成功提示
    clear: (request, sendResponse) => {
        alert('DNS缓存清除成功!');
        sendResponse({ success: true });
    },

    // 重载页面
    reload: (request, sendResponse) => {
        window.location.reload();
        sendResponse({ success: true });
    },

    // 显示提示消息
    alert: (request, sendResponse) => {
        alert(request.message);
        sendResponse({ success: true });
    },

    // 配置更新通知
    configUpdated: (request, sendResponse) => {
        CONFIG = { ...CONFIG, ...request.config };
        console.log('[Content Script] 🔄 配置已更新:', CONFIG);
        sendResponse({ success: true });
    },

    // 读取页面 localStorage
    getPageLocalStorage: (request, sendResponse) => {
        try {
            const localStorageData = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                localStorageData[key] = localStorage.getItem(key);
            }
            
            console.log('📤 发送页面 localStorage:', localStorageData);
            sendResponse({ 
                success: true,
                localStorage: localStorageData,
                count: localStorage.length,
                url: window.location.href
            });
        } catch (error) {
            console.error('❌ 读取 localStorage 失败:', error);
            sendResponse({ 
                success: false,
                localStorage: {},
                error: error.message 
            });
        }
        return true;
    },

    // 设置页面 localStorage
    setPageLocalStorage: (request, sendResponse) => {
        try {
            const { data } = request;
            if (!data || typeof data !== 'object') {
                sendResponse({ success: false, error: '无效的数据格式' });
                return true;
            }

            let setCount = 0;
            Object.keys(data).forEach(key => {
                if (data[key]) {
                    localStorage.setItem(key, data[key]);
                    console.log(`✅ localStorage.${key} =`, data[key]);
                    setCount++;
                }
            });
            
            sendResponse({ 
                success: true,
                message: `已设置 ${setCount} 个键值对`
            });
        } catch (error) {
            console.error('❌ 设置 localStorage 失败:', error);
            sendResponse({ 
                success: false,
                error: error.message 
            });
        }
        return true;
    }
};

// 监听来自 background 或 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const { action } = request;
    
    // 查找对应的处理器
    const handler = messageHandlers[action];
    
    if (handler) {
        return handler(request, sendResponse);
    } else {
        console.warn('⚠️  未知的消息类型:', action);
        sendResponse({ success: false, error: 'Unknown action' });
        return false;
    }
});

// ============ 页面增强功能 ============

// 双击复制功能
function initDoubleClickCopy() {
    if (!CONFIG.features.doubleCopyClick) return;
    
    document.body.addEventListener('dblclick', async (e) => {
        const text = e.target.innerText?.trim();
        if (!text) return;
        
        try {
            await navigator.clipboard.writeText(text);
            console.log('[双击复制] ✅', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
            
            // 可选：显示复制成功提示
            // e.target.style.backgroundColor = '#90EE90';
            // setTimeout(() => e.target.style.backgroundColor = '', 300);
        } catch (error) {
            console.error('[双击复制] ❌', error);
        }
    });
    
    console.log('[双击复制] ✅ 已启用');
}

// 密码框显示功能
function initPasswordReveal() {
    if (!CONFIG.features.passwordReveal) return;
    
    document.body.addEventListener('click', (e) => {
        if (e.target.type === 'password') {
            e.target.type = 'text';
            console.log('[密码显示] ✅ 密码已显示');
        }
    });
    
    console.log('[密码显示] ✅ 已启用');
}

// ============ 初始化所有功能 ============

async function init() {
    // 先加载配置
    await loadConfig();
    
    // 等待 DOM 就绪
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFeatures);
    } else {
        initFeatures();
    }
}

function initFeatures() {
    // 初始化可选功能
    initSourceMapMonitor();
    initGlobalErrorMonitor();
    
    // 等待 body 加载完成
    if (document.body) {
        initDoubleClickCopy();
        initPasswordReveal();
    } else {
        window.addEventListener('load', () => {
            initDoubleClickCopy();
            initPasswordReveal();
        });
    }
    
    console.log('[Content Script] 🎉 所有功能已初始化');
}

// 监听配置变化
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.extensionConfig) {
        const oldConfig = CONFIG;
        CONFIG = { ...CONFIG, ...changes.extensionConfig.newValue };
        console.log('[Content Script] 🔄 配置已自动更新:', CONFIG);
        
        // 检查 SourceMap 监控开关是否变化
        if (oldConfig.features.sourcemapMonitor !== CONFIG.features.sourcemapMonitor) {
            if (CONFIG.features.sourcemapMonitor) {
                console.log('[SourceMap] 🔄 开关已开启，刷新页面后生效');
            } else {
                console.log('[SourceMap] 🔄 开关已关闭，刷新页面后生效');
            }
        }
    }
});

// 启动
init();
