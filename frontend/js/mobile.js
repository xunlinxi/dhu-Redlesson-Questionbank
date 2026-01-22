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
    // 1. 检测客户端类型
    checkClientType();
    
    // 2. 如果是小屏幕，初始化移动端菜单
    if (window.innerWidth < 768) {
        createMobileMenu();
    }
}

// 检测是否为本地客户端
function checkClientType() {
    // Electron 环境始终是本地客户端
    if (window.electronAPI !== undefined) {
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
