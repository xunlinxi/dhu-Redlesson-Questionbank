"""
题库刷题系统后端API
Flask应用主程序
"""

import os
import json
import random
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from parser import parse_file

# 获取项目根目录
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_FILE = os.path.join(BASE_DIR, 'config.json')

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# 允许上传的文件扩展名
ALLOWED_EXTENSIONS = {'doc', 'docx'}

# 临时上传目录
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def load_config():
    """加载配置"""
    default_config = {
        "data_path": os.path.join(BASE_DIR, "data"),
        "questions_file": "questions.json",
        "port": 5000
    }
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = json.load(f)
            # 将相对路径转换为绝对路径
            if not os.path.isabs(config.get('data_path', '')):
                config['data_path'] = os.path.join(BASE_DIR, config['data_path'])
            return {**default_config, **config}
    except:
        return default_config


def save_config(config):
    """保存配置"""
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=4)


def get_questions_file_path():
    """获取题库文件路径"""
    config = load_config()
    data_path = config.get('data_path', os.path.join(BASE_DIR, 'data'))
    os.makedirs(data_path, exist_ok=True)
    return os.path.join(data_path, config.get('questions_file', 'questions.json'))


def load_questions():
    """加载题库数据"""
    file_path = get_questions_file_path()
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {"banks": {}, "questions": []}


def save_questions(data):
    """保存题库数据"""
    file_path = get_questions_file_path()
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ==================== 静态文件服务 ====================

@app.route('/')
def serve_index():
    """服务首页"""
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    """服务静态文件"""
    return send_from_directory(app.static_folder, path)


# ==================== 配置相关API ====================

@app.route('/api/config', methods=['GET'])
def get_config():
    """获取配置"""
    config = load_config()
    return jsonify({
        "success": True,
        "config": config
    })


@app.route('/api/config', methods=['POST'])
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


# ==================== 题库管理API ====================

@app.route('/api/banks', methods=['GET'])
def get_banks():
    """获取所有题库列表"""
    data = load_questions()
    banks = data.get('banks', {})
    bank_list = []
    for name, info in banks.items():
        question_count = len([q for q in data.get('questions', []) if q.get('bank') == name])
        bank_list.append({
            "name": name,
            "question_count": question_count,
            "import_time": info.get('import_time', ''),
            "source_file": info.get('source_file', '')
        })
    return jsonify({
        "success": True,
        "banks": bank_list
    })


@app.route('/api/banks/<bank_name>', methods=['DELETE'])
def delete_bank(bank_name):
    """删除题库"""
    data = load_questions()
    if bank_name in data.get('banks', {}):
        del data['banks'][bank_name]
        data['questions'] = [q for q in data.get('questions', []) if q.get('bank') != bank_name]
        save_questions(data)
        return jsonify({
            "success": True,
            "message": f"题库 '{bank_name}' 已删除"
        })
    return jsonify({
        "success": False,
        "error": "题库不存在"
    }), 404


