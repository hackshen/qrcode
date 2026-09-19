/**
 * 默认扩展配置
 * 在 background.js 和 options.js 中共享
 */

const DEFAULT_EXTENSION_CONFIG = {
    // 功能开关
    features: {
        doubleCopyClick: false,
        passwordReveal: true,
        autoLogin: true,
        jsonViewer: true,
    },
    // Auto-Login 总开关由 features.autoLogin 控制；此处控制是否在所有页面显示悬浮球
    autoLogin: {
        showBall: true,
    },
    // API 配置
    api: {
        message: 'https://api.hackshen.com/message',
    },
    // CDN 配置
    cdn: {
        jquery: 'https://libs.baidu.com/jquery/2.0.0/jquery.min.js',
    },
    // 注：HTTP 头规则已独立存储于 extensionHttpRules key（storage.sync 单项 8KB 配额限制），
    // 不再随 extensionConfig 存储与合并，避免 mergeConfig 在扩展更新时复活旧字段
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

