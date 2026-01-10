"""
题库刷题系统后端API
Flask应用主程序

重构后的模块化结构：
- backend/
  - app.py          # Flask应用入口
  - config.py       # 配置管理
  - parser.py       # 题目解析器
  - utils.py        # 工具函数
  - models/         # 数据模型
    - questions.py  # 题库数据模型
    - rankings.py   # 排名数据模型
    - wrongbook.py  # 错题本数据模型
    - progress.py   # 进度数据模型
  - routes/         # 路由模块
    - banks.py      # 题库管理API
    - questions.py  # 题目管理API
    - practice.py   # 刷题API
    - stats.py      # 统计API
    - rankings.py   # 排名API
    - wrongbook.py  # 错题本API
    - progress.py   # 进度API
    - config.py     # 配置API
"""

import sys
import os

# 确保项目根目录在Python路径中
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS

from backend.config import load_config, get_data_path
from backend.routes import (
    banks_bp, questions_bp, practice_bp, stats_bp,
    rankings_bp, wrongbook_bp, progress_bp, config_bp
)

# 创建Flask应用
app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# 注册蓝图
app.register_blueprint(config_bp)
app.register_blueprint(banks_bp)
app.register_blueprint(questions_bp)
app.register_blueprint(practice_bp)
app.register_blueprint(stats_bp)
app.register_blueprint(rankings_bp)
app.register_blueprint(wrongbook_bp)
app.register_blueprint(progress_bp)


# ==================== 健康检查API ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        "success": True,
        "status": "online",
        "message": "服务正常运行"
    })


# ==================== 静态文件服务 ====================

@app.route('/')
def serve_index():
    """服务首页"""
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    """服务静态文件"""
    return send_from_directory(app.static_folder, path)


# ==================== 应用入口 ====================

if __name__ == '__main__':
    config = load_config()
    port = config.get('port', 5000)
    
    # 获取数据文件路径
    from backend.models.questions import QuestionsModel
    questions_file = QuestionsModel.get_file_path()
    
    print(f"题库刷题系统启动中...")
    print(f"访问地址: http://localhost:{port}")
    print(f"数据存储路径: {questions_file}")
    
    app.run(host='0.0.0.0', port=port, debug=True)
