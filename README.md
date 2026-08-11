# DHU 红课题库刷题系统

基于 Web 的题库刷题系统，支持多格式题库导入、多种练习模式，可在局域网内多设备访问。
（当前仅测试 2025-2026 第一学期习概/毛概/思修/近代史题库）

## 功能概述

| 模块     | 功能                                        |
| -------- | ------------------------------------------- |
| 题库管理 | 导入(.doc/.docx/.txt)、编辑、删除、章节分类 |
| 练习模式 | 随机抽题、模拟考试、顺序做题、错题练习      |
| 练习配置 | 题库/章节筛选、题目数量、选项打乱、限时     |
| 数据管理 | 进度保存、错题本、成绩排行榜                |
| 多端访问 | 响应式设计、局域网/热点访问、远程模式       |

## 系统架构

```mermaid
flowchart LR
    A[客户端] -->|HTTP| B[Frontend<br/>HTML/CSS/JS]
    B -->|REST API| C[Backend<br/>Flask]
    C --> D[(Data<br/>JSON)]
```


## 快速开始

```bash
# 安装依赖
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# 启动服务
python main.py
````

浏览器自动打开 http://localhost:50000

## 多设备访问

| 访问方式 | 地址                       | 配置                             |
| -------- | -------------------------- | -------------------------------- |
| 本机     | http://127.0.0.1:50000     | 无需配置                         |
| 局域网   | http://192.168.x.x:50000   | 运行 `setup_firewall.bat`        |
| 热点     | http://192.168.137.1:50000 | 运行 `防火墙开关.bat` 关闭防火墙 |

## 题库格式

```
一、单项选择题
1、题目内容（A）
A. 选项A
B. 选项B

二、多项选择题
1、题目内容（ABC）
A. 选项A
B. 选项B
```

## 技术栈

- 后端：Python Flask
- 前端：HTML5 + CSS3 + JavaScript
- 文档解析：python-docx, pywin32
- 数据存储：JSON

## 注意事项

1. 推荐使用 TXT 格式导入题库
2. .doc 文件解析需要安装 Microsoft Word（仅 Windows）
3. 热点访问需临时关闭防火墙，使用后请重新开启

## 最近更新

### v0.7.4 — Web / Android / Electron 多端 bug 修复（2026-08-11）

**Web 端（Flask）**

- 修复模拟考试倒计时结束时未判分、全部按未作答处理的问题
- 修复服务器重连后练习会话被重置的问题；重连现在仅刷新侧栏数据并恢复已暂停的计时器
- 错题本支持判断题练习（筛选、校验、数量显示、"再来一次"恢复）
- 修复远程模式排行榜字段映射错位（`player_name`/`bank_name`/`score` → `name`/`accuracy`/`time_display`）
- 题库名/错题列表/题目详情渲染增加 HTML 转义（`escapeAttr`），防止单引号破坏内联 onclick 及 XSS
- `get_banks` 接口返回学期（`semester`）字段
- 修复 `calculateExamResults` 原地排序污染用户答案数组的问题
- 修复移动端未选题库时 `.where('bank').equals('')` 返回空结果的筛选 bug

**Android（Capacitor）**

- 同步上述 Web 端修复：考试判分、重连接管、排行榜字段、HTML 转义、排序污染、空题库筛选
- 错题本统计与 `getPracticeWrong` 增加判断题计数与筛选

**Electron（桌面端）**

- 同步上述 Web 端修复
- 后端 IPC `practice-random` / `practice-wrong` 增加判断题抽取，修复未按题型数量筛选及原地混洗问题
- `get-wrongbook-stats` 增加判断题统计
- 前端 `startPractice`（随机模式）补充 `judge_count` 参数

## 许可证

MIT License
