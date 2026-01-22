// ==================== 排名系统模块 ====================

// 加载排名
async function loadRankings() {
    try {
        const data = isElectron ?
            await window.electronAPI.getRankings() :
            await (await fetch(`${API_BASE}/api/rankings`)).json();
        
        if (data.success) {
            renderRankings(data.rankings);
        }
    } catch (error) {
        console.error('加载排名失败:', error);
    }
}

// 渲染排名列表
function renderRankings(rankings) {
    const container = document.getElementById('ranking-list');
    if (!container) return;
    
    if (!rankings || rankings.length === 0) {
        container.innerHTML = '<div class="empty-ranking">暂无记录</div>';
        return;
    }
    
    // 按正确率和用时排序（正确率高优先，用时短次优先）
    rankings.sort((a, b) => {
        if (b.accuracy !== a.accuracy) {
            return b.accuracy - a.accuracy;
        }
        return a.time_spent - b.time_spent;
    });
    
    const html = rankings.slice(0, 20).map((item, index) => {
        const rankClass = index < 3 ? `top-${index + 1}` : '';
        const dateStr = item.date ? new Date(item.date).toLocaleDateString('zh-CN') : '';
        
        return `
            <div class="ranking-item ${rankClass}">
                <div class="ranking-rank">${index + 1}</div>
                <div class="ranking-info">
                    <div class="ranking-name">${escapeHtml(item.name)}</div>
                    <div class="ranking-details">
                        <span>${item.correct}/${item.total}题</span>
                    </div>
                </div>
                <div class="ranking-stats">
                    <div class="ranking-accuracy">${item.accuracy}%</div>
                    <div class="ranking-time">
                        <i class="fas fa-clock"></i> ${item.time_display}
                    </div>
                    <div class="ranking-date">${dateStr}</div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// 保存排名
async function saveRanking(record) {
    try {
        const data = isElectron ?
            await window.electronAPI.addRanking(record) :
            await (await fetch(`${API_BASE}/api/rankings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            })).json();
        
        if (data.success) {
            loadRankings();
        }
    } catch (error) {
        console.error('保存排名失败:', error);
    }
}

// 清空排名
async function clearRankings() {
    showConfirmModal(
        '清空排名',
        '确定要清空所有排名记录吗？此操作不可恢复。',
        async () => {
            try {
                const data = isElectron ?
                    await window.electronAPI.clearRankings() :
                    await (await fetch(`${API_BASE}/api/rankings`, { method: 'DELETE' })).json();
                
                if (data.success) {
                    showToast('排名已清空', 'success');
                    loadRankings();
                } else {
                    showToast('清空失败: ' + data.message, 'error');
                }
            } catch (error) {
                showToast('清空失败: ' + error.message, 'error');
            }
        }
    );
}
