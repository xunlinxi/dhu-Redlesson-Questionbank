# Electron 改造实施计划

> **文档版本**: 1.0.0  
> **创建日期**: 2026-01-22  
> **状态**: 待实施

---

## 📋 目录

1. [项目概述](#项目概述)
2. [架构设计](#架构设计)
3. [API → IPC 映射](#api--ipc-映射)
4. [阶段实施计划](#阶段实施计划)
5. [开发顺序与时间估算](#开发顺序与时间估算)
6. [交付成果](#交付成果)
7. [附录](#附录)

---

## 项目概述

### 改造目标

将现有的 Web 版题库刷题系统改造为 **离线跨平台桌面应用**：

- ✅ **Windows 桌面应用** - 使用 Electron + PyInstaller 打包
- ✅ **macOS 桌面应用** - 使用 Electron + Python 运行时
- ✅ **移动端 PWA** - 渐进式 Web 应用，支持离线刷题
- ✅ **完全离线** - 不需要服务器，数据本地存储
- ✅ **数据同步** - 通过文件导入导出实现跨设备数据同步

### 技术选型

| 组件 | 技术栈 | 说明 |
|------|--------|------|
| 桌面框架 | Electron | 跨平台桌面应用框架 |
| 主进程语言 | Node.js | Electron 主进程 |
| 渲染进程 | HTML/CSS/Vanilla JS | 现有前端代码 |
| Word 解析 | Python + python-docx | 保留原有解析逻辑 |
| 数据存储 | JSON 文件 | 本地文件系统 |
| 移动端 | PWA + IndexedDB | 渐进式 Web 应用 |
| 打包工具 | electron-builder | 跨平台打包 |

### 改造方案总结

| 决策项 | 选择 | 说明 |
|--------|------|------|
| 后端架构 | IPC 通信 | 完全移除 Flask，改用 Node.js 文件系统 API |
| Word 解析 | 内嵌 Python | 打包体积较大但功能完整 |
| PWA 数据存储 | IndexedDB + 文件导出 | 默认使用浏览器存储，提供导出功能 |
| 打包工具 | electron-builder | 功能强大，配置灵活 |
| 开发顺序 | 先 Windows 后跨平台 | 聚焦核心功能，逐步扩展 |

---

## 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────┐
│              Electron 主进程 (Node.js)             │
│  ┌──────────────────────────────────────────────┐  │
│  │  1. 窗口管理 (BrowserWindow)               │  │
│  │  2. IPC 通信处理器 (ipcMain)               │  │
│  │  3. Python 子进程管理 (child_process)       │  │
│  │  4. 文件系统操作 (fs, path)                │  │
│  │  5. 对话框 (dialog)                        │  │
│  │  6. 文件关联 (shell)                       │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                    ↕ IPC (preload.js)
┌─────────────────────────────────────────────────────┐
│          渲染进程 (Chromium)                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  1. preload.js (IPC 桥接)                 │  │
│  │  2. 现有前端 HTML/CSS/JS                 │  │
│  │  3. API 调用改为 IPC 调用                 │  │
│  │  4. PWA Service Worker                   │  │
│  │  5. IndexedDB 数据持久化                 │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                    ↕ Python 子进程
┌─────────────────────────────────────────────────────┐
│        Python 子进程 (仅用于 Word 解析)           │
│  ┌──────────────────────────────────────────────┐  │
│  │  1. parser.py (Word 文档解析)             │  │
│  │  2. utils.py (工具函数)                    │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘

数据存储：
├── userData/data/           # 应用数据目录
│   ├── questions.json       # 题库数据
│   ├── wrongbook.json       # 错题本
│   ├── rankings.json        # 排行榜
│   ├── progress.json        # 进度
│   └── config.json         # 配置
└── uploads/                # 临时上传目录
```

### 目录结构

```
dhu-Redlesson-Questionbank/
├── electron/                  # Electron 主程序
│   ├── main.js               # 主进程入口 (Node.js)
│   ├── preload.js            # IPC 预加载脚本
│   ├── python_parser.py      # Python Word 解析器
│   ├── package.json         # Electron 依赖配置
│   ├── models/              # Node.js 数据模型
│   │   └── index.js         # 所有数据模型
│   ├── build/                # 打包配置
│   │   ├── builder-win.yaml # Windows 打包配置
│   │   └── builder-mac.yaml # macOS 打包配置
│   └── assets/              # 资源文件
│       ├── icon.ico         # Windows 图标 (256x256)
│       ├── icon.icns        # macOS 图标 (512x512)
│       ├── entitlements.mac.plist # macOS 权限配置
│       └── icons/           # PWA 图标
│           ├── icon-72x72.png
│           ├── icon-96x96.png
│           ├── icon-128x128.png
│           ├── icon-144x144.png
│           ├── icon-152x152.png
│           ├── icon-192x192.png
│           ├── icon-384x384.png
│           └── icon-512x512.png
├── backend/                  # 保留（用于 Word 解析）
│   ├── parser.py            # Word 文档解析器
│   ├── utils.py             # 工具函数
│   └── requirements.txt     # Python 依赖
├── frontend/                # 前端（小幅改造）
│   ├── index.html           # 主页面（添加 PWA 配置）
│   ├── manifest.json        # PWA 清单文件
│   ├── sw.js               # Service Worker（离线支持）
│   ├── css/
│   │   ├── style.css       # 主样式
│   │   └── mobile.css      # 移动端样式
│   └── js/
│       ├── app.js          # 主逻辑（添加 IPC 调用）
│       ├── mobile.js       # 移动端适配
│       ├── modules/
│       │   ├── banks.js    # 题库管理（改为 IPC）
│       │   ├── practice.js # 练习模式（改为 IPC）
│       │   ├── upload.js   # 文件上传（改为对话框）
│       │   ├── wrongbook.js # 错题本（改为 IPC）
│       │   ├── rankings.js # 排行榜（改为 IPC）
│       │   ├── progress.js # 进度管理（改为 IPC）
│       │   ├── stats.js    # 统计（改为 IPC）
│       │   ├── idb.js      # IndexedDB 封装
│       │   └── data-export.js # 数据导入导出
│       └── modules/
├── data/                    # 应用数据（打包后自动生成）
├── dist/                    # 打包输出目录
├── docs/                    # 文档
│   └── ELECTRON_PLAN.md     # 本文档
├── requirements.txt         # Python 依赖
└── AGENTS.md               # 开发指南（更新）
```

---

## API → IPC 映射

### 映射表

| 原始 API 路径 | IPC 通道名称 | 方法类型 | 参数 | 返回数据 |
|--------------|------------|---------|------|---------|
| GET /api/health | `health-check` | - | - | `{success, status}` |
| GET /api/banks | `get-banks` | query | - | `{success, banks}` |
| POST /api/import | `import-questions` | invoke | `{filePath, bankName}` | `{success, message, question_count}` |
| DELETE /api/banks/<name> | `delete-bank` | invoke | `{bankName}` | `{success, message}` |
| GET /api/questions | `get-questions` | query | `{bank, type, chapter}` | `{success, questions, total}` |
| GET /api/questions/<id> | `get-question` | query | `{questionId}` | `{success, question}` |
| PUT /api/questions/<id> | `update-question` | invoke | `{questionId, data}` | `{success, message}` |
| DELETE /api/questions/<id> | `delete-question` | invoke | `{questionId}` | `{success, message}` |
| GET /api/chapters | `get-chapters` | query | `{bank}` | `{success, chapters}` |
| GET /api/practice/random | `practice-random` | query | `{bank, chapter, single_count, multi_count}` | `{success, questions, total}` |
| GET /api/practice/sequence | `practice-sequence` | query | `{bank, chapter, shuffle}` | `{success, questions, total}` |
| GET /api/practice/wrong | `practice-wrong` | query | `{bank, single_count, multi_count}` | `{success, questions, total}` |
| POST /api/practice/check | `check-answer` | invoke | `{questionId, answer}` | `{success, correct, user_answer, correct_answer}` |
| GET /api/wrongbook | `get-wrongbook` | query | `{bank}` | `{success, wrong_questions, total}` |
| GET /api/wrongbook/stats | `get-wrongbook-stats` | query | - | `{success, stats, total}` |
| POST /api/wrongbook | `add-wrong-question` | invoke | `{questionId, user_answer}` | `{success, message}` |
| DELETE /api/wrongbook/<id> | `remove-wrong-question` | invoke | `{questionId}` | `{success, message}` |
| DELETE /api/wrongbook | `clear-wrongbook` | invoke | - | `{success, message}` |
| GET /api/rankings | `get-rankings` | query | - | `{success, rankings}` |
| POST /api/rankings | `add-ranking` | invoke | `{name, total, correct, wrong, accuracy, time_display}` | `{success, message, record}` |
| DELETE /api/rankings | `clear-rankings` | invoke | - | `{success, message}` |
| GET /api/progress | `get-progress` | query | - | `{success, progress_list}` |
| POST /api/progress | `save-progress` | invoke | `{id, bank, mode, settings, questions, results, current_index, start_time, elapsed_time}` | `{success, message, id}` |
| DELETE /api/progress/<id> | `delete-progress` | invoke | `{id}` | `{success, message}` |
| GET /api/stats | `get-stats` | query | `{bank, chapter}` | `{success, stats}` |
| GET /api/config | `get-config` | query | - | `{success, config}` |
| POST /api/config | `save-config` | invoke | `{config}` | `{success, message}` |
| **特殊功能** | | | | |
| 文件对话框 | `show-open-dialog` | invoke | `{options}` | `{canceled, filePaths}` |
| 文件对话框 | `show-save-dialog` | invoke | `{options}` | `{canceled, filePath}` |
| 外部链接 | `open-external` | invoke | `{url}` | - |
| 解析文档 | `parse-docx` | invoke | `{filePath}` | `{success, questions, bank_name, semester}` |
| 导出数据 | `export-data` | invoke | `{format}` | `{success, filePath}` |
| 导入数据 | `import-data` | invoke | `{filePath}` | `{success, message}` |

### IPC 调用示例

#### 主进程 (main.js)

```javascript
// 示例：获取题库列表
ipcMain.handle('get-banks', async (event) => {
    try {
        const banks = QuestionsModel.getBanks();
        return { success: true, banks };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 示例：导入题库
ipcMain.handle('import-questions', async (event, filePath, bankName) => {
    try {
        const result = await parseWithPython(filePath);
        if (!result.success) {
            return { success: false, error: result.error };
        }

        // 保存到数据文件
        const data = QuestionsModel.load();
        const bankNameToUse = bankName || result.bank_name;

        // 添加题库信息
        data['banks'][bankNameToUse] = {
            "source_file": path.basename(filePath),
            "import_time": new Date().toISOString(),
            "semester": result.semester || ''
        };

        // 移除同名题库的旧题目
        data['questions'] = [q for q in data.get('questions', []) if q.get('bank') !== bankNameToUse];

        // 添加新题目
        data['questions'].extend(result.questions);

        // 保存数据
        QuestionsModel.save(data);

        return {
            success: true,
            message: `成功导入 ${result.questions.length} 道题目到题库 '${bankNameToUse}'`,
            question_count: result.questions.length
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
```

#### 预加载脚本 (preload.js)

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 健康检查
    healthCheck: () => ipcRenderer.invoke('health-check'),

    // 文件操作
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // 题库管理
    getBanks: () => ipcRenderer.invoke('get-banks'),
    deleteBank: (bankName) => ipcRenderer.invoke('delete-bank', bankName),

    // 题目管理
    getQuestions: (filters) => ipcRenderer.invoke('get-questions', filters),
    getQuestion: (questionId) => ipcRenderer.invoke('get-question', questionId),
    updateQuestion: (questionId, data) => ipcRenderer.invoke('update-question', questionId, data),
    deleteQuestion: (questionId) => ipcRenderer.invoke('delete-question', questionId),

    // 章节
    getChapters: (bank) => ipcRenderer.invoke('get-chapters', bank),

    // 练习
    practiceRandom: (filters) => ipcRenderer.invoke('practice-random', filters),
    practiceSequence: (filters) => ipcRenderer.invoke('practice-sequence', filters),
    practiceWrong: (filters) => ipcRenderer.invoke('practice-wrong', filters),
    checkAnswer: (data) => ipcRenderer.invoke('check-answer', data),

    // 错题本
    getWrongbook: (bank) => ipcRenderer.invoke('get-wrongbook', bank),
    getWrongbookStats: () => ipcRenderer.invoke('get-wrongbook-stats'),
    addWrongQuestion: (data) => ipcRenderer.invoke('add-wrong-question', data),
    removeWrongQuestion: (questionId) => ipcRenderer.invoke('remove-wrong-question', questionId),
    clearWrongbook: () => ipcRenderer.invoke('clear-wrongbook'),

    // 排行榜
    getRankings: () => ipcRenderer.invoke('get-rankings'),
    addRanking: (data) => ipcRenderer.invoke('add-ranking', data),
    clearRankings: () => ipcRenderer.invoke('clear-rankings'),

    // 进度
    getProgress: () => ipcRenderer.invoke('get-progress'),
    saveProgress: (data) => ipcRenderer.invoke('save-progress', data),
    deleteProgress: (id) => ipcRenderer.invoke('delete-progress', id),

    // 统计
    getStats: (filters) => ipcRenderer.invoke('get-stats', filters),

    // 配置
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),

    // 导入题库
    importQuestions: (filePath, bankName) => ipcRenderer.invoke('import-questions', filePath, bankName),

    // 导出数据
    exportData: (format) => ipcRenderer.invoke('export-data', format),
    importData: (filePath) => ipcRenderer.invoke('import-data', filePath)
});
```

#### 前端调用示例 (practice.js)

**原代码 (HTTP 调用)**：
```javascript
async function loadPracticeOptions() {
    try {
        const response = await fetch(`${API_BASE}/api/banks`);
        const data = await response.json();

        const select = document.getElementById('practice-bank');
        select.innerHTML = '<option value="">全部题库</option>';

        if (data.success) {
            data.banks.forEach(bank => {
                select.innerHTML += `<option value="${bank.name}">${bank.name} (${bank.question_count}题)</option>`;
            });
        }

        select.onchange = () => {
            loadPracticeChapters();
            updateAvailableStats();
        };

        updateAvailableStats();
    } catch (error) {
        console.error('加载题库选项失败:', error);
    }
}
```

**改造后 (IPC 调用)**：
```javascript
async function loadPracticeOptions() {
    try {
        const data = await window.electronAPI.getBanks();

        const select = document.getElementById('practice-bank');
        select.innerHTML = '<option value="">全部题库</option>';

        if (data.success) {
            data.banks.forEach(bank => {
                select.innerHTML += `<option value="${bank.name}">${bank.name} (${bank.question_count}题)</option>`;
            });
        }

        select.onchange = () => {
            loadPracticeChapters();
            updateAvailableStats();
        };

        updateAvailableStats();
    } catch (error) {
        console.error('加载题库选项失败:', error);
    }
}
```

---

## 阶段实施计划

### 阶段一：Electron 基础架构搭建

**目标**：搭建 Electron 框架，实现前端与主进程通信

**时间**：4-6 小时

#### 任务 1.1：创建 Electron 配置文件

**文件列表**：
- `electron/package.json` - Electron 依赖和脚本
- `electron/main.js` - 主进程入口
- `electron/preload.js` - IPC 预加载脚本

**详细内容**：

**1.1.1 electron/package.json**
```json
{
  "name": "dhu-quiz-app",
  "version": "1.0.0",
  "description": "东华红课题库刷题系统",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "dev": "NODE_ENV=development electron .",
    "build:win": "electron-builder --win --config builder-win.yaml",
    "build:mac": "electron-builder --mac --config builder-mac.yaml",
    "build:all": "npm run build:win && npm run build:mac"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1"
  },
  "build": {
    "appId": "com.dhu.quiz",
    "productName": "东华红课题库刷题系统",
    "directories": {
      "output": "dist"
    }
  },
  "author": "DHU",
  "license": "MIT"
}
```

**1.1.2 electron/main.js**
```javascript
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

let mainWindow;
let pythonProcess;

// 应用数据目录
const userDataPath = app.getPath('userData');
const dataPath = path.join(userDataPath, 'data');
const uploadsPath = path.join(userDataPath, 'uploads');

// 确保目录存在
fs.ensureDirSync(dataPath);
fs.ensureDirSync(uploadsPath);

// 数据文件路径
const questionsFilePath = path.join(dataPath, 'questions.json');
const wrongbookFilePath = path.join(dataPath, 'wrongbook.json');
const rankingsFilePath = path.join(dataPath, 'rankings.json');
const progressFilePath = path.join(dataPath, 'progress.json');
const configFilePath = path.join(dataPath, 'config.json');

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false
        },
        title: '东华红课题库刷题系统',
        icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.icns'),
        show: false,
        backgroundColor: '#ffffff'
    });

    // 加载前端
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'index.html'));

    // 开发模式打开 DevTools
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    // 窗口准备好后显示
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // 错误处理
    mainWindow.webContents.on('crash', () => {
        console.error('Renderer process crashed');
    });
}

app.whenReady().then(() => {
    // 启动 Python 子进程（用于 Word 解析）
    startPythonProcess();

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // 停止 Python 进程
    if (pythonProcess) {
        pythonProcess.kill();
    }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 启动 Python 进程
function startPythonProcess() {
    const pythonPath = process.platform === 'win32' ? 'python.exe' : 'python3';

    // Python 脚本用于 Word 解析
    const pythonScript = path.join(__dirname, 'python_parser.py');

    if (fs.existsSync(pythonScript)) {
        pythonProcess = spawn(pythonPath, [pythonScript], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: path.join(__dirname, '..')
        });

        pythonProcess.on('error', (err) => {
            console.error('Failed to start Python process:', err);
        });

        pythonProcess.stdout.on('data', (data) => {
            console.log('Python output:', data.toString());
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error('Python error:', data.toString());
        });
    }
}

// ==================== IPC 处理器 ====================

// 导入数据模型
const {
    QuestionsModel,
    WrongbookModel,
    RankingsModel,
    ProgressModel,
    ConfigModel
} = require('./models');

// 健康检查
ipcMain.handle('health-check', async () => {
    return { success: true, status: 'online' };
});

// 文件操作
ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
});

ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
});

ipcMain.handle('open-external', async (event, url) => {
    shell.openExternal(url);
});

// 题库管理
ipcMain.handle('get-banks', async () => {
    try {
        const banks = QuestionsModel.getBanks();
        return { success: true, banks };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-bank', async (event, bankName) => {
    try {
        const result = QuestionsModel.deleteBank(bankName);
        return result ?
            { success: true, message: `题库 '${bankName}' 已删除` } :
            { success: false, error: '题库不存在' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ... 其他 IPC 处理器（完整实现在后续阶段）
```

**1.1.3 electron/preload.js**
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 健康检查
    healthCheck: () => ipcRenderer.invoke('health-check'),

    // 文件操作
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // 题库管理
    getBanks: () => ipcRenderer.invoke('get-banks'),
    deleteBank: (bankName) => ipcRenderer.invoke('delete-bank', bankName),

    // 题目管理
    getQuestions: (filters) => ipcRenderer.invoke('get-questions', filters),
    getQuestion: (questionId) => ipcRenderer.invoke('get-question', questionId),
    updateQuestion: (questionId, data) => ipcRenderer.invoke('update-question', questionId, data),
    deleteQuestion: (questionId) => ipcRenderer.invoke('delete-question', questionId),

    // 章节
    getChapters: (bank) => ipcRenderer.invoke('get-chapters', bank),

    // 练习
    practiceRandom: (filters) => ipcRenderer.invoke('practice-random', filters),
    practiceSequence: (filters) => ipcRenderer.invoke('practice-sequence', filters),
    practiceWrong: (filters) => ipcRenderer.invoke('practice-wrong', filters),
    checkAnswer: (data) => ipcRenderer.invoke('check-answer', data),

    // 错题本
    getWrongbook: (bank) => ipcRenderer.invoke('get-wrongbook', bank),
    getWrongbookStats: () => ipcRenderer.invoke('get-wrongbook-stats'),
    addWrongQuestion: (data) => ipcRenderer.invoke('add-wrong-question', data),
    removeWrongQuestion: (questionId) => ipcRenderer.invoke('remove-wrong-question', questionId),
    clearWrongbook: () => ipcRenderer.invoke('clear-wrongbook'),

    // 排行榜
    getRankings: () => ipcRenderer.invoke('get-rankings'),
    addRanking: (data) => ipcRenderer.invoke('add-ranking', data),
    clearRankings: () => ipcRenderer.invoke('clear-rankings'),

    // 进度
    getProgress: () => ipcRenderer.invoke('get-progress'),
    saveProgress: (data) => ipcRenderer.invoke('save-progress', data),
    deleteProgress: (id) => ipcRenderer.invoke('delete-progress', id),

    // 统计
    getStats: (filters) => ipcRenderer.invoke('get-stats', filters),

    // 配置
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),

    // 导入题库
    importQuestions: (filePath, bankName) => ipcRenderer.invoke('import-questions', filePath, bankName),

    // 导出数据
    exportData: (format) => ipcRenderer.invoke('export-data', format),
    importData: (filePath) => ipcRenderer.invoke('import-data', filePath)
});
```

#### 任务 1.2：创建 Node.js 数据模型

**文件**：`electron/models/index.js`

这个文件用 Node.js 重新实现所有 Python 数据模型的逻辑。

```javascript
/**
 * Node.js 数据模型
 * 替代原有的 Python 数据模型 (backend/models/*.py)
 */

const fs = require('fs-extra');
const path = require('path');

// 应用数据目录
const userDataPath = require('electron').app.getPath('userData');
const dataPath = path.join(userDataPath, 'data');

// 确保目录存在
fs.ensureDirSync(dataPath);

// 数据文件路径
const getFilePath = (filename) => path.join(dataPath, filename);

// 初始化数据文件
const initDataFile = (filename, defaultData) => {
    const filePath = getFilePath(filename);
    if (!fs.existsSync(filePath)) {
        fs.writeJsonSync(filePath, defaultData, { encoding: 'utf-8' });
    }
};

// 初始化所有数据文件
initDataFile('questions.json', { banks: {}, questions: [] });
initDataFile('wrongbook.json', { questions: [] });
initDataFile('rankings.json', { records: [] });
initDataFile('progress.json', { list: [] });
initDataFile('config.json', { settings: {} });

/**
 * 读取 JSON 数据
 */
const readData = (filename) => {
    try {
        const filePath = getFilePath(filename);
        return fs.readJsonSync(filePath, { encoding: 'utf-8' });
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return null;
    }
};

/**
 * 写入 JSON 数据
 */
const writeData = (filename, data) => {
    try {
        const filePath = getFilePath(filename);
        fs.writeJsonSync(filePath, data, { encoding: 'utf-8', indent: 2 });
        return true;
    } catch (error) {
        console.error(`Error writing ${filename}:`, error);
        return false;
    }
};

/**
 * QuestionsModel - 题库数据模型
 */
const QuestionsModel = {
    load() {
        return readData('questions.json') || { banks: {}, questions: [] };
    },

    save(data) {
        return writeData('questions.json', data);
    },

    getBanks() {
        const data = this.load();
        const banks = data.banks || {};
        const questions = data.questions || [];
        const bankList = [];

        for (const [name, info] of Object.entries(banks)) {
            const questionCount = questions.filter(q => q.bank === name).length;
            bankList.push({
                name: name,
                question_count: questionCount,
                import_time: info.import_time || '',
                source_file: info.source_file || '',
                semester: info.semester || ''
            });
        }

        // 按导入时间倒序排列
        return bankList.sort((a, b) => new Date(b.import_time) - new Date(a.import_time));
    },

    getQuestions(filters = {}) {
        let questions = this.load().questions || [];

        if (filters.bank) {
            questions = questions.filter(q => q.bank === filters.bank);
        }

        if (filters.type) {
            questions = questions.filter(q => q.type === filters.type);
        }

        if (filters.chapter) {
            questions = questions.filter(q => q.chapter === filters.chapter);
        }

        return questions;
    },

    getQuestionById(questionId) {
        const questions = this.load().questions || [];
        return questions.find(q => q.id === questionId) || null;
    },

    getChapters(bankName) {
        const questions = this.load().questions || [];
        const chapters = new Set();

        questions
            .filter(q => q.bank === bankName)
            .forEach(q => {
                if (q.chapter) {
                    chapters.add(q.chapter);
                }
            });

        return Array.from(chapters).sort();
    },

    addBank(bankName, sourceFile, semester = '') {
        const data = this.load();

        if (!data.banks[bankName]) {
            data.banks[bankName] = {
                source_file: sourceFile,
                import_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
                semester: semester
            };
            return this.save(data);
        }

        return false;
    },

    deleteBank(bankName) {
        const data = this.load();

        if (data.banks[bankName]) {
            delete data.banks[bankName];
            data.questions = data.questions.filter(q => q.bank !== bankName);
            return this.save(data);
        }

        return false;
    },

    addQuestions(bankName, questions) {
        const data = this.load();

        // 移除同名题库的旧题目
        data.questions = data.questions.filter(q => q.bank !== bankName);

        // 添加新题目
        data.questions.push(...questions);

        return this.save(data);
    },

    deleteQuestion(questionId) {
        const data = this.load();
        const originalLength = data.questions.length;
        data.questions = data.questions.filter(q => q.id !== questionId);

        if (data.questions.length !== originalLength) {
            return this.save(data);
        }

        return false;
    },

    updateQuestion(questionId, updateData) {
        const data = this.load();
        const index = data.questions.findIndex(q => q.id === questionId);

        if (index !== -1) {
            data.questions[index] = { ...data.questions[index], ...updateData };
            return this.save(data);
        }

        return false;
    }
};

/**
 * WrongbookModel - 错题本数据模型
 */
const WrongbookModel = {
    load() {
        return readData('wrongbook.json') || { questions: [] };
    },

    save(data) {
        return writeData('wrongbook.json', data);
    },

    getWrongQuestions(filters = {}) {
        let questions = this.load().questions || [];

        if (filters.bank) {
            questions = questions.filter(q => q.bank === filters.bank);
        }

        return questions;
    },

    addWrongQuestion(question, userAnswer) {
        const data = this.load();

        // 检查是否已存在
        const exists = data.questions.some(q => q.id === question.id);

        if (!exists) {
            data.questions.push({
                ...question,
                wrong_answer: userAnswer,
                wrong_time: new Date().toISOString()
            });
            return this.save(data);
        }

        return false;
    },

    removeQuestion(questionId) {
        const data = this.load();
        const originalLength = data.questions.length;
        data.questions = data.questions.filter(q => q.id !== questionId);

        if (data.questions.length !== originalLength) {
            return this.save(data);
        }

        return false;
    },

    clear() {
        return this.save({ questions: [] });
    },

    clearByBank(bankName) {
        const data = this.load();
        const originalLength = data.questions.length;
        data.questions = data.questions.filter(q => q.bank !== bankName);
        const removed = originalLength - data.questions.length;

        if (removed > 0) {
            this.save(data);
        }

        return removed;
    },

    getStats() {
        const questions = this.load().questions || [];
        const stats = {};

        questions.forEach(q => {
            if (!stats[q.bank]) {
                stats[q.bank] = 0;
            }
            stats[q.bank]++;
        });

        return {
            stats: Object.entries(stats).map(([name, count]) => ({ name, count })),
            total: questions.length
        };
    }
};

/**
 * RankingsModel - 排行榜数据模型
 */
const RankingsModel = {
    load() {
        return readData('rankings.json') || { records: [] };
    },

    save(data) {
        return writeData('rankings.json', data);
    },

    getRankings() {
        const data = this.load();
        return data.records || [];
    },

    addRanking(record) {
        const data = this.load();

        const newRecord = {
            ...record,
            id: Date.now().toString(),
            timestamp: new Date().toISOString()
        };

        data.records.push(newRecord);
        this.save(data);

        return newRecord;
    },

    clear() {
        return this.save({ records: [] });
    }
};

/**
 * ProgressModel - 进度数据模型
 */
const ProgressModel = {
    load() {
        return readData('progress.json') || { list: [] };
    },

    save(data) {
        return writeData('progress.json', data);
    },

    getProgressList() {
        const data = this.load();
        return data.list || [];
    },

    saveProgress(progress) {
        const data = this.load();

        const newProgress = {
            ...progress,
            id: progress.id || Date.now().toString(),
            save_time: new Date().toISOString()
        };

        if (progress.id) {
            // 更新现有进度
            const index = data.list.findIndex(p => p.id === progress.id);
            if (index !== -1) {
                data.list[index] = newProgress;
            }
        } else {
            // 添加新进度
            data.list.push(newProgress);
        }

        this.save(data);

        return newProgress.id;
    },

    deleteProgress(id) {
        const data = this.load();
        const originalLength = data.list.length;
        data.list = data.list.filter(p => p.id !== id);

        if (data.list.length !== originalLength) {
            return this.save(data);
        }

        return false;
    }
};

/**
 * ConfigModel - 配置数据模型
 */
const ConfigModel = {
    load() {
        return readData('config.json') || { settings: {} };
    },

    save(settings) {
        return writeData('config.json', { settings });
    },

    get(key, defaultValue = null) {
        const data = this.load();
        return data.settings[key] !== undefined ? data.settings[key] : defaultValue;
    },

    set(key, value) {
        const data = this.load();
        data.settings[key] = value;
        return this.save(data.settings);
    }
};

module.exports = {
    QuestionsModel,
    WrongbookModel,
    RankingsModel,
    ProgressModel,
    ConfigModel
};
```

#### 任务 1.3：实现 Python 解析器接口

**文件**：`electron/python_parser.py`

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Python Word 文档解析器
通过 stdin/stdout 与 Electron 通信
"""

import sys
import json
import os

# 添加 backend 目录到路径
backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_dir)

from parser import parse_file

def parse_document(file_path):
    """
    解析文档文件
    返回: {questions, bank_name, semester}
    """
    try:
        result = parse_file(file_path, None)
        questions = result[0]
        bank_name = result[1]
        semester = result[2] if len(result) > 2 else ''

        return {
            'success': True,
            'questions': questions,
            'bank_name': bank_name,
            'semester': semester
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def main():
    """
    主函数：从 stdin 读取 JSON，处理后输出到 stdout
    """
    # 读取输入
    input_data = sys.stdin.read().strip()

    if not input_data:
        return

    try:
        data = json.loads(input_data)

        if data.get('action') == 'parse':
            file_path = data.get('file_path')
            result = parse_document(file_path)
            print(json.dumps(result, ensure_ascii=False))
        else:
            print(json.dumps({'success': False, 'error': 'Unknown action'}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))

if __name__ == '__main__':
    main()
```

#### 任务 1.4：前端 API 调用改造

**修改文件**：
- `frontend/js/app.js` - 修改 `API_BASE` 和健康检查
- `frontend/js/modules/banks.js` - 所有 `fetch` 调用改为 IPC
- `frontend/js/modules/practice.js` - 所有 `fetch` 调用改为 IPC
- `frontend/js/modules/upload.js` - 改为文件对话框 + IPC
- `frontend/js/modules/wrongbook.js` - 所有 `fetch` 调用改为 IPC
- `frontend/js/modules/rankings.js` - 所有 `fetch` 调用改为 IPC
- `frontend/js/modules/progress.js` - 所有 `fetch` 调用改为 IPC
- `frontend/js/modules/stats.js` - 所有 `fetch` 调用改为 IPC

**frontend/js/app.js 修改**：
```javascript
/**
 * 题库刷题系统前端逻辑
 */

// 检测是否在 Electron 环境中
const isElectron = window.electronAPI !== undefined;
const API_BASE = ''; // IPC 模式下不需要

// ==================== 全局状态 ====================
let currentPage = 'dashboard';
let practiceQuestions = [];
let currentQuestionIndex = 0;
let selectedAnswers = [];
let correctCount = 0;
let wrongCount = 0;
let currentBankName = '';
let editingQuestionId = null;
let serverOnline = true;
let healthCheckInterval = null;
let practiceTimer = null;
let remainingTime = 0;
let practiceStartTime = null;
let isExamMode = false;
let questionResults = [];
let lastPracticeSettings = null;
let isBackMode = false;
let editOptionsState = [];
let currentPracticeMode = 'random';
let currentWrongBankName = '';
let currentProgressId = null;
let loadedElapsedTime = 0;
let navCurrentPage = 1;
const NAV_PAGE_SIZE = 56;

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async function() {
    initNavigation();
    initUpload();

    // 加载配置
    await loadConfig();

    // Electron 环境不需要健康检查
    if (!isElectron) {
        startHealthCheck();
    } else {
        serverOnline = true;
    }

    // 设置初始页面属性
    document.body.setAttribute('data-page', 'dashboard');

    // 暴露函数到全局作用域
    window.changeNavPage = changeNavPage;
    window.togglePanel = togglePanel;
});

// ...
```

**阶段一交付物**：
- [ ] `electron/package.json`
- [ ] `electron/main.js`
- [ ] `electron/preload.js`
- [ ] `electron/models/index.js`
- [ ] `electron/python_parser.py`
- [ ] 修改后的 `frontend/js/app.js`
- [ ] 修改后的 `frontend/js/modules/*.js`

---

### 阶段二：Windows 打包与测试

**目标**：生成 Windows 安装包并测试

**时间**：2-3 小时

#### 任务 2.1：配置 Windows 打包

**文件**：`electron/builder-win.yaml`

```yaml
appId: com.dhu.quiz
productName: 东华红课题库刷题系统
directories:
  buildResources: assets
  output: dist

files:
  - electron/**/*
  - backend/parser.py
  - backend/utils.py
  - frontend/**/*
  - data/
  - !**/node_modules/**/*
  - !**/dist/**/*
  - !**/*.md
  - !**/*.pyc
  - !**/__pycache__/**

win:
  target:
    - nsis
  icon: assets/icon.ico
  artifactName: ${productName}-${version}-setup.${ext}

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  installerIcon: assets/icon.ico
  uninstallerIcon: assets/icon.ico
  include: scripts/installer.nsh

afterPack: scripts/afterpack.js

python:
  path: .python
  version: 3.11.0
  modules:
    - python-docx
    - pywin32; sys_platform == "win32"
```

#### 任务 2.2：图标资源准备

**需要的文件**：
- `electron/assets/icon.ico` (Windows 图标, 256x256)
  - 建议使用 IcoFX 或在线工具生成
  - 包含多种尺寸：16, 32, 48, 64, 128, 256

#### 任务 2.3：配置 Python 打包

创建 `scripts/afterpack.js`：

```javascript
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

module.default = async function afterPack(context) {
    const { appOutDir, platform } = context;

    if (platform.name !== 'win32') {
        return;
    }

    // 复制 Python 运行时到应用目录
    // 这里需要根据实际情况配置
    console.log('After pack for Windows completed');
};
```

#### 任务 2.4：测试清单

**功能测试**：
- [ ] 安装程序正常安装
- [ ] 应用启动
- [ ] 题库导入（支持 .doc/.docx/.txt）
- [ ] 随机练习
- [ ] 错题本
- [ ] 排行榜
- [ ] 进度保存
- [ ] 窗口操作（最小化、最大化、关闭）
- [ ] 数据持久化（重启后数据不丢失）

**性能测试**：
- [ ] 启动速度 < 5 秒
- [ ] 内存占用 < 200MB

**阶段二交付物**：
- [ ] `electron/builder-win.yaml`
- [ ] `electron/assets/icon.ico`
- [ ] `scripts/afterpack.js`
- [ ] Windows 安装包 (.exe)

---

### 阶段三：macOS 打包与测试

**目标**：生成 macOS .dmg 并测试

**时间**：2-3 小时

#### 任务 3.1：配置 macOS 打包

**文件**：`electron/builder-mac.yaml`

```yaml
appId: com.dhu.quiz
productName: 东华红课题库刷题系统
directories:
  buildResources: assets
  output: dist

files:
  - electron/**/*
  - backend/parser.py
  - backend/utils.py
  - frontend/**/*
  - data/
  - !**/node_modules/**/*
  - !**/dist/**/*
  - !**/*.md
  - !**/*.pyc
  - !**/__pycache__/**

mac:
  target:
    - dmg
    - zip
  icon: assets/icon.icns
  category: public.app-category.education
  entitlements: assets/entitlements.mac.plist
  entitlementsInherit: assets/entitlements.mac.plist
  hardenedRuntime: true
  gatekeeperAssess: false

dmg:
  contents:
    - x: 130, y: 220
      type: file
      path: "/Applications"
    - x: 410, y: 220
      type: link
      path: "/Applications"
    - x: 130, y: 400
      type: file
      path: electron.icns
  title: "东华红课题库刷题系统 ${version}"

afterPack: scripts/afterpack-mac.js
```

#### 任务 3.2：代码签名配置

**文件**：`electron/assets/entitlements.mac.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-only</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
```

#### 任务 3.3：macOS 特定适配

**需要适配的内容**：
- 窗口标题栏样式
- Cmd+Q 退出应用
- Dock 图标行为
- 文件关联

**阶段三交付物**：
- [ ] `electron/builder-mac.yaml`
- [ ] `electron/assets/icon.icns`
- [ ] `electron/assets/entitlements.mac.plist`
- [ ] macOS 安装镜像 (.dmg)

---

### 阶段四：PWA 离线支持

**目标**：让手机也能离线刷题

**时间**：3-4 小时

#### 任务 4.1：创建 PWA manifest

**文件**：`frontend/manifest.json`

```json
{
  "name": "东华红课题库刷题系统",
  "short_name": "东华刷题",
  "description": "东华大学政治科学课程题库练习系统",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a73e8",
  "orientation": "portrait-primary",
  "scope": "/",
  "lang": "zh-CN",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["education", "productivity"],
  "screenshots": [],
  "prefer_related_applications": false
}
```

**在 `frontend/index.html` 中添加**：
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#1a73e8">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="东华刷题">
<link rel="apple-touch-icon" href="/icons/icon-192x192.png">
```

#### 任务 4.2：创建 Service Worker

**文件**：`frontend/sw.js`

```javascript
const CACHE_NAME = 'dhu-quiz-v1';
const CACHE_VERSION = 1;

// 静态资源列表
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/css/mobile.css',
  '/js/app.js',
  '/js/mobile.js',
  '/js/modules/banks.js',
  '/js/modules/practice.js',
  '/js/modules/upload.js',
  '/js/modules/wrongbook.js',
  '/js/modules/rankings.js',
  '/js/modules/progress.js',
  '/js/modules/stats.js',
  '/js/modules/modes.js',
  '/js/modules/core.js',
  '/js/modules/utils.js',
  '/js/modules/settings.js',
  '/js/modules/state.js',
  '/js/modules/index.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// 数据缓存前缀
const DATA_CACHE_PREFIX = 'data-';

// 安装事件：缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 激活事件：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && !cacheName.startsWith(DATA_CACHE_PREFIX)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 获取事件：拦截请求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 对于静态资源，使用缓存优先策略
  if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset)) ||
      url.pathname.startsWith('/css/') ||
      url.pathname.startsWith('/js/') ||
      url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 对于数据请求，使用网络优先策略，失败时返回缓存
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 默认使用网络优先
  event.respondWith(networkFirst(request));
});

// 缓存优先策略
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  const networkResponse = await fetch(request);
  if (networkResponse.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

// 网络优先策略
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}
```

**在 `frontend/js/app.js` 中注册 Service Worker**：
```javascript
// 注册 Service Worker
if ('serviceWorker' in navigator && !isElectron) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker 注册成功:', registration);
      })
      .catch((error) => {
        console.log('Service Worker 注册失败:', error);
      });
  });
}
```

#### 任务 4.3：IndexedDB 数据持久化

**文件**：`frontend/js/modules/idb.js`

```javascript
// IndexedDB 封装
const DB_NAME = 'DhuQuizDB';
const DB_VERSION = 1;
const STORES = ['questions', 'wrongbook', 'rankings', 'progress', 'config'];

class IndexedDB {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 创建对象存储
        STORES.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };
    });
  }

  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// 导出单例
