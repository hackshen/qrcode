// import React, {useState, useEffect} from 'react'
// import ReactDOM from 'react-dom';
// import axios from 'axios';
//
// import {Spin, BackTop} from 'antd';
//
// import styles from '../background.module.css';
//
//
// chrome.browserAction.setBadgeText({text: 'Shen'});
// chrome.browserAction.setBadgeBackgroundColor({color: 'skyblue'});
//
// chrome.contextMenus.create({
//     title: "test_click",
//     onclick: () => {
//
//         alert('Hi');
//     }
// });
//
// const getData = async (limit) => {
//     const res = await axios(`https://api.hackshen.com/message?limit=${limit}`);
//     const {data} = res;
//     return data;
// }
//
// let reqLock = true;
// const App = () => {
//     const [data, setData] = useState([]);
//     const [limit, setlimit] = useState(20);
//
//     useEffect(() => {
//         getData(limit).then(res => {
//             setData(res);
//             reqLock = false;
//         })
//     }, []);
//
//     useEffect(() => {
//         if (!reqLock) {
//             const io = new IntersectionObserver((entries) => {
//                 console.log(entries, 11)
//                 entries.forEach(item => {
//                     const {isIntersecting, target} = item;
//                     if (isIntersecting) {
//                         reqLock = true;
//                         io.unobserve(target);
//                         viewData();
//                     }
//                 })
//             }, {});
//             io.observe(document.getElementById('loading'));
//         }
//     });
//
//     const viewData = () => {
//         setlimit((v) => {
//             const limit = v + 1;
//             getData(limit).then(res => {
//                 reqLock = false;
//                 setData(data.concat(res));
//             });
//             return limit;
//         });
//
//     }
//     return (
//         <div className={styles.aa}>{data.map((item, index) => {
//             const {title} = item;
//             return <div key={index} className={styles.item}>{title}</div>
//         })}
//             {/*<div onClick={() => {*/}
//             {/*    viewData()*/}
//             {/*}} className="viewmore">view more*/}
//             {/*</div>*/}
//             <div id="loading" className={'loading'}>
//                 <Spin/>
//             </div>
//             <BackTop/>
//         </div>
//     )
// }
// ReactDOM.render(
//     <App/>
//     , document.getElementById('root'));
//

function regGetCookie(str, key) {
    var cookie = str || document.cookie;
    if (cookie.indexOf(key) === -1) return '';
    var reg = new RegExp('.*([^;&]*' + key + '=)(.*?)([;&]|$).*');
    return cookie.replace(reg,'$2')
}
chrome.contextMenus.create({
    title: "Paget Options",
    id: '_hshen',
});
chrome.contextMenus.create({
    title: 'GET SESSIONID',
    parentId: '_hshen',
    onclick: () => {
        chrome.tabs.getSelected(null, (tab) => {//获取当前tab
            const { url } = tab;
            chrome.cookies.getAll({ url }, function (cookies) {
                const resList = cookies.map(item => `${item.name}=${item.value}`)
                const cookieStr = resList.join(';')
                const val = regGetCookie(cookieStr, 'SESSIONID');
                if (val) {
                    localStorage.ss = val;
                    return alert(`SESSIONID: ${val}`);
                }
                alert('获取失败');
            });
        });
    }
});
chrome.contextMenus.create({
    title: 'SET SESSIONID',
    parentId: '_hshen',
    onclick: () => {
        chrome.tabs.getSelected(null, (tab) => {//获取当前tab
            const { url } = tab;
            const { origin } = new URL(url);
            chrome.cookies.set({
                url: origin,
                name: 'SESSIONID',
                value: localStorage.ss || '',

            }, function (cookies) {
                if (cookies) alert('设置成功');
            });
        });
    }
});


chrome.webRequest.onBeforeSendHeaders.addListener(function (details) {
        details.requestHeaders.push({
            name: 'Referer',
            value: 'https://wap.lotsmall.cn/'
        })
        return {
            requestHeaders: details.requestHeaders
        };
    },
    {
        urls: ["*://statics.lotsmall.cn/*"]
    },
    ["blocking", "requestHeaders", "extraHeaders"]
);


chrome.webRequest.onBeforeSendHeaders.addListener(function (details) {
        details.requestHeaders.push({
            name: 'Referer',
            value: 'https://juejin.cn/'
        })
        return {
            requestHeaders: details.requestHeaders
        };
    },
    {
        urls: ["*://p3-juejin.byteimg.com/*"]
    },
    ["blocking", "requestHeaders", "extraHeaders"]
);


chrome.webRequest.onBeforeSendHeaders.addListener(function (details) {
        details.requestHeaders.push({
            name: 'Access-Control-Allow-Origin',
            value: '*'
        })
        return {
            requestHeaders: details.requestHeaders
        };
    },
    {
        urls: ["*://statics.huangshan.com.cn/*"]
    },
    ["blocking", "requestHeaders", "extraHeaders"]
);



const REGEX = /^.*testtradewap\.lotsmall\.cn\/vue\/js\/(.*)\.js.*/;
// const REGEX = /^.*192.168.66.130:8081\/vue\/js\/(.*)\.js.*/;
const TARGET_TPL = 'https://sourcemap.def.alibaba-inc.com/sourcemap/$1/$2.js.map?enableCatchAll=true';

chrome.webRequest.onHeadersReceived.addListener(
    function(details) {
        if (details.url.match(REGEX)) {
            console.log(details.url, 2222)
            details.responseHeaders.push({
                name: 'sourcemap',
                value: `${details.url}.sd.map`
            })
            return {
                responseHeaders: details.responseHeaders
            };
            // const targetUrl = details.url.replace(REGEX, TARGET_TPL);
            // const headerSourcemap = { name: "sourcemap", value: `${details.url}.map` }
            // const responseHeaders = details.responseHeaders.concat(headerSourcemap);
            // return { responseHeaders };
        }
        return { responseHeaders: details.responseHeaders };
    },
    // filters
    {
        urls: ['<all_urls>'],
    },
    // extraInfoSpec
    ['blocking', 'responseHeaders', 'extraHeaders']
);
