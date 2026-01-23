const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

let mainWindow;
let pythonProcess;
let appDataPath;
let uploadsPath;
let systemCachePath;

/**
 * 初始化 Electron 系统数据路径
 * 在 app.whenReady() 之前调用，设置 userData 路径
 */
function initializeElectronDataPath() {
    let userDataDir;

    if (process.env.NODE_ENV === 'development') {
        userDataDir = path.join(__dirname, 'system-cache');
    } else {
        const exePath = app.getPath('exe');
        const appDir = path.dirname(exePath);
        userDataDir = path.join(appDir, 'system-cache');
    }

    const testFile = path.join(userDataDir, '.write-test');
    try {
        fs.ensureDirSync(userDataDir);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);

        app.setPath('userData', userDataDir);
        app.setPath('sessionData', path.join(userDataDir, 'Session Storage'));
        systemCachePath = userDataDir;

        console.log('✅ Electron 系统数据位置:', userDataDir);
        return userDataDir;
    } catch (err) {
        console.warn('⚠️  安装目录不可写（系统数据）:', err.message);
        return null;
    }
}

// 在 app.whenReady() 之前调用，设置 userData 路径
initializeElectronDataPath();

/**
 * 初始化数据存储路径
 * 同时设置业务数据和系统数据路径，如果不可写则提示用户选择
 */
function initializeDataPath() {
    let installDirDataPath;
    let defaultUserDataDir;

    if (process.env.NODE_ENV === 'development') {
        installDirDataPath = path.join(__dirname, '..', 'data');
        defaultUserDataDir = path.join(os.homedir(), '.dhu-quiz-app');
    } else {
        const exePath = app.getPath('exe');
        const appDir = path.dirname(exePath);
        installDirDataPath = path.join(appDir, 'data');
        defaultUserDataDir = path.join(os.homedir(), '.dhu-quiz-app');
    }

    let dataPath = installDirDataPath;

    if (!systemCachePath) {
        systemCachePath = path.join(defaultUserDataDir, 'system-cache');
        app.setPath('userData', systemCachePath);
        app.setPath('sessionData', path.join(systemCachePath, 'Session Storage'));
        console.log('ℹ️  使用默认系统数据位置:', systemCachePath);
    }

    uploadsPath = path.join(path.dirname(dataPath), 'uploads');

    const testFile = path.join(dataPath, '.write-test');
    try {
        fs.ensureDirSync(dataPath);
        fs.ensureDirSync(uploadsPath);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        appDataPath = dataPath;
        console.log('✅ 数据存储位置:', appDataPath);
        console.log('✅ 上传文件位置:', uploadsPath);
        console.log('✅ 系统数据位置:', systemCachePath);
    } catch (err) {
        console.warn('⚠️  安装目录不可写:', err.message);

        const result = dialog.showOpenDialogSync({
            properties: ['openDirectory', 'createDirectory'],
            title: '选择数据存储目录',
            message: '安装目录无写入权限，请选择其他目录存储数据',
            buttonLabel: '选择目录'
        });

        if (result && result[0]) {
            appDataPath = path.join(result[0], 'data');
            uploadsPath = path.join(result[0], 'uploads');
            systemCachePath = path.join(result[0], 'system-cache');
            fs.ensureDirSync(appDataPath);
            fs.ensureDirSync(uploadsPath);
            fs.ensureDirSync(systemCachePath);
            try {
                app.setPath('userData', systemCachePath);
                app.setPath('sessionData', path.join(systemCachePath, 'Session Storage'));
                console.log('✅ 系统数据位置已更新（用户选择）:', systemCachePath);
            } catch (setPathErr) {
                console.warn('⚠️  无法更新系统数据路径:', setPathErr.message);
                console.log('💡 系统数据将保持在默认位置');
            }
            console.log('✅ 数据存储位置（用户选择）:', appDataPath);
        } else {
            appDataPath = path.join(systemCachePath, 'data');
            uploadsPath = path.join(systemCachePath, 'uploads');
            fs.ensureDirSync(appDataPath);
            fs.ensureDirSync(uploadsPath);
            console.log('✅ 数据存储位置（默认）:', appDataPath);
        }
    }

    global.appDataPath = appDataPath;
    global.systemCachePath = systemCachePath;

    migrateOldData(appDataPath, systemCachePath);

    return appDataPath;
}

/**
 * 迁移旧数据
 * 从 AppData 迁移到新的数据目录
 */
