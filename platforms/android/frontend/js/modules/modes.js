// ==================== 做题模式切换模块 ====================

const modesUseMobileStore = window.useMobileStore ?? (window.useMobileStore = isMobile && !isElectron);

// 做题模式切换
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
        const data = isElectron ?
            await window.electronAPI.getWrongbookStats() :
            modesUseMobileStore ?
                await storageService.getWrongbookStats() :
                await (await fetch(`${API_BASE}/api/wrongbook/stats`)).json();
        
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
        const data = isElectron ?
            await window.electronAPI.practiceSequence({ bank, chapter, shuffle: shuffleQuestions }) :
            modesUseMobileStore ?
                await storageService.getPracticeSequence({ bank, chapter, shuffle: shuffleQuestions }) :
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
        const data = isElectron ?
            await window.electronAPI.practiceWrong({ bank, single_count: singleCount, multi_count: multiCount }) :
            modesUseMobileStore ?
                await storageService.getPracticeWrong({ bank, single_count: singleCount, multi_count: multiCount }) :
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
    
    // 显示并展开答题卡
    const navPanel = document.getElementById('question-nav-panel');
    navPanel.style.display = 'block';
    navPanel.classList.remove('collapsed'); // 移除折叠状态即展开
    
    // 进入刷题后折叠排行榜面板
    document.getElementById('ranking-panel-wrapper').classList.add('collapsed');
    
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
