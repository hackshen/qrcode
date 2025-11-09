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
