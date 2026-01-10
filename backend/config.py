"""
配置管理模块
"""

import os
import json

# 获取项目根目录
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_FILE = os.path.join(BASE_DIR, 'config.json')

# 允许上传的文件扩展名
ALLOWED_EXTENSIONS = {'doc', 'docx', 'txt'}

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


def get_data_path():
    """获取数据目录路径"""
    config = load_config()
    data_path = config.get('data_path', os.path.join(BASE_DIR, 'data'))
    os.makedirs(data_path, exist_ok=True)
    return data_path


def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
