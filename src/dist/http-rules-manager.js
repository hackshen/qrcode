// ============ HTTP 头规则动态管理 ============

console.log('[HTTP Rules] 🟢 管理器已启动');

// 规则 ID 起始值（避免与 SourceMap 规则冲突）
const RULE_ID_START = 10000;

// Chrome 允许修改的响应头列表
const ALLOWED_RESPONSE_HEADERS = [
    'access-control-allow-origin',
    'access-control-allow-credentials',
    'access-control-allow-headers',
    'access-control-allow-methods',
    'access-control-expose-headers',
    'access-control-max-age'
];

// 将配置规则转换为 declarativeNetRequest 规则
function convertToDeclarativeRule(configRule, index) {
    const ruleId = RULE_ID_START + index;
    
    const headers = [{
        header: configRule.headerName,
        operation: 'set',
        value: configRule.headerValue
    }];
    
    const rule = {
        id: ruleId,
        priority: 1,
        action: {
            type: 'modifyHeaders'
        },
        condition: {
            urlFilter: configRule.urlFilter,
            resourceTypes: [
                'main_frame', 'sub_frame', 'stylesheet', 'script',
                'image', 'font', 'object', 'xmlhttprequest',
                'ping', 'csp_report', 'media', 'websocket', 'other'
            ]
        }
    };
    
    // 根据类型设置请求头或响应头
    if (configRule.headerType === 'request') {
        rule.action.requestHeaders = headers;
    } else {
        // 响应头 - 检查是否为 Chrome 允许的头
        const headerNameLower = configRule.headerName.toLowerCase();
        if (!ALLOWED_RESPONSE_HEADERS.includes(headerNameLower)) {
            console.warn(
                `[HTTP Rules] ⚠️  警告: "${configRule.headerName}" 不在 Chrome 允许的响应头列表中`,
                `\n   规则: ${configRule.name}`,
                `\n   Chrome 只允许修改这些响应头:`,
                ALLOWED_RESPONSE_HEADERS.join(', '),
                `\n   此规则可能不会生效！`
            );
        }
        rule.action.responseHeaders = headers;
    }
    
    return rule;
}

// 应用规则
async function applyHttpRules() {
    try {
        // 读取配置
        const result = await chrome.storage.sync.get('extensionConfig');
        const config = result.extensionConfig || {};
        const httpRules = config.httpRules || [];
        
        console.log('[HTTP Rules] 📋 读取到', httpRules.length, '条规则');
        console.log('[HTTP Rules] 📝 规则详情:', httpRules);
        
        // 获取现有的动态规则
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        console.log('[HTTP Rules] 📦 现有动态规则:', existingRules.length, '条');
        
        // 找出需要移除的规则（ID >= RULE_ID_START 的规则）
        const rulesToRemove = existingRules
            .filter(rule => rule.id >= RULE_ID_START && rule.id < 20000)
            .map(rule => rule.id);
        
        // 将启用的配置规则转换为 declarativeNetRequest 规则
        const enabledRules = httpRules.filter(rule => rule.enabled);
        console.log('[HTTP Rules] ✅ 启用的规则:', enabledRules.length, '条');
        
        const rulesToAdd = enabledRules.map((rule, index) => {
            const converted = convertToDeclarativeRule(rule, index);
            console.log('[HTTP Rules] 🔄 转换规则:', {
                original: rule,
                converted: converted
            });
            return converted;
        });
        
        // 更新规则
        console.log('[HTTP Rules] 🔧 准备更新规则...');
        console.log('[HTTP Rules]    移除:', rulesToRemove);
        console.log('[HTTP Rules]    添加:', rulesToAdd);
        
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: rulesToRemove,
            addRules: rulesToAdd
        });
        
        console.log('[HTTP Rules] ✅ 规则已更新');
        console.log('[HTTP Rules] 🗑️  移除', rulesToRemove.length, '条旧规则');
        console.log('[HTTP Rules] ➕ 添加', rulesToAdd.length, '条新规则');
        
        // 输出每条规则的详情
        rulesToAdd.forEach((rule, index) => {
            const configRule = httpRules.filter(r => r.enabled)[index];
            const headerType = configRule.headerType === 'request' ? '请求头' : '响应头';
            console.log(`[HTTP Rules] ${index + 1}. ${configRule.name} (${headerType})`);
            console.log(`   ${configRule.urlFilter} → ${configRule.headerName}: ${configRule.headerValue}`);
        });
        
    } catch (error) {
        console.error('[HTTP Rules] ❌ 应用规则失败:', error);
    }
}

// 监听配置变化
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.extensionConfig) {
        const oldRules = changes.extensionConfig.oldValue?.httpRules || [];
        const newRules = changes.extensionConfig.newValue?.httpRules || [];
        
        if (JSON.stringify(oldRules) !== JSON.stringify(newRules)) {
            console.log('[HTTP Rules] 🔄 检测到规则变化，重新应用...');
            applyHttpRules();
        }
    }
});

// 扩展安装或更新时初始化
chrome.runtime.onInstalled.addListener(() => {
    console.log('[HTTP Rules] 🔧 初始化规则...');
    applyHttpRules();
});

// 立即应用规则
applyHttpRules();

console.log('[HTTP Rules] 💡 规则会在配置变化时自动更新');
