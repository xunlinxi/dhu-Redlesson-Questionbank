"""
错题本数据模型
"""

import os
import json
from datetime import datetime
from backend.config import get_data_path


class WrongbookModel:
    """错题本数据模型"""
    
    @staticmethod
    def get_file_path():
        """获取错题本文件路径"""
        return os.path.join(get_data_path(), 'wrongbook.json')
    
    @staticmethod
    def load():
        """加载错题本数据"""
        file_path = WrongbookModel.get_file_path()
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {"wrong_questions": []}
    
    @staticmethod
    def save(data):
        """保存错题本数据"""
        file_path = WrongbookModel.get_file_path()
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    @staticmethod
    def get_wrong_questions(bank=None):
        """获取错题列表"""
        data = WrongbookModel.load()
        wrong_questions = data.get('wrong_questions', [])
        
        if bank:
            wrong_questions = [q for q in wrong_questions if q.get('bank') == bank]
        
        return wrong_questions
    
    @staticmethod
    def get_stats():
        """获取错题本统计，按题库分组"""
        data = WrongbookModel.load()
        wrong_questions = data.get('wrong_questions', [])
        
        bank_stats = {}
        for q in wrong_questions:
            bank = q.get('bank', '未知题库')
            if bank not in bank_stats:
                bank_stats[bank] = {'total': 0, 'single': 0, 'multi': 0}
            bank_stats[bank]['total'] += 1
            if q.get('type') == 'single':
                bank_stats[bank]['single'] += 1
            else:
                bank_stats[bank]['multi'] += 1
        
        return bank_stats, len(wrong_questions)
    
    @staticmethod
    def add_wrong_question(question, user_answer):
        """添加错题"""
        data = WrongbookModel.load()
        
        # 检查是否已存在
        existing_ids = [q.get('id') for q in data.get('wrong_questions', [])]
        question_id = question.get('id')
        
        if question_id not in existing_ids:
            question = question.copy()
            question['added_time'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            question['wrong_count'] = 1
            question['last_wrong_answer'] = user_answer
            data['wrong_questions'].append(question)
        else:
            # 更新错误次数
            for q in data['wrong_questions']:
                if q.get('id') == question_id:
                    q['wrong_count'] = q.get('wrong_count', 1) + 1
                    q['last_wrong_answer'] = user_answer
                    break
        
        WrongbookModel.save(data)
    
    @staticmethod
    def remove_question(question_id):
        """从错题本移除单个题目"""
        data = WrongbookModel.load()
        original_count = len(data.get('wrong_questions', []))
        data['wrong_questions'] = [q for q in data.get('wrong_questions', []) if q.get('id') != question_id]
        
        if len(data['wrong_questions']) < original_count:
            WrongbookModel.save(data)
            return True
        return False
    
    @staticmethod
    def clear_by_bank(bank_name):
        """清空某个题库的所有错题"""
        data = WrongbookModel.load()
        original_count = len(data.get('wrong_questions', []))
        data['wrong_questions'] = [q for q in data.get('wrong_questions', []) if q.get('bank') != bank_name]
        
        removed = original_count - len(data['wrong_questions'])
        WrongbookModel.save(data)
        return removed
    
    @staticmethod
    def clear():
        """清空整个错题本"""
        WrongbookModel.save({"wrong_questions": []})
