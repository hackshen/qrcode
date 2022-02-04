const options = {
    'jQueryURL': 'https://libs.baidu.com/jquery/2.0.0/jquery.min.js'
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
const s = document.createElement('script');
s.innerHTML = `window.onerror = function (msg, url, row, col, error) {
    console.table({ msg, url, row, col, error: error.stack })
    let errorMsg = {
        type: 'javascript',
        msg: error?.stack || msg, 
        // 发生错误的行数
        row,
        // 列数，也就是第几个字符
        col,
        // 发生错误的页面地址
        url,
        // 发生错误的时间
        time: Date.now()
    }
}
`;
const ss = setInterval(a => {
    if (document.body) {
        clearInterval(ss);
        document.body.appendChild(s);

    }
}, 50)
chrome.storage.sync.get('openDev', (res) => {
    const {openDev =[]} = res;
    if (openDev && /aliexpress\.com/.test(locationUrl) && !(/_prefix_/.test(locationUrl))) {
        const [bef, aft] = window.location.href.split('?');
        window.location.replace(`${bef}?_prefix_=true${aft ? `&${aft}` : ''}`);
    }
    if (openDev.includes('newTab')) {
        require('./dist/utils/url');
    }
});

chrome.storage.sync.get('syncScript', res => {
    const {scriptCon} = res;

});


chrome.storage.sync.get('kaolaChecked', (res) => {
    const {kaolaChecked} = res;
    if (kaolaChecked && /kaola/.test(locationUrl)) {
        const timmer = setInterval(() => {
            const res = document.getElementById('addCart');
            // buyBtn
            if (res) {
                res.click();
                clearInterval(timmer);
                res.click();
                console.log('success~~');
            }
        }, 50);
        const timmerBuyBtn = setInterval(() => {
            const res = document.getElementById('buyBtn');
            // buyBtn
            if (res) {
                res.click();
                clearInterval(timmerBuyBtn);
                res.click();
                console.log('success~~');
            }
        }, 50);

        const timmerSubmit = setInterval(() => {
            const res = document.getElementsByClassName('z-submitbtn')[0];
            // buyBtn
            if (res) {
                res.click();
                clearInterval(timmerSubmit);
                res.click();
                console.log('success~~');
            }
        }, 50);
    }

});

const getKLData = () => {
    let script = document.createElement('script');
    script.type = 'text/javascript';
    script.id = 'hshen';
    script.str = '';
    script.innerHTML = `
        const hshen = document.getElementById('hshen');
        const str = JSON.stringify(window._mvq || '');
        hshen.setAttribute('str', str);
    `;
    document.head.appendChild(script);
}
chrome.extension.onMessage.addListener((request, sender, sendResponse) => {
        const {action} = request;
        // if (request.action == "GetBaiduKeyWord") {
        //     sendResponse({kw: document.forms[0].wd.value});
        // }
        if (action === 'inject') {
            loadScript(options.jQueryURL, (error, script) => {
                if (error) {
                    console.log(error);
                } else {
                    sendResponse({msg: 'success!'});
                    console.log("jQuery(" + options["jQueryURL"] + ") loaded.");
                }
            });
        }
        if (action === 'clear') {
            alert('DNS缓存清除成功!');
        }
        if (request.action === 'reload') {
            window.location.reload();
            sendResponse('success!');
        }
    }
);

window.onload = function () {
    let data = '';
    getKLData();
    const getStr = setInterval(() => {
        const str = document.getElementById('hshen').getAttribute('str');
        if (str) {
            clearInterval(getStr);
            data = str;
        }
    }, 100)

    document.body.addEventListener('click', async (e) => {
        console.log(e.target)
    });
    document.body.addEventListener('dblclick', async (e) => {
        const elText = e.target.innerText;
        console.log(elText);
        await navigator.clipboard.writeText(elText);
    })
}
