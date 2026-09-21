import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'web'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.parser import parse_file

FILES_DIR = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'resources', 'question-banks')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'data')
PRESET_FILE = os.path.join(OUTPUT_DIR, 'preset.json')

def main():
    if not os.path.isdir(FILES_DIR):
        print(f"题库目录不存在: {FILES_DIR}")
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    all_banks = {}

    for fname in os.listdir(FILES_DIR):
        if not fname.lower().endswith('.txt'):
            continue

        fpath = os.path.join(FILES_DIR, fname)
        print(f"解析: {fname}")

        try:
            questions, bank_name, semester = parse_file(fpath)
            print(f"  题库: {bank_name}, 学期: {semester}, {len(questions)} 道题")

            for i, q in enumerate(questions):
                q['bank'] = bank_name
                q['id'] = f"preset_{bank_name}_{i}"
                if not isinstance(q.get('answer'), list):
                    q['answer'] = list(q['answer']) if q.get('answer') else []

            all_banks[bank_name] = {
                'semester': semester,
                'questions': questions
            }
        except Exception as e:
            print(f"  解析失败: {e}")
            import traceback
            traceback.print_exc()

    total = sum(len(v['questions']) for v in all_banks.values())
    print(f"\n总计: {len(all_banks)} 个题库, {total} 道题")

    with open(PRESET_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_banks, f, ensure_ascii=False)

    file_size = os.path.getsize(PRESET_FILE)
    print(f"已导出: {PRESET_FILE} ({file_size / 1024:.1f} KB)")

if __name__ == '__main__':
    main()
