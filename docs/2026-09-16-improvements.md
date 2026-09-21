# 多端优化记录（2026-09-16）

## 当前架构和修改边界

项目运行在 Flask Web、Capacitor Android、Electron 和 GitHub Pages 静态站点。实际页面使用 `js/app.js`、`js/modules/parser.js` 和 `js/modules/storage.js`，其余旧拆分模块并非当前页面入口。

`platforms/web/frontend/` 是公共前端来源。`scripts/sync_frontends.py` 同步 HTML、样式、实际运行脚本、浏览器依赖、图标和插图；静态站点保留自己的存储适配器和数据模块。Electron 的 `backend_parser.py` 从 Web Python 解析器同步。`--check` 只读比较，并已接入现有 CI。

本轮“多端同步”是功能修复与界面源码一致，保留各端原来的数据存储方式；没有新增账号或云端学习数据同步。原有题库、预置数据、用户错题和学习记录未迁移或批量改写。

## 刷题和数据操作

- 选项打乱按原选项标识映射，重复的选项文字不再混淆答案；判断题不参与选项打乱。
- 考试取消最后一个选项会清空保存的答案；重复提交不会重复计分；手动交卷和计时结束统一经过一次结算。
- 答题卡单独显示判断题；Android 随机练习包含判断题。
- 修复 IndexedDB 保存进度缺失主键，兼容旧数字 ID。读档发现题目缺失时保留原存档并提示重新开始，防止答案索引错位。
- 修复 Electron 错题、排名、读档接口名称不匹配；题目编辑、删除通过公共存储层调用。
- 静态站点支持真实本地导入、编辑和删除，避免虚假成功；存储失败时保留原题库内存状态。
- 初次打开 Web 首页即加载题库统计；题库文本在展示时转义。

## 导入

支持 TXT 的 UTF-8/BOM、GB18030/GBK 和带 BOM 的 UTF-16，支持全角字母、独立答案、分隔多选答案、判断题、多行选项以及仓库已有特殊格式。

DOCX 读取正文和表格。Web 不再先做会漏掉表格的 Word 转 TXT。浏览器端使用本地 Mammoth。旧版 DOC 仍需要 Windows、Word 和 pywin32；离线浏览器会明确提示另存为 DOCX/TXT。没有凭空补全缺失答案。

导入使用独立临时目录并在异常时清理。无有效题目时不覆盖旧题库；部分无法判分的题目会跳过并在结果中列出。Android 同名导入采用事务替换，与 Web/Electron 一致。Python 题目 ID 加入题库名称摘要，避免不同自定义题库 ID 冲突。

20 MB 限制适用于 Web 上传和浏览器本地导入。浏览器导入期间阻止重复提交，成功提示不会马上被清空。

随仓四份题库在两种解析器中的有效题数一致：毛概 345、纲要 550、习概 367、思修 278。习概原文件有一题缺少答案，会产生明确诊断。此检查不修改原始题库文件。

## UI

参考 https://www.cho-kaguyahime.com/ 的深蓝、青色、珊瑚色和圆形舞台构图，使用本项目原创的月面书页 SVG；未复制其人物图、视频或商标。

使用系统中文字体栈，统一标题、说明、题干和选项层级。移除外部 Google Fonts、Swiper 引用；Font Awesome 6.4 图标及许可证随站点分发。首页装饰保持简洁；刷题区以可读性为先。

取消首页自动轮播、粒子、鼠标追光和循环闪动。仅保留短暂入场、页面淡入和按钮悬停，尊重 `prefers-reduced-motion`。允许移动端缩放，提供键盘可操作导航与焦点提示。

## 验证

- Python：`python -m pytest platforms/web/tests -q`，16 项。
- JavaScript：`node --test scripts/test-frontend.cjs`，10 项。
- 同步一致性：`python scripts/sync_frontends.py --check`。
- 浏览器：本机 Edge，Web/静态/Android 环境模拟，各自执行导入、同名替换、真实选项点击、清空多选、存档读档、一次结算和错题查询。
- 断网验证：静态和 Android 环境模拟禁用一切外部网络，DOCX 表格导入成功，手机无横向溢出。
- Android：已执行 Capacitor sync。发现 26 个 public 生成文件被错误跟踪，已取消 Git 跟踪但保留磁盘文件，后续由 sync 生成。

可复现浏览器验证：先运行 `python scripts/test_server.py`。它只监听 `127.0.0.1:50123`，Flask 数据写入系统临时目录，并生成浏览器 DOCX 测试文件。另一个终端设置 `CODEX_NODE_MODULES` 为包含 Playwright 的 node_modules 路径，运行：

```bash
node scripts/test-cross-platform.cjs
node scripts/test-offline-docx.cjs
node scripts/verify_browser.cjs
```

浏览器使用临时上下文，每轮使用唯一题库名。测试截图放在被忽略的 `test-environment/artifacts/`。原生 APK/安装包未构建，未做 Android 真机和 Electron 原生窗口交互测试；桌面端验证覆盖前端共用代码、Python 解析器同步及真实 preload 接口契约。DOC 的 Word COM 实际转换未在本轮测试。

一次性修改脚本和参考截图因自动审批拒绝清理而保留；它们不是维护入口。请使用上面的同步和测试命令，不要重复运行 `repair_*`、`polish.py`、`redesign_ui.py` 或 `fix_adapters.py`。
