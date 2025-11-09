// 配置对象
const CONFIG = {
    cdn: {
        jquery: 'https://libs.baidu.com/jquery/2.0.0/jquery.min.js',
    },
};

const loadScript = (src, callback) => {
    let script = document.createElement('script');
    script.src = src;
    script.type = 'text/javascript';
    script.onload = () => callback && callback(null, script);
    script.onerror = () => callback && callback(new Error(`Script load error for ${src}`));
    document.head.append(script);
};

console.log('inject!');

const locationUrl = window.location.href;

// ============ 监听动态加载的 JS 文件 ============
const SOURCEMAP_DOMAINS = [''];

function shouldReportJS(url) {
    try {
        const { hostname } = new URL(url);
        return SOURCEMAP_DOMAINS.includes(hostname) && url.endsWith('.js');
    } catch {
        return false;
    }
}

// 上报 JS URL 给 background
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

console.log('[SourceMap] 👀 监听动态 JS:', SOURCEMAP_DOMAINS);

// 全局错误监控
const s = document.createElement('script');
s.innerHTML = `window.onerror = function (msg, url, row, col, error) {
    console.table({ msg, url, row, col, error: error.stack })
    let errorMsg = {
        type: 'javascript',
        msg: error?.stack || msg, 
        row,
        col,
        url,
        time: Date.now()
    }
}`;

// 监听来自 background 或 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const { action } = request;

    if (action === 'inject') {
        loadScript(CONFIG.cdn.jquery, (error, script) => {
            if (error) {
                console.log(error);
            } else {
                sendResponse({ msg: 'success!' });
                console.log("jQuery(" + CONFIG.cdn.jquery + ") loaded.");
            }
        });
        return true; // 保持消息通道开启
    }

    if (action === 'clear') {
        alert('DNS缓存清除成功!');
    }

    if (action === 'reload') {
        window.location.reload();
        sendResponse('success!');
    }

    // 处理来自 background 的 alert 消息（Manifest V3）
    if (action === 'alert') {
        alert(request.message);
    }
});

// 页面加载完成后的操作
window.onload = function () {
    // 双击复制文本
    document.body.addEventListener('dblclick', async (e) => {
        const elText = e.target.innerText;
        if (elText) {
            console.log('复制文本:', elText);
            await navigator.clipboard.writeText(elText);
        }
    });
    // 点击密码框，显示密码
    document.body.addEventListener('click', async (e) => {
        const elText = e.target.type;
        if (elText === 'password') {
            e.target.type = 'text';

        }
    });
};
