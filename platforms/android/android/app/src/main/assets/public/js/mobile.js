/**
 * 移动端适配与远程访问功能 - 简化版
 */

// 全局变量
var isLocalClient = true;
var mobileMenuOpen = false;
var mobileInitialized = false;
var dragMoved = false;

// 拖动状态
var isDragging = false;
var dragStartX = 0;
var dragStartY = 0;
var menuBtnStartX = 0;
var menuBtnStartY = 0;

// 页面加载完成后初始化
window.addEventListener('load', function() {
    // 延迟执行，确保 app.js 已经加载
    setTimeout(function() {
        initMobile();
    }, 100);
});

// 新增：如果页面已经加载完成，立即执行
if (document.readyState === 'complete') {
    setTimeout(function() {
        console.log('页面已加载完成，立即初始化移动端');
        if (typeof initMobile === 'function') {
            initMobile();
        }
    }, 100);
}

// 禁止双指缩放
document.addEventListener('gesturestart', function(e) {
    e.preventDefault();
});

// 禁止双击缩放
var lastTouchEnd = 0;
document.addEventListener('touchend', function(e) {
    var now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, { passive: false });

function initMobile() {
    // 防止重复初始化
    if (mobileInitialized) {
        console.log('移动端已初始化，跳过重复调用');
        return;
    }

    mobileInitialized = true;

    console.log('=== 移动端初始化开始 ===');
    console.log('屏幕宽度:', window.innerWidth);
    console.log('屏幕高度:', window.innerHeight);
    console.log('Capacitor:', window.Capacitor !== undefined);
    console.log('Electron:', window.electronAPI !== undefined);

    //1. 检测客户端类型
    checkClientType();

    //2. 强制在 Capacitor 环境或小屏幕下初始化移动端功能
    if (window.Capacitor !== undefined || window.innerWidth < 768) {
        console.log('检测到移动端环境，初始化移动端功能...');

        createMobileMenu();
        initDraggableMenu();
        createBackButton();

        console.log('✓ 移动端功能初始化完成');
    } else {
        console.log('桌面端环境，跳过移动端功能初始化');
    }
}

// 检测是否为本地客户端
function checkClientType() {
    // Electron 环境始终是本地客户端
    if (window.electronAPI !== undefined) {
        isLocalClient = true;
        return;
    }

    // Capacitor/离线模式是本地客户端
    if (window.Capacitor !== undefined || (window.storageService && window.storageService.isMobile)) {
        isLocalClient = true;
        showRemoteBadge();
        return;
    }

    // Web 环境：尝试连接服务器
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/client/info', true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                if (data.success) {
                    isLocalClient = data.is_local;
                    if (!isLocalClient) {
                        document.body.className += ' remote-mode';
                        showRemoteBadge();
                        setupLocalStorage();
                    }
                }
            } catch (e) {
                console.error('解析客户端信息失败', e);
            }
        }
    };
    xhr.send();
}

// 显示远程模式标识
function showRemoteBadge() {
    var badge = document.createElement('div');
    badge.className = 'storage-mode-badge';
    badge.innerHTML = '<i class="fas fa-mobile-alt"></i> 本地存储模式';
    document.body.appendChild(badge);
}

// 创建移动端菜单按钮
function createMobileMenu() {
    var btn = document.createElement('button');
    btn.className = 'mobile-menu-btn';
    btn.innerHTML = '<i class="fas fa-bars"></i>';
    btn.type = 'button';
    
    btn.onclick = function() {
        toggleMenu();
    };
    
    document.body.appendChild(btn);
    
    // 点击导航项时关闭菜单
    var navItems = document.querySelectorAll('.nav-item');
    for (var i = 0; i < navItems.length; i++) {
        navItems[i].onclick = function(originalClick) {
            return function(e) {
                closeMenu();
                if (originalClick) originalClick.call(this, e);
            };
        }(navItems[i].onclick);
    }
}

function toggleMenu() {
    var sidebar = document.querySelector('.sidebar');
    var btn = document.querySelector('.mobile-menu-btn');
    var overlay = document.querySelector('.sidebar-overlay');
    
    mobileMenuOpen = !mobileMenuOpen;
    
    if (mobileMenuOpen) {
        sidebar.className += ' open';
        btn.className += ' active';
        btn.innerHTML = '<i class="fas fa-times"></i>';
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay active';
            overlay.onclick = closeMenu;
            document.body.appendChild(overlay);
        }
    } else {
        sidebar.className = sidebar.className.replace(' open', '');
        btn.className = btn.className.replace(' active', '');
        btn.innerHTML = '<i class="fas fa-bars"></i>';
        
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }
}

function closeMenu() {
    if (mobileMenuOpen) {
        toggleMenu();
    }
}

