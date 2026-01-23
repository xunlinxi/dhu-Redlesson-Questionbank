# 安卓打包实施计划

**创建日期**: 2026-01-23  
**目标平台**: Android 7.0+ (API 24+)  
**预期产物**: APK 安装包（分发给学生使用）

---

## 一、技术方案概述

### 1.1 选型说明

采用 **Capacitor** 方案将现有 Web 应用打包为安卓应用：

```
现有 Web 应用 ──→ Capacitor 容器 ──→ Android APK
   (HTML/JS/CSS)      (原生WebView)      (原生应用)
```

**选择理由**：
- ✅ 复用现有前端代码（无需重写）
- ✅ 项目已有完善的移动端适配（mobile.css + mobile.js）
- ✅ 已有本地存储模式，支持离线使用
- ✅ 开发周期短（预计1天）
- ✅ Java 22 兼容 Capacitor 最新版本

### 1.2 项目现状分析与挑战

| 模块 | 现有状态 | 安卓适配方案 | 挑战等级 |
|------|---------|-------------|---------|
| 移动端样式 | ✅ 完整 | 直接复用 mobile.css | ⭐ |
| 本地存储 logic | ❌ 此为 Electron IPC | **需重写**: 改用 IndexedDB (Dexie.js) | ⭐⭐⭐ |
| Word 解析 (.docx) | ❌ 依赖 Python | **需重写**: 改用 mammoth.js 前端解析 | ⭐⭐⭐⭐ |
| Word 解析 (.doc) | ❌ 依赖 Win32 COM | **放弃**: 仅支持 .docx/.txt | - |
| 路由/页面逻辑 | ✅ 基于 DOM 操作 | 直接复用，需适配数据层 | ⭐⭐ |

**核心挑战**:
目前的架构严重依赖 Python (解析) 和 Node.js (存储)。安卓端是一个纯 WebView 环境，**没有 Python 和 Node.js 运行时**。
因此，必须进行 **"去后端化" (Backend-less)** 改造，将所有逻辑移至前端 JavaScript 实现。

---

## 二、环境要求确认

### 2.1 开发环境

| 工具 | 用途 |
|------|------|
| **Node.js 16+** | 运行 Capacitor CLI 及构建前端 |
| **Android Studio** | 编译最终 APK |
| Java JDK 17+ | Android 构建依赖 (AS通常自带) |

### 2.2 验证命令

请在终端执行以下命令确认环境：

```bash
# 1. 检查 Java 版本
java -version

# 2. 检查 Android SDK
echo %ANDROID_HOME%
echo %ANDROID_SDK_ROOT%

# 3. 检查 SDK Platform
sdkmanager --list | grep "platforms;android"

# 4. 检查 Node.js
node -v
npm -v
```

### 2.3 环境安装补充

如果缺少 Node.js：

```bash
# Windows 下载地址: https://nodejs.org/
# 推荐安装 LTS 版本（18.x 或 20.x）
```

---

## 三、详细实施步骤

### 阶段一：核心逻辑重构 (关键路径)

**在打包之前，必须先让前端具备独立运行能力。**

#### 3.1.1 引入必要依赖

在 `frontend/index.html` 中引入：
- `mammoth.js`: 用于在浏览器并在解析 .docx 文件
- `dexie.js`: IndexedDB 的封装库，替代文件系统存储数据

#### 3.1.2 实现前端数据层 (Storage Adapter)

创建 `frontend/js/modules/storage.js`:
- 定义 IndexedDB 数据库结构 (Questions, WrongBook, Rankings)
- 实现与 Electron IPC 接口一致的方法 (`getBanks`, `saveQuestion` 等)
- 增加 `StorageAdapter` 类，自动判断环境：
  - Electron 环境 -> 调用 IPC
  - Web/Mobile 环境 -> 调用 IndexedDB

#### 3.1.3 实现前端解析层 (Parser Adapter)

创建 `frontend/js/modules/parser.js`:
- 使用 `mammoth.extractRawText` 读取 .docx
- 移植 Python 的正则匹配逻辑到 JavaScript
- 实现纯前端的 `.txt` 解析

