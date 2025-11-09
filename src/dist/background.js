// Manifest V3 Background Service Worker

// 配置对象
const CONFIG = {
    contextMenus: {
        parentId: '_hshen',
        parentTitle: 'Paget Options',
        items: [
            { id: 'get_sessionid', title: 'GET SESSIONID' },
            { id: 'set_sessionid', title: 'SET SESSIONID' },
        ],
    },
    storageKeys: {
        sessionid: 'sessionid',
    },
};

function regGetCookie(str, key) {
    const cookie = str || '';
    if (cookie.indexOf(key) === -1) return '';
    const reg = new RegExp('.*([^;&]*' + key + '=)(.*?)([;&]|$).*');
    return cookie.replace(reg, '$2');
}

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
    // 创建父菜单
    chrome.contextMenus.create({
        title: CONFIG.contextMenus.parentTitle,
        id: CONFIG.contextMenus.parentId,
    });
    
    // 创建子菜单
    CONFIG.contextMenus.items.forEach(item => {
        chrome.contextMenus.create({
            title: item.title,
            parentId: CONFIG.contextMenus.parentId,
            id: item.id,
        });
    });
});

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'get_sessionid') {
        chrome.cookies.getAll({ url: tab.url }, function (cookies) {
            const resList = cookies.map(item => `${item.name}=${item.value}`);
            const cookieStr = resList.join(';');
            const val = regGetCookie(cookieStr, 'SESSIONID');
            if (val) {
                chrome.storage.local.set({ [CONFIG.storageKeys.sessionid]: val });
                chrome.tabs.sendMessage(tab.id, { 
                    action: 'alert', 
                    message: `SESSIONID: ${val}` 
                });
            } else {
                chrome.tabs.sendMessage(tab.id, { 
                    action: 'alert', 
                    message: '获取失败' 
                });
            }
        });
    }
    
    if (info.menuItemId === 'set_sessionid') {
        chrome.storage.local.get(CONFIG.storageKeys.sessionid, (result) => {
            const { origin } = new URL(tab.url);
            chrome.cookies.set({
                url: origin,
                name: 'SESSIONID',
                value: result[CONFIG.storageKeys.sessionid] || '',
            }, function (cookie) {
                if (cookie) {
                    chrome.tabs.sendMessage(tab.id, { 
                        action: 'alert', 
                        message: '设置成功' 
                    });
                }
            });
        });
    }
});

// Note: Manifest V3 使用 declarativeNetRequest 替代 webRequest
// 规则已在 rules.json 中定义，包括：
// 1. Lotsmall 静态资源 Referer
// 2. 掘金图片 Referer
// 3. 黄山静态资源 CORS 头

// ============ SourceMap 自动注入 ============
importScripts('sourcemap-injector.js');
