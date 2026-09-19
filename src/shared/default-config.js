/**
 * 默认扩展配置 —— 单一来源
 * 消费方：options.js（React 页面）、background.js（service worker）
 * 注意：HTTP 头规则不在此处（见 shared/http-rules.js，storage.sync 单项 8KB 配额限制）
 */

export const DEFAULT_EXTENSION_CONFIG = {
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
    // OCR 验证码识别
    ocr: {
        apiUrl: 'https://api.hackshen.com/ocr',
        autoRecognize: true,
    },
    // 代理配置
    proxy: {
        enabled: false,
        mode: 'direct', // 'direct' | 'system' | 'auto_switch' | 'fixed'
        currentProfile: null, // 当前使用的代理配置 ID
        profiles: [], // 代理配置列表
        rules: [], // 自动切换规则
    },
    // SourceMap 注入配置
    sourcemap: {
        enabled: false, // 是否启用 SourceMap 注入
        rules: [], // SourceMap 注入规则列表
    },
};
