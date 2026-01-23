/**
 * Node.js 数据模型
 * 替代原有的 Python 数据模型 (backend/models/*.py)
 */

const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');

let _dataPath = null;

/**
 * 设置数据目录路径
 */
const setDataPath = (path) => {
    _dataPath = path;
    console.log('✅ 数据模型路径已设置为:', _dataPath);
};

/**
 * 获取数据目录路径
 */
const getDataPath = () => {
    if (_dataPath) return _dataPath;
    if (global.appDataPath) return global.appDataPath;
    return path.join(path.dirname(app.getPath('exe')), 'data');
};

// 数据文件路径
const getFilePath = (filename) => path.join(getDataPath(), filename);

/**
 * 初始化数据存储
 * 必须在 main.js 确定好数据路径后调用
 */
const init = () => {
    const dataPath = getDataPath();
    
    try {
        // 确保目录存在
        fs.ensureDirSync(dataPath);

        // 初始化所有数据文件
        const initDataFile = (filename, defaultData) => {
            const filePath = path.join(dataPath, filename);
            if (!fs.existsSync(filePath)) {
                fs.writeJsonSync(filePath, defaultData, { encoding: 'utf-8' });
            }
        };

        initDataFile('questions.json', { banks: {}, questions: [] });
        initDataFile('wrongbook.json', { questions: [] });
        initDataFile('rankings.json', { records: [] });
        initDataFile('progress.json', { list: [] });
        initDataFile('config.json', { settings: {} });
        
        console.log('✅ 数据模型初始化完成，路径:', dataPath);
        return true;
    } catch (error) {
        console.error('❌ 数据模型初始化失败:', error);
        return false;
    }
};

/**
 * 读取 JSON 数据
 */
const readData = (filename) => {
    try {
        const filePath = getFilePath(filename);
        if (!fs.existsSync(filePath)) {
            // 文件不存在时不报错，交给上一层处理
             return null;
        }
        return fs.readJsonSync(filePath, { encoding: 'utf-8' });
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return null;
    }
};

/**
 * 写入 JSON 数据
 */
const writeData = (filename, data) => {
    try {
        const filePath = getFilePath(filename);
        fs.ensureDirSync(path.dirname(filePath));
        fs.writeJsonSync(filePath, data, { encoding: 'utf-8', indent: 2 });
        return true;
    } catch (error) {
        console.error(`Error writing ${filename}:`, error);
        return false;
    }
};

/**
 * QuestionsModel - 题库数据模型
 */
const QuestionsModel = {
    load() {
        return readData('questions.json') || { banks: {}, questions: [] };
    },

    save(data) {
        return writeData('questions.json', data);
    },

    getBanks() {
        const data = this.load();
        const banks = data.banks || {};
        const questions = data.questions || [];
        const bankList = [];

        for (const [name, info] of Object.entries(banks)) {
            const questionCount = questions.filter(q => q.bank === name).length;
            bankList.push({
                name: name,
                question_count: questionCount,
                import_time: info.import_time || '',
                source_file: info.source_file || '',
                semester: info.semester || ''
            });
        }

        // 按导入时间倒序排列
        return bankList.sort((a, b) => new Date(b.import_time) - new Date(a.import_time));
    },

    getQuestions(filters = {}) {
        let questions = this.load().questions || [];

        // 严格的 Bank 筛选
        if (filters.bank) {
            questions = questions.filter(q => q.bank === filters.bank);
        }

        // 严格的类型筛选
        if (filters.type) {
             // 确保 type 存在再比较
            questions = questions.filter(q => q.type && q.type === filters.type);
        }

        // 严格的章节筛选
        if (filters.chapter) {
            questions = questions.filter(q => q.chapter === filters.chapter);
        }

        return questions;
    },

    getQuestionById(questionId) {
        const questions = this.load().questions || [];
        return questions.find(q => q.id === questionId) || null;
    },

    getChapters(bankName) {
        // 验证参数
        if (!bankName || typeof bankName !== 'string') {
            console.warn('[getChapters] 无效的银行名称:', bankName);
            return [];
        }
        
        const questions = this.load().questions || [];
        const chapters = new Set();
        
        questions
            .filter(q => q.bank === bankName)
            .forEach(q => {
                if (q.chapter && typeof q.chapter === 'string') {
                    chapters.add(q.chapter);
                }
            });
        
        const result = Array.from(chapters).sort();
        return result;
    },

    addBank(bankName, sourceFile, semester = '') {
        const data = this.load();

        if (!data.banks[bankName]) {
            data.banks[bankName] = {
                source_file: sourceFile,
                import_time: new Date().toISOString().replace('T', ' ').substring(0, 19),
                semester: semester
            };
            return this.save(data);
        }

        return false;
    },

    deleteBank(bankName) {
        const data = this.load();

        if (data.banks[bankName]) {
            delete data.banks[bankName];
            data.questions = data.questions.filter(q => q.bank !== bankName);
            return this.save(data);
        }

        return false;
    },

    addQuestions(bankName, questions) {
        const data = this.load();

        // 移除同名题库的旧题目
        data.questions = data.questions.filter(q => q.bank !== bankName);

        // 为新题目添加 bank 属性，确保数据完整性
        const newQuestions = questions.map(q => ({ 
            ...q, 
            bank: bankName,
            // 确保 type 字段存在且正确 (parser 有时可能返回 type: null) 
            // 优先级：原数据type > 根据答案数量判断 > 默认为single
            type: q.type ? q.type : (Array.isArray(q.answer) && q.answer.length > 1 ? 'multi' : 'single')
        }));

        // 添加新题目
        data.questions.push(...newQuestions);

        return this.save(data);
    },

    deleteQuestion(questionId) {
        const data = this.load();
        const originalLength = data.questions.length;
        data.questions = data.questions.filter(q => q.id !== questionId);

        if (data.questions.length !== originalLength) {
            return this.save(data);
        }

        return false;
    },

    updateQuestion(questionId, updateData) {
        const data = this.load();
        const index = data.questions.findIndex(q => q.id === questionId);

        if (index !== -1) {
            data.questions[index] = { ...data.questions[index], ...updateData };
            return this.save(data);
        }

        return false;
    }
};