// ==================== 可拖动悬浮菜单 ====================
function initDraggableMenu() {
    console.log('初始化可拖动菜单...');

    var btn = document.querySelector('.mobile-menu-btn');
    if (!btn) {
        console.warn('移动端菜单按钮未找到');
        return;
    }

    // 从 localStorage 恢复位置，如果没有则使用默认
    var savedPos = localStorage.getItem('mobileMenuBtnPos');
    if (savedPos) {
        var pos = JSON.parse(savedPos);
        btn.style.left = pos.x + 'px';
        btn.style.top = pos.y + 'px';
        console.log('恢复菜单按钮位置:', pos);
    } else {
        // 默认位置：垂直居中左侧
        var defaultTop = (window.innerHeight - 44) / 2;
        btn.style.left = '8px';
        btn.style.top = defaultTop + 'px';
        console.log('使用默认菜单按钮位置:', { x: 8, y: defaultTop });
    }

    // 绑定拖动事件
    btn.addEventListener('touchstart', handleDragStart, { passive: false });
    btn.addEventListener('touchmove', handleDragMove, { passive: false });
    btn.addEventListener('touchend', handleDragEnd);
    btn.addEventListener('mousedown', handleDragStart);
    btn.addEventListener('mousemove', handleDragMove);
    btn.addEventListener('mouseup', handleDragEnd);
    btn.addEventListener('mouseleave', handleDragEnd);

    console.log('✓ 可拖动菜单初始化完成');
}

function handleDragStart(e) {
    e.preventDefault();

    dragMoved = false;

    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;

    isDragging = true;
    dragStartX = clientX;
    dragStartY = clientY;

    var btn = document.querySelector('.mobile-menu-btn');
    menuBtnStartX = btn.offsetLeft;
    menuBtnStartY = btn.offsetTop;

    btn.classList.add('dragging');
    console.log('开始拖动');
}

function handleDragMove(e) {
    if (!isDragging) return;

    e.preventDefault();

    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;

    var deltaX = clientX - dragStartX;
    var deltaY = clientY - dragStartY;

    if (!dragMoved && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
        dragMoved = true;
    }

    var newX = menuBtnStartX + deltaX;
    var newY = menuBtnStartY + deltaY;

    // 限制在屏幕内
    var windowWidth = window.innerWidth;
    var windowHeight = window.innerHeight;
    var btnSize = 44; // 按钮大小

    newX = Math.max(8, Math.min(newX, windowWidth - btnSize - 8));
    newY = Math.max(8, Math.min(newY, windowHeight - btnSize - 8));

    var btn = document.querySelector('.mobile-menu-btn');
    btn.style.left = newX + 'px';
    btn.style.top = newY + 'px';
}

function handleDragEnd(e) {
    if (!isDragging) return;

    isDragging = false;

    var btn = document.querySelector('.mobile-menu-btn');
    btn.classList.remove('dragging');

    if (!dragMoved) {
        // 视为点击，切换菜单
        toggleMenu();
        return;
    }

    // 保存位置到 localStorage
    var pos = {
        x: btn.offsetLeft,
        y: btn.offsetTop
    };
    localStorage.setItem('mobileMenuBtnPos', JSON.stringify(pos));
    console.log('保存菜单按钮位置:', pos);
}

// ==================== 物理返回按钮 ====================
function createBackButton() {
    console.log('创建物理返回按钮...');

    // 检查是否已存在
    if (document.querySelector('.back-btn')) {
        console.log('返回按钮已存在，跳过创建');
        return;
    }

    var btn = document.createElement('button');
    btn.className = 'back-btn';
    btn.innerHTML = '<i class="fas fa-arrow-left"></i>';
    btn.type = 'button';
    btn.onclick = handleBack;

    document.body.appendChild(btn);
    console.log('✓ 物理返回按钮创建完成');
}

// 处理返回操作
function handleBack() {
    console.log('处理返回操作，当前页面:', currentPage);

    // 判断当前页面状态
    var questionBrowser = document.getElementById('question-browser');
    var wrongQuestionBrowser = document.getElementById('wrong-question-browser');

    // 优先级 1: 在题库详情页 → 返回题库列表
    if (questionBrowser && questionBrowser.style.display !== 'none') {
        console.log('从题库详情页返回列表');
        if (typeof showBankList === 'function') {
            showBankList();
        } else {
            console.warn('showBankList 函数未定义');
        }
        return;
    }

    // 优先级 2: 在错题详情页 → 返回错题列表
    if (wrongQuestionBrowser && wrongQuestionBrowser.style.display !== 'none') {
        console.log('从错题详情页返回列表');
        if (typeof showWrongBankList === 'function') {
            showWrongBankList();
        } else {
            console.warn('showWrongBankList 函数未定义');
        }
        return;
    }

    // 优先级 3: 其他页面 → 返回首页
    console.log('返回首页');
    if (typeof switchPage === 'function') {
        switchPage('dashboard');
    } else {
        console.warn('switchPage 函数未定义');
    }
}

