import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
    // environments: {
    //   node: {
    //     source: {
    //       entry: {
    //         background: './src/background.js',
    //       },
    //     },
    //     output: {
    //       target: 'node',
    //     },
    //   },
    //   web: {
    //     source: {
    //       entry: {
    //         popup: './src/popup.js',
    //       },
    //     },
    //     output: {
    //       target: 'web',
    //     },
    //   },
    // },
    plugins: [pluginReact(),

    ],
    source: {
        entry: {
            popup: './src/popup.js',
            options: './src/options.js',
            sidepanel: './src/sidepanel.js',
            // 扩展脚本 entry：需要 import 共享模块（src/shared），打包为单文件产物供 manifest 引用
            background: './src/extension/background.js',
            'http-rules-manager': './src/extension/http-rules-manager.js',
        },
    },
    html: {
        template: ({ entryName }) => {
            const templates = {
                popup: './src/popup.html',
                options: './src/options.html',
                sidepanel: './src/sidepanel.html',
            };
            return templates[entryName];
        },
    },
    tools: {
        // rspack: {
        // }
    },
    output: {
        copy: [
            // 复制扩展所需的静态文件（entry 化的脚本除外，它们经打包产出）
            {
                from: './src/extension',
                globOptions: {
                    ignore: ['**/background.js', '**/http-rules-manager.js'],
                },
            },
        ],
        distPath: {
            root: 'build',
            js: '',
        },
        // entry 产物平铺在 build 根目录：manifest 引用的脚本路径（background.js 等）不能带 hash/子目录
        filenameHash: false,
        filename: {
            js: '[name].js',
        },
        cleanDistPath: true,
        // 不生成 source map：产物中不被引用、无实际排查价值（排查问题对照 src/ 源码），省 879KB 产物体积
        sourceMap: false,
    },
    dev: {
        writeToDisk: (file) => !file.includes('.hot-update.'),
        hmr: false, // Chrome 扩展不支持 HMR
    },
});
