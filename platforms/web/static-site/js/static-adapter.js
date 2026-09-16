/**
 * 静态网站适配器
 * 将API调用替换为本地存储操作
 */

(function() {
    'use strict';
    
    window.STATIC_MODE = true;

    window.storageService = {
        isMobile: false,
        async ensureLoaded() {
            if (typeof Questions !== 'undefined' && !Questions._loaded) {
                await Questions.init();
            }
        },
        async getStats() {
            await this.ensureLoaded();
            const bankList = Questions.getBankList();
            let totalSingle = 0, totalMulti = 0, totalJudge = 0;
            bankList.forEach(b => { totalSingle += b.singleCount || 0; totalMulti += b.multiCount || 0; totalJudge += b.judgeCount || 0; });
            return { success: true, stats: { total_banks: bankList.length, total_questions: Questions.getTotalCount(), single_choice_count: totalSingle, multi_choice_count: totalMulti, judge_count: totalJudge } };
        },
        async getStatsByBank() {
            await this.ensureLoaded();
            const bankList = Questions.getBankList();
            const stats = {};
            bankList.forEach(b => {
                const questions = Questions.getByBank(b.name);
                const chapters = {};
                questions.forEach(q => { const ch = q.chapter || '未分类'; chapters[ch] = (chapters[ch] || 0) + 1; });
                stats[b.name] = { total: b.totalQuestions, single: b.singleCount, multi: b.multiCount, judge: b.judgeCount, chapters };
            });
            return { success: true, stats };
        },
        async getBanks() {
            await this.ensureLoaded();
            const bankList = Questions.getBankList();
            return { success: true, banks: bankList.map(b => ({ name: b.name, question_count: b.totalQuestions, total_questions: b.totalQuestions, single_count: b.singleCount, multi_count: b.multiCount, judge_count: b.judgeCount, chapters: b.chapters, semester: b.semester, source_file: b.source_file || '静态数据', import_time: b.import_time || '预置' })) };
        },
        async getChapters(bankName) {
            await this.ensureLoaded();
            return { success: true, chapters: Questions.getChapters(bankName) };
        },
        async getQuestions(filters = {}) {
            await this.ensureLoaded();
            const bankName = filters.bank;
            const chapter = filters.chapter;
            let questions = bankName ? Questions.getByBank(bankName) : Questions.getAllQuestions();
            if (chapter && chapter !== 'all' && chapter !== '') questions = questions.filter(q => q.chapter === chapter);
            if (filters.type && filters.type !== 'all') questions = questions.filter(q => q.type === filters.type);
            return { success: true, questions };
        },
        async getQuestion(id) {
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
        async getPracticeRandom(filters) {
            await this.ensureLoaded();
            const bankName = filters.bank;
            const singleCount = parseInt(filters.single_count || '0');
            const multiCount = parseInt(filters.multi_count || '0');
            const judgeCount = parseInt(filters.judge_count || '0');
            const chapter = filters.chapter;
            let allQuestions = bankName ? Questions.getByBank(bankName) : Questions.getAllQuestions();
            let filtered = allQuestions;
            if (chapter && chapter !== 'all' && chapter !== '') filtered = allQuestions.filter(q => q.chapter === chapter);
            const singles = [...filtered.filter(q => q.type === 'single')].sort(() => Math.random() - 0.5).slice(0, singleCount);
            const multis = [...filtered.filter(q => q.type === 'multi')].sort(() => Math.random() - 0.5).slice(0, multiCount);
            const judges = [...filtered.filter(q => q.type === 'judge')].sort(() => Math.random() - 0.5).slice(0, judgeCount);
            return { success: true, questions: [...singles, ...multis, ...judges] };
        },
        async getPracticeSequence(filters) {
            await this.ensureLoaded();
            const bankName = filters.bank;
            const chapter = filters.chapter;
            const shuffle = filters.shuffle === 'true';
            let allQuestions = bankName ? Questions.getByBank(bankName) : Questions.getAllQuestions();
            if (chapter && chapter !== 'all' && chapter !== '') allQuestions = allQuestions.filter(q => q.chapter === chapter);
            let singles = allQuestions.filter(q => q.type === 'single');
            let multis = allQuestions.filter(q => q.type === 'multi');
            let judges = allQuestions.filter(q => q.type === 'judge');
            if (shuffle) { singles = [...singles].sort(() => Math.random() - 0.5); multis = [...multis].sort(() => Math.random() - 0.5); judges = [...judges].sort(() => Math.random() - 0.5); }
            return { success: true, questions: [...singles, ...multis, ...judges], total: singles.length + multis.length + judges.length };
        },
        async getPracticeWrong(filters) {
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
        async getConfig() { return Storage.getSettings(); },
        async saveConfig(config) { Storage.setSettings(config); return { success: true }; },
        async clearAllCacheData() { ['RANKINGS','WRONGBOOK','PROGRESS','PLAYER_NAME'].forEach(key => localStorage.removeItem(Storage.KEYS[key])); return { success: true }; },
        async getRankings() {
            const data = Rankings.getAll();
            const rankings = (data.rankings || []).map(r => ({ name: r.playerName || r.name || '匿名', total: r.totalCount || r.total || 0, correct: r.correctCount || r.correct || 0, wrong: (r.totalCount || r.total || 0) - (r.correctCount || r.correct || 0), accuracy: r.accuracy || 0, time_spent: r.duration || r.time_spent || 0, time_display: r.timeDisplay || r.time_display || '', date: r.createTime || r.date || new Date().toISOString() }));
            return { success: true, rankings };
        },
        async saveRanking(record) { Rankings.add(record); return { success: true }; },
        async clearRankings() { Rankings.clear(); return { success: true }; },
        async getWrongbookStats() { return { success: true, stats: Wrongbook.getStats() }; },
        async getWrongBook(bankName) {
            const data = Wrongbook.getAll();
            return { success: true, questions: (data.banks?.[bankName] || []).map(q => ({...q, bank:bankName, last_wrong_answer:q.userAnswer || [], wrong_count:q.wrongCount || 1})) };
        },
        async addWrongQuestion(question) { await this.ensureLoaded(); const q = Questions.getAllQuestions().find(q => q.id === question.question_id); if (!q) return {success:false,error:'题目不存在'}; Wrongbook.add(q, question.user_answer || []); return { success: true }; },
        async removeWrongQuestion(questionId) {
            const data = Wrongbook.getAll();
            for (const [bankName, questions] of Object.entries(data.banks || {})) {
                const found = questions.find(q => q.id === questionId);
                if (found) {
                    Wrongbook.remove(bankName, questionId);
                    return { success: true };
                }
            }
            return { success: false, error: '错题不存在' };
        },
        async getProgressList() { return Progress.getAll(); },
        async saveProgress(data) { const result = Progress.save(data); return { success: true, progress: result.progress }; },
        async getProgressById(id) { return Progress.load(id); },
        async deleteProgress(id) { Progress.remove(id); return { success: true }; },
        async submitAnswer(question, answer) {
            const correctAnswer = question.answer || [];
            const isCorrect = JSON.stringify([...answer].sort()) === JSON.stringify([...correctAnswer].sort());
            return { isCorrect, correctAnswer, answered: answer };
        }
    };

    let initRetries = 0;
    const maxRetries = 50;

    async function initStaticSite() {
        if (typeof Questions === 'undefined' || typeof Storage === 'undefined') {
            if (initRetries++ < maxRetries) {
                setTimeout(initStaticSite, 100);
                return;
            }
            console.error('依赖模块加载失败');
            return;
        }

        console.log('初始化静态网站模式...');

        await Questions.init();

        hideServerFeatures();

        console.log('静态网站初始化完成，题库数: ' + Questions.getBankList().length + '，总题数: ' + Questions.getTotalCount());
    }
    
    function hideServerFeatures() {
        document.body.classList.add('static-mode');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStaticSite);
    } else {
        initStaticSite();
    }
    
    // 重写fetch函数，拦截API调用
    const originalFetch = window.fetch;
    window.fetch = async function(url, options = {}) {
        // 如果是API调用，使用本地存储处理
        if (typeof url === 'string' && url.includes('/api/')) {
            // 确保Questions模块已初始化
            if (typeof Questions !== 'undefined' && !Questions._loaded) {
                await Questions.init();
            }
            return handleApiCall(url, options);
        }
        // 其他请求使用原始fetch
        return originalFetch.apply(this, arguments);
    };
    
    async function handleApiCall(url, options) {
        const method = options.method || 'GET';
        const body = typeof options.body === 'string' ? JSON.parse(options.body) : null;
        
        // 解析API路径
        const apiPath = url.replace(/^.*\/api/, '/api');
        
        try {
            let result = null;
            
            // 健康检查
            if (apiPath === '/api/health') {
                result = { status: 'ok', mode: 'static' };
            }
            
            // 获取题库列表
            else if (apiPath === '/api/banks' && method === 'GET') {
                const bankList = Questions.getBankList();
                result = { 
                    success: true,
                    banks: bankList.map(b => ({
                        name: b.name,
                        question_count: b.totalQuestions,
                        total_questions: b.totalQuestions,
                        single_count: b.singleCount,
                        multi_count: b.multiCount,
                        judge_count: b.judgeCount,
                        chapters: b.chapters,
                        semester: b.semester,
                        source_file: b.source_file || '静态数据',
                        import_time: b.import_time || '预置'
                    }))
                };
            }
            
            // 获取题库详情
            else if (apiPath.match(/^\/api\/banks\/[^\/]+$/) && method === 'GET') {
                const bankName = decodeURIComponent(apiPath.split('/').pop());
                const banks = Questions.getBankList();
                const bank = banks.find(b => b.name === bankName);
                if (bank) {
                    result = {
                        success: true,
                        bank: {
                            name: bank.name,
                            total_questions: bank.totalQuestions,
                            single_count: bank.singleCount,
                            multi_count: bank.multiCount,
                            judge_count: bank.judgeCount,
                            chapters: bank.chapters,
                            semester: bank.semester
                        }
                    };
                } else {
                    result = { success: false, error: '题库不存在' };
                }
            }
            
            // 获取题库题目
            else if (apiPath.match(/^\/api\/banks\/[^\/]+\/questions/) && method === 'GET') {
                const parts = apiPath.split('/');
                const bankName = decodeURIComponent(parts[3]);
                result = { success: true, questions: Questions.getByBank(bankName) };
            }
            
            // 获取题目列表（用于统计）
            else if (apiPath.match(/^\/api\/questions/)) {
                const urlParams = new URL(url, window.location.origin).searchParams;
                const bankName = urlParams.get('bank');
                const chapter = urlParams.get('chapter');
                
                let questions = bankName ? Questions.getByBank(bankName) : Questions.getAllQuestions();
                
                if (chapter && chapter !== '' && chapter !== 'all') {
                    questions = questions.filter(q => q.chapter === chapter);
                }
                
                result = { success: true, questions: questions };
            }
            
            // 获取随机题目
            else if (apiPath.match(/^\/api\/practice\/random/)) {
                const urlParams = new URL(url, window.location.origin).searchParams;
                const bankName = urlParams.get('bank');
                const singleCount = parseInt(urlParams.get('single_count') || '0');
                const multiCount = parseInt(urlParams.get('multi_count') || '0');
                const judgeCount = parseInt(urlParams.get('judge_count') || '0');
                const chapter = urlParams.get('chapter');
                
                let questions = [];
                const allQuestions = bankName ? Questions.getByBank(bankName) : Questions.getAllQuestions();
                
                let filtered = allQuestions;
                if (chapter && chapter !== 'all' && chapter !== '') {
                    filtered = allQuestions.filter(q => q.chapter === chapter);
                }
                
                const singles = filtered.filter(q => q.type === 'single');
                const multis = filtered.filter(q => q.type === 'multi');
                const judges = filtered.filter(q => q.type === 'judge');
                
                const shuffledSingles = [...singles].sort(() => Math.random() - 0.5).slice(0, singleCount);
                const shuffledMultis = [...multis].sort(() => Math.random() - 0.5).slice(0, multiCount);
                const shuffledJudges = [...judges].sort(() => Math.random() - 0.5).slice(0, judgeCount);
                
                questions = [...shuffledSingles, ...shuffledMultis, ...shuffledJudges];
                
                result = { 
                    success: true,
                    questions: questions
                };
            }
            
            // 获取顺序题目
            else if (apiPath.match(/^\/api\/practice\/sequence/)) {
                const urlParams = new URL(url, window.location.origin).searchParams;
                const bankName = urlParams.get('bank');
                const chapter = urlParams.get('chapter');
                const shuffle = urlParams.get('shuffle') === 'true';
                
                let allQuestions = bankName ? Questions.getByBank(bankName) : Questions.getAllQuestions();
                
                // 筛选章节
                if (chapter && chapter !== 'all' && chapter !== '') {
                    allQuestions = allQuestions.filter(q => q.chapter === chapter);
                }
                
                // 分离单选和多选
                let singles = allQuestions.filter(q => q.type === 'single');
                let multis = allQuestions.filter(q => q.type === 'multi');
                let judges = allQuestions.filter(q => q.type === 'judge');
                
                if (shuffle) {
                    singles = [...singles].sort(() => Math.random() - 0.5);
                    multis = [...multis].sort(() => Math.random() - 0.5);
                    judges = [...judges].sort(() => Math.random() - 0.5);
                }
                
                result = { 
                    success: true,
                    questions: [...singles, ...multis, ...judges],
                    total: singles.length + multis.length + judges.length
                };
            }
            
            // 获取章节列表
            else if (apiPath.match(/^\/api\/chapters/)) {
                const urlParams = new URL(url, window.location.origin).searchParams;
                const bankName = urlParams.get('bank');
                const chapters = Questions.getChapters(bankName);
                result = { success: true, chapters: chapters };
            }
            
            // 提交答案
            else if (apiPath === '/api/practice/submit' && method === 'POST') {
                const question = body.question;
                const answer = body.answer;
                const correctAnswer = question.answer || [];
                const isCorrect = JSON.stringify([...answer].sort()) === JSON.stringify([...correctAnswer].sort());
                
                result = {
                    isCorrect: isCorrect,
                    correctAnswer: correctAnswer,
                    answered: answer
                };
            }
            
            // 错题本相关
            else if (apiPath === '/api/wrongbook' && method === 'GET') {
                result = Wrongbook.getAll();
            }
            else if (apiPath === '/api/wrongbook/stats' && method === 'GET') {
                result = { success: true, stats: Wrongbook.getStats() };
            }
            else if (apiPath === '/api/wrongbook' && method === 'POST') {
                Wrongbook.add(body.question, body.userAnswer || body.user_answer);
                result = { success: true };
            }
            else if (apiPath.match(/^\/api\/wrongbook\/bank\/[^\/]+$/) && method === 'DELETE') {
                const bankName = decodeURIComponent(apiPath.replace('/api/wrongbook/bank/', ''));
                Wrongbook.clearBank(bankName);
                result = { success: true };
            }
            else if (apiPath.match(/^\/api\/wrongbook\/[^\/]+$/) && method === 'DELETE') {
                const questionId = apiPath.split('/').pop();
                // 遍历所有 bank 找到并删除该错题
                const data = Wrongbook.getAll();
                let found = false;
                for (const [bn, questions] of Object.entries(data.banks || {})) {
                    const q = questions.find(q => q.id === questionId);
                    if (q) {
                        Wrongbook.remove(bn, questionId);
                        found = true;
                        break;
                    }
                }
                result = { success: found };
            }
            
            // 排行榜相关
            else if (apiPath === '/api/rankings' && method === 'GET') {
                const data = Rankings.getAll();
                // 转换字段名以兼容前端期望的格式
                const rankings = (data.rankings || []).map(r => ({
                    name: r.playerName || r.name || '匿名',
                    total: r.totalCount || r.total || 0,
                    correct: r.correctCount || r.correct || 0,
                    wrong: (r.totalCount || r.total || 0) - (r.correctCount || r.correct || 0),
                    accuracy: r.accuracy || 0,
                    time_spent: r.duration || r.time_spent || 0,
                    time_display: r.timeDisplay || r.time_display || '',
                    date: r.createTime || r.date || new Date().toISOString()
                }));
                result = { success: true, rankings: rankings };
            }
            else if (apiPath === '/api/rankings' && method === 'POST') {
                Rankings.add(body);
                result = { success: true };
            }
            else if (apiPath === '/api/rankings' && method === 'DELETE') {
                Rankings.clear();
                result = { success: true };
            }
            
            // 进度相关
            else if (apiPath === '/api/progress' && method === 'GET') {
                result = Progress.getAll();
            }
            else if (apiPath === '/api/progress' && method === 'POST') {
                const saveResult = Progress.save(body);
                result = { success: true, progress: saveResult.progress };
            }
            else if (apiPath.match(/^\/api\/progress\/[^\/]+$/) && method === 'GET') {
                const progressId = apiPath.split('/').pop();
                result = Progress.load(progressId);
            }
            else if (apiPath.match(/^\/api\/progress\/[^\/]+$/) && method === 'DELETE') {
                const progressId = apiPath.split('/').pop();
                Progress.remove(progressId);
                result = { success: true };
            }
            
            // 统计信息
            else if (apiPath === '/api/stats') {
                const bankList = Questions.getBankList();
                let totalSingle = 0;
                let totalMulti = 0;
                let totalJudge = 0;
                bankList.forEach(b => {
                    totalSingle += b.singleCount || 0;
                    totalMulti += b.multiCount || 0;
                    totalJudge += b.judgeCount || 0;
                });
                result = {
                    success: true,
                    stats: {
                        total_banks: bankList.length,
                        total_questions: Questions.getTotalCount(),
                        single_choice_count: totalSingle,
                        multi_choice_count: totalMulti,
                        judge_count: totalJudge
                    }
                };
            }
            
            // 按题库分组的章节统计
            else if (apiPath === '/api/stats/by_bank') {
                const bankList = Questions.getBankList();
                const stats = {};
                bankList.forEach(b => {
                    const questions = Questions.getByBank(b.name);
                    const chapters = {};
                    questions.forEach(q => {
                        const chapter = q.chapter || '未分类';
                        chapters[chapter] = (chapters[chapter] || 0) + 1;
                    });
                    stats[b.name] = {
                        total: b.totalQuestions,
                        single: b.singleCount,
                        multi: b.multiCount,
                        judge: b.judgeCount,
                        chapters: chapters
                    };
                });
                result = { success: true, stats: stats };
            }
            
            // 配置
            else if (apiPath === '/api/config' && method === 'GET') {
                result = Storage.getSettings();
            }
            else if (apiPath === '/api/config' && method === 'POST') {
                Storage.setSettings(body);
                result = { success: true };
            }
            
            // 默认返回空对象
            if (result === null) {
                console.warn('未处理的API调用:', apiPath, method);
                result = {};
            }
            
            // 返回模拟的Response对象
            return new Response(JSON.stringify(result), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
            
        } catch (error) {
            console.error('API处理错误:', error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    
})();
