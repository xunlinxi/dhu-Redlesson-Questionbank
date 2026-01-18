"""
进度数据模型
"""

import os
import json
from datetime import datetime
from backend.config import get_data_path


class ProgressModel:
    """进度数据模型"""
    
    @staticmethod
    def get_file_path():
        """获取进度文件路径"""
        return os.path.join(get_data_path(), 'progress.json')
    
    @staticmethod
    def load():
        """加载进度数据"""
        file_path = ProgressModel.get_file_path()
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {"progress_list": []}
    
    @staticmethod
    def save(data):
        """保存进度数据"""
        file_path = ProgressModel.get_file_path()
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    @staticmethod
    def get_all():
        """获取所有保存的进度"""
        data = ProgressModel.load()
        return data.get('progress_list', [])
    
    @staticmethod
    def save_progress(progress_data):
        """保存做题进度（支持覆盖更新）"""
        progress_id = progress_data.get('progress_id')
        
        progress = {
            "id": progress_id if progress_id else str(abs(hash(str(datetime.now())))),
            "mode": progress_data.get('mode', 'random'),
            "bank": progress_data.get('bank', ''),
            "chapter": progress_data.get('chapter', ''),
            "current_index": progress_data.get('current_index', 0),
            "total": progress_data.get('total', 0),
            "correct": progress_data.get('correct', 0),
            "wrong": progress_data.get('wrong', 0),
            "question_ids": progress_data.get('question_ids', []),
            "shuffle_map": progress_data.get('shuffle_map', {}),  # 乱序映射（轻量级）
            "question_results": progress_data.get('question_results', []),
            "remaining_time": progress_data.get('remaining_time', 0),
            "elapsed_time": progress_data.get('elapsed_time', 0),
            "save_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        data = ProgressModel.load()
        progress_list = data.get('progress_list', [])
        
        # 如果提供了progress_id，则更新现有进度
        if progress_id:
            updated = False
            for i, p in enumerate(progress_list):
                if p.get('id') == progress_id:
                    progress_list[i] = progress
                    updated = True
                    break
            if not updated:
                progress_list.insert(0, progress)
        else:
            # 创建新进度，限制最多保存10个
            progress_list = progress_list[:9]
            progress_list.insert(0, progress)
        
        data['progress_list'] = progress_list
        ProgressModel.save(data)
        
        return progress
    
    @staticmethod
    def get_by_id(progress_id):
        """获取单个进度详情"""
        data = ProgressModel.load()
        for p in data.get('progress_list', []):
            if p.get('id') == progress_id:
                return p
        return None
    
    @staticmethod
    def delete(progress_id):
        """删除单个进度"""
        data = ProgressModel.load()
        original_count = len(data.get('progress_list', []))
        data['progress_list'] = [p for p in data.get('progress_list', []) if p.get('id') != progress_id]
        
        if len(data['progress_list']) < original_count:
            ProgressModel.save(data)
            return True
        return False
