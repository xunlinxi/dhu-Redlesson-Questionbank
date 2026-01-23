#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Python Word 文档解析器
通过 stdin/stdout 与 Electron 通信
"""

import sys
import json
import os

# 添加脚本目录到 sys.path 开头（解决打包后导入失败问题）
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

# 显式添加 site-packages (解决 Windows 嵌入式 Python 忽略 PYTHONPATH 的问题)
# 在打包后的结构中:
# script_dir/ (含有 python_parser.py)
#   python/
#     Lib/
#       site-packages/
embedded_site_packages = os.path.join(script_dir, 'python', 'Lib', 'site-packages')
if os.path.exists(embedded_site_packages):
    if embedded_site_packages not in sys.path:
        sys.path.insert(0, embedded_site_packages)
    
    # 同时添加 pip 安装的 .pth 文件路径支持 (如 win32com 等)
    import site
    site.addsitedir(embedded_site_packages)

# 导入 parser 模块（直接导入当前目录的 backend_parser.py）
try:
    from backend_parser import parse_file
except ImportError as e:
    # 捕获导入错误并打印到 stderr (Electron 可以捕获)
    sys.stderr.write(f"Error importing backend_parser or dependencies: {e}\n")
    sys.stderr.write(f"sys.path: {sys.path}\n")
    sys.exit(1)

# 强制重新配置 stdin/stdout 为 utf-8 (双重保险，配合 Electron 端的环境变量)
try:
    if hasattr(sys.stdin, 'reconfigure'):
        sys.stdin.reconfigure(encoding='utf-8')
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
except Exception as e:
    sys.stderr.write(f"Warning: Failed to reconfigure sys.stdin/stdout encoding: {e}\n")

def parse_document(file_path):
    """
    解析文档文件
    返回: {questions, bank_name, semester}
    """
    try:
        result = parse_file(file_path, None)
        questions = result[0]
        bank_name = result[1]
        semester = result[2] if len(result) > 2 else ""

        return {
            "success": True,
            "questions": questions,
            "bank_name": bank_name,
            "semester": semester,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def main():
    """
    主函数：持续监听 stdin，处理多个解析请求
    """
    # 持续监听循环
    while True:
        try:
            # 读取一行输入（而不是 read()）
            line = sys.stdin.readline()

            if not line:
                # EOF 或连接断开，退出循环
                break

            line = line.strip()
            if not line:
                continue

            # 解析 JSON
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                print(
                    json.dumps({"success": False, "error": "Invalid JSON"}), flush=True
                )
                continue

            # 处理命令
            if data.get("action") == "parse":
                file_path = data.get("file_path")
                result = parse_document(file_path)
                print(json.dumps(result, ensure_ascii=False), flush=True)
            elif data.get("action") == "exit":
                # 退出命令
                break
            else:
                print(
                    json.dumps({"success": False, "error": "Unknown action"}),
                    flush=True,
                )

        except Exception as e:
            # 捕获所有异常，确保进程不会崩溃
            print(json.dumps({"success": False, "error": str(e)}), flush=True)
            # 打印到 stderr 便于调试
            import traceback

            traceback.print_exc()


if __name__ == "__main__":
    main()
