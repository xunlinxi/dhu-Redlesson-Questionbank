# DHU红课题库刷题系统

基于 Web 的题库刷题系统，支持多格式题库导入和多种练习模式。（目前仅测试2025-2026第一学期习概/毛概/思修/近代史题库）

## 功能概述

### 题库管理
- 支持 .doc、.docx、.txt 格式文档导入
- 智能识别单选题和多选题，支持 A-Z 选项
- 在线编辑题目和选项
- 按题库和章节分类管理

### 练习模式
- **随机练习**：随机抽题，即时显示答案
- **模拟考试**：提交后统一批改
- **顺序做题**：按原始顺序学习
- **背题模式**：先显示答案，强化记忆
- **错题练习**：针对错题专项训练

### 辅助功能
- 进度保存与加载
- 选项顺序打乱
- 错题自动收集
- 答题统计分析

## 快速开始

### 环境要求

- Python 3.8+
- pip

### 安装步骤

```bash
# 克隆项目
git clone https://github.com/xunlinxi/dhu-Redlesson-Questionbank.git
cd dhu-Redlesson-Questionbank

# 创建虚拟环境
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/macOS

# 安装依赖
pip install -r requirements.txt

# 启动服务
cd backend
python app.py
```

浏览器访问 http://localhost:5000

## 题库格式

支持以下格式：

```
一、单项选择题

1、题目内容（A）
A. 选项A
B. 选项B
C. 选项C
D. 选项D

二、多项选择题

1、题目内容（ABC）
A. 选项A
B. 选项B
C. 选项C
D. 选项D
```

答案格式支持：
- 括号格式：`（A）`、`(ABC)`
- 独立答案行：`答案：A`

## 项目结构

```
├── backend/
│   ├── app.py          # Flask 主程序
│   └── parser.py       # 题目解析器
├── frontend/
│   ├── index.html      # 主页面
│   ├── css/            # 样式文件
│   └── js/             # 前端逻辑
├── data/
│   └── questions.json  # 题库数据
├── requirements.txt
└── README.md
```

## 技术栈

- 后端：Python Flask
- 前端：HTML5 + CSS3 + JavaScript
- 文档解析：python-docx, pywin32
- 数据存储：JSON

## 注意事项

1. 推荐使用 TXT 格式导入，可避免格式转换问题
2. .doc 文件解析需要安装 Microsoft Word（仅 Windows）
3. 题库文件不会上传至 GitHub

## 许可证

MIT License
