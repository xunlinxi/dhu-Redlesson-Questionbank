# 开发与数据说明

## 唯一维护入口

公共前端以 `platforms/web/frontend/` 为准。页面实际使用 `js/app.js`、`js/mobile.js`、`js/modules/parser.js`、`js/modules/storage.js`、`js/modules/practice-session.js` 和 `js/modules/workspace-ui.js`。静态站点保留自己的 `js/storage.js` 等本地存储适配文件。

运行 `python scripts/sync_frontends.py` 将公共文件同步到 Android、Electron 和静态站点。Electron 的 Python 解析器副本也由此脚本同步。`--check` 只检查，不写文件。

Android 的 `frontend/` 是源码，`android/app/src/main/assets/public/` 是 Capacitor 生成资源。通过 `npx cap sync android` 更新生成目录。

## Java 和 Android

使用本机已安装的 Oracle JDK 25.0.4.1，Gradle Wrapper 为 9.2.0。CI 使用 Temurin JDK 25。本机 Android Studio 的 `.gradle/config.properties` 与 `.idea/gradle.xml` 设置为本地 JDK；这两个机器相关配置不提交。

Gradle 从 9.1 起支持 Java 25：[官方兼容表](https://docs.gradle.org/current/userguide/compatibility.html)。Android 编译仍使用 Capacitor 要求的 Java 21 source/target，运行 Gradle 的 JDK 与 Android 字节码目标是两个配置。

构建 APK 还需 Android SDK 36 和相应 Build Tools。配置 `ANDROID_HOME` 或在 `platforms/android/android/local.properties` 设置 `sdk.dir` 后运行 `gradlew.bat assembleDebug`。不会为了切换 Java 自动下载安装 Android SDK。

## 题库与学习数据

- `resources/question-banks/`：用户提供的原始题库文档。
- `platforms/web/data/`：Flask 运行数据，路径可由 Web 配置改变。
- `platforms/android/frontend/data/preset.json`：Android 预置题库。
- `platforms/web/static-site/data/`：静态站点预置数据。
- 浏览器学习记录保存在浏览器存储；Electron 数据由主进程管理。

原始题库和学习数据不作为测试文件清理。更新预置或静态数据是明确的维护操作，导出会覆盖相应的生成 JSON，请在需要更新题库时运行：

```powershell
python platforms/android/scripts/export_preset.py
python platforms/web/scripts/export_static.py
```

## 导入格式

```text
一、单项选择题
1、题目内容（A）
A. 选项一
B. 选项二

二、多项选择题
2、题目内容
A. 选项一
B. 选项二
答案：AB

三、判断题
3、判断内容（对）
```

支持 UTF-8、GBK/GB18030 和带 BOM 的 UTF-16 TXT；DOCX 包含正文和表格。离线端不支持旧版 DOC，请另存为 DOCX 或 TXT。缺少有效答案/选项的题目会提示，不凭空补答案。同名导入会替换对应题库。

## 清理后的校验

本项目不保留测试代码、测试样例和截图调试脚本。保留构建与源码校验：

```powershell
python scripts/sync_frontends.py --check
python -m compileall -q platforms/web/backend platforms/web/main.py
node --check platforms/web/frontend/js/app.js
node --check platforms/web/frontend/js/mobile.js
```

`.github/workflows/validate.yml` 执行同步和语法检查；Android、Windows 与静态站点继续使用各自构建/部署工作流。

## 资源许可

公共前端的 `vendor/fontawesome/LICENSE.txt` 和项目根 `LICENSE` 必须保留。`img/illustrations/` 是当前插图，`img/deco/` 中仍被 CSS 引用的文件不得直接删除。Python 嵌入式环境下载和依赖安装脚本位于 `platforms/electron/scripts/`。


## 本机检查结果（2026-09-22）

`gradlew.bat --version` 确认为 Oracle JDK 25.0.4.1 / Gradle 9.2.0；`gradlew.bat help --offline --no-daemon` 工程配置通过。`assembleDebug` 停在 `SDK location not found`，需先配置本机 Android SDK 路径。由于当前项目路径包含中文，`gradle.properties` 已按 AGP 提示设置 `android.overridePathCheck=true`。

Windows 局域网端口配置工具统一在 `platforms/web/scripts/setup_firewall.bat`；只有需要局域网访问时再手动以管理员身份运行，本轮未执行任何防火墙更改。


## 答题工作区

进入练习后，主答题界面固定覆盖当前浏览器可视区域，不触发浏览器的系统全屏模式。页面与题目内容都不滚动；根据实际文字换行和可用空间，先压缩留白与间距，再寻找能完整显示内容的最大字号。选项按内容所需高度和剩余空间分配高度，上一题、提交/下一题共享稳定的底部位置。极长题目在很窄、很矮的窗口下会使用更小的字号，以遵守一屏完整显示要求。

`practice-session.js` 管理可视区布局、所有模式离页/后台暂停、继续练习及独立本机草稿；`workspace-ui.js` 管理动态题量、搜索分页和弹窗焦点。草稿键按 Web/静态/Android/Electron 存储模式隔离，保存题目 ID、乱序映射、未提交选择和剩余时间；恢复前校验题目仍然存在。手动存档继续走原有 API/IPC，支持可选的 `settings`、`timer_enabled` 字段。

题库及错题详情每页显示 50 题，支持题干和选项搜索。手机答题卡通过工具栏弹层打开；导航默认停靠工具栏，主动拖动后保留用户位置，并避开底部操作条。答题卡等临时弹窗可以单独滚动，不影响无滚动的主答题界面。

页尾复用本地 `img/deco/deco_fence.svg` 横向平铺，桌面 85px、手机 48px。进入答题模式隐藏页尾，结束或离页后恢复。
