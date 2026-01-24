// ==================== 题库管理模块 ====================

// 加载题库列表
async function loadBanks() {
    try {
        const useMobileStore = window.storageService && window.storageService.isMobile && !isElectron;
        const data = isElectron ? 
            await window.electronAPI.getBanks() :
            useMobileStore ? await window.storageService.getBanks() :
            await (await fetch(`${API_BASE}/api/banks`)).json();
        
        const bankList = document.getElementById('bank-list');
        
        if (data.success && data.banks.length > 0) {
            bankList.innerHTML = data.banks.map(bank => `
                <div class="bank-card">
                    <div class="bank-info" onclick="browseBank('${bank.name}')">
                        <div class="bank-name">${bank.name}</div>
                        ${bank.semester ? `<div class="bank-semester">${bank.semester}</div>` : ''}
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

// 显示题库列表
function showBankList() {
    document.getElementById('question-browser').style.display = 'none';
    document.getElementById('bank-list').style.display = 'grid';
}

// 浏览题库
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

// 加载章节列表
async function loadChapters(bankName) {
    try {
        const useMobileStore = window.storageService && window.storageService.isMobile && !isElectron;
        const data = isElectron ?
            await window.electronAPI.getChapters(bankName) :
            useMobileStore ? await window.storageService.getChapters(bankName) :
            await (await fetch(`${API_BASE}/api/chapters?bank=${encodeURIComponent(bankName)}`)).json();
        
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

// 加载题目列表
async function loadQuestions() {
    const type = document.getElementById('filter-type').value;
    const chapter = document.getElementById('filter-chapter').value;
    
    try {
        const useMobileStore = window.storageService && window.storageService.isMobile && !isElectron;
        const data = isElectron ?
            await window.electronAPI.getQuestions({ bank: currentBankName, type, chapter }) :
            useMobileStore ? await window.storageService.getQuestions({ bank: currentBankName, type, chapter }) :
            (await fetch(`${API_BASE}/api/questions?bank=${encodeURIComponent(currentBankName)}${type ? `&type=${type}` : ''}${chapter ? `&chapter=${encodeURIComponent(chapter)}` : ''}`)).json();
        
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
                        <span class="question-id-badge" title="题目编号">#${q.id}</span>
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

// 切换背题模式
function toggleBackMode(checked) {
    isBackMode = !!checked;
    loadQuestions();
}

// 确认删除题库
function confirmDeleteBank(bankName) {
    showConfirmModal(
        '删除题库',
        `确定要删除题库"${bankName}"吗？该操作不可恢复。`,
        async () => {
            try {
                const useMobileStore = window.storageService && window.storageService.isMobile && !isElectron;
                const data = isElectron ?
                    await window.electronAPI.deleteBank(bankName) :
                    useMobileStore ? await window.storageService.deleteBank(bankName) :
                    await (await fetch(`${API_BASE}/api/banks/${encodeURIComponent(bankName)}`, { method: 'DELETE' })).json();
                
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

// 确认删除题目
function confirmDeleteQuestion(questionId) {
    showConfirmModal(
        '删除题目',
        '确定要删除这道题目吗？该操作不可恢复。',
        async () => {
            try {
                const useMobileStore = window.storageService && window.storageService.isMobile && !isElectron;
                const data = isElectron ?
                    await window.electronAPI.deleteQuestion(questionId) :
                    useMobileStore ? await window.storageService.deleteQuestion(questionId) :
                    await (await fetch(`${API_BASE}/api/questions/${questionId}`, { method: 'DELETE' })).json();
                
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

// 编辑题目
async function editQuestion(questionId) {
    try {
        const data = isElectron ?
            await window.electronAPI.getQuestion(questionId) :
            await (await fetch(`${API_BASE}/api/questions/${questionId}`)).json();
        
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

// 关闭编辑模态框
function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('show');
    editingQuestionId = null;
    editOptionsState = [];
}

// 保存题目
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
        const data = isElectron ?
            await window.electronAPI.updateQuestion(editingQuestionId, updateData) :
            await (await fetch(`${API_BASE}/api/questions/${editingQuestionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            })).json();
        
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
