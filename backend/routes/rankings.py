"""
排名相关路由
"""

from flask import Blueprint, request, jsonify
from backend.models.rankings import RankingsModel

rankings_bp = Blueprint('rankings', __name__)


@rankings_bp.route('/api/rankings', methods=['GET'])
def get_rankings():
    """获取排名列表"""
    rankings = RankingsModel.get_rankings()
    return jsonify({
        "success": True,
        "rankings": rankings
    })


@rankings_bp.route('/api/rankings', methods=['POST'])
def add_ranking():
    """添加排名记录"""
    req_data = request.json
    record = RankingsModel.add_ranking(req_data)
    return jsonify({
        "success": True,
        "message": "成绩已记录",
        "record": record
    })


@rankings_bp.route('/api/rankings', methods=['DELETE'])
def clear_rankings():
    """清空排名记录"""
    RankingsModel.clear()
    return jsonify({
        "success": True,
        "message": "排名记录已清空"
    })
