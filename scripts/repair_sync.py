from pathlib import Path
p=Path('platforms/web/frontend/js/modules/parser.js');s=p.read_text(encoding='utf-8-sig')
s=s.replace("this.normalize(text).trim()", "this.normalize(text).replace(/[?？]/g, '').trim()")
s=s.replace("const questions = [];", "const questions = [];\n        this.warnings = [];")
s=s.replace("const lines = this.normalize(text).replace(/^\\uFEFF/, '').split", "const lines = this.normalize(text).replace(/^\\uFEFF/, '').replace(/([^\\n])([0-9]{1,3}[、．.]\\s*[^\\n]{0,180}[（(][ A-H?？]+[）)])/g, '$1\\n$2').split")
s=s.replace("const finish = () => {", "const finalize = () => {")
s=s.replace("        const consume = line => {", """        const finish = () => {
            try { finalize(); }
            catch (error) { this.warnings.push(error.message); current = null; }
        };
        const consume = line => {""")
s=s.replace("([A-Ha-h])\\s+/g", "([A-Ha-h])(?:\\s+|(?=[\\u4e00-\\u9fff]))/g")
s=s.replace("if (!questions.length) throw new Error('没有识别到题目，请使用“1、题干（A）”与“A.选项”的格式');", "if (!questions.length) throw new Error(this.warnings.join('；') || '没有识别到题目，请使用“1、题干（A）”与“A.选项”的格式');")
p.write_text(s,encoding='utf-8')
# Preserve Android's preset bootstrap as a canonical conditional capability.
p=Path('platforms/web/frontend/js/modules/storage.js');s=p.read_text(encoding='utf-8')
android=Path('platforms/android/frontend/js/modules/storage.js').read_text(encoding='utf-8')
a=android.index('    async _ensurePresetData()');b=android.index('    // 导入数据辅助方法',a)
s=s.replace('    // 导入数据辅助方法',android[a:b]+'    // 导入数据辅助方法')
s=s.replace('            this.initDexie();','            this.initDexie();\n            this.ready = window.Capacitor ? this._ensurePresetData() : Promise.resolve();')
s=s.replace("let collection = this.db.questions.where('bank').equals(filters.bank);", "let collection = filters.bank ? this.db.questions.where('bank').equals(filters.bank) : this.db.questions;")
s=s.replace('async getQuestions(filters)', 'async getQuestions(filters = {})')
s=s.replace("encodeURIComponent(filters.bank)", "encodeURIComponent(filters.bank || '')")
s=s.replace("this.db.banks, this.db.questions, async () => {\n                // 1.", "this.db.banks, this.db.questions, async () => {\n                // Same-name imports replace questions atomically, consistent with Web/Electron.\n                await this.db.questions.where('bank').equals(bankName).delete();\n                // 1.")
p.write_text(s,encoding='utf-8')
# Do not treat malformed backend questions as gradable. Preserve valid ones and report diagnostics.
p=Path('platforms/web/backend/parser.py');s=p.read_text(encoding='utf-8').replace("r'[\\s\\?？]'", "r'[\\s\\?？、,，;；]'")
s=s.replace("        for pattern, answer_label in self.judge_answer_patterns:", """        standalone = re.fullmatch(r'(?:(?:正确|参考)?答案\\s*[:：]?\\s*)?(对|错|正确|错误|√|✓|×|✗)', text.strip())
        if standalone:
            return '对' if standalone.group(1) in ('对', '正确', '√', '✓') else '错'
        for pattern, answer_label in self.judge_answer_patterns:""")
s=s.replace("        return questions, extracted_name, semester_display", """        warnings = []
        valid = []
        for index, q in enumerate(questions, 1):
            if (not q['answer'] or any(a is None for a in q['answer']) or
                (q['type'] != 'judge' and (len(q['options']) < 2 or any(a not in q['options'] for a in q['answer'])))):
                warnings.append(f\"第 {index} 题「{q['question'][:25]}」缺少有效答案或完整选项，已跳过\")
            else:
                valid.append(q)
        return valid, extracted_name, semester_display, warnings""")
p.write_text(s,encoding='utf-8')
# Adjust tests for diagnostic tuple extension.
p=Path('platforms/web/tests/test_regressions.py');s=p.read_text(encoding='utf-8-sig').replace('q, _, _ =','q, *_ =').replace('a, _, _ =','a, *_ =').replace('b, _, _ =','b, *_ =');p.write_text(s,encoding='utf-8')
p=Path('platforms/web/backend/routes/banks.py');s=p.read_text(encoding='utf-8').replace("bank_name = request.form.get('bank_name', '')", "bank_name = request.form.get('bank_name', '').strip()")
s=s.replace('"question_count": len(questions)', '"question_count": len(questions),\n            "warnings": parse_result[3] if len(parse_result) > 3 else []')
p.write_text(s,encoding='utf-8')
p=Path('platforms/electron/python_parser.py');s=p.read_text(encoding='utf-8').replace('"semester": semester,','"semester": semester,\n            "warnings": result[3] if len(result) > 3 else [],');p.write_text(s,encoding='utf-8')
p=Path('platforms/electron/main.js');s=p.read_text(encoding='utf-8').replace('if (!parseResult.success) {','if (!parseResult.success || !parseResult.questions?.length) {').replace('error: parseResult.error };','error: parseResult.error || "未解析到有效题目，原题库未改变" };')
s=s.replace('const bankNameToUse = bankName || parseResult.bank_name;', "const bankNameToUse = (bankName || '').trim() || parseResult.bank_name;\n        // Namespace IDs by the effective user-selected bank name as well.\n        const namespace = require('crypto').createHash('sha256').update(bankNameToUse).digest('hex').slice(0, 12);\n        parseResult.questions.forEach(q => { q.id = String(q.id).replace(/-[a-f0-9]{12}$/, '') + '-' + namespace; });")
s=s.replace('question_count: parseResult.questions.length','question_count: parseResult.questions.length,\n            warnings: parseResult.warnings || []');p.write_text(s,encoding='utf-8')
p=Path('platforms/web/frontend/js/app.js');s=p.read_text(encoding='utf-8').replace('data = { success: true, message: `成功导入 ${result.count} 道题目` };','data = { success: true, message: `成功导入 ${result.count} 道题目`, warnings: window.questionParser.warnings || [] };')
s=s.replace('resultDiv.textContent = data.message;', "resultDiv.textContent = data.message + (data.warnings?.length ? '\\n跳过 ' + data.warnings.length + ' 道无法判分的题目：\\n' + data.warnings.join('\\n') : '');")
s=s.replace('    initParticles();', "    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) initParticles();")
# Do not lock out the page if initial network requests fail / external font downloads stall.
s=s.replace('    initNavigation();', '    initPageLoader();\n    initNavigation();',1)
p.write_text(s,encoding='utf-8')
