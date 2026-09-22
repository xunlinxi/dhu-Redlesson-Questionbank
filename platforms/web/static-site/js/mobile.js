/**
 * 移动端适配与远程访问功能 - 简化版
 */

// 全局变量
var isLocalClient = true;
var mobileMenuOpen = false;

// 页面加载完成后初始化
window.addEventListener('load', function() {
    // 延迟执行，确保 app.js 已经加载
    setTimeout(function() {
        initMobile();
    }, 100);
});

function initMobile() {
    // 1. 检测客户端类型
    checkClientType();
    
    // 2. 如果是小屏幕，初始化移动端菜单
    if (window.innerWidth <= 768) {
        createMobileMenu();
    }
}

// 检测是否为本地客户端
function checkClientType() {
    // Electron 环境始终是本地客户端
    if (window.electronAPI !== undefined || window.STATIC_MODE || window.Capacitor) {
        isLocalClient = true;
        return;
    }

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

// The same floating button handles taps and drags. Pointer capture keeps a
// gesture attached to the button even when the finger moves outside it.
function createMobileMenu() {
    var btn = document.getElementById('gnavMenuBtn');
    if (!btn || btn.dataset.draggableMenu === 'true') return;
    btn.dataset.draggableMenu = 'true';
    btn.title = '点击打开导航，拖动调整位置';
    btn.setAttribute('aria-label', '导航菜单，可拖动调整位置');
    initDraggableMenu(btn);
}

function initDraggableMenu(btn) {
    var gesture = null;
    var suppressClick = false;
    var userPositioned = false;
    var storageKey = 'mobileMenuBtnPos';

    function place(x, y) {
        var viewport = window.visualViewport;
        var left = viewport ? viewport.offsetLeft : 0;
        var top = viewport ? viewport.offsetTop : 0;
        var width = viewport ? viewport.width : window.innerWidth;
        var height = viewport ? viewport.height : window.innerHeight;
        var rect = btn.getBoundingClientRect();
        x = Math.max(left + 8, Math.min(x, left + width - rect.width - 8));
        const actions = document.body.classList.contains('practice-focused') ? document.querySelector('.practice-actions') : document.body.classList.contains('practice-configuring') ? document.querySelector('.practice-start-btn') : null;
        const actionTop = actions?.getBoundingClientRect().top;
        const lowerEdge = actionTop > top ? Math.min(top + height, actionTop - 4) : top + height;
        y = Math.max(top + 8, Math.min(y, lowerEdge - rect.height - 8));
        btn.style.setProperty('--menu-x', x + 'px');
        btn.style.setProperty('--menu-y', y + 'px');
        btn.classList.add('menu-positioned');
        positionMobileMenu();
        return {x: x, y: y};
    }

    function savePosition() {
        var rect = btn.getBoundingClientRect();
        try { localStorage.setItem(storageKey, JSON.stringify({x: rect.left, y: rect.top})); }
        catch (_) { /* Dragging remains available if browser storage is disabled. */ }
    }

    try {
        var saved = JSON.parse(localStorage.getItem(storageKey));
        if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) { userPositioned = true; place(saved.x, saved.y); }
    } catch (_) { /* Ignore invalid or unavailable stored preferences. */ }

    btn.addEventListener('pointerdown', function(event) {
        if (!event.isPrimary || event.button !== 0 || (window.innerWidth > 768 && !document.body.classList.contains('practice-focused'))) return;
        var rect = btn.getBoundingClientRect();
        gesture = {id: event.pointerId, x: event.clientX, y: event.clientY,
            left: rect.left, top: rect.top, moved: false};
        suppressClick = false;
        btn.setPointerCapture(event.pointerId);
    });

    btn.addEventListener('pointermove', function(event) {
        if (!gesture || gesture.id !== event.pointerId) return;
        var dx = event.clientX - gesture.x;
        var dy = event.clientY - gesture.y;
        if (!gesture.moved && Math.hypot(dx, dy) < 6) return;
        gesture.moved = true;
        if (!btn.hasPointerCapture(event.pointerId)) btn.setPointerCapture(event.pointerId);
        btn.classList.add('dragging');
        place(gesture.left + dx, gesture.top + dy);
    });

    function finish(event) {
        if (!gesture || gesture.id !== event.pointerId) return;
        // A captured touch gesture may not synthesize click after a drag.
        // Resolve a touch tap on pointerup; consume its optional compatibility click.
        const touchRelease = event.type === 'pointerup' && event.pointerType === 'touch';
        suppressClick = event.type === 'pointerup' && (gesture.moved || touchRelease);
        if (touchRelease && !gesture.moved) toggleMobileMenu();
        if (gesture.moved) { userPositioned = true; savePosition(); }
        gesture = null;
        btn.classList.remove('dragging');
        // Pointer capture releases automatically after pointerup/cancel.
    }
    btn.addEventListener('pointerup', finish);
    btn.addEventListener('pointercancel', finish);
    btn.addEventListener('lostpointercapture', function(event) { if (event.target === btn) finish(event); });
    btn.addEventListener('click', function(event) {
        // Keyboard activation (detail=0) remains usable after a drag.
        if (suppressClick && event.detail !== 0) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
        suppressClick = false;
    }, true);

    function positionMobileMenu() {
        const nav = document.querySelector('.nav-links');
        if (!nav || !nav.classList.contains('is-open') || (window.innerWidth > 768 && !document.body.classList.contains('practice-focused'))) return;
        const rect = btn.getBoundingClientRect();
        const viewport = window.visualViewport;
        const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
        const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
        const menuWidth = nav.offsetWidth, menuHeight = nav.offsetHeight;
        const x = Math.max(left + 8, Math.min(rect.right - menuWidth, left + width - menuWidth - 8));
        const y = rect.top - menuHeight - 12 >= top + 8 ? rect.top - menuHeight - 12 : Math.min(rect.bottom + 12, top + height - menuHeight - 8);
        nav.style.setProperty('--nav-x', x + 'px');
        nav.style.setProperty('--nav-y', Math.max(top + 8, y) + 'px');
    }
    window.positionMobileMenu = positionMobileMenu;
    window.resetMobileMenuPosition = function() {
        userPositioned = false;
        btn.classList.remove('menu-positioned');
        btn.style.removeProperty('--menu-x'); btn.style.removeProperty('--menu-y');
        try { localStorage.removeItem(storageKey); } catch (_) {}
        closeMobileNav();
        keepInView();
    };

    function keepInView() {
        if (gesture) return;
        if (!userPositioned) {
            const dock = document.getElementById('practice-nav-dock');
            if (document.body.classList.contains('practice-focused') && dock?.getClientRects().length) {
                const target = dock.getBoundingClientRect();
                const size = btn.getBoundingClientRect();
                place(target.left + (target.width-size.width)/2, target.top + (target.height-size.height)/2);
            } else {
                btn.classList.remove('menu-positioned');
                btn.style.removeProperty('--menu-x');btn.style.removeProperty('--menu-y');
                positionMobileMenu();
            }
            return;
        }
        if ((window.innerWidth > 768 && !document.body.classList.contains('practice-focused'))) { closeMobileNav(); return; }
        if (!btn.classList.contains('menu-positioned') && !document.body.classList.contains('practice-focused')) { positionMobileMenu(); return; }
        var rect = btn.getBoundingClientRect();
        place(rect.left, rect.top);
    }
    window.keepMobileMenuInView = keepInView;
    window.addEventListener('resize', keepInView);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', keepInView);
        window.visualViewport.addEventListener('scroll', keepInView);
    }
}

// Also initialize when a desktop window enters the mobile breakpoint.
window.addEventListener('resize', function() {
    if (window.innerWidth <= 768) createMobileMenu();
});

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
            name: body.name || body.player_name || '匿名',
            total: body.total || 0,
            settings: body.settings || {},
            timer_enabled: body.timer_enabled ?? (body.remaining_time > 0),
            correct: body.correct || 0,
            wrong: body.wrong || 0,
            accuracy: body.accuracy || 0,
            time_spent: body.time_spent || 0,
            time_display: body.time_display || body.time_used || '00:00',
            date: new Date().toLocaleString('zh-CN')
        });
        if (rankings.length > 100) rankings.length = 100;
        localStorage.setItem('quiz_rankings', JSON.stringify(rankings));
        if (body.name) localStorage.setItem('quiz_player_name', body.name);
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
            settings: body.settings || {},
            timer_enabled: body.timer_enabled ?? (body.remaining_time > 0),
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
