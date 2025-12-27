"""
题目解析器模块
用于解析.doc和.docx格式的题库文档
"""

import re
import os
from docx import Document

# 尝试导入win32com用于处理.doc文件
try:
    import win32com.client
    HAS_WIN32COM = True
except ImportError:
    HAS_WIN32COM = False


class QuestionParser:
    """题目解析器类"""
    
    def __init__(self):
        # 单选题标识
        self.single_choice_patterns = [
            r'单项选择题',
            r'单选题',
            r'一、\s*单项选择题',
            r'一、\s*单选题',
        ]
        # 多选题标识
        self.multi_choice_patterns = [
            r'多项选择题',
            r'多选题',
            r'二、\s*多项选择题',
            r'二、\s*多选题',
        ]
        # 章节标识
        self.chapter_pattern = r'^第[一二三四五六七八九十\d]+章\s*(.+)$'
        # 题目编号模式
        self.question_number_pattern = r'^[\d]+[\.、．]\s*'
        # 选项模式
        self.option_pattern = r'^([A-Ea-e])[\.、．\s](.+)$'
        # 答案提取模式 - 支持多种格式
        self.answer_patterns = [
            r'（\s*([A-Ea-e\s]+)\s*）',  # 中文括号
            r'\(\s*([A-Ea-e\s]+)\s*\)',   # 英文括号
        ]
    
    def read_docx(self, file_path):
        """读取.docx文件"""
        doc = Document(file_path)
        lines = []
        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                lines.append(text)
        return lines
    
    def read_doc(self, file_path):
        """读取.doc文件（需要Windows和Word）"""
        if not HAS_WIN32COM:
            raise Exception("需要安装pywin32并且系统中安装了Microsoft Word才能读取.doc文件")
        
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        try:
            doc = word.Documents.Open(file_path)
            text = doc.Content.Text
            doc.Close()
            lines = [line.strip() for line in text.split('\r') if line.strip()]
            return lines
        finally:
            word.Quit()
    
    def read_file(self, file_path):
        """读取文件内容"""
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.docx':
            return self.read_docx(file_path)
        elif ext == '.doc':
            return self.read_doc(file_path)
        else:
            raise Exception(f"不支持的文件格式: {ext}")
    
    def detect_question_type(self, text):
        """检测题目类型"""
        for pattern in self.single_choice_patterns:
            if re.search(pattern, text):
                return 'single'
        for pattern in self.multi_choice_patterns:
            if re.search(pattern, text):
                return 'multi'
        return None
    
    def detect_chapter(self, text):
        """检测章节"""
        match = re.match(self.chapter_pattern, text)
        if match:
            return match.group(0)
        return None
    
    def extract_answer(self, text):
        """从题目文本中提取答案"""
        for pattern in self.answer_patterns:
            matches = re.findall(pattern, text)
            if matches:
                # 取最后一个匹配的答案（通常答案在题目末尾）
                answer = matches[-1].upper().replace(' ', '')
                return list(answer)
        return []
    
    def clean_question_text(self, text):
        """清理题目文本，移除答案标记"""
        cleaned = text
        for pattern in self.answer_patterns:
            cleaned = re.sub(pattern, '（  ）', cleaned, count=1)
        return cleaned
    
    def is_question_start(self, text):
        """判断是否是题目开始"""
        return bool(re.match(self.question_number_pattern, text))
    
    def parse_option(self, text):
        """解析选项"""
        match = re.match(self.option_pattern, text.strip())
        if match:
            return match.group(1).upper(), match.group(2).strip()
        return None, None
    
    def parse_questions(self, file_path, bank_name=None):
        """解析题目文件"""
        lines = self.read_file(file_path)
        questions = []
        
        current_chapter = "默认章节"
        current_type = 'single'  # 默认单选
        current_question = None
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # 检测章节
            chapter = self.detect_chapter(line)
            if chapter:
                current_chapter = chapter
                i += 1
                continue
            
            # 检测题型
            q_type = self.detect_question_type(line)
            if q_type:
                current_type = q_type
                i += 1
                continue
            
            # 检测题目开始
            if self.is_question_start(line):
                # 保存上一题
                if current_question and current_question.get('options'):
                    questions.append(current_question)
                
                # 提取答案
                answer = self.extract_answer(line)
                # 清理题目文本
                question_text = self.clean_question_text(line)
                # 移除题号
                question_text = re.sub(self.question_number_pattern, '', question_text).strip()
                
                current_question = {
                    'chapter': current_chapter,
                    'type': current_type,
                    'question': question_text,
                    'options': {},
                    'answer': answer,
                    'bank': bank_name or os.path.basename(file_path)
                }
                i += 1
                continue
            
            # 检测选项
            if current_question:
                opt_key, opt_value = self.parse_option(line)
                if opt_key and opt_value:
                    # 检查选项中是否包含答案
                    if not current_question['answer']:
                        opt_answer = self.extract_answer(line)
                        if opt_answer:
                            current_question['answer'] = opt_answer
                    current_question['options'][opt_key] = opt_value
                elif line and not self.detect_question_type(line) and not self.detect_chapter(line):
                    # 可能是选项的续行或其他内容
                    # 尝试解析多行选项格式
                    multi_opt_match = re.match(r'^([A-Ea-e])[\s\.、．]?(.*)$', line)
                    if multi_opt_match:
                        opt_key = multi_opt_match.group(1).upper()
                        opt_value = multi_opt_match.group(2).strip()
                        if opt_value:
                            current_question['options'][opt_key] = opt_value
            
            i += 1
        
        # 保存最后一题
        if current_question and current_question.get('options'):
            questions.append(current_question)
        
        # 为每个题目生成唯一ID
        for idx, q in enumerate(questions):
            q['id'] = f"{hash(file_path)}_{idx}"
        
        return questions


def parse_file(file_path, bank_name=None):
    """解析题库文件的便捷函数"""
    parser = QuestionParser()
    return parser.parse_questions(file_path, bank_name)


if __name__ == "__main__":
    # 测试用
    import sys
    if len(sys.argv) > 1:
        questions = parse_file(sys.argv[1])
        print(f"解析到 {len(questions)} 道题目")
        for q in questions[:3]:
            print(f"\n题目: {q['question'][:50]}...")
            print(f"类型: {'单选' if q['type'] == 'single' else '多选'}")
            print(f"答案: {q['answer']}")
