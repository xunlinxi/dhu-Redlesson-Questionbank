# 炸红题库

政治理论课程题库练习工具，支持 TXT / DOCX / DOC 导入、随机与顺序练习、模拟考试、错题本和进度保存。

## 目录

```text
resources/question-banks/     原始题库文件
platforms/web/               Flask 服务及公共前端源码
  backend/                   API、解析器与数据模型
  frontend/                  公共页面、脚本、样式和资源
  scripts/export_static.py   导出静态站点题库
  static-site/               GitHub Pages 站点及其存储适配层
  data/                      Web 运行数据（保留）
platforms/android/           Capacitor 项目、同步后的前端、预置题库导出脚本
platforms/electron/          Electron 主进程、IPC、Python 桥接及 Windows 打包脚本
scripts/sync_frontends.py    四端公共源码同步
.github/workflows/           源码校验与各平台构建、部署
```

## 运行 Web

在项目根目录执行：

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r platforms/web/requirements.txt
.venv\Scripts\python.exe platforms/web/main.py
```

访问 http://127.0.0.1:50000。旧版 `.doc` 解析需要 Windows、Microsoft Word 和 pywin32；其他平台使用 `.docx` 或 `.txt`。

## 多端维护

修改 `platforms/web/frontend/` 后执行：

```powershell
python scripts/sync_frontends.py
python scripts/sync_frontends.py --check
```

Android 再执行：

```powershell
cd platforms/android
npm ci
npx cap sync android
cd android
.\gradlew.bat --version
.\gradlew.bat assembleDebug
```

项目使用 **JDK 25 + Gradle 9.2.0**。本机已验证 JDK 位于 `D:\Software\Java\jdk-25.0.4.1`。终端使用 `JAVA_HOME` 或 PATH 中的 Java；不要把个人绝对路径提交到公共构建配置。Android Java 编译目标保留 21。

Windows 桌面版：

```powershell
cd platforms/electron
npm install
npm run setup-python
npm run build:win
```

[开发与数据说明](docs/development.md) 包含资源来源、导出与运行校验说明。依赖目录、构建产物和运行数据不属于本次源码清理范围。
