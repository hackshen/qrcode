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
        initCaptchaAutoFill(); // 初始化验证码自动识别
    } else {
        window.addEventListener('load', () => {
            initDoubleClickCopy();
            initPasswordReveal();
            initCaptchaAutoFill(); // 初始化验证码自动识别
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
        
        // 检查 OCR 配置是否变化
        if (CONFIG.ocr) {
            const wasEnabled = captchaConfig.autoRecognize;
            captchaConfig.autoRecognize = CONFIG.ocr.autoRecognize || false;
            captchaConfig.apiUrl = CONFIG.ocr.apiUrl || 'https://api.hackshen.com/ocr';
            
            if (!wasEnabled && captchaConfig.autoRecognize) {
                console.log('[Captcha Auto Fill] ✅ 自动识别已启用，启动监控');
                startCaptchaMonitor();
            } else if (wasEnabled && !captchaConfig.autoRecognize) {
                console.log('[Captcha Auto Fill] ⏸️  自动识别已禁用');
            }
        }
    }
});

// 启动
init();

// ============ 验证码自动识别功能 ============

let captchaConfig = {
    autoRecognize: false,
    apiUrl: 'https://api.hackshen.com/ocr'
};

const recognizingImages = new WeakSet(); // 正在识别的图片（避免重复）

// 快速判断是否是验证码图片
function isCaptchaImage(img) {
    const parentClass = img.parentElement?.className || '';
    
    // 在特定容器内的图片都是验证码
    return parentClass.includes('tel-code') || 
           parentClass.includes('code-img') ||
           parentClass.includes('captcha') ||
           img.className?.includes('captcha') ||
           img.id?.includes('captcha');
}

// 验证码图片选择器（用于首次扫描）
const CAPTCHA_SELECTORS = [
    '.tel-code img',
    '.code-img img',
    '[class*="captcha"] img'
];

// 验证码输入框选择器
const INPUT_SELECTORS = [
    '.tel-code input',
    '.code-img input',
    '[class*="captcha"] input',
    'input[name*="captcha"]',
    'input[id*="captcha"]',
    'input[placeholder*="验证码"]'
];

// 启动验证码监控
function startCaptchaMonitor() {
    if (!captchaConfig.autoRecognize) return;
    
    // 初始扫描（立即执行，无延迟）
    scanCaptchaImages();
    
    // 防抖：避免频繁触发（仅用于动态变化）
    let debounceTimer = null;
    const debouncedScan = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            scanCaptchaImages();
        }, 300);
    };
    
    const observer = new MutationObserver((mutations) => {
        if (!captchaConfig.autoRecognize) return;
        
        let immediateCheckImages = []; // 需要立即检查的图片
        
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return; // 只处理元素节点
                    
                    if (node.tagName === 'IMG' && isCaptchaImage(node)) {
                        // 只有验证码图片才识别
                        immediateCheckImages.push(node);
                    }
                });
            } else if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                if (mutation.target.tagName === 'IMG' && isCaptchaImage(mutation.target)) {
                    const img = mutation.target;
                    // src 变化时，清除识别状态并重新识别
                    if (recognizingImages.has(img)) {
                        recognizingImages.delete(img);
                    }
                    console.log('[Captcha Auto Fill] 🔄 验证码图片 src 已变化，立即重新识别');
                    immediateCheckImages.push(img);
                }
            }
        }
        
        // 立即处理验证码图片（0ms 延迟）
        if (immediateCheckImages.length > 0) {
            immediateCheckImages.forEach(img => checkAndRecognizeCaptcha(img));
        }
    });
    
    // 🎯 只监听特定验证码容器，大幅减少性能开销
    const captchaContainers = document.querySelectorAll('.tel-code, .code-img, [class*="captcha"]');
    
    if (captchaContainers.length > 0) {
        captchaContainers.forEach(container => {
            observer.observe(container, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src']
            });
        });
        console.log(`[Captcha Auto Fill] 👀 监控已启动 (监听 ${captchaContainers.length} 个验证码容器)`);
    } else {
        // 如果没找到特定容器，降级为监听 body（兼容性）
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src']
        });
        console.log('[Captcha Auto Fill] 👀 监控已启动 (未找到特定容器，监听整个页面)');
    }
    
    // 监听容器动态添加（防抖，减少性能开销）
    let containerCheckTimer = null;
    const bodyObserver = new MutationObserver(() => {
        clearTimeout(containerCheckTimer);
        containerCheckTimer = setTimeout(() => {
            const newContainers = document.querySelectorAll('.tel-code, .code-img, [class*="captcha"]');
            newContainers.forEach(container => {
                // 检查是否已监听
                if (!container.dataset.captchaObserved) {
                    container.dataset.captchaObserved = 'true';
                    observer.observe(container, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ['src']
                    });
                    console.log('[Captcha Auto Fill] ➕ 检测到新的验证码容器，已添加监听');
                    // 扫描新容器中的图片
                    const images = container.querySelectorAll('img');
                    images.forEach(img => {
                        if (isCaptchaImage(img)) {
                            checkAndRecognizeCaptcha(img);
                        }
                    });
                }
            });
        }, 500);
    });
    
    bodyObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// 扫描页面中的验证码图片
