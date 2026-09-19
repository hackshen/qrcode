/**
 * HTTP 头规则 —— key / 默认规则 / 一次性迁移 的单一来源
 * 消费方：options.js（React 页面）、extension/http-rules-manager.js（content script + background）
 *
 * 背景：规则原存于 extensionConfig.httpRules，受 storage.sync 单项 8KB 配额限制，
 * 已独立存储到 extensionHttpRules key。旧结构在首次读取时迁移。
 */

export const HTTP_RULES_KEY = 'extensionHttpRules';

export const DEFAULT_HTTP_RULES = [
    {
        id: 'lotsmall',
        enabled: true,
        name: 'Lotsmall 防盗链',
        urlFilter: '*://statics.lotsmall.cn/*',
        headerType: 'request',
        operation: 'set',
        headerName: 'Referer',
        headerValue: 'https://wap.lotsmall.cn/',
    },
    {
        id: 'juejin',
        enabled: true,
        name: '掘金图片防盗链',
        urlFilter: '*://p3-juejin.byteimg.com/*',
        headerType: 'request',
        operation: 'set',
        headerName: 'Referer',
        headerValue: 'https://juejin.cn/',
    },
    {
        id: 'huangshan',
        enabled: true,
        name: '黄山 CORS',
        urlFilter: '*://statics.huangshan.com.cn/*',
        headerType: 'response',
        operation: 'set',
        headerName: 'Access-Control-Allow-Origin',
        headerValue: '*',
    },
];

/**
 * 从 storage.get 结果中提取规则，必要时执行一次性迁移（旧结构 → 独立 key）。
 * @param {object} result chrome.storage.sync.get(['extensionConfig', HTTP_RULES_KEY]) 的结果
 * @returns {Promise<Array|null>} 已存储的规则；无任何存储时返回 null（由调用方决定回退值）
 */
export async function migrateHttpRules(result) {
    // 新结构已存在，直接使用
    if (Array.isArray(result[HTTP_RULES_KEY])) {
        return result[HTTP_RULES_KEY];
    }

    // 旧结构存在 httpRules 字段 → 迁移到独立 key，并从 extensionConfig 中移除
    const legacyRules = result.extensionConfig?.httpRules;
    if (Array.isArray(legacyRules)) {
        try {
            const { httpRules, ...configWithoutRules } = result.extensionConfig;
            await chrome.storage.sync.set({ [HTTP_RULES_KEY]: httpRules, extensionConfig: configWithoutRules });
            console.log('[HTTP Rules] 🔄 已迁移旧规则到独立存储 key:', HTTP_RULES_KEY);
        } catch (error) {
            console.error('[HTTP Rules] ❌ 规则迁移失败:', error);
        }
        return legacyRules;
    }

    return null;
}
