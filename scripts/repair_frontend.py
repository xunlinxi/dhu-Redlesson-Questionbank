from pathlib import Path
p=Path('platforms/web/frontend/js/app.js');s=p.read_text(encoding='utf-8')
a=s.index('function shuffleEntries(');b=s.index('\nasync function submitAnswer',a)
s=s[:a]+'''function shuffleEntries(entries, originalAnswer) {
    const keys = entries.map(([key]) => key).sort();
    const shuffled = entries.map(entry => [...entry]);
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const answerMap = {}, reverseAnswerMap = {};
    const result = shuffled.map(([originalKey, value], index) => {
        answerMap[originalKey] = keys[index];
        reverseAnswerMap[keys[index]] = originalKey;
        return [keys[index], value];
    });
    return {entries: result, shuffledAnswer: (originalAnswer || []).map(key => answerMap[key]), reverseAnswerMap};
}
'''+s[b:]
s=s.replace('if (isExamMode && selectedAnswers.length > 0)', 'if (isExamMode)')
a=s.index('function saveExamAnswer()');b=s.index('function shuffleEntries',a);part=s[a:b].replace('answered: true', 'answered: selectedAnswers.length > 0');s=s[:a]+part+s[b:]
s=s.replace("async function submitAnswer() {", "async function submitAnswer() {\n    if (!isExamMode && questionResults[currentQuestionIndex]?.answered) return;")
# initialize offline/static dashboard using same common entrypoint
s=s.replace('    await loadConfig();\n\n    // Electron', '''    if (window.STATIC_MODE || window.storageService?.isMobile) {
        await window.storageService.ready;
        serverOnline = true;
        await loadStats();
        await loadBankChapters();
    }
    await loadConfig();

    // Electron''',1)
s=s.replace('if (!isElectron) {\n        startHealthCheck();', 'if (!isElectron && !window.STATIC_MODE && !window.storageService?.isMobile) {\n        startHealthCheck();')
# Keep selected File as reference (DataTransfer assignment fails on some WebViews).
s=s.replace('function handleFileSelect(file) {', 'let selectedImportFile = null;\nlet importInFlight = false;\n\nfunction handleFileSelect(file) {\n    if (importInFlight) return;')
s=s.replace("    document.getElementById('file-input').files = createFileList(file);", '    selectedImportFile = file;')
s=s.replace('function clearFile() {', 'function clearFile() {\n    selectedImportFile = null;')
s=s.replace('async function importFile() {', 'async function importFile() {\n    if (importInFlight) return;\n    importInFlight = true;')
s=s.replace('if (!fileInput.files.length)', 'if (!(selectedImportFile || fileInput.files[0]))')
s=s.replace('const file = fileInput.files[0];', 'const file = selectedImportFile || fileInput.files[0];')
s=s.replace("formData.append('file', fileInput.files[0]);", "formData.append('file', selectedImportFile || fileInput.files[0]);")
s=s.replace('window.storageService && window.storageService.isMobile) {\n            // Mobile', 'window.storageService && (window.storageService.isMobile || window.STATIC_MODE)) {\n            // Mobile')
s=s.replace('return; // 用户还没有选择文件', 'importInFlight = false;\n                return; // 用户还没有选择文件')
a=s.index('async function importFile()');b=s.index('// ==================== 题库管理',a);part=s[a:b]
part=part.replace("document.getElementById('import-btn').disabled = false;\n                return;", "document.getElementById('import-btn').disabled = false;\n                importInFlight = false;\n                return;")
part=part.replace('resultDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${data.message}`;', 'resultDiv.textContent = data.message;')
part=part.replace('            clearFile();', "            clearFile();\n            resultDiv.style.display = 'block';")
part=part.replace('resultDiv.innerHTML = `<i class="fas fa-times-circle"></i> ${data.error}`;', 'resultDiv.textContent = data.error;')
part=part.replace("    document.getElementById('import-btn').disabled = false;\n}", "    importInFlight = false;\n    document.getElementById('import-btn').disabled = !selectedImportFile && !document.getElementById('file-input').dataset.filePath && !document.getElementById('file-input').files.length;\n}")
s=s[:a]+part+s[b:]
# Actually escape JS strings inside HTML handlers; HTML entities alone decode back to quotes.
a=s.index('function escapeAttr(text)');b=s.index('\n}',a)+2
s=s[:a]+'''function escapeAttr(text) {
    const escaped = String(text).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'").replace(/\\r/g, '\\\\r').replace(/\\n/g, '\\\\n');
    return escapeHtml(escaped).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}'''+s[b:]
p.write_text(s,encoding='utf-8')
