"""
题目解析器模块
用于解析.doc和.docx格式的题库文档
支持多种题目格式的智能识别
"""

import re
import os
from docx import Document
from collections import OrderedDict

# 尝试导入win32com用于处理.doc文件
try:
    import win32com.client
    import pythoncom
    HAS_WIN32COM = True
except ImportError:
    HAS_WIN32COM = False


class QuestionParser:
    """题目解析器类"""
    
    def __init__(self):
        # 单选题标识
        self.single_choice_patterns = [
            r'^单项选择题$',
            r'^单选题$',
            r'^一[、\.．]\s*单项选择题',
            r'^一[、\.．]\s*单选题',
        ]
        # 多选题标识
        self.multi_choice_patterns = [
            r'^多项选择题$',
            r'^多选题$',
            r'^二[、\.．]\s*多项选择题',
            r'^二[、\.．]\s*多选题',
        ]
        # 章节标识
        self.chapter_patterns = [
            r'^第[一二三四五六七八九十百千\d]+章',
            r'^导论$',
        ]
        # 题号模式
        self.question_number_pattern = r'^(\d+)[\.、．\s]\s*'
        
        # 答案提取模式 - 支持多种格式，包括字母间有空格的情况
        self.answer_patterns = [
            r'[（(]\s*([A-Ea-e](?:\s*[A-Ea-e])*)\s*[）)]',  # 匹配括号内的字母（可能有空格分隔）
        ]
        
        # 选项模式 - 支持半角和全角字母
        self.option_start_pattern = r'^([A-Ea-eＡ-Ｅａ-ｅ])[\.、．\s]'
        
        # 用于记录章节顺序
        self.chapter_order = []
    
    def normalize_option_letter(self, letter):
        """将全角字母转换为半角大写"""
        # 全角大写 A-E
        fullwidth_upper = 'ＡＢＣＤＥ'
        # 全角小写 a-e
        fullwidth_lower = 'ａｂｃｄｅ'
        # 半角
        halfwidth = 'ABCDE'
        
        if letter in fullwidth_upper:
            return halfwidth[fullwidth_upper.index(letter)]
        if letter in fullwidth_lower:
            return halfwidth[fullwidth_lower.index(letter)]
        return letter.upper()
    
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
        
        # 在调用COM之前初始化
        pythoncom.CoInitialize()
        
        try:
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
        finally:
            pythoncom.CoUninitialize()
    
    def read_file(self, file_path):
        """读取文件内容"""
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.docx':
            return self.read_docx(file_path)
        elif ext == '.doc':
            return self.read_doc(file_path)
        else:
            raise Exception(f"不支持的文件格式: {ext}")
    
    def detect_question_type_line(self, text):
        """检测是否是题型标识行"""
        text = text.strip()
        for pattern in self.single_choice_patterns:
            if re.match(pattern, text):
                return 'single'
        for pattern in self.multi_choice_patterns:
            if re.match(pattern, text):
                return 'multi'
        return None
    
    def detect_chapter(self, text):
        """检测章节"""
        text = text.strip()
        for pattern in self.chapter_patterns:
            if re.match(pattern, text):
                # 记录章节顺序
                if text not in self.chapter_order:
                    self.chapter_order.append(text)
                return text
        return None
    
    def extract_answer(self, text):
        """从题目文本中提取答案"""
        for pattern in self.answer_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                # 取最后一个匹配的答案
                answer = matches[-1].upper().replace(' ', '')
                return list(answer)
        return []
    
    def has_answer_marker(self, text):
        """检查文本是否包含答案标记"""
        for pattern in self.answer_patterns:
            if re.search(pattern, text):
                return True
        return False
    
    def is_option_line(self, text):
        """判断是否是选项行（不含答案标记）"""
        text = text.strip()
        # 以选项字母开头（支持全角和半角），且不包含答案标记
        if re.match(self.option_start_pattern, text):
            # 确保这不是一个题目行（题目行会包含答案标记）
            if not self.has_answer_marker(text):
                return True
        # 包含多个选项（如 A 选项A    B 选项B），支持全角字母
        if re.search(r'[A-Ea-eＡ-Ｅａ-ｅ][\.、．\s]\s*\S+\s{2,}[A-Ea-eＡ-Ｅａ-ｅ][\.、．\s]', text):
            if not self.has_answer_marker(text):
                return True
        return False
    
    def clean_question_text(self, text):
        """清理题目文本，移除答案标记和题号"""
        cleaned = text
        # 移除答案标记，替换为空括号
        for pattern in self.answer_patterns:
            cleaned = re.sub(pattern, '（  ）', cleaned, count=1)
        # 移除题号
        cleaned = re.sub(self.question_number_pattern, '', cleaned)
        return cleaned.strip()
    
    def parse_options_from_line(self, text):
        """从一行中解析选项"""
        options = {}
        text = text.strip()
        
        # 尝试按多个空格分割（多选项在同一行）
        # 格式: A 选项A    B 选项B    C 选项C
        parts = re.split(r'\s{2,}', text)
        
        for part in parts:
            part = part.strip()
            if not part:
                continue
            # 匹配 A. 选项 或 A 选项 或 A、选项，支持全角字母
            match = re.match(r'^([A-Ea-eＡ-Ｅａ-ｅ])[\.、．\s]?\s*(.+)$', part)
            if match:
                key = self.normalize_option_letter(match.group(1))
                value = match.group(2).strip()
                if value:
                    options[key] = value
        
        # 如果上面没找到多个选项，尝试单选项解析
        if len(options) <= 1:
            match = re.match(r'^([A-Ea-eＡ-Ｅａ-ｅ])[\.、．\s]?\s*(.+)$', text)
            if match:
                key = self.normalize_option_letter(match.group(1))
                value = match.group(2).strip()
                if value:
                    options[key] = value
        
        return options
    
    def extract_bank_name(self, lines, file_path):
        """智能提取题库名称"""
        filename = os.path.basename(file_path)
        
        # 从文件名提取
        name_from_file = os.path.splitext(filename)[0]
        
        # 尝试从文件名中提取关键词
        patterns = [
            r'《([^》]+)》',  # 书名号内容
            r'(毛泽东思想[^题库\d]*)',
            r'(习近平[^题库\d]*思想[^题库\d]*概论)',
            r'([\u4e00-\u9fa5]+概论)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, name_from_file)
            if match:
                name = match.group(1)
                # 清理名称
                name = re.sub(r'\d{4}[-年]', '', name)
                name = re.sub(r'期末|题库|修订|学期', '', name)
                name = name.strip('_- 　()（）')
                if name and len(name) >= 4:
                    return name[:30]
        
        # 从文档内容提取
        for line in lines[:10]:
            line = line.strip()
            if not line or len(line) < 4:
                continue
            # 跳过题型标识
            if self.detect_question_type_line(line):
                continue
            # 跳过章节
            if self.detect_chapter(line):
                continue
            # 跳过包含答案的行（题目）
            if self.has_answer_marker(line):
                continue
            # 跳过选项行
            if self.is_option_line(line):
                continue
            
            # 尝试提取
            for pattern in patterns:
                match = re.search(pattern, line)
                if match:
                    return match.group(1)[:30]
            
            # 如果是合理长度的标题
            if 4 <= len(line) <= 40:
                return line[:30]
        
        # 最后使用清理后的文件名
        clean_name = re.sub(r'[\d\-_（）()]+', '', name_from_file)
        clean_name = clean_name.strip()
        if clean_name:
            return clean_name[:30]
        
        return name_from_file[:30]
    
    def parse_questions(self, file_path, bank_name=None):
        """解析题目文件"""
        lines = self.read_file(file_path)
        questions = []
        
        # 智能提取题库名称
        extracted_name = self.extract_bank_name(lines, file_path)
        if not bank_name:
            bank_name = extracted_name
        
        current_chapter = "默认章节"
        current_type = 'single'  # 默认单选
        current_question = None
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            if not line:
                i += 1
                continue
            
            # 检测章节
            chapter = self.detect_chapter(line)
            if chapter:
                current_chapter = chapter
                i += 1
                continue
            
            # 检测题型标识
            q_type = self.detect_question_type_line(line)
            if q_type:
                current_type = q_type
                i += 1
                continue
            
            # 检测题目行（包含答案标记的行）
            if self.has_answer_marker(line):
                # 保存上一题
                if current_question and current_question.get('options'):
                    questions.append(current_question)
                
                # 提取答案
                answer = self.extract_answer(line)
                # 清理题目文本
                question_text = self.clean_question_text(line)
                
                current_question = {
                    'chapter': current_chapter,
                    'type': current_type,
                    'question': question_text,
                    'options': {},
                    'answer': answer,
                    'bank': bank_name
                }
                i += 1
                continue
            
            # 解析选项
            if current_question and self.is_option_line(line):
                opts = self.parse_options_from_line(line)
                current_question['options'].update(opts)
                i += 1
                continue
            
            i += 1
        
        # 保存最后一题
        if current_question and current_question.get('options'):
            questions.append(current_question)
        
        # 后处理
        for idx, q in enumerate(questions):
            q['id'] = f"{abs(hash(file_path))}_{idx}"
            # 确保答案是列表
            if not q['answer']:
                q['answer'] = []
            # 根据答案数量自动判断题型
            if len(q['answer']) > 1:
                q['type'] = 'multi'
        
        return questions, extracted_name


def parse_file(file_path, bank_name=None):
    """解析题库文件的便捷函数"""
    parser = QuestionParser()
    return parser.parse_questions(file_path, bank_name)


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        questions, extracted_name = parse_file(sys.argv[1])
        print(f"题库名称: {extracted_name}")
        print(f"解析到 {len(questions)} 道题目")
        for q in questions[:5]:
            print(f"\n题目: {q['question'][:50]}...")
            print(f"类型: {'单选' if q['type'] == 'single' else '多选'}")
            print(f"选项: {list(q['options'].keys())}")
            print(f"答案: {q['answer']}")