---

### 阶段二：Capacitor 集成（1小时）

#### 3.2.1 安装 Capacitor CLI

```bash
# 全局安装 Capacitor
npm install -g @capacitor/cli

# 验证安装
npx cap --version
```

#### 3.1.2 初始化 Capacitor 项目

```bash
cd B:\VS_Code_Project\dhu-Redlesson-Questionbank

# 初始化（交互式）
npx cap init "东华红课题库刷题系统" \
    --web-dir frontend \
    --app-id com.dhu.quiz.app

# 或使用命令行参数
npx cap init "东华红课题库刷题系统" \
    --web-dir frontend \
    --app-id com.dhu.quiz.app \
    --skip-git
```

**参数说明**：
- `web-dir`: 前端代码目录（相对路径）
- `app-id`: 应用唯一标识（包名格式）
- `skip-git`: 跳过 git 操作

#### 3.1.3 生成的项目结构

```
dhu-Redlesson-Questionbank/
├── android/                              # Android 原生项目
│   ├── app/
│   │   ├── src/
│   │   │   ├── main/
│   │   │   │   ├── java/com/dhu/quiz/app/
│   │   │   │   ├── res/
│   │   │   │   └── AndroidManifest.xml
│   │   │   └── ...
│   │   ├── build.gradle
│   │   └── proguard-rules.pro
│   ├── build.gradle
│   ├── settings.gradle
│   ├── gradle.properties
│   ├── local.properties
│   └── ...
├── capacitor.config.ts                   # Capacitor 配置
├── capacitor.config.json                 # Capacitor 缓存
├── ios/                                  # iOS 项目（可选）
│   └── ...
└── frontend/                             # 现有前端代码
    ├── index.html
    ├── js/
    └── css/
```

---

### 阶段二：图标资源准备（30分钟）

#### 3.2.1 图标转换

将 `electron/assets/icon.ico` 转换为 PNG 格式的安卓图标：

**方法一：使用在线工具**
1. 访问 https://convertio.co/ico-png/
2. 上传 icon.ico
3. 下载转换后的 PNG

**方法二：使用 Python（推荐）**

```bash
# 安装 Pillow
pip install Pillow

# 创建图标转换脚本
python -c "
from PIL import Image
import os

ico_path = 'electron/assets/icon.ico'
sizes = [48, 72, 96, 144, 192]

img = Image.open(ico_path)
output_dir = 'android/app/src/main/res'

for size in sizes:
    resized = img.resize((size, size), Image.LANCZOS)
    mipmap_dir = f'{output_dir}/mipmap-{"mdpi" if size==48 else "hdpi" if size==72 else "xhdpi" if size==96 else "xxhdpi" if size==144 else "xxxhdpi"}'
    os.makedirs(mipmap_dir, exist_ok=True)
    resized.save(f'{mipmap_dir}/ic_launcher.png')
    print(f'Generated {size}x{size} icon')

print('Icons generated successfully!')
"
```

#### 3.2.2 图标文件放置

```
android/app/src/main/res/
├── mipmap-mdpi/      # 48x48
│   └── ic_launcher.png
├── mipmap-hdpi/      # 72x72
│   └── ic_launcher.png
├── mipmap-xhdpi/     # 96x96
│   └── ic_launcher.png
├── mipmap-xxhdpi/    # 144x144
│   └── ic_launcher.png
├── mipmap-xxxhdpi/   # 192x192
│   └── ic_launcher.png
└── ...
```

---

### 阶段三：PWA 离线支持（30分钟）

#### 3.3.1 创建 Service Worker

创建 `frontend/sw.js`：

```javascript
const CACHE_NAME = 'quiz-app-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/css/mobile.css',
    '/js/app.js',
    '/js/mobile.js'
];

// 安装 Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// 激活 Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 拦截网络请求
self.addEventListener('fetch', (event) => {
    // 对于 API 请求，使用网络优先策略
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    // 网络失败时返回空响应
                    return new Response(JSON.stringify({
                        success: false,
                        error: '网络连接失败'
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }

    // 对于静态资源，使用缓存优先策略
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .then((response) => {
                        // 不缓存非成功响应
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // 克隆响应
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    });
            })
    );
});
```

