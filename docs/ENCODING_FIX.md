# 编码问题修复说明

## 问题描述

Android 版本（以及 Web 版本）在导入题库时，如果使用 GBK/GB2312 编码的 TXT 文件，会出现乱码问题。这是因为原来的代码硬编码使用 UTF-8 解码所有文件。

## 修复内容

### 修改文件
- `platforms/android/frontend/js/modules/parser.js`
- `platforms/web/frontend/js/modules/parser.js`

### 核心改进

#### 1. 智能编码检测流程
```
文件读取 → ArrayBuffer → 编码检测 → 文本解码
```

#### 2. 编码检测优先级
1. **检查 BOM (Byte Order Mark)** - UTF-8 文件可能带 BOM 标记 (0xEF 0xBB 0xBF)
2. **尝试 UTF-8 解码** - 验证解码结果是否包含有效中文字符
3. **尝试 GBK 解码** - 国内 Windows 系统默认编码
4. **尝试 GB2312 解码** - 简体中文字符集
5. **后备方案** - 如果都失败，返回 UTF-8 解码结果（可能包含乱码）

#### 3. 有效性验证算法
- 检查文本中是否包含足够多的中文字符（≥ 5 个）
- 检查有效字符比例（> 50%）
- 有效字符包括：中文、英文、数字、常见标点符号

### 技术细节

#### TextDecoder API
使用浏览器原生的 `TextDecoder` API：
```javascript
const decoder = new TextDecoder(encoding, { fatal: false });
const text = decoder.decode(uint8Array);
```

**支持的编码：**
- `utf-8` - 通用编码
- `gbk` - 简体中文（Windows 默认）
- `gb2312` - 简体中文（老标准）

#### 兼容性
- ✅ Android WebView 5.0+
- ✅ Chrome 38+
- ✅ Firefox 19+
- ✅ Safari 10.1+
- ✅ Edge 79+

## 测试方法

### 1. 准备测试文件

创建不同编码的 TXT 测试文件：

**测试文件内容：**
```
一、单项选择题

1、中国特色社会主义最本质的特征是（A）
A. 中国共产党领导
B. 社会主义制度
C. 人民民主专政
D. 改革开放

2、习近平新时代中国特色社会主义思想的核心要义是（ABC）
A. 坚持和发展中国特色社会主义
B. 以人民为中心
C. 全面深化改革
D. 坚持依法治国
```

**编码转换方法：**

**Windows (Notepad):**
- 保存时选择编码：UTF-8 / ANSI (GBK)

**Python 脚本:**
```python
# 创建 GBK 编码文件
with open('test_gbk.txt', 'w', encoding='gbk') as f:
    f.write(content)

# 创建 UTF-8 编码文件
with open('test_utf8.txt', 'w', encoding='utf-8') as f:
    f.write(content)

# 创建 UTF-8 with BOM 文件
with open('test_utf8_bom.txt', 'w', encoding='utf-8-sig') as f:
    f.write(content)
```

### 2. Android 设备测试

1. **同步代码到 Android 项目**
   ```bash
   cd platforms/android
   npx cap sync android
   ```

2. **Android Studio 打包 APK**
   - 打开 `platforms/android/android/` 目录
   - Build > Build Bundle(s) / APK(s) > Build APK(s)

3. **安装测试**
   - 安装 APK 到 Android 设备
   - 导入不同编码的测试文件
   - 查看控制台日志确认使用的编码

### 3. Web 版本测试

1. **启动服务**
   ```bash
   cd platforms/web
   python main.py
   ```

2. **测试导入**
   - 访问 http://localhost:50000
   - 进入题库管理页面
   - 导入不同编码的测试文件

### 4. 验证成功标志

- ✅ 控制台显示 `"使用 GBK 解码成功"` 或 `"使用 UTF-8 解码成功"`
- ✅ 题目内容正确显示，无乱码
- ✅ 答案解析正确，选项完整
- ✅ 章节信息正确提取

## 常见问题

### Q1: GBK 解码失败怎么办？
**A:** 现代浏览器都支持 `TextDecoder` 的 GBK 解码。如果失败，请检查：
- 浏览器版本是否过旧
- Android WebView 版本是否低于 5.0

### Q2: 如何确认文件使用了什么编码？
**A:** 使用工具检查：
- Windows: Notepad++ → 编码菜单
- VS Code: 右下角显示编码
- Python: `chardet` 库

### Q3: 为什么不直接尝试所有编码？
**A:** 性能考虑。优先使用最可能的编码（UTF-8），失败后再尝试其他编码。

### Q4: 如果还是乱码怎么办？
**A:** 可能原因：
- 文件本身已损坏
- 使用了非常罕见的编码（如 Big5、UTF-16）
- 建议转换为 UTF-8 格式后再导入

## 相关资源

- [TextDecoder API 文档](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder)
- [字符编码对照表](https://www.w3.org/International/articles/resource-tags/)
- [编码转换工具](https://cloudconvert.com/txt-to-utf8)

## 更新日期

2026-02-06
