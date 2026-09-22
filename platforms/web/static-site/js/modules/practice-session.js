/** Active practice lifecycle, local recovery and viewport layout. Shared by all clients. */
const PRACTICE_DRAFT_KEY = 'quiz_active_practice_v1_' + (window.STATIC_MODE ? 'static' : isElectron ? 'electron' : window.storageService.isMobile ? 'mobile' : 'web');
let sessionActive = false;
let sessionTimerEnabled = false;
let sessionElapsedMs = 0;
let sessionRemainingMs = 0;
let sessionClockStarted = null;
let sessionStarting = false;
let lastRenderedQuestion = null;
let draftStorageWarned = false;

function clockValues() {
    const delta = sessionClockStarted === null ? 0 : Math.max(0, Date.now() - sessionClockStarted);
    return {elapsed: sessionElapsedMs + delta, remaining: Math.max(0, sessionRemainingMs - delta)};
}
function pausePracticeSession() {
    if (!sessionActive) return;
    const value = clockValues();
    sessionElapsedMs = value.elapsed;
    sessionRemainingMs = value.remaining;
    sessionClockStarted = null;
    remainingTime = sessionTimerEnabled ? Math.ceil(value.remaining / 1000) : 0;
    if (practiceTimer) clearInterval(practiceTimer);
    practiceTimer = null;
    writePracticeDraft();
}
function resumePracticeSession() {
    if (!sessionActive || practiceFinished || practiceFinishing || currentPage !== 'practice' || document.hidden) return;
    if (!serverOnline && !window.STATIC_MODE && !window.storageService.isMobile && !isElectron) return;
    if (sessionClockStarted !== null) return;
    if (sessionTimerEnabled && sessionRemainingMs <= 0) { finishPractice(); return; }
    sessionClockStarted = Date.now();
    if (practiceTimer) clearInterval(practiceTimer);
    practiceTimer = setInterval(updateTimer, 250);
    updateTimer();
}
function tickPracticeClock() {
    if (!sessionActive || sessionClockStarted === null) return;
    const value = clockValues();
    if (sessionTimerEnabled) {
        remainingTime = Math.ceil(value.remaining / 1000);
        updateTimerDisplay();
        if (value.remaining <= 0) { pausePracticeSession(); showToast('时间到！', 'warning'); finishPractice(); }
    }
}
function getPracticeElapsedSeconds() { return Math.floor(clockValues().elapsed / 1000); }
function activatePracticeSession(enabled, elapsedSeconds = 0, seconds = remainingTime) {
    if (practiceTimer) clearInterval(practiceTimer);
    practiceTimer = null;
    sessionActive = true;
    sessionTimerEnabled = !!enabled;
    sessionElapsedMs = Math.max(0, Number(elapsedSeconds) || 0) * 1000;
    sessionRemainingMs = Math.max(0, Number(seconds) || 0) * 1000;
    sessionClockStarted = null;
    lastRenderedQuestion = null;
    showActivePractice();
    renderQuestion();
    writePracticeDraft();
    resumePracticeSession();
}
function showActivePractice() {
    document.getElementById('practice-settings').style.display = 'none';
    document.getElementById('practice-result').style.display = 'none';
    document.getElementById('practice-area').style.display = 'flex';
    document.getElementById('practice-header-info').style.display = 'flex';
    document.getElementById('practice-title').style.display = 'none';
    const panel = document.getElementById('question-nav-panel');
    panel.style.display = 'block'; panel.classList.remove('collapsed');
    const badge = document.getElementById('practice-mode-badge');
    badge.textContent = {random:'刷题练习',exam:'模拟考试',sequence:'顺序练习',wrong:'错题练习'}[currentPracticeMode] || '练习';
    badge.className = 'practice-mode-badge ' + currentPracticeMode;
    document.getElementById('score-info').style.display = isExamMode ? 'none' : 'flex';
    document.getElementById('timer-display').style.display = sessionTimerEnabled ? 'flex' : 'none';
    document.body.classList.add('practice-focused');
    document.documentElement.classList.add('practice-focused');
    if (typeof createMobileMenu === 'function') createMobileMenu();
    document.body.classList.remove('practice-configuring');
    window.scrollTo({top:0, behavior:'instant'});
    updateTimerDisplay();
    requestAnimationFrame(layoutPracticeCard);
}
function snapshotPractice() {
    const value = clockValues();
    const shuffleMap = {};
    practiceQuestions.forEach(q => {
        if (q.shuffledOptions) shuffleMap[q.id] = {shuffledOptions:q.shuffledOptions, shuffledAnswer:q.shuffledAnswer, reverseAnswerMap:q.reverseAnswerMap};
    });
    return {
        version:1, progress_id:currentProgressId, mode:currentPracticeMode,
        bank:lastPracticeSettings?.bank || '', chapter:lastPracticeSettings?.chapter || '',
        settings:{...lastPracticeSettings,playerName:document.getElementById('player-name').value}, timer_enabled:sessionTimerEnabled,
        current_index:currentQuestionIndex, total:practiceQuestions.length,
        correct:correctCount, wrong:wrongCount,
        question_ids:practiceQuestions.map(q => q.id), shuffle_map:shuffleMap,
        question_results:questionResults,
        remaining_time:sessionTimerEnabled ? Math.ceil(value.remaining/1000) : 0,
        elapsed_time:value.elapsed/1000, saved_at:new Date().toISOString()
    };
}
function readPracticeDraft() {
    try { return JSON.parse(localStorage.getItem(PRACTICE_DRAFT_KEY) || 'null'); }
    catch (_) { return null; }
}
function writePracticeDraft() {
    if (!sessionActive || practiceFinished) return;
    try { localStorage.setItem(PRACTICE_DRAFT_KEY, JSON.stringify(snapshotPractice())); }
    catch (_) {
        if (!draftStorageWarned) { showToast('本地草稿未能保存，请使用“保存”手动存档', 'warning'); draftStorageWarned = true; }
    }
}
function clearPracticeDraft() {
    try { localStorage.removeItem(PRACTICE_DRAFT_KEY); } catch (_) {}
    updateDraftBanner();
}
function updateDraftBanner() {
    const banner = document.getElementById('practice-draft-banner');
    if (!banner) return;
    const draft = readPracticeDraft();
    banner.hidden = !draft;
    if (draft) document.getElementById('practice-draft-summary').textContent =
        `${draft.bank || '综合练习'} · 第 ${(draft.current_index || 0)+1} / ${draft.question_ids?.length || 0} 题（已暂停）`;
}
function confirmPracticeReplacement() {
    if (!sessionActive && !readPracticeDraft()) return Promise.resolve(true);
    return new Promise(resolve => showConfirmModal('已有未完成练习', '可以继续原练习，或结束它再开始新的练习。手动存档不会被删除。', () => {
        discardActivePractice(); resolve(true);
    }, {confirmText:'结束并开始新的', cancelText:'继续原练习', onCancel:()=>{
        if (sessionActive) { showActivePractice(); resumePracticeSession(); }
        else restorePracticeDraft();
        resolve(false);
    }}));
}
function discardActivePractice() {
    pausePracticeSession();
    sessionActive = false; sessionClockStarted = null;
    if (practiceTimer) clearInterval(practiceTimer);
    practiceTimer = null; practiceQuestions = []; questionResults = []; selectedAnswers = [];
    currentProgressId = null; practiceFinishing = null; practiceFinished = false;
    document.body.classList.remove('practice-focused');
    document.documentElement.classList.remove('practice-focused');
    window.keepMobileMenuInView?.();
    closeQuestionNavigator(); clearPracticeDraft();
}
function requestEndPractice() {
    showConfirmModal('结束本次练习', '结束后将移除本机自动草稿，已保存的手动存档保留。', ()=>{
        discardActivePractice(); showPracticeSettings();
    }, {confirmText:'结束练习'});
}
function requestDiscardDraft() {
    showConfirmModal('放弃上次练习', '仅移除这份本机自动草稿，不删除手动存档或题库。', ()=>{ clearPracticeDraft(); }, {confirmText:'放弃草稿'});
}
async function restorePracticeDraft() {
    const draft = readPracticeDraft();
    if (!draft) { showToast('没有可恢复的本机草稿', 'warning'); return; }
    await restorePracticeSnapshot(draft, draft.progress_id || null);
}
async function restorePracticeSnapshot(progress, progressId) {
    try {
        const ids = progress.question_ids;
        if (!Array.isArray(ids) || !ids.length) throw new Error('存档没有题目信息');
        const data = await window.storageService.getQuestions({});
        if (!data.success) throw new Error(data.error || '无法读取题库');
        const byId = new Map(data.questions.map(q=>[q.id,q]));
        if (ids.some(id=>!byId.has(id))) throw new Error('题库已变更，部分题目不存在；草稿和存档已保留');
        const restored = ids.map(id=>{
            const q = {...byId.get(id)};
            const old = progress.questions?.find(item=>item.id===id);
            const shuffled = progress.shuffle_map?.[id] || old;
            if (shuffled?.shuffledOptions) Object.assign(q, {shuffledOptions:shuffled.shuffledOptions,shuffledAnswer:shuffled.shuffledAnswer,reverseAnswerMap:shuffled.reverseAnswerMap});
            return q;
        });
        pausePracticeSession();
        practiceQuestions = restored;
        questionResults = restored.map((q,i)=>({answered:false,userAnswer:[],correctAnswer:[],isCorrect:null,...progress.question_results?.[i]}));
        currentQuestionIndex = Math.max(0, Math.min(restored.length-1, Number(progress.current_index)||0));
        correctCount = Number(progress.correct)||0; wrongCount = Number(progress.wrong)||0;
        currentPracticeMode = progress.mode || 'random'; isExamMode = currentPracticeMode==='exam';
        remainingTime = Math.max(0,Number(progress.remaining_time)||0);
        const counts = Object.fromEntries(['single','multi','judge'].map(type=>[type+'Count',restored.filter(q=>q.type===type).length]));
        lastPracticeSettings = {bank:progress.bank||'',chapter:progress.chapter||'',mode:currentPracticeMode,...counts,enableTimer:progress.timer_enabled ?? remainingTime>0,timeMinutes:Math.max(1,Math.ceil(remainingTime/60)),...progress.settings};
        document.getElementById('player-name').value = progress.settings?.playerName || '匿名';
        currentProgressId = progressId;
        practiceFinished = false; practiceFinishing = null; navCurrentPage = 1;
        if (currentPage!=='practice') switchPage('practice');
        activatePracticeSession(progress.timer_enabled ?? remainingTime>0, Number(progress.elapsed_time)||0, remainingTime);
        showToast('练习已恢复', 'success');
    } catch(error) { showToast(error.message || '无法恢复练习，原存档已保留', 'error'); }
}
let lastFitSignature = '';
function onPracticeQuestionRendered() {
    lastRenderedQuestion = currentQuestionIndex;
    lastFitSignature = '';
    if (sessionActive) writePracticeDraft();
    layoutPracticeCard();
}
let layoutQueued = false;
function layoutPracticeCard() {
    if (!sessionActive || currentPage !== 'practice') return;
    const page = document.getElementById('practice-page');
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    page.style.setProperty('--workspace-width', width + 'px');
    page.style.setProperty('--workspace-height', height + 'px');
    page.style.setProperty('--workspace-left', (viewport?.offsetLeft || 0) + 'px');
    page.style.setProperty('--workspace-top', (viewport?.offsetTop || 0) + 'px');

    const stage = document.getElementById('question-stage');
    const stem = document.getElementById('question-content');
    const options = document.getElementById('options-list');
    const buttons = [...options.querySelectorAll('.option-btn')];
    if (!buttons.length || stage.clientHeight <= 0) return;
    const signature = [stage.clientWidth, stage.clientHeight, window.devicePixelRatio,
        stem.textContent, ...buttons.map(btn => btn.querySelector('.option-text')?.textContent)].join('|');
    if (signature !== lastFitSignature) {
        const narrow = width <= 600;
        const baseStem = narrow ? 22 : 28;
        const baseOption = narrow ? 18 : 22;
        stage.classList.add('measuring-options');
        const measure = (scale, density = 1) => {
            // Scale all content dimensions together; never truncate or replace question text.
            const values = {
                '--stem-size': baseStem * scale + 'px',
                '--option-size': baseOption * scale + 'px',
                '--content-leading': String(1.2 + .3 * density),
                '--content-gap': 12 * scale * density + 'px',
                '--stage-padding': 16 * scale * density + 'px',
                '--option-padding-y': 12 * scale * density + 'px',
                '--option-padding-x': 16 * scale * density + 'px',
                '--option-key-size': 28 * scale + 'px',
                '--option-key-font': 16 * scale + 'px',
                '--feedback-size': 18 * scale + 'px'
            };
            for (const [name, value] of Object.entries(values)) stage.style.setProperty(name, value);
            const style = getComputedStyle(stage);
            const gap = parseFloat(getComputedStyle(options).rowGap) || 0;
            const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
            const stemHeight = stem.getBoundingClientRect().height;
            const stemGap = parseFloat(getComputedStyle(stem).marginBottom) || 0;
            const natural = buttons.map(btn => btn.getBoundingClientRect().height);
            const required = padding + stemHeight + stemGap + natural.reduce((a,b)=>a+b,0) + gap * Math.max(0,buttons.length-1);
            const fits = required <= stage.clientHeight - 1 && stem.scrollWidth <= stem.clientWidth + 1 &&
                buttons.every(btn => btn.scrollWidth <= btn.clientWidth + 1);
            return {fits, natural, required};
        };
        let scale = 1;
        let density = 1;
        let measured = measure(scale, density);
        if (!measured.fits) {
            // First spend less space on padding and gaps, keeping the preferred font.
            density = .25;
            measured = measure(1, density);
            if (measured.fits) {
                let low = .25, high = 1;
                for (let iteration = 0; iteration < 10; iteration++) {
                    const middle = (low + high) / 2;
                    if (measure(1, middle).fits) low = middle;
                    else high = middle;
                }
                density = low;
            } else {
                let low = .01, high = 1;
                for (let iteration = 0; iteration < 13; iteration++) {
                    const middle = (low + high) / 2;
                    if (measure(middle, density).fits) low = middle;
                    else high = middle;
                }
                scale = low;
            }
            measured = measure(scale, density);
        }
        const extra = Math.max(0, stage.clientHeight - measured.required - 1) / buttons.length;
        buttons.forEach((btn, index) => {
            // Extra room becomes touchable option area. Longer options keep the height they need.
            btn.style.setProperty('--option-height', measured.natural[index] + extra + 'px');
        });
        stage.classList.remove('measuring-options');
        stage.dataset.fitScale = scale.toFixed(4);
        stage.dataset.fitDensity = density.toFixed(4);
        lastFitSignature = signature;
    }
    window.keepMobileMenuInView?.();
}
function queuePracticeLayout() {
    if(layoutQueued)return;layoutQueued=true;
    requestAnimationFrame(()=>{layoutQueued=false;layoutPracticeCard()});
}
function openQuestionNavigator() {
    document.body.classList.add('question-nav-open');
    document.getElementById('question-nav-panel').classList.remove('collapsed');
    openAccessibleDialog('question-nav-panel','#close-question-nav');
}
function closeQuestionNavigator() {
    document.body.classList.remove('question-nav-open');
    closeAccessibleDialog('question-nav-panel');
}
function initPracticeWorkspace() {
    updateDraftBanner();
    document.fonts?.ready.then(()=>{lastFitSignature='';queuePracticeLayout();});
    document.addEventListener('visibilitychange',()=>{
        if(document.hidden) pausePracticeSession();
        else if(currentPage==='practice' && sessionActive) resumePracticeSession();
    });
    window.addEventListener('pagehide',pausePracticeSession);
    window.addEventListener('pageshow',()=>{if(currentPage==='practice')resumePracticeSession()});
    window.addEventListener('resize',queuePracticeLayout);
    window.visualViewport?.addEventListener('resize',queuePracticeLayout);
    window.visualViewport?.addEventListener('scroll',queuePracticeLayout);
    if(window.ResizeObserver) {
        const observer=new ResizeObserver(queuePracticeLayout);
        observer.observe(document.getElementById('practice-header-info'));
        observer.observe(document.getElementById('question-stage'));
        observer.observe(document.getElementById('topNav'));
    }
}
