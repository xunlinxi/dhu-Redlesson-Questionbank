"""
题目管理路由
"""

from flask import Blueprint, request, jsonify
from backend.models.questions import QuestionsModel

questions_bp = Blueprint('questions', __name__)


@questions_bp.route('/api/questions', methods=['GET'])
def get_questions():
    """获取题目列表"""
    bank = request.args.get('bank', '')
    q_type = request.args.get('type', '')
    chapter = request.args.get('chapter', '')
    
    questions = QuestionsModel.get_questions(
        bank=bank if bank else None,
        q_type=q_type if q_type else None,
        chapter=chapter if chapter else None
    )
    
    return jsonify({
        "success": True,
        "questions": questions,
        "total": len(questions)
    })


@questions_bp.route('/api/questions/<question_id>', methods=['GET'])
def get_question(question_id):
    """获取单个题目"""
    question = QuestionsModel.get_question_by_id(question_id)
    if question:
        return jsonify({
            "success": True,
            "question": question
        })
    return jsonify({
        "success": False,
        "error": "题目不存在"
    }), 404


@questions_bp.route('/api/questions/<question_id>', methods=['PUT'])
def update_question(question_id):
    """更新题目"""
    update_data = request.json
    if QuestionsModel.update_question(question_id, update_data):
        return jsonify({
            "success": True,
            "message": "题目已更新"
        })
    return jsonify({
        "success": False,
        "error": "题目不存在"
    }), 404


@questions_bp.route('/api/questions/<question_id>', methods=['DELETE'])
def delete_question(question_id):
    """删除题目"""
    if QuestionsModel.delete_question(question_id):
        return jsonify({
            "success": True,
            "message": "题目已删除"
        })
    return jsonify({
        "success": False,
        "error": "题目不存在"
    }), 404
