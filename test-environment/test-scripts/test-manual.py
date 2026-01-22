#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
手动测试脚本 - 交互式测试题库解析器
支持 .txt 和 .docx 文件格式
"""

import sys
import os
import json
import time

# 设置嵌入式 Python 的路径
PYTHON_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "electron", "python", "python.exe"
)

# 后端路径
BACKEND_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "backend")
sys.path.insert(0, BACKEND_PATH)


def print_header(title):
    """打印测试标题"""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_menu(options):
    """打印菜单"""
    print("\n请选择操作:")
    for i, option in enumerate(options, 1):
        print(f"  {i}. {option}")
    print(f"  0. 退出")


def test_single_file(file_path, file_type):
    """测试单个文件"""
    print_header(f"测试 {file_type}")
    print(f"文件路径: {file_path}")

    try:
        from parser import parse_file

        start_time = time.time()
        result = parse_file(file_path, None)
        elapsed = time.time() - start_time

        questions, bank_name, semester = result

        print(f"\n✅ 解析成功！")
        print(f"   题目数量: {len(questions)}")
        print(f"   耗时: {elapsed:.3f}秒")
        print(f"   题库名: {bank_name}")
        print(f"   学期: {semester}")

        # 统计信息
        single_count = sum(1 for q in questions if q.get("type") == "single")
        multi_count = sum(1 for q in questions if q.get("type") == "multi")
        chapters = sorted(set(q.get("chapter", "") for q in questions))

        print(f"\n📊 统计信息:")
        print(f"   单选题: {single_count}")
        print(f"   多选题: {multi_count}")
        print(f"   章节: {chapters}")

        # 验证字段完整性
        all_complete = all(
            q.get("question") and q.get("options") and q.get("answer") and q.get("type")
            for q in questions
        )
        print(f"   字段完整: {'✅' if all_complete else '❌'}")

        # 打印所有题目
        print(f"\n📝 题目详情:")
        for i, q in enumerate(questions, 1):
            print(f"\n  {i}. [{q.get('type', '?')}] {q.get('question', '')[:50]}")
            print(f"     章节: {q.get('chapter', '未知')}")
            print(f"     答案: {q.get('answer', [])}")
            print(f"     选项: {list(q.get('options', {}).keys())}")

        return True

    except Exception as e:
        print(f"\n❌ 解析失败!")
        print(f"   错误: {str(e)}")
        import traceback

        traceback.print_exc()
        return False


def test_ipc_single(file_path, file_type):
    """通过 IPC 测试单个文件"""
    print_header(f"IPC 测试 {file_type}")
    print(f"文件路径: {file_path}")

    import subprocess

    python_script = os.path.join(
        os.path.dirname(__file__), "..", "..", "electron", "python_parser.py"
    )

    try:
        input_data = json.dumps(
            {"action": "parse", "file_path": file_path}, ensure_ascii=False
        )

        print(f"\n发送命令到 Python 解析器...")
        start_time = time.time()

        result = subprocess.run(
            [PYTHON_PATH, python_script],
            input=input_data,
            capture_output=True,
            text=True,
            timeout=30,
        )

        elapsed = time.time() - start_time

        if result.returncode != 0:
            print(f"\n❌ 进程错误!")
            print(f"   返回码: {result.returncode}")
            print(f"   stderr: {result.stderr}")
            return False

        try:
            response = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            print(f"\n❌ JSON 解析错误!")
            print(f"   错误: {e}")
            print(f"   原始输出: {result.stdout[:200]}...")
            return False

        print(f"\n✅ IPC 响应成功!")
        print(f"   耗时: {elapsed:.3f}秒")
        print(f"   success: {response.get('success')}")
        print(f"   题目数: {len(response.get('questions', []))}")
        print(f"   题库名: {response.get('bank_name')}")
        print(f"   学期: {response.get('semester')}")

        if response.get("success") and response.get("questions"):
            questions = response["questions"]
            print(f"\n📝 前3道题目预览:")
            for i, q in enumerate(questions[:3], 1):
                print(f"\n  {i}. {q.get('question', '')[:50]}")
                print(f"     类型: {q.get('type')}")
                print(f"     答案: {q.get('answer')}")

        return response.get("success", False)

    except subprocess.TimeoutExpired:
        print(f"\n❌ 超时!")
        print(f"   Python 进程30秒无响应")
        return False
    except Exception as e:
        print(f"\n❌ 错误!")
        print(f"   {str(e)}")
        import traceback

        traceback.print_exc()
        return False


def main():
    """主函数"""
    print("\n" + "=" * 60)
    print("  题库解析器 - 手动测试")
    print("=" * 60)

    test_files = {
        "1": ("test-files/test-simple.txt", "简单 TXT"),
        "2": ("test-files/test-complex.txt", "复杂 TXT"),
        "3": ("test-files/test-simple.docx", "简单 DOCX"),
        "4": ("test-files/test-complex.docx", "复杂 DOCX"),
        "5": ("自定义文件路径", "自定义"),
    }

    while True:
        print("\n" + "-" * 60)
        print("可用测试文件:")
        for key, (path, desc) in test_files.items():
            full_path = os.path.join(os.path.dirname(__file__), path)
            exists = "✅" if os.path.exists(full_path) else "❌"
            print(f"  {exists} {key}. {desc} ({path})")

        print_menu(
            [
                "测试简单 TXT (直接解析)",
                "测试复杂 TXT (直接解析)",
                "测试简单 DOCX (直接解析)",
                "测试复杂 DOCX (直接解析)",
                "IPC 测试简单 TXT",
                "IPC 测试简单 DOCX",
                "测试自定义文件路径",
            ]
        )

        choice = input("\n请输入选项 (0-7): ").strip()

        if choice == "0":
            print("\n👋 再见!")
            break

        elif choice in ["1", "2", "3", "4"]:
            file_map = {
                "1": "simple_txt",
                "2": "complex_txt",
                "3": "simple_docx",
                "4": "complex_docx",
            }
            file_type_map = {
                "1": "简单 TXT",
                "2": "复杂 TXT",
                "3": "简单 DOCX",
                "4": "复杂 DOCX",
            }
            file_key = file_map[choice]
            file_type = file_type_map[choice]

            file_path = os.path.join(os.path.dirname(__file__), test_files[choice][0])

            if not os.path.exists(file_path):
                print(f"\n❌ 文件不存在: {file_path}")
                continue

            test_single_file(file_path, file_type)

        elif choice == "5":
            file_path = os.path.join(
                os.path.dirname(__file__), "test-files/test-simple.txt"
            )
            if not os.path.exists(file_path):
                print(f"\n❌ 文件不存在: {file_path}")
                continue
            test_ipc_single(file_path, "简单 TXT")

        elif choice == "6":
            file_path = os.path.join(
                os.path.dirname(__file__), "test-files/test-simple.docx"
            )
            if not os.path.exists(file_path):
                print(f"\n❌ 文件不存在: {file_path}")
                continue
            test_ipc_single(file_path, "简单 DOCX")

        elif choice == "7":
            custom_path = input("请输入文件路径: ").strip().strip('"').strip("'")

            if not custom_path:
                print("\n❌ 请输入有效的文件路径")
                continue

            if not os.path.exists(custom_path):
                print(f"\n❌ 文件不存在: {custom_path}")
                continue

            file_ext = os.path.splitext(custom_path)[1].lower()
            file_type = file_ext.upper()

            test_single_file(custom_path, f"自定义 ({file_type})")

        else:
            print("\n❌ 无效选项")

        input("\n按回车键继续...")


if __name__ == "__main__":
    main()
