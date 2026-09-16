from pathlib import Path
p=Path('platforms/web/backend/parser.py')
s=p.read_text(encoding='utf-8')
s=s.replace('import os\n', 'import os\nimport hashlib\n')
a=s.index('        doc = Document(file_path)',s.index('    def read_docx'))
b=s.index('    def read_doc(',a)
s=s[:a]+'''        # Read paragraphs and table cells in document order, including nested tables.
        from docx.oxml.ns import qn
        doc = Document(file_path)
        lines = []
        for paragraph in doc.element.body.iter(qn('w:p')):
            text = ''.join(node.text or '' for node in paragraph.iter(qn('w:t')))
            lines.extend(line.strip() for line in text.splitlines() if line.strip())
        return self._split_embedded_questions(lines)

'''+s[b:]
s=s.replace('win32com.client.Dispatch("Word.Application")','win32com.client.DispatchEx("Word.Application")').replace('word.Documents.Open(file_path)','word.Documents.Open(os.path.abspath(file_path), ReadOnly=True, AddToRecentFiles=False)').replace('doc.Close()','doc.Close(False)')
a=s.index('        # 尝试不同编码',s.index('    def read_txt'))
b=s.index('    def _split_embedded_questions',a)
s=s[:a]+'''        raw = open(file_path, 'rb').read()
        encodings = ['utf-16'] if raw.startswith((b'\\xff\\xfe', b'\\xfe\\xff')) else ['utf-8-sig', 'gb18030']
        for encoding in encodings:
            try:
                text = raw.decode(encoding)
                if '\\x00' in text:
                    raise ValueError('TXT 含有空字节，请另存为 UTF-8 或带 BOM 的 UTF-16')
                return self._split_embedded_questions([line.strip() for line in text.splitlines() if line.strip()])
            except UnicodeError:
                continue
        raise ValueError('无法识别 TXT 编码，请另存为 UTF-8')

'''+s[b:]
s=s.replace("r'(?:正确)?答案[:：]?\\s*([A-Za-zＡ-Ｚａ-ｚ]+)'", "r'(?:正确|参考)?答案[:：]?\\s*([A-Ha-hＡ-Ｈａ-ｈ](?:[\\s、,，;；]*[A-Ha-hＡ-Ｈａ-ｈ])*)'")
s=s.replace("answer_match.group(1).replace(' ', '')", "re.sub(r'[\\s、,，;；]', '', answer_match.group(1))")
s=s.replace("r'[（(]\\s*([A-Za-zＡ-Ｚａ-ｚ](?:\\s*[A-Za-zＡ-Ｚａ-ｚ])*)\\s*[）)]'", "r'[（(]\\s*([A-Ha-hＡ-Ｈａ-ｈ](?:[\\s、,，]*[A-Ha-hＡ-Ｈａ-ｈ])*)\\s*[）)]'")
# Normalize separators before existing answer extraction and question cleanup.
s=s.replace("answer_str = match.group(1)","answer_str = re.sub(r'[、,，;；]', '', match.group(1))")
s=s.replace("q['id'] = generate_question_id(bank_name or extracted_name, idx, year_code, semester_code)", "q['id'] = generate_question_id(bank_name or extracted_name, idx, year_code, semester_code) + '-' + hashlib.sha256(bank_name.encode('utf-8')).hexdigest()[:12]")
p.write_text(s,encoding='utf-8')
# Validate count parameters before parsing instead of leaking ValueError / negative sampling.
p=Path('platforms/web/backend/routes/practice.py');s=p.read_text(encoding='utf-8');pos=s.index("\n\n@practice_bp.route")
s=s[:pos]+'''

@practice_bp.before_request
def validate_counts():
    for key in ('count', 'single_count', 'multi_count', 'judge_count'):
        value = request.args.get(key)
        if value not in (None, ''):
            if not value.isascii() or not value.isdigit() or len(value) > 6:
                return jsonify(success=False, error=f'{key} 必须为非负整数（最多六位）'), 400
'''+s[pos:];p.write_text(s,encoding='utf-8')
# Use per-request temp directories, preserve filename metadata, always clean up.
p=Path('platforms/web/backend/routes/banks.py');s=p.read_text(encoding='utf-8').replace('import os\n','import os\nimport tempfile\nimport shutil\n')
s=s.replace("    try:\n        original_filename", "    temporary_dir = None\n    try:\n        original_filename")
s=s.replace("file_path = os.path.join(UPLOAD_FOLDER, safe_filename)", "temporary_dir = tempfile.mkdtemp(prefix='import-', dir=UPLOAD_FOLDER)\n        file_path = os.path.join(temporary_dir, safe_filename)")
s=s.replace("        if ext in ['.doc', '.docx']:\n            txt_file_path = convert_word_to_txt(file_path)", "        # Parser reads Word directly so table cells are not lost during conversion.")
s += "\n    finally:\n        if temporary_dir:\n            shutil.rmtree(temporary_dir, ignore_errors=True)\n"
p.write_text(s,encoding='utf-8')
# Correct test stub (actual selection accesses contains).
p=Path('scripts/test-frontend.cjs');s=p.read_text(encoding='utf-8-sig').replace('toggle(){}','toggle(){},contains(){return false}');p.write_text(s,encoding='utf-8')