function migrateOldData(newDataPath, newSystemCachePath) {
    if (process.env.NODE_ENV === 'development') {
        return;
    }

    const oldUserData = app.getPath('userData', 'old');
    const oldAppData = path.join(path.dirname(oldUserData), 'dhu-quiz-app');

    let shouldMigrate = false;
    let migrationSources = [];

    if (fs.existsSync(path.join(oldAppData, 'data'))) {
        migrationSources.push({
            name: '题库数据',
            source: path.join(oldAppData, 'data'),
            target: newDataPath
        });
    }

    if (fs.existsSync(oldAppData)) {
        const hasSystemData = ['Cache', 'Local Storage', 'Session Storage', 'Preferences'].some(
            dir => fs.existsSync(path.join(oldAppData, dir))
        );
        if (hasSystemData) {
            migrationSources.push({
                name: '系统缓存',
                source: oldAppData,
                target: newSystemCachePath
            });
        }
    }

    if (migrationSources.length === 0) {
        return;
    }

    const migrationSummary = migrationSources.map(s => `  • ${s.name}`).join('\n');
    const result = dialog.showMessageBoxSync({
        type: 'question',
        title: '检测到旧版本数据',
        message: '检测到以下旧版本数据，是否迁移到新位置？\n\n' + migrationSummary,
        buttons: ['迁移', '跳过'],
        defaultId: 0
    });

    if (result === 0) {
        try {
            migrationSources.forEach(source => {
                if (!fs.existsSync(source.target)) {
                    fs.copySync(source.source, source.target, { overwrite: false });
                    console.log('✅ 已迁移:', source.name);
                }
            });

            dialog.showMessageBoxSync({
                type: 'info',
                title: '迁移完成',
                message: '旧数据已成功迁移到新位置。\n\n' +
                        '您可以手动删除旧数据目录：\n' + oldAppData
            });
        } catch (err) {
            console.error('❌ 数据迁移失败:', err);
            dialog.showMessageBoxSync({
                type: 'error',
                title: '迁移失败',
                message: '数据迁移过程中发生错误：\n' + err.message
            });
        }
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false
        },
        title: '东华红课题库刷题系统',
        icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.icns'),
        show: false,
        backgroundColor: '#ffffff'
    });

    // 加载前端
    const isDevelopment = process.env.NODE_ENV === 'development';
    const frontendPath = isDevelopment
        ? path.join(__dirname, '..', 'frontend', 'index.html')
        : path.join(__dirname, 'frontend', 'index.html');
    mainWindow.loadFile(frontendPath);

    // 开发模式打开 DevTools
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    // 窗口准备好后显示
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // 错误处理
    mainWindow.webContents.on('crash', () => {
        console.error('Renderer process crashed');
    });
}

