/**
 * 题库刷题系统前端逻辑
 */

const API_BASE = '';

// ==================== 全局状态 ====================
let currentPage = 'dashboard';
let practiceQuestions = [];
let currentQuestionIndex = 0;
let selectedAnswers = [];
let correctCount = 0;
let wrongCount = 0;
let currentBankName = '';
let editingQuestionId = null;
let serverOnline = true;
let healthCheckInterval = null;
let practiceTimer = null;
let remainingTime = 0;
let practiceStartTime = null;
let isExamMode = false;  // 模拟考试模式
let questionResults = []; // 存储每道题的作答结果
let lastPracticeSettings = null; // 保存上次练习设置
let isBackMode = false; // 背题库模式：仅显示正确选项
let editOptionsState = []; // 编辑弹窗中当前的选项列表
let currentPracticeMode = 'random'; // 当前做题模式：random/exam/sequence/wrong
let currentWrongBankName = ''; // 错题本当前题库
let currentProgressId = null; // 当前进度ID（用于覆盖保存）
let loadedElapsedTime = 0; // 读取存档时已经过的时间（秒）
let navCurrentPage = 1; // 答题卡当前页码
const NAV_PAGE_SIZE = 56; // 答题卡每页显示数量

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initUpload();
    loadStats();
    loadConfig();
    startHealthCheck();
    
    // 暴露函数到全局作用域（用于onclick调用）
    window.changeNavPage = changeNavPage;
    window.togglePanel = togglePanel;
});

// ==================== 面板折叠功能 ====================
function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.classList.toggle('collapsed');
    }
}

// ==================== 服务器健康检查 ====================
function startHealthCheck() {
    // 每3秒检查一次服务器状态
    healthCheckInterval = setInterval(checkServerHealth, 3000);
    // 立即检查一次
    checkServerHealth();
}

async function checkServerHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(`${API_BASE}/api/health`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            if (!serverOnline) {
                serverOnline = true;
                hideServerError();
                showToast('服务器连接已恢复', 'success');
                // 重新加载当前页面数据
                switchPage(currentPage);
            }
        } else {
            handleServerOffline();
        }
    } catch (error) {
        handleServerOffline();
    }
}

function handleServerOffline() {
    if (serverOnline) {
        serverOnline = false;
        showServerError();
        showToast('服务器连接已断开，请检查后端服务是否运行', 'error');
        
        // 如果正在刷题，暂停计时器
        if (practiceTimer) {
            clearInterval(practiceTimer);
            practiceTimer = null;
            showToast('答题计时已暂停', 'warning');
        }
    }
}

function showServerError() {
    let errorBanner = document.getElementById('server-error-banner');
    if (!errorBanner) {
        errorBanner = document.createElement('div');
        errorBanner.id = 'server-error-banner';
        errorBanner.className = 'server-error-banner';
        errorBanner.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>服务器连接已断开，请确保后端服务正在运行</span>
            <button onclick="checkServerHealth()" class="btn btn-small">重试连接</button>
        `;
        document.body.insertBefore(errorBanner, document.body.firstChild);
    }
    errorBanner.style.display = 'flex';
}

function hideServerError() {
    const errorBanner = document.getElementById('server-error-banner');
    if (errorBanner) {
        errorBanner.style.display = 'none';
    }
}

// ==================== 导航 ====================
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const page = this.dataset.page;
            switchPage(page);
        });
    });
}

function switchPage(page) {
    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    // 切换页面
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    document.getElementById(`${page}-page`).classList.add('active');
    
    currentPage = page;
    
    // 加载页面数据
    switch(page) {
        case 'dashboard':
            loadStats();
            loadBankChapters();
            break;
        case 'manage':
            loadBanks();
            break;
        case 'wrongbook':
            loadWrongBanks();
            break;
        case 'practice':
            loadPracticeOptions();
            showPracticeSettings();
            loadRankings();
            loadProgressList();
            break;
        case 'settings':
            loadConfig();
            break;
    }
}

// ==================== 统计数据 ====================
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            document.getElementById('total-banks').textContent = stats.total_banks;
            document.getElementById('total-questions').textContent = stats.total_questions;
            document.getElementById('single-count').textContent = stats.single_choice_count;
            document.getElementById('multi-count').textContent = stats.multi_choice_count;
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

// 加载按题库分组的章节分布
async function loadBankChapters() {
    try {
        const response = await fetch(`${API_BASE}/api/stats/by_bank`);
        const data = await response.json();
        
        const container = document.getElementById('bank-chapters-container');
        if (!container) return;
        
        if (data.success && Object.keys(data.stats).length > 0) {
            container.innerHTML = Object.entries(data.stats).map(([bankName, bankData]) => {
                const chaptersHtml = Object.entries(bankData.chapters).map(([chapterName, count]) => `
                    <div class="chapter-item">
                        <span class="chapter-name" title="${chapterName}">${chapterName}</span>
                        <span class="chapter-count">${count}题</span>
                    </div>
                `).join('');
                
                return `
                    <div class="bank-chapter-group">
                        <div class="bank-title">
                            <i class="fas fa-book"></i>
                            ${bankName}
                            <span class="bank-count">(共${bankData.total}题)</span>
                        </div>
                        <div class="chapter-list">
                            ${chaptersHtml}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>暂无题库，请先导入题库</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('加载题库章节失败:', error);
    }
}

// ==================== 文件上传 ====================
function initUpload() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });
}

function handleFileSelect(file) {
    const allowedTypes = ['.txt', '.doc', '.docx'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(ext)) {
        showToast('请选择 .txt、.doc 或 .docx 格式的文件', 'error');
        return;
    }
    
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('selected-file').style.display = 'flex';
    document.getElementById('import-btn').disabled = false;
    
    // 存储文件引用
    document.getElementById('file-input').files = createFileList(file);
}

function createFileList(file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    return dt.files;
}

function clearFile() {
    document.getElementById('file-input').value = '';
    document.getElementById('selected-file').style.display = 'none';
    document.getElementById('import-btn').disabled = true;
    document.getElementById('import-result').style.display = 'none';
}

