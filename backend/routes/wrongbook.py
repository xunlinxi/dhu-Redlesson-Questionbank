"""
错题本相关路由
"""

from flask import Blueprint, request, jsonify
from backend.models.questions import QuestionsModel
from backend.models.wrongbook import WrongbookModel

wrongbook_bp = Blueprint('wrongbook', __name__)


@wrongbook_bp.route('/api/wrongbook', methods=['GET'])
def get_wrongbook():
    """获取错题本
    
    支持参数：
    - bank: 按题库筛选
    """
    bank = request.args.get('bank', '')
    wrong_questions = WrongbookModel.get_wrong_questions(bank=bank if bank else None)
    
    return jsonify({
        "success": True,
        "wrong_questions": wrong_questions,
        "total": len(wrong_questions)
    })


@wrongbook_bp.route('/api/wrongbook/stats', methods=['GET'])
def get_wrongbook_stats():
    """获取错题本统计，按题库分组"""
    bank_stats, total = WrongbookModel.get_stats()
    return jsonify({
        "success": True,
        "stats": bank_stats,
        "total": total
    })


@wrongbook_bp.route('/api/wrongbook', methods=['POST'])
def add_wrong_question():
    """添加错题"""
    req_data = request.json
    question_id = req_data.get('question_id', '')
    user_answer = req_data.get('user_answer', [])
    
    question = QuestionsModel.get_question_by_id(question_id)
    if not question:
        return jsonify({
            "success": False,
            "error": "题目不存在"
        }), 404
    
    WrongbookModel.add_wrong_question(question, user_answer)
    
    return jsonify({
        "success": True,
        "message": "已添加到错题本"
    })


@wrongbook_bp.route('/api/wrongbook/<question_id>', methods=['DELETE'])
def remove_wrong_question(question_id):
    """从错题本移除单个题目"""
    if WrongbookModel.remove_question(question_id):
        return jsonify({
            "success": True,
            "message": "已从错题本移除"
        })
    return jsonify({
        "success": False,
        "error": "错题不存在"
    }), 404


@wrongbook_bp.route('/api/wrongbook/bank/<bank_name>', methods=['DELETE'])
def clear_wrong_questions_by_bank(bank_name):
    """清空某个题库的所有错题"""
    removed = WrongbookModel.clear_by_bank(bank_name)
    return jsonify({
        "success": True,
        "message": f"已清空 {removed} 道错题"
    })


@wrongbook_bp.route('/api/wrongbook', methods=['DELETE'])
def clear_wrongbook():
    """清空整个错题本"""
    WrongbookModel.clear()
    return jsonify({
        "success": True,
        "message": "错题本已清空"
    })
