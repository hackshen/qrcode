# JSON 高亮功能集成记录

> 2026-09 集成 · 移植自 [json-viewer](https://github.com/tulios/json-viewer)（MIT, @tulios）
> 源码位置：`/Users/hshen/work/json-viewer`（上游原版，无本地改动）

## 功能概述

浏览任意返回 JSON/JSONP 的接口时，自动格式化并以 CodeMirror（coy 主题）高亮渲染：

- ✅ 语法高亮（coy 主题）
- ✅ 节点折叠 / 展开全部（工具条按钮 + fold gutter）
- ✅ 行号
- ✅ 时间头部（`// YYYY-MM-DD HH:mm:ss` + 请求 URL，前 3 行；按需求从紧凑时间戳改为可读时间）
- ✅ 可点击 URL（字符串中的链接下划线可点，新窗口打开）
- ✅ 一键复制格式化 JSON（工具条新增复制按钮，成功显示 ✓）
- ✅ raw / 高亮 一键切换
- ✅ Ctrl-F / Cmd-F 搜索（CodeMirror 搜索，Enter 下一个）
- ✅ 超大 JSON 保护（>400KB 不自动渲染，弹提示可「Highlight anyway!」强制）
- ✅ 解析失败页面提示条（正则通过但 JSON.parse 失败时，红色横幅显示原因并展示原文）
- ✅ `window.json` 暴露（控制台直接查看解析结果）
- ✅ 大数精度保护（超过 `Number.MAX_VALUE` 的数字不丢精度）
- ✅ JSONP / `text/html` 响应容错（`while(1);` 前缀剥离、文本节点转 pre）
- ✅ 本地文件支持（manifest 匹配 `<all_urls>`，需在扩展详情开启「允许访问文件网址」；注意 `file://*/*` 是无效写法，file 协议 host 为空，须 `<all_urls>` 或 `file:///*`）
- ✅ 总开关：设置页 → 功能开关 → JSON 高亮（`features.jsonViewer`，默认开，改动需刷新页面）

## 设计决策（讨论共识）

| 决策点 | 结论 | 备注 |
|---|---|---|
| 移植范围 | 仅核心渲染链路（~1.1k 行），不搬 omnibox/scratch pad/options 页/主题系统 | |
| 主题 | coy（深色模式与页面主题切换做过后按用户要求移除） | |
| 开关粒度 | 硬编码全开 + 一个总开关 | 不做子项开关 |
| CodeMirror 引入 | vendor 预构建 UMD + **懒加载** | 非常关键，见下文 |
| 附带功能 | raw 切换/展开全部/可点击 URL/行号/搜索 全保留 | |
| 头部时间 | 可读格式 `YYYY-MM-DD HH:mm:ss`（原版为紧凑时间戳） | 用户指定 |
| 与原版扩展冲突 | 不做共存检测，需手动禁用原版 JSON Viewer | |

### 二轮补强（用户确认方案）

- ✅ 复制按钮：Clipboard API + execCommand 降级，复制格式化文本（不含头部），成功后 ✓ 反馈 1s
- ✅ 解析失败提示条：正则通过但 `JSON.parse` 失败时红色横幅 + 原文
- ✅ 本地文件：manifest 改用 `<all_urls>` 覆盖 file://（`file://*/*` 无效，file 协议无 host）
- ❌ Key 路径复制（缓做）、开关实时生效（不做）、仓库旧债清理（另开 session）
- ➖ 深色模式与页面主题切换：已实现后按用户要求移除

### 关键技术点：为什么 CodeMirror 要懒加载 + 走 background

1. **体积**：CM 核心 + 模式 + addon 约 528KB，若放 manifest `content_scripts` 会对**所有页面**常驻注入（原版 json-viewer 就是这么干的）。
2. **隔离世界**：content script 里用 `<script src>` DOM 注入 CM 会跑在**页面世界**，content script 自己拿不到 `window.CodeMirror`（MV3 隔离世界限制）。
3. **CSP**：页面 CSP 会拦截 DOM 注入的脚本标签。
4. **方案**：检测到 JSON 后，content script 发消息 `jsonViewerLoadAssets` → background 用 `chrome.scripting.executeScript` 按依赖序注入（**ISOLATED world 与 content script 同世界**，不受页面 CSP 影响），`insertCSS` 注入样式。无需 `web_accessible_resources`。

### 启动时序

```
document_start: 发起 chrome.storage.sync 配置读取（异步，不等 DOM）
       +
DOMContentLoaded: DOM 就绪
       ↓ 两者都完成
features.jsonViewer === false ? 退出
       ↓
checkIfJson（正则检测 PRE/文本节点，JSONP 剥离后复检）
       ↓ 是 JSON
pre.hidden = true（防闪烁）
       ↓
超过 400KB ? 显示原文 + 警告条（可强制高亮）
       ↓
sendMessage → background executeScript/insertCSS（CM + coy.css + json-viewer.css）
       ↓
contentExtractor（大数 wrapNumbers 保精度）→ prependHeader → CodeMirror 渲染 → 工具条
```

## 文件清单

### 新增

| 文件 | 说明 |
|---|---|
| `src/dist/json-viewer.js` | 核心：检测/提取/格式化/渲染/工具条/启动流程（经典脚本 IIFE，无构建依赖） |
| `src/dist/json-viewer.css` | 默认主题规则（现仅兜底）+ viewer/editor 自定义样式 + 字体 |
| `src/dist/vendor/codemirror/` | CM 5.65.21：核心、javascript 模式、fold/dialog/search/scroll addon、theme/coy.css，共 15 个文件 |
| `test-json-viewer.mjs` | 冒烟测试（stub DOM/chrome/CM，`node test-json-viewer.mjs`） |

### 修改

| 文件 | 改动 |
|---|---|
| `src/dist/manifest.json` | `content_scripts.js` 追加 `json-viewer.js`（document_start，排在 inject.js、auto-login.js 之后）；matches 增 `file://*/*` |
| `src/dist/background.js` | onMessage 新增 `jsonViewerLoadAssets`：executeScript（10 个 JS 按依赖序）+ insertCSS（7 个 CSS，含双主题） |
| `src/dist/default-config.js` | `features.jsonViewer: true` |
| `src/options.js` | DEFAULT_CONFIG 同步 + 「JSON 高亮」OptionItem 开关（`!== false` 语义，与 autoLogin 一致） |
| `README.md` | 功能清单与更新记录 |

## 如何调整

| 想改什么 | 去哪改 |
|---|---|
| 字体/行距/工具条样式 | `src/dist/json-viewer.css` 末段 |
| 超大上限、折叠、tab 宽度等行为 | `src/dist/json-viewer.js` 顶部 `INTERNAL_OPTIONS` |
| 换主题 | 从 json-viewer 仓库 `extension/themes/` copy 对应 css 到 `vendor/codemirror/theme/`，改 `INTERNAL_OPTIONS.theme`，background.js insertCSS 列表加一行 |
| 开关默认值 | `default-config.js` 与 `options.js` 两处 `DEFAULT_CONFIG.features.jsonViewer` |

改完 `npm run build`，`chrome://extensions` Reload。

## 已知限制

- 开关只在页面加载时读取，切换后需刷新页面（预期行为）
- 与其他 JSON 高亮扩展同时启用会冲突，需禁用原版
- `exposeJson` 通过向页面 `<head>` 注 `<script>` 暴露 `window.json`（与原版一致）
- `file://` 页面需在扩展详情页开启文件访问权限
