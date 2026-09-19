import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
    // 忽略：构建产物、依赖、第三方 vendor
    {
        ignores: ['build/', 'node_modules/', 'release/', 'src/extension/vendor/'],
    },

    // 基础：所有 JS
    js.configs.recommended,

    // React 页面（src/*.js，经 rsbuild 打包，ESM）
    {
        files: ['src/*.js'],
        ...react.configs.flat.recommended,
        plugins: {
            ...react.configs.flat.recommended.plugins,
            'react-hooks': reactHooks,
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: { ecmaFeatures: { jsx: true } },
            globals: { ...globals.browser, chrome: 'readonly' },
        },
        settings: { react: { version: 'detect' } },
        rules: {
            // 经典 hooks 两条核心规则（新版 recommended 含 React Compiler 系规则，对存量代码过于激进）
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            // React 18+ 经 npm 引入，无需 prop-types
            'react/prop-types': 'off',
            // 让核心 no-unused-vars 识别 JSX 引用（否则组件全被误报 unused）
            'react/jsx-uses-vars': 'error',
            // 自动 JSX runtime 下 React 标识符可不写
            'react/react-in-jsx-scope': 'off',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
        },
    },

    // src/config.js：含 UMD 导出分支（module 变量）
    {
        files: ['src/config.js'],
        languageOptions: {
            globals: { module: 'readonly' },
        },
    },

    // 扩展经典脚本（src/extension/**，IIFE，无构建依赖，含 chrome.* API）
    {
        files: ['src/extension/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                chrome: 'readonly',
                // service worker 经 importScripts 注入的运行时全局
                importScripts: 'readonly',
                // default-config.js 的 UMD 导出分支
                module: 'readonly',
            },
        },
        rules: {
            // 存量代码为主，只保留高价值规则，避免大改历史文件
            'no-unused-vars': ['warn', { args: 'none' }],
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-prototype-builtins': 'off',
            'no-useless-escape': 'off', // 存量正则含冗余转义，语义无害不动它
        },
    },

    // background.js：default-config.js 经 importScripts 引入后成为同域全局
    {
        files: ['src/extension/background.js'],
        languageOptions: {
            globals: { DEFAULT_EXTENSION_CONFIG: 'readonly' },
        },
    },

    // json-viewer：CodeMirror 由 background 运行时注入，非模块依赖
    {
        files: ['src/extension/json-viewer.js'],
        languageOptions: {
            globals: { CodeMirror: 'readonly' },
        },
    },

    // 测试（Node 环境）
    {
        files: ['tests/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.node, chrome: 'readonly' },
        },
    },
];
