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
        tyAuthToken: 'tyAuthToken',
    },
    cookieNames: {
        sessionid: 'SESSIONID',
    },
    localStorageKeys: {
        tyAuthToken: 'tyAuthToken',
    },
};

// 工具函数：发送消息给 Content Script（带错误处理）
function sendMessageToTab(tabId, message, callback) {
    chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
            console.error('❌ 消息发送失败:', chrome.runtime.lastError.message);
            callback(null, chrome.runtime.lastError);
        } else {
            callback(response, null);
        }
    });
}

// 工具函数：显示提示消息
function showAlert(tabId, message) {
    sendMessageToTab(tabId, { action: 'alert', message }, () => {});
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
        handleGetSessionId(tab);
    }
    
    if (info.menuItemId === 'set_sessionid') {
        handleSetSessionId(tab);
    }
});

// 处理获取 SESSIONID 逻辑
function handleGetSessionId(tab) {
    // 1. 读取页面 localStorage
    sendMessageToTab(tab.id, { action: 'getPageLocalStorage' }, (response, error) => {
        if (error) {
            showAlert(tab.id, '❌ 无法访问页面数据，请刷新后重试');
            return;
        }
        
        console.log('📦 收到页面 localStorage:', response);
        
        // 2. 读取 Cookie
        chrome.cookies.getAll({ url: tab.url }, (cookies) => {
            const sessionCookie = cookies.find(item => item.name === CONFIG.cookieNames.sessionid);
            const sessionId = sessionCookie?.value || '';
            const tyAuthToken = response?.localStorage?.[CONFIG.localStorageKeys.tyAuthToken] || '';
            
            // 3. 保存到扩展存储
            const dataToSave = {
                [CONFIG.storageKeys.sessionid]: sessionId,
                [CONFIG.storageKeys.tyAuthToken]: tyAuthToken,
                savedTime: new Date().toISOString(),
                savedUrl: tab.url
            };
            
            chrome.storage.local.set(dataToSave, () => {
                const message = [
                    sessionId ? `✅ SESSIONID: ${sessionId}` : '⚠️  SESSIONID 未找到',
                    tyAuthToken ? `✅ tyAuthToken: ${tyAuthToken}` : '⚠️  tyAuthToken 未找到'
                ].join('\n');
                
                showAlert(tab.id, message);
                console.log('✅ 已保存到扩展存储:', dataToSave);
            });
        });
    });
}

// 处理设置 SESSIONID 逻辑
function handleSetSessionId(tab) {
    // 1. 读取保存的数据
    const keysToGet = [CONFIG.storageKeys.sessionid, CONFIG.storageKeys.tyAuthToken];
    
    chrome.storage.local.get(keysToGet, (result) => {
        const sessionId = result[CONFIG.storageKeys.sessionid] || '';
        const tyAuthToken = result[CONFIG.storageKeys.tyAuthToken] || '';
        
        if (!sessionId && !tyAuthToken) {
            showAlert(tab.id, '❌ 没有保存的数据，请先执行 GET SESSIONID');
            return;
        }
        
        const { origin } = new URL(tab.url);
        let cookieSet = false;
        let localStorageSet = false;
        
        // 2. 设置 Cookie
        if (sessionId) {
            chrome.cookies.set({
                url: origin,
                name: CONFIG.cookieNames.sessionid,
                value: sessionId,
            }, (cookie) => {
                cookieSet = !!cookie;
                tryComplete();
            });
        } else {
            tryComplete();
        }
        
        // 3. 设置页面 localStorage
        if (tyAuthToken) {
            sendMessageToTab(tab.id, {
                action: 'setPageLocalStorage',
                data: { [CONFIG.localStorageKeys.tyAuthToken]: tyAuthToken }
            }, (response, error) => {
                localStorageSet = !error && response?.success;
                tryComplete();
            });
        } else {
            tryComplete();
        }
        
        // 4. 等待两个操作都完成后显示结果
        let completedCount = 0;
        function tryComplete() {
            completedCount++;
            if (completedCount >= 2) {
                const messages = [];
                if (sessionId) messages.push(cookieSet ? '✅ SESSIONID 已设置' : '❌ SESSIONID 设置失败');
                if (tyAuthToken) messages.push(localStorageSet ? '✅ tyAuthToken 已设置' : '❌ tyAuthToken 设置失败');
                messages.push('🔄 刷新页面生效');
                
                showAlert(tab.id, messages.join('\n'));
                console.log('✅ 已恢复:', { sessionId: !!sessionId, tyAuthToken: !!tyAuthToken, cookieSet, localStorageSet });
            }
        }
    });
}

// ============ HTTP 头规则动态管理 ============
importScripts('http-rules-manager.js');

// ============ SourceMap 自动注入 ============
importScripts('sourcemap-injector.js');
