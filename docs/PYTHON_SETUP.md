# Python 环境安装指南

本文档说明如何在 Electron 应用中安装和使用嵌入式 Python 环境。

## 📋 目录

- [系统要求](#系统要求)
- [自动安装（推荐）](#自动安装推荐)
- [手动安装](#手动安装)
- [开发环境配置](#开发环境配置)
- [验证安装](#验证安装)
- [故障排除](#故障排除)

## 🔧 系统要求

- **Node.js**: 16.x 或更高版本
- **npm**: 8.x 或更高版本
- **操作系统**: Windows 10/11, macOS 10.15+, Linux
- **磁盘空间**: 至少 500MB（用于 Python 和依赖库）

## 🚀 自动安装（推荐）

### 步骤 1：安装 Node.js 依赖

```bash
cd electron
npm install
```

### 步骤 2：运行一键安装脚本

```bash
npm run setup-python
```

这个脚本会自动完成以下操作：

1. ✅ 下载 Python 3.11.7 Embedded
2. ✅ 解压到 `electron/python/` 目录
3. ✅ 配置 Python 环境
4. ✅ 安装 pip
5. ✅ 安装所需依赖库（python-docx, lxml）

### 步骤 3：验证安装

```bash
npm run test-python
```

看到以下输出表示安装成功：

```
✅ Python Embedded 安装成功！
✅ python-docx: OK
✅ lxml: OK
```

## 📝 手动安装

如果自动安装失败，可以按照以下步骤手动安装。

### Windows

#### 1. 下载 Python Embedded

访问 Python 官网下载页面：

```
https://www.python.org/downloads/release/python-3117/
```

下载 **"Windows embeddable package (64-bit)"**：

```
python-3.11.7-embed-amd64.zip
```

#### 2. 解压文件

将下载的 ZIP 文件解压到：

```
electron/python/
```

解压后的目录结构：

```
electron/python/
├── python.exe
├── python311.dll
├── python311._pth
├── Lib/
└── ...
```

#### 3. 启用 site-packages

编辑 `electron/python/python311._pth` 文件，在文件末尾添加：

```
import site
```

#### 4. 安装依赖库

```bash
cd electron
npm run install-libs
```

### macOS

macOS 不提供 Embedded 版本，需要安装系统 Python：

#### 方式 1：使用 Homebrew（推荐）

```bash
brew install python@3.11
```

#### 方式 2：从官网下载安装包

访问：

```
https://www.python.org/downloads/release/python-3117/
```

下载并安装 macOS 安装包。

#### 3. 安装依赖库（使用 uv）

```bash
# 安装 uv
pip install uv

# 创建虚拟环境
cd backend
uv venv

# 激活虚拟环境
source .venv/bin/activate  # macOS/Linux
.venv\Scripts\activate     # Windows

# 安装依赖
uv pip install python-docx lxml
```

## 💻 开发环境配置

### Windows 开发环境

如果已经安装了嵌入式 Python，开发环境会自动使用它。

如果没有，需要安装系统 Python：

```bash
# 从 Microsoft Store 或 python.org 安装
# 或使用 winget
winget install Python.Python.3.11
```

### macOS/Linux 开发环境

使用 uv 管理开发环境：

```bash
# 安装 uv
pip install uv

# 创建虚拟环境
cd backend
uv venv

# 激活虚拟环境
source .venv/bin/activate

# 安装依赖
uv pip install -r requirements.txt
```

## ✅ 验证安装

### 检查 Python 版本

```bash
# Windows
electron/python/python.exe --version

# macOS/Linux
electron/python/bin/python3 --version
```

应该输出：`Python 3.11.7`

### 测试依赖库

```bash
# Windows
electron/python/python.exe -c "from docx import Document; import lxml; print('OK')"

# macOS/Linux
electron/python/bin/python3 -c "from docx import Document; import lxml; print('OK')"
```

应该输出：`OK`

### 启动应用测试

```bash
cd electron
npm start
```

尝试导入一个 Word 文档，确认 Python 解析功能正常。

## 📂 目录结构

安装完成后的目录结构：

```
dhu-Redlesson-Questionbank/
├── electron/
│   ├── main.js
│   ├── preload.js
│   ├── python/               # 嵌入式 Python 环境
│   │   ├── python.exe      # Windows
│   │   ├── python3        # macOS/Linux
│   │   ├── Lib/           # Python 标准库
│   │   │   └── site-packages/  # 第三方库
│   │   │       ├── python_docx/
│   │   │       ├── lxml/
│   │   │       └── ...
│   │   └── python311._pth # Windows 路径配置
│   ├── python_parser.py
│   └── models/
├── backend/
│   ├── parser.py
│   ├── utils.py
│   └── requirements.txt
├── scripts/
│   ├── download-python.js
│   └── install-python-libs.js
└── frontend/
    └── ...
```

## 🔍 故障排除

### 问题 1：下载失败

**症状**：`下载失败` 或 `连接超时`

**解决方案**：

1. 检查网络连接
2. 尝试使用代理
3. 手动下载后解压到指定目录

### 问题 2：Python 版本不匹配

**症状**：`Python 版本不正确`

**解决方案**：

确认下载的是 **Python 3.11.7** Embedded 版本：

```bash
electron/python/python.exe --version
```

如果不是 3.11.7，请重新下载。

### 问题 3：导入模块失败

**症状**：`ModuleNotFoundError: No module named 'docx'`

**解决方案**：

1. 检查依赖是否安装：

```bash
# Windows
electron/python/python.exe -m pip list

# macOS/Linux
electron/python/bin/python3 -m pip list
```

2. 如果没有安装，重新运行：

```bash
cd electron
npm run install-libs
```

### 问题 4：Windows 安全警告

**症状**：Windows Defender 阻止运行 python.exe

**解决方案**：

1. 在 Windows Defender 中添加例外
2. 右键 python.exe -> 属性 -> 勾选"解除锁定"

### 问题 5：macOS 权限问题

**症状**：`Permission denied`

**解决方案**：

```bash
# 添加执行权限
chmod +x electron/python/bin/python3
```

## 📦 打包注意事项

### Windows 打包

打包时，`electron/python/` 目录会自动包含在安装包中。

确保以下配置在 `electron/builder-win.yaml`：

```yaml
files:
  - electron/python/**/*  # 包含嵌入式 Python
```

### macOS 打包

macOS 不包含嵌入式 Python，应用会使用系统 Python。

确保用户已安装 Python 3.11+：

```bash
# 在 README 中说明
brew install python@3.11
```

## 🔄 更新 Python 环境

### 更新版本

1. 删除旧的 Python 目录：

```bash
rm -rf electron/python
```

2. 重新运行安装脚本：

```bash
cd electron
npm run setup-python
```

### 更新依赖库

```bash
cd electron
npm run install-libs
```

## 📚 参考资源

- [Python 官网](https://www.python.org/)
- [Python Embedded 下载](https://www.python.org/downloads/)
- [python-docx 文档](https://python-docx.readthedocs.io/)
- [Electron 文档](https://www.electronjs.org/docs)

## 💡 提示

- 首次安装可能需要 10-15 分钟（下载 + 安装）
- 嵌入式 Python 体积约 30MB
- 依赖库体积约 10MB
- 建议在稳定的网络环境下进行安装
- 安装完成后可以删除临时文件（`scripts/temp/`）

---

**需要帮助？**

查看项目 README 或提交 Issue。