#### 3.3.2 创建 Web App Manifest

创建 `frontend/manifest.json`：

```json
{
    "name": "东华红课题库刷题系统",
    "short_name": "红课题库",
    "description": "大学政治课程题库刷题系统",
    "start_url": "/",
    "display": "standalone",
    "orientation": "portrait",
    "background_color": "#ffffff",
    "theme_color": "#4a90d9",
    "icons": [
        {
            "src": "/assets/icon-192.png",
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "any maskable"
        },
        {
            "src": "/assets/icon-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "any maskable"
        }
    ],
    "categories": ["education", "productivity"],
    "lang": "zh-CN"
}
```

#### 3.3.3 更新 index.html

在 `<head>` 标签中添加：

```html
<!-- PWA 支持 -->
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#4a90d9">
<meta name="description" content="东华红课题库刷题系统 - 大学政治课程刷题利器">
<link rel="apple-touch-icon" href="/assets/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

在 `<body>` 末尾添加：

```html
<!-- Service Worker 注册 -->
<script>
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('SW registered: ', registration);
                })
                .catch((registrationError) => {
                    console.log('SW registration failed: ', registrationError);
                });
        });
    }
</script>
```

---

### 阶段四：安卓专项配置（30分钟）

#### 3.4.1 AndroidManifest.xml 配置

修改 `android/app/src/main/AndroidManifest.xml`：

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.dhu.quiz.app">

    <!-- 网络权限 -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|uiMode"
            android:exported="true"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

#### 3.4.2 strings.xml 配置

创建 `android/app/src/main/res/values/strings.xml`：

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">红课题库</string>
</resources>
```

#### 3.4.3 themes.xml 配置

创建 `android/app/src/main/res/values/themes.xml`：

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:statusBarColor">#4a90d9</item>
        <item name="android:navigationBarColor">#ffffff</item>
        <item name="android:windowLightStatusBar">false</item>
    </style>
</resources>
```

---

### 阶段五：首次构建测试（1小时）

#### 3.5.1 同步代码

```bash
# 同步前端代码到 Android 项目
npx cap sync
```

#### 3.5.2 Android Studio 构建

```bash
# 用 Android Studio 打开项目
npx cap open android
```

在 Android Studio 中：

1. **首次打开会提示 Gradle 同步**，等待完成
2. 点击 **Build > Build Bundle(s) / APK(s) > Build APK(s)**
3. 等待构建完成
4. 在 **Build > Build Analyzer** 中查看构建报告

#### 3.5.3 安装测试

```bash
# 方式1：数据线连接手机
adb install android/app/build/outputs/apk/debug/app-debug.apk

# 方式2：如果已安装旧版本，先卸载
adb uninstall com.dhu.quiz.app
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

#### 3.5.4 测试清单

| 测试项 | 预期结果 | 实际结果 |
|-------|---------|---------|
| 启动应用 | 正常启动，显示首页 | |
| 加载题库 | 显示已有题库数据 | |
| 开始刷题 | 进入刷题界面 | |
| 答题功能 | 选择答案并提交 | |
| 错题本 | 查看错题记录 | |
| 排行榜 | 查看成绩排名 | |
| 断网测试 | 离线可继续使用 | |
| 横竖屏 | 界面正常显示 | |

---

### 阶段六：签名配置（30分钟）

#### 3.6.1 生成签名密钥

```bash
# 生成密钥库
keytool -genkey -v \
    -keystore release.keystore \
    -alias dhu-quiz \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000

# 输入密钥信息（示例）
# 密钥库密码: dhuquiz2024
# 密钥密码: dhuquiz2024
# 姓名: DHU
# 组织: East China University of Science and Technology
# 城市: Shanghai
# 省份: Shanghai
# 国家代码: CN
```

**重要**：请妥善保管 `release.keystore` 文件，丢失后无法更新应用！

#### 3.6.2 配置签名信息

创建 `android/key.properties`：

