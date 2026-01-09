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
        # 单选题标识 - 更全面的模式
        self.single_choice_patterns = [
            r'^单项选择题[:：]?\s*$',
            r'^单选题[:：]?\s*$',
            r'^[一二三四五六七八九十][、\.．\s]\s*单项选择题[:：]?\s*$',
            r'^[一二三四五六七八九十][、\.．\s]\s*单选题[:：]?\s*$',
            r'^一[、\.\s\t]+单项选择题',
            r'^一[、\.\s\t]+单选题',
        ]
        # 多选题标识 - 更全面的模式
        self.multi_choice_patterns = [
            r'^多项选择题[:：]?\s*$',
            r'^多选题[:：]?\s*$',
            r'^[一二三四五六七八九十][、\.．\s]\s*多项选择题[:：]?\s*$',
            r'^[一二三四五六七八九十][、\.．\s]\s*多选题[:：]?\s*$',
            r'^二[、\.\s\t]+多项选择题',
            r'^二[、\.\s\t]+多选题',
        ]
        # 章节标识
        self.chapter_patterns = [
            r'^第[一二三四五六七八九十百千\d]+章',
            r'^导论\s*$',
        ]
        # 题号模式
        self.question_number_pattern = r'^(\d+)[\.、．\s]\s*'
        
        # 答案提取模式 - 支持多种格式，包括字母间有空格的情况，支持 A-Z 选项
        self.answer_patterns = [
            r'[（(]\s*([A-Za-zＡ-Ｚａ-ｚ](?:\s*[A-Za-zＡ-Ｚａ-ｚ])*)\s*[）)]',  # 括号内的字母（可能有空格分隔），支持全角
            r'\?\s*([A-Za-zＡ-Ｚａ-ｚ]+)',  # 匹配 ?D 或 ?ABC 格式（问号后跟答案字母），忽略问号
            r'[（(]\s*([A-Za-zＡ-Ｚａ-ｚ]{2,})\s*$',  # 行尾有左括号和答案但没有右括号闭合（多选题跨行格式）
        ]
        
        # 空答案标记模式 - 用于识别占位符
        self.empty_answer_marker = r'[（(]\s*[）)]'

        # 问号答案格式 - 用于 has_answer_marker 检测
        self.question_mark_answer_pattern = r'\?\s*[A-Za-zＡ-Ｚａ-ｚ]'
        
        # 独立答案行模式 - 如 "正确答案: A" 或 "答案: AB"
        self.standalone_answer_pattern = r'(?:正确)?答案[:：]?\s*([A-Za-zＡ-Ｚａ-ｚ]+)'
        
        # 选项模式 - 支持半角和全角字母，A-Z
        self.option_start_pattern = r'^([A-Za-zＡ-Ｚａ-ｚ])[\.、．\s]'
        
        # 用于记录章节顺序
        self.chapter_order = []
    
    def normalize_option_letter(self, letter):
        """将全角字母转换为半角大写"""
        # 全角大写 A-Z
        fullwidth_upper = 'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ'
        # 全角小写 a-z
        fullwidth_lower = 'ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ'
        # 半角
        halfwidth = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        
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
        elif ext == '.txt':
            return self.read_txt(file_path)
        else:
            raise Exception(f"不支持的文件格式: {ext}")
    
    def read_txt(self, file_path):
        """读取TXT文件"""
        # 尝试不同编码
        encodings = ['utf-8', 'gbk', 'gb2312', 'utf-16', 'ansi']
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    text = f.read()
                lines = [line.strip() for line in text.split('\n') if line.strip()]
                return lines
            except (UnicodeDecodeError, UnicodeError):
                continue
        raise Exception("无法识别TXT文件编码")
    
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
                # 清理空格和遗留的问号（Word 转 TXT 可能残留 ?）
                answer_str = re.sub(r'[\s\?？]', '', matches[-1])
                # 转换每个字母为标准格式
                answer = []
                for char in answer_str:
                    normalized = self.normalize_option_letter(char)
                    if normalized and normalized not in answer:
                        answer.append(normalized)
                return answer
        return []
    
    def has_answer_marker(self, text):
        """检查文本是否包含答案标记（包括空标记）"""
        for pattern in self.answer_patterns:
            if re.search(pattern, text):
                return True
        # 检查空答案标记
        if re.search(self.empty_answer_marker, text):
            return True
        # 检查问号答案格式 ?D
        if re.search(self.question_mark_answer_pattern, text):
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
        # 包含多个选项（如 A 选项A    B 选项B），支持全角字母 A-F
        if re.search(r'[A-Fa-fＡ-Ｆａ-ｆ][\.、．\s]\s*\S+\s{2,}[A-Fa-fＡ-Ｆａ-ｆ][\.、．\s]', text):
            if not self.has_answer_marker(text):
                return True
        return False
    
    def clean_question_text(self, text):
        """清理题目文本，移除答案标记和题号"""
        cleaned = text
        # 移除答案标记，替换为空括号 - 支持全角字母 A-Z
        answer_clean_pattern = r'[（(]\s*[A-Za-zＡ-Ｚａ-ｚ](?:\s*[A-Za-zＡ-Ｚａ-ｚ])*\s*[）)]'
        cleaned = re.sub(answer_clean_pattern, '（  ）', cleaned, count=1)
        # 移除问号格式答案 ?D -> （  ）
        question_mark_answer = r'\?\s*[A-Za-zＡ-Ｚａ-ｚ]+'
        cleaned = re.sub(question_mark_answer, '（  ）', cleaned, count=1)
        # 移除题号
        cleaned = re.sub(self.question_number_pattern, '', cleaned)
        return cleaned.strip()
    
    def parse_options_from_line(self, text):
        """从一行中解析选项"""
        options = {}
        text = text.strip()
        
        if not text:
            return options
        
        # 方法1: 使用选项字母作为分隔符来分割
        # 支持格式:
        # - A. A、A．(标准格式，带点号/顿号)
        # - D15 (数字紧跟字母，无分隔符，如 "C. 12 D15")
        # - A中文 (中文紧跟字母，无分隔符)
        # 选项字母可以在行首，或者前面是空格/中文字符/数字
        # 匹配: 字母 + (点号/顿号/空格 或 后面直接跟数字/中文)，允许 A-Z
        option_pattern = r'(?:^|(?<=[\s\u4e00-\u9fa50-9]))([A-Za-zＡ-Ｚａ-ｚ])(?:[\.、．\s]|(?=\d)|(?=[\u4e00-\u9fa5]))'
        
        # 找到所有选项的位置
        matches = list(re.finditer(option_pattern, text))
        
        if matches:
            for i, match in enumerate(matches):
                key = self.normalize_option_letter(match.group(1))
                # 选项内容的起始位置（选项字母+分隔符之后）
                start = match.end()
                # 结束位置是下一个选项的开始，或者字符串末尾
                if i + 1 < len(matches):
                    end = matches[i + 1].start()
                else:
                    end = len(text)
                
                value = text[start:end].strip()
                if value:
                    options[key] = value
        
        # 方法2: 如果方法1没找到，尝试按多个空格分割
        if not options:
            parts = re.split(r'\s{2,}', text)
            for part in parts:
                part = part.strip()
                if not part:
                    continue
                # 匹配 A. 选项 或 A 选项 或 A、选项，支持全角字母 A-Z
                match = re.match(r'^([A-Za-zＡ-Ｚａ-ｚ])[\.、．\s]?\s*(.*)$', part)
                if match:
                    key = self.normalize_option_letter(match.group(1))
                    value = match.group(2).strip()
                    if value:
                        options[key] = value
        
        # 方法3: 如果还是没找到多个选项，尝试单选项解析
        if len(options) <= 1:
            match = re.match(r'^([A-Za-zＡ-Ｚａ-ｚ])[\.、．\s]?\s*(.*)$', text)
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
            r'(中国近代史纲要)',
            r'(思想道德与法治)',
            r'纲要.*?选择题',  # 匹配《纲要》选择题
            r'思修',  # 匹配思修
            r'([\u4e00-\u9fa5]+概论)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, name_from_file)
            if match:
                name = match.group(1) if match.lastindex else match.group(0)
                # 特殊处理：毛概 -> 毛泽东思想和中国特色社会主义理论体系概论
                if name == '毛概':
                    name = '毛泽东思想和中国特色社会主义理论体系概论'
                # 特殊处理：纲要 -> 中国近代史纲要
                if '纲要' in name and '中国近代史' not in name:
                    name = '中国近代史纲要'
                # 特殊处理：思修 -> 思想道德与法治
                if '思修' in name:
                    name = '思想道德与法治'
                # 清理名称
                name = re.sub(r'\d{4}[-年]', '', name)
                name = re.sub(r'期末|题库|修订|学期|选择题|年月|最新', '', name)
                name = name.strip('_- 　()（）')
                if name and len(name) >= 2:
                    return name[:50]
        
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
            # 跳过独立答案行
            if re.search(self.standalone_answer_pattern, line, re.IGNORECASE):
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
            
            # 检测题号开头但无括号答案的题目行（如 "79、刑法中关于紧急避险..."）
            # 这类题目的答案可能在后续行（括号形式或独立答案行如 "答案：ABCD"）
            num_match = re.match(self.question_number_pattern, line)
            if num_match and not self.has_answer_marker(line) and not self.is_option_line(line):
                # 向后查找，收集多行题目内容
                j = i + 1
                question_lines = [line]  # 收集所有题目行
                answer_found = []
                answer_in_bracket = False  # 答案是否在括号中
                has_options = False
                has_standalone_answer = False
                
                while j < len(lines) and j < i + 15:  # 最多向后看15行
                    next_line = lines[j].strip()
                    if not next_line:
                        j += 1
                        continue
                    
                    # 遇到新题号则停止（排除选项行）
                    if re.match(self.question_number_pattern, next_line) and not self.is_option_line(next_line):
                        break
                    
                    # 检查这行是否包含括号答案
                    if self.has_answer_marker(next_line) and not self.is_option_line(next_line):
                        # 这是题目的延续行，包含答案
                        question_lines.append(next_line)
                        answer_found = self.extract_answer(next_line)
                        answer_in_bracket = True
                        j += 1
                        continue
                    
                    # 检查独立答案行
                    if re.search(self.standalone_answer_pattern, next_line, re.IGNORECASE):
                        has_standalone_answer = True
                        answer_match = re.search(self.standalone_answer_pattern, next_line, re.IGNORECASE)
                        if answer_match:
                            answer_str = answer_match.group(1).replace(' ', '')
                            for char in answer_str:
                                normalized = self.normalize_option_letter(char)
                                if normalized and normalized not in answer_found:
                                    answer_found.append(normalized)
                        break
                    
                    # 检查选项行
                    if self.is_option_line(next_line):
                        has_options = True
                        j += 1
                        continue
                    
                    # 如果不是选项行也不是新题目，可能是题目续行
                    if not self.is_option_line(next_line):
                        question_lines.append(next_line)
                    
                    j += 1
                
                # 如果找到了答案（括号形式或独立答案行），则认为是新题目
                if answer_found or (has_options and has_standalone_answer):
                    # 保存上一题
                    if current_question and (current_question.get('options') or current_question.get('question')):
                        questions.append(current_question)
                    
                    # 合并多行题目内容
                    full_question = ' '.join(question_lines)
                    question_text = self.clean_question_text(full_question)
                    
                    current_question = {
                        'chapter': current_chapter,
                        'type': current_type,
                        'question': question_text,
                        'options': {},
                        'answer': answer_found,
                        'bank': bank_name
                    }
                    
                    # 跳过已经处理的行（跳到j的位置继续），避免重复识别
                    # j 已经指向下一个未处理的行或选项行
                    i = j
                    continue
            
            # 检测题目行（包含答案标记的行）
            if self.has_answer_marker(line):
                # 保存上一题（即使选项解析不全，也不丢题目）
                if current_question and (current_question.get('options') or current_question.get('question')):
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
                
                # 检查题目行末尾是否有选项（如 "题目（ ）A. 选项A"）
                opts = self.parse_options_from_line(line)
                if opts:
                    current_question['options'].update(opts)
                
                i += 1
                continue
            
            # 检测独立答案行（如 "正确答案: A"）
            if current_question and not current_question.get('answer'):
                answer_match = re.search(self.standalone_answer_pattern, line, re.IGNORECASE)
                if answer_match:
                    answer_str = answer_match.group(1).replace(' ', '')
                    answer = []
                    for char in answer_str:
                        normalized = self.normalize_option_letter(char)
                        if normalized and normalized not in answer:
                            answer.append(normalized)
                    current_question['answer'] = answer
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
        if current_question and (current_question.get('options') or current_question.get('question')):
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