app.whenReady().then(() => {
    const dataPath = initializeDataPath();
    
    // 初始化数据模型
    const models = require('./models');
    models.setDataPath(dataPath);
    models.init();

    // 启动 Python 子进程（用于 Word 解析）
    startPythonProcess();

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // 优雅关闭 Python 进程
    if (pythonProcess && !pythonProcess.killed) {
        try {
            pythonProcess.stdin.write(JSON.stringify({ action: 'exit' }) + '\n');
            setTimeout(() => {
                if (pythonProcess && !pythonProcess.killed) {
                    pythonProcess.kill();
                }
            }, 1000); // 等待 1 秒让 Python 清理
        } catch (err) {
            // 忽略写入错误
        }
    }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 启动 Python 进程
function startPythonProcess() {
    // 根据 NODE_ENV 确定嵌入式 Python 目录
    let embeddedPythonDir;

    if (process.env.NODE_ENV === 'development') {
        // 开发模式：electron/python/
        embeddedPythonDir = path.join(__dirname, 'python');
    } else {
        // 生产模式：使用 process.resourcesPath 构建绝对路径
        // process.resourcesPath 在打包后指向 resources/ 目录
        embeddedPythonDir = path.join(process.resourcesPath, 'app.asar.unpacked', 'python');
    }

    const embeddedPython = process.platform === 'win32'
        ? path.join(embeddedPythonDir, 'python.exe')
        : path.join(embeddedPythonDir, 'bin', 'python3');

    const systemPython = process.platform === 'win32' ? 'python.exe' : 'python3';

    // 选择 Python 解释器
    let pythonPath;
    let useEmbedded = false;

    if (fs.existsSync(embeddedPython)) {
        pythonPath = embeddedPython;
        useEmbedded = true;
        console.log('✅ 使用嵌入式 Python:', pythonPath);
    } else {
        pythonPath = systemPython;
        console.log('⚠️  使用系统 Python:', pythonPath);
        console.log('💡 提示：安装嵌入式 Python 以获得更好兼容性');
        console.log('   运行: cd electron && npm run setup-python');
    }

    // Python 脚本用于 Word 解析
    const pythonScript = process.env.NODE_ENV === 'development'
        ? path.join(__dirname, 'python_parser.py')
        : path.join(process.resourcesPath, 'app.asar.unpacked', 'python_parser.py');

    if (fs.existsSync(pythonScript)) {
        console.log('✅ Python 脚本找到:', pythonScript);

        // 设置工作目录（Python 脚本所在目录）
        const scriptDir = process.env.NODE_ENV === 'development'
            ? __dirname
            : path.join(process.resourcesPath, 'app.asar.unpacked');

        // 设置环境变量
        const env = { 
            ...process.env,
            PYTHONIOENCODING: 'utf-8' // 强制 Python 使用 UTF-8 编码，防止中文乱码
        };

        // 如果使用嵌入式 Python，设置 PYTHONPATH
        if (useEmbedded) {
            const libDir = process.platform === 'win32'
                ? path.join(embeddedPythonDir, 'Lib')
                : path.join(embeddedPythonDir, 'lib');
            env.PYTHONPATH = [scriptDir, libDir].join(path.delimiter);
        }

        pythonProcess = spawn(pythonPath, [pythonScript], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: scriptDir,
            env: env
        });

        pythonProcess.on('error', (err) => {
            console.error('❌ Python 进程启动失败:', err.message);
            console.error('💡 请确保 Python 已正确安装');
        });

        pythonProcess.stderr.on('data', (data) => {
            const errorMsg = data.toString();
            console.error('Python stderr:', errorMsg);
        });

        pythonProcess.on('exit', (code, signal) => {
            console.log(`❌ Python 进程已退出，代码: ${code}, 信号: ${signal}`);
        });
    } else {
        console.error('❌ Python 脚本不存在:', pythonScript);
    }
}

// ==================== IPC 处理器 ====================

// 导入数据模型
const {
    QuestionsModel,
    WrongbookModel,
    RankingsModel,
    ProgressModel,
    ConfigModel
} = require('./models');

// 健康检查
ipcMain.handle('health-check', async () => {
    return { success: true, status: 'online' };
});

// 文件操作
ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
});

ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
});

ipcMain.handle('open-external', async (event, url) => {
    shell.openExternal(url);
});

