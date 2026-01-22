/**
 * 统计数据模块
 */

async function loadStats() {
    try {
        const data = isElectron ?
            await window.electronAPI.getStats() :
            await (await fetch(`${API_BASE}/api/stats`)).json();
        
        if (data.success) {
            const stats = data.stats;
            document.getElementById('total-banks').textContent = stats.total_banks;
            document.getElementById('total-questions').textContent = stats.total_questions;
            document.getElementById('single-count').textContent = stats.single_choice_count;
            document.getElementById('multi-count').textContent = stats.multi_choice_count;
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

async function loadBankChapters() {
    try {
        // 暂时复用 getQuestions 获取统计数据
        const data = isElectron ?
            await window.electronAPI.getQuestions() :
            await (await fetch(`${API_BASE}/api/stats/by_bank`)).json();
        
        const container = document.getElementById('bank-chapters-container');
        if (!container) return;
        
        if (data.success && Object.keys(data.stats).length > 0) {
            container.innerHTML = Object.entries(data.stats).map(([bankName, bankData]) => {
                const chaptersHtml = Object.entries(bankData.chapters).map(([chapterName, count]) => `
                    <div class="chapter-item">
                        <span class="chapter-name" title="${chapterName}">${chapterName}</span>
                        <span class="chapter-count">${count}题</span>
                    </div>
                `).join('');
                
                return `
                    <div class="bank-chapter-group">
                        <div class="bank-title">
                            <i class="fas fa-book"></i>
                            ${bankName}
                            <span class="bank-count">(共${bankData.total}题)</span>
                        </div>
                        <div class="chapter-list">
                            ${chaptersHtml}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>暂无题库，请先导入题库</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('加载题库章节失败:', error);
    }
}