function scanCaptchaImages() {
    const imageSet = new Set();
    
    CAPTCHA_SELECTORS.forEach(selector => {
        try {
            const images = document.querySelectorAll(selector);
            images.forEach(img => imageSet.add(img));
        } catch (e) {
            // 忽略无效的选择器
        }
    });
    
    const uniqueImages = Array.from(imageSet);
    if (uniqueImages.length > 0) {
        console.log('[Captcha Auto Fill] 🔍 发现', uniqueImages.length, '个验证码图片');
        uniqueImages.forEach(img => checkAndRecognizeCaptcha(img));
    }
}

// 检查并识别验证码
function checkAndRecognizeCaptcha(img) {
    if (!img.src) return;
    
    // 检查是否正在识别或已识别过（使用图片元素本身，而不是 URL）
    if (recognizingImages.has(img)) return;
    
    // 检查图片尺寸
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    
    if (width > 500 || height > 200 || width < 30 || height < 20) return;
    
    // 标记为正在识别
    recognizingImages.add(img);
    
    // 检查图片是否已加载完成
    if (img.complete && img.naturalWidth > 0) {
        recognizeCaptcha(img);
    } else {
        let recognized = false;
        
        img.onload = () => {
            if (!recognized) {
                recognized = true;
                recognizeCaptcha(img);
            }
        };
        
        setTimeout(() => {
            if (!recognized) {
                recognized = true;
                recognizeCaptcha(img);
            }
        }, 500);
    }
}

// 识别验证码
async function recognizeCaptcha(img) {
    try {
        const imageUrl = img.src;
        console.log('[Captcha Auto Fill] 🔄 正在识别:', imageUrl);
        
        const response = await fetch(`${captchaConfig.apiUrl}/recognize?url=${encodeURIComponent(imageUrl)}`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            const text = data.text;
            const confidence = data.confidence;
            
            console.log('[Captcha Auto Fill] ✅ 识别成功:', text, '置信度:', confidence + '%');
            
            const input = findNearbyInput(img);
            if (input) {
                fillInput(input, text);
            } else {
                console.log('[Captcha Auto Fill] ⚠️  未找到验证码输入框');
            }
        } else {
            console.error('[Captcha Auto Fill] ❌ 识别失败:', data.error || '未知错误');
        }
    } catch (error) {
        console.error('[Captcha Auto Fill] ❌ 识别出错:', error);
    }
}

// 查找附近的输入框
function findNearbyInput(img) {
    const parent = img.closest('label');
    if (parent?.htmlFor) {
        const input = document.getElementById(parent.htmlFor);
        if (input && input.tagName === 'INPUT') return input;
    }
    
    for (const selector of INPUT_SELECTORS) {
        const input = document.querySelector(selector);
        if (input) return input;
    }
    
    const form = img.closest('form');
    if (form) {
        const inputs = form.querySelectorAll('input[type="text"], input:not([type])');
        for (const input of inputs) {
            if (!input.value) return input;
        }
        if (inputs.length > 0) return inputs[0];
    }
    
    let current = img.parentElement;
    let depth = 0;
    while (current && depth < 5) {
        const inputs = current.querySelectorAll('input[type="text"], input:not([type])');
        if (inputs.length > 0) {
            for (const input of inputs) {
                if (!input.value && input.offsetWidth > 0 && input.offsetHeight > 0) {
                    return input;
                }
            }
        }
        current = current.parentElement;
        depth++;
    }
    
    return null;
}

// 填充输入框
function fillInput(input, text) {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    
    console.log('[Captcha Auto Fill] 📝 已填充:', text);
}

// 初始化验证码自动识别
function initCaptchaAutoFill() {
    if (!CONFIG?.ocr) return;
    
    captchaConfig.autoRecognize = CONFIG.ocr.autoRecognize || false;
    captchaConfig.apiUrl = CONFIG.ocr.apiUrl || 'https://api.hackshen.com/ocr';
    
    console.log('[Captcha Auto Fill] � 配置加载完成');
    console.log('[Captcha Auto Fill] 开关状态:', captchaConfig.autoRecognize ? '✅ 启用' : '⏸️  禁用');
    
    if (captchaConfig.autoRecognize) {
        console.log('[Captcha Auto Fill] 🚀 启动监控');
        startCaptchaMonitor();
    }
}