/**
 * WrongbookModel - 错题本数据模型
 */
const WrongbookModel = {
    load() {
        return readData('wrongbook.json') || { questions: [] };
    },

    save(data) {
        return writeData('wrongbook.json', data);
    },

    getWrongQuestions(filters = {}) {
        let questions = this.load().questions || [];

        if (filters.bank) {
            questions = questions.filter(q => q.bank === filters.bank);
        }

        return questions;
    },

    addWrongQuestion(question, userAnswer) {
        const data = this.load();

        // 检查是否已存在
        const exists = data.questions.some(q => q.id === question.id);

        if (!exists) {
            data.questions.push({
                ...question,
                wrong_answer: userAnswer,
                wrong_time: new Date().toISOString()
            });
            return this.save(data);
        }

        return false;
    },

    removeQuestion(questionId) {
        const data = this.load();
        const originalLength = data.questions.length;
        data.questions = data.questions.filter(q => q.id !== questionId);

        if (data.questions.length !== originalLength) {
            return this.save(data);
        }

        return false;
    },

    clear() {
        return this.save({ questions: [] });
    },

    clearByBank(bankName) {
        const data = this.load();
        const originalLength = data.questions.length;
        data.questions = data.questions.filter(q => q.bank !== bankName);
        const removed = originalLength - data.questions.length;

        if (removed > 0) {
            this.save(data);
        }

        return removed;
    },

    getStats() {
        const questions = this.load().questions || [];
        const stats = {};

        questions.forEach(q => {
            if (!stats[q.bank]) {
                stats[q.bank] = 0;
            }
            stats[q.bank]++;
        });

        return {
            stats: Object.entries(stats).map(([name, count]) => ({ name, count })),
            total: questions.length
        };
    }
};

/**
 * RankingsModel - 排行榜数据模型
 */
const RankingsModel = {
    load() {
        return readData('rankings.json') || { records: [] };
    },

    save(data) {
        return writeData('rankings.json', data);
    },

    getRankings() {
        const data = this.load();
        return data.records || [];
    },

    addRanking(record) {
        const data = this.load();

        const newRecord = {
            ...record,
            id: Date.now().toString(),
            timestamp: new Date().toISOString()
        };

        data.records.push(newRecord);
        this.save(data);

        return newRecord;
    },

    clear() {
        return this.save({ records: [] });
    }
};

/**
 * ProgressModel - 进度数据模型
 */
const ProgressModel = {
    load() {
        return readData('progress.json') || { list: [] };
    },

    save(data) {
        return writeData('progress.json', data);
    },

    getProgressList() {
        const data = this.load();
        return data.list || [];
    },

    saveProgress(progress) {
        const data = this.load();

        const newProgress = {
            ...progress,
            id: progress.id || Date.now().toString(),
            save_time: new Date().toISOString()
        };

        if (progress.id) {
            // 更新现有进度
            const index = data.list.findIndex(p => p.id === progress.id);
            if (index !== -1) {
                data.list[index] = newProgress;
            }
        } else {
            // 添加新进度
            data.list.push(newProgress);
        }

        this.save(data);

        return newProgress.id;
    },

    deleteProgress(id) {
        const data = this.load();
        const originalLength = data.list.length;
        data.list = data.list.filter(p => p.id !== id);

        if (data.list.length !== originalLength) {
            return this.save(data);
        }

        return false;
    }
};

/**
 * ConfigModel - 配置数据模型
 */
const ConfigModel = {
    load() {
        return readData('config.json') || { settings: {} };
    },

    save(settings) {
        return writeData('config.json', { settings });
    },

    get(key, defaultValue = null) {
        const data = this.load();
        return data.settings[key] !== undefined ? data.settings[key] : defaultValue;
    },

    set(key, value) {
        const data = this.load();
        data.settings[key] = value;
        return this.save(data.settings);
    }
};

module.exports = {
    init,
    setDataPath,
    QuestionsModel,
    WrongbookModel,
    RankingsModel,
    ProgressModel,
    ConfigModel
};
