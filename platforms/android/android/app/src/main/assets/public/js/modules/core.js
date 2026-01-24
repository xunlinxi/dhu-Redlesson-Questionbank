/**
 * 核心功能模块 - 初始化、导航、服务器健康检查
 */

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initUpload();

    // 只在非离线模式下加载统计数据
    if (!isOffline) {
        loadStats();
    } else {
        console.log('离线模式，跳过统计API加载');
    }

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