async function importFile() {
    const fileInput = document.getElementById('file-input');
    const bankName = document.getElementById('bank-name').value.trim();
    
    if (!fileInput.files.length) {
        showToast('请先选择文件', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    if (bankName) {
        formData.append('bank_name', bankName);
    }
    
    // 显示进度
    document.getElementById('import-progress').style.display = 'block';
    document.getElementById('import-result').style.display = 'none';
    document.getElementById('import-btn').disabled = true;
    
    try {
        const response = await fetch(`${API_BASE}/api/import`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        document.getElementById('import-progress').style.display = 'none';
        const resultDiv = document.getElementById('import-result');
        resultDiv.style.display = 'block';
        
        if (data.success) {
            resultDiv.className = 'import-result success';
            resultDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${data.message}`;
            showToast(data.message, 'success');
            clearFile();
            document.getElementById('bank-name').value = '';
            loadStats();
        } else {
            resultDiv.className = 'import-result error';
            resultDiv.innerHTML = `<i class="fas fa-times-circle"></i> ${data.error}`;
            showToast(data.error, 'error');
        }
    } catch (error) {
        document.getElementById('import-progress').style.display = 'none';
        showToast('导入失败: ' + error.message, 'error');
    }
    
    document.getElementById('import-btn').disabled = false;
}

// ==================== 题库管理 ====================
async function loadBanks() {
    try {
        const response = await fetch(`${API_BASE}/api/banks`);
        const data = await response.json();
        
        const bankList = document.getElementById('bank-list');
        
        if (data.success && data.banks.length > 0) {
            bankList.innerHTML = data.banks.map(bank => `
                <div class="bank-card">
                    <div class="bank-info" onclick="browseBank('${bank.name}')">
                        <div class="bank-name">${bank.name}</div>
                        <div class="bank-meta">
                            导入时间: ${bank.import_time} | 源文件: ${bank.source_file}
                        </div>
                    </div>
                    <div class="bank-stats">
                        <span class="bank-count">${bank.question_count} 题</span>
                        <div class="bank-actions">
                            <button class="btn btn-secondary btn-small" onclick="browseBank('${bank.name}')">
                                <i class="fas fa-eye"></i> 查看
                            </button>
                            <button class="btn btn-danger btn-small" onclick="confirmDeleteBank('${bank.name}')">
                                <i class="fas fa-trash"></i> 删除
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            bankList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>暂无题库，请先导入题库</p>
                    <button class="btn btn-primary" onclick="switchPage('import')">
                        <i class="fas fa-upload"></i> 导入题库
                    </button>
                </div>
            `;
        }
        
        // 隐藏题目浏览器
        document.getElementById('question-browser').style.display = 'none';
        document.getElementById('bank-list').style.display = 'grid';
    } catch (error) {
        console.error('加载题库列表失败:', error);
        showToast('加载题库列表失败', 'error');
    }
}

function showBankList() {
    document.getElementById('question-browser').style.display = 'none';
    document.getElementById('bank-list').style.display = 'grid';
}

async function browseBank(bankName) {
    currentBankName = bankName;
    document.getElementById('current-bank-name').textContent = bankName;
    document.getElementById('bank-list').style.display = 'none';
    document.getElementById('question-browser').style.display = 'block';
    
    // 加载章节列表
    await loadChapters(bankName);
    
    // 加载题目
    await loadQuestions();
    
    // 绑定筛选事件
    document.getElementById('filter-type').onchange = loadQuestions;
    document.getElementById('filter-chapter').onchange = loadQuestions;
}

async function loadChapters(bankName) {
    try {
        const response = await fetch(`${API_BASE}/api/chapters?bank=${encodeURIComponent(bankName)}`);
        const data = await response.json();
        
        const select = document.getElementById('filter-chapter');
        select.innerHTML = '<option value="">全部章节</option>';
        
        if (data.success) {
            data.chapters.forEach(chapter => {
                select.innerHTML += `<option value="${chapter}">${chapter}</option>`;
            });
        }
    } catch (error) {
        console.error('加载章节列表失败:', error);
    }
}

async function loadQuestions() {
    const type = document.getElementById('filter-type').value;
    const chapter = document.getElementById('filter-chapter').value;
    
    let url = `${API_BASE}/api/questions?bank=${encodeURIComponent(currentBankName)}`;
    if (type) url += `&type=${type}`;
    if (chapter) url += `&chapter=${encodeURIComponent(chapter)}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        const questionList = document.getElementById('question-list');
        
        if (data.success && data.questions.length > 0) {
            questionList.innerHTML = data.questions.map((q, index) => {
                const answerSet = new Set(q.answer || []);
                const optionEntries = Object.entries(q.options || {});
                const visibleOptions = isBackMode && answerSet.size > 0
                    ? optionEntries.filter(([key]) => answerSet.has(key))
                    : optionEntries;
                const answerBlock = isBackMode ? '' : `
                    <div class="question-answer">
                        <i class="fas fa-check-circle"></i> 正确答案: ${q.answer.join('')}
                    </div>`;
                const actionBlock = isBackMode ? '' : `
                    <div class="question-actions">
                        <button class="btn btn-secondary btn-small" onclick="editQuestion('${q.id}')">
                            <i class="fas fa-edit"></i> 编辑
                        </button>
                        <button class="btn btn-danger btn-small" onclick="confirmDeleteQuestion('${q.id}')">
                            <i class="fas fa-trash"></i> 删除
                        </button>
                    </div>`;
                return `
                <div class="question-item ${q.type === 'multi' ? 'multi' : ''}">
                    <div class="question-header">
                        <span class="question-type ${q.type === 'multi' ? 'multi' : ''}">
                            ${q.type === 'multi' ? '多选题' : '单选题'}
                        </span>
                        <span class="question-chapter">${q.chapter}</span>
                    </div>
                    <div class="question-content">${index + 1}. ${q.question}</div>
                    <div class="question-options">
                        ${visibleOptions.map(([key, value]) => `
                            <div class="option-item">${key}. ${value}</div>
                        `).join('')}
                    </div>
                    ${answerBlock}
                    ${actionBlock}
                </div>`;
            }).join('');
        } else {
            questionList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>没有找到符合条件的题目</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('加载题目失败:', error);
        showToast('加载题目失败', 'error');
    }
}

function toggleBackMode(checked) {
    isBackMode = !!checked;
    loadQuestions();
}

function confirmDeleteBank(bankName) {
    showConfirmModal(
        '删除题库',
        `确定要删除题库"${bankName}"吗？该操作不可恢复。`,
        async () => {
            try {
                const response = await fetch(`${API_BASE}/api/banks/${encodeURIComponent(bankName)}`, {
                    method: 'DELETE'
                });
                const data = await response.json();
                
                if (data.success) {
                    showToast(data.message, 'success');
                    loadBanks();
                    loadStats();
                } else {
                    showToast(data.error, 'error');
                }
            } catch (error) {
                showToast('删除失败: ' + error.message, 'error');
            }
        }
    );
}

function confirmDeleteQuestion(questionId) {
    showConfirmModal(
        '删除题目',
        '确定要删除这道题目吗？该操作不可恢复。',
        async () => {
            try {
                const response = await fetch(`${API_BASE}/api/questions/${questionId}`, {
                    method: 'DELETE'
                });
                const data = await response.json();
                
                if (data.success) {
                    showToast('题目已删除', 'success');
                    loadQuestions();
                    loadStats();
                } else {
                    showToast(data.error, 'error');
                }
            } catch (error) {
                showToast('删除失败: ' + error.message, 'error');
            }
        }
    );
}

async function editQuestion(questionId) {
    try {
        const response = await fetch(`${API_BASE}/api/questions/${questionId}`);
        const data = await response.json();
        
        if (data.success) {
            const q = data.question;
            editingQuestionId = questionId;
            
            document.getElementById('edit-question').value = q.question;
            document.getElementById('edit-type').value = q.type;
            document.getElementById('edit-answer').value = q.answer.join('');

            // 初始化可编辑选项列表（至少提供 A-D）
            const baseKeys = ['A', 'B', 'C', 'D'];
            const keys = Array.from(new Set([...baseKeys, ...Object.keys(q.options || {})])).sort();
            editOptionsState = keys.map(k => ({ key: k, value: q.options[k] || '' }));
            renderEditOptions();
            
            document.getElementById('edit-modal').classList.add('show');
        }
    } catch (error) {
        showToast('加载题目失败', 'error');
    }
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('show');
    editingQuestionId = null;
    editOptionsState = [];
}

async function saveQuestion() {
    if (!editingQuestionId) return;
    
    const options = {};
    document.querySelectorAll('#edit-options .option-edit').forEach(row => {
        const key = row.dataset.key;
        const input = row.querySelector('input');
        if (!key || !input) return;
        const value = input.value.trim();
        if (value) {
            options[key] = value;
        }
    });
    
    const updateData = {
        question: document.getElementById('edit-question').value.trim(),
        type: document.getElementById('edit-type').value,
        options: options,
        answer: document.getElementById('edit-answer').value.toUpperCase().split('').filter(ch => options[ch])
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/questions/${editingQuestionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('题目已更新', 'success');
            closeEditModal();
            loadQuestions();
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('保存失败: ' + error.message, 'error');
    }
}

// 渲染可编辑选项列表
function renderEditOptions() {
    const optionsDiv = document.getElementById('edit-options');
    if (!optionsDiv) return;
    optionsDiv.innerHTML = editOptionsState.map(item => `
        <div class="option-edit" data-key="${item.key}">
            <span>${item.key}.</span>
            <input type="text" id="edit-option-${item.key}" value="${item.value || ''}" placeholder="选项${item.key}">
            <button class="btn btn-danger btn-small" type="button" onclick="removeEditOption('${item.key}')">删除</button>
        </div>
    `).join('');
}

// 添加新选项
function addEditOption() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const existing = new Set(editOptionsState.map(o => o.key));
    const next = [...letters].find(ch => !existing.has(ch));
    if (!next) {
        showToast('选项已达到上限', 'warning');
        return;
    }
    editOptionsState.push({ key: next, value: '' });
    renderEditOptions();
}

// 删除选项，至少保留两个
function removeEditOption(key) {
    if (editOptionsState.length <= 2) {
        showToast('至少保留两个选项', 'warning');
        return;
    }
    editOptionsState = editOptionsState.filter(o => o.key !== key);
    renderEditOptions();
}

// ==================== 刷题功能 ====================
async function loadPracticeOptions() {
    try {
        const response = await fetch(`${API_BASE}/api/banks`);
        const data = await response.json();
        
        const select = document.getElementById('practice-bank');
        select.innerHTML = '<option value="">全部题库</option>';
        
        if (data.success) {
            data.banks.forEach(bank => {
                select.innerHTML += `<option value="${bank.name}">${bank.name} (${bank.question_count}题)</option>`;
            });
        }
        
        // 绑定题库选择事件
        select.onchange = () => {
            loadPracticeChapters();
            updateAvailableStats();
        };
        
        // 初始加载统计
        updateAvailableStats();
    } catch (error) {
        console.error('加载题库选项失败:', error);
    }
}

async function loadPracticeChapters() {
    const bank = document.getElementById('practice-bank').value;
    const select = document.getElementById('practice-chapter');
    select.innerHTML = '<option value="">全部章节</option>';
    
    if (bank) {
        try {
            const response = await fetch(`${API_BASE}/api/chapters?bank=${encodeURIComponent(bank)}`);
            const data = await response.json();
            
            if (data.success) {
                data.chapters.forEach(chapter => {
                    select.innerHTML += `<option value="${chapter}">${chapter}</option>`;
                });
            }
        } catch (error) {
            console.error('加载章节失败:', error);
        }
    }
    
    select.onchange = updateAvailableStats;
}

async function updateAvailableStats() {
    const bank = document.getElementById('practice-bank').value;
    const chapter = document.getElementById('practice-chapter')?.value || '';
    
    let url = `${API_BASE}/api/stats`;
    if (bank) {
        url += `?bank=${encodeURIComponent(bank)}`;
        if (chapter) {
            url += `&chapter=${encodeURIComponent(chapter)}`;
        }
    }
    
    try {
        // 获取题目统计
        let singleCount = 0;
        let multiCount = 0;
        
        let questionsUrl = `${API_BASE}/api/questions?`;
        if (bank) questionsUrl += `bank=${encodeURIComponent(bank)}&`;
        if (chapter) questionsUrl += `chapter=${encodeURIComponent(chapter)}&`;
        
        const response = await fetch(questionsUrl);
        const data = await response.json();
        
        if (data.success) {
            data.questions.forEach(q => {
                if (q.type === 'single') singleCount++;
                else multiCount++;
            });
        }
        
        document.getElementById('available-single').textContent = singleCount;
        document.getElementById('available-multi').textContent = multiCount;
    } catch (error) {
        console.error('更新统计失败:', error);
    }
}

function showPracticeSettings() {
    document.getElementById('practice-settings').style.display = 'flex';
    document.getElementById('practice-area').style.display = 'none';
    document.getElementById('practice-result').style.display = 'none';
    document.getElementById('practice-header-info').style.display = 'none';
    document.getElementById('question-nav-panel').style.display = 'none';
    
    // 停止计时器
    if (practiceTimer) {
        clearInterval(practiceTimer);
        practiceTimer = null;
    }
}

async function startPractice(examMode = false) {
    const bank = document.getElementById('practice-bank').value;
    const chapter = document.getElementById('practice-chapter')?.value || '';
    const singleCount = parseInt(document.getElementById('practice-single-count').value) || 0;
    const multiCount = parseInt(document.getElementById('practice-multi-count').value) || 0;
    const enableTimer = document.getElementById('enable-timer').checked;
    const timeMinutes = parseInt(document.getElementById('practice-time').value) || 35;
    const shuffleOptionsEnabled = document.getElementById('shuffle-options')?.checked || false;
    
    if (singleCount === 0 && multiCount === 0) {
        showToast('请至少设置一种题型的数量', 'warning');
        return;
    }
    
    // 保存练习设置
    lastPracticeSettings = { bank, chapter, singleCount, multiCount, enableTimer, timeMinutes, examMode, shuffleOptionsEnabled, mode: examMode ? 'exam' : 'random' };
    currentPracticeMode = examMode ? 'exam' : 'random';
    
    let url = `${API_BASE}/api/practice/random?single_count=${singleCount}&multi_count=${multiCount}`;
    if (bank) url += `&bank=${encodeURIComponent(bank)}`;
    if (chapter) url += `&chapter=${encodeURIComponent(chapter)}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.questions.length > 0) {
            practiceQuestions = data.questions.map(q => {
                if (shuffleOptionsEnabled) {
                    const shuffled = shuffleEntries(Object.entries(q.options || {}), q.answer);
                    return {
                        ...q,
                        shuffledOptions: shuffled.entries,
                        shuffledAnswer: shuffled.shuffledAnswer
                    };
                }
                return { ...q, shuffledOptions: null, shuffledAnswer: null };
            });
            currentQuestionIndex = 0;
            correctCount = 0;
            wrongCount = 0;
            selectedAnswers = [];
            practiceStartTime = new Date();
            isExamMode = examMode;
            navCurrentPage = 1; // 重置答题卡页码
            
            // 重置进度相关变量（新建练习时）
            currentProgressId = null;
            loadedElapsedTime = 0;
            
            // 初始化每道题的作答结果
            questionResults = practiceQuestions.map(() => ({
                answered: false,
                userAnswer: [],
                correctAnswer: [],
                isCorrect: null
            }));
            
            document.getElementById('practice-settings').style.display = 'none';
            document.getElementById('practice-area').style.display = 'block';
            document.getElementById('practice-result').style.display = 'none';
            document.getElementById('practice-header-info').style.display = 'flex';
            document.getElementById('question-nav-panel').style.display = 'block';
            
            // 设置模式标识
            const modeBadge = document.getElementById('practice-mode-badge');
            if (isExamMode) {
                modeBadge.textContent = '模拟考试';
                modeBadge.className = 'practice-mode-badge exam';
                document.getElementById('score-info').style.display = 'none';
            } else {
                modeBadge.textContent = '刷题模式';
                modeBadge.className = 'practice-mode-badge practice';
                document.getElementById('score-info').style.display = 'flex';
            }
            
            // 渲染答题卡
            renderQuestionNav();
            
            // 设置计时器（先清除旧的）
            if (practiceTimer) {
                clearInterval(practiceTimer);
                practiceTimer = null;
            }
            if (enableTimer) {
                remainingTime = timeMinutes * 60;
                document.getElementById('timer-display').style.display = 'flex';
                updateTimerDisplay();
                practiceTimer = setInterval(updateTimer, 1000);
            } else {
                document.getElementById('timer-display').style.display = 'none';
            }
            
            renderQuestion();
        } else {
            showToast('没有找到符合条件的题目，请调整设置', 'warning');
        }
    } catch (error) {
        showToast('加载题目失败: ' + error.message, 'error');
    }
}

// 用相同设置再来一次
function restartWithSameSettings() {
    if (lastPracticeSettings) {
        document.getElementById('practice-bank').value = lastPracticeSettings.bank || '';
        if (document.getElementById('practice-chapter')) {
            document.getElementById('practice-chapter').value = lastPracticeSettings.chapter || '';
        }
        document.getElementById('practice-single-count').value = lastPracticeSettings.singleCount || 0;
        document.getElementById('practice-multi-count').value = lastPracticeSettings.multiCount || 0;
        document.getElementById('enable-timer').checked = lastPracticeSettings.enableTimer;
        document.getElementById('practice-time').value = lastPracticeSettings.timeMinutes || 30;
        if (document.getElementById('shuffle-options')) {
            document.getElementById('shuffle-options').checked = lastPracticeSettings.shuffleOptionsEnabled;
        }
        if (document.getElementById('practice-mode')) {
            document.getElementById('practice-mode').value = lastPracticeSettings.mode || 'random';
        }
        
        // 根据保存的模式启动
        const mode = lastPracticeSettings.mode || 'random';
        switch (mode) {
            case 'random':
                startPractice(false);
                break;
            case 'exam':
                startPractice(true);
                break;
            case 'sequence':
                startSequencePractice();
                break;
            case 'wrong':
                startWrongPractice();
                break;
            default:
                startPractice(lastPracticeSettings.examMode);
        }
    } else {
        showPracticeSettings();
    }
}

// 渲染题目导航（分组显示单选和多选，支持可切换分页）
function renderQuestionNav() {
    const grid = document.getElementById('question-nav-grid');
    
    // 分离单选和多选题
    const singleQuestions = [];
    const multiQuestions = [];
    practiceQuestions.forEach((q, i) => {
        if (q.type === 'multi') {
            multiQuestions.push({ index: i, question: q });
        } else {
            singleQuestions.push({ index: i, question: q });
        }
    });
    
    // 合并所有题目用于分页
    const allItems = [...singleQuestions, ...multiQuestions];
    const totalPages = Math.ceil(allItems.length / NAV_PAGE_SIZE);
    
    // 确保当前页码有效
    if (navCurrentPage < 1) navCurrentPage = 1;
    if (navCurrentPage > totalPages) navCurrentPage = totalPages;
    if (totalPages === 0) navCurrentPage = 1;
    
    // 自动切换到包含当前题目的页面（仅在非手动切换时）
    if (!manualNavPageChange) {
        const currentItemIndex = allItems.findIndex(item => item.index === currentQuestionIndex);
        if (currentItemIndex >= 0) {
            const targetPage = Math.floor(currentItemIndex / NAV_PAGE_SIZE) + 1;
            if (targetPage !== navCurrentPage) {
                navCurrentPage = targetPage;
            }
        }
    }
    
    // 计算当前页的题目范围
    const startIdx = (navCurrentPage - 1) * NAV_PAGE_SIZE;
    const endIdx = Math.min(startIdx + NAV_PAGE_SIZE, allItems.length);
    const pageItems = allItems.slice(startIdx, endIdx);
    
    let html = '';
    
    // 分页控制（如果有多页）
    if (totalPages > 1) {
        html += '<div class="nav-pagination">';
        html += `<button class="nav-page-btn ${navCurrentPage <= 1 ? 'disabled' : ''}" onclick="changeNavPage(${navCurrentPage - 1})" ${navCurrentPage <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
        
        // 页码按钮
        for (let p = 1; p <= totalPages; p++) {
            const active = p === navCurrentPage ? 'active' : '';
            html += `<button class="nav-page-num ${active}" onclick="changeNavPage(${p})">${p}</button>`;
        }
        
        html += `<button class="nav-page-btn ${navCurrentPage >= totalPages ? 'disabled' : ''}" onclick="changeNavPage(${navCurrentPage + 1})" ${navCurrentPage >= totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
        html += '</div>';
    }
    
    // 找出当前页中单选和多选的分界
    let currentSection = null;
    
    pageItems.forEach((item) => {
        const itemType = item.question.type === 'multi' ? 'multi' : 'single';
        
        // 检查是否需要添加分组标题
        if (currentSection !== itemType) {
            // 关闭上一个分组
            if (currentSection !== null) {
                html += '</div></div>';
            }
            
            // 开始新分组
            currentSection = itemType;
            const totalCount = itemType === 'multi' ? multiQuestions.length : singleQuestions.length;
            const title = itemType === 'multi' ? '多选题' : '单选题';
            html += `<div class="nav-section"><div class="nav-section-title ${itemType === 'multi' ? 'multi' : ''}">${title} (${totalCount}题)</div>`;
            html += '<div class="nav-section-grid">';
        }
        
        const answered = questionResults[item.index]?.answered ? 'answered' : '';
        const current = item.index === currentQuestionIndex ? 'current' : '';
        const multiClass = item.question.type === 'multi' ? 'multi' : '';
        html += `<button class="nav-btn ${multiClass} ${answered} ${current}" onclick="goToQuestion(${item.index})">${item.index + 1}</button>`;
    });
    
    // 关闭最后一个分组
    if (currentSection !== null) {
        html += '</div></div>';
    }
    
    grid.innerHTML = html;
    
    // 更新已答题数
    const answeredCount = questionResults.filter(r => r.answered).length;
    document.getElementById('answered-count').textContent = answeredCount;
    document.getElementById('nav-total').textContent = practiceQuestions.length;
}

// 切换答题卡页面
let manualNavPageChange = false; // 标记是否是手动切换页面

function changeNavPage(page) {
    const allCount = practiceQuestions.length;
    const totalPages = Math.ceil(allCount / NAV_PAGE_SIZE);
    
    if (page >= 1 && page <= totalPages) {
        navCurrentPage = page;
        manualNavPageChange = true; // 标记为手动切换
        renderQuestionNav();
        manualNavPageChange = false; // 渲染完成后重置
    }
}

// 跳转到指定题目
function goToQuestion(index) {
    if (index >= 0 && index < practiceQuestions.length) {
        currentQuestionIndex = index;
        renderQuestion();
        renderQuestionNav();
    }
}

function updateTimer() {
    remainingTime--;
    updateTimerDisplay();
    
    if (remainingTime <= 0) {
        clearInterval(practiceTimer);
        practiceTimer = null;
        showToast('时间到！', 'warning');
        showPracticeResult();
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timer-text').textContent = display;
    
    // 时间不足5分钟时变红
    const timerDisplay = document.getElementById('timer-display');
    if (remainingTime <= 300) {
        timerDisplay.classList.add('warning');
    } else {
        timerDisplay.classList.remove('warning');
    }
}

function renderQuestion() {
    const question = practiceQuestions[currentQuestionIndex];
    const result = questionResults[currentQuestionIndex];
    
    // 更新进度
    document.getElementById('current-index').textContent = currentQuestionIndex + 1;
    document.getElementById('total-count').textContent = practiceQuestions.length;
    document.getElementById('correct-num').textContent = correctCount;
    document.getElementById('wrong-num').textContent = wrongCount;
    
    // 渲染题目
    document.getElementById('question-type').textContent = question.type === 'multi' ? '多选题' : '单选题';
    document.getElementById('question-type').className = `question-type ${question.type === 'multi' ? 'multi' : ''}`;
    document.getElementById('question-chapter').textContent = question.chapter;
    document.getElementById('question-content').textContent = question.question;
    
    // 渲染选项
    const optionsList = document.getElementById('options-list');
    const optionEntries = question.shuffledOptions || Object.entries(question.options);
    
    // 模拟考试模式：允许随时修改答案，不锁定
    if (isExamMode) {
        // 恢复已选答案
        selectedAnswers = result.answered ? [...result.userAnswer] : [];
        
        optionsList.innerHTML = optionEntries.map(([key, value]) => {
            const isSelected = selectedAnswers.includes(key) ? 'selected' : '';
            return `<button class="option-btn ${isSelected}" onclick="selectOption('${key}', ${question.type === 'multi'})" data-key="${key}">
                <span class="option-key">${key}</span>
                <span class="option-text">${value}</span>
            </button>`;
        }).join('');
        
        document.getElementById('answer-result').style.display = 'none';
        document.getElementById('submit-btn').style.display = 'none'; // 模拟考试不需要提交按钮
        document.getElementById('next-btn').style.display = 'inline-flex';
        
        if (currentQuestionIndex === practiceQuestions.length - 1) {
            document.getElementById('next-btn').innerHTML = '提交试卷 <i class="fas fa-paper-plane"></i>';
        } else {
            document.getElementById('next-btn').innerHTML = '下一题 <i class="fas fa-arrow-right"></i>';
        }
    } else if (result.answered) {
        // 刷题模式已作答：显示完整结果
        optionsList.innerHTML = optionEntries.map(([key, value]) => {
            const isCorrect = result.correctAnswer.includes(key) ? 'correct' : '';
            const isWrong = result.userAnswer.includes(key) && !result.correctAnswer.includes(key) ? 'wrong' : '';
            const isSelected = result.userAnswer.includes(key) ? 'selected' : '';
            return `<button class="option-btn ${isCorrect} ${isWrong} ${isSelected} disabled" data-key="${key}">
                <span class="option-key">${key}</span>
                <span class="option-text">${value}</span>
            </button>`;
        }).join('');
        
        // 显示结果
        const resultDiv = document.getElementById('answer-result');
        resultDiv.style.display = 'flex';
        if (result.isCorrect) {
            resultDiv.className = 'answer-result correct';
            resultDiv.innerHTML = '<i class="fas fa-check-circle"></i> 回答正确！';
        } else {
            resultDiv.className = 'answer-result wrong';
            resultDiv.innerHTML = `<i class="fas fa-times-circle"></i> 回答错误，正确答案是: ${result.correctAnswer.join('')}`;
        }
        
        // 已作答的题目隐藏提交按钮
        document.getElementById('submit-btn').style.display = 'none';
        document.getElementById('next-btn').style.display = 'inline-flex';
        
        // 更新下一题按钮文字
        if (currentQuestionIndex === practiceQuestions.length - 1) {
            document.getElementById('next-btn').innerHTML = '查看结果 <i class="fas fa-flag-checkered"></i>';
        } else {
            document.getElementById('next-btn').innerHTML = '下一题 <i class="fas fa-arrow-right"></i>';
        }
    } else {
        // 刷题模式未作答：正常渲染
        optionsList.innerHTML = optionEntries.map(([key, value]) => `
            <button class="option-btn" onclick="selectOption('${key}', ${question.type === 'multi'})" data-key="${key}">
                <span class="option-key">${key}</span>
                <span class="option-text">${value}</span>
            </button>
        `).join('');
        
        // 重置状态
        selectedAnswers = [];
        document.getElementById('answer-result').style.display = 'none';
        document.getElementById('submit-btn').style.display = 'inline-flex';
        document.getElementById('next-btn').style.display = 'none';
    }
    
    document.getElementById('prev-btn').disabled = currentQuestionIndex === 0;
    
    // 更新导航面板
    renderQuestionNav();
}

function selectOption(key, isMulti) {
    const btn = document.querySelector(`.option-btn[data-key="${key}"]`);
    
    if (btn.classList.contains('disabled')) return;
    
    if (isMulti) {
        // 多选题
        if (selectedAnswers.includes(key)) {
            selectedAnswers = selectedAnswers.filter(k => k !== key);
            btn.classList.remove('selected');
        } else {
            selectedAnswers.push(key);
            btn.classList.add('selected');
        }
    } else {
        // 单选题
        document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAnswers = [key];
    }
    
    // 模拟考试模式：自动保存选择的答案（不判分）
    if (isExamMode && selectedAnswers.length > 0) {
        saveExamAnswer();
    }
}

// 模拟考试模式：仅保存答案，不判分
function saveExamAnswer() {
    if (!isExamMode) return;
    const question = practiceQuestions[currentQuestionIndex];
    // 使用打乱后的答案（如果有）
    const correctAnswer = question.shuffledAnswer || question.answer || [];
    questionResults[currentQuestionIndex] = {
        answered: true,
        userAnswer: [...selectedAnswers],
        correctAnswer: correctAnswer,
        isCorrect: null  // 暂不判分
    };
    renderQuestionNav();
}

// 洗牌函数：只打乱选项内容，保持ABCD顺序不变，同时返回答案映射
function shuffleEntries(entries, originalAnswer) {
    const keys = entries.map(([key]) => key).sort(); // 保持字母顺序 A, B, C, D...
    const values = entries.map(([, value]) => value);
    const originalKeys = entries.map(([key]) => key).sort();
    
    // 创建原始值到原始键的映射
    const valueToOriginalKey = {};
    entries.forEach(([key, value]) => {
        valueToOriginalKey[value] = key;
    });
    
    // 只打乱值
    for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
    }
    
    // 创建新键到值的映射，以及原始键到新键的映射
    const newEntries = keys.map((key, idx) => [key, values[idx]]);
    
    // 创建答案映射：原始答案字母 -> 新答案字母
    // 例如原本D是正确答案，D的内容现在在A位置，那么新答案就是A
    const answerMap = {};
    newEntries.forEach(([newKey, value]) => {
        const originalKey = valueToOriginalKey[value];
        if (originalKey) {
            answerMap[originalKey] = newKey;
        }
    });
    
    // 转换正确答案
    const shuffledAnswer = (originalAnswer || []).map(ans => answerMap[ans] || ans);
    
    return {
        entries: newEntries,
        shuffledAnswer: shuffledAnswer
    };
}

async function submitAnswer() {
    if (selectedAnswers.length === 0) {
        showToast('请选择答案', 'warning');
        return;
    }
    
    const question = practiceQuestions[currentQuestionIndex];
    
    // 使用打乱后的答案（如果有），否则使用原始答案
    const correctAnswer = question.shuffledAnswer || question.answer || [];
    
    // 在前端判断答案是否正确
    const isCorrect = arraysEqual([...selectedAnswers].sort(), [...correctAnswer].sort());
    
    // 保存作答结果
    questionResults[currentQuestionIndex] = {
        answered: true,
        userAnswer: [...selectedAnswers],
        correctAnswer: correctAnswer,
        isCorrect: isCorrect
    };
    
    // 如果答错，添加到错题本
    if (!isCorrect) {
        addToWrongbook(question.id, selectedAnswers);
    }
    
    if (isExamMode) {
        // 模拟考试模式：不显示答案，只标记已答
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.add('disabled');
        });
        
        // 更新导航
        renderQuestionNav();
        
        // 切换按钮
        document.getElementById('submit-btn').style.display = 'none';
        document.getElementById('next-btn').style.display = 'inline-flex';
        
        if (currentQuestionIndex === practiceQuestions.length - 1) {
            document.getElementById('next-btn').innerHTML = '提交试卷 <i class="fas fa-paper-plane"></i>';
        } else {
            document.getElementById('next-btn').innerHTML = '下一题 <i class="fas fa-arrow-right"></i>';
        }
    } else {
        // 刷题模式：显示答案
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.add('disabled');
            const key = btn.dataset.key;
            
            if (correctAnswer.includes(key)) {
                btn.classList.add('correct');
            } else if (selectedAnswers.includes(key)) {
                btn.classList.add('wrong');
            }
        });
        
        // 显示结果
        const resultDiv = document.getElementById('answer-result');
        resultDiv.style.display = 'flex';
        
        if (isCorrect) {
            correctCount++;
            resultDiv.className = 'answer-result correct';
            resultDiv.innerHTML = '<i class="fas fa-check-circle"></i> 回答正确！';
        } else {
            wrongCount++;
            resultDiv.className = 'answer-result wrong';
            resultDiv.innerHTML = `<i class="fas fa-times-circle"></i> 回答错误，正确答案是: ${correctAnswer.join('')}`;
        }
        
        // 更新计数
        document.getElementById('correct-num').textContent = correctCount;
        document.getElementById('wrong-num').textContent = wrongCount;
        
        // 切换按钮
        document.getElementById('submit-btn').style.display = 'none';
        document.getElementById('next-btn').style.display = 'inline-flex';
        
        // 如果是最后一题
        if (currentQuestionIndex === practiceQuestions.length - 1) {
            document.getElementById('next-btn').innerHTML = '查看结果 <i class="fas fa-flag-checkered"></i>';
        }
    }
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
}

function nextQuestion() {
    if (currentQuestionIndex < practiceQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        // 显示结果
        if (isExamMode) {
            // 模拟考试模式：先计算所有答案
            calculateExamResults();
        }
        showPracticeResult();
    }
}

// 计算模拟考试结果 - 最终判分
function calculateExamResults() {
    correctCount = 0;
    wrongCount = 0;
    
    questionResults.forEach((result, index) => {
        const question = practiceQuestions[index];
        const correctAnswer = question.answer || [];
        
        if (result.answered && result.userAnswer.length > 0) {
            // 判断答案是否正确
            const isCorrect = arraysEqual(result.userAnswer.sort(), correctAnswer.sort());
            result.isCorrect = isCorrect;
            result.correctAnswer = correctAnswer;
            
            if (isCorrect) {
                correctCount++;
            } else {
                wrongCount++;
                // 答错添加到错题本
                addToWrongbook(question.id, result.userAnswer);
            }
        } else {
            // 未答题算错
            result.isCorrect = false;
            result.correctAnswer = correctAnswer;
            wrongCount++;
        }
    });
}

// 辅助函数：比较两个数组是否相等
function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function showPracticeResult() {
    // 停止计时器
    if (practiceTimer) {
        clearInterval(practiceTimer);
        practiceTimer = null;
    }
    
    // 计算用时：当前会话时间 + 之前读档的时间
    const endTime = new Date();
    const currentSessionTime = Math.floor((endTime - practiceStartTime) / 1000); // 秒
    const totalTimeSpent = loadedElapsedTime + currentSessionTime;
    const minutes = Math.floor(totalTimeSpent / 60);
    const seconds = totalTimeSpent % 60;
    const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    document.getElementById('practice-area').style.display = 'none';
    document.getElementById('practice-result').style.display = 'block';
    document.getElementById('practice-header-info').style.display = 'none';
    document.getElementById('question-nav-panel').style.display = 'none';
    
    const total = practiceQuestions.length;
    const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    
    document.getElementById('result-total').textContent = total;
    document.getElementById('result-correct').textContent = correctCount;
    document.getElementById('result-wrong').textContent = wrongCount;
    document.getElementById('result-rate').textContent = rate + '%';
    document.getElementById('result-time').textContent = timeDisplay;
    
    // 完成后删除进度（如果有）
    if (currentProgressId) {
        deleteProgress(currentProgressId, true);
        currentProgressId = null;
    }
    
    // 重置已用时间
    loadedElapsedTime = 0;
    
    // 渲染答题详情导航
    renderResultNav();
    // 默认显示第一题
    showResultQuestion(0);
    
    // 保存成绩到排名
    const playerName = document.getElementById('player-name')?.value?.trim() || '匿名';
    saveRanking({
        name: playerName,
        total: total,
        correct: correctCount,
        wrong: wrongCount,
        accuracy: rate,
        time_spent: timeSpent,
        time_display: timeDisplay
    });
}

// 渲染结果页题目导航
function renderResultNav() {
    const grid = document.getElementById('result-nav-grid');
    
    grid.innerHTML = practiceQuestions.map((_, i) => {
        const num = i + 1;
        const result = questionResults[i];
        const status = result.answered ? (result.isCorrect ? 'correct' : 'wrong') : 'wrong';
        return `<button class="result-nav-btn ${status}" onclick="showResultQuestion(${i})" data-index="${i}">${num}</button>`;
    }).join('');
}

// 显示结果页中某道题的详情
function showResultQuestion(index) {
    const question = practiceQuestions[index];
    const result = questionResults[index];
    const detailDiv = document.getElementById('result-question-detail');
    
    // 更新导航按钮高亮
    document.querySelectorAll('.result-nav-btn').forEach((btn, i) => {
        btn.classList.toggle('current', i === index);
    });
    
    const typeText = question.type === 'multi' ? '多选题' : '单选题';
    const statusClass = result.answered ? (result.isCorrect ? 'correct' : 'wrong') : 'wrong';
    const statusText = result.answered ? (result.isCorrect ? '✓ 正确' : '✗ 错误') : '✗ 未作答';
    
    let optionsHtml = Object.entries(question.options).map(([key, value]) => {
        const classes = [];
        const isUserSelected = result.userAnswer.includes(key);
        const isCorrectAnswer = result.correctAnswer.includes(key);
        
        if (isCorrectAnswer) {
            classes.push('correct-answer');
        }
        if (isUserSelected && !isCorrectAnswer) {
            classes.push('wrong-answer');
        }
        if (isUserSelected) {
            classes.push('user-selected');
        }
        
        return `<div class="result-option ${classes.join(' ')}">
            <span class="result-option-key">${key}</span>
            <span class="result-option-text">${value}</span>
        </div>`;
    }).join('');
    
    const userAnswerText = result.userAnswer.length > 0 ? result.userAnswer.join('') : '未作答';
    const correctAnswerText = result.correctAnswer.join('');
    
    detailDiv.innerHTML = `
        <div class="result-question-header">
            <span class="question-type ${question.type === 'multi' ? 'multi' : ''}">${typeText}</span>
            <span class="result-question-status ${statusClass}">${statusText}</span>
            <span class="question-chapter">${question.chapter}</span>
        </div>
        <div class="result-question-content">${index + 1}. ${question.question}</div>
        <div class="result-options-list">${optionsHtml}</div>
        <div class="result-answer-info">
            <span class="your-answer"><i class="fas fa-user"></i> 你的答案: ${userAnswerText}</span>
            <span class="correct-answer"><i class="fas fa-check"></i> 正确答案: ${correctAnswerText}</span>
        </div>
    `;
}

// ==================== 设置 ====================
async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE}/api/config`);
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('data-path').value = data.config.data_path || '';
            document.getElementById('current-data-file').textContent = 
                data.config.data_path + '/' + data.config.questions_file;
        }
    } catch (error) {
        console.error('加载配置失败:', error);
    }
}

async function saveSettings() {
    const dataPath = document.getElementById('data-path').value.trim();
    
    if (!dataPath) {
        showToast('请输入数据存储路径', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data_path: dataPath,
                questions_file: 'questions.json'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('设置已保存', 'success');
            loadConfig();
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('保存设置失败: ' + error.message, 'error');
    }
}

function clearAllData() {
    showConfirmModal(
        '清空所有数据',
        '确定要清空所有题库数据吗？该操作不可恢复！',
        async () => {
            try {
                // 获取所有题库并删除
                const response = await fetch(`${API_BASE}/api/banks`);
                const data = await response.json();
                
                if (data.success) {
                    for (const bank of data.banks) {
                        await fetch(`${API_BASE}/api/banks/${encodeURIComponent(bank.name)}`, {
                            method: 'DELETE'
                        });
                    }
                    showToast('所有数据已清空', 'success');
                    loadStats();
                }
            } catch (error) {
                showToast('清空数据失败: ' + error.message, 'error');
            }
        }
    );
}

// ==================== 工具函数 ====================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-circle'
    };
    
    toast.innerHTML = `
        <i class="${icons[type] || icons.success}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showConfirmModal(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-modal').classList.add('show');
    
    document.getElementById('confirm-btn').onclick = () => {
        closeModal();
        onConfirm();
    };
}

function closeModal() {
    document.getElementById('confirm-modal').classList.remove('show');
}

function browseDataPath() {
    showToast('请在输入框中直接输入路径', 'warning');
}

// ==================== 排名系统 ====================
async function loadRankings() {
    try {
        const response = await fetch(`${API_BASE}/api/rankings`);
        const data = await response.json();
        
        if (data.success) {
            renderRankings(data.rankings);
        }
    } catch (error) {
        console.error('加载排名失败:', error);
    }
}

function renderRankings(rankings) {
    const container = document.getElementById('ranking-list');
    if (!container) return;
    
    if (!rankings || rankings.length === 0) {
        container.innerHTML = '<div class="empty-ranking">暂无记录</div>';
        return;
    }
    
    // 按正确率和用时排序（正确率高优先，用时短次优先）
    rankings.sort((a, b) => {
        if (b.accuracy !== a.accuracy) {
            return b.accuracy - a.accuracy;
        }
        return a.time_spent - b.time_spent;
    });
    
    const html = rankings.slice(0, 20).map((item, index) => {
        const rankClass = index < 3 ? `top-${index + 1}` : '';
        const dateStr = item.date ? new Date(item.date).toLocaleDateString('zh-CN') : '';
        
        return `
            <div class="ranking-item ${rankClass}">
                <div class="ranking-rank">${index + 1}</div>
                <div class="ranking-info">
                    <div class="ranking-name">${escapeHtml(item.name)}</div>
                    <div class="ranking-details">
                        <span>${item.correct}/${item.total}题</span>
                    </div>
                </div>
                <div class="ranking-stats">
                    <div class="ranking-accuracy">${item.accuracy}%</div>
                    <div class="ranking-time">
                        <i class="fas fa-clock"></i> ${item.time_display}
                    </div>
                    <div class="ranking-date">${dateStr}</div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

async function saveRanking(record) {
    try {
        const response = await fetch(`${API_BASE}/api/rankings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadRankings();
        }
    } catch (error) {
        console.error('保存排名失败:', error);
    }
}

async function clearRankings() {
    showConfirmModal(
        '清空排名',
        '确定要清空所有排名记录吗？此操作不可恢复。',
        async () => {
            try {
                const response = await fetch(`${API_BASE}/api/rankings`, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showToast('排名已清空', 'success');
                    loadRankings();
                } else {
                    showToast('清空失败: ' + data.message, 'error');
                }
            } catch (error) {
                showToast('清空失败: ' + error.message, 'error');
            }
        }
    );
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== 做题模式切换 ====================
function onPracticeModeChange() {
    const mode = document.getElementById('practice-mode').value;
    currentPracticeMode = mode;
    
    const shuffleQuestionsRow = document.getElementById('shuffle-questions-row');
    const startBtn = document.getElementById('start-practice-btn');
    const singleCountInput = document.getElementById('practice-single-count');
    const multiCountInput = document.getElementById('practice-multi-count');
    
    // 顺序做题模式显示打乱题目选项
    if (shuffleQuestionsRow) {
        shuffleQuestionsRow.style.display = mode === 'sequence' ? 'block' : 'none';
    }
    
    // 更新按钮文字
    const modeNames = {
        'random': '开始刷题',
        'exam': '开始考试',
        'sequence': '开始做题',
        'wrong': '开始练习'
    };
    startBtn.innerHTML = `<i class="fas fa-play"></i> ${modeNames[mode] || '开始'}`;
    
    // 错题模式下更新可用题数
    if (mode === 'wrong') {
        updateWrongQuestionStats();
    } else {
        updateAvailableStats();
    }
}

// 更新错题数量统计
async function updateWrongQuestionStats() {
    try {
        const bank = document.getElementById('practice-bank').value;
        let url = `${API_BASE}/api/wrongbook/stats`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            let singleCount = 0;
            let multiCount = 0;
            
            if (bank && data.stats[bank]) {
                singleCount = data.stats[bank].single || 0;
                multiCount = data.stats[bank].multi || 0;
            } else {
                // 所有题库的错题
                Object.values(data.stats).forEach(stat => {
                    singleCount += stat.single || 0;
                    multiCount += stat.multi || 0;
                });
            }
            
            document.getElementById('available-single').textContent = singleCount;
            document.getElementById('available-multi').textContent = multiCount;
        }
    } catch (error) {
        console.error('更新错题统计失败:', error);
    }
}

// 根据模式开始练习
function startPracticeByMode() {
    const mode = document.getElementById('practice-mode').value;
    currentPracticeMode = mode;
    
    switch (mode) {
        case 'random':
            startPractice(false);
            break;
        case 'exam':
            startPractice(true);
            break;
        case 'sequence':
            startSequencePractice();
            break;
        case 'wrong':
            startWrongPractice();
            break;
        default:
            startPractice(false);
    }
}

// 顺序做题模式
async function startSequencePractice() {
    const bank = document.getElementById('practice-bank').value;
    const chapter = document.getElementById('practice-chapter')?.value || '';
    const shuffleQuestions = document.getElementById('shuffle-questions')?.checked || false;
    const shuffleOptionsEnabled = document.getElementById('shuffle-options')?.checked || false;
    const enableTimer = document.getElementById('enable-timer').checked;
    const timeMinutes = parseInt(document.getElementById('practice-time').value) || 30;
    
    if (!bank) {
        showToast('顺序做题模式请选择题库', 'warning');
        return;
    }
    
    let url = `${API_BASE}/api/practice/sequence?bank=${encodeURIComponent(bank)}`;
    if (chapter) url += `&chapter=${encodeURIComponent(chapter)}`;
    if (shuffleQuestions) url += `&shuffle=true`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.questions.length > 0) {
            practiceQuestions = data.questions.map(q => {
                if (shuffleOptionsEnabled) {
                    const shuffled = shuffleEntries(Object.entries(q.options || {}), q.answer);
                    return {
                        ...q,
                        shuffledOptions: shuffled.entries,
                        shuffledAnswer: shuffled.shuffledAnswer
                    };
                }
                return { ...q, shuffledOptions: null, shuffledAnswer: null };
            });
            
            lastPracticeSettings = { 
                bank, chapter, 
                singleCount: 0, multiCount: 0, 
                enableTimer, timeMinutes, 
                examMode: false, shuffleOptionsEnabled,
                mode: 'sequence', shuffleQuestions
            };
            
            initPracticeSession(enableTimer, timeMinutes, false);
        } else {
            showToast('没有找到符合条件的题目', 'warning');
        }
    } catch (error) {
        showToast('加载题目失败: ' + error.message, 'error');
    }
}

// 错题练习模式
async function startWrongPractice() {
    const bank = document.getElementById('practice-bank').value;
    const singleCount = parseInt(document.getElementById('practice-single-count').value) || 0;
    const multiCount = parseInt(document.getElementById('practice-multi-count').value) || 0;
    const shuffleOptionsEnabled = document.getElementById('shuffle-options')?.checked || false;
    const enableTimer = document.getElementById('enable-timer').checked;
    const timeMinutes = parseInt(document.getElementById('practice-time').value) || 30;
    
    if (singleCount === 0 && multiCount === 0) {
        showToast('请至少设置一种题型的数量', 'warning');
        return;
    }
    
    let url = `${API_BASE}/api/practice/wrong?single_count=${singleCount}&multi_count=${multiCount}`;
    if (bank) url += `&bank=${encodeURIComponent(bank)}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.questions.length > 0) {
            practiceQuestions = data.questions.map(q => {
                if (shuffleOptionsEnabled) {
                    const shuffled = shuffleEntries(Object.entries(q.options || {}), q.answer);
                    return {
                        ...q,
                        shuffledOptions: shuffled.entries,
                        shuffledAnswer: shuffled.shuffledAnswer
                    };
                }
                return { ...q, shuffledOptions: null, shuffledAnswer: null };
            });
            
            lastPracticeSettings = { 
                bank, chapter: '', 
                singleCount, multiCount, 
                enableTimer, timeMinutes, 
                examMode: false, shuffleOptionsEnabled,
                mode: 'wrong'
            };
            
            initPracticeSession(enableTimer, timeMinutes, false);
        } else {
            showToast('错题本中没有符合条件的题目', 'warning');
        }
    } catch (error) {
        showToast('加载错题失败: ' + error.message, 'error');
    }
}

// 初始化练习会话（公共逻辑）
function initPracticeSession(enableTimer, timeMinutes, examMode) {
    currentQuestionIndex = 0;
    correctCount = 0;
    wrongCount = 0;
    selectedAnswers = [];
    practiceStartTime = new Date();
    isExamMode = examMode;
    navCurrentPage = 1; // 重置答题卡页码
    
    // 重置进度相关变量（新建练习时）
    currentProgressId = null;
    loadedElapsedTime = 0;
    
    questionResults = practiceQuestions.map(() => ({
        answered: false,
        userAnswer: [],
        correctAnswer: [],
        isCorrect: null
    }));
    
    document.getElementById('practice-settings').style.display = 'none';
    document.getElementById('practice-area').style.display = 'block';
    document.getElementById('practice-result').style.display = 'none';
    document.getElementById('practice-header-info').style.display = 'flex';
    document.getElementById('question-nav-panel').style.display = 'block';
    
    // 设置模式标识
    const modeBadge = document.getElementById('practice-mode-badge');
    const modeTexts = {
        'random': '刷题模式',
        'exam': '模拟考试',
        'sequence': '顺序做题',
        'wrong': '错题练习'
    };
    modeBadge.textContent = modeTexts[currentPracticeMode] || '刷题模式';
    modeBadge.className = `practice-mode-badge ${currentPracticeMode}`;
    
    if (isExamMode) {
        document.getElementById('score-info').style.display = 'none';
    } else {
        document.getElementById('score-info').style.display = 'flex';
    }
    
    renderQuestionNav();
    
    // 设置计时器（先清除旧的）
    if (practiceTimer) {
        clearInterval(practiceTimer);
        practiceTimer = null;
    }
    if (enableTimer) {
        remainingTime = timeMinutes * 60;
        document.getElementById('timer-display').style.display = 'flex';
        updateTimerDisplay();
        practiceTimer = setInterval(updateTimer, 1000);
    } else {
        document.getElementById('timer-display').style.display = 'none';
    }
    
    renderQuestion();
}

// ==================== 错题本功能 ====================
async function loadWrongBanks() {
    try {
        const response = await fetch(`${API_BASE}/api/wrongbook/stats`);
        const data = await response.json();
        
        const bankList = document.getElementById('wrong-bank-list');
        
        if (data.success && Object.keys(data.stats).length > 0) {
            bankList.innerHTML = Object.entries(data.stats).map(([bankName, stats]) => `
                <div class="bank-card">
                    <div class="bank-info" onclick="browseWrongBank('${bankName}')">
                        <div class="bank-name">${bankName}</div>
                        <div class="bank-meta">
                            单选: ${stats.single}题 | 多选: ${stats.multi}题
                        </div>
                    </div>
                    <div class="bank-stats">
                        <span class="bank-count wrong-count-badge">${stats.total} 道错题</span>
                        <div class="bank-actions">
                            <button class="btn btn-secondary btn-small" onclick="browseWrongBank('${bankName}')">
                                <i class="fas fa-eye"></i> 查看
                            </button>
                            <button class="btn btn-danger btn-small" onclick="confirmClearWrongBank('${bankName}')">
                                <i class="fas fa-trash"></i> 清空
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            bankList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-smile"></i>
                    <p>错题本为空，继续保持！</p>
                </div>
            `;
        }
        
        document.getElementById('wrong-question-browser').style.display = 'none';
        document.getElementById('wrong-bank-list').style.display = 'grid';
    } catch (error) {
        console.error('加载错题本失败:', error);
        showToast('加载错题本失败', 'error');
    }
}

function showWrongBankList() {
    document.getElementById('wrong-question-browser').style.display = 'none';
    document.getElementById('wrong-bank-list').style.display = 'grid';
}

async function browseWrongBank(bankName) {
    currentWrongBankName = bankName;
    document.getElementById('wrong-current-bank-name').textContent = bankName + ' - 错题';
    document.getElementById('wrong-bank-list').style.display = 'none';
    document.getElementById('wrong-question-browser').style.display = 'block';
    
    await loadWrongQuestions(bankName);
}

async function loadWrongQuestions(bankName) {
    try {
        const response = await fetch(`${API_BASE}/api/wrongbook?bank=${encodeURIComponent(bankName)}`);
        const data = await response.json();
        
        const questionList = document.getElementById('wrong-question-list');
        
        if (data.success && data.wrong_questions.length > 0) {
            questionList.innerHTML = data.wrong_questions.map((q, index) => `
                <div class="question-item ${q.type === 'multi' ? 'multi' : ''}">
                    <div class="question-header">
                        <span class="question-type ${q.type === 'multi' ? 'multi' : ''}">
                            ${q.type === 'multi' ? '多选题' : '单选题'}
                        </span>
                        <span class="question-chapter">${q.chapter}</span>
                        <span class="wrong-count-badge" style="margin-left: auto;">错${q.wrong_count || 1}次</span>
                    </div>
                    <div class="question-content">${index + 1}. ${q.question}</div>
                    <div class="question-options">
                        ${Object.entries(q.options || {}).map(([key, value]) => {
                            const isCorrect = q.answer.includes(key) ? 'correct-answer' : '';
                            const isWrong = (q.last_wrong_answer || []).includes(key) && !q.answer.includes(key) ? 'wrong-answer' : '';
                            return `<div class="option-item ${isCorrect} ${isWrong}">${key}. ${value}</div>`;
                        }).join('')}
                    </div>
                    <div class="question-answer">
                        <i class="fas fa-check-circle"></i> 正确答案: ${q.answer.join('')}
                        ${q.last_wrong_answer ? `<span style="margin-left:15px; color:var(--danger-color);"><i class="fas fa-times-circle"></i> 上次答案: ${q.last_wrong_answer.join('')}</span>` : ''}
                    </div>
                    <div class="question-actions">
                        <button class="btn btn-success btn-small" onclick="removeFromWrongbook('${q.id}')">
                            <i class="fas fa-check"></i> 已掌握
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            questionList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-smile"></i>
                    <p>此题库暂无错题</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('加载错题失败:', error);
        showToast('加载错题失败', 'error');
    }
}

async function removeFromWrongbook(questionId) {
    try {
        const response = await fetch(`${API_BASE}/api/wrongbook/${questionId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('已从错题本移除', 'success');
            loadWrongQuestions(currentWrongBankName);
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('移除失败: ' + error.message, 'error');
    }
}

function confirmClearWrongBank(bankName) {
    showConfirmModal(
        '清空错题',
        `确定要清空"${bankName}"的所有错题吗？`,
        async () => {
            try {
                const response = await fetch(`${API_BASE}/api/wrongbook/bank/${encodeURIComponent(bankName)}`, {
                    method: 'DELETE'
                });
                const data = await response.json();
                
                if (data.success) {
                    showToast(data.message, 'success');
                    loadWrongBanks();
                } else {
                    showToast(data.error, 'error');
                }
            } catch (error) {
                showToast('清空失败: ' + error.message, 'error');
            }
        }
    );
}

function clearWrongQuestionsByBank() {
    if (currentWrongBankName) {
        confirmClearWrongBank(currentWrongBankName);
    }
}

// 添加错题到错题本
async function addToWrongbook(questionId, userAnswer) {
    try {
        await fetch(`${API_BASE}/api/wrongbook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_id: questionId,
                user_answer: userAnswer
            })
        });
    } catch (error) {
        console.error('添加错题失败:', error);
    }
}

// ==================== 进度保存功能 ====================
async function loadProgressList() {
    try {
        const response = await fetch(`${API_BASE}/api/progress`);
        const data = await response.json();
        
        const container = document.getElementById('progress-list');
        if (!container) return;
        
        if (data.success && data.progress_list.length > 0) {
            container.innerHTML = data.progress_list.map(p => {
                const modeNames = {
                    'random': '随机刷题',
                    'exam': '模拟考试',
                    'sequence': '顺序做题',
                    'wrong': '错题练习'
                };
                return `
                    <div class="progress-item" onclick="loadProgress('${p.id}')">
                        <div>
                            <div class="mode-name">${modeNames[p.mode] || '刷题'}</div>
                            <div class="progress-info">${p.bank || '全部'} | ${p.current_index + 1}/${p.total}题</div>
                        </div>
                        <div class="progress-actions">
                            <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteProgress('${p.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = '<div class="empty-progress">暂无保存的进度</div>';
        }
    } catch (error) {
        console.error('加载进度失败:', error);
    }
}

async function saveCurrentProgress() {
    if (practiceQuestions.length === 0) {
        showToast('当前没有进行中的练习', 'warning');
        return;
    }
    
    // 计算已用时间（当前会话时间 + 之前读档的时间）
    const currentSessionTime = Math.floor((new Date() - practiceStartTime) / 1000);
    const totalElapsedTime = loadedElapsedTime + currentSessionTime;
    
    const progressData = {
        progress_id: currentProgressId, // 如果有ID则覆盖，否则创建新的
        mode: currentPracticeMode,
        bank: lastPracticeSettings?.bank || '',
        chapter: lastPracticeSettings?.chapter || '',
        current_index: currentQuestionIndex,
        total: practiceQuestions.length,
        correct: correctCount,
        wrong: wrongCount,
        question_ids: practiceQuestions.map(q => q.id),
        question_results: questionResults,
        remaining_time: remainingTime,
        elapsed_time: totalElapsedTime  // 保存已用时间
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(progressData)
        });
        const data = await response.json();
        
        if (data.success) {
            // 更新当前进度ID
            if (data.progress && data.progress.id) {
                currentProgressId = data.progress.id;
            }
            showToast('进度已保存', 'success');
            loadProgressList();
        } else {
            showToast('保存失败', 'error');
        }
    } catch (error) {
        showToast('保存失败: ' + error.message, 'error');
    }
}

async function loadProgress(progressId) {
    try {
        const response = await fetch(`${API_BASE}/api/progress/${progressId}`);
        const data = await response.json();
        
        if (data.success) {
            const progress = data.progress;
            
            // 重新加载题目
            const questionIds = progress.question_ids || [];
            const questionsResponse = await fetch(`${API_BASE}/api/questions`);
            const questionsData = await questionsResponse.json();
            
            if (questionsData.success) {
                // 按保存的顺序恢复题目
                const questionMap = {};
                questionsData.questions.forEach(q => { questionMap[q.id] = q; });
                
                practiceQuestions = questionIds.map(id => questionMap[id]).filter(q => q);
                
                if (practiceQuestions.length === 0) {
                    showToast('进度中的题目已被删除', 'error');
                    return;
                }
                
                currentQuestionIndex = progress.current_index || 0;
                correctCount = progress.correct || 0;
                wrongCount = progress.wrong || 0;
                questionResults = progress.question_results || practiceQuestions.map(() => ({
                    answered: false, userAnswer: [], correctAnswer: [], isCorrect: null
                }));
                currentPracticeMode = progress.mode || 'random';
                isExamMode = progress.mode === 'exam';
                remainingTime = progress.remaining_time || 0;
                practiceStartTime = new Date();
                navCurrentPage = 1; // 重置答题卡页码
                
                // 恢复进度ID和已用时间（用于覆盖保存和计算总用时）
                currentProgressId = progressId;
                loadedElapsedTime = progress.elapsed_time || 0;
                
                lastPracticeSettings = {
                    bank: progress.bank,
                    chapter: progress.chapter,
                    mode: progress.mode
                };
                
                // 显示练习界面
                document.getElementById('practice-settings').style.display = 'none';
                document.getElementById('practice-area').style.display = 'block';
                document.getElementById('practice-result').style.display = 'none';
                document.getElementById('practice-header-info').style.display = 'flex';
                document.getElementById('question-nav-panel').style.display = 'block';
                
                const modeBadge = document.getElementById('practice-mode-badge');
                const modeTexts = {
                    'random': '刷题模式',
                    'exam': '模拟考试',
                    'sequence': '顺序做题',
                    'wrong': '错题练习'
                };
                modeBadge.textContent = modeTexts[currentPracticeMode] || '刷题模式';
                modeBadge.className = `practice-mode-badge ${currentPracticeMode}`;
                
                document.getElementById('score-info').style.display = isExamMode ? 'none' : 'flex';
                
                // 设置计时器（先清除旧的）
                if (practiceTimer) {
                    clearInterval(practiceTimer);
                    practiceTimer = null;
                }
                if (remainingTime > 0) {
                    document.getElementById('timer-display').style.display = 'flex';
                    updateTimerDisplay();
                    practiceTimer = setInterval(updateTimer, 1000);
                } else {
                    document.getElementById('timer-display').style.display = 'none';
                }
                
                renderQuestionNav();
                renderQuestion();
                
                showToast('进度已恢复', 'success');
                
                // 不删除进度，保留用于覆盖更新
                loadProgressList();
            }
        } else {
            showToast('加载进度失败', 'error');
        }
    } catch (error) {
        showToast('加载进度失败: ' + error.message, 'error');
    }
}

async function deleteProgress(progressId, silent = false) {
    try {
        const response = await fetch(`${API_BASE}/api/progress/${progressId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) {
            if (!silent) {
                showToast('进度已删除', 'success');
            }
            loadProgressList();
        }
    } catch (error) {
        if (!silent) {
            showToast('删除失败: ' + error.message, 'error');
        }
    }
}
