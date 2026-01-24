/**
 * 统计数据模块
 */

const statsUseMobileStore = window.useMobileStore ?? (window.useMobileStore = isMobile && !isElectron);

async function loadStats() {
    try {
        const data = isElectron ?
            await window.electronAPI.getStats() :
            statsUseMobileStore ?
                await storageService.getStatsByBank() :
                await (await fetch(`${API_BASE}/api/stats`)).json();
        
        if (data.success) {
            const stats = data.stats || {};

            if (statsUseMobileStore) {
                const allQuestions = await storageService.db.questions.toArray();
                const totalBanks = Object.keys(stats).length;
                const singleCount = allQuestions.filter(q => q.type === 'single').length;
                const multiCount = allQuestions.filter(q => q.type === 'multi').length;
                document.getElementById('total-banks').textContent = totalBanks;
                document.getElementById('total-questions').textContent = allQuestions.length;
                document.getElementById('single-count').textContent = singleCount;
                document.getElementById('multi-count').textContent = multiCount;
            } else {
                document.getElementById('total-banks').textContent = stats.total_banks;
                document.getElementById('total-questions').textContent = stats.total_questions;
                document.getElementById('single-count').textContent = stats.single_choice_count;
                document.getElementById('multi-count').textContent = stats.multi_choice_count;
            }
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
            statsUseMobileStore ?
                await storageService.getStatsByBank() :
                await (await fetch(`${API_BASE}/api/stats/by_bank`)).json();
        
        const container = document.getElementById('bank-chapters-container');
        if (!container) return;
        
        if (data.success && Object.keys(data.stats || {}).length > 0) {
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
