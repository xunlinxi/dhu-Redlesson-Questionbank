/**
 * 题目数据管理模块
 */

const Questions = {
    _data: null,
    _loaded: false,
    _loadingPromise: null,
    DATA_VERSION: 2,

    _isValidCache(cached) {
        if (!cached || !cached.banks || Object.keys(cached.banks).length === 0) return false;
        if (cached._version !== this.DATA_VERSION) return false;
        const firstBank = Object.values(cached.banks)[0];
        return firstBank && Array.isArray(firstBank.questions);
    },

    async init() {
        if (this._loaded) return true;

        if (this._loadingPromise) {
            return this._loadingPromise;
        }

        this._loadingPromise = this._doInit();
        try {
            return await this._loadingPromise;
        } finally {
            this._loadingPromise = null;
        }
    },

    async _doInit() {
        try {
            const cached = Storage.getQuestions();
            if (this._isValidCache(cached)) {
                this._data = cached;
                this._loaded = true;
                console.log('从缓存加载题库数据 (v' + (cached._version || '?') + ')');
                return true;
            }

            if (cached && cached.banks && Object.keys(cached.banks).length > 0) {
                console.log('缓存数据格式过旧，将重新加载');
                Storage.remove(Storage.KEYS.QUESTIONS);
            }

            const response = await fetch('./data/questions.json');
            if (response.ok) {
                this._data = await response.json();
                this._data._version = this.DATA_VERSION;
                this._loaded = true;
                Storage.setQuestions(this._data);
                console.log('从文件加载题库数据，共 ' + this.getTotalCount() + ' 题');
                return true;
            }
        } catch (e) {
            console.error('加载题库失败:', e);
        }

        this._data = { banks: {}, _version: this.DATA_VERSION };
        this._loaded = true;
        return false;
    },

    /**
     * 获取所有题库列表
     */
    getBankList() {
        if (!this._data) return [];
        
        return Object.entries(this._data.banks).map(([name, data]) => ({
            name: name,
            totalQuestions: data.questions ? data.questions.length : 0,
            singleCount: data.questions ? data.questions.filter(q => q.type === 'single').length : 0,
            multiCount: data.questions ? data.questions.filter(q => q.type === 'multi').length : 0,
            chapters: data.chapters || [],
            semester: data.semester || '',
            source_file: data.source_file || '',
            import_time: data.import_time || ''
        }));
    },

    /**
     * 获取所有题目
     */
    getAllQuestions() {
        if (!this._data) return [];
        let all = [];
        for (const bank of Object.values(this._data.banks)) {
            if (bank.questions) {
                all = all.concat(bank.questions);
            }
        }
        return all;
    },

    /**
     * 获取指定题库的题目
     */
    getByBank(bankName) {
        if (!this._data || !this._data.banks[bankName]) return [];
        return this._data.banks[bankName].questions || [];
    },

    /**
     * 获取指定章节的题目
     */
    getByChapter(bankName, chapter) {
        const questions = this.getByBank(bankName);
        if (!chapter || chapter === 'all') return questions;
        return questions.filter(q => q.chapter === chapter);
    },

    /**
     * 获取随机题目
     */
    getRandom(bankName, count, options = {}) {
        let questions = this.getByBank(bankName);
        
        // 按章节筛选
        if (options.chapter && options.chapter !== 'all') {
            questions = questions.filter(q => q.chapter === options.chapter);
        }
        
        // 按类型筛选
        if (options.type && options.type !== 'all') {
            questions = questions.filter(q => q.type === options.type);
        }
        
        // 随机打乱
        const shuffled = [...questions].sort(() => Math.random() - 0.5);
        
        return shuffled.slice(0, count);
    },

    /**
     * 获取顺序题目
     */
    getSequence(bankName, startIndex = 0, count = 10, options = {}) {
        let questions = this.getByBank(bankName);
        
        // 按章节筛选
        if (options.chapter && options.chapter !== 'all') {
            questions = questions.filter(q => q.chapter === options.chapter);
        }
        
        // 按类型筛选
        if (options.type && options.type !== 'all') {
            questions = questions.filter(q => q.type === options.type);
        }
        
        return questions.slice(startIndex, startIndex + count);
    },

    /**
     * 获取题库统计信息
     */
    getStats(bankName) {
        const questions = this.getByBank(bankName);
        const chapters = {};
        
        questions.forEach(q => {
            const chapter = q.chapter || '未分类';
            if (!chapters[chapter]) {
                chapters[chapter] = { total: 0, single: 0, multi: 0 };
            }
            chapters[chapter].total++;
            if (q.type === 'single') chapters[chapter].single++;
            if (q.type === 'multi') chapters[chapter].multi++;
        });
        
        return {
            total: questions.length,
            single: questions.filter(q => q.type === 'single').length,
            multi: questions.filter(q => q.type === 'multi').length,
            chapters: chapters
        };
    },

    /**
     * 搜索题目
     */
    search(keyword, bankName = null) {
        const results = [];
        const banks = bankName ? { [bankName]: this._data.banks[bankName] } : this._data.banks;
        
        for (const [name, data] of Object.entries(banks)) {
            if (!data || !data.questions) continue;
            
            const matches = data.questions.filter(q => 
                q.question.includes(keyword) ||
                Object.values(q.options || {}).some(v => v.includes(keyword))
            );
            
            matches.forEach(q => {
                results.push({ ...q, bank: name });
            });
        }
        
        return results;
    },

    /**
     * 获取题库的章节列表
     */
    getChapters(bankName) {
        if (!this._data || !this._data.banks[bankName]) return [];
        return this._data.banks[bankName].chapters || [];
    },

    /**
     * 获取总题目数
     */
    getTotalCount() {
        if (!this._data) return 0;
        let total = 0;
        for (const bank of Object.values(this._data.banks)) {
            total += (bank.questions || []).length;
        }
        return total;
    }
};

// 导出
window.Questions = Questions;
