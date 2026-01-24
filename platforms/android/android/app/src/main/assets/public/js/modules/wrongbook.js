// ==================== 错题本功能模块 ====================

const wrongbookUseMobileStore = window.useMobileStore ?? (window.useMobileStore = isMobile && !isElectron);

// 加载错题题库列表
async function loadWrongBanks() {
    try {
        const data = isElectron ?
            await window.electronAPI.getWrongbookStats() :
            wrongbookUseMobileStore ?
                await storageService.getWrongbookStats() :
                await (await fetch(`${API_BASE}/api/wrongbook/stats`)).json();
        
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

// 显示错题题库列表
function showWrongBankList() {
    document.getElementById('wrong-question-browser').style.display = 'none';
    document.getElementById('wrong-bank-list').style.display = 'grid';
}

// 浏览错题题库
async function browseWrongBank(bankName) {
    currentWrongBankName = bankName;
    document.getElementById('wrong-current-bank-name').textContent = bankName + ' - 错题';
    document.getElementById('wrong-bank-list').style.display = 'none';
    document.getElementById('wrong-question-browser').style.display = 'block';
    
    await loadWrongQuestions(bankName);
}

// 加载错题列表
async function loadWrongQuestions(bankName) {
    try {
        let data;
        if (isElectron) {
            // Electron 环境：直接传输 filters 对象
            const filters = { bank: bankName };
            const responseData = await window.electronAPI.getWrongbook(filters);
            data = responseData;
        } else if (wrongbookUseMobileStore) {
            const response = await storageService.getWrongBook(bankName);
            data = response.success ? { success: true, wrong_questions: response.wrong_questions || response.questions || [] } : response;
        } else {
            // Web 环境
            const response = await fetch(`${API_BASE}/api/wrongbook?bank=${encodeURIComponent(bankName)}`);
            data = await response.json();
        }
        
        const questionList = document.getElementById('wrong-question-list');
        
        if (data.success && data.wrong_questions.length > 0) {
            questionList.innerHTML = data.wrong_questions.map((q, index) => `
                <div class="question-item ${q.type === 'multi' ? 'multi' : ''}">
                    <div class="question-header">
                        <span class="question-type ${q.type === 'multi' ? 'multi' : ''}">
                            ${q.type === 'multi' ? '多选题' : '单选题'}
                        </span>
                        <span class="question-id-badge" title="题目编号">#${q.id}</span>
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

// 从错题本移除
async function removeFromWrongbook(questionId) {
    try {
        const data = isElectron ?
            await window.electronAPI.removeWrongQuestion(questionId) :
            wrongbookUseMobileStore ?
                await storageService.removeWrongQuestion(questionId) :
                await (await fetch(`${API_BASE}/api/wrongbook/${questionId}`, { method: 'DELETE' })).json();
        
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

// 确认清空错题题库
function confirmClearWrongBank(bankName) {
    showConfirmModal(
        '清空错题',
        `确定要清空"${bankName}"的所有错题吗？`,
        async () => {
            try {
                let data;
                if (isElectron) {
                    // Electron: 先获取所有错题，然后逐个删除
                    const wrongbookData = await window.electronAPI.getWrongbook(bankName);
                    if (wrongbookData.success) {
                        for (const q of wrongbookData.wrong_questions) {
                            await window.electronAPI.removeWrongQuestion(q.id);
                        }
                        data = { success: true, message: `已清空"${bankName}"的所有错题` };
                    } else {
                        data = { success: false, error: '获取错题失败' };
                    }
                } else if (wrongbookUseMobileStore) {
                    await storageService.db.wrongbook.where('bank').equals(bankName).delete();
                    data = { success: true, message: `已清空"${bankName}"的所有错题` };
                } else {
                    // Web 环境
                    const response = await fetch(`${API_BASE}/api/wrongbook/bank/${encodeURIComponent(bankName)}`, {
                        method: 'DELETE'
                    });
                    data = await response.json();
                }

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

// 按题库清空错题
function clearWrongQuestionsByBank() {
    if (currentWrongBankName) {
        confirmClearWrongBank(currentWrongBankName);
    }
}

// 添加错题到错题本
async function addToWrongbook(question, userAnswer) {
    try {
        const payload = {
            question_id: question.id,
            bank: question.bank,
            user_answer: userAnswer,
            question: question
        };
        const data = isElectron ?
            await window.electronAPI.addWrongQuestion({ questionId: question.id, user_answer: userAnswer, question }) :
            wrongbookUseMobileStore ?
                await storageService.addWrongQuestion(payload) :
                await (await fetch(`${API_BASE}/api/wrongbook`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })).json();
    } catch (error) {
        console.error('添加错题失败:', error);
    }
}
