# DevKit Pro - 开发者工具箱

Chrome 浏览器扩展（Manifest V3）：二维码、JSON 高亮、HTTP 头规则、代理管理、Auto-Login、SourceMap 注入等开发常用工具集。

![screenshot](./src/describe.jpg)

## ✨ 功能特性

### 侧边栏（Side Panel）
- 🔲 **二维码生成** - 默认生成当前 URL 二维码，也可输入自定义内容
- 🎣 **每日毒鸡汤** - 来自 api.hackshen.com，点击刷新
- 👤 **账号列表** - 本地保存常用账号，支持搜索 / 导入 / 导出
- ⚡ **快捷操作** - DNS 缓存清除、jQuery 注入、打开下载目录、工具库直达

### 页面增强（Content Scripts）
- 🌈 **JSON 高亮** - 打开 JSON/JSONP/NDJSON 页面自动格式化 + CodeMirror 高亮（coy 主题）：折叠、行号、可读时间头部、可点击 URL、悬停复制 Key 路径、智能值预览（时间/颜色/图片）、raw 切换、Ctrl-F 搜索、400KB 超大保护。详见 [docs/JSON_VIEWER.md](./docs/JSON_VIEWER.md)
- 🔐 **Auto-Login 悬浮球** - 页面悬浮球一键填充已保存的账号密码（凭证在设置页管理）
- 📋 **双击复制** - 页面任意文本双击即可复制（可在设置中开关）
- 👁 **密码显示** - 密码框旁显示明文切换（可在设置中开关）

### 网络能力（Background）
- 🔧 **HTTP 头规则** - 按 URL 匹配设置/删除请求头与响应头（如防盗链 Referer、CORS），基于 declarativeNetRequest，规则增删改后自动保存并即时生效
- 🌐 **代理管理** - 多代理配置 + 自动切换规则
- 🗺 **SourceMap 注入** - 为指定域名的资源注入 SourceMap 响应头，便于调试线上压缩代码
- 🧪 **API Mock** - DevTools 面板内拦截并 Mock 接口响应
- 🍪 **Cookie 管理** - 右键菜单快速获取/恢复 SESSIONID

## 🚀 快速开始

```bash
npm install        # 安装依赖
npm run dev        # 开发模式
npm run build      # 生产构建（产物在 build/）
```

加载到 Chrome：打开 `chrome://extensions` → 开启「开发者模式」→「加载已解压的扩展程序」→ 选择 `build/` 目录。

> JSON 高亮本地 .json 文件需在扩展详情中开启「允许访问文件网址」。

### 质量保障

```bash
npm run lint       # ESLint（0 error 基线）
npm test           # 单元测试 + E2E 冒烟测试
npm run test:e2e   # 仅 E2E：无头 Chrome 真实加载扩展，覆盖渲染/迁移/DNR 规则
```

## 📁 目录结构

```
├── src/
│   ├── popup.js / .html / .css        # 弹窗入口（React，经 rsbuild 打包）
│   ├── options.js / .html / .css      # 设置页入口（React）
│   ├── sidepanel.js / .html / .css    # 侧边栏入口（React）
│   ├── options/                       # 设置页功能域组件
│   │   ├── http-rules.js              #   HTTP 头规则（列表 + 表单）
│   │   ├── proxy.js                   #   代理管理
│   │   ├── sourcemap.js               #   SourceMap 注入
│   │   ├── auto-login.js              #   Auto-Login 凭证管理
│   │   └── common.js                  #   通用小组件（OptionItem 等）
│   ├── sidepanel/                     # 侧边栏模块
│   │   ├── utils.js                   #   Chrome 操作 + actionMap
│   │   ├── quick-links.js             #   快捷链接组件
│   │   └── use-accounts.js            #   账号列表域 hook
│   ├── shared/                        # 跨世界共享模块（单一来源）
│   │   ├── default-config.js          #   默认扩展配置
│   │   └── http-rules.js              #   规则 key / 默认规则 / 一次性迁移
│   ├── config.js                      # 静态配置（作者、快捷链接等）
│   └── extension/                     # 扩展经典脚本（manifest + content scripts）
│       ├── manifest.json              #   MV3 清单（单一来源）
│       ├── background.js              #   Service Worker（ESM entry，经打包）
│       ├── http-rules-manager.js      #   HTTP 规则管理器（content script，经打包）
│       ├── inject.js / auto-login.js / json-viewer.js ...   # 其他 content scripts（原样拷贝）
│       ├── api-mock-panel* / sourcemap-panel* / devtools*   # DevTools 面板页
│       └── vendor/codemirror/         #   CodeMirror 5（运行时按需注入）
├── tests/
│   ├── test-json-viewer.mjs           # JSON 解析/格式化单元测试
│   └── e2e-smoke.mjs                  # E2E 冒烟（无头 Chrome 加载 build/）
├── scripts/
│   └── clean-build.mjs                # 构建后清理多余产物
├── docs/                              # 专题文档
├── build/                             # 构建产物（gitignore）
└── rsbuild.config.js                  # 构建配置
```

## 🏗 架构说明

项目内有**三种构建形态**，理解这一点是改代码的前提：

| 形态 | 文件 | 构建方式 | 可否 import 共享模块 |
|---|---|---|---|
| React 页面 | `src/{popup,options,sidepanel}.js` + 各自模块目录 | rsbuild 打包 | ✅ |
| 打包型扩展脚本 | `src/extension/{background,http-rules-manager}.js` | rsbuild 打包为单文件（产物平铺 build/ 根） | ✅ |
| 拷贝型扩展脚本 | `src/extension/` 其余 | 原样 copy 到 build/ | ❌（经典脚本写法，无 import/export） |

> 注：拷贝型不足技术限制——任何脚本需要引用共享模块时，在 `rsbuild.config.js` 注册为 entry 即可转为打包型（background 与 http-rules-manager 就是这么做的）。打包为单文件也绕开了 MV3 content script 不支持声明式 ESM 的限制。

**共享常量与逻辑**（存储 key、默认配置、迁移逻辑）统一放在 `src/shared/`，由前两种形态 import——避免复制粘贴造成双份维护。

**存储设计**：用户配置存于 `chrome.storage.sync` 的 `extensionConfig`；HTTP 头规则因受 sync 单项 8KB 配额限制，独立存于 `extensionHttpRules` key（旧结构首次读取时自动迁移）。

## ⌨️ 快捷键

打开扩展弹窗：
- Windows/Linux: `Alt + I`
- Mac: `Ctrl + I`

## 🔧 配置

所有用户可配置项集中在设置页（右键扩展图标 → 选项，或侧边栏「打开设置」）：功能开关、API 地址、HTTP 头规则、代理、SourceMap、Auto-Login 凭证等。

静态配置（作者信息、快捷链接等）在 `src/config.js`；默认扩展配置在 `src/shared/default-config.js`。修改后重新构建生效。

## 📦 发布

推送 `v*` 标签或更新 `rsbuild` 分支触发 GitHub Actions（`.github/workflows/release.yml`）：lint → test → build → 打包 `build/` 为 zip 并创建 Release。

## 📝 License

MIT

## 👨‍💻 作者

Hshen - [Blog](http://hackshen.com) - [工具库](https://tools.hackshen.com/)
