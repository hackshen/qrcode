/**
 * 扩展静态配置文件
 * 仅包含不需要用户修改的静态配置
 * 
 * 注意：用户可配置项（如 API 地址、功能开关等）已移至 src/dist/default-config.js
 */

const CONFIG = {
    // 作者信息
    author: {
        name: 'Author: Hshen',
        blog: 'http://hackshen.com',
        toolsUrl: 'https://tools.hackshen.com/',
    },

    // UI 文本配置
    text: {
        qrCode: 'Current qr code',
        options: 'Options',
    },

    // 菜单配置
    contextMenus: {
        parentId: '_hshen',
        parentTitle: 'Paget Options',
        items: [
            {
                id: 'get_sessionid',
                title: 'GET SESSIONID',
            },
            {
                id: 'set_sessionid',
                title: 'SET SESSIONID',
            },
        ],
    },

    // 快捷链接配置
    quickLinks: [
        {
            name: '清除DNS缓存',
            action: 'clearDnsCache',
            style: { background: '#55acee' },
        },
        {
            name: 'Download',
            action: 'openDownload',
        },
        {
            name: '注入jQuery',
            action: 'scriptInject',
            style: { background: 'skyblue' },
        },
        {
            name: '工具库',
            link: 'https://tools.hackshen.com/',
            style: { background: '#55acee' },
        },
    ],

    // Storage keys
    storageKeys: {
        sessionid: 'sessionid',
    },

    // ============ 以下配置已移至 src/dist/default-config.js ============
    // api: { ... }          → 移至 default-config.js
    // cdn: { ... }          → 移至 default-config.js
    // refererRules: [ ... ] → 已废弃，使用 httpRules（在 default-config.js 中）
};

// 兼容不同的模块系统
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

// 对于浏览器环境
if (typeof window !== 'undefined') {
    window.HSHEN_CONFIG = CONFIG;
}

// ES6 导出
export default CONFIG;

