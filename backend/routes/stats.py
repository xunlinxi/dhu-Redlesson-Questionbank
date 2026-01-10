"""
统计相关路由
"""

from flask import Blueprint, request, jsonify
from backend.models.questions import QuestionsModel

stats_bp = Blueprint('stats', __name__)


@stats_bp.route('/api/stats', methods=['GET'])
def get_stats():
    """获取统计信息"""
    stats = QuestionsModel.get_stats()
    return jsonify({
        "success": True,
        "stats": stats
    })


@stats_bp.route('/api/chapters', methods=['GET'])
def get_chapters():
    """获取所有章节列表（保持原始顺序）"""
    bank = request.args.get('bank', '')
    chapters = QuestionsModel.get_chapters(bank=bank if bank else None)
    return jsonify({
        "success": True,
        "chapters": chapters
    })


@stats_bp.route('/api/stats/by_bank', methods=['GET'])
def get_stats_by_bank():
    """获取按题库分组的统计信息"""
    stats = QuestionsModel.get_stats_by_bank()
    return jsonify({
        "success": True,
        "stats": stats
    })
