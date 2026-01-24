// ==================== 刷题功能模块 ====================

const practiceUseMobileStore = window.useMobileStore ?? (window.useMobileStore = isMobile && !isElectron);

// 加载刷题选项
async function loadPracticeOptions() {
    try {
        const data = isElectron ?
            await window.electronAPI.getBanks() :
            practiceUseMobileStore ?
                await storageService.getBanks() :
                await (await fetch(`${API_BASE}/api/banks`)).json();
        
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

// 加载刷题章节
async function loadPracticeChapters() {
    const bank = document.getElementById('practice-bank').value;
    const select = document.getElementById('practice-chapter');
    select.innerHTML = '<option value="">全部章节</option>';
    
    if (bank) {
        try {
            const data = isElectron ?
                await window.electronAPI.getChapters(bank) :
                practiceUseMobileStore ?
                    await storageService.getChapters(bank) :
                    await (await fetch(`${API_BASE}/api/chapters?bank=${encodeURIComponent(bank)}`)).json();
            
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

// 更新可用题目统计
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

        const data = isElectron ?
            await window.electronAPI.getQuestions({ bank, chapter }) :
            practiceUseMobileStore ?
                await storageService.getQuestions({ bank, chapter }) :
                await (await fetch(`${API_BASE}/api/questions?bank=${encodeURIComponent(bank)}${chapter ? `&chapter=${encodeURIComponent(chapter)}` : ''}`)).json();
        
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

// 显示刷题设置
function showPracticeSettings() {
    document.getElementById('practice-settings').style.display = 'flex';
    document.getElementById('practice-area').style.display = 'none';
    document.getElementById('practice-result').style.display = 'none';
    document.getElementById('practice-header-info').style.display = 'none';
    document.getElementById('question-nav-panel').style.display = 'none';
    document.getElementById('practice-title').style.display = 'block';
    
    // 停止计时器
    if (practiceTimer) {
        clearInterval(practiceTimer);
        practiceTimer = null;
    }
    
    // 返回设置页时展开排行榜面板
    document.getElementById('ranking-panel-wrapper').classList.remove('collapsed');
}

// 开始练习
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
        const data = isElectron ?
            await window.electronAPI.practiceRandom({ bank, chapter, single_count: singleCount, multi_count: multiCount }) :
            practiceUseMobileStore ?
                await storageService.getPracticeRandom({ bank, chapter, single_count: singleCount, multi_count: multiCount }) :
                await (await fetch(url)).json();
        
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
            document.getElementById('practice-title').style.display = 'none';
            
            // 显示并展开答题卡
            const navPanel = document.getElementById('question-nav-panel');
            navPanel.style.display = 'block';
            navPanel.classList.remove('collapsed');
            navPanel.classList.add('expanded');
            
            // 进入刷题后折叠排行榜面板
            document.getElementById('ranking-panel-wrapper').classList.add('collapsed');
            
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

// 答题卡分页控制
let manualNavPageChange = false; // 标记是否是手动切换页面

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
        
        const result = questionResults[item.index];
        let statusClass = '';
        if (result?.answered) {
            // 已提交答案
            if (isExamMode) {
                // 模拟考试模式：仅标记已答（蓝色）
                statusClass = 'answered';
            } else if (result.isCorrect === true) {
                statusClass = 'answered correct';
            } else if (result.isCorrect === false) {
                statusClass = 'answered wrong';
            } else {
                statusClass = 'answered';
            }
        } else if (result?.userAnswer?.length > 0) {
            // 已选择但未提交（蓝色）
            statusClass = 'selected';
        }
        const current = item.index === currentQuestionIndex ? 'current' : '';
        const multiClass = item.question.type === 'multi' ? 'multi' : '';
        html += `<button class="nav-btn ${multiClass} ${statusClass} ${current}" onclick="goToQuestion(${item.index})">${item.index + 1}</button>`;
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

// 更新计时器
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

// 更新计时器显示
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

// 渲染题目
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
    document.getElementById('question-id').textContent = `#${question.id}`;
    document.getElementById('question-chapter').textContent = question.chapter;
    
    // 设置题目内容，长题目添加特殊class
    const contentEl = document.getElementById('question-content');
    contentEl.textContent = question.question;
    if (question.question.length > 30) {
        contentEl.classList.add('long-text');
    } else {
        contentEl.classList.remove('long-text');
    }
    
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
        
        // 隐藏结果提示框（只通过选项颜色表示正误）
        const resultDiv = document.getElementById('answer-result');
        resultDiv.style.display = 'none';
        
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

// 选择选项
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

// 提交答案
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
        addToWrongbook(question, selectedAnswers);
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
        
        // 隐藏结果提示框（只通过选项颜色表示正误）
        const resultDiv = document.getElementById('answer-result');
        resultDiv.style.display = 'none';
        
        if (isCorrect) {
            correctCount++;
        } else {
            wrongCount++;
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

// 上一题
function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
}

// 下一题
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
        // 使用打乱后的答案（如果有），否则使用原始答案
        const correctAnswer = question.shuffledAnswer || question.answer || [];
        
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
                addToWrongbook(question, result.userAnswer);
            }
        } else {
            // 未答题算错
            result.isCorrect = false;
            result.correctAnswer = correctAnswer;
            wrongCount++;
        }
    });
}

// 显示练习结果
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
    
    // 使用打乱后的选项顺序（如果有），保证与考试时一致
    const optionEntries = question.shuffledOptions || Object.entries(question.options);
    
    let optionsHtml = optionEntries.map(([key, value]) => {
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
