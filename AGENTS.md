# AGENTS.md

## 项目

炸红题库：Flask + JSON 后端、HTML/CSS/原生 JavaScript 前端，支持 Android Capacitor、Electron 和静态站点。

## 目录与职责

- `resources/question-banks/`：原始题库，禁止作为测试文件删除。
- `platforms/web/backend/`：Flask API、解析器、数据模型。
- `platforms/web/frontend/`：公共前端唯一维护来源。
- `platforms/web/scripts/`：Web 数据导出维护脚本。
- `platforms/web/static-site/`：静态发布目录，保留本地存储适配器。
- `platforms/android/`：Capacitor 工程、前端副本、预置数据导出脚本。
- `platforms/electron/`：桌面主进程、IPC、Python 桥接和打包。
- `scripts/sync_frontends.py`：跨端同步入口。
- `docs/development.md`：开发、构建和数据说明。

## 运行与构建

```powershell
.venv\Scripts\python.exe -m pip install -r platforms/web/requirements.txt
.venv\Scripts\python.exe platforms/web/main.py
python scripts/sync_frontends.py
python scripts/sync_frontends.py --check
```

Web 默认地址 `http://127.0.0.1:50000`。

Android 使用本机 JDK 25 + Gradle 9.2.0；Java source/target 保留 Capacitor 的 21。不要提交机器专用 JDK 或 SDK 路径。

```powershell
cd platforms/android
npm ci
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

Electron Windows 打包：在 `platforms/electron/` 执行 `npm install`、`npm run setup-python`、`npm run build:win`。

## 修改约束

1. 保留题库、学习记录、环境依赖及与任务无关的修改。
2. 只修改公共前端来源，再通过同步脚本更新其他客户端。
3. Android `frontend/` 为源码；`android/app/src/main/assets/public/` 为生成目录，不手工修改或强制加入 Git。
4. 当前页面加载公共 `app.js`、`mobile.js`，以及 `modules/` 中的 `parser.js`、`storage.js`、`practice-session.js`、`workspace-ui.js`；静态端另有存储适配文件。
5. 清理或移动文件时同步修正引用、构建脚本、工作流和文档。
6. 按用户要求不保留测试代码、测试样例和一次性调试脚本。使用同步检查、语法检查和实际构建作验证。
7. DOCX/TXT 跨平台；旧 DOC 依赖 Windows、Word、pywin32。
8. 保留项目和第三方依赖的许可证。

## 提交前校验

```powershell
python scripts/sync_frontends.py --check
python -m compileall -q platforms/web/backend platforms/web/main.py
node --check platforms/web/frontend/js/app.js
node --check platforms/web/frontend/js/mobile.js
```

涉及 Android 构建时确认 `gradlew.bat --version` 的实际 JVM，并尝试实际构建；缺失 SDK 或下载失败必须如实说明。
