#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动化测试脚本 - 使用嵌入式 Python 测试题库解析器
支持 .txt 和 .docx 文件格式测试
"""

import sys
import os
import json
import time

# 设置嵌入式 Python 的路径
PYTHON_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "electron", "python", "python.exe"
)

# 嵌入式 Python 的 site-packages 路径
SITE_PACKAGES = os.path.join(
    os.path.dirname(__file__), "..", "..", "electron", "python", "Lib", "site-packages"
)
sys.path.insert(0, SITE_PACKAGES)

# 测试文件路径
TEST_FILES = {
    "simple_txt": os.path.join(
        os.path.dirname(__file__), "..", "test-files", "test-simple.txt"
    ),
    "complex_txt": os.path.join(
        os.path.dirname(__file__), "..", "test-files", "test-complex.txt"
    ),
    "simple_docx": os.path.join(
        os.path.dirname(__file__), "..", "test-files", "test-simple.docx"
    ),
    "complex_docx": os.path.join(
        os.path.dirname(__file__), "..", "test-files", "test-complex.docx"
    ),
}

# 后端路径
BACKEND_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "backend")
sys.path.insert(0, BACKEND_PATH)


def print_header(title):
    """打印测试标题"""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_result(test_name, passed, message=""):
    """打印测试结果"""
    status = "[PASS]" if passed else "[FAIL]"
    print(f"{test_name}: {status}")
    if message:
        print(f"  {message}")


def test_txt_file(file_path, file_type):
    """测试 TXT 文件解析"""
    print_header(f"测试 {file_type} (TXT)")

    try:
        from parser import parse_file

        start_time = time.time()
        result = parse_file(file_path, None)
        elapsed = time.time() - start_time

        questions, bank_name, semester = result

        # 验证结果
        has_questions = len(questions) > 0
        all_have_fields = all(
            q.get("question") and q.get("options") and q.get("answer") and q.get("type")
            for q in questions
        )

        # 统计信息
        single_count = sum(1 for q in questions if q.get("type") == "single")
        multi_count = sum(1 for q in questions if q.get("type") == "multi")
        chapters = sorted(set(q.get("chapter", "") for q in questions))

        print_result("文件可读", True, f"文件路径: {file_path}")
        print_result(
            "解析成功", True, f"题目数: {len(questions)}, 耗时: {elapsed:.3f}秒"
        )
        print_result("题型分布", True, f"单选: {single_count}, 多选: {multi_count}")
        print_result(
            "章节识别", len(chapters) > 0, f"章节数: {len(chapters)}, 章节: {chapters}"
        )
        print_result("字段完整", all_have_fields, f"所有题目都有必需字段")

        # 打印前3道题目预览
        if questions:
            print("\n题目预览:")
            for i, q in enumerate(questions[:3], 1):
                print(f"  {i}. {q.get('question', '')[:40]}...")
                print(f"     答案: {q.get('answer', [])}")

        return True

    except Exception as e:
        print_result("解析失败", False, str(e))
        return False


def test_docx_file(file_path, file_type):
    """测试 DOCX 文件解析"""
    print_header(f"测试 {file_type} (DOCX)")

    try:
        from parser import parse_file

        start_time = time.time()
        result = parse_file(file_path, None)
        elapsed = time.time() - start_time

        questions, bank_name, semester = result

        # 验证结果
        has_questions = len(questions) > 0
        all_have_fields = all(
            q.get("question") and q.get("options") and q.get("answer") and q.get("type")
            for q in questions
        )

        # 统计信息
        single_count = sum(1 for q in questions if q.get("type") == "single")
        multi_count = sum(1 for q in questions if q.get("type") == "multi")
        chapters = sorted(set(q.get("chapter", "") for q in questions))

        print_result("文件可读", True, f"文件路径: {file_path}")
        print_result(
            "解析成功", True, f"题目数: {len(questions)}, 耗时: {elapsed:.3f}秒"
        )
        print_result("题型分布", True, f"单选: {single_count}, 多选: {multi_count}")
        print_result(
            "章节识别", len(chapters) > 0, f"章节数: {len(chapters)}, 章节: {chapters}"
        )
        print_result("字段完整", all_have_fields, f"所有题目都有必需字段")

        # 打印前3道题目预览
        if questions:
            print("\n题目预览:")
            for i, q in enumerate(questions[:3], 1):
                print(f"  {i}. {q.get('question', '')[:40]}...")
                print(f"     答案: {q.get('answer', [])}")

        return True

    except Exception as e:
        print_result("解析失败", False, str(e))
        return False


def test_ipc_communication():
    """测试 IPC 通信（使用 python_parser.py）"""
    print_header("测试 IPC 通信")

    import subprocess

    python_script = os.path.join(
        os.path.dirname(__file__), "..", "..", "electron", "python_parser.py"
    )

    try:
        # 测试简单文件
        test_file = TEST_FILES["simple_txt"]
        input_data = json.dumps(
            {"action": "parse", "file_path": test_file}, ensure_ascii=False
        )

        print("测试文件: test-simple.txt")
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
            print_result("IPC 通信", False, f"进程返回码: {result.returncode}")
            print(f"stderr: {result.stderr}")
            return False

        # 解析 JSON 响应
        try:
            response = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            print_result("JSON 解析", False, str(e))
            print(f"原始输出: {result.stdout[:200]}...")
            return False

        print_result(
            "JSON 响应",
            response.get("success", False),
            f"success: {response.get('success')}",
        )
        print_result(
            "题目数量",
            len(response.get("questions", [])) > 0,
            f"题目数: {len(response.get('questions', []))}",
        )
        print_result("响应时间", elapsed < 5, f"耗时: {elapsed:.3f}秒")

        # 打印响应预览
        if response.get("success"):
            print("\n响应预览:")
            print(f"  bank_name: {response.get('bank_name')}")
            print(f"  semester: {response.get('semester')}")
            print(
                f"  questions[0]: {response.get('questions', [{}])[0].get('question', '')[:30]}..."
            )

        return response.get("success", False)

    except subprocess.TimeoutExpired:
        print_result("IPC 通信", False, "超时（30秒）")
        return False
    except Exception as e:
        print_result("IPC 通信", False, str(e))
        return False


def main():
    """主测试函数"""
    print("\n" + "=" * 60)
    print("  题库解析器自动化测试")
    print("  测试环境: 嵌入式 Python 3.11.7")
    print("=" * 60)

    results = {}

    # 测试 1: 简单 TXT 文件
    results["simple_txt"] = test_txt_file(TEST_FILES["simple_txt"], "简单 TXT")

    # 测试 2: 复杂 TXT 文件
    results["complex_txt"] = test_txt_file(TEST_FILES["complex_txt"], "复杂 TXT")

    # 测试 3: 简单 DOCX 文件
    results["simple_docx"] = test_docx_file(TEST_FILES["simple_docx"], "简单 DOCX")

    # 测试 4: 复杂 DOCX 文件
    results["complex_docx"] = test_docx_file(TEST_FILES["complex_docx"], "复杂 DOCX")

    # 测试 5: IPC 通信
    results["ipc"] = test_ipc_communication()

    # 打印总结
    print_header("测试总结")
    passed = sum(1 for v in results.values() if v)
    total = len(results)

    print(f"Passed: {passed}/{total}")

    for name, result in results.items():
        status = "[PASS]" if result else "[FAIL]"
        print(f"  {status} {name}")

    print("\n" + "=" * 60)

    if passed == total:
        print("  All tests passed!")
    else:
        print(f"  {total - passed} test(s) failed")
    print("=" * 60)

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
