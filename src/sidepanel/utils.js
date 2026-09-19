// 注：本文件由 sidepanel.js 拆出，属纯代码搬移，逻辑未变

// ============ 工具函数 ============
// 生成随机颜色
export const generateRandomColor = () => {
    return '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
};

// 获取当前活动标签页
export const getCurrentTab = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
};

// ============ Chrome API 操作函数 ============
export const openDownload = () => {
    chrome.downloads.showDefaultFolder();
};

export const scriptInject = async () => {
    try {
        const tab = await getCurrentTab();
        chrome.tabs.sendMessage(tab.id, { action: 'inject' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('❌ jQuery 注入失败:', chrome.runtime.lastError);
            } else {
                console.log('✅ jQuery 注入成功:', response?.msg);
            }
        });
    } catch (error) {
        console.error('❌ 获取标签页失败:', error);
    }
};

export const clearDnsCache = async () => {
    try {
        const tab = await chrome.tabs.create({ 
            url: 'chrome://net-internals', 
            active: false 
        });
        
        setTimeout(async () => {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['clear.js']
                });
                
                await chrome.tabs.remove(tab.id);
                
                const currentTab = await getCurrentTab();
                chrome.tabs.sendMessage(currentTab.id, { action: 'clear' });
            } catch (error) {
                console.error('❌ DNS 缓存清除失败:', error);
                await chrome.tabs.remove(tab.id);
            }
        }, 500);
    } catch (error) {
        console.error('❌ 创建标签页失败:', error);
    }
};

// 映射配置中的 action 到实际函数
export const actionMap = {
    clearDnsCache,
    openDownload,
    scriptInject,
};
