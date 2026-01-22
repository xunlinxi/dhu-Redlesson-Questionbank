# Python 环境安装 - 快速开始

## 🚀 一键安装（推荐）

### Windows 用户

```bash
# 1. 进入 electron 目录
cd electron

# 2. 安装 Node.js 依赖
npm install

# 3. 一键安装 Python 环境
npm run setup-python
```

等待 10-15 分钟，看到以下输出表示成功：

```
✅ Python Embedded 安装成功！
✅ python-docx: OK
✅ lxml: OK
```

### macOS 用户

macOS 需要先安装系统 Python：

```bash
# 安装 Homebrew（如果还没有）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Python 3.11
brew install python@3.11

# 安装依赖库
pip3.11 install python-docx lxml
```

## ✅ 验证安装

### Windows

```bash
cd electron
.\python\python.exe --version
```

应该输出：`Python 3.11.7`

### macOS

```bash
python3.11 --version
```

应该输出：`Python 3.11.7`

## 🎯 启动应用

```bash
cd electron
npm start
```

应用启动后，尝试导入一个 Word 文档，确认 Python 解析功能正常。

---

## 📋 分步安装（如果一键安装失败）

### 步骤 1：下载 Python 解释器

```bash
cd electron
npm run install-python
```

### 步骤 2：安装依赖库

```bash
cd electron
npm run install-libs
```

## 🔧 常见问题

### 问题 1：npm install 失败

**解决**：

```bash
# 清理缓存
npm cache clean --force

# 重新安装
rm -rf node_modules
npm install
```

### 问题 2：下载 Python 失败

**解决**：

1. 检查网络连接
2. 尝试使用代理
3. 手动下载后解压到 `electron/python/`

### 问题 3：macOS 权限问题

**解决**：

```bash
# 添加执行权限
chmod +x electron/python/bin/python3
```

---

## 📚 详细文档

- [Python 环境安装指南](PYTHON_SETUP.md) - 完整安装说明
- [脚本使用说明](../scripts/README.md) - 脚本详细文档

---

**安装成功后，返回 [Electron 计划](ELECTRON_PLAN.md) 继续下一步。**
