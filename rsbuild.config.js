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
            // 复制扩展所需的静态文件
            {
                from: './src/dist',
            },
        ],
        distPath: {
            root: 'build',
        },
        filenameHash: false,
        cleanDistPath: true,
        sourceMap: {
            js: 'hidden-source-map',  // 生成 source map 但不在代码中引用
            css: 'hidden-source-map', // 生成 source map 但不在代码中引用
        },
    },
    dev: {
        writeToDisk: (file) => !file.includes('.hot-update.'),
        hmr: false, // Chrome 扩展不支持 HMR
    },
});
