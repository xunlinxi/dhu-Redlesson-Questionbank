/**
 * 进度管理模块
 */

const Progress = {
    /**
     * 获取所有进度
     */
    getAll() {
        const data = Storage.getProgress();
        return {
            success: true,
            progress_list: data.progress || []
        };
    },

    /**
     * 保存进度
     */
    save(progressData) {
        const data = Storage.getProgress();
        const progressId = progressData.progress_id || Date.now().toString();
        
        const newProgress = {
            id: progressId,
            mode: progressData.mode || 'random',
            bank: progressData.bank || '',
            chapter: progressData.chapter || '',
            current_index: progressData.current_index || 0,
            total: progressData.total || 0,
            correct: progressData.correct || 0,
            wrong: progressData.wrong || 0,
            question_ids: progressData.question_ids || [],
            shuffle_map: progressData.shuffle_map || {},  // 乱序映射（轻量级）
            question_results: progressData.question_results || [],
            remaining_time: progressData.remaining_time || 0,
            elapsed_time: progressData.elapsed_time || 0,
            save_time: new Date().toLocaleString('zh-CN')
        };
        
        // 检查是否已有该 ID 的进度，有则更新
        const existIndex = (data.progress || []).findIndex(p => p.id === progressId);
        
        if (existIndex >= 0) {
            data.progress[existIndex] = newProgress;
        } else {
            // 创建新进度，限制最多保存10个
            data.progress = (data.progress || []).slice(-9);
            data.progress.unshift(newProgress);
        }
        
        Storage.setProgress(data);
        return { id: progressId, progress: newProgress };
    },

    /**
     * 加载进度
     */
    load(progressId) {
        const data = Storage.getProgress();
        const progress = (data.progress || []).find(p => p.id === progressId);
        if (progress) {
            return { success: true, progress: progress };
        }
        return { success: false, error: '进度不存在' };
    },

    /**
     * 删除进度
     */
    remove(progressId) {
        const data = Storage.getProgress();
        data.progress = (data.progress || []).filter(p => p.id !== progressId);
        Storage.setProgress(data);
        return true;
    },

    /**
     * 获取最近进度列表
     */
    getRecent(limit = 10) {
        const data = Storage.getProgress();
        return (data.progress || []).slice(0, limit);
    },

    /**
     * 清空所有进度
     */
    clearAll() {
        Storage.setProgress({ progress: [] });
        return true;
    }
};

// 导出
window.Progress = Progress;
