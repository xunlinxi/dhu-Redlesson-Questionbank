"""
进度相关路由
"""

from flask import Blueprint, request, jsonify
from backend.models.progress import ProgressModel

progress_bp = Blueprint('progress', __name__)


@progress_bp.route('/api/progress', methods=['GET'])
def get_all_progress():
    """获取所有保存的进度"""
    progress_list = ProgressModel.get_all()
    return jsonify({
        "success": True,
        "progress_list": progress_list
    })


@progress_bp.route('/api/progress', methods=['POST'])
def save_practice_progress():
    """保存做题进度（支持覆盖更新）"""
    req_data = request.json
    progress = ProgressModel.save_progress(req_data)
    return jsonify({
        "success": True,
        "message": "进度已保存",
        "progress": progress
    })


@progress_bp.route('/api/progress/<progress_id>', methods=['GET'])
def get_progress(progress_id):
    """获取单个进度详情"""
    progress = ProgressModel.get_by_id(progress_id)
    if progress:
        return jsonify({
            "success": True,
            "progress": progress
        })
    return jsonify({
        "success": False,
        "error": "进度不存在"
    }), 404


@progress_bp.route('/api/progress/<progress_id>', methods=['DELETE'])
def delete_progress(progress_id):
    """删除单个进度"""
    if ProgressModel.delete(progress_id):
        return jsonify({
            "success": True,
            "message": "进度已删除"
        })
    return jsonify({
        "success": False,
        "error": "进度不存在"
    }), 404
