# JSON 查看器功能调研

> 2026-09 · 调研各家 JSON 查看器的能力面，为 DevKit Pro 内置 JSON 高亮规划后续功能
> 来源均为一手材料（各项目 README / 官方文档），抓取自 GitHub API 与官方文档站

## 调研对象

| 项目 | 定位 | 星标 |
|---|---|---|
| [tulios/json-viewer](https://github.com/tulios/json-viewer) | Chrome 扩展（我们的移植底座） | 3.4k★ |
| [triggerdotdev/jsonhero-web](https://github.com/triggerdotdev/jsonhero-web) | JSON 探索器（网页/VS Code） | 10.9k★ |
| [AykutSarac/jsoncrack.com](https://github.com/AykutSarac/jsoncrack.com) | 可视化 JSON 编辑器 | — |
| [wesbos/JSON-Alexander](https://github.com/wesbos/JSON-Alexander) | Chrome/Firefox 扩展 | 995★ |
| Firefox 内置 JSON 查看器 | [官方文档](https://firefox-source-docs.mozilla.org/devtools-user/json_viewer/index.html) | — |

## 各家功能清单（原文摘录）

### tulios/json-viewer（已移植部分标 ✅）
- ✅ 语法高亮、27 套主题、可折叠节点、行号、raw/高亮切换、可点击 URL
- ✅ 时间戳头部（我们改为可读时间）、超大 JSON 上限 + Highlight anyway
- ✅ window.json 暴露、大数精度保护、JSONP 容错
- ❌ 未搬：omnibox 热词、scratch pad（CodeMirror 编辑器）、按 key 排序（`sortKeys`）、C 风格括号、编辑模式（readOnly 可关）

### JSON Hero（10.9k★，体验标杆）
- **三种视图**：Column View（仿 macOS Finder 列视图）/ Tree View / Editor View
- **内容预览（Content Previews）**：自动推断字符串类型并给预览——日期时间（人性化显示）、图片 URL（缩略图）、网站 URL、推文 URL、JSON URL、颜色（色块）
- **JSON Schema 推断**：从数据反推 schema 并可用于校验
- **Related Values**：查看某字段在整个文档中的所有取值（含 null/undefined），快速发现边界情况
- **模糊搜索**：key、路径、值、甚至格式化后的值（搜 "Dec" 能命中 12 月的日期字符串）
- 全键盘操作、可分享 URL（带路径）

### JSON Crack（可视化路线）
- JSON/YAML/CSV/XML 互转
- 代码生成：TypeScript 接口、Go struct、Kotlin data class、Rust serde、JSON Schema
- jq 与 JSONPath 查询、图/树可视化、导出 PNG/JPEG/SVG
- 全本地处理

### JSON Alexander（Chrome 扩展，与我们最可比）
- **Level buttons（1, 2, 3… All）**：一键折叠到指定层级
- **悬停显示 JSON path，点击固定（pin）再复制**（我们已实现悬停+点击复制）
- 三视图切换：Tree / Formatted / Raw
- 缩进参考线 + 悬停高亮
- Light / Dark / Auto 主题、window.data 控制台暴露

### Firefox 内置查看器
- **JSON Lines / NDJSON 支持**：.jsonl 文件与应用 ndjson 的响应按"每行一个 JSON 值"渲染，每行独立折叠；无效行内联显示错误不影响其余行
- **过滤搜索框**：输入即过滤 JSON（隐藏不匹配项）
- **请求/响应头显示**：来自网络请求时展示 HTTP 头
- **控制台 API**：`$json.data` / `$json.text` / `$json.headers`
- raw 视图 + pretty-print 切换

## 对我们的启发（按适配 CM 架构的可行性排序）

| 功能 | 来源 | 成本 | 价值 | 建议 |
|---|---|---|---|---|
| 折叠到第 N 层（1/2/3/All 按钮） | JSON Alexander | 低-中 | 高 | ✅ 优先 |
| 智能值预览（日期人性化/颜色色块/图片缩略图，挂在我们现有悬停气泡上） | JSON Hero | 低-中 | 高 | ✅ 优先 |
| NDJSON/JSONL 支持（日志文件场景刚需） | Firefox | 中 | 高 | ✅ 优先 |
| 过滤搜索框（与现有 Ctrl-F 互补：隐藏不匹配行） | Firefox / JSON Hero | 中 | 中 | 缓 |
| 请求/响应头显示（需走 devtools 面板，content script 拿不到主文档响应头） | Firefox | 中-高 | 中 | 缓 |
| 按 key 排序 | tulios（代码已随移植进来） | 低 | 低-中 | 可选 |
| Related Values | JSON Hero | 高 | 中 | 不做 |
| 树/列视图、图可视化 | JSON Hero / Crack | 很高 | — | 不做（与 CM 渲染路线冲突） |
| 代码生成 / 格式转换 / jq | JSON Crack | 高 | 低-中 | 不做 |

## 结论

下一批候选锁定三个：**层级折叠按钮**、**智能值预览**（时间/颜色/图片，挂现有路径气泡）、**NDJSON 支持**。

（2026-09-12 已全部采纳落地，见 [JSON_VIEWER.md](./JSON_VIEWER.md)）
