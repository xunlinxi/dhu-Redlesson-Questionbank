#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
题库刷题系统 - 主启动文件
运行此文件启动后端服务
"""

import os
import sys
import webbrowser
import threading
import time

# 确保backend目录在路径中
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app import app


def open_browser():
    """延迟打开浏览器"""
    time.sleep(0.5)
    webbrowser.open('http://127.0.0.1:5000')


def main():
    """主函数"""
    print("=" * 50)
    print("  题库刷题系统")
    print("=" * 50)
    print()
    print("正在启动服务器...")
    print("访问地址: http://127.0.0.1:5000")
    print("按 Ctrl+C 停止服务器")
    print()
    
    # 在新线程中打开浏览器
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()
    
    # 启动Flask应用
    try:
        app.run(
            host='0.0.0.0',
            port=5000,
            debug=False,
            use_reloader=False
        )
    except KeyboardInterrupt:
        print("\n服务器已停止")


if __name__ == '__main__':
    main()
