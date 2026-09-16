from pathlib import Path
p=Path('platforms/web/static-site/js/static-adapter.js');s=p.read_text(encoding='utf-8')
a=s.index('        async getPracticeWrong(filters)');b=s.index('        async getConfig()',a)
s=s[:a]+'''        async getPracticeWrong(filters) {
            const data = Wrongbook.getAll();
            const entries = Object.entries(data.banks || {}).filter(([name]) => !filters.bank || name === filters.bank);
            const questions = entries.flatMap(([bank, list]) => list.map(q => ({...q, bank})));
            const selected = [];
            for (const type of ['single', 'multi', 'judge']) {
                const pool = questions.filter(q => q.type === type);
                for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
                const count = Math.max(0, Number(filters[type + '_count']) || 0);
                selected.push(...pool.slice(0, count));
            }
            return {success:true, questions:selected};
        },
        async deleteBank(bankName) {
            await this.ensureLoaded();
            const next = structuredClone(Questions._data);
            delete next.banks[bankName];
            if (!Storage.setQuestions(next)) return {success:false, error:'存储空间不足，删除未保存'};
            Questions._data = next;
            return {success:true};
        },
        async importQuestions(bankName, questions) {
            await this.ensureLoaded();
            const next = structuredClone(Questions._data);
            const batch = questions.map((q, i) => ({...q, bank:bankName, id:'local_' + crypto.randomUUID()}));
            next.banks[bankName] = {questions:batch, chapters:[...new Set(batch.map(q => q.chapter))], import_time:new Date().toLocaleString(), source_file:'本地导入'};
            if (!Storage.setQuestions(next)) return {success:false, error:'浏览器存储空间不足，原题库未改变'};
            Questions._data = next;
            return {success:true, count:batch.length};
        },
'''+s[b:]
s=s.replace("async clearAllCacheData() { localStorage.clear(); return { success: true }; }", "async clearAllCacheData() { Object.values(Storage.KEYS).forEach(key => localStorage.removeItem(key)); return { success: true }; }")
a=s.index('    function hideServerFeatures()');b=s.index("    if (document.readyState",a)
s=s[:a]+'''    function hideServerFeatures() {
        document.body.classList.add('static-mode');
    }

'''+s[b:]
s=s.replace("const body = options.body ? JSON.parse(options.body) : null;", "const body = typeof options.body === 'string' ? JSON.parse(options.body) : null;")
# Map bank and wrong answer fields consistently.
s=s.replace("questions: data.banks && data.banks[bankName] ? data.banks[bankName] : []", "questions: (data.banks?.[bankName] || []).map(q => ({...q, bank:bankName, last_wrong_answer:q.userAnswer || [], wrong_count:q.wrongCount || 1}))")
s=s.replace("async addWrongQuestion(question) { Wrongbook.add(question.question, question.userAnswer); return { success: true }; }", "async addWrongQuestion(question) { await this.ensureLoaded(); const q = Questions.getAllQuestions().find(q => q.id === question.question_id); if (!q) return {success:false,error:'题目不存在'}; Wrongbook.add(q, question.user_answer || []); return { success: true }; }")
p.write_text(s,encoding='utf-8')
# Empty cache after deleting last bank should remain empty instead of silently restoring presets.
p=Path('platforms/web/static-site/js/questions.js');s=p.read_text(encoding='utf-8');a=s.index('        if (!cached ||');b=s.index('\n    },',a)
s=s[:a]+'''        return !!(cached && cached.banks && cached._version === this.DATA_VERSION &&
            Object.values(cached.banks).every(bank => Array.isArray(bank.questions)));'''+s[b:];p.write_text(s,encoding='utf-8')
# Word parser is bundled from backend using explicit reproducible sync.
