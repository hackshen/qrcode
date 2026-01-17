/**
 * 默认扩展配置
 * 在 background.js 和 options.js 中共享
 */

const DEFAULT_EXTENSION_CONFIG = {
    // 功能开关
    features: {
        doubleCopyClick: false,
        passwordReveal: true,
    },
    // API 配置
    api: {
        message: 'https://api.hackshen.com/message',
    },
    // CDN 配置
    cdn: {
        jquery: 'https://libs.baidu.com/jquery/2.0.0/jquery.min.js',
    },
    // HTTP 头规则
    httpRules: [
        // {
        //     id: 'lotsmall',
        //     enabled: true,
        //     name: 'Lotsmall 防盗链',
        //     urlFilter: '*://statics.lotsmall.cn/*',
        //     headerType: 'request',
        //     headerName: 'Referer',
        //     headerValue: 'https://wap.lotsmall.cn/'
        // },
        // {
        //     id: 'juejin',
        //     enabled: true,
        //     name: '掘金图片防盗链',
        //     urlFilter: '*://p3-juejin.byteimg.com/*',
        //     headerType: 'request',
        //     headerName: 'Referer',
        //     headerValue: 'https://juejin.cn/'
        // },
        // {
        //     id: 'huangshan',
        //     enabled: true,
        //     name: '黄山 CORS',
        //     urlFilter: '*://statics.huangshan.com.cn/*',
        //     headerType: 'response',
        //     headerName: 'Access-Control-Allow-Origin',
        //     headerValue: '*'
        // }
    ],
    // OCR 验证码识别
    ocr: {
        apiUrl: 'https://api.hackshen.com/ocr',
        autoRecognize: true
    },
    // 代理配置
    proxy: {
        enabled: false,
        mode: 'direct',
        currentProfile: null,
        profiles: [],
        rules: []
    },
    // SourceMap 注入配置
    sourcemap: {
        enabled: false,
        rules: []
    }
};

// 兼容不同的模块系统
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DEFAULT_EXTENSION_CONFIG };
}

// 对于浏览器环境
if (typeof window !== 'undefined') {
    window.DEFAULT_EXTENSION_CONFIG = DEFAULT_EXTENSION_CONFIG;
}