// ==================== 本地存储功能 ====================
function setupLocalStorage() {
    // 初始化存储
    if (!localStorage.getItem('quiz_rankings')) {
        localStorage.setItem('quiz_rankings', '[]');
    }
    if (!localStorage.getItem('quiz_wrongbook')) {
        localStorage.setItem('quiz_wrongbook', '[]');
    }
    if (!localStorage.getItem('quiz_progress')) {
        localStorage.setItem('quiz_progress', '[]');
    }
    
    // 覆盖fetch
    var originalFetch = window.fetch;
    window.fetch = function(url, options) {
        var urlStr = url.toString();
        options = options || {};
        
        // 排行榜API
        if (urlStr.indexOf('/api/rankings') !== -1 && !isLocalClient) {
            return handleRankings(urlStr, options);
        }
        
        // 错题本API
        if (urlStr.indexOf('/api/wrongbook') !== -1 && !isLocalClient) {
            return handleWrongbook(urlStr, options);
        }
        
        // 进度API
        if (urlStr.indexOf('/api/progress') !== -1 && !isLocalClient) {
            return handleProgress(urlStr, options);
        }
        
        // 错题练习
        if (urlStr.indexOf('/api/practice/wrong') !== -1 && !isLocalClient) {
            return handleWrongPractice(urlStr, options);
        }
        
        return originalFetch(url, options);
    };
}

function mockResponse(data) {
    return Promise.resolve({
        ok: true,
        json: function() { return Promise.resolve(data); }
    });
}

function handleRankings(url, options) {
    var method = options.method || 'GET';
    var rankings = JSON.parse(localStorage.getItem('quiz_rankings') || '[]');
    
    if (method === 'GET') {
        return mockResponse({ success: true, rankings: rankings });
    }
    
    if (method === 'POST') {
        var body = JSON.parse(options.body);
        rankings.unshift({
            id: Date.now().toString(),
            player_name: body.player_name || '匿名',
            bank_name: body.bank_name || '混合题库',
            score: body.score || 0,
            total: body.total || 0,
            correct: body.correct || 0,
            accuracy: body.accuracy || 0,
            time_used: body.time_used || '00:00',
            mode: body.mode || 'random',
            date: new Date().toLocaleString('zh-CN')
        });
        if (rankings.length > 100) rankings.length = 100;
        localStorage.setItem('quiz_rankings', JSON.stringify(rankings));
        if (body.player_name) localStorage.setItem('quiz_player_name', body.player_name);
        return mockResponse({ success: true, message: '成绩已保存' });
    }
    
    if (method === 'DELETE') {
        localStorage.setItem('quiz_rankings', '[]');
        return mockResponse({ success: true, message: '已清空' });
    }
    
    return mockResponse({ success: false });
}

