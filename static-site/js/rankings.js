/**
 * 排行榜管理模块
 */

const Rankings = {
    /**
     * 获取所有排行榜数据
     */
    getAll() {
        return Storage.getRankings();
    },

    /**
     * 添加成绩记录
     * 兼容两种格式：
     * 格式1（后端格式）: { name, total, correct, wrong, accuracy, time_spent, time_display }
     * 格式2（静态格式）: { playerName, bankName, score, correctCount, totalCount, accuracy, duration, mode }
     */
    add(record) {
        const data = this.getAll();
        
        // 兼容两种数据格式
        const newRecord = {
            id: Date.now().toString(),
            playerName: record.playerName || record.name || Storage.getPlayerName() || '匿名',
            bankName: record.bankName || '综合',
            score: record.score || record.correct || 0,
            correctCount: record.correctCount || record.correct || 0,
            totalCount: record.totalCount || record.total || 0,
            accuracy: record.accuracy || 0,
            duration: record.duration || record.time_spent || 0,
            timeDisplay: record.time_display || '',
            mode: record.mode || 'practice',
            createTime: new Date().toISOString()
        };
        
        data.rankings.push(newRecord);
        
        // 按正确率排序，保留最近100条
        data.rankings.sort((a, b) => b.accuracy - a.accuracy);
        data.rankings = data.rankings.slice(0, 100);
        
        Storage.setRankings(data);
        return true;
    },

    /**
     * 获取指定题库的排行榜
     */
    getByBank(bankName, limit = 10) {
        const data = this.getAll();
        return data.rankings
            .filter(r => r.bankName === bankName)
            .slice(0, limit);
    },

    /**
     * 获取总排行榜
     */
    getTop(limit = 10) {
        const data = this.getAll();
        return data.rankings.slice(0, limit);
    },

    /**
     * 清空排行榜
     */
    clear() {
        Storage.setRankings({ rankings: [] });
        return true;
    },

    /**
     * 获取玩家最佳成绩
     */
    getPlayerBest(playerName) {
        const data = this.getAll();
        const playerRecords = data.rankings.filter(r => r.playerName === playerName);
        
        if (playerRecords.length === 0) return null;
        
        return playerRecords.reduce((best, current) => 
            current.score > best.score ? current : best
        );
    }
};

// 导出
window.Rankings = Rankings;
