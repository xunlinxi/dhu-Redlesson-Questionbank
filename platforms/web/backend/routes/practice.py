"""
刷题相关路由
"""

import random
from flask import Blueprint, request, jsonify
from backend.models.questions import QuestionsModel
from backend.models.wrongbook import WrongbookModel

practice_bp = Blueprint('practice', __name__)


@practice_bp.before_request
def validate_counts():
    for key in ('count', 'single_count', 'multi_count', 'judge_count'):
        value = request.args.get(key)
        if value not in (None, ''):
            if not value.isascii() or not value.isdigit() or len(value) > 6:
                return jsonify(success=False, error=f'{key} 必须为非负整数（最多六位）'), 400


@practice_bp.route('/api/practice/random', methods=['GET'])
def get_random_questions():
    """获取随机题目用于刷题
    
    支持参数：
    - bank: 题库名称
    - chapter: 章节名称
    - type: 题型(single/multi)
    - count: 总题目数量
    - single_count: 单选题数量
    - multi_count: 多选题数量
    - judge_count: 判断题数量
    """
    bank = request.args.get('bank', '')
    chapter = request.args.get('chapter', '')
    questions = QuestionsModel.get_questions(
        bank=bank if bank else None,
        chapter=chapter if chapter else None
    )
    
    single_questions = [q for q in questions if q.get('type') == 'single']
    multi_questions = [q for q in questions if q.get('type') == 'multi']
    judge_questions = [q for q in questions if q.get('type') == 'judge']
    
    single_count = request.args.get('single_count', '')
    multi_count = request.args.get('multi_count', '')
    judge_count = request.args.get('judge_count', '')
    
    if single_count or multi_count or judge_count:
        single_count = int(single_count) if single_count else 0
        multi_count = int(multi_count) if multi_count else 0
        judge_count = int(judge_count) if judge_count else 0
        
        selected = []
        
        if single_count > 0:
            single_count = min(single_count, len(single_questions))
            s = random.sample(single_questions, single_count)
            random.shuffle(s)
            selected.extend(s)
        
        if multi_count > 0:
            multi_count = min(multi_count, len(multi_questions))
            m = random.sample(multi_questions, multi_count)
            random.shuffle(m)
            selected.extend(m)

        if judge_count > 0:
            judge_count = min(judge_count, len(judge_questions))
            j = random.sample(judge_questions, judge_count)
            random.shuffle(j)
            selected.extend(j)
        
        random.shuffle(selected)
        return jsonify({
            "success": True,
            "questions": selected,
            "total": len(selected)
        })
    
    # 原有逻辑：按类型筛选
    q_type = request.args.get('type', '')
    if q_type:
        questions = [q for q in questions if q.get('type') == q_type]
    
    count = int(request.args.get('count', 10))
    count = min(count, len(questions))
    
    if questions:
        selected = random.sample(questions, count)
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


@practice_bp.route('/api/practice/check', methods=['POST'])
def check_answer():
    """检查答案"""
    req_data = request.json
    question_id = req_data.get('question_id', '')
    user_answer = req_data.get('answer', [])
    
    if isinstance(user_answer, str):
        user_answer = list(user_answer.upper())
    else:
        user_answer = [a.upper() for a in user_answer]
    
    question = QuestionsModel.get_question_by_id(question_id)
    if question:
        correct_answer = question.get('answer', [])
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


@practice_bp.route('/api/practice/sequence', methods=['GET'])
def get_sequence_questions():
    """获取顺序做题的题目列表
    
    支持参数：
    - bank: 题库名称
    - chapter: 章节名称
    - shuffle: 是否打乱顺序
    """
    bank = request.args.get('bank', '')
    chapter = request.args.get('chapter', '')
    
    questions = QuestionsModel.get_questions(
        bank=bank if bank else None,
        chapter=chapter if chapter else None
    )
    
    shuffle = request.args.get('shuffle', 'false').lower() == 'true'
    if shuffle:
        single_questions = [q for q in questions if q.get('type') == 'single']
        multi_questions = [q for q in questions if q.get('type') == 'multi']
        judge_questions = [q for q in questions if q.get('type') == 'judge']
        random.shuffle(single_questions)
        random.shuffle(multi_questions)
        random.shuffle(judge_questions)
        questions = single_questions + multi_questions + judge_questions
    
    return jsonify({
        "success": True,
        "questions": questions,
        "total": len(questions)
    })


@practice_bp.route('/api/practice/wrong', methods=['GET'])
def get_wrong_practice_questions():
    """获取错题练习的题目列表
    
    支持参数：
    - bank: 按题库筛选
    - single_count: 单选题数量
    - multi_count: 多选题数量
    - judge_count: 判断题数量
    """
    bank = request.args.get('bank', '')
    questions = WrongbookModel.get_wrong_questions(bank=bank if bank else None)
    
    single_questions = [q for q in questions if q.get('type') == 'single']
    multi_questions = [q for q in questions if q.get('type') == 'multi']
    judge_questions = [q for q in questions if q.get('type') == 'judge']
    
    single_count = request.args.get('single_count', '')
    multi_count = request.args.get('multi_count', '')
    judge_count = request.args.get('judge_count', '')
    
    if single_count or multi_count or judge_count:
        single_count = int(single_count) if single_count else 0
        multi_count = int(multi_count) if multi_count else 0
        judge_count = int(judge_count) if judge_count else 0
        
        selected = []
        
        if single_count > 0:
            single_count = min(single_count, len(single_questions))
            s = random.sample(single_questions, single_count) if single_questions else []
            random.shuffle(s)
            selected.extend(s)
        
        if multi_count > 0:
            multi_count = min(multi_count, len(multi_questions))
            m = random.sample(multi_questions, multi_count) if multi_questions else []
            random.shuffle(m)
            selected.extend(m)
        
        if judge_count > 0:
            judge_count = min(judge_count, len(judge_questions))
            j = random.sample(judge_questions, judge_count) if judge_questions else []
            random.shuffle(j)
            selected.extend(j)
        
        questions = selected
    else:
        random.shuffle(single_questions)
        random.shuffle(multi_questions)
        random.shuffle(judge_questions)
        questions = single_questions + multi_questions + judge_questions
    
    return jsonify({
        "success": True,
        "questions": questions,
        "total": len(questions)
    })
