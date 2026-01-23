# Android 版本构建指南

本项目使用 [Capacitor](https://capacitorjs.com/) 将前端应用打包为 Android 应用。
Android 版本采用 "无后端 (Backend-less)" 架构，使用 Python 解析逻辑的 JavaScript 移植版 (`parser.js`) 和 IndexedDB (`dexie.js`) 进行本地数据存储。

## 环境要求

- **Node.js**: v16+ (推荐 v18 LTS)
- **Java JDK**: 11 or 17
- **Android Studio**: 最新版本 (包含 Android SDK 和 SDK Tools)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 同步项目

将 Web 资产同步到 Android 项目目录：

```bash
npm run sync
# 或者
npx cap sync android
```

### 3. 这是/运行

#### 使用 Android Studio 运行 (推荐)

此命令会打开 Android Studio，你可以在 IDE 中点击 "Run" (绿色三角形) 按钮部署到模拟器或真机。

```bash
npm run open:android
```

#### 命令行运行

如果已连接设备或启动模拟器：

```bash
npm run android
```

## 功能说明

Android 版本与 PC/Web 版本的主要区别：

1.  **无 Python 依赖**：不运行 Flask 服务器，所有逻辑在手机本地执行。
2.  **文件导入**：
    - 点击 "导入题库" -> 选择文件 (支持 .docx, .txt)。
    - 解析过程完全在 JavaScript 中完成。
3.  **数据存储**：
    - 数据保存在应用私有数据库 (IndexedDB) 中。
    - 卸载应用会清除数据。
4.  **离线运行**：完全不需要网络连接 (除个别 CDN 资源，如 FontAwesome 图标，建议后续本地化)。

## 常见问题

**Q: 只有白屏？**
A: 检查 `capacitor.config.json` 中的 `webDir` 是否指向 `frontend`，并确保运行了 `npm run sync`。

**Q: 无法导入文件？**
A: Android 版本暂不需要额外权限读取选择的文件。如果遇到问题，请检查文件格式是否标准。

**Q: 图标不显示？**
A: 项目目前使用 CDN 加载 FontAwesome。如果没有网络，图标将无法显示。建议在 `frontend/css` 中添加本地 FontAwesome 库。
