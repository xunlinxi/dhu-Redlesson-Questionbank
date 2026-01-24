"""
pytest 配置文件
"""

import pytest
import sys
import os

# 确保 backend 目录在路径中
current_dir = os.path.dirname(__file__)
web_dir = os.path.dirname(current_dir)
backend_dir = os.path.join(web_dir, 'backend')

if web_dir not in sys.path:
    sys.path.insert(0, web_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)


@pytest.fixture
def client():
    """Flask 测试客户端 fixture"""
    from backend.app import app
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client
