// ==================== 设置模块 - 离线模式 ====================

// 加载配置
async function loadConfig() {
    try {
        if (isElectron) {
            data = await window.electronAPI.getConfig();
            if (data.success) {
                document.getElementById('data-path').value = data.config.data_path || '';
                document.getElementById('current-data-file').textContent =
                    data.config.data_path + '/' + data.config.questions_file;
            }
        } else if (window.storageService && window.storageService.isMobile) {
            const config = localStorage.getItem('redlesson_config') || '{}';
            document.getElementById('current-data-file').textContent = 'IndexedDB (本地存储)';
            document.getElementById('data-path').value = JSON.parse(config).dataPath || '';
        } else {
            const response = await fetch(`${API_BASE}/api/config`);
            const data = await response.json();
            if (data.success) {
                document.getElementById('data-path').value = data.config.data_path || '';
                document.getElementById('current-data-file').textContent =
                    data.config.data_path + '/' + data.config.questions_file;
            }
        }
    } catch (error) {
        console.error('加载配置失败:', error);
    }
}

// 保存设置
async function saveSettings() {
    const dataPath = document.getElementById('data-path').value.trim();

    try {
        if (isElectron) {
            data = await window.electronAPI.saveConfig({
                data_path: dataPath,
                questions_file: 'questions.json'
            });
            if (data.success) {
                showToast('设置已保存', 'success');
                loadConfig();
            } else {
                showToast(data.error, 'error');
            }
        } else if (window.storageService && window.storageService.isMobile) {
            localStorage.setItem('redlesson_config', JSON.stringify({ dataPath }));
            showToast('设置已保存', 'success');
        } else {
            const response = await fetch(`${API_BASE}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data_path: dataPath,
                    questions_file: 'questions.json'
                })
            });

            const data = await response.json();
            if (data.success) {
                showToast('设置已保存', 'success');
                loadConfig();
            } else {
                showToast(data.error, 'error');
            }
        }
    } catch (error) {
        showToast('保存设置失败: ' + error.message, 'error');
    }
}

// 清空所有数据
function clearAllData() {
    showConfirmModal(
        '清空所有数据',
        '确定要清空所有题库数据吗？该操作不可恢复！',
        async () => {
            try {
                if (isElectron) {
                    const data = await window.electronAPI.getBanks();
                    if (data.success) {
                        for (const bank of data.banks) {
                            await window.electronAPI.deleteBank(bank.name);
                        }
                        showToast('所有数据已清空', 'success');
                        loadStats();
                    }
                } else if (window.storageService && window.storageService.isMobile) {
                    await window.storageService.db.delete();
                    showToast('所有数据已清空', 'success');
                    loadStats();
                } else {
                    const response = await fetch(`${API_BASE}/api/banks`);
                    const data = await response.json();

                    if (data.success) {
                        for (const bank of data.banks) {
                            await fetch(`${API_BASE}/api/banks/${encodeURIComponent(bank.name)}`, {
                                method: 'DELETE'
                            });
                        }
                        showToast('所有数据已清空', 'success');
                        loadStats();
                    }
                }
            } catch (error) {
                showToast('清空数据失败: ' + error.message, 'error');
            }
        }
    );
}

// 浏览数据路径
function browseDataPath() {
    if (isElectron) {
        window.electronAPI.showOpenDialog({
            properties: ['openDirectory']
        }).then(result => {
            if (!result.canceled && result.filePaths.length > 0) {
                document.getElementById('data-path').value = result.filePaths[0];
            }
        });
    } else {
        showToast('请在输入框中直接输入路径', 'warning');
    }
}
