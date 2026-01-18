/**
 * 静态网站适配器
 * 将API调用替换为本地存储操作
 */

(function() {
    'use strict';
    
    // 标记为静态模式
    window.STATIC_MODE = true;
    
    // 等待Questions模块加载完成
    let initRetries = 0;
    const maxRetries = 50;
    
    async function initStaticSite() {
        // 等待依赖模块加载
        if (typeof Questions === 'undefined' || typeof Storage === 'undefined') {
            if (initRetries++ < maxRetries) {
                setTimeout(initStaticSite, 100);
                return;
            }
            console.error('依赖模块加载失败');
            return;
        }
        
        console.log('初始化静态网站模式...');
        
        // 初始化题库数据
        await Questions.init();
        
        // 隐藏服务器相关功能
        hideServerFeatures();
        
        // 加载初始数据
        loadInitialData();
        
        console.log('静态网站初始化完成');
    }
    
    function hideServerFeatures() {
        // 隐藏导入按钮
        document.querySelectorAll('.import-btn, [data-page="import"], [data-page="settings"]').forEach(el => {
            el.style.display = 'none';
        });
        
        // 隐藏删除按钮
        document.querySelectorAll('.btn-danger').forEach(el => {
            if (el.textContent.includes('删除')) {
                el.style.display = 'none';
            }
        });
        
        // 添加静态模式标识
        document.body.classList.add('static-mode');
    }
    
    function loadInitialData() {
        // 更新统计信息
        const totalQuestions = Questions.getTotalCount();
        const bankList = Questions.getBankList();
        const wrongCount = Wrongbook.getTotalCount();
        
        // 更新首页统计
        const totalEl = document.getElementById('total-questions');
        if (totalEl) totalEl.textContent = totalQuestions;
        
        const bankCountEl = document.getElementById('bank-count');
        if (bankCountEl) bankCountEl.textContent = bankList.length;
        
        const wrongEl = document.getElementById('wrong-count');
        if (wrongEl) wrongEl.textContent = wrongCount;
    }
    
    // DOM加载完成后初始化
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
        const body = options.body ? JSON.parse(options.body) : null;
        
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
                const chapter = urlParams.get('chapter');
                
                let questions = [];
                const allQuestions = bankName ? Questions.getByBank(bankName) : Questions.getAllQuestions();
                
                // 筛选章节
                let filtered = allQuestions;
                if (chapter && chapter !== 'all' && chapter !== '') {
                    filtered = allQuestions.filter(q => q.chapter === chapter);
                }
                
                // 分离单选和多选
                const singles = filtered.filter(q => q.type === 'single');
                const multis = filtered.filter(q => q.type === 'multi');
                
                // 随机打乱并取指定数量
                const shuffledSingles = [...singles].sort(() => Math.random() - 0.5).slice(0, singleCount);
                const shuffledMultis = [...multis].sort(() => Math.random() - 0.5).slice(0, multiCount);
                
                questions = [...shuffledSingles, ...shuffledMultis];
                
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
                
                // 如果需要打乱顺序
                if (shuffle) {
                    singles = [...singles].sort(() => Math.random() - 0.5);
                    multis = [...multis].sort(() => Math.random() - 0.5);
                }
                
                result = { 
                    success: true,
                    questions: [...singles, ...multis],
                    total: singles.length + multis.length
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
                Wrongbook.add(body.question, body.userAnswer);
                result = { success: true };
            }
            else if (apiPath.match(/^\/api\/wrongbook\/[^\/]+$/) && method === 'DELETE') {
                const bankName = decodeURIComponent(apiPath.split('/').pop());
                Wrongbook.clearBank(bankName);
                result = { success: true };
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
                bankList.forEach(b => {
                    totalSingle += b.singleCount || 0;
                    totalMulti += b.multiCount || 0;
                });
                result = {
                    success: true,
                    stats: {
                        total_banks: bankList.length,
                        total_questions: Questions.getTotalCount(),
                        single_choice_count: totalSingle,
                        multi_choice_count: totalMulti
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
