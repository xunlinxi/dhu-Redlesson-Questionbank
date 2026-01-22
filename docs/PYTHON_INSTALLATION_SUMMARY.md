# Python 环境安装配置完成

## ✅ 已完成的工作

### 1. 自动化脚本

已创建完整的 Python 环境安装自动化脚本：

#### 📥 `scripts/download-python.js`
- 自动下载 Python 3.11.7 Embedded
- 支持跨平台（Windows/macOS/Linux）
- 自动解压和配置
- 验证安装

#### 📚 `scripts/install-python-libs.js`
- 自动下载并安装 pip
- 安装所需依赖库：
  - `python-docx==1.1.0` - Word 文档解析
  - `lxml==5.1.0` - XML/HTML 解析
- 验证模块导入
- 支持嵌入式和系统 Python

#### 🧪 `scripts/test-python.js`
- 完整的环境测试
- 测试 Python 解释器
- 测试模块导入
- 测试文件访问
- 生成测试报告

### 2. 更新配置

#### `electron/package.json`
- 添加了便捷的 npm 脚本：
  - `npm run install-python` - 下载 Python
  - `npm run install-libs` - 安装依赖
  - `npm run setup-python` - 一键安装
  - `npm run test-python` - 测试环境
- 添加必要的依赖：`adm-zip`（ZIP 解压）

#### `electron/main.js`
- 更新 `startPythonProcess()` 函数
- 优先使用嵌入式 Python
- 自动回退到系统 Python
- 正确配置 PYTHONPATH

### 3. 文档

#### 📖 `docs/PYTHON_SETUP.md`
- 详细的安装指南
- 手动安装步骤
- 开发环境配置
- 故障排除
- 打包注意事项

#### ⚡ `docs/PYTHON_QUICKSTART.md`
- 快速开始指南
- 一键安装命令
- 常见问题解答

#### 📝 `scripts/README.md`
- 脚本使用说明
- 安装流程详解
- 文件结构说明

## 🚀 使用方法

### 快速开始（推荐）

```bash
# 1. 进入 electron 目录
cd electron

# 2. 安装 Node.js 依赖
npm install

# 3. 一键安装 Python 环境
npm run setup-python

# 4. 测试安装
npm run test-python

# 5. 启动应用
npm start
```

### 分步安装

如果一键安装失败，可以分步执行：

```bash
# 步骤 1：安装 Node.js 依赖
cd electron
npm install

# 步骤 2：下载 Python 解释器
npm run install-python

# 步骤 3：安装依赖库
npm run install-libs

# 步骤 4：测试安装
npm run test-python

# 步骤 5：启动应用
npm start
```

## 📂 安装后的目录结构

```
dhu-Redlesson-Questionbank/
├── electron/
│   ├── main.js                      # 已更新
│   ├── preload.js
│   ├── package.json                 # 已更新
│   ├── python/                      # 嵌入式 Python 环境
│   │   ├── python.exe              # Windows 可执行文件
│   │   ├── python311._pth         # 路径配置
│   │   ├── Lib/                    # Windows 标准库
│   │   │   └── site-packages/      # 依赖库
│   │   │       ├── python_docx/
│   │   │       └── lxml/
│   │   └── lib/                    # macOS/Linux 标准库
│   ├── python_parser.py
│   └── models/
├── scripts/
│   ├── download-python.js           # 新增
│   ├── install-python-libs.js       # 新增
│   ├── test-python.js              # 新增
│   └── README.md                   # 新增
├── docs/
│   ├── PYTHON_SETUP.md              # 新增
│   ├── PYTHON_QUICKSTART.md         # 新增
│   └── ELECTRON_PLAN.md
└── frontend/
    └── ...
```

## ✅ 验证安装成功

运行测试脚本：

```bash
cd electron
npm run test-python
```

看到以下输出表示安装成功：

```
🧪 Python 环境测试
============================================================
📍 平台: win32 (x64)
📍 Python: B:\...\electron\python\python.exe
📍 site-packages: B:\...\electron\python\Lib\site-packages

============================================================
🔍 测试 1: Python 解释器
============================================================
✅ Python 解释器正常
   版本: Python 3.11.7

============================================================
🔍 测试 2: Python 模块导入
============================================================
✅ docx: OK
✅ lxml: OK
✅ 所有模块导入正常

============================================================
🔍 测试 3: 文件访问权限
============================================================
✅ Python 解释器: 存在
✅ site-packages 目录: 存在
✅ python-docx 包: 存在
✅ lxml 包: 存在

✅ 所有文件访问正常

============================================================
📊 测试结果
============================================================

✅ 所有测试通过！

🎉 Python 环境安装成功，可以开始使用了

🚀 下一步:
   1. 启动应用: cd electron && npm start
   2. 打包应用: cd electron && npm run build:win
```

## 🔧 平台差异

### Windows
- ✅ 完全支持嵌入式 Python
- ✅ 自动下载和安装
- ✅ 包含在安装包中
- 体积：+40MB（Python + 依赖）

### macOS
- ⚠️ 不提供 Embedded 版本
- 💡 需要安装系统 Python（使用 Homebrew）
- 📦 不包含在安装包中
- 体积：基础应用大小

### Linux
- ✅ 支持嵌入式 Python（下载源码）
- 💡 或使用系统 Python（通过包管理器）
- 📦 可选包含在安装包中

## 📦 打包说明

### Windows 打包

运行打包命令，Python 环境会自动包含：

```bash
cd electron
npm run build:win
```

生成的安装包包含：
- Electron 应用
- 嵌入式 Python 环境
- 所有依赖库
- 前端资源

### macOS 打包

macOS 不包含 Python，用户需要自行安装：

```bash
cd electron
npm run build:mac
```

用户安装指引：
```bash
brew install python@3.11
pip3.11 install python-docx lxml
```

## 🐛 故障排除

### 问题：下载失败

**解决**：
1. 检查网络连接
2. 尝试使用代理
3. 手动下载后解压到 `electron/python/`

### 问题：安装失败

**解决**：
1. 检查磁盘空间（需要 100MB+）
2. 以管理员权限运行
3. 删除临时文件后重试

### 问题：模块导入失败

**解决**：
```bash
cd electron
npm run install-libs
```

或手动安装：
```bash
electron/python/python.exe -m pip install python-docx lxml
```

## 📚 参考文档

- [Python 环境安装指南](docs/PYTHON_SETUP.md) - 详细说明
- [快速开始指南](docs/PYTHON_QUICKSTART.md) - 快速上手
- [脚本使用说明](scripts/README.md) - 脚本文档
- [Electron 计划](docs/ELECTRON_PLAN.md) - 总体计划

## 🎉 下一步

安装成功后，可以：

1. **启动开发环境**
   ```bash
   cd electron
   npm run dev
   ```

2. **测试功能**
   - 导入 Word 文档
   - 刷题练习
   - 错题本管理

3. **打包应用**
   ```bash
   npm run build:win  # Windows
   npm run build:mac  # macOS
   ```

4. **继续阶段二**
   - Windows 打包测试
   - macOS 打包测试

---

**需要帮助？**

查看相关文档或提交 Issue。
