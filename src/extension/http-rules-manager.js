// ============ HTTP 头规则动态管理 ============
// 构建说明：本文件经 rsbuild 打包为单文件产物（同时作为 content script 与 background 引入），
// key/迁移逻辑从 src/shared/http-rules.js 引入（与 options.js 单一来源）

import { HTTP_RULES_KEY, migrateHttpRules } from '../shared/http-rules.js';

console.log('[HTTP Rules] 🟢 管理器已启动');

// 规则 ID 起始值（避免与 SourceMap 规则冲突）
const RULE_ID_START = 10000;

// 将配置规则转换为 declarativeNetRequest 规则
function convertToDeclarativeRule(configRule, index) {
    const ruleId = RULE_ID_START + index;

    // 操作方式：set（设置值）/ remove（删除头），默认 set（兼容旧配置）
    const operation = configRule.operation === 'remove' ? 'remove' : 'set';
    const header = {
        header: configRule.headerName,
        operation
    };
    if (operation === 'set') {
        header.value = configRule.headerValue ?? '';
    }

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
    // 说明：扩展声明了 declarativeNetRequestWithHostAccess + <all_urls> host 权限，
    // 请求头和响应头均可修改，无 Chrome 白名单限制
    if (configRule.headerType === 'request') {
        rule.action.requestHeaders = [header];
    } else {
        rule.action.responseHeaders = [header];
    }

    return rule;
}

// 读取规则配置（含一次性迁移：旧结构 extensionConfig.httpRules → 独立 key）
async function loadHttpRulesConfig() {
    const result = await chrome.storage.sync.get(['extensionConfig', HTTP_RULES_KEY]);
    // 无任何存储时返回 []（示例规则仅存在干 options 页，不自动生效）
    return (await migrateHttpRules(result)) ?? [];
}

// 应用规则
async function applyHttpRules() {
    try {
        // 读取配置
        const httpRules = await loadHttpRulesConfig();

        console.log('[HTTP Rules] 📋 读取到', httpRules.length, '条规则');

        // 获取现有的动态规则
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        console.log('[HTTP Rules] 📦 现有动态规则:', existingRules.length, '条');

        // 找出需要移除的规则（本管理器占用的 ID 段）
        const rulesToRemove = existingRules
            .filter(rule => rule.id >= RULE_ID_START && rule.id < 20000)
            .map(rule => rule.id);

        // 将启用的配置规则转换为 declarativeNetRequest 规则
        const enabledRules = httpRules.filter(rule => rule.enabled);
        console.log('[HTTP Rules] ✅ 启用的规则:', enabledRules.length, '条');

        const rulesToAdd = enabledRules.map((rule, index) => convertToDeclarativeRule(rule, index));

        // 更新规则
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: rulesToRemove,
            addRules: rulesToAdd
        });

        console.log('[HTTP Rules] ✅ 规则已更新，移除', rulesToRemove.length, '条，添加', rulesToAdd.length, '条');

        // 输出每条规则的详情
        enabledRules.forEach((rule, index) => {
            const headerType = rule.headerType === 'request' ? '请求头' : '响应头';
            const operation = rule.operation === 'remove' ? '删除' : '设置';
            const valuePart = rule.operation === 'remove' ? '' : `: ${rule.headerValue}`;
            console.log(`[HTTP Rules] ${index + 1}. ${rule.name} (${headerType}${operation})`);
            console.log(`   ${rule.urlFilter} → ${rule.headerName}${valuePart}`);
        });

    } catch (error) {
        console.error('[HTTP Rules] ❌ 应用规则失败:', error);
    }
}

// 监听配置变化
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;

    // 新结构：独立 key 变化（内容无变化时跳过重复应用）
    const ruleChange = changes[HTTP_RULES_KEY];
    if (ruleChange) {
        if (JSON.stringify(ruleChange.newValue) !== JSON.stringify(ruleChange.oldValue)) {
            console.log('[HTTP Rules] 🔄 检测到规则变化，重新应用...');
            applyHttpRules();
        }
        return;
    }

    // 旧结构兜底：迁移完成前 extensionConfig.httpRules 仍可能被旧版本页面更新
    const legacyChange = changes.extensionConfig;
    if (legacyChange) {
        const oldRules = legacyChange.oldValue?.httpRules || [];
        const newRules = legacyChange.newValue?.httpRules || [];
        if (JSON.stringify(oldRules) !== JSON.stringify(newRules)) {
            console.log('[HTTP Rules] 🔄 检测到旧结构规则变化，重新应用...');
            applyHttpRules();
        }
    }
});

// 立即应用规则
applyHttpRules();

console.log('[HTTP Rules] 💡 规则会在配置变化时自动更新');
