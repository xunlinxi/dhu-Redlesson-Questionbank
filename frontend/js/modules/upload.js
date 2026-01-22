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
    const allowedTypes = ['.txt', '.doc', '.docx'];
    const ext = '.' + fileName.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(ext)) {
        showToast('请选择 .txt、.doc 或 .docx 格式的文件', 'error');
        return;
    }

    document.getElementById('file-name').textContent = fileName;
    document.getElementById('selected-file').style.display = 'flex';
    document.getElementById('import-btn').disabled = false;

    // 保存文件路径供导入使用
    document.getElementById('file-input').dataset.filePath = filePath;
}

function handleFileSelectWeb(file) {
    const allowedTypes = ['.txt', '.doc', '.docx'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(ext)) {
        showToast('请选择 .txt、.doc 或 .docx 格式的文件', 'error');
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

    if (isElectron) {
        // Electron 环境导入
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

            document.getElementById('import-progress').style.display = 'none';
            const resultDiv = document.getElementById('import-result');
            resultDiv.style.display = 'block';

            if (data.success) {
                resultDiv.className = 'import-result success';
                resultDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${data.message}`;
                showToast(data.message, 'success');
                clearFile();
                document.getElementById('bank-name').value = '';
                loadStats();
            } else {
                resultDiv.className = 'import-result error';
                resultDiv.innerHTML = `<i class="fas fa-times-circle"></i> ${data.error}`;
                showToast(data.error, 'error');
            }
        } catch (error) {
            document.getElementById('import-progress').style.display = 'none';
            showToast('导入失败: ' + error.message, 'error');
        }

        document.getElementById('import-btn').disabled = false;
    } else {
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

            document.getElementById('import-progress').style.display = 'none';
            const resultDiv = document.getElementById('import-result');
            resultDiv.style.display = 'block';

            if (data.success) {
                resultDiv.className = 'import-result success';
                resultDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${data.message}`;
                showToast(data.message, 'success');
                clearFile();
                document.getElementById('bank-name').value = '';
                loadStats();
            } else {
                resultDiv.className = 'import-result error';
                resultDiv.innerHTML = `<i class="fas fa-times-circle"></i> ${data.error}`;
                showToast(data.error, 'error');
            }
        } catch (error) {
            document.getElementById('import-progress').style.display = 'none';
            showToast('导入失败: ' + error.message, 'error');
        }

        document.getElementById('import-btn').disabled = false;
    }
}
