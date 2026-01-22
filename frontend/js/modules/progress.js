// ==================== 进度保存功能模块 ====================

// 加载进度列表
async function loadProgressList() {
    try {
        let data;
        if (isElectron) {
            data = await window.electronAPI.getProgress();
        } else {
            const response = await fetch(`${API_BASE}/api/progress`);
            data = await response.json();
        }

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

// 保存当前进度
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
        const data = isElectron ?
            await window.electronAPI.saveProgress(progressData) :
            await (await fetch(`${API_BASE}/api/progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(progressData)
            })).json();
        
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

// 加载进度
async function loadProgress(progressId) {
    try {
        const response = await fetch(`${API_BASE}/api/progress/${progressId}`);
        const data = await response.json();
        
        if (data.success) {
            const progress = data.progress;
            
            // 重新加载题目
            const questionIds = progress.question_ids || [];
            const questionsData = isElectron ?
                await window.electronAPI.getQuestions() :
                await (await fetch(`${API_BASE}/api/questions`)).json();
            
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
                
                // 显示并展开答题卡
                const navPanel = document.getElementById('question-nav-panel');
                navPanel.style.display = 'block';
                navPanel.classList.remove('collapsed');
                navPanel.classList.add('expanded');
                
                // 进入刷题后折叠排行榜面板
                document.getElementById('ranking-panel-wrapper').classList.add('collapsed');
                
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

// 删除进度
async function deleteProgress(progressId, silent = false) {
    try {
        const data = isElectron ?
            await window.electronAPI.deleteProgress(progressId) :
            await (await fetch(`${API_BASE}/api/progress/${progressId}`, { method: 'DELETE' })).json();
        
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