```properties
storeFile=release.keystore
storePassword=你的密钥库密码
keyAlias=dhu-quiz
keyPassword=你的密钥密码
```

修改 `android/app/build.gradle`：

```gradle
android {
    signingConfigs {
        release {
            keyPassword = keyPassword
            storeFile file(storeFile)
            storePassword storePassword
            keyAlias keyAlias
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true

            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

修改 `android/build.gradle`：

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }

    defaultConfig {
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
    }
}
```

---

### 阶段七：Release 构建（30分钟）

#### 3.7.1 构建 Release APK

在 Android Studio 中：

1. **Build > Generate Signed Bundle(s) / APK(s)**
2. 选择 **APK**
3. 选择或创建 **Key store**
4. 填写密钥密码
5. 点击 **Next**
6. 选择 **release** build variant
7. 点击 **Create**

#### 3.7.2 构建配置优化

修改 `android/app/build.gradle`：

```gradle
android {
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true

            buildConfigField "boolean", "IS_RELEASE", "true"

            packagingOptions {
                resources {
                    excludes += '/META-INF/{AL2.0,LGPL2.1}'
                }
            }
        }
    }

    // 优化 APK 大小
    aaptOptions {
        noCompress 'html', 'css', 'js'
    }
}
```

#### 3.7.3 产物位置

```
android/app/build/outputs/apk/release/
├── app-release.apk          # 主APK（包含所有CPU架构）
└── app-release-unsigned.apk # 未签名版本（用于验证）

# 推荐产物
android/app/build/outputs/bundle/release/
└── app-release.aab          # Android App Bundle（推荐用于分发）
```

---

## 四、分发方案

### 4.1 分发方式对比

| 方式 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **APK文件** | 直接安装，无需商店 | 需要手动开启安装权限 | ✅ 推荐 |
| **App Bundle** | 按需下载，体积小50% | 需要上架商店或使用Play Core | 上架商店 |
| **网盘分享** | 传播方便 | 无法自动更新 | 学生分发 |

### 4.2 推荐分发流程

#### 步骤一：生成安装包

```bash
# 构建 Release APK
npx cap sync
npx cap open android

# 在 Android Studio 中执行 Build > Generate Signed APK
```

#### 步骤二：准备分发材料

```
分发目录/
├── 红课题库_v1.0.0_安卓版/
│   ├── app-release.apk              # 主安装包（约30MB）
│   ├── install-guide.pdf            # 安装指南
│   └── 版本说明.txt                  # 更新日志
```

#### 步骤三：安装指南

创建 `install-guide.pdf` 或 `安装指南.txt`：

```
【东华红课题库 安卓版安装指南】

一、安装步骤
1. 复制 APK 文件到手机
2. 打开文件管理器，找到 APK 文件
3. 点击安装

二、注意事项
1. 首次安装可能提示"未知来源"，请选择"仍要安装"
2. 安装完成后即可卸载此安装包

三、功能说明
1. 离线刷题：无需联网即可使用
2. 错题本：自动记录做错的题目
3. 成绩排名：查看刷题成绩

四、常见问题
Q: 安装后无法打开？
A: 请确保手机系统为 Android 7.0 及以上版本

Q: 数据会丢失吗？
A: 不会，数据保存在手机本地
```

### 4.3 版本管理规范

```
版本号格式：主版本.次版本.修订版本
- 主版本(1)：重大功能更新
- 次版本(0)：功能优化
- 修订版本(0)：bug修复

示例：
v1.0.0 - 首次发布
v1.0.1 - 修复安装问题
v1.1.0 - 添加新功能
v2.0.0 - 重大版本更新
```

---

## 五、项目文件清单

### 5.1 新增文件

```
新增文件：
├── capacitor.config.ts              # Capacitor 配置
├── android/                         # Android 项目
│   ├── app/src/main/AndroidManifest.xml
│   ├── app/src/main/res/values/strings.xml
│   ├── app/src/main/res/values/themes.xml
│   ├── app/src/main/res/mipmap-*/
│   │   └── ic_launcher.png
│   └── ...
├── frontend/
│   ├── sw.js                        # Service Worker（新增）
│   ├── manifest.json                # PWA Manifest（新增）
│   └── assets/                      # 图标资源（新增）
│       ├── icon-192.png
│       └── icon-512.png
└── release.keystore                 # 签名密钥（手动生成）

修改文件：
├── frontend/index.html              # 添加 PWA 支持
└── electron/package.json            # 可选：添加 Android 打包命令
```

