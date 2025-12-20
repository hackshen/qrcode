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
    // 功能开关
    features: {
        doubleCopyClick: true,      // 双击复制
        passwordReveal: true,        // 密码框显示
        // globalErrorMonitor: false,   // 全局错误监控
        sourcemapMonitor: false,     // SourceMap 监控
    },
    // OCR 验证码识别配置
    ocr: {
        autoRecognize: true,
        apiUrl: 'https://npm.hackshen.com/ocr'
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

// ============ SourceMap 监控（已禁用）============

function initSourceMapMonitor() {
    // 功能已禁用
    return;
}

// ============ 全局错误监控（已禁用）============

function initGlobalErrorMonitor() {
    // 功能已禁用
    return;
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
    // initGlobalErrorMonitor();  // 已禁用

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
    const imgClass = img.className || '';

    // 检查图片自身类名或父容器
    return imgClass.includes('code-img') ||           // img.code-img
           imgClass.includes('captcha') ||            // img.captcha
           img.id?.includes('captcha') ||
           parentClass.includes('tel-code') ||        // .tel-code > img
           parentClass.includes('checkcode-warper') || // .checkcode-warper > img
           parentClass.includes('captcha');           // .captcha > img
}

// 验证码图片选择器（用于首次扫描）
const CAPTCHA_SELECTORS = [
    '.tel-code img',           // .tel-code 容器内的 img
    '.checkcode-warper img',   // .checkcode-warper 容器内的 img
    'img.code-img',            // img 自带 code-img 类名
    'img[class*="captcha"]'  // img 自带 captcha 类名
];

// 验证码输入框选择器
const INPUT_SELECTORS = [
    '.tel-code input',
    '.checkcode-warper input',
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

    // 统一监听 body，通过 isCaptchaImage 过滤验证码图片
    const observer = new MutationObserver((mutations) => {
        if (!captchaConfig.autoRecognize) return;

        let immediateCheckImages = []; // 需要立即检查的图片

        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return; // 只处理元素节点

                    // 如果新增节点本身是验证码图片
                    if (node.tagName === 'IMG' && isCaptchaImage(node)) {
                        immediateCheckImages.push(node);
                    }

                    // 如果新增节点包含验证码图片（例如新增了一个容器）
                    if (node.querySelectorAll) {
                        const images = node.querySelectorAll('img');
                        images.forEach(img => {
                            if (isCaptchaImage(img)) {
                                immediateCheckImages.push(img);
                            }
                        });
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

    // 监听整个 body
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src']
    });

    console.log('[Captcha Auto Fill] 👀 监控已启动');
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
    if (recognizingImages.has(img)) {
        console.log('[Captcha Auto Fill] ⏭️ 已在识别队列，跳过', img.src);
        return;
    }

    // 检查图片尺寸（仅在尺寸已知时过滤）
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const sizeKnown = width > 0 && height > 0;

    if (sizeKnown && (width > 800 || height > 400 || width < 10 || height < 10)) {
        console.log('[Captcha Auto Fill] ⏭️ 尺寸不匹配', width, height, img.src);
        return;
    } else if (!sizeKnown) {
        console.log('[Captcha Auto Fill] ℹ️ 尺寸未知，等待加载', width, height, img.src);
    }

    // 标记为正在识别
    recognizingImages.add(img);

    const tryRecognize = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const known = w > 0 && h > 0;

        if (known && (w > 800 || h > 400 || w < 10 || h < 10)) {
            console.log('[Captcha Auto Fill] ⏭️ 尺寸不匹配(延迟)', w, h, img.src);
            recognizingImages.delete(img);
            return;
        }

        if (!known) {
            console.log('[Captcha Auto Fill] ⚠️ 尺寸仍未知，放弃本次', w, h, img.src);
            recognizingImages.delete(img);
            return;
        }

        recognizeCaptcha(img);
    };

    // 检查图片是否已加载完成
    if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
        tryRecognize();
    } else {
        let recognized = false;

        img.onload = () => {
            if (!recognized) {
                recognized = true;
                tryRecognize();
            }
        };

        setTimeout(() => {
            if (!recognized) {
                recognized = true;
                tryRecognize();
            }
        }, 500);
    }
}

// 将图片转换为 base64
function imageToBase64(img) {
    return new Promise((resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;

            ctx.drawImage(img, 0, 0);

            // 转换为完整的 data URL (保留 data:image/png;base64, 前缀)
            const base64 = canvas.toDataURL('image/png');
            resolve(base64);
        } catch (error) {
            reject(error);
        }
    });
}

// 统一获取图片的 base64，适配 data:/blob:/http(s) 源
async function getImageBase64(img) {
    const src = img.src || '';

    // 已经是 data URL，直接返回，避免重复转码
    if (src.startsWith('data:image/')) {
        return src;
    }

    // blob URL：尝试 fetch 再转 base64
    if (src.startsWith('blob:')) {
        try {
            const blob = await fetch(src).then(r => r.blob());
            const reader = new FileReader();
            const base64 = await new Promise((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            return base64;
        } catch (error) {
            console.warn('[Captcha Auto Fill] ⚠️ blob 转 base64 失败，回退 canvas', error);
            return imageToBase64(img);
        }
    }

    // 默认：画布转码（需同源或允许 CORS）
    return imageToBase64(img);
}

// 识别验证码
async function recognizeCaptcha(img) {
    try {
        console.log('[Captcha Auto Fill] 🔄 正在识别:', img.src);

        // 将图片转换为 base64（兼容 data:/blob:/http 源）
        const base64DataUrl = await getImageBase64(img);
        console.log('[Captcha Auto Fill] 📸 图片已转换为 base64，大小:', Math.round(base64DataUrl.length / 1024), 'KB');

        // 从 data URL 中提取纯 base64 字符串（去掉 data:image/png;base64, 前缀）
        let pureBase64 = base64DataUrl;
        if (base64DataUrl.includes(',')) {
            pureBase64 = base64DataUrl.split(',')[1];
        }

        // 发送 base64 数据到 OCR API（使用 image 字段）
        const response = await fetch(`${captchaConfig.apiUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: pureBase64
            })
        });

        const data = await response.json();

        // 适配新接口响应格式: { success: true, message: "OCR识别成功", data: { text: "验证码", probability: null } }
        if (response.ok && data.success && data.data && data.data.text) {
            const text = data.data.text;
            const probability = data.data.probability;

            console.log('[Captcha Auto Fill] ✅ 识别成功:', text, probability ? '置信度: ' + probability + '%' : '');

            const input = findNearbyInput(img);
            if (input) {
                fillInput(input, text);
            } else {
                console.log('[Captcha Auto Fill] ⚠️  未找到验证码输入框');
            }
        } else {
            console.error('[Captcha Auto Fill] ❌ 识别失败:', data.message || '未知错误');
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
