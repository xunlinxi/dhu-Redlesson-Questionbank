"""
题库管理路由
"""

import os
import unicodedata
import re as regex
from datetime import datetime
from flask import Blueprint, request, jsonify
from backend.config import UPLOAD_FOLDER, allowed_file
from backend.models.questions import QuestionsModel
from backend.parser import parse_file
from backend.utils import convert_word_to_txt

banks_bp = Blueprint('banks', __name__)


@banks_bp.route('/api/banks', methods=['GET'])
def get_banks():
    """获取所有题库列表"""
    bank_list = QuestionsModel.get_banks()
    return jsonify({
        "success": True,
        "banks": bank_list
    })


@banks_bp.route('/api/banks/<bank_name>', methods=['DELETE'])
def delete_bank(bank_name):
    """删除题库"""
    if QuestionsModel.delete_bank(bank_name):
        return jsonify({
            "success": True,
            "message": f"题库 '{bank_name}' 已删除"
        })
    return jsonify({
        "success": False,
        "error": "题库不存在"
    }), 404


@banks_bp.route('/api/import', methods=['POST'])
def import_questions():
    """导入题库
    
    支持 .txt 文件直接导入
    支持 .doc/.docx 文件自动转换为文本后导入
    """
    if 'file' not in request.files:
        return jsonify({
            "success": False,
            "error": "没有上传文件"
        }), 400
    
    file = request.files['file']
    bank_name = request.form.get('bank_name', '')
    
    if file.filename == '':
        return jsonify({
            "success": False,
            "error": "没有选择文件"
        }), 400
    
    if not allowed_file(file.filename):
        return jsonify({
            "success": False,
            "error": "不支持的文件格式，请上传 .txt、.doc 或 .docx 文件"
        }), 400
    
    try:
        original_filename = file.filename
        ext = os.path.splitext(original_filename)[1].lower()
        
        # 清理文件名中的特殊字符，但保留中文
        safe_filename = unicodedata.normalize('NFKC', original_filename)
        safe_filename = regex.sub(r'[<>:"/\\|?*]', '_', safe_filename)
        
        # 如果文件名为空或只有扩展名，使用时间戳
        if not safe_filename or safe_filename.startswith('.'):
            safe_filename = f"upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}{ext}"
        
        file_path = os.path.join(UPLOAD_FOLDER, safe_filename)
        file.save(file_path)
        
        txt_file_path = file_path
        
        # 如果是 doc/docx，先转换为 txt
        if ext in ['.doc', '.docx']:
            txt_file_path = convert_word_to_txt(file_path)
        
        # 解析题目
        questions, extracted_name = parse_file(txt_file_path, bank_name if bank_name else None)
        
        # 如果没有指定题库名称，使用提取的名称
        if not bank_name:
            bank_name = extracted_name
        
        if not questions:
            return jsonify({
                "success": False,
                "error": "未能从文件中解析出题目，请检查文件格式"
            }), 400
        
        # 加载现有数据
        data = QuestionsModel.load()
        
        # 添加题库信息
        data['banks'][bank_name] = {
            "source_file": original_filename,
            "import_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # 移除同名题库的旧题目
        data['questions'] = [q for q in data.get('questions', []) if q.get('bank') != bank_name]
        
        # 添加新题目
        data['questions'].extend(questions)
        
        # 保存数据
        QuestionsModel.save(data)
        
        # 删除临时文件
        try:
            os.remove(file_path)
            if txt_file_path != file_path:
                os.remove(txt_file_path)
        except:
            pass
        
        return jsonify({
            "success": True,
            "message": f"成功导入 {len(questions)} 道题目到题库 '{bank_name}'",
            "question_count": len(questions)
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"导入失败: {str(e)}"
        }), 500
