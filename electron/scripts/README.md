# Python 环境安装脚本

本目录包含用于安装和管理 Electron 应用 Python 环境的自动化脚本。

## 📁 脚本列表

### download-python.js

自动下载并安装 Python Embedded 解释器。

**功能**：
- 下载 Python 3.11.7 Embedded
- 解压到 `electron/python/` 目录
- 配置 Python 环境（启用 site-packages）
- 验证 Python 安装

**支持平台**：
- ✅ Windows（推荐使用 Embedded 版本）
- ✅ macOS（提供安装指引）
- ✅ Linux（下载并解压源码）

**使用方法**：

```bash
# 直接运行
node scripts/download-python.js

# 或使用 npm 脚本
cd electron
npm run install-python
```

**输出位置**：
- Windows: `electron/python/`
- macOS: 提供安装指引（使用系统 Python）
- Linux: `electron/python/`

---

### install-python-libs.js

安装 Python 依赖库到嵌入式 Python 环境。

**功能**：
- 下载并安装 pip
- 安装所需的 Python 包：
  - `python-docx==1.1.0` - Word 文档解析
  - `lxml==5.1.0` - XML/HTML 解析
  - `pywin32==306` - Windows COM 接口（仅 Windows，用于 .doc 文件）
- 验证依赖安装

**依赖**：
- Python 解释器已安装（可通过 `download-python.js` 安装）
- 网络连接（用于下载 pip 和包）

**使用方法**：

```bash
# 直接运行
node scripts/install-python-libs.js

# 或使用 npm 脚本
cd electron
npm run install-libs
```

**安装位置**：
- Windows: `electron/python/Lib/site-packages/`
- macOS/Linux: `electron/python/lib/python3.11/site-packages/`

---

## 🚀 快速开始

### 一键安装（推荐）

```bash
cd electron
npm run setup-python
```

这个命令会依次运行：
1. `download-python.js` - 下载 Python 解释器
2. `install-python-libs.js` - 安装依赖库

### 分步安装

#### 步骤 1：安装 Python 解释器

```bash
cd electron
npm run install-python
```

#### 步骤 2：安装依赖库

```bash
cd electron
npm run install-libs
```

---

## 🔍 验证安装

### 检查 Python 解释器

```bash
# Windows
electron/python/python.exe --version

# macOS/Linux
electron/python/bin/python3 --version
```

应该输出：`Python 3.11.7`

### 检查依赖库

```bash
# Windows
electron/python/python.exe -m pip list

# macOS/Linux
electron/python/bin/python3 -m pip list
```

应该看到：
- `python-docx 1.1.0`
- `lxml 5.1.0`
- `pywin32 306`（仅 Windows）

### 检查 .doc 文件支持（仅 Windows）

```bash
# 检查系统是否安装 Word
# Windows
python -c "import win32com.client; word = win32com.client.Dispatch('Word.Application'); print('Word available:', word.Version); word.Quit()"
```

### 启动应用测试

```bash
cd electron
npm start
```

尝试导入一个 Word 文档，确认 Python 功能正常。

---

## 📝 安装过程

### download-python.js 流程

1. **检测平台**：识别 Windows/macOS/Linux
2. **下载文件**：从 Python 官网下载对应版本
3. **解压文件**：解压到 `electron/python/`
4. **配置环境**：修改 `python311._pth` 文件
5. **验证安装**：运行 `--version` 检查

### install-python-libs.js 流程

1. **检查 Python**：验证 Python 解释器可用
2. **下载 pip**：下载 `get-pip.py`
3. **安装 pip**：安装到嵌入式环境
4. **安装包**：安装 `python-docx` 和 `lxml`
5. **验证安装**：测试导入模块

---

## ⚠️ 注意事项

### 平台限制

#### .doc 文件支持
- **Windows**: 完全支持 .doc 文件（通过 pywin32 + Word COM 接口）
  - 需要系统安装 Microsoft Word
  - pywin32 库会自动安装（仅 Windows 平台）
