const options = {
    'jQueryURL': 'https://libs.baidu.com/jquery/2.0.0/jquery.min.js'
};
console.log('inject!');
chrome.extension.onMessage.addListener((request, sender, sendResponse) => {
        // if (request.action == "GetBaiduKeyWord") {
        //     sendResponse({kw: document.forms[0].wd.value});
        // }
        if (request.action == 'inject') {
            const script = document.createElement('script');
            script.src = options["jQueryURL"];
            script.type = 'text/javascript';

            script.onload = function () {
                console.log("jQuery(" + options["jQueryURL"] + ") loaded.");
            };
            script.onerror = function () {
                console.log("Error while loading jQuery(" + options["jQueryURL"] + ").");
            };
            document.head.appendChild(script);
            sendResponse({msg: 'success!'});
        }
        if (request.action === 'clear') {
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
