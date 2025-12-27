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

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initUpload();
    loadStats();
    loadConfig();
});

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
            break;
        case 'manage':
            loadBanks();
            break;
        case 'practice':
            loadPracticeOptions();
            showPracticeSettings();
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
            
            // 渲染章节分布
            const chapterList = document.getElementById('chapter-list');
            chapterList.innerHTML = '';
            Object.entries(stats.chapters).forEach(([name, count]) => {
                chapterList.innerHTML += `
                    <div class="chapter-item">
                        <span class="chapter-name" title="${name}">${name}</span>
                        <span class="chapter-count">${count}题</span>
                    </div>
                `;
            });
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
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
    const allowedTypes = ['.doc', '.docx'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(ext)) {
        showToast('请选择.doc或.docx格式的文件', 'error');
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
            questionList.innerHTML = data.questions.map((q, index) => `
                <div class="question-item ${q.type === 'multi' ? 'multi' : ''}">
                    <div class="question-header">
                        <span class="question-type ${q.type === 'multi' ? 'multi' : ''}">
                            ${q.type === 'multi' ? '多选题' : '单选题'}
                        </span>
                        <span class="question-chapter">${q.chapter}</span>
                    </div>
                    <div class="question-content">${index + 1}. ${q.question}</div>
                    <div class="question-options">
                        ${Object.entries(q.options).map(([key, value]) => `
                            <div class="option-item">${key}. ${value}</div>
                        `).join('')}
                    </div>
                    <div class="question-answer">
                        <i class="fas fa-check-circle"></i> 正确答案: ${q.answer.join('')}
                    </div>
                    <div class="question-actions">
                        <button class="btn btn-secondary btn-small" onclick="editQuestion('${q.id}')">
                            <i class="fas fa-edit"></i> 编辑
                        </button>
                        <button class="btn btn-danger btn-small" onclick="confirmDeleteQuestion('${q.id}')">
                            <i class="fas fa-trash"></i> 删除
                        </button>
                    </div>
                </div>
            `).join('');
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
            
            // 渲染选项编辑
            const optionsDiv = document.getElementById('edit-options');
            optionsDiv.innerHTML = ['A', 'B', 'C', 'D', 'E'].map(key => `
                <div class="option-edit">
                    <span>${key}.</span>
                    <input type="text" id="edit-option-${key}" value="${q.options[key] || ''}" placeholder="选项${key}">
                </div>
            `).join('');
            
            document.getElementById('edit-modal').classList.add('show');
        }
    } catch (error) {
        showToast('加载题目失败', 'error');
    }
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('show');
    editingQuestionId = null;
}

async function saveQuestion() {
    if (!editingQuestionId) return;
    
    const options = {};
    ['A', 'B', 'C', 'D', 'E'].forEach(key => {
        const value = document.getElementById(`edit-option-${key}`).value.trim();
        if (value) {
            options[key] = value;
        }
    });
    
    const updateData = {
        question: document.getElementById('edit-question').value.trim(),
        type: document.getElementById('edit-type').value,
        options: options,
        answer: document.getElementById('edit-answer').value.toUpperCase().split('')
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
    } catch (error) {
        console.error('加载题库选项失败:', error);
    }
}

function showPracticeSettings() {
    document.getElementById('practice-settings').style.display = 'grid';
    document.getElementById('practice-area').style.display = 'none';
    document.getElementById('practice-result').style.display = 'none';
}

async function startPractice() {
    const bank = document.getElementById('practice-bank').value;
    const type = document.getElementById('practice-type').value;
    const count = parseInt(document.getElementById('practice-count').value) || 10;
    
    let url = `${API_BASE}/api/practice/random?count=${count}`;
    if (bank) url += `&bank=${encodeURIComponent(bank)}`;
    if (type) url += `&type=${type}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.questions.length > 0) {
            practiceQuestions = data.questions;
            currentQuestionIndex = 0;
            correctCount = 0;
            wrongCount = 0;
            selectedAnswers = [];
            
            document.getElementById('practice-settings').style.display = 'none';
            document.getElementById('practice-area').style.display = 'block';
            document.getElementById('practice-result').style.display = 'none';
            
            renderQuestion();
        } else {
            showToast('没有找到题目，请先导入题库', 'warning');
        }
    } catch (error) {
        showToast('加载题目失败: ' + error.message, 'error');
    }
}

function renderQuestion() {
    const question = practiceQuestions[currentQuestionIndex];
    
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
    optionsList.innerHTML = Object.entries(question.options).map(([key, value]) => `
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
    document.getElementById('prev-btn').disabled = currentQuestionIndex === 0;
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
}

async function submitAnswer() {
    if (selectedAnswers.length === 0) {
        showToast('请选择答案', 'warning');
        return;
    }
    
    const question = practiceQuestions[currentQuestionIndex];
    
    try {
        const response = await fetch(`${API_BASE}/api/practice/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_id: question.id,
                answer: selectedAnswers
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 禁用选项
            document.querySelectorAll('.option-btn').forEach(btn => {
                btn.classList.add('disabled');
                const key = btn.dataset.key;
                
                if (data.correct_answer.includes(key)) {
                    btn.classList.add('correct');
                } else if (selectedAnswers.includes(key)) {
                    btn.classList.add('wrong');
                }
            });
            
            // 显示结果
            const resultDiv = document.getElementById('answer-result');
            resultDiv.style.display = 'flex';
            
            if (data.correct) {
                correctCount++;
                resultDiv.className = 'answer-result correct';
                resultDiv.innerHTML = '<i class="fas fa-check-circle"></i> 回答正确！';
            } else {
                wrongCount++;
                resultDiv.className = 'answer-result wrong';
                resultDiv.innerHTML = `<i class="fas fa-times-circle"></i> 回答错误，正确答案是: ${data.correct_answer.join('')}`;
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
    } catch (error) {
        showToast('验证答案失败: ' + error.message, 'error');
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
        showPracticeResult();
    }
}

function showPracticeResult() {
    document.getElementById('practice-area').style.display = 'none';
    document.getElementById('practice-result').style.display = 'block';
    
    const total = practiceQuestions.length;
    const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    
    document.getElementById('result-total').textContent = total;
    document.getElementById('result-correct').textContent = correctCount;
    document.getElementById('result-wrong').textContent = wrongCount;
    document.getElementById('result-rate').textContent = rate + '%';
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
