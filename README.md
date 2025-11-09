# Qrcode

Chrome 浏览器扩展 - 二维码生成 & 开发工具集

## ✨ 功能特性

### 默认生成当前Url二维码，也可以自定义字符生成二维码，下面是每日一句的毒鸡汤，点击文字可刷新

![test](./src/describe.jpg)

### 核心功能
- 🔲 **二维码生成** - 一键生成当前页面或自定义文本的二维码
- 🎣 **每日毒鸡汤** - 点击刷新，来自 api.hackshen.com
- 🔧 **开发工具集** - DNS缓存清除、jQuery注入、文件下载
- 🔐 **Cookie 管理** - 右键菜单快速获取/设置 SESSIONID
- 📋 **双击复制** - 页面任意文本双击即可复制

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 生产构建
```bash
npm run build
```

构建产物在 `build/` 目录，可直接加载到 Chrome 扩展程序。

## 📦 技术栈

- **React 18** - UI 框架
- **Ant Design 5** - 组件库
- **Rsbuild** - 构建工具
- **Manifest V3** - Chrome 扩展最新标准

## 🎯 最近更新

**v1.0.0 (2025-11-09) - 重大升级**

- ✅ 升级到 Manifest V3
- ✅ 移除未使用代码
- ✅ 统一使用 Rsbuild 构建
- ✅ 配置化域名和常量

详见 [UPGRADE_NOTES.md](./UPGRADE_NOTES.md)

## 📖 使用说明

### 快捷键
- Mac: `Command + Shift + S`
- Windows/Linux: `Alt + Shift + S`

### 右键菜单
- **GET SESSIONID** - 获取当前网站的 SESSIONID cookie
- **SET SESSIONID** - 设置之前保存的 SESSIONID

## 🔧 配置

所有配置集中在 `src/config.js`，包括：
- API 地址
- CDN 链接
- 域名规则
- 快捷链接
- 功能开关

修改配置后重新构建即可生效。

## 📝 License

MIT

## 👨‍💻 作者

Hshen - [Blog](http://hackshen.com) - [工具库](https://tools.hackshen.com/)
