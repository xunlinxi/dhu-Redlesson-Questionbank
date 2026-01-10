"""
排名数据模型
"""

import os
import json
from datetime import datetime
from backend.config import get_data_path


class RankingsModel:
    """排名数据模型"""
    
    @staticmethod
    def get_file_path():
        """获取排名文件路径"""
        return os.path.join(get_data_path(), 'rankings.json')
    
    @staticmethod
    def load():
        """加载排名数据"""
        file_path = RankingsModel.get_file_path()
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {"rankings": []}
    
    @staticmethod
    def save(data):
        """保存排名数据"""
        file_path = RankingsModel.get_file_path()
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    @staticmethod
    def get_rankings(limit=20):
        """获取排名列表"""
        data = RankingsModel.load()
        rankings = data.get('rankings', [])
        # 按正确率和用时排序
        rankings.sort(key=lambda x: (-x.get('accuracy', 0), x.get('time_spent', 9999)))
        return rankings[:limit]
    
    @staticmethod
    def add_ranking(record_data):
        """添加排名记录"""
        record = {
            "id": str(abs(hash(str(datetime.now())))),
            "name": record_data.get('name', '匿名'),
            "total": record_data.get('total', 0),
            "correct": record_data.get('correct', 0),
            "wrong": record_data.get('wrong', 0),
            "accuracy": record_data.get('accuracy', 0),
            "time_spent": record_data.get('time_spent', 0),
            "time_display": record_data.get('time_display', ''),
            "date": datetime.now().strftime("%Y-%m-%d %H:%M")
        }
        
        data = RankingsModel.load()
        data['rankings'].append(record)
        RankingsModel.save(data)
        
        return record
    
    @staticmethod
    def clear():
        """清空排名记录"""
        RankingsModel.save({"rankings": []})