### 5.2 更新 .gitignore

```
# Android
android/.gradle/
android/build/
android/app/build/
*.apk
*.aab
*.keystore
key.properties

# Capacitor
android/.idea/
ios/.idea/
```

---

## 六、时间规划

### 6.1 各阶段时间

| 阶段 | 时长 | 主要任务 |
|------|------|---------|
| 环境准备 | 30分钟 | 检查 Java、Android SDK、Node.js |
| 项目初始化 | 30分钟 | 安装 Capacitor、初始化项目 |
| 图标准备 | 30分钟 | 转换图标格式、放置到正确目录 |
| PWA 支持 | 30分钟 | 创建 Service Worker、Manifest |
| 安卓配置 | 30分钟 | AndroidManifest、主题配置 |
| 首次构建 | 1小时 | Sync、Build、测试安装 |
| 签名配置 | 30分钟 | 生成签名、配置 Gradle |
| Release 构建 | 30分钟 | 构建正式版 APK |
| **总计** | **4小时** | 当天可完成 |

### 6.2 里程碑

| 时间节点 | 里程碑 |
|---------|-------|
| T+30min | 环境检查完成 |
| T+1h | 项目初始化完成 |
| T+2h | 图标和 PWA 支持完成 |
| T+3h | 首次构建完成并测试通过 |
| T+4h | Release APK 生成完成 |

---

## 七、后续优化建议

### 7.1 功能增强（可选）

| 优先级 | 功能 | 说明 |
|-------|------|------|
| P0 | 自动更新 | 检测新版本并提示更新 |
| P1 | 题库导入 | 支持从手机导入 .txt 题库 |
| P1 | 云同步 | 支持多设备数据同步（需服务器） |
| P2 | 深色模式 | 系统级深色主题支持 |
| P2 | 统计报表 | 刷题数据统计分析 |

### 7.2 性能优化（可选）

| 优化项 | 预期收益 |
|-------|---------|
| 资源压缩 | 减小 APK 体积 20% |
| 代码分割 | 减少首次加载时间 |
| 图片优化 | 进一步减小体积 |
| 预加载策略 | 提升页面切换速度 |

---

## 八、风险与应对

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| Java 版本不兼容 | 低 | 高 | 使用 Java 17，或配置 Gradle JDK |
| SDK 版本过低 | 低 | 高 | 升级 Android SDK Platform |
| APK 体积过大 | 中 | 低 | 开启 ProGuard 压缩 |
| 安装失败 | 中 | 中 | 准备详细安装指南 |
| 签名丢失 | 极低 | 极高 | 备份 keystore 文件 |

---

## 九、参考文档

- Capacitor 官方文档: https://capacitorjs.com/docs
- Android 构建配置: https://developer.android.com/studio/build
- Gradle 配置: https://gradle.org/install/
- keytool 使用: https://docs.oracle.com/javase/8/docs/technotes/tools/unix/keytool.html

---

## 附录：快速命令速查表

```bash
# 开发调试
npm run android:dev        # 开发模式（需连接手机）
npx cap sync               # 同步前端代码
npx cap open android       # 打开 Android Studio

# 构建发布
npx cap build              # 构建 Debug 版本
npx cap build --release    # 构建 Release 版本

# 安装测试
adb install app.apk        # 安装 APK
adb uninstall com.dhu.quiz.app  # 卸载应用
adb logcat | findstr "com.dhu.quiz.app"  # 查看日志

# 签名相关
keytool -genkey -v -keystore release.keystore -alias dhu-quiz -keyalg RSA -keysize 2048 -validity 10000
```

---

**文档版本**: v1.0  
**最后更新**: 2026-01-23  
**计划执行人**: AI Assistant