function handleWrongbook(url, options) {
    var method = options.method || 'GET';
    var wrongbook = JSON.parse(localStorage.getItem('quiz_wrongbook') || '[]');
    
    // 获取错题本统计 (stats接口) - 返回格式与后端一致
    if (method === 'GET' && url.indexOf('/stats') !== -1) {
        var stats = {};
        wrongbook.forEach(function(q) {
            var name = q.bank || '未分类';
            if (!stats[name]) {
                stats[name] = { total: 0, single: 0, multi: 0 };
            }
            stats[name].total++;
            if (q.type === 'multi') {
                stats[name].multi++;
            } else {
                stats[name].single++;
            }
        });
        return mockResponse({ success: true, stats: stats });
    }
    
    // 获取错题本题库列表 (banks接口 - 兼容)
    if (method === 'GET' && url.indexOf('/banks') !== -1) {
        var banks = {};
        wrongbook.forEach(function(q) {
            var name = q.bank || '未分类';
            if (!banks[name]) banks[name] = { name: name, count: 0 };
            banks[name].count++;
        });
        return mockResponse({ success: true, banks: Object.values(banks) });
    }
    
    if (method === 'GET') {
        // 检查是否有bank参数筛选
        var bankMatch = url.match(/[?&]bank=([^&]*)/);
        var bankName = bankMatch ? decodeURIComponent(bankMatch[1]) : null;
        
        var filteredQuestions = wrongbook;
        if (bankName) {
            filteredQuestions = wrongbook.filter(function(q) {
                return q.bank === bankName;
            });
        }
        return mockResponse({ 
            success: true, 
            questions: filteredQuestions,
            wrong_questions: filteredQuestions,  // 兼容两种字段名
            total: filteredQuestions.length 
        });
    }
    
    if (method === 'POST') {
        var body = JSON.parse(options.body);
        var exists = wrongbook.some(function(q) { return q.id === body.question_id; });
        if (!exists && body.question) {
            // 保存完整题目信息
            var questionToSave = JSON.parse(JSON.stringify(body.question));
            questionToSave.wrong_count = 1;
            questionToSave.last_wrong_time = new Date().toLocaleString('zh-CN');
            questionToSave.user_answer = body.user_answer;  // 保存用户的错误答案
            wrongbook.push(questionToSave);
            localStorage.setItem('quiz_wrongbook', JSON.stringify(wrongbook));
        } else if (exists) {
            // 如果已存在，增加错误次数
            for (var i = 0; i < wrongbook.length; i++) {
                if (wrongbook[i].id === body.question_id) {
                    wrongbook[i].wrong_count = (wrongbook[i].wrong_count || 1) + 1;
                    wrongbook[i].last_wrong_time = new Date().toLocaleString('zh-CN');
                    break;
                }
            }
            localStorage.setItem('quiz_wrongbook', JSON.stringify(wrongbook));
        }
        return mockResponse({ success: true, message: '已加入错题本' });
    }
    
    if (method === 'DELETE') {
        var urlParts = url.split('/');
        var lastPart = urlParts[urlParts.length - 1].split('?')[0];
        
        // 检查是否是按题库删除
        if (url.indexOf('/bank/') !== -1) {
            var bankIdx = urlParts.indexOf('bank');
            if (bankIdx !== -1 && urlParts[bankIdx + 1]) {
                var bankToDelete = decodeURIComponent(urlParts[bankIdx + 1].split('?')[0]);
                wrongbook = wrongbook.filter(function(q) { return q.bank !== bankToDelete; });
            }
        } else if (lastPart && lastPart !== 'wrongbook') {
            // 按ID删除单个错题
            wrongbook = wrongbook.filter(function(q) { return q.id !== lastPart; });
        } else {
            // 清空全部
            wrongbook = [];
        }
        localStorage.setItem('quiz_wrongbook', JSON.stringify(wrongbook));
        return mockResponse({ success: true, message: '已删除' });
    }
    
    return mockResponse({ success: false });
}

function handleProgress(url, options) {
    var method = options.method || 'GET';
    var progress = JSON.parse(localStorage.getItem('quiz_progress') || '[]');
    
    if (method === 'GET') {
        // 检查是否请求单个进度
        var urlParts = url.split('/');
        var lastPart = urlParts[urlParts.length - 1].split('?')[0];
        if (lastPart && lastPart !== 'progress' && lastPart.length > 0) {
            // 请求单个进度
            var item = null;
            for (var i = 0; i < progress.length; i++) {
                if (progress[i].id === lastPart) {
                    item = progress[i];
                    break;
                }
            }
            return mockResponse({ success: true, progress: item });
        }
        // 返回进度列表，注意字段名是 progress_list
        return mockResponse({ success: true, progress_list: progress });
    }
    
    if (method === 'POST') {
        var body = JSON.parse(options.body);
        var progressId = body.progress_id || body.id || Date.now().toString();
        var newProgress = {
            id: progressId,
            bank: body.bank || body.bank_name || '全部',
            chapter: body.chapter || '',
            mode: body.mode || 'random',
            current_index: body.current_index || 0,
            total: body.total || 0,
            correct: body.correct || 0,
            wrong: body.wrong || 0,
            elapsed_time: body.elapsed_time || 0,
            remaining_time: body.remaining_time || 0,
            question_ids: body.question_ids || [],
            shuffle_map: body.shuffle_map || {},  // 乱序映射
            question_results: body.question_results || [],
            save_time: new Date().toLocaleString('zh-CN')
        };
        
        var idx = -1;
        for (var i = 0; i < progress.length; i++) {
            if (progress[i].id === progressId) { idx = i; break; }
        }
        if (idx >= 0) progress[idx] = newProgress;
        else progress.unshift(newProgress);
        if (progress.length > 20) progress.length = 20;
        
        localStorage.setItem('quiz_progress', JSON.stringify(progress));
        return mockResponse({ success: true, progress: newProgress, message: '进度已保存' });
    }
    
    if (method === 'DELETE') {
        var progressId = url.split('/').pop();
        progress = progress.filter(function(p) { return p.id !== progressId; });
        localStorage.setItem('quiz_progress', JSON.stringify(progress));
        return mockResponse({ success: true, message: '已删除' });
    }
    
    return mockResponse({ success: false });
}

function handleWrongPractice(url, options) {
    var wrongbook = JSON.parse(localStorage.getItem('quiz_wrongbook') || '[]');
    return mockResponse({ success: true, questions: wrongbook, total: wrongbook.length });
}
