from pathlib import Path
p=Path('platforms/web/frontend/js/app.js');s=p.read_text(encoding='utf-8')
s=s.replace('let practiceTimer = null;', 'let practiceTimer = null;\nlet practiceFinishing = null;\nlet practiceFinished = false;')
s=s.replace('practiceStartTime = new Date();','practiceStartTime = new Date();\n            practiceFinishing = null;\n            practiceFinished = false;')
a=s.index('        // 模拟考试模式：先判分再显示结果');b=s.index('\n    }\n}',a);s=s[:a]+'        finishPractice();'+s[b:]
a=s.index('function nextQuestion()');b=s.index('// 计算模拟考试结果',a)
s=s[:a]+'''function nextQuestion() {
    if (practiceFinishing || practiceFinished) return;
    if (currentQuestionIndex < practiceQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        finishPractice();
    }
}

function finishPractice() {
    if (practiceFinished) return Promise.resolve();
    if (practiceFinishing) return practiceFinishing;
    if (practiceTimer) { clearInterval(practiceTimer); practiceTimer = null; }
    practiceFinishing = (async () => {
        if (isExamMode) await calculateExamResults();
        showPracticeResult();
    })();
    return practiceFinishing;
}

'''+s[b:]
s=s.replace('function selectOption(key, isMulti)', 'function selectOption(key, isMulti)')
s=s.replace('function selectOption(key, isMulti) {', 'function selectOption(key, isMulti) {\n    if (practiceFinishing || practiceFinished) return;')
s=s.replace('function showPracticeResult() {', 'function showPracticeResult() {\n    if (practiceFinished) return;\n    practiceFinished = true;')
a=s.index('function renderQuestionNav()');b=s.index('// 切换答题卡页面',a);part=s[a:b]
part=part.replace('const multiQuestions = [];','const multiQuestions = [];\n    const judgeQuestions = [];')
part=part.replace("if (q.type === 'multi') {", "if (q.type === 'judge') { judgeQuestions.push({index:i, question:q});\n        } else if (q.type === 'multi') {")
part=part.replace('[...singleQuestions, ...multiQuestions]','[...singleQuestions, ...multiQuestions, ...judgeQuestions]')
part=part.replace("const itemType = item.question.type === 'multi' ? 'multi' : 'single';", "const itemType = item.question.type;")
part=part.replace("itemType === 'multi' ? multiQuestions.length : singleQuestions.length", "itemType === 'judge' ? judgeQuestions.length : itemType === 'multi' ? multiQuestions.length : singleQuestions.length")
s=s[:a]+part+s[b:]
# All externally imported content rendered as text. Attribute-specific handling is separate.
for expression in ['value','q.question','q.chapter','question.question','question.chapter','chapterName']:
 s=s.replace('${'+expression+'}', '${escapeHtml('+expression+')}')
s=s.replace('`<option value="${bank.name}">${bank.name} (${bank.question_count}题)</option>`', '`<option value="${escapeHtml(bank.name).replace(/"/g, \'&quot;\')}">${escapeHtml(bank.name)} (${bank.question_count}题)</option>`')
s=s.replace('`<option value="${chapter}">${chapter}</option>`', '`<option value="${escapeHtml(chapter).replace(/"/g, \'&quot;\')}">${escapeHtml(chapter)}</option>`')
s=s.replace("if (singleCount === 0 && multiCount === 0 && judgeCount === 0)","if ([singleCount, multiCount, judgeCount].some(n => n < 0) || singleCount + multiCount + judgeCount === 0)")
p.write_text(s,encoding='utf-8')
p=Path('platforms/web/frontend/index.html');s=p.read_text(encoding='utf-8');a=s.index('            <footer class="site-footer">');b=s.index('</footer>',a)+len('</footer>')
s=s[:a]+'''            <footer class="study-footer">
                <div><strong>炸红题库</strong><span>DHU / 每一小步，都算数。</span></div>
                <button class="btn btn-ghost" onclick="window.scrollTo({top:0,behavior:'smooth'})">回到顶部 ↑</button>
            </footer>'''+s[b:]
p.write_text(s,encoding='utf-8')
p=Path('platforms/web/frontend/css/cosmic.css');s=p.read_text(encoding='utf-8-sig')+'''
.study-footer {max-width:1248px;width:calc(100% - 72px);margin:auto;padding:28px 0 36px;display:flex;align-items:center;justify-content:space-between;gap:16px;}
.study-footer strong {display:block;color:#dcefe9;font-size:20px;}.study-footer span {display:block;font-size:11px;color:#9ebac6;margin-top:6px;}
.main-content {min-height:calc(100vh - 240px)!important;}
.section-deco-title .deco-title-sub {color:#a6c1ca!important;}
.features-carousel {margin-bottom:20px!important;}
.nav-brand span {background:none!important;-webkit-text-fill-color:#eef8f4!important;text-shadow:none!important;}
.question-card {margin-bottom:22px!important;}
.toast-container {max-width:calc(100vw - 36px);}
@media(max-width:600px) {
 .study-footer {width:calc(100% - 36px);padding:22px 0 90px;}.study-footer strong {font-size:17px;}.study-footer span {font-size:10px;}
 .gnav-menu-btn {top:auto!important;bottom:22px!important;position:fixed!important;width:50px!important;height:50px!important;border-radius:50%!important;}
 .practice-actions {flex-direction:row!important;}.practice-actions .btn {width:auto;flex:1;}
 .toast-container {top:80px!important;right:18px!important;}
}
''';p.write_text(s,encoding='utf-8')
# Preserve existing parser API; diagnostics are requested explicitly by import routes.
p=Path('platforms/web/backend/parser.py');s=p.read_text(encoding='utf-8').replace('def parse_file(file_path, bank_name=None):','def parse_file(file_path, bank_name=None, with_warnings=False):').replace('    return parser.parse_questions(file_path, bank_name)','    result = parser.parse_questions(file_path, bank_name)\n    return result if with_warnings else result[:3]');p.write_text(s,encoding='utf-8')
p=Path('platforms/web/backend/routes/banks.py');s=p.read_text(encoding='utf-8').replace('parse_file(txt_file_path, bank_name if bank_name else None)','parse_file(txt_file_path, bank_name if bank_name else None, with_warnings=True)');p.write_text(s,encoding='utf-8')
p=Path('platforms/electron/python_parser.py');s=p.read_text(encoding='utf-8').replace('parse_file(file_path, None)','parse_file(file_path, None, with_warnings=True)');p.write_text(s,encoding='utf-8')
