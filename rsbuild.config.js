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
            // `./src/assets/image.png` -> `./dist/image.png`
            {
                from: './src/dist',
            },
        ],
        distPath: {
            root: 'build',
        },
        // sourceMap: {
        //   js: 'source-map',
        // },
        filenameHash: false,
        cleanDistPath: true,
    },
    dev: {
        writeToDisk: (file) => !file.includes('.hot-update.'),
        hmr: true,
    },
});
