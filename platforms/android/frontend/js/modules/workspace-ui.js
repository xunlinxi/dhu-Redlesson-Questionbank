/** Workspace controls: accessible dialogs, filtered paging and practice configuration. */
const listingState = {questions:{page:1,signature:'',offset:0},wrong:{page:1,signature:'',offset:0}};
const QUESTION_PAGE_SIZE = 50;
let availabilityRevision = 0;
let availabilityReady = false;
let availableQuestionCounts = {single:0,multi:0,judge:0};
let activeDialog = null;
const dialogOrigins = new Map();
let confirmCancelCallback = null;

function visibleDialogControls(dialog) {
    return [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')].filter(el=>el.getClientRects().length && !el.closest('[hidden]'));
}
function openAccessibleDialog(id, initialSelector) {
    const dialog=document.getElementById(id);
    dialogOrigins.set(id,document.activeElement);
    activeDialog=id;
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
    const initial=dialog.querySelector(initialSelector||'input,textarea,select,button');
    (initial || visibleDialogControls(dialog)[0] || dialog).focus();
}
function closeAccessibleDialog(id) {
    if(activeDialog!==id)return;
    activeDialog=null;
    const dialog=document.getElementById(id);
    if(id==='question-nav-panel') {dialog.removeAttribute('role');dialog.removeAttribute('aria-modal');}
    const origin=dialogOrigins.get(id);
    dialogOrigins.delete(id);
    if(origin?.isConnected)origin.focus({preventScroll:true});
}
function paginateQuestions(questions,scope) {
    const search=document.getElementById(scope==='questions'?'question-search':'wrong-search').value.trim().toLocaleLowerCase();
    const bank=scope==='questions'?currentBankName:currentWrongBankName;
    let type=document.getElementById(scope==='questions'?'filter-type':'wrong-filter-type').value;
    let chapter=document.getElementById(scope==='questions'?'filter-chapter':'wrong-filter-chapter').value;
    if(scope==='wrong') {
        const select=document.getElementById('wrong-filter-chapter');
        const chapters=[...new Set(questions.map(q=>q.chapter).filter(Boolean))];
        select.replaceChildren(new Option('全部章节',''),...chapters.map(ch=>new Option(ch,ch)));
        select.value=chapters.includes(chapter)?chapter:'';
        chapter=select.value;
        questions=questions.filter(q=>(!type||q.type===type)&&(!chapter||q.chapter===chapter));
    }
    const signature=JSON.stringify([bank,type,chapter,search]);
    const state=listingState[scope];
    if(signature!==state.signature) {state.page=1;state.signature=signature;}
    const filtered=questions.filter(q=>!search||[q.question,...Object.values(q.options||{})].join(' ').toLocaleLowerCase().includes(search));
    const totalPages=Math.max(1,Math.ceil(filtered.length/QUESTION_PAGE_SIZE));
    state.page=Math.max(1,Math.min(state.page,totalPages));
    state.offset=(state.page-1)*QUESTION_PAGE_SIZE;
    const pager=document.getElementById(scope==='questions'?'question-pagination':'wrong-pagination');
    pager.innerHTML=`<span role="status">共 ${filtered.length} 题 · 第 ${state.page} / ${totalPages} 页</span><div><button class="btn btn-secondary" onclick="changeQuestionPage('${scope}',-1)" ${state.page===1?'disabled':''}>上一页</button><button class="btn btn-secondary" onclick="changeQuestionPage('${scope}',1)" ${state.page===totalPages?'disabled':''}>下一页</button></div>`;
    return filtered.slice(state.offset,state.offset+QUESTION_PAGE_SIZE);
}
function changeQuestionPage(scope,delta) {
    listingState[scope].page+=delta;
    const promise=scope==='questions'?loadQuestions():loadWrongQuestions(currentWrongBankName);
    Promise.resolve(promise).then(()=>document.getElementById(scope==='questions'?'question-browser':'wrong-question-browser').scrollIntoView({block:'start',behavior:'instant'}));
}
function updateQuantitySummary() {
    const sequence=document.getElementById('practice-mode').value==='sequence';
    const total=sequence?Object.values(availableQuestionCounts).reduce((a,b)=>a+b,0):['single','multi','judge'].reduce((sum,t)=>sum+(Number(document.getElementById('practice-'+t+'-count').value)||0),0);
    document.getElementById('practice-quantity-summary').textContent=availabilityReady?`本次 ${total} 题`:'正在读取可用题量…';
    document.getElementById('start-practice-btn').disabled=sessionStarting||!availabilityReady||!total;
}
function reconcileQuestionCounts() {
    const adjustments=[];
    for(const type of ['single','multi','judge']) {
        const input=document.getElementById('practice-'+type+'-count');
        const available=availableQuestionCounts[type];
        const requested=Math.max(0,Math.floor(Number(input.dataset.requestedCount ?? input.value)||0));
        input.dataset.requestedCount=requested;
        input.max=available;
        input.disabled=available===0;
        input.value=Math.min(requested,available);
        document.getElementById('available-'+type).textContent=available;
        if(requested>available)adjustments.push(`${getTypeLabel(type)}可用 ${available} 题，已调整为 ${available}`);
    }
    document.getElementById('quantity-feedback').textContent=adjustments.join('；');
    updateQuantitySummary();
}
async function refreshPracticeAvailability() {
    const revision=++availabilityRevision;
    availabilityReady=false;updateQuantitySummary();
    const mode=document.getElementById('practice-mode').value;
    const bank=document.getElementById('practice-bank').value;
    const chapter=document.getElementById('practice-chapter').value;
    try {
        const counts={single:0,multi:0,judge:0};
        if(mode==='wrong') {
            const data=await window.storageService.getWrongbookStats();
            if(!data.success)throw new Error(data.error||'无法读取错题数量');
            const groups=bank?[data.stats[bank]].filter(Boolean):Object.values(data.stats);
            groups.forEach(group=>Object.keys(counts).forEach(type=>counts[type]+=Number(group[type])||0));
        } else {
            const data=await window.storageService.getQuestions({bank,chapter});
            if(!data.success)throw new Error(data.error||'无法读取题量');
            data.questions.forEach(q=>{if(q.type in counts)counts[q.type]++});
        }
        if(revision!==availabilityRevision)return false;
        availableQuestionCounts=counts;availabilityReady=true;reconcileQuestionCounts();return true;
    } catch(error) {
        if(revision===availabilityRevision){document.getElementById('quantity-feedback').textContent=error.message;updateQuantitySummary()}
        return false;
    }
}
async function prepareNewPractice(mode) {
    if(sessionStarting)return false;
    sessionStarting=true;updateQuantitySummary();
    if(!await confirmPracticeReplacement()) {finishStartingPractice();return false;}
    document.getElementById('practice-mode').value=mode;
    if(mode==='sequence'&&!document.getElementById('practice-bank').value) {
        showToast('顺序练习请选择题库','warning');finishStartingPractice();return false;
    }
    if(!await refreshPracticeAvailability()) {finishStartingPractice();return false;}
    if(Object.values(availableQuestionCounts).every(n=>n===0)) {showToast('当前范围没有可练习题目','warning');finishStartingPractice();return false;}
    if(mode!=='sequence'&&['single','multi','judge'].every(t=>Number(document.getElementById('practice-'+t+'-count').value)===0)) {
        showToast('请至少选择一道题目','warning');finishStartingPractice();return false;
    }
    currentPracticeMode=mode;
    return true;
}
function finishStartingPractice() {sessionStarting=false;updateQuantitySummary();}
function initWorkspaceControls() {
    document.addEventListener('keydown',event=>{
        if(!activeDialog)return;
        const dialog=document.getElementById(activeDialog);
        if(event.key==='Escape') {
            event.preventDefault();
            if(activeDialog==='confirm-modal')closeModal();
            else if(activeDialog==='edit-modal')closeEditModal();
            else closeQuestionNavigator();
        } else if(event.key==='Tab') {
            const controls=visibleDialogControls(dialog);
            if(!controls.length){event.preventDefault();dialog.focus();return;}
            const first=controls[0],last=controls[controls.length-1];
            if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus();}
            else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}
        }
    });
    document.addEventListener('focusin',event=>{
        if(activeDialog){const dialog=document.getElementById(activeDialog);if(!dialog.contains(event.target))visibleDialogControls(dialog)[0]?.focus();}
    });
    for(const [id,scope] of [['question-search','questions'],['wrong-search','wrong']]) {
        let debounce;
        document.getElementById(id).addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>scope==='questions'?loadQuestions():loadWrongQuestions(currentWrongBankName),150)});
    }
    ['wrong-filter-type','wrong-filter-chapter'].forEach(id=>document.getElementById(id).addEventListener('change',()=>loadWrongQuestions(currentWrongBankName)));
    ['single','multi','judge'].forEach(type=>{
        const input=document.getElementById('practice-'+type+'-count');
        input.addEventListener('input',()=>{input.dataset.requestedCount=input.value;reconcileQuestionCounts()});
    });
    const settings=document.getElementById('practice-settings');
    const advanced=document.getElementById('practice-advanced');
    // Move existing controls (not copies), preserving their IDs and values.
    ['practice-chapter','practice-time','player-name'].forEach(id=>advanced.appendChild(document.getElementById(id).closest('.settings-card')));
    settings.querySelector('.settings-row-top').appendChild(settings.querySelector('.question-config').closest('.settings-card'));
    document.getElementById('stats-preview').classList.add('compact-availability');
}
