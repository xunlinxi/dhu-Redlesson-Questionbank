"""
工具函数模块
"""

import os


def convert_word_to_txt(file_path):
    """将 Word 文档转换为 TXT 文件"""
    ext = os.path.splitext(file_path)[1].lower()
    txt_path = file_path.rsplit('.', 1)[0] + '.txt'
    
    if ext == '.docx':
        # 使用 python-docx 读取
        from docx import Document
        doc = Document(file_path)
        text_content = []
        for para in doc.paragraphs:
            text_content.append(para.text)
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(text_content))
    elif ext == '.doc':
        # 使用 pywin32 读取
        import pythoncom
        import win32com.client
        pythoncom.CoInitialize()
        try:
            word = win32com.client.Dispatch("Word.Application")
            word.Visible = False
            try:
                doc = word.Documents.Open(os.path.abspath(file_path))
                text = doc.Content.Text
                doc.Close()
                with open(txt_path, 'w', encoding='utf-8') as f:
                    f.write(text.replace('\r', '\n'))
            finally:
                word.Quit()
        finally:
            pythoncom.CoUninitialize()
    
    return txt_path
