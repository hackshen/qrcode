// ============ SourceMap 自动注入系统 ============

console.log('[SourceMap] 🟢 已启动');

// 配置
const SOURCEMAP_CONFIG = {
    // 目标域名
    domains: [
        '======',
    ],
    // SourceMap 后缀
    suffix: '.xxx.map',
    // 规则 ID 起始
    ruleIdStart: 20000,
};

// 已创建的规则 Map: url -> ruleId
const createdRules = new Map();
let nextRuleId = SOURCEMAP_CONFIG.ruleIdStart;

// 判断 URL 是否需要处理
function shouldHandle(url) {
    try {
        const { hostname } = new URL(url);
        return SOURCEMAP_CONFIG.domains.includes(hostname) && url.endsWith('.js');
    } catch {
        return false;
    }
}

// 为 JS 文件创建 SourceMap 规则
async function createRule(url) {
    if (createdRules.has(url)) {
        console.log('[SourceMap] ⏭️  已存在:', url);
        return;
    }

    const ruleId = nextRuleId++;
    const mapUrl = url + SOURCEMAP_CONFIG.suffix;
    const headerName = url.includes('bb.js') ? 'X-SourceMap' : 'SourceMap';

    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [{
                id: ruleId,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [{
                        header: headerName,
                        operation: 'set',
                        value: mapUrl
                    }]
                },
                condition: {
                    urlFilter: url,
                    resourceTypes: ['script']
                }
            }]
        });

        createdRules.set(url, ruleId);
        console.log(`[SourceMap] ✅ ${url}`);
        console.log(`[SourceMap]    → ${headerName}: ${mapUrl}`);
    } catch (err) {
        console.error('[SourceMap] ❌ 创建失败:', err, url);
    }
}

// 扫描页面上的 JS 文件
async function scanPageScripts(tabId) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                // 获取所有 script 标签的 src
                const scripts = Array.from(document.querySelectorAll('script[src]'));
                return scripts.map(s => s.src).filter(src => src && src.startsWith('http'));
            }
        });

        if (results && results[0] && results[0].result) {
            const scriptUrls = results[0].result;
            console.log(`[SourceMap] 📋 发现 ${scriptUrls.length} 个 JS 文件`);
            
            // 筛选并创建规则
            const targetUrls = scriptUrls.filter(shouldHandle);
            if (targetUrls.length > 0) {
                console.log(`[SourceMap] 🎯 其中 ${targetUrls.length} 个来自目标域名`);
                for (const url of targetUrls) {
                    await createRule(url);
                }
                console.log(`[SourceMap] 💡 共创建 ${targetUrls.length} 条规则，刷新页面后生效`);
            } else {
                console.log(`[SourceMap] ⏭️  没有来自目标域名的 JS 文件`);
            }
        }
    } catch (err) {
        console.log('[SourceMap] ⚠️  无法扫描页面:', err.message);
    }
}

// 监听页面加载完成
chrome.webNavigation.onDOMContentLoaded.addListener((details) => {
    // 只处理主框架
    if (details.frameId === 0) {
        console.log('[SourceMap] 📄 页面加载完成:', details.url);
        scanPageScripts(details.tabId);
    }
});

// 监听来自 content script 的消息（动态 JS）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'add-sourcemap' && request.url) {
        console.log('[SourceMap] 📨 收到来自页面的 JS:', request.url);
        createRule(request.url).then(() => {
            sendResponse({ success: true });
        });
        return true; // 保持消息通道开启
    }
});

// 扩展启动时清理所有旧规则
chrome.runtime.onInstalled.addListener(async () => {
    console.log('[SourceMap] 🧹 清理旧规则...');
    
    try {
        const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
        const ids = oldRules.map(r => r.id);
        
        if (ids.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({ 
                removeRuleIds: ids 
            });
            console.log(`[SourceMap] 🗑️  已清除 ${ids.length} 条旧规则`);
        }
        
        console.log('[SourceMap] ✅ 初始化完成');
    } catch (err) {
        console.error('[SourceMap] ❌ 初始化失败:', err);
    }
});

console.log('[SourceMap] 📋 监听域名:', SOURCEMAP_CONFIG.domains);
console.log('[SourceMap] 💡 访问网站 → 自动检测 JS（含动态加载）→ 刷新页面 → 生效');
