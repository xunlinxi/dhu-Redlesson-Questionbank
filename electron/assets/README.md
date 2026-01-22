# Electron 资源目录

本目录存放 Electron 应用所需的资源文件。

## 目录结构

```
assets/
├── icon.ico          # Windows 图标 (256x256)
├── icon.icns         # macOS 图标 (512x512)
├── entitlements.mac.plist  # macOS 权限配置
└── icons/            # PWA 图标
    ├── icon-72x72.png
    ├── icon-96x96.png
    ├── icon-128x128.png
    ├── icon-144x144.png
    ├── icon-152x152.png
    ├── icon-192x192.png
    ├── icon-384x384.png
    └── icon-512x512.png
```

## 图标要求

### Windows (icon.ico)
- 尺寸: 256x256
- 格式: ICO
- 包含多种尺寸: 16, 32, 48, 64, 128, 256

### macOS (icon.icns)
- 尺寸: 512x512
- 格式: ICNS
- 包含多种尺寸: 16, 32, 64, 128, 256, 512

### PWA 图标
- 所有图标应为 PNG 格式
- 透明背景可选（推荐不透明）
- 颜色应与应用主题一致

## 生成图标

### Windows
使用以下工具生成 icon.ico:
- IcoFX
- Online converter: https://convertico.com/

### macOS
使用以下工具生成 icon.icns:
- Image2icon
- iconutil (macOS 内置工具)
```bash
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
iconutil -c icns icon.iconset
```
