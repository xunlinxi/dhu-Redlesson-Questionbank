# 下半页设计与手机导航优化（2026-09-21）

## 参考范围

本轮实际滚动检查了 https://www.cho-kaguyahime.com/ 从首页到页尾的约 11,000 像素页面，截图包含白底几何纹理的内容区、深色 INTRODUCTION/STORY、圆形 MUSIC 卡片、STAFF/CAST 与页尾。参考截图位于本机忽略目录 `test-environment/artifacts/reference-depth-*.jpg`。

采用的是深浅分区节奏、淡几何底纹、大分区标题、细线括角、圆形插图与卡片构图。没有复制人物图、视频或品牌资源，新增插图为原创 SVG；不加入自动轮播和循环闪动。

## 界面改动

- 首页：深色引导区 → 浅色功能特色 → 深色学习提示 → 浅色学习概览 → 深色页尾。
- 功能特色：三张带独立插图、标签、说明与可点击入口的卡片。手机使用图文并排的紧凑布局，极窄屏改为上下排列。
- 学习概览：统一统计条、章节列表、题量标记与错题信息。
- 导入：上传表单与格式参考并列，手机顺序排列；改善输入框宽度、说明字号、禁用与成功/失败状态。
- 题库/错题：条目序号、细色边、元信息、题量标签、筛选栏与查看/删除按钮统一。
- 刷题：浅色题干与选项、明确的选中/正确/错误状态、统一侧栏和答题卡；保留专注阅读的字号和行距。
- 结果与弹窗：指标卡、左对齐答案详情、状态色和输入边框同步调整。交卷回到结果页顶部，设置页恢复自己的标题。
- 导航配色随深浅分区切换；保留减少动画偏好与键盘焦点。

新增样式位于 `platforms/web/frontend/css/editorial.css`，由 `scripts/sync_frontends.py` 分发。`img/illustrations` 的三张功能插图和几何纹理也同步到四端。

## 手机导航

- 同一悬浮按钮支持真实触摸与鼠标拖动，可放在屏幕任意可见位置；不强制吸附到边缘。
- 使用 Pointer Events 与 Pointer Capture；6 像素移动阈值区分轻点和拖动。
- 对触摸轻点在 pointerup 确认一次，并抑制可能的兼容 click，解决拖动后浏览器未生成 click 时点不开菜单的问题。
- 菜单展开后靠近按钮定位，按钮和菜单都限制在可见视口内。
- 位置保存在本地，刷新后恢复；屏幕尺寸或 visualViewport 变化时重新限制边界。
- 菜单内可重置位置；点击页面链接会关闭菜单；支持键盘 Enter 和 Escape。
- 移除旧 `.mobile-open` 与 `.is-open` 并存的逻辑，统一 `aria-expanded` 状态。

## 验证记录

- 10 项前端测试、16 项 Python 测试通过。
- `scripts/test-mobile-menu.cjs` 在静态页面和 Flask Web 入口通过：触摸/鼠标拖动、无拖动误开、拖后点击、刷新恢复、屏幕边界、缩小视口、菜单边界、切页关闭、重置位置、键盘开关。
- `scripts/verify-ui-pages.cjs` 在 1440 × 1000 和 390 × 844 下各检查 12 个页面/状态，无横向溢出和脚本异常。包含功能特色、概览、导入、题库、空/非空错题、刷题设置、题目、反馈、结果和编辑弹窗。
- Web / 静态 / Android IndexedDB 环境模拟的导入替换、考试、存档、结算和错题流程通过。
- 静态和 Android 模拟环境完全禁用外部网络时，DOCX 表格导入与减少动画布局通过。
- 以 `sync_frontends.py --check` 核对四端源码一致，再执行 Capacitor sync。

测试用 `scripts/test_server.py`，Flask 数据写入系统临时目录；浏览器使用独立临时上下文。本轮没有修改实际学习记录，也没有提交 Git commit、推送或发布站点。原生 Android/iOS 真机触摸和 Electron 安装包不在本轮已验证范围。

预览截图位于 `test-environment/artifacts/ui-*-desktop.jpg` 与 `ui-*-mobile.jpg`。运行方法沿用 [前轮记录](2026-09-16-improvements.md)；导航测试可以显式指定入口：

```powershell
node scripts/test-mobile-menu.cjs http://127.0.0.1:50123/
node scripts/test-mobile-menu.cjs http://127.0.0.1:50123/static-test/index.html
node scripts/verify-ui-pages.cjs
```
