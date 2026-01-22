/**
 * Node.js 数据模型
 * 替代原有的 Python 数据模型 (backend/models/*.py)
 */

const fs = require('fs-extra');
const path = require('path');

// 应用数据目录 - 从全局获取（在 main.js 中设置）
const userDataPath = global.userDataPath || require('electron').app.getPath('userData');
const dataPath = path.join(userDataPath, 'data');

// 确保目录存在
fs.ensureDirSync(dataPath);

// 数据文件路径
const getFilePath = (filename) => path.join(dataPath, filename);

// 初始化数据文件
const initDataFile = (filename, defaultData) => {
    const filePath = getFilePath(filename);
    if (!fs.existsSync(filePath)) {
        fs.writeJsonSync(filePath, defaultData, { encoding: 'utf-8' });
    }
};

// 初始化所有数据文件
initDataFile('questions.json', { banks: {}, questions: [] });
initDataFile('wrongbook.json', { questions: [] });
initDataFile('rankings.json', { records: [] });
initDataFile('progress.json', { list: [] });
initDataFile('config.json', { settings: {} });

/**
 * 读取 JSON 数据
 */
const readData = (filename) => {
    try {
        const filePath = getFilePath(filename);
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

        if (filters.bank) {
            questions = questions.filter(q => q.bank === filters.bank);
        }

        if (filters.type) {
            questions = questions.filter(q => q.type === filters.type);
        }

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
        const questions = this.load().questions || [];
        const chapters = new Set();

        questions
            .filter(q => q.bank === bankName)
            .forEach(q => {
                if (q.chapter) {
                    chapters.add(q.chapter);
                }
            });

        return Array.from(chapters).sort();
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

        // 添加新题目
        data.questions.push(...questions);

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
    QuestionsModel,
    WrongbookModel,
    RankingsModel,
    ProgressModel,
    ConfigModel
};
