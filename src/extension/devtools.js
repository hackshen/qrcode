/**
 * DevTools 入口文件
 * 创建自定义面板
 */

// 创建 API Mock 面板 (CDP 版本)
// chrome.devtools.panels.create(
//     'API Mock (CDP)',        // 面板标题
//     'favicon.png',           // 图标
//     'api-mock-panel.html',   // 面板页面
//     (panel) => {
//         console.log('✅ API Mock 面板 (CDP) 已创建');
        
//         // 面板显示时的回调
//         panel.onShown.addListener((window) => {
//             console.log('API Mock 面板已显示');
//         });
        
//         // 面板隐藏时的回调
//         panel.onHidden.addListener(() => {
//             console.log('API Mock 面板已隐藏');
//         });
//     }
// );

// 创建 SourceMap 注入面板
chrome.devtools.panels.create(
    'SourceMap Inject',      // 面板标题
    'favicon.png',           // 图标
    'sourcemap-panel.html',  // 面板页面
    (panel) => {
        console.log('✅ SourceMap 注入面板已创建');
        
        // 面板显示时的回调
        panel.onShown.addListener((window) => {
            console.log('SourceMap 注入面板已显示');
        });
        
        // 面板隐藏时的回调
        panel.onHidden.addListener(() => {
            console.log('SourceMap 注入面板已隐藏');
        });
    }
);

