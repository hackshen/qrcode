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
    },
    dev: {
        writeToDisk: (file) => !file.includes('.hot-update.'),
        hmr: true,
    },
});