const idb = new IndexedDB();

module.exports = idb;
```

#### 任务 4.4：数据导入导出功能

**文件**：`frontend/js/modules/data-export.js`

```javascript
// 导出数据
async function exportData(format = 'json') {
  const data = {
    questions: await getExportQuestions(),
    wrongbook: await getExportWrongbook(),
    rankings: await getExportRankings(),
    progress: await getExportProgress(),
    config: await getExportConfig(),
    exportDate: new Date().toISOString(),
    version: '1.0.0'
  };

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });

  if (isElectron) {
    // Electron 环境：使用文件保存对话框
    const result = await window.electronAPI.showSaveDialog({
      defaultPath: `quiz-backup-${new Date().toISOString().split('T')[0]}.json`,
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      const fs = require('fs');
      fs.writeFileSync(result.filePath, jsonString);
      showToast('数据已导出', 'success');
    }
  } else {
    // 浏览器环境：触发下载
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('数据已导出', 'success');
  }
}

// 导入数据
async function importData() {
  let filePath;

  if (isElectron) {
    const result = await window.electronAPI.showOpenDialog({
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return;
    }

    filePath = result.filePaths[0];
  } else {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (event) => {
        const file = event.target.files[0];
        if (file) {
          const text = await file.text();
          const data = JSON.parse(text);
          await importDataToStore(data);
        }
        resolve();
      };
      input.click();
    });
  }

  // 读取文件内容
  const fs = require('fs');
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);

  // 验证数据格式
  if (!data.questions || !data.wrongbook) {
    showToast('数据格式错误', 'error');
    return;
  }

  // 询问导入策略
  const strategy = await showImportStrategyDialog();

  switch (strategy) {
    case 'overwrite':
      await overwriteAllData(data);
      break;
    case 'merge':
      await mergeData(data);
      break;
    case 'cancel':
      return;
  }

  showToast('数据导入成功', 'success');
  location.reload();
}