@app.route('/api/import', methods=['POST'])
def import_questions():
    """导入题库"""
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
            "error": "不支持的文件格式，请上传.doc或.docx文件"
        }), 400
    
    try:
        # 保存上传的文件
        filename = secure_filename(file.filename)
        # 处理中文文件名
        if not filename or filename == '':
            filename = file.filename
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)
        
        # 如果没有指定题库名称，使用文件名
        if not bank_name:
            bank_name = os.path.splitext(filename)[0]
        
        # 解析题目
        questions = parse_file(file_path, bank_name)
        
        if not questions:
            return jsonify({
                "success": False,
                "error": "未能从文件中解析出题目，请检查文件格式"
            }), 400
        
        # 加载现有数据
        data = load_questions()
        
        # 添加题库信息
        from datetime import datetime
        data['banks'][bank_name] = {
            "source_file": filename,
            "import_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # 移除同名题库的旧题目
        data['questions'] = [q for q in data.get('questions', []) if q.get('bank') != bank_name]
        
        # 添加新题目
        data['questions'].extend(questions)
        
        # 保存数据
        save_questions(data)
        
        # 删除临时文件
        try:
            os.remove(file_path)
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


# ==================== 题目相关API ====================

@app.route('/api/questions', methods=['GET'])
def get_questions():
    """获取题目列表"""
    data = load_questions()
    questions = data.get('questions', [])
    
    # 支持按题库筛选
    bank = request.args.get('bank', '')
    if bank:
        questions = [q for q in questions if q.get('bank') == bank]
    
    # 支持按类型筛选
    q_type = request.args.get('type', '')
    if q_type:
        questions = [q for q in questions if q.get('type') == q_type]
    
    # 支持按章节筛选
    chapter = request.args.get('chapter', '')
    if chapter:
        questions = [q for q in questions if q.get('chapter') == chapter]
    
    return jsonify({
        "success": True,
        "questions": questions,
        "total": len(questions)
    })


@app.route('/api/questions/<question_id>', methods=['GET'])
def get_question(question_id):
    """获取单个题目"""
    data = load_questions()
    for q in data.get('questions', []):
        if q.get('id') == question_id:
            return jsonify({
                "success": True,
                "question": q
            })
    return jsonify({
        "success": False,
        "error": "题目不存在"
    }), 404


@app.route('/api/questions/<question_id>', methods=['PUT'])
def update_question(question_id):
    """更新题目"""
    data = load_questions()
    for i, q in enumerate(data.get('questions', [])):
        if q.get('id') == question_id:
            update_data = request.json
            data['questions'][i].update(update_data)
            save_questions(data)
            return jsonify({
                "success": True,
                "message": "题目已更新"
            })
    return jsonify({
        "success": False,
        "error": "题目不存在"
    }), 404


@app.route('/api/questions/<question_id>', methods=['DELETE'])
def delete_question(question_id):
    """删除题目"""
    data = load_questions()
    original_count = len(data.get('questions', []))
    data['questions'] = [q for q in data.get('questions', []) if q.get('id') != question_id]
    
    if len(data['questions']) < original_count:
        save_questions(data)
        return jsonify({
            "success": True,
            "message": "题目已删除"
        })
    return jsonify({
        "success": False,
        "error": "题目不存在"
    }), 404


# ==================== 刷题相关API ====================

@app.route('/api/practice/random', methods=['GET'])
def get_random_questions():
    """获取随机题目用于刷题"""
    data = load_questions()
    questions = data.get('questions', [])
    
    # 支持按题库筛选
    bank = request.args.get('bank', '')
    if bank:
        questions = [q for q in questions if q.get('bank') == bank]
    
    # 支持按类型筛选
    q_type = request.args.get('type', '')
    if q_type:
        questions = [q for q in questions if q.get('type') == q_type]
    
    # 获取题目数量
    count = int(request.args.get('count', 10))
    count = min(count, len(questions))
    
    # 随机选择题目
    if questions:
        selected = random.sample(questions, count)
        # 隐藏答案，刷题时需要通过check接口验证
        for q in selected:
            q = q.copy()
        return jsonify({
            "success": True,
            "questions": selected,
            "total": len(selected)
        })
    
    return jsonify({
        "success": True,
        "questions": [],
        "total": 0
    })


@app.route('/api/practice/check', methods=['POST'])
def check_answer():
    """检查答案"""
    req_data = request.json
    question_id = req_data.get('question_id', '')
    user_answer = req_data.get('answer', [])
    
    # 确保答案是列表格式
    if isinstance(user_answer, str):
        user_answer = list(user_answer.upper())
    else:
        user_answer = [a.upper() for a in user_answer]
    
    data = load_questions()
    for q in data.get('questions', []):
        if q.get('id') == question_id:
            correct_answer = q.get('answer', [])
            is_correct = sorted(user_answer) == sorted(correct_answer)
            return jsonify({
                "success": True,
                "correct": is_correct,
                "user_answer": user_answer,
                "correct_answer": correct_answer
            })
    
    return jsonify({
        "success": False,
        "error": "题目不存在"
    }), 404


# ==================== 统计相关API ====================

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """获取统计信息"""
    data = load_questions()
    questions = data.get('questions', [])
    banks = data.get('banks', {})
    
    # 统计各类型题目数量
    single_count = len([q for q in questions if q.get('type') == 'single'])
    multi_count = len([q for q in questions if q.get('type') == 'multi'])
    
    # 统计各章节题目数量
    chapters = {}
    for q in questions:
        chapter = q.get('chapter', '未分类')
        chapters[chapter] = chapters.get(chapter, 0) + 1
    
    return jsonify({
        "success": True,
        "stats": {
            "total_questions": len(questions),
            "total_banks": len(banks),
            "single_choice_count": single_count,
            "multi_choice_count": multi_count,
            "chapters": chapters
        }
    })


@app.route('/api/chapters', methods=['GET'])
def get_chapters():
    """获取所有章节列表"""
    data = load_questions()
    questions = data.get('questions', [])
    
    # 按题库筛选
    bank = request.args.get('bank', '')
    if bank:
        questions = [q for q in questions if q.get('bank') == bank]
    
    chapters = list(set(q.get('chapter', '未分类') for q in questions))
    return jsonify({
        "success": True,
        "chapters": chapters
    })


if __name__ == '__main__':
    config = load_config()
    port = config.get('port', 5000)
    print(f"题库刷题系统启动中...")
    print(f"访问地址: http://localhost:{port}")
    print(f"数据存储路径: {get_questions_file_path()}")
    app.run(host='0.0.0.0', port=port, debug=True)
