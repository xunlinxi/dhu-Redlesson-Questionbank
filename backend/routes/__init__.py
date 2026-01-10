"""
路由模块
"""

from .banks import banks_bp
from .questions import questions_bp
from .practice import practice_bp
from .stats import stats_bp
from .rankings import rankings_bp
from .wrongbook import wrongbook_bp
from .progress import progress_bp
from .config import config_bp

__all__ = [
    'banks_bp', 'questions_bp', 'practice_bp', 'stats_bp',
    'rankings_bp', 'wrongbook_bp', 'progress_bp', 'config_bp'
]
