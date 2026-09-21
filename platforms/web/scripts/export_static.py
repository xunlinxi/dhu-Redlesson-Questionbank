#!/usr/bin/env python3
"""
导出题库数据为静态JSON文件
用于GitHub Pages静态网站
"""

import json
import os
import shutil

def main():
    # 源数据目录
    source_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_file = os.path.join(source_dir, 'data', 'questions.json')
    
    # 目标目录
    target_dir = os.path.join(source_dir, 'static-site', 'data')
    os.makedirs(target_dir, exist_ok=True)
    
    # 读取题库数据
    print(f'读取题库数据: {data_file}')
    with open(data_file, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)
    
    # 重组数据结构：将questions按bank分组到banks中
    banks = raw_data.get('banks', {})
    questions = raw_data.get('questions', [])
    
    # 为每个bank添加questions数组和chapters
    for bank_name in banks:
        banks[bank_name]['questions'] = []
        banks[bank_name]['chapters'] = []
    
    # 分配题目到对应的bank
    for q in questions:
        bank_name = q.get('bank', '')
        if bank_name in banks:
            banks[bank_name]['questions'].append(q)
            # 收集章节
            chapter = q.get('chapter', '')
            if chapter and chapter not in banks[bank_name]['chapters']:
                banks[bank_name]['chapters'].append(chapter)
    
    # 更新统计
    for bank_name, bank_data in banks.items():
        questions_list = bank_data.get('questions', [])
        bank_data['singleCount'] = len([q for q in questions_list if q.get('type') == 'single'])
        bank_data['multiCount'] = len([q for q in questions_list if q.get('type') == 'multi'])
        bank_data['judgeCount'] = len([q for q in questions_list if q.get('type') == 'judge'])
        bank_data['totalQuestions'] = len(questions_list)
    
    # 构建最终数据
    data = {'banks': banks}
    
    # 统计信息
    print(f'题库数量: {len(banks)}')
    total_questions = 0
    for bank_name, bank_data in banks.items():
        questions_list = bank_data.get('questions', [])
        single_count = len([q for q in questions_list if q.get('type') == 'single'])
        multi_count = len([q for q in questions_list if q.get('type') == 'multi'])
        judge_count = len([q for q in questions_list if q.get('type') == 'judge'])
        chapters = bank_data.get('chapters', [])
        print(f'  - {bank_name}: {len(questions_list)}题 (单选{single_count}, 多选{multi_count}, 判断{judge_count}, {len(chapters)}章节)')
        total_questions += len(questions_list)
    
    print(f'总题目数: {total_questions}')
    
    # 保存到静态目录
    target_file = os.path.join(target_dir, 'questions.json')
    print(f'\n导出到: {target_file}')
    with open(target_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print('导出完成!')

if __name__ == '__main__':
    main()
