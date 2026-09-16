from pathlib import Path
p=Path('platforms/web/frontend/js/modules/parser.js');s=p.read_text(encoding='utf-8')
a=s.index('        const lines =');b=s.index('\n        const questions',a)
s=s[:a]+r'''        const lines = this.normalize(text).replace(/^\uFEFF/, '').split(/\r\n|\r|\n/).flatMap(line => {
            // Only split a pasted next question inside an option line, never decimal numbers in a stem.
            const embedded = line.match(/\s+(\d{2,4}[、．.]\s*.*?[（(]\s*[A-H?？ ]+\s*[）)]\s*)$/);
            return embedded && /^[A-Ha-h][.．、]/.test(line.trim()) ? [line.slice(0, embedded.index), embedded[1]] : [line];
        });'''+s[b:];p.write_text(s,encoding='utf-8')
p=Path('platforms/web/frontend/js/app.js');s=p.read_text(encoding='utf-8')
s=s.replace("""const response = await fetch(`${API_BASE}/api/questions/${questionId}`, {
                    method: 'DELETE'
                });
                const data = await response.json();""", "const data = await window.storageService.deleteQuestion(questionId);")
s=s.replace("""const response = await fetch(`${API_BASE}/api/questions/${questionId}`);
        const data = await response.json();""", "const data = await window.storageService.getQuestion(questionId);")
a=s.index('        const response = await fetch(`${API_BASE}/api/questions/${editingQuestionId}');b=s.index('        if (data.success)',a)
s=s[:a]+'''        const data = await window.storageService.updateQuestion(editingQuestionId, updateData);

'''+s[b:]
s=s.replace("answer: document.getElementById('edit-answer').value.toUpperCase().split('').filter(ch => options[ch])", "answer: window.questionParser.answer(document.getElementById('edit-answer').value, document.getElementById('edit-type').value === 'judge')")
a=s.index('    try {',s.index('async function saveQuestion()'))
s=s[:a]+'''    if (!updateData.question || !updateData.answer.length ||
        (updateData.type !== 'judge' && (Object.keys(options).length < 2 || updateData.answer.some(a => !options[a]))) ||
        (updateData.type === 'judge' && !['对','错'].includes(updateData.answer[0]))) {
        showToast('请填写题干、完整选项和有效答案；判断题使用对/错', 'warning'); return;
    }
    if (updateData.type === 'judge') updateData.options = {};

'''+s[a:]
s=s.replace("${item.value || ''}", "${escapeHtml(item.value || '').replace(/\"/g, '&quot;')}")
a=s.index('                if (isElectron)',s.index('function confirmClearWrongBank'));b=s.index('                if (data.success)',a)
s=s[:a]+'''                const loaded = await window.storageService.getWrongBook(bankName);
                if (!loaded.success) throw new Error(loaded.error);
                for (const question of loaded.questions) {
                    const removed = await window.storageService.removeWrongQuestion(question.id);
                    if (!removed.success) throw new Error(removed.error);
                }
                data = {success:true, message:'此题库错题已清空'};

'''+s[b:]
p.write_text(s,encoding='utf-8')
p=Path('platforms/web/static-site/js/static-adapter.js');s=p.read_text(encoding='utf-8');pos=s.index('        async getPracticeRandom')
s=s[:pos]+'''        async getQuestion(id) {
            await this.ensureLoaded();
            const question = Questions.getAllQuestions().find(q => q.id === id);
            return question ? {success:true, question} : {success:false, error:'题目不存在'};
        },
        async updateQuestion(id, changes) {
            return this.mutateQuestion(id, changes);
        },
        async deleteQuestion(id) {
            return this.mutateQuestion(id, null);
        },
        async mutateQuestion(id, changes) {
            await this.ensureLoaded();
            const next = structuredClone(Questions._data);
            let found = false;
            for (const bank of Object.values(next.banks)) {
                const index = bank.questions.findIndex(q => q.id === id);
                if (index < 0) continue;
                found = true;
                if (changes) Object.assign(bank.questions[index], changes, {id});
                else bank.questions.splice(index, 1);
            }
            if (!found) return {success:false, error:'题目不存在'};
            if (!Storage.setQuestions(next)) return {success:false, error:'存储失败，原题库未改变'};
            Questions._data = next;
            return {success:true};
        },
'''+s[pos:]
s=s.replace("Object.values(Storage.KEYS).forEach(key => localStorage.removeItem(key))", "['RANKINGS','WRONGBOOK','PROGRESS','PLAYER_NAME'].forEach(key => localStorage.removeItem(Storage.KEYS[key]))")
s=s.replace("if (chapter && chapter !== 'all' && chapter !== '') questions = questions.filter(q => q.chapter === chapter);", "if (chapter && chapter !== 'all' && chapter !== '') questions = questions.filter(q => q.chapter === chapter);\n            if (filters.type && filters.type !== 'all') questions = questions.filter(q => q.type === filters.type);",1)
p.write_text(s,encoding='utf-8')
p=Path('platforms/web/backend/app.py');s=p.read_text(encoding='utf-8').replace('CORS(app)', '''CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024

@app.errorhandler(413)
def file_too_large(error):
    return jsonify(success=False, error='文件超过 20 MB，请拆分后导入'), 413
''');p.write_text(s,encoding='utf-8')
