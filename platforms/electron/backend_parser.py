"""
题目解析器模块
用于解析.doc和.docx格式的题库文档
支持多种题目格式的智能识别
"""

import re
import os
import hashlib
from datetime import datetime
from docx import Document
from collections import OrderedDict

# 尝试导入win32com用于处理.doc文件
try:
    import win32com.client
    import pythoncom
    HAS_WIN32COM = True
except ImportError:
    HAS_WIN32COM = False


# 题库编号映射表 (可以在config.json中配置扩展)
BANK_CODE_MAP = {
    '毛泽东思想和中国特色社会主义理论体系概论': '01',
    '毛概': '01',
    '习近平新时代中国特色社会主义思想概论': '02',
    '习思想': '02',
    '思想道德与法治': '03',
    '思修': '03',
    '中国近代史纲要': '04',
    '纲要': '04',
    '近代史': '04',
    '马克思主义基本原理': '05',
    '马原': '05',
    '形势与政策': '06',
}


def get_bank_code(bank_name):
    """获取题库编号"""
    # 先尝试精确匹配
    if bank_name in BANK_CODE_MAP:
        return BANK_CODE_MAP[bank_name]
    # 再尝试模糊匹配
    for key, code in BANK_CODE_MAP.items():
        if key in bank_name or bank_name in key:
            return code
    # 默认返回99
    return '99'


def parse_semester_from_filename(filename):
    """
    从文件名解析学年学期信息
    支持格式: 2025-2026-1, 2025-2026（一）, 2025年秋季学期 等
    
    返回: (year_code, semester_code, semester_display)
    - year_code: 年份后两位，如 "25"
    - semester_code: 学期编号，"01" 或 "02"
    - semester_display: 显示文本，如 "2025-2026学年第一学期"
    """
    import re
    
    # 匹配 2025-2026-1 或 2025-2026（一）格式
    match = re.search(r'(\d{4})-(\d{4})[-—]?[（(]?([一二12])[）)]?', filename)
    if match:
        start_year = match.group(1)
        end_year = match.group(2)
        semester = match.group(3)
        
        year_code = start_year[2:]  # 取前一年的后两位，如2025->25
        if semester in ['一', '1']:
            semester_code = '01'
            semester_text = '第一学期'
        else:
            semester_code = '02'
            semester_text = '第二学期'
        
        semester_display = f"{start_year}-{end_year}学年{semester_text}"
        return year_code, semester_code, semester_display
    
    # 匹配 2025年秋季学期 或 2025年春季学期 格式
    match = re.search(r'(\d{4})年(秋季|春季|第一|第二)学期', filename)
    if match:
        year = match.group(1)
        season = match.group(2)
        
        if season in ['秋季', '第一']:
            year_code = year[2:]
            semester_code = '01'
            next_year = str(int(year) + 1)
            semester_display = f"{year}-{next_year}学年第一学期"
        else:
            # 春季学期属于上一学年的第二学期
            year_code = str(int(year) - 1)[2:]
            semester_code = '02'
            prev_year = str(int(year) - 1)
            semester_display = f"{prev_year}-{year}学年第二学期"
        
        return year_code, semester_code, semester_display
    
    # 匹配单独的年份，如 2025年4月
    match = re.search(r'(\d{4})年(\d{1,2})月', filename)
    if match:
        year = match.group(1)
        month = int(match.group(2))
        
        # 根据月份判断学期
        if month >= 9 or month <= 2:
            # 第一学期 (9月-次年2月)
            if month >= 9:
                year_code = year[2:]
                next_year = str(int(year) + 1)
                semester_display = f"{year}-{next_year}学年第一学期"
            else:
                prev_year = str(int(year) - 1)
                year_code = prev_year[2:]
                semester_display = f"{prev_year}-{year}学年第一学期"
            semester_code = '01'
        else:
            # 第二学期 (3月-8月)
            prev_year = str(int(year) - 1)
            year_code = prev_year[2:]
            semester_code = '02'
            semester_display = f"{prev_year}-{year}学年第二学期"
        
        return year_code, semester_code, semester_display
    
    # 默认使用当前日期
    now = datetime.now()
    year_code = now.strftime('%y')
    month = now.month
    
    if month >= 9 or month <= 2:
        semester_code = '01'
        if month >= 9:
            semester_display = f"{now.year}-{now.year+1}学年第一学期"
        else:
            semester_display = f"{now.year-1}-{now.year}学年第一学期"
    else:
        semester_code = '02'
        semester_display = f"{now.year-1}-{now.year}学年第二学期"
    
    return year_code, semester_code, semester_display


