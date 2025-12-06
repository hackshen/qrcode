// 页面全局错误监控脚本
// 此文件会被注入到页面上下文中，可以捕获页面的 JavaScript 错误

(function() {
    'use strict';
    
    // 记录已捕获的错误，避免重复
    const errorCache = new Set();
    
    // 生成错误指纹
    function getErrorFingerprint(msg, url, line, col) {
        return `${msg}-${url}-${line}-${col}`;
    }
    
    // 格式化错误信息
    function formatError(msg, url, row, col, error) {
        const errorInfo = {
            type: 'JavaScript Error',
            message: msg,
            url: url || window.location.href,
            line: row,
            column: col,
            stack: error?.stack || 'No stack trace',
            timestamp: new Date().toLocaleString('zh-CN'),
            userAgent: navigator.userAgent
        };
        return errorInfo;
    }
    
    // 监听全局错误
    window.onerror = function(msg, url, row, col, error) {
        const fingerprint = getErrorFingerprint(msg, url, row, col);
        
        // 避免重复记录
        if (errorCache.has(fingerprint)) {
            return false;
        }
        errorCache.add(fingerprint);
        
        // 格式化并输出错误
        const errorInfo = formatError(msg, url, row, col, error);
        
        console.group('🔴 Global JavaScript Error');
        console.table(errorInfo);
        if (error && error.stack) {
            console.error('Stack Trace:', error.stack);
        }
        console.groupEnd();
        
        // 不阻止默认错误处理
        return false;
    };
    
    // 监听未处理的 Promise 错误
    window.addEventListener('unhandledrejection', function(event) {
        console.group('🔴 Unhandled Promise Rejection');
        console.error('Reason:', event.reason);
        console.error('Promise:', event.promise);
        console.groupEnd();
        
        // 不阻止默认处理
        event.preventDefault();
    });
    
    // 监听资源加载错误
    window.addEventListener('error', function(event) {
        if (event.target !== window) {
            console.group('🔴 Resource Load Error');
            console.table({
                type: 'Resource Error',
                tagName: event.target.tagName,
                src: event.target.src || event.target.href,
                timestamp: new Date().toLocaleString('zh-CN')
            });
            console.groupEnd();
        }
    }, true);
    
    console.log('[Error Monitor] ✅ 全局错误监控已启动');
})();