// 打开数据目录
ipcMain.handle('open-data-folder', async () => {
    try {
        shell.openPath(appDataPath);
        return { success: true, path: appDataPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 获取数据目录路径
ipcMain.handle('get-data-path', async () => {
    return { success: true, path: appDataPath };
});

// 题库管理
ipcMain.handle('get-banks', async () => {
    try {
        const banks = QuestionsModel.getBanks();
        const banksArray = Array.isArray(banks) ? banks : [];
        return { success: true, banks: banksArray };
    } catch (error) {
        return { success: false, error: error.message, banks: [] };
    }
});

ipcMain.handle('delete-bank', async (event, bankName) => {
    try {
        const result = QuestionsModel.deleteBank(bankName);
        return result ?
            { success: true, message: `题库 '${bankName}' 已删除` } :
            { success: false, error: '题库不存在' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 题目管理
ipcMain.handle('get-questions', async (event, filters = {}) => {
    try {
        const questions = QuestionsModel.getQuestions(filters);
        const total = questions.length;
        return { success: true, questions, total };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-question', async (event, questionId) => {
    try {
        const question = QuestionsModel.getQuestionById(questionId);
        return question ?
            { success: true, question } :
            { success: false, error: '题目不存在' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('update-question', async (event, questionId, data) => {
    try {
        const result = QuestionsModel.updateQuestion(questionId, data);
        return result ?
            { success: true, message: '题目更新成功' } :
            { success: false, error: '题目不存在' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-question', async (event, questionId) => {
    try {
        const result = QuestionsModel.deleteQuestion(questionId);
        return result ?
            { success: true, message: '题目删除成功' } :
            { success: false, error: '题目不存在' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 章节
ipcMain.handle('get-chapters', async (event, bank) => {
    try {
        console.log('[get-chapters] 请求银行:', bank);
        const chapters = QuestionsModel.getChapters(bank);
        console.log('[get-chapters] 返回章节:', chapters, '类型:', typeof chapters, '长度:', chapters?.length);
        // 确保返回数组
        const chaptersArray = Array.isArray(chapters) ? chapters : [];
        return { success: true, chapters: chaptersArray };
    } catch (error) {
        console.error('[get-chapters] 错误:', error);
        return { success: false, error: error.message, chapters: [] };
    }
});

// 练习
ipcMain.handle('practice-random', async (event, filters = {}) => {
    try {
        console.log('[practice-random] 收到请求，过滤器:', JSON.stringify(filters));
        
        // 1. 获取该题库下所有题目（不做数量限制）
        const allQuestions = QuestionsModel.getQuestions({
            bank: filters.bank,
            chapter: filters.chapter
            // 注意：这里不要传 type，因为我们要分别统计单选和多选
        });
        
        console.log(`[practice-random] 找到总题目数: ${allQuestions.length}`);

        // 2. 分离单选题和多选题
        const singleQuestions = allQuestions.filter(q => q.type === 'single');
        const multiQuestions = allQuestions.filter(q => q.type === 'multi');
        
        console.log(`[practice-random] 单选题: ${singleQuestions.length}, 多选题: ${multiQuestions.length}`);

        // 3. 按照请求数量抽取
        const targetSingle = parseInt(filters.single_count) || 0;
        const targetMulti = parseInt(filters.multi_count) || 0;
        
        // 随机混洗
        const shuffledSingle = singleQuestions.sort(() => Math.random() - 0.5);
        const shuffledMulti = multiQuestions.sort(() => Math.random() - 0.5);
        
        // 截取
        const selectedSingle = shuffledSingle.slice(0, targetSingle);
        const selectedMulti = shuffledMulti.slice(0, targetMulti);
        
        // 4. 合并结果
        const finalQuestions = [...selectedSingle, ...selectedMulti];
        
        console.log(`[practice-random] 返回题目数: ${finalQuestions.length} (单:${selectedSingle.length} 多:${selectedMulti.length})`);

        return { success: true, questions: finalQuestions, total: finalQuestions.length };
    } catch (error) {
        console.error('[practice-random] 错误:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('practice-sequence', async (event, filters = {}) => {
    try {
        const allQuestions = QuestionsModel.getQuestions(filters);

        // 是否打乱
        const questions = filters.shuffle ?
            allQuestions.sort(() => Math.random() - 0.5) :
            allQuestions;

        return { success: true, questions, total: questions.length };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('practice-wrong', async (event, filters = {}) => {
    try {
        const wrongQuestions = WrongbookModel.getWrongQuestions(filters);
        const count = filters.single_count || filters.multi_count || wrongQuestions.length;

        // 随机抽取
        const shuffled = wrongQuestions.sort(() => Math.random() - 0.5);
        const questions = shuffled.slice(0, Math.min(count, shuffled.length));

        return { success: true, questions, total: questions.length };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('check-answer', async (event, { questionId, answer }) => {
    try {
        const question = QuestionsModel.getQuestionById(questionId);

        if (!question) {
            return { success: false, error: '题目不存在' };
        }

        const correctAnswer = question.answer || [];

        // 简单的答案比较（字符串数组）
        const userAnswer = Array.isArray(answer) ? answer : [answer];
        const isCorrect = JSON.stringify(userAnswer.sort()) === JSON.stringify(correctAnswer.sort());

        return {
            success: true,
            correct: isCorrect,
            user_answer: userAnswer,
            correct_answer: correctAnswer
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 错题本
ipcMain.handle('get-wrongbook', async (event, filters = {}) => {
    try {
        const questions = WrongbookModel.getWrongQuestions(filters);
        return { success: true, wrong_questions: questions, total: questions.length };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 错题本统计
ipcMain.handle('get-wrongbook-stats', async () => {
    try {
        const wrongQuestions = WrongbookModel.getWrongQuestions();
        const stats = {};

        wrongQuestions.forEach(q => {
            if (!stats[q.bank]) {
                stats[q.bank] = { total: 0, single: 0, multi: 0 };
            }
            stats[q.bank].total++;
            if (q.type === 'single') stats[q.bank].single++;
            if (q.type === 'multi') stats[q.bank].multi++;
        });

        // 计算总数
        const total = wrongQuestions.length;
        
        return { success: true, stats, total };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 按题库统计（用于首页展示章节概览）
ipcMain.handle('get-stats-by-bank', async () => {
    try {
        const questions = QuestionsModel.getQuestions({});
        const stats = {};

        questions.forEach(q => {
            if (!stats[q.bank]) {
                stats[q.bank] = { total: 0, chapters: {} };
            }
            stats[q.bank].total++;
            
            const chapter = q.chapter || '默认章节';
            if (!stats[q.bank].chapters[chapter]) {
                stats[q.bank].chapters[chapter] = 0;
            }
            stats[q.bank].chapters[chapter]++;
        });

        return { success: true, stats };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('add-wrong-question', async (event, { questionId, user_answer }) => {
    try {
        const question = QuestionsModel.getQuestionById(questionId);

        if (!question) {
            return { success: false, error: '题目不存在' };
        }

        const result = WrongbookModel.addWrongQuestion(question, user_answer);
        return result ?
            { success: true, message: '已添加到错题本' } :
            { success: false, error: '题目已在错题本中' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('remove-wrong-question', async (event, questionId) => {
    try {
        const result = WrongbookModel.removeQuestion(questionId);
        return result ?
            { success: true, message: '错题已删除' } :
            { success: false, error: '错题不存在' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('clear-wrongbook', async () => {
    try {
        WrongbookModel.clear();
        return { success: true, message: '错题本已清空' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 排行榜
ipcMain.handle('get-rankings', async () => {
    try {
        const rankings = RankingsModel.getRankings();
        // 按分数排序
        rankings.sort((a, b) => b.accuracy - a.accuracy);
        return { success: true, rankings };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('add-ranking', async (event, record) => {
    try {
        const newRecord = RankingsModel.addRanking(record);
        return { success: true, message: '成绩已记录', record: newRecord };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('clear-rankings', async () => {
    try {
        RankingsModel.clear();
        return { success: true, message: '排行榜已清空' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 进度
ipcMain.handle('get-progress', async () => {
    try {
        const progressList = ProgressModel.getProgressList();
        return { success: true, progress_list: progressList };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-progress', async (event, progressData) => {
    try {
        const id = ProgressModel.saveProgress(progressData);
        return { success: true, message: '进度已保存', id };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-progress', async (event, id) => {
    try {
        const result = ProgressModel.deleteProgress(id);
        return result ?
            { success: true, message: '进度已删除' } :
            { success: false, error: '进度不存在' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 统计（首页总览）
ipcMain.handle('get-stats', async (event, filters = {}) => {
    try {
        const data = QuestionsModel.load();
        const questions = data.questions || [];
        const banks = data.banks || {};

        const total_questions = questions.length;
        const total_banks = Object.keys(banks).length;
        const single_choice_count = questions.filter(q => q.type === 'single').length;
        const multi_choice_count = questions.filter(q => q.type === 'multi').length;

        // 构造与 Python 后端一致的返回格式
        const stats = {
            total_questions,
            total_banks,
            single_choice_count,
            multi_choice_count,
            // 兼容旧字段
            total: total_questions,
            single_count: single_choice_count, 
            multi_count: multi_choice_count
        };

        return { success: true, stats };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 配置
ipcMain.handle('get-config', async () => {
    try {
        const config = ConfigModel.load();
        return { success: true, config: config.settings || {} };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-config', async (event, config) => {
    try {
        ConfigModel.save(config);
        return { success: true, message: '配置已保存' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 导入题库
ipcMain.handle('import-questions', async (event, filePath, bankName) => {
    console.log('📨 收到导入请求 - filePath:', filePath, 'bankName:', bankName);
    try {
        // 检查文件路径
        if (!filePath) {
            console.error('❌ 文件路径为空！');
            return { success: false, error: '文件路径为空，请先选择文件' };
        }

        // 使用 Python 解析器
        const parseResult = await parseWithPython(filePath);

        if (!parseResult.success) {
            return { success: false, error: parseResult.error };
        }

        // 保存到数据文件
        const bankNameToUse = bankName || parseResult.bank_name;

        // 添加题库信息
        QuestionsModel.addBank(
            bankNameToUse,
            path.basename(filePath),
            parseResult.semester || ''
        );

        // 添加新题目（Model内部会自动清理旧数据并添加 bank 字段）
        QuestionsModel.addQuestions(bankNameToUse, parseResult.questions);

        // 验证保存是否成功
        const savedData = QuestionsModel.getQuestions({ bank: bankNameToUse });
        console.log(`✅ 验证: 题库 '${bankNameToUse}' 当前共有 ${savedData.length} 道题目`);

        return {
            success: true,
            message: `成功导入 ${parseResult.questions.length} 道题目到题库 '${bankNameToUse}'`,
            question_count: parseResult.questions.length
        };
    } catch (error) {
        console.error('❌ 导入失败:', error);
        return { success: false, error: error.message };
    }
});

// 导出数据
ipcMain.handle('export-data', async (event, format = 'json') => {
    try {
        const data = {
            questions: QuestionsModel.load(),
            wrongbook: WrongbookModel.load(),
            rankings: RankingsModel.load(),
            progress: ProgressModel.load(),
            config: ConfigModel.load(),
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };

        const jsonString = JSON.stringify(data, null, 2);

        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: `quiz-backup-${new Date().toISOString().split('T')[0]}.json`,
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (!result.canceled && result.filePath) {
            fs.writeFileSync(result.filePath, jsonString, 'utf-8');
            return { success: true, message: '数据已导出', filePath: result.filePath };
        }

        return { success: false, error: '用户取消操作' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 导入数据
ipcMain.handle('import-data', async (event, filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);

        // 验证数据格式
        if (!data.questions || !data.wrongbook) {
            return { success: false, error: '数据格式错误' };
        }

        // 导入数据
        QuestionsModel.save(data.questions);
        WrongbookModel.save(data.wrongbook);
        RankingsModel.save(data.rankings);
        ProgressModel.save(data.progress);
        ConfigModel.save(data.config.settings || {});

        return { success: true, message: '数据导入成功' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// 检查 Python 进程是否存活
function isPythonProcessAlive() {
    return pythonProcess && !pythonProcess.killed && pythonProcess.exitCode === null;
}

// 重启 Python 进程
function restartPythonProcess() {
    console.log('🔄 重启 Python 进程...');
    if (pythonProcess && !pythonProcess.killed) {
        pythonProcess.kill();
    }
    startPythonProcess();
}

// 使用 Python 解析器
function parseWithPython(filePath) {
    return new Promise((resolve, reject) => {
        // 检查进程状态
        if (!isPythonProcessAlive()) {
            console.error('❌ Python 进程未运行，尝试重启...');
            restartPythonProcess();
            // 等待进程启动
            setTimeout(() => {
                if (!isPythonProcessAlive()) {
                    reject(new Error('Python 进程启动失败'));
                    return;
                }
                // 递归调用解析
                parseWithPython(filePath).then(resolve).catch(reject);
            }, 1000);
            return;
        }

        console.log('📤 开始解析文件:', filePath);
        console.log('🔍 Python 进程状态:', {
            pid: pythonProcess.pid,
            connected: pythonProcess.connected,
            killed: pythonProcess.killed
        });

        const input = JSON.stringify({ action: 'parse', file_path: filePath });
        let output = '';
        let timeout;

        // 监听 stdout
        const onData = (data) => {
            const chunk = data.toString();
            output += chunk;
            console.log('📥 Python stdout:', chunk);

            // 尝试解析是否收到完整 JSON
            try {
                const result = JSON.parse(output);
                console.log('✅ 解析成功:', result);
                clearTimeout(timeout);
                pythonProcess.stdout.removeListener('data', onData);
                resolve(result);
            } catch (e) {
                console.log('⏳ JSON 解析中，继续等待...');
            }
        };

        pythonProcess.stdout.on('data', onData);

        // 设置超时（30 秒）
        timeout = setTimeout(() => {
            pythonProcess.stdout.removeListener('data', onData);
            console.error('⏰ 超时！已接收数据:', output);
            if (output) {
                reject(new Error('解析超时，请检查文件格式'));
            } else {
                reject(new Error('Python 无响应，请检查环境'));
            }
        }, 30000);

        // 发送命令
        console.log('📨 发送命令到 Python:', input);
        try {
            pythonProcess.stdin.write(input + '\n', (err) => {
                if (err) {
                    console.error('❌ 发送命令失败:', err);
                    pythonProcess.stdout.removeListener('data', onData);
                    clearTimeout(timeout);
                    reject(new Error('发送命令失败: ' + err.message));
                } else {
                    console.log('✅ 命令已发送');
                }
            });
        } catch (err) {
            console.error('❌ 发送命令异常:', err);
            pythonProcess.stdout.removeListener('data', onData);
            clearTimeout(timeout);
            reject(new Error('发送命令异常: ' + err.message));
        }
    });
}
