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
        // dev 生成 source map 便于调试；打包不生成（产物中不被引用，省体积）
        sourceMap: process.env.NODE_ENV === 'development'
            ? { js: 'source-map', css: 'source-map' }
            : false,
    },
    dev: {
        writeToDisk: (file) => !file.includes('.hot-update.'),
        hmr: false, // Chrome 扩展不支持 HMR
    },
});
