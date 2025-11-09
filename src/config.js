/**
 * 扩展配置文件
 * 集中管理所有域名、URL 和常量配置
 */

const CONFIG = {
    // 作者信息
    author: {
        name: 'Author: Hshen',
        blog: 'http://hackshen.com',
        toolsUrl: 'https://tools.hackshen.com/',
    },

    // API 配置
    api: {
        message: 'https://api.hackshen.com/message',
    },

    // CDN 配置
    cdn: {
        jquery: 'https://libs.baidu.com/jquery/2.0.0/jquery.min.js',
    },

    // UI 文本配置
    text: {
        qrCode: 'Current qr code',
        options: 'Options',
    },

    // Referer 修改规则（对应 declarativeNetRequest 规则）
    refererRules: [
        {
            id: 1,
            urlPattern: '*://statics.lotsmall.cn/*',
            referer: 'https://wap.lotsmall.cn/',
            description: 'Lotsmall 静态资源',
        },
        {
            id: 2,
            urlPattern: '*://p3-juejin.byteimg.com/*',
            referer: 'https://juejin.cn/',
            description: '掘金图片',
        },
        {
            id: 3,
            urlPattern: '*://statics.huangshan.com.cn/*',
            referer: '*',
            description: '黄山静态资源（CORS）',
            headerType: 'Access-Control-Allow-Origin',
        },
    ],

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

