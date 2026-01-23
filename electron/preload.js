const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 健康检查
    healthCheck: () => ipcRenderer.invoke('health-check'),

    // 文件操作
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
    getDataPath: () => ipcRenderer.invoke('get-data-path'),

    // 题库管理
    getBanks: () => ipcRenderer.invoke('get-banks'),
    deleteBank: (bankName) => ipcRenderer.invoke('delete-bank', bankName),

    // 题目管理
    getQuestions: (filters) => ipcRenderer.invoke('get-questions', filters),
    getQuestion: (questionId) => ipcRenderer.invoke('get-question', questionId),
    updateQuestion: (questionId, data) => ipcRenderer.invoke('update-question', questionId, data),
    deleteQuestion: (questionId) => ipcRenderer.invoke('delete-question', questionId),

    // 章节
    getChapters: (bank) => ipcRenderer.invoke('get-chapters', bank),

    // 练习
    practiceRandom: (filters) => ipcRenderer.invoke('practice-random', filters),
    practiceSequence: (filters) => ipcRenderer.invoke('practice-sequence', filters),
    practiceWrong: (filters) => ipcRenderer.invoke('practice-wrong', filters),
    checkAnswer: (data) => ipcRenderer.invoke('check-answer', data),

    // 错题本
    getWrongbook: (filters) => ipcRenderer.invoke('get-wrongbook', filters),
    getWrongbookStats: () => ipcRenderer.invoke('get-wrongbook-stats'),
    addWrongQuestion: (data) => ipcRenderer.invoke('add-wrong-question', data),
    removeWrongQuestion: (questionId) => ipcRenderer.invoke('remove-wrong-question', questionId),
    clearWrongbook: () => ipcRenderer.invoke('clear-wrongbook'),

    // 排行榜
    getRankings: () => ipcRenderer.invoke('get-rankings'),
    addRanking: (data) => ipcRenderer.invoke('add-ranking', data),
    clearRankings: () => ipcRenderer.invoke('clear-rankings'),

    // 进度
    getProgress: () => ipcRenderer.invoke('get-progress'),
    saveProgress: (data) => ipcRenderer.invoke('save-progress', data),
    deleteProgress: (id) => ipcRenderer.invoke('delete-progress', id),

    // 统计
    getStats: (filters) => ipcRenderer.invoke('get-stats', filters),
    getStatsByBank: () => ipcRenderer.invoke('get-stats-by-bank'),

    // 配置
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),

    // 导入题库
    importQuestions: (filePath, bankName) => ipcRenderer.invoke('import-questions', filePath, bankName),

    // 导出数据
    exportData: (format) => ipcRenderer.invoke('export-data', format),
    importData: (filePath) => ipcRenderer.invoke('import-data', filePath)
});