- **macOS/Linux**: 不支持 .doc 文件
  - 建议将 .doc 文件转换为 .docx 格式后再导入
  - 可以使用 LibreOffice 或在线转换工具进行转换

#### 跨平台差异

| 功能 | Windows | macOS | Linux |
|------|---------|--------|-------|
| .docx 文件 | ✅ 完全支持 | ✅ 完全支持 | ✅ 完全支持 |
| .txt 文件 | ✅ 完全支持 | ✅ 完全支持 | ✅ 完全支持 |
| .doc 文件 | ✅ 完全支持 | ❌ 不支持 | ❌ 不支持 |
| 所需库 | python-docx, lxml, pywin32 | python-docx, lxml | python-docx, lxml |

### 网络要求

- 需要 Python 官网访问权限
- 需要 PyPI 访问权限（用于下载 pip 和包）

### 代理设置

如果需要使用代理，可以设置环境变量：

```bash
# Windows
set HTTP_PROXY=http://proxy:port
set HTTPS_PROXY=http://proxy:port

# macOS/Linux
export HTTP_PROXY=http://proxy:port
export HTTPS_PROXY=http://proxy:port
```

### 磁盘空间

- Python Embedded: ~30MB
- 依赖库（基础）: ~10MB
- pywin32（仅 Windows）: ~5-10MB
- 临时文件: ~50MB（安装后自动删除）

### 下载速度

- Python Embedded: ~5-10 分钟（取决于网络）
- pip: ~1-2 分钟
- 依赖库: ~3-5 分钟

---

## 🐛 故障排除

### 下载失败

**症状**：`下载失败` 或 `连接超时`

**解决方案**：

1. 检查网络连接
2. 设置代理（见上）
3. 手动下载并解压

### 解压失败

**症状**：`解压失败` 或 `文件损坏`

**解决方案**：

1. 删除已下载的文件
2. 重新运行脚本
3. 检查磁盘空间

### 安装失败

**症状**：`依赖安装失败`

**解决方案**：

1. 确认 Python 已正确安装
2. 手动安装依赖：

```bash
# Windows
electron/python/python.exe -m pip install python-docx lxml

# macOS/Linux
electron/python/bin/python3 -m pip install python-docx lxml
```

---

## 📚 相关文档

- [Python 环境安装指南](../docs/PYTHON_SETUP.md) - 详细安装说明
- [Electron 计划](../docs/ELECTRON_PLAN.md) - Electron 集成计划
- [项目 README](../README.md) - 项目总体说明

---

## 🔧 脚本依赖

这些脚本需要以下 Node.js 包：

- `fs-extra` - 文件系统操作
- `adm-zip` - ZIP 文件解压（Windows）
- `zlib` - Gzip 解压（内置）
- `tar` - TAR 文件解压（macOS/Linux）

这些依赖在 `electron/package.json` 中定义：

```json
{
  "devDependencies": {
    "fs-extra": "^11.1.1",
    "adm-zip": "^0.5.10"
  }
}
```

---

## 📦 文件位置

### 安装后的文件结构

```
electron/
├── python/
│   ├── python.exe           # Windows 可执行文件
│   ├── python3              # macOS/Linux 可执行文件
│   ├── python311._pth       # Windows 路径配置
│   ├── Lib/                 # Windows 标准库
│   │   └── site-packages/   # Windows 依赖库
│   └── lib/                 # macOS/Linux 标准库
│       └── python3.11/
│           └── site-packages/ # macOS/Linux 依赖库
└── python_parser.py          # Python 解析脚本
```

---

## ✅ 安装检查清单

安装完成后，检查以下项：

- [ ] `electron/python/` 目录存在
- [ ] `python.exe` 或 `python3` 可执行文件存在
- [ ] `Lib/site-packages/` 或 `lib/python3.11/site-packages/` 目录存在
- [ ] `python-docx` 模块可以导入
- [ ] `lxml` 模块可以导入
- [ ] 应用可以正常启动
- [ ] Word 文档导入功能正常

---

**需要帮助？**

查看 [Python 环境安装指南](../docs/PYTHON_SETUP.md) 获取详细说明。
