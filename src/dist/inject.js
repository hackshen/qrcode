
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
    }
);

document.body.addEventListener('dblclick', async (e) => {
        const elText = e.target.innerText;
        console.log(elText);
        await navigator.clipboard.writeText(elText);
    }
)
