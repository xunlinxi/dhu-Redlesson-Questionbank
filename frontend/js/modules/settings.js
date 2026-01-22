// ==================== 设置模块 ====================

// 加载配置
async function loadConfig() {
    try {
        let data;
        if (isElectron) {
            data = await window.electronAPI.getConfig();
        } else {
            const response = await fetch(`${API_BASE}/api/config`);
            data = await response.json();
        }

        if (data.success) {
            document.getElementById('data-path').value = data.config.data_path || '';
            document.getElementById('current-data-file').textContent =
                data.config.data_path + '/' + data.config.questions_file;
        }
    } catch (error) {
        console.error('加载配置失败:', error);
    }
}

// 保存设置
async function saveSettings() {
    const dataPath = document.getElementById('data-path').value.trim();

    if (!dataPath) {
        showToast('请输入数据存储路径', 'warning');
        return;
    }

    try {
        let data;
        if (isElectron) {
            data = await window.electronAPI.saveConfig({
                data_path: dataPath,
                questions_file: 'questions.json'
            });
        } else {
            const response = await fetch(`${API_BASE}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data_path: dataPath,
                    questions_file: 'questions.json'
                })
            });

            data = await response.json();
        }

        if (data.success) {
            showToast('设置已保存', 'success');
            loadConfig();
        } else {
            showToast(data.error, 'error');
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
                } else {
                    // 获取所有题库并删除
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
    showToast('请在输入框中直接输入路径', 'warning');
}
