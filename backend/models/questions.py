"""
题库数据模型
"""

import os
import json
from backend.config import get_data_path, load_config


class QuestionsModel:
    """题库数据模型"""
    
    @staticmethod
    def get_file_path():
        """获取题库文件路径"""
        config = load_config()
        data_path = get_data_path()
        return os.path.join(data_path, config.get('questions_file', 'questions.json'))
    
    @staticmethod
    def load():
        """加载题库数据"""
        file_path = QuestionsModel.get_file_path()
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {"banks": {}, "questions": []}
    
    @staticmethod
    def save(data):
        """保存题库数据"""
        file_path = QuestionsModel.get_file_path()
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    @staticmethod
    def get_banks():
        """获取所有题库列表"""
        data = QuestionsModel.load()
        banks = data.get('banks', {})
        bank_list = []
        for name, info in banks.items():
            question_count = len([q for q in data.get('questions', []) if q.get('bank') == name])
            bank_list.append({
                "name": name,
                "question_count": question_count,
                "import_time": info.get('import_time', ''),
                "source_file": info.get('source_file', '')
            })
        return bank_list
    
    @staticmethod
    def delete_bank(bank_name):
        """删除题库"""
        data = QuestionsModel.load()
        if bank_name in data.get('banks', {}):
            del data['banks'][bank_name]
            data['questions'] = [q for q in data.get('questions', []) if q.get('bank') != bank_name]
            QuestionsModel.save(data)
            return True
        return False
    
    @staticmethod
    def get_questions(bank=None, q_type=None, chapter=None):
        """获取题目列表"""
        data = QuestionsModel.load()
        questions = data.get('questions', [])
        
        if bank:
            questions = [q for q in questions if q.get('bank') == bank]
        if q_type:
            questions = [q for q in questions if q.get('type') == q_type]
        if chapter:
            questions = [q for q in questions if q.get('chapter') == chapter]
        
        return questions
    
    @staticmethod
    def get_question_by_id(question_id):
        """获取单个题目"""
        data = QuestionsModel.load()
        for q in data.get('questions', []):
            if q.get('id') == question_id:
                return q
        return None
    
    @staticmethod
    def update_question(question_id, update_data):
        """更新题目"""
        data = QuestionsModel.load()
        for i, q in enumerate(data.get('questions', [])):
            if q.get('id') == question_id:
                data['questions'][i].update(update_data)
                QuestionsModel.save(data)
                return True
        return False
    
    @staticmethod
    def delete_question(question_id):
        """删除题目"""
        data = QuestionsModel.load()
        original_count = len(data.get('questions', []))
        data['questions'] = [q for q in data.get('questions', []) if q.get('id') != question_id]
        
        if len(data['questions']) < original_count:
            QuestionsModel.save(data)
            return True
        return False
    
    @staticmethod
    def get_chapters(bank=None):
        """获取所有章节列表（保持原始顺序）"""
        data = QuestionsModel.load()
        questions = data.get('questions', [])
        
        if bank:
            questions = [q for q in questions if q.get('bank') == bank]
        
        seen = set()
        chapters = []
        for q in questions:
            chapter = q.get('chapter', '未分类')
            if chapter not in seen:
                seen.add(chapter)
                chapters.append(chapter)
        
        return chapters
    
    @staticmethod
    def get_stats():
        """获取统计信息"""
        data = QuestionsModel.load()
        questions = data.get('questions', [])
        banks = data.get('banks', {})
        
        single_count = len([q for q in questions if q.get('type') == 'single'])
        multi_count = len([q for q in questions if q.get('type') == 'multi'])
        
        from collections import OrderedDict
        chapters = OrderedDict()
        for q in questions:
            chapter = q.get('chapter', '未分类')
            chapters[chapter] = chapters.get(chapter, 0) + 1
        
        return {
            "total_questions": len(questions),
            "total_banks": len(banks),
            "single_choice_count": single_count,
            "multi_choice_count": multi_count,
            "chapters": dict(chapters)
        }
    
    @staticmethod
    def get_stats_by_bank():
        """获取按题库分组的统计信息"""
        data = QuestionsModel.load()
        questions = data.get('questions', [])
        
        bank_stats = {}
        for q in questions:
            bank = q.get('bank', '未知题库')
            if bank not in bank_stats:
                bank_stats[bank] = {
                    'total': 0,
                    'single': 0,
                    'multi': 0,
                    'chapters': {}
                }
            bank_stats[bank]['total'] += 1
            if q.get('type') == 'single':
                bank_stats[bank]['single'] += 1
            else:
                bank_stats[bank]['multi'] += 1
            
            chapter = q.get('chapter', '未分类')
            if chapter not in bank_stats[bank]['chapters']:
                bank_stats[bank]['chapters'][chapter] = 0
            bank_stats[bank]['chapters'][chapter] += 1
        
        return bank_stats