async function showImportStrategyDialog() {
  // 显示导入策略选择对话框
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay';
    dialog.innerHTML = `
      <div class="modal-content">
        <h3>选择导入方式</h3>
        <p>请选择如何处理现有数据：</p>
        <button class="btn btn-danger" onclick="resolve('overwrite')">覆盖（清空现有数据）</button>
        <button class="btn btn-primary" onclick="resolve('merge')">合并（保留现有数据）</button>
        <button class="btn btn-secondary" onclick="resolve('cancel')">取消</button>
      </div>
    `;
    document.body.appendChild(dialog);
  });
}

async function overwriteAllData(data) {
  // 覆盖所有数据
  if (isElectron) {
    await window.electronAPI.importData(data);
  } else {
    await importDataToStore(data);
  }
}

async function mergeData(data) {
  // 合并数据
  // 实现合并逻辑
}

async function importDataToStore(data) {
  // 将数据导入到 IndexedDB
  await idb.init();

  // 导入题库
  if (data.questions) {
    for (const question of data.questions) {
      await idb.put('questions', { ...question, id: question.id });
    }
  }

  // 导入错题本
  if (data.wrongbook && data.wrongbook.questions) {
    for (const question of data.wrongbook.questions) {
      await idb.put('wrongbook', { ...question, id: question.id });
    }
  }

  // 导入排行榜
  if (data.rankings && data.rankings.records) {
    for (const record of data.rankings.records) {
      await idb.put('rankings', { ...record, id: record.id });
    }
  }

  // 导入进度
  if (data.progress && data.progress.list) {
    for (const progress of data.progress.list) {
      await idb.put('progress', { ...progress, id: progress.id });
    }
  }

  // 导入配置
  if (data.config && data.config.settings) {
    for (const [key, value] of Object.entries(data.config.settings)) {
      await idb.put('config', { id: key, value });
    }
  }
}
```

**阶段四交付物**：
- [ ] `frontend/manifest.json`
- [ ] `frontend/sw.js`
- [ ] `frontend/js/modules/idb.js`
- [ ] `frontend/js/modules/data-export.js`
- [ ] `electron/assets/icons/*` (PWA 图标)

---

### 阶段五：移动端优化（可选）

**时间**：1-2 小时

#### 任务 5.1：PWA 安装提示

**文件**：`frontend/js/modules/pwa-install.js`

```javascript
let deferredPrompt;

// 监听 beforeinstallprompt 事件
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;

  // 显示安装提示
  showInstallPrompt();
});

// 显示安装提示
function showInstallPrompt() {
  const prompt = document.createElement('div');
  prompt.className = 'pwa-install-prompt';
  prompt.innerHTML = `
    <div class="prompt-content">
      <i class="fas fa-download"></i>
      <span>安装到主屏幕，享受离线刷题体验</span>
      <button class="btn btn-primary" onclick="installPWA()">安装</button>
      <button class="btn btn-close" onclick="hideInstallPrompt()">×</button>
    </div>
  `;
  document.body.appendChild(prompt);
}

// 安装 PWA
async function installPWA() {
  if (!deferredPrompt) {
    return;
  }

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  if (outcome === 'accepted') {
    showToast('安装成功！', 'success');
  }

  deferredPrompt = null;
  hideInstallPrompt();
}

// 隐藏安装提示
function hideInstallPrompt() {
  const prompt = document.querySelector('.pwa-install-prompt');
  if (prompt) {
    prompt.remove();
  }
}
```

**阶段五交付物**：
- [ ] `frontend/js/modules/pwa-install.js`
- [ ] PWA 安装提示 UI

---

## 开发顺序与时间估算

### 推荐开发顺序

#### Week 1：桌面端（Windows）
| Day | 任务 | 时间 |
|-----|------|------|
| 1-2 | 阶段一：Electron 基础架构 + IPC | 4-6 小时 |
| 3 | 阶段二：Windows 打包测试 | 2-3 小时 |

#### Week 2：跨平台与移动端
| Day | 任务 | 时间 |
|-----|------|------|
| 1-2 | 阶段三：macOS 打包测试 | 2-3 小时 |
| 3-4 | 阶段四：PWA 离线支持 | 3-4 小时 |
| 5 | 测试和文档更新 | 1-2 小时 |

### 总体时间估算

| 阶段 | 预计时间 | 优先级 | 依赖 |
|------|---------|--------|------|
| 阶段一：Electron 基础架构 + IPC | 4-6 小时 | 🔥 高 | - |
| 阶段二：Windows 打包测试 | 2-3 小时 | 🔥 高 | 阶段一 |
| 阶段三：macOS 打包测试 | 2-3 小时 | 🔥 高 | 阶段一 |
| 阶段四：PWA 离线支持 | 3-4 小时 | ⭐ 中 | - |
| 阶段五：移动端优化（可选） | 1-2 小时 | ⭐ 低 | 阶段四 |
| **必需总计** | **11-16 小时** | - | - |
| **包含可选** | **12-18 小时** | - | - |

---

## 交付成果

### 桌面端（Windows + macOS）

| 产物 | 文件格式 | 说明 |
|------|---------|------|
| Windows 安装包 | `.exe` | NSIS 安装程序，支持自定义安装路径 |
| macOS 安装镜像 | `.dmg` | 拖拽安装到 Applications |

### 移动端（PWA）

| 产物 | 说明 |
|------|------|
| PWA 应用 | 可安装到安卓/iOS 主屏幕 |
| 离线支持 | Service Worker + IndexedDB |
| 数据同步 | 文件导入导出功能 |

### 功能完整性

| 功能 | 桌面端 | 移动端 |
|------|--------|--------|
| 题库导入 | ✅ .doc/.docx/.txt | ⚠️ 仅支持导入已导出的数据 |
| 随机练习 | ✅ | ✅ 离线可用 |
| 顺序练习 | ✅ | ✅ 离线可用 |
| 错题本 | ✅ | ✅ 离线可用 |
| 排行榜 | ✅ | ✅ 离线可用 |
| 进度保存 | ✅ | ✅ 离线可用 |
| 数据导出 | ✅ | ✅ |
| 数据导入 | ✅ | ✅ |

### 文档

| 文档 | 说明 |
|------|------|
| `AGENTS.md` | 更新开发指南 |
| `ELECTRON_PLAN.md` | 本文档 |
| `BUILD_WINDOWS.md` | Windows 打包指南（待创建） |
| `BUILD_MACOS.md` | macOS 打包指南（待创建） |
| `PWA_GUIDE.md` | PWA 使用指南（待创建） |

---

## 附录

### A. 技术栈版本要求

| 组件 | 最低版本 | 推荐版本 |
|------|---------|---------|
| Node.js | 16.x | 18.x LTS / 20.x LTS |
| npm | 8.x | 9.x+ |
| Python | 3.8 | 3.11.x |
| Electron | 26.x | 28.x |
| electron-builder | 24.x | 24.9.x |

### B. 开发环境配置

#### B.1 Node.js 环境

```bash
# 安装 Node.js (使用 nvm)
# Windows: https://github.com/coreybutler/nvm-windows
# macOS/Linux: https://github.com/nvm-sh/nvm

nvm install 18
nvm use 18

# 验证版本
node --version  # v18.x.x
npm --version   # 9.x.x
```

#### B.2 Python 环境

```bash
# 安装 Python
# Windows: https://www.python.org/downloads/
# macOS: brew install python@3.11

# 验证版本
python --version  # 3.11.x
pip --version     # 23.x
```

#### B.3 项目依赖

```bash
# 安装项目依赖
cd electron
npm install

# 安装 Python 依赖（用于 Word 解析）
cd ..
pip install -r backend/requirements.txt

# 验证安装
npm run dev  # 测试开发模式运行
```

### C. 常见问题

#### C.1 Python 进程无法启动

**问题**：Windows 上 Python 进程启动失败

**解决方案**：
1. 确保 Python 已添加到系统 PATH
2. 检查 `python.exe` 是否可执行
3. 查看错误日志确定具体原因

#### C.2 打包体积过大

**问题**：生成的安装包超过 300MB

**解决方案**：
1. 使用 electron-builder 的压缩选项
2. 排除不必要的文件
3. 考虑使用 UPX 压缩

#### C.3 macOS 签名问题

**问题**：macOS 上应用无法启动（Gatekeeper）

**解决方案**：
1. 使用开发者证书签名
2. 或在系统偏好设置中允许任何来源的应用

### D. 参考资源

#### D.1 官方文档
- [Electron 官方文档](https://www.electronjs.org/docs)
- [electron-builder 文档](https://www.electron.build/)
- [PWA 官方指南](https://web.dev/progressive-web-apps/)
- [Service Worker 指南](https://developer.mozilla.org/zh-CN/docs/Web/API/Service_Worker_API)

#### D.2 相关工具
- [electron-forge](https://electronforge.io/)
- [electron-packager](https://github.com/electron/electron-packager)
- [PyInstaller](https://pyinstaller.org/)

### E. 更新日志

| 版本 | 日期 | 描述 |
|------|------|------|
| 1.0.0 | 2026-01-22 | 初始版本，创建实施计划 |

---

**文档结束**
