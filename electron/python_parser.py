#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Python Word 文档解析器
通过 stdin/stdout 与 Electron 通信
"""

import sys
import json
import os

# 添加 backend 目录到路径
backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_dir)

from parser import parse_file

def parse_document(file_path):
    """
    解析文档文件
    返回: {questions, bank_name, semester}
    """
    try:
        result = parse_file(file_path, None)
        questions = result[0]
        bank_name = result[1]
        semester = result[2] if len(result) > 2 else ''

        return {
            'success': True,
            'questions': questions,
            'bank_name': bank_name,
            'semester': semester
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def main():
    """
    主函数：从 stdin 读取 JSON，处理后输出到 stdout
    """
    # 读取输入
    input_data = sys.stdin.read().strip()

    if not input_data:
        return

    try:
        data = json.loads(input_data)

        if data.get('action') == 'parse':
            file_path = data.get('file_path')
            result = parse_document(file_path)
            print(json.dumps(result, ensure_ascii=False))
        else:
            print(json.dumps({'success': False, 'error': 'Unknown action'}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))

if __name__ == '__main__':
    main()
