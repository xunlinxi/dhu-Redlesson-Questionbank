#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
题库刷题系统 - 主启动文件
运行此文件启动后端服务
"""

import os
import sys
import socket
import webbrowser
import threading
import time

# 确保backend目录在路径中
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app import app


def get_all_ips():
    """获取本机所有网络接口的IP地址"""
    ips = []
    try:
        # 获取主机名
        hostname = socket.gethostname()
        # 获取所有IP地址
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ips and not ip.startswith('127.'):
                ips.append(ip)
    except Exception:
        pass
    
    # 如果没有找到，尝试另一种方法
    if not ips:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            if ip not in ips:
                ips.append(ip)
        except Exception:
            pass
    
    return ips if ips else ["127.0.0.1"]


def open_browser():
    """延迟打开浏览器"""
    time.sleep(0.5)
    webbrowser.open('http://localhost:50000')


def main():
    """主函数"""
    all_ips = get_all_ips()
    
    print("=" * 60)
    print("  题库刷题系统")
    print("=" * 60)
    print("正在启动服务器...")
    print("本机访问地址: http://127.0.0.1:50000")
    print("-" * 60)
    print("【局域网/热点访问地址】")
    for ip in all_ips:
        # 判断网络类型
        if ip.startswith('192.168.137.') or ip.startswith('192.168.43.'):
            network_type = "(热点网络)"
        elif ip.startswith('192.168.'):
            network_type = "(WiFi/局域网)"
        elif ip.startswith('10.'):
            network_type = "(内网)"
        elif ip.startswith('172.'):
            network_type = "(内网)"
        else:
            network_type = ""
        print(f"  http://{ip}:50000 {network_type}")
    print("=" * 60)
    print("【手机/其他设备无法访问？】")
    print("  请以管理员身份运行 setup_firewall.bat 配置防火墙")
    print("=" * 60)
    print("按 Ctrl+C 停止服务器")
    
    # 在新线程中打开浏览器
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()
    
    # 启动Flask应用
    try:
        app.run(
            host='0.0.0.0',
            port=50000,
            debug=False,
            use_reloader=False,
            threaded=True
        )
    except KeyboardInterrupt:
        print("\n服务器已停止")


if __name__ == '__main__':
    main()
