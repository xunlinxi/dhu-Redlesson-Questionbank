"""
配置相关路由
"""

import os
from flask import Blueprint, request, jsonify
from backend.config import load_config, save_config

config_bp = Blueprint('config', __name__)


@config_bp.route('/api/config', methods=['GET'])
def get_config():
    """获取配置"""
    config = load_config()
    return jsonify({
        "success": True,
        "config": config
    })


@config_bp.route('/api/config', methods=['POST'])
def update_config():
    """更新配置"""
    try:
        new_config = request.json
        
        # 验证数据路径
        data_path = new_config.get('data_path', '')
        if data_path:
            os.makedirs(data_path, exist_ok=True)
        
        save_config(new_config)
        return jsonify({
            "success": True,
            "message": "配置已更新"
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
