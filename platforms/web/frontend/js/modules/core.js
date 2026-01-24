/**
 * 核心功能模块 - 初始化、导航、服务器健康检查
 */

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initUpload();
    loadStats();
    startHealthCheck();
    
    document.body.setAttribute('data-page', 'dashboard');
    
    window.changeNavPage = changeNavPage;
    window.togglePanel = togglePanel;
});

// 面板折叠功能
function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.classList.toggle('collapsed');
    }
}

// 服务器健康检查
function startHealthCheck() {
    healthCheckInterval = setInterval(checkServerHealth, 3000);
    checkServerHealth();
}

async function checkServerHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(`${API_BASE}/api/health`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            if (!serverOnline) {
                serverOnline = true;
                hideServerError();
                showToast('服务器连接已恢复', 'success');
                switchPage(currentPage);
            }
        } else {
            handleServerOffline();
        }
    } catch (error) {
        handleServerOffline();
    }
}

function handleServerOffline() {
    if (serverOnline) {
        serverOnline = false;
        showServerError();
        showToast('服务器连接已断开，请检查后端服务是否运行', 'error');
        
        if (practiceTimer) {
            clearInterval(practiceTimer);
            practiceTimer = null;
            showToast('答题计时已暂停', 'warning');
        }
    }
}

function showServerError() {
    let errorBanner = document.getElementById('server-error-banner');
    if (!errorBanner) {
        errorBanner = document.createElement('div');
        errorBanner.id = 'server-error-banner';
        errorBanner.className = 'server-error-banner';
        errorBanner.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>服务器连接已断开，请确保后端服务正在运行</span>
            <button onclick="checkServerHealth()" class="btn btn-small">重试连接</button>
        `;
        document.body.insertBefore(errorBanner, document.body.firstChild);
    }
    errorBanner.style.display = 'flex';
}

function hideServerError() {
    const errorBanner = document.getElementById('server-error-banner');
    if (errorBanner) {
        errorBanner.style.display = 'none';
    }
}

// 导航
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const page = this.dataset.page;
            switchPage(page);
        });
    });
}

function switchPage(page) {
    // 移动/离线模式下隐藏设置页，强制跳转到首页
    if ((window.isMobile && !window.isElectron) && page === 'settings') {
        page = 'dashboard';
    }
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    document.getElementById(`${page}-page`).classList.add('active');
    
    currentPage = page;
    document.body.setAttribute('data-page', page);
    
    switch(page) {
        case 'dashboard':
            loadStats();
            loadBankChapters();
            break;
        case 'manage':
            loadBanks();
            break;
        case 'wrongbook':
            loadWrongBanks();
            break;
        case 'practice':
            loadPracticeOptions();
            showPracticeSettings();
            loadRankings();
            loadProgressList();
            break;
    }
}
