/**
 * 文件上传模块
 */

function initUpload() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');

    if (isElectron) {
        // Electron 环境：点击上传区域时打开文件对话框
        uploadArea.addEventListener('click', async () => {
            try {
                const result = await window.electronAPI.showOpenDialog({
                    filters: [
                        { name: '题库文件', extensions: ['txt', 'doc', 'docx'] },
                        { name: '所有文件', extensions: ['*'] }
                    ],
                    properties: ['openFile']
                });

                if (!result.canceled && result.filePaths.length > 0) {
                    const filePath = result.filePaths[0];
                    const fileName = filePath.split(/[/\\]/).pop();
                    handleFileSelectElectron(filePath, fileName);
                }
            } catch (error) {
                showToast('文件选择失败', 'error');
            }
        });

        // 隐藏原生文件输入
        if (fileInput) fileInput.style.display = 'none';
    } else {
        // Web 环境：使用原生文件上传
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
                handleFileSelectWeb(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelectWeb(e.target.files[0]);
            }
        });
    }
}

function handleFileSelectElectron(filePath, fileName) {
    const allowedTypes = ['.txt', '.docx'];
    const ext = '.' + fileName.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(ext)) {
        showToast('请选择 .txt 或 .docx 格式的文件', 'error');
        return;
    }

    document.getElementById('file-name').textContent = fileName;
    document.getElementById('selected-file').style.display = 'flex';
    document.getElementById('import-btn').disabled = false;

    // 保存文件路径供导入使用
    document.getElementById('file-input').dataset.filePath = filePath;
}

function handleFileSelectWeb(file) {
    const allowedTypes = ['.txt', '.docx'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(ext)) {
        showToast('请选择 .txt 或 .docx 格式的文件', 'error');
        return;
    }

    document.getElementById('file-name').textContent = file.name;
    document.getElementById('selected-file').style.display = 'flex';
    document.getElementById('import-btn').disabled = false;

    document.getElementById('file-input').files = createFileList(file);
}

function createFileList(file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    return dt.files;
}

function clearFile() {
    document.getElementById('file-input').value = '';
    delete document.getElementById('file-input').dataset.filePath;
    document.getElementById('selected-file').style.display = 'none';
    document.getElementById('import-btn').disabled = true;
    document.getElementById('import-result').style.display = 'none';
}

async function importFile() {
    const bankName = document.getElementById('bank-name').value.trim();

    // 1. Electron 环境 (调用内嵌 Python 解析)
    if (isElectron) {
        const filePath = document.getElementById('file-input').dataset.filePath;

        if (!filePath) {
            showToast('请先选择文件', 'error');
            return;
        }

        document.getElementById('import-progress').style.display = 'block';
        document.getElementById('import-result').style.display = 'none';
        document.getElementById('import-btn').disabled = true;

        try {
            const data = await window.electronAPI.importQuestions(filePath, bankName);
            handleImportSuccess(data);
        } catch (error) {
            handleImportError(error);
        }

        document.getElementById('import-btn').disabled = false;
    } 
    // 2. 移动端/离线环境 (前端 JS 解析 + IndexedDB 存储)
    else if (window.storageService && window.storageService.isMobile) {
        const fileInput = document.getElementById('file-input');
        
        if (!fileInput.files.length) {
            showToast('请先选择文件', 'error');
            return;
        }

        if (!bankName) {
            showToast('请输入题库名称', 'error');
            return;
        }

        document.getElementById('import-progress').style.display = 'block';
        document.getElementById('import-result').style.display = 'none';
        document.getElementById('import-btn').disabled = true;

        try {
            const file = fileInput.files[0];
            
            // A. 前端解析
            const questions = await window.questionParser.parseFile(file);
            
            if (!questions || questions.length === 0) {
                throw new Error("未能解析出题目，请检查文件格式");
            }

            // B. 存入 IndexedDB
            const result = await window.storageService.importQuestions(bankName, questions);
            
            if (result.success) {
                handleImportSuccess({ 
                    success: true, 
                    message: `成功导入 ${result.count} 道题目到 "${bankName}"`
                });
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            handleImportError(error);
        }

        document.getElementById('import-btn').disabled = false;
    }
    // 3. 传统 Web 环境 (上传到 Python Flask 后端)
    else {
        // Web 环境导入
        const fileInput = document.getElementById('file-input');

        if (!fileInput.files.length) {
            showToast('请先选择文件', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        if (bankName) {
            formData.append('bank_name', bankName);
        }

        document.getElementById('import-progress').style.display = 'block';
        document.getElementById('import-result').style.display = 'none';
        document.getElementById('import-btn').disabled = true;

        try {
            const response = await fetch(`${API_BASE}/api/import`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (data.success) {
                handleImportSuccess(data);
            } else {
                handleImportError({ message: data.error });
            }
        } catch (error) {
            handleImportError(error);
        }

        document.getElementById('import-btn').disabled = false;
    }
}

function handleImportSuccess(data) {
    document.getElementById('import-progress').style.display = 'none';
    const resultDiv = document.getElementById('import-result');
    resultDiv.style.display = 'block';
    
    resultDiv.className = 'import-result success';
    resultDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${data.message}`;
    showToast(data.message, 'success');
    clearFile();
    document.getElementById('bank-name').value = '';
    loadStats();
}

function handleImportError(error) {
    document.getElementById('import-progress').style.display = 'none';
    const resultDiv = document.getElementById('import-result');
    resultDiv.style.display = 'block';
    
    const msg = error.message || error.toString();
    resultDiv.className = 'import-result error';
    resultDiv.innerHTML = `<i class="fas fa-times-circle"></i> ${msg}`;
    showToast('导入失败: ' + msg, 'error');
}