def get_semester_code():
    """获取学期编号 - 第一学期01，第二学期02（用于默认情况）"""
    month = datetime.now().month
    # 9-2月为第一学期，3-8月为第二学期
    if month >= 9 or month <= 2:
        return '01'
    else:
        return '02'


def generate_question_id(bank_name, question_index, year_code=None, semester_code=None):
    """
    生成题目编号
    格式: YYSSTBBB
    - YY: 年份后两位 (如25代表2025年)
    - SS: 学期 (01=第一学期, 02=第二学期)
    - T: 题库编号 (01=毛概, 02=习思想, 03=思修, 04=纲要...)
    - BBB: 题目序号 (001-999)
    
    例如: 250101001 表示 25年第一学期毛概第1题
    """
    if year_code is None:
        year_code = datetime.now().strftime('%y')  # 两位年份
    if semester_code is None:
        semester_code = get_semester_code()
    bank_code = get_bank_code(bank_name)
    question_num = str(question_index + 1).zfill(3)  # 从001开始
    
    return f"{year_code}{semester_code}{bank_code}{question_num}"


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
        # 判断题标识
        self.judge_choice_patterns = [
            r'^判断题[:：]?\s*$',
            r'^[一二三四五六七八九十][、\.．\s]\s*判断题[:：]?\s*$',
            r'^三[、\.\s\t]+判断题',
        ]
        # 判断题答案模式: (对) (错) （对） （错） (正确) (错误) 等
        self.judge_answer_patterns = [
            (r'[（(]\s*(对|正确|√|✓|T|t|true)\s*[）)]', '对'),
            (r'[（(]\s*(错|错误|×|✗|F|f|false)\s*[）)]', '错'),
        ]
        # 判断题独立答案行: 对、错、正确、错误 等单独占一行
        self.judge_standalone_pattern = r'^\s*(对|错|正确|错误|√|✓|×|✗)\s*$'
        # 章节标识
        self.chapter_patterns = [
            r'^第[一二三四五六七八九十百千\d]+章',
            r'^导论\s*$',
        ]
        # 题号模式
        self.question_number_pattern = r'^(\d+)[\.、．\s]\s*'
        
        # 答案提取模式 - 支持多种格式，包括字母间有空格的情况，支持 A-Z 选项
        self.answer_patterns = [
            r'[（(]\s*([A-Ha-hＡ-Ｈａ-ｈ](?:[\s、,，]*[A-Ha-hＡ-Ｈａ-ｈ])*)\s*[）)]',  # 括号内的字母（可能有空格分隔），支持全角
            r'\?\s*([A-Za-zＡ-Ｚａ-ｚ]+)',  # 匹配 ?D 或 ?ABC 格式（问号后跟答案字母），忽略问号
            r'[（(]\s*([A-Za-zＡ-Ｚａ-ｚ]{2,})\s*$',  # 行尾有左括号和答案但没有右括号闭合（多选题跨行格式）
        ]
        
        # 空答案标记模式 - 用于识别占位符
        self.empty_answer_marker = r'[（(]\s*[）)]'

        # 问号答案格式 - 用于 has_answer_marker 检测
        self.question_mark_answer_pattern = r'\?\s*[A-Za-zＡ-Ｚａ-ｚ]'
        
        # 独立答案行模式 - 如 "正确答案: A" 或 "答案: AB"
        self.standalone_answer_pattern = r'(?:正确|参考)?答案[:：]?\s*([A-Ha-hＡ-Ｈａ-ｈ](?:[\s、,，;；]*[A-Ha-hＡ-Ｈａ-ｈ])*)'
        
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
        # Read paragraphs and table cells in document order, including nested tables.
        from docx.oxml.ns import qn
        doc = Document(file_path)
        lines = []
        for paragraph in doc.element.body.iter(qn('w:p')):
            text = ''.join(node.text or '' for node in paragraph.iter(qn('w:t')))
            lines.extend(line.strip() for line in text.splitlines() if line.strip())
        return self._split_embedded_questions(lines)

    def read_doc(self, file_path):
        """读取.doc文件（需要Windows和Word）"""
        if not HAS_WIN32COM:
            raise Exception("需要安装pywin32并且系统中安装了Microsoft Word才能读取.doc文件")
        
        # 在调用COM之前初始化
        pythoncom.CoInitialize()
        
        try:
            word = win32com.client.DispatchEx("Word.Application")
            word.Visible = False
            try:
                doc = word.Documents.Open(os.path.abspath(file_path), ReadOnly=True, AddToRecentFiles=False)
                text = doc.Content.Text
                doc.Close(False)
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
        raw = open(file_path, 'rb').read()
        encodings = ['utf-16'] if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else ['utf-8-sig', 'gb18030']
        for encoding in encodings:
            try:
                text = raw.decode(encoding)
                if '\x00' in text:
                    raise ValueError('TXT 含有空字节，请另存为 UTF-8 或带 BOM 的 UTF-16')
                return self._split_embedded_questions([line.strip() for line in text.splitlines() if line.strip()])
            except UnicodeError:
                continue
        raise ValueError('无法识别 TXT 编码，请另存为 UTF-8')

    def _split_embedded_questions(self, lines):
        """拆分选项中嵌入了下一道题的行"""
        fixed = []
        for line in lines:
            # 检测行尾是否嵌入了题目（编号+答案标记），且行首包含选项字母
            m = re.search(r'\s+(\d{2,4})[、．\.]\s*.*?[（(]\s*[A-Za-z]+\s*[）)]\s*$', line)
            if m and re.search(r'^[A-Fa-f][.．、]', line):
                fixed.append(line[:m.start()].strip())
                fixed.append(line[m.start():].lstrip())
            else:
                fixed.append(line)
        return fixed
    
    def detect_question_type_line(self, text):
        """检测是否是题型标识行"""
        text = text.strip()
        for pattern in self.single_choice_patterns:
            if re.match(pattern, text):
                return 'single'
        for pattern in self.multi_choice_patterns:
            if re.match(pattern, text):
                return 'multi'
        for pattern in self.judge_choice_patterns:
            if re.match(pattern, text):
                return 'judge'
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
                answer_str = re.sub(r'[\s\?？、,，;；]', '', matches[-1])
                # 转换每个字母为标准格式
                answer = []
                for char in answer_str:
                    normalized = self.normalize_option_letter(char)
                    if normalized and normalized not in answer:
                        answer.append(normalized)
                return answer
        return []

    def extract_judge_answer(self, text):
        """从判断题文本中提取答案 返回 '对' 或 '错'"""
        standalone = re.fullmatch(r'(?:(?:正确|参考)?答案\s*[:：]?\s*)?(对|错|正确|错误|√|✓|×|✗)', text.strip())
        if standalone:
            return '对' if standalone.group(1) in ('对', '正确', '√', '✓') else '错'
        for pattern, answer_label in self.judge_answer_patterns:
            m = re.search(pattern, text)
            if m:
                return answer_label
        return None

    def clean_judge_text(self, text):
        """清理判断题文本，移除答案标记"""
        cleaned = text
        for pattern, _ in self.judge_answer_patterns:
            cleaned = re.sub(pattern, '（  ）', cleaned, count=1)
        cleaned = re.sub(self.question_number_pattern, '', cleaned)
        return cleaned.strip()
    
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
        # 检查判断题答案标记
        for pattern, _ in self.judge_answer_patterns:
            if re.search(pattern, text):
                return True
        return False
    
    def is_option_line(self, text):
        """判断是否是选项行（不含答案标记）"""
        text = text.strip()
        # 以选项字母开头（支持全角和半角），且不包含答案标记
        if re.match(self.option_start_pattern, text) or re.match(r'^([A-Za-z])[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]', text):
            # 确保这不是一个题目行（题目行会包含答案标记）
            if not self.has_answer_marker(text):
                # 检查选项内容是否有效（过滤如 "B. )" 这样的无效行）
                match = re.match(r'^[A-Za-zＡ-Ｚａ-ｚ][\.、．\s]+(.*)$', text)
                if match:
                    content = match.group(1).strip()
                    if self.is_invalid_option_content(content):
                        return False
                return True
        # 包含多个选项（如 A 选项A    B 选项B），支持全角字母 A-H
        if re.search(r'[A-Ha-hＡ-Ｈａ-ｈ][\.、．\s]\s*\S+\s{2,}[A-Ha-hＡ-Ｈａ-ｈ][\.、．\s]', text):
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
        # 清理嵌套括号：（（ ） ）或 (( ) ) 等情况，只保留外层括号
        # 匹配外层括号内包含内层括号的情况
        nested_bracket_pattern = r'[（(]\s*[（(]\s*[）)]\s*[）)]'
        cleaned = re.sub(nested_bracket_pattern, '（  ）', cleaned)
        return cleaned.strip()
    
    def parse_options_from_line(self, text):
        """从一行中解析选项
        
        核心策略：识别所有 A/B/C/D/E/F 选项字母，然后按这些字母分割文本
        支持格式：
        - A. 选项  B. 选项  （标准格式）
        - A、选项  B、选项  （顿号格式）
        - A 选项   B 选项   （空格格式）
        - A选项B选项C选项   （无分隔，选项字母后直接跟中文）
        - A. 高质量 B. 高速度C. 高水平 D.高效率  （混合格式）
        """
        options = {}
        text = text.strip()
        
        if not text:
            return options
        
        # 查找所有选项字母的位置
        # 选项字母的特征：A-H（半角或全角），后面跟点号/顿号/空格/中文
        option_positions = []
        
        i = 0
        while i < len(text):
            char = text[i]
            normalized = self.normalize_option_letter(char)
            
            # 检查是否是有效的选项字母 A-H（支持最多8个选项）
            if normalized in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']:
                # 检查后面的字符来确认这是选项开头
                if i + 1 < len(text):
                    next_char = text[i + 1]
                    
                    # 情况1: 后跟点号、顿号（最可靠的选项标识，无条件识别）
                    if next_char in '.、．。':
                        content_start = i + 2
                        # 跳过点号后的空格
                        while content_start < len(text) and text[content_start] in ' \t　':
                            content_start += 1
                        option_positions.append((i, normalized, content_start))
                        i = content_start
                        continue
                    
                    # 情况2: 后跟空格（如 "A 选项"）- 需要前面也是行首或空格
                    elif next_char in ' \t　':
                        # 只有在行首或前面是空格/标点时才识别为选项
                        if i == 0 or text[i-1] in ' \t　.、．。）)':
                            content_start = i + 1
                            while content_start < len(text) and text[content_start] in ' \t　':
                                content_start += 1
                            option_positions.append((i, normalized, content_start))
                            i = content_start
                            continue
                    
                    # 情况3: 后面直接跟中文字符或中文标点（如 "A高质量"、"D马克思"、"D《中法"）
                    elif '\u4e00' <= next_char <= '\u9fff' or '\u3000' <= next_char <= '\u303f' or '\uff00' <= next_char <= '\uffef':
                        # 仅当字母位于行首或紧接分隔符（空格/标点）时才视为选项开头
                        # 避免 "适用A国"、"B超" 等内容中的字母被误识别为选项
                        if i == 0 or text[i-1] in ' \t　.、．。）)':
                            option_positions.append((i, normalized, i + 1))
                            i += 1
                            continue
                    
                    # 情况4: 后面直接跟数字（如 "D15"、"C12"）
                    elif next_char.isdigit():
                        # 仅当字母位于行首或紧接分隔符时才视为选项开头
                        if i == 0 or text[i-1] in ' \t　.、．。）)':
                            option_positions.append((i, normalized, i + 1))
                            i += 1
                            continue
            i += 1
        
        # 根据找到的位置提取选项内容
        for idx, (pos, key, content_start) in enumerate(option_positions):
            # 内容结束位置是下一个选项的开始位置，或字符串末尾
            if idx + 1 < len(option_positions):
                content_end = option_positions[idx + 1][0]
            else:
                content_end = len(text)
            
            # 提取内容并清理
            value = text[content_start:content_end].strip()
            if value and not self.is_invalid_option_content(value):
                options[key] = value
        
        # 如果上面的方法找到了至少2个选项，直接返回
        if len(options) >= 2:
            self._clean_options_embedded_questions(options)
            return options
        
        # 备用方法: 使用正则匹配标准格式
        options = {}
        # 标准格式: A. 或 A、或 A．后跟内容
        option_pattern = r'(?:^|(?<=\s))([A-Ha-hＡ-Ｈａ-ｈ])[\.、．]\s*'
        matches = list(re.finditer(option_pattern, text))
        
        if matches:
            for i, match in enumerate(matches):
                key = self.normalize_option_letter(match.group(1))
                start = match.end()
                if i + 1 < len(matches):
                    end = matches[i + 1].start()
                else:
                    end = len(text)
                
                value = text[start:end].strip()
                if value and not self.is_invalid_option_content(value):
                    options[key] = value
        
        self._clean_options_embedded_questions(options)
        return options
    
    def _clean_options_embedded_questions(self, options):
        """清理选项值中嵌入的后续题目文本"""
        if not options:
            return
        for key, value in list(options.items()):
            if not value:
                continue
            # 检测选项值末尾是否嵌入了下一道题的编号+答案
            # 如 "D. xxx 240、1945年学生发动...（ D ）"
            m = re.search(r'\s*(\d{2,4})[、．\.]\s*[^\d].*?[（(]\s*[A-Za-z]+\s*[）)]\s*$', value)
            if m:
                options[key] = value[:m.start()].rstrip()

    def is_invalid_option_content(self, content):
        """检查选项内容是否无效（如纯括号、空白等）"""
        if not content:
            return True
        # 去除所有空白和括号后检查是否为空
        cleaned = re.sub(r'[\s\(\)\[\]\{\}（）【】\u0000-\u001f]', '', content)
        # 如果清理后为空或只剩下标点符号，则无效
        if not cleaned or re.match(r'^[\.\,\;\:\!\?。，；：！？、]+$', cleaned):
            return True
        # 如果只有单个字符且是标点，无效
        if len(cleaned) == 1 and not cleaned.isalnum():
            return True
        return False
    
    def parse_multiline_options(self, lines, start_index):
        """解析多行选项
        
        核心策略：先收集所有选项相关的行，合并成一个字符串（忽略换行），
        然后按选项字母(A/B/C/D/E)分割。
        
        这样可以处理以下情况：
        - AB在一行，CD在另一行
        - ABC在一行，D的内容在另一行
        - 每个选项单独一行
        
        返回: (options_dict, end_index)
        """
        collected_lines = []
        i = start_index
        
        while i < len(lines):
            line = lines[i].strip()
            
            # 跳过空行
            if not line:
                i += 1
                continue
            
            # 检查是否是新题目（题号开头且不是选项行）
            if re.match(self.question_number_pattern, line) and not self.is_option_line(line):
                break
            
            # 检查是否是题型标识或章节
            if self.detect_question_type_line(line) or self.detect_chapter(line):
                break
            
            # 检查是否是独立答案行
            if re.search(self.standalone_answer_pattern, line, re.IGNORECASE):
                break
            
            # 收集这行
            collected_lines.append(line)
            i += 1
        
        # 合并所有行为一个字符串（用空格连接，忽略原有换行）
        merged_text = ' '.join(collected_lines)
        
        # 使用增强的单行解析
        options = self.parse_options_from_line(merged_text)
        
        return options, i
    
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
                first_option_line_index = -1  # 记录第一个选项行的位置
                
                while j < len(lines) and j < i + 15:  # 最多向后看15行
                    next_line = lines[j].strip()
                    if not next_line:
                        j += 1
                        continue
                    
                    # 遇到新题号则停止（排除选项行）
                    if re.match(self.question_number_pattern, next_line) and not self.is_option_line(next_line):
                        break
                    
                    # 检查判断题独立答案行（优先于通用答案标记，避免 "（对）"、"（错）" 被误吞）
                    if current_type == 'judge':
                        judge_ans = self.extract_judge_answer(next_line)
                        if judge_ans:
                            answer_found = [judge_ans]
                            has_standalone_answer = True
                            # 如果答案行前面还有题干文字（如 "等思想观点（错）"），追加到题目行
                            ans_pos = next_line.find('（') if '（' in next_line else next_line.find('(')
                            if ans_pos > 0:
                                prefix = next_line[:ans_pos].strip()
                                if prefix and not re.match(r'^\s*(\d+)[、．.\s]', prefix):
                                    question_lines.append(prefix)
                            j += 1
                            break
                    
                    # 检查这行是否包含括号答案（且不是选项行）
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
                            answer_str = re.sub(r'[\s、,，;；]', '', answer_match.group(1))
                            for char in answer_str:
                                normalized = self.normalize_option_letter(char)
                                if normalized and normalized not in answer_found:
                                    answer_found.append(normalized)
                        break
                    
                    # 检查选项行
                    if self.is_option_line(next_line):
                        has_options = True
                        if first_option_line_index == -1:
                            first_option_line_index = j  # 记录第一个选项行位置
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
                    
                    # 如果有选项行，从第一个选项行开始继续处理
                    # 这样后续的选项解析逻辑会处理这些选项
                    if first_option_line_index > 0:
                        i = first_option_line_index
                    else:
                        i = j
                    continue
            
            # 检测题目行（包含答案标记的行）
            if self.has_answer_marker(line):
                # 判断是否为判断题
                is_judge = current_type == 'judge' or (self.extract_judge_answer(line) is not None and not self.extract_answer(line))
                
                # 保存上一题
                if current_question and (current_question.get('options') or current_question.get('question')):
                    questions.append(current_question)
                
                if is_judge:
                    answer = [self.extract_judge_answer(line)]
                    # 如果该行纯粹是一个判断题答案标签（只有编号+答案，如"（对）""（错）"），
                    # 且上一题还没有设置答案，则将答案补到上一题，不创建新题目
                    is_pure_answer_line = re.match(r'^\s*[（(]\s*(对|错|正确|错误|√|×|T|F|true|false)\s*[）)]\s*$', line)
                    if is_pure_answer_line and current_question and not current_question.get('answer'):
                        current_question['answer'] = answer
                        current_question['type'] = current_question.get('type') or 'judge'
                        i += 1
                        continue
                    
                    question_text = self.clean_judge_text(line)
                    current_question = {
                        'chapter': current_chapter,
                        'type': 'judge',
                        'question': question_text,
                        'options': {},
                        'answer': answer,
                        'bank': bank_name
                    }
                else:
                    answer = self.extract_answer(line)
                    question_text = self.clean_question_text(line)
                    current_question = {
                        'chapter': current_chapter,
                        'type': current_type,
                        'question': question_text,
                        'options': {},
                        'answer': answer,
                        'bank': bank_name
                    }
                    # 检查题目行末尾是否有选项
                    opts = self.parse_options_from_line(line)
                    if opts:
                        current_question['options'].update(opts)
                
                i += 1
                continue

            # 检测判断题独立答案行（如单独一行的 "对"、"错"、"（对）"、"（错）"）
            if current_question and not current_question.get('answer'):
                judge_answer = self.extract_judge_answer(line)
                if judge_answer:
                    current_question['answer'] = [judge_answer]
                    current_question['type'] = 'judge' if current_type == 'judge' else current_question.get('type', 'judge')
                    i += 1
                    continue
            
            # 检测独立答案行（如 "正确答案: A"）
            if current_question and not current_question.get('answer'):
                answer_match = re.search(self.standalone_answer_pattern, line, re.IGNORECASE)
                if answer_match:
                    answer_str = re.sub(r'[\s、,，;；]', '', answer_match.group(1))
                    answer = []
                    for char in answer_str:
                        normalized = self.normalize_option_letter(char)
                        if normalized and normalized not in answer:
                            answer.append(normalized)
                    current_question['answer'] = answer
                    i += 1
                    continue
            
            # 解析选项（使用多行解析）
            if current_question and self.is_option_line(line):
                # 使用多行选项解析，从当前行开始
                opts, new_i = self.parse_multiline_options(lines, i)
                if opts:
                    current_question['options'].update(opts)
                    i = new_i
                    continue
                else:
                    # 如果多行解析失败，回退到单行解析
                    opts = self.parse_options_from_line(line)
                    current_question['options'].update(opts)
                    i += 1
                    continue
            
            i += 1
        
        # 保存最后一题
        if current_question and (current_question.get('options') or current_question.get('question')):
            questions.append(current_question)
        
        # 从文件名解析学期信息
        filename = os.path.basename(file_path)
        year_code, semester_code, semester_display = parse_semester_from_filename(filename)
        
        # 后处理 - 生成规范的题目编号
        for idx, q in enumerate(questions):
            q['id'] = generate_question_id(bank_name or extracted_name, idx, year_code, semester_code) + '-' + hashlib.sha256(bank_name.encode('utf-8')).hexdigest()[:12]
            q['legacy_id'] = f"{abs(hash(file_path))}_{idx}"
            if not q['answer']:
                q['answer'] = []
            # 根据答案数量自动判断题型（判断题不参与此逻辑）
            if q.get('type') != 'judge' and len(q['answer']) > 1:
                q['type'] = 'multi'
        
        # 返回题目列表、题库名称和学期信息
        warnings = []
        valid = []
        for index, q in enumerate(questions, 1):
            if (not q['answer'] or any(a is None for a in q['answer']) or
                (q['type'] != 'judge' and (len(q['options']) < 2 or any(a not in q['options'] for a in q['answer'])))):
                warnings.append(f"第 {index} 题「{q['question'][:25]}」缺少有效答案或完整选项，已跳过")
            else:
                valid.append(q)
        return valid, extracted_name, semester_display, warnings


def parse_file(file_path, bank_name=None, with_warnings=False):
    """解析题库文件的便捷函数"""
    parser = QuestionParser()
    result = parser.parse_questions(file_path, bank_name)
    return result if with_warnings else result[:3]


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        result = parse_file(sys.argv[1])
        questions = result[0]
        extracted_name = result[1]
        semester_display = result[2] if len(result) > 2 else '未知学期'
        print(f"题库名称: {extracted_name}")
        print(f"学期: {semester_display}")
        print(f"解析到 {len(questions)} 道题目")
        for q in questions[:5]:
            print(f"\n题目ID: {q['id']}")
            print(f"题目: {q['question'][:50]}...")
            print(f"类型: {'单选' if q['type'] == 'single' else '多选'}")
            print(f"选项: {list(q['options'].keys())}")
            print(f"答案: {q['answer']}")
