/**
 * 本地存储服务 (Storage Service)
 * 统一管理数据访问，适配 Electron IPC、Web API 和 Android IndexedDB
 */

class StorageService {
    constructor() {
        this.isElectron = window.electronAPI !== undefined;
        // 判断是否为移动端/离线模式 (Capacitor 环境或 file 协议访问且非 Electron)
        this.isMobile = window.Capacitor !== undefined || (!this.isElectron && window.location.protocol === 'file:');
        this.db = null;

        if (this.isMobile) {
            this.initDexie();
        }
    }

    initDexie() {
        this.db = new Dexie('RedLessonDB');
        this.db.version(1).stores({
            banks: '&name', // 题库列表，name 唯一
            questions: 'id, bank, chapter, type', // 题目表
            wrongbook: '++id, bank, question_id, [bank+question_id]', // 错题本
            rankings: '++id, bank, score, date', // 排行榜
            progress: 'id, bank' // 进度
        });
        console.log('IndexedDB initialized for Mobile/Offline mode');
    }

    // ================== 题库管理 ==================

    async getBanks() {
        if (this.isElectron) {
            return await window.electronAPI.getBanks();
        } else if (this.isMobile) {
            try {
                const banks = await this.db.banks.toArray();
                // 丰富数据
                const resultInfos = [];
                for (const b of banks) {
                    const count = await this.db.questions.where('bank').equals(b.name).count();
                    resultInfos.push({
                        name: b.name,
                        question_count: count,
                        import_time: b.uploadDate ? new Date(b.uploadDate).toLocaleString() : '-',
                        source_file: '本地导入'
                    });
                }
                return { success: true, banks: resultInfos };
            } catch (error) {
                return { success: false, error: error.message };
            }
        } else {
            const response = await fetch('/api/banks');
            return await response.json();
        }
    }

    async getChapters(bankName) {
        if (this.isElectron) {
            return await window.electronAPI.getChapters(bankName);
        } else if (this.isMobile) {
            try {
                const questions = await this.db.questions.where('bank').equals(bankName).toArray();
                const chapters = [...new Set(questions.map(q => q.chapter))].sort();
                return { success: true, chapters: chapters.filter(c => c) };
            } catch (error) {
                return { success: false, error: error.message };
            }
        } else {
            const response = await fetch(`/api/chapters?bank=${encodeURIComponent(bankName)}`);
            return await response.json();
        }
    }

    async deleteBank(bankName) {
        if (this.isElectron) {
            return await window.electronAPI.deleteBank(bankName);
        } else if (this.isMobile) {
            try {
                await this.db.transaction('rw', this.db.banks, this.db.questions, this.db.wrongbook, this.db.progress, async () => {
                    await this.db.banks.where('name').equals(bankName).delete();
                    await this.db.questions.where('bank').equals(bankName).delete();
                    await this.db.wrongbook.where('bank').equals(bankName).delete();
                    await this.db.progress.where('bank').equals(bankName).delete();
                });
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        } else {
            const response = await fetch(`/api/banks/${encodeURIComponent(bankName)}`, { method: 'DELETE' });
            return await response.json();
        }
    }

    // ================== 刷题功能 ==================

    async getPracticeRandom(params) {
        // params: { bank, chapter, type, count, single_count, multi_count }
        if (this.isElectron) {
            return await window.electronAPI.practiceRandom(params);
        } else if (this.isMobile) {
            try {
                let collection = this.db.questions.where('bank').equals(params.bank);
                let questions = await collection.toArray();

                if (params.chapter && params.chapter !== 'all') {
                    questions = questions.filter(q => q.chapter === params.chapter);
                }

                // 随机化
                questions = this.shuffleArray(questions);

                let result = [];
                const singles = questions.filter(q => q.type === 'single');
                const multis = questions.filter(q => q.type === 'multi');

                const sCount = parseInt(params.single_count) || 0;
                const mCount = parseInt(params.multi_count) || 0;
                const totalCount = parseInt(params.count) || 0;

                if (sCount > 0 || mCount > 0) {
                    if (sCount > 0) result = result.concat(singles.slice(0, sCount));
                    if (mCount > 0) result = result.concat(multis.slice(0, mCount));
                } else if (totalCount > 0) {
                    if (params.type === 'single') {
                        result = singles.slice(0, totalCount);
                    } else if (params.type === 'multi') {
                        result = multis.slice(0, totalCount);
                    } else {
                        result = questions.slice(0, totalCount);
                    }
                } else {
                    result = questions.slice(0, 50); // 默认
                }

                result = this.shuffleArray(result);
                return { success: true, questions: result };
            } catch (error) {
                return { success: false, error: error.message };
            }
        } else {
            const queryString = new URLSearchParams(params).toString();
            const response = await fetch(`/api/practice/random?${queryString}`);
            return await response.json();
        }
    }

    async getPracticeSequence(params) {
        // params: { bank, chapter, shuffle }
        if (this.isElectron) {
            return await window.electronAPI.practiceSequence(params);
        } else if (this.isMobile) {
            try {
                let questions = await this.db.questions.where('bank').equals(params.bank).toArray();
                
                if (params.chapter && params.chapter !== 'all') {
                    questions = questions.filter(q => q.chapter === params.chapter);
                }

                // 简单的排序（按ID或添加顺序）
                // IndexedDB 默认大多有序
                
                if (params.shuffle === 'true' || params.shuffle === true) {
                    questions = this.shuffleArray(questions);
                }
                
                return { success: true, questions: questions };
            } catch (error) {
                return { success: false, error: error.message };
            }
        } else {
            const queryString = new URLSearchParams(params).toString();
            const response = await fetch(`/api/practice/sequence?${queryString}`);
            return await response.json();
        }
    }

    async getPracticeWrong(params) {
        // params: { bank, single_count, multi_count }
        if (this.isElectron) {
            return await window.electronAPI.practiceWrong(params);
        } else if (this.isMobile) {
            try {
                const wrongEntries = await this.db.wrongbook.where('bank').equals(params.bank).toArray();
                const questionIds = wrongEntries.map(w => w.question_id);
                
                let questions = await this.db.questions.where('id').anyOf(questionIds).toArray();
                questions = this.shuffleArray(questions);
                
                let result = [];
                const singles = questions.filter(q => q.type === 'single');
                const multis = questions.filter(q => q.type === 'multi');

                const sCount = parseInt(params.single_count) || 0;
                const mCount = parseInt(params.multi_count) || 0;

                if (sCount > 0 || mCount > 0) {
                    if (sCount > 0) result = result.concat(singles.slice(0, sCount));
                    if (mCount > 0) result = result.concat(multis.slice(0, mCount));
                } else {
                    result = questions;
                }
                
                result = this.shuffleArray(result);
                return { success: true, questions: result };
            } catch (error) {
                return { success: false, error: error.message };
            }
        } else {
            const queryString = new URLSearchParams(params).toString();
            const response = await fetch(`/api/practice/wrong?${queryString}`);
            return await response.json();
        }
    }

    // ================== 错题本 ==================

    async getWrongBook(bankName) {
        if (this.isElectron) {
            return await window.electronAPI.getWrongBook(bankName);
        } else if (this.isMobile) {
            try {
                const wrongEntries = await this.db.wrongbook
                    .where('bank').equals(bankName)
                    .reverse()
                    .toArray();
                
                const questionIds = wrongEntries.map(w => w.question_id);
                const questions = [];
                
                // 保持顺序查找
                for (const id of questionIds) {
                    const q = await this.db.questions.get(id);
                    if (q) questions.push(q);
                }

                return { success: true, questions: questions };
            } catch (error) {
                return { success: false, error: error.message };
            }
        } else {
            const url = bankName ? `/api/wrongbook?bank=${encodeURIComponent(bankName)}` : '/api/wrongbook';
            const response = await fetch(url);
            return await response.json();
        }
    }

    async addWrongQuestion(data) {
        // data: { question_id, bank }
        if (this.isElectron) {
            return await window.electronAPI.addWrongQuestion(data);
        } else if (this.isMobile) {
            try {
                const exists = await this.db.wrongbook
                    .where({ bank: data.bank, question_id: data.question_id })
                    .first();
                
                if (!exists) {
                    await this.db.wrongbook.add({
                        bank: data.bank,
                        question_id: data.question_id,
                        date: new Date()
                    });
                }
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        } else {
            const response = await fetch('/api/wrongbook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await response.json();
        }
    }

    async removeWrongQuestion(questionId) {
        if (this.isElectron) {
            return await window.electronAPI.removeWrongQuestion(questionId);
        } else if (this.isMobile) {
            try {
                // 删除所有引用该ID的错题（可能有多个库？通常 questionId 应该是全局唯一的或者 bank+id 唯一）
                // 现有的后端逻辑是 delete by id。
                await this.db.wrongbook.where('question_id').equals(questionId).delete();
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        } else {
            const response = await fetch(`/api/wrongbook/${questionId}`, { method: 'DELETE' });
            return await response.json();
        }
    }

    // ================== 统计和其他 ==================

    async getStats(params) {
        if (this.isElectron) {
            return await window.electronAPI.getStats(params);
        } else if (this.isMobile) {
             // 简单的统计实现
             try {
                // Todo: 实现真实的统计
                return { success: true, stats: { total_questions: 0, total_done: 0, correct_rate: 0 }};
             } catch(e) { return {success: false, error: e.message}; }
        } else {
            const u = new URLSearchParams(params);
            const response = await fetch(`/api/stats?${u}`);
            return await response.json();
        }
    }
    
    // ================== 题目管理 ==================

    async getQuestions(filters) {
        if (this.isElectron) {
            return await window.electronAPI.getQuestions(filters);
        } else if (this.isMobile) {
            try {
                let collection = this.db.questions.where('bank').equals(filters.bank);
                let questions = await collection.toArray();
                
                if (filters.chapter && filters.chapter !== 'all') {
                    questions = questions.filter(q => q.chapter === filters.chapter);
                }
                if (filters.type && filters.type !== 'all') {
                    questions = questions.filter(q => q.type === filters.type);
                }
                
                return { success: true, questions: questions };
            } catch (error) {
                return { success: false, error: error.message };
            }
        } else {
            let url = `/api/questions?bank=${encodeURIComponent(filters.bank)}`;
            if (filters.type) url += `&type=${filters.type}`;
            if (filters.chapter) url += `&chapter=${encodeURIComponent(filters.chapter)}`;
            const response = await fetch(url);
            return await response.json();
        }
    }

    async deleteQuestion(id) {
        if (this.isElectron) {
             return await window.electronAPI.deleteQuestion(id);
        } else if (this.isMobile) {
            try {
                await this.db.questions.delete(id);
                await this.db.wrongbook.where('question_id').equals(id).delete();
                return { success: true };
            } catch (error) {
                 return { success: false, error: error.message };
            }
        } else {
             const response = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
             return await response.json();
        }
    }
    
    async updateQuestion(id, data) {
         if (this.isElectron) {
             return await window.electronAPI.updateQuestion(id, data);
         } else if (this.isMobile) {
             try {
                 await this.db.questions.update(id, data);
                 return { success: true };
             } catch (e) { return { success: false, error: e.message }; }
         } else {
             const response = await fetch(`/api/questions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await response.json();
         }
    }

    // ================== 单题操作 ==================
    async getQuestion(id) {
         if (this.isElectron) {
             return await window.electronAPI.getQuestion(id);
         } else if (this.isMobile) {
             try {
                 const q = await this.db.questions.get(id);
                 if(q) return { success: true, question: q };
                 return { success: false, error: 'Question not found' };
             } catch(e) { return { success: false, error: e.message }; }
         } else {
             const response = await fetch(`/api/questions/${id}`);
             return await response.json();
         }
    }

    // ================== 配置 ==================
    async getConfig() {
        if (this.isElectron) {
            return await window.electronAPI.getConfig(); 
        } else if (this.isMobile) {
            return { success: true, config: { data_path: 'indexedDB', questions_file: 'local' } };
        } else {
            const response = await fetch('/api/config');
            return await response.json();
        }
    }
    
    async saveConfig(data) {
        if (this.isElectron) {
            return await window.electronAPI.saveConfig(data);
        } else if (this.isMobile) {
            return { success: true }; // Mobile config is minimal/static for now
        } else {
             const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await response.json();
        }
    }

    // ================== 统计扩展 ==================
    async getStatsByBank() {
        if (this.isElectron) {
            return await window.electronAPI.getStatsByBank();
        } else if (this.isMobile) {
            try {
                const banks = await this.db.banks.toArray();
                const stats = {};
                for (const b of banks) {
                    const questions = await this.db.questions.where('bank').equals(b.name).toArray();
                    const chapters = {};
                    questions.forEach(q => {
                        chapters[q.chapter] = (chapters[q.chapter] || 0) + 1;
                    });
                    stats[b.name] = {
                        total: questions.length,
                        chapters: chapters
                    };
                }
                return { success: true, stats: stats };
            } catch (e) { return { success: false, error: e.message }; }
        } else {
             const response = await fetch('/api/stats/by_bank');
             return await response.json();
        }
    }

    async getWrongbookStats() {
        if (this.isElectron) {
            return await window.electronAPI.getWrongbookStats();
        } else if (this.isMobile) {
            try {
                // Group by bank
                const wrongs = await this.db.wrongbook.toArray();
                // Prefetch all questions involved?
                const qIds = wrongs.map(w => w.question_id);
                // In dexie, bulkGet is not standard, use anyOf
                const questions = await this.db.questions.where('id').anyOf(qIds).toArray();
                const qMap = {};
                questions.forEach(q => qMap[q.id] = q);
                
                const stats = {};
                wrongs.forEach(w => {
                    const q = qMap[w.question_id];
                    if (!q) return; // Deleted question
                    
                    if (!stats[w.bank]) stats[w.bank] = { total: 0, single: 0, multi: 0 };
                    stats[w.bank].total++;
                    if (q.type === 'single') stats[w.bank].single++;
                    else stats[w.bank].multi++;
                });
                
                return { success: true, stats: stats };
            } catch (e) { return { success: false, error: e.message }; }
        } else {
            const response = await fetch('/api/wrongbook/stats');
            return await response.json();
        }
    }

    // ================== 排行榜 ==================
    async getRankings() {
        if (this.isElectron) {
            return await window.electronAPI.getRankings();
        } else if (this.isMobile) {
            try {
                const rankings = await this.db.rankings.orderBy('date').reverse().limit(50).toArray();
                return { success: true, rankings: rankings };
            } catch (e) { return { success: false, error: e.message }; }
        } else {
            const response = await fetch('/api/rankings');
            return await response.json();
        }
    }
    
    async saveRanking(data) {
        if (this.isElectron) {
            return await window.electronAPI.saveRanking(data);
        } else if (this.isMobile) {
             try {
                 await this.db.rankings.add({
                     ...data,
                     date: new Date()
                 });
                 return { success: true };
             } catch (e) { return { success: false, error: e.message }; }
        } else {
            const response = await fetch('/api/rankings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await response.json();
        }
    }
    
    async clearRankings() {
         if (this.isElectron) {
            return await window.electronAPI.clearRankings();
        } else if (this.isMobile) {
             try {
                 await this.db.rankings.clear();
                 return { success: true };
             } catch (e) { return { success: false, error: e.message }; }
        } else {
             const response = await fetch('/api/rankings', { method: 'DELETE' });
             return await response.json();
        }
    }

    // ================== 进度存档 ==================
    async getProgress() {
        if (this.isElectron) {
            return await window.electronAPI.getProgress();
        } else if (this.isMobile) {
            try {
                const list = await this.db.progress.toArray();
                return { success: true, progress_list: list };
            } catch (e) { return { success: false, error: e.message }; }
        } else {
             const response = await fetch('/api/progress');
             return await response.json();
        }
    }
    
    async getProgressById(id) {
         if (this.isElectron) {
            return await window.electronAPI.loadProgress(id);
        } else if (this.isMobile) {
             try {
                 const p = await this.db.progress.get(Number(id)); // Dexie IDs are numbers if ++id
                 if (p) return { success: true, progress: p };
                 return { success: false, error: 'Not found' };
             } catch (e) { return { success: false, error: e.message }; }
        } else {
             const response = await fetch(`/api/progress/${id}`);
             return await response.json();
        }
    }

    async saveProgress(data) {
        if (this.isElectron) {
            return await window.electronAPI.saveProgress(data);
        } else if (this.isMobile) {
             try {
                 const id = await this.db.progress.put({
                     ...data,
                     date: new Date()
                 });
                 return { success: true, id: id };
             } catch (e) { return { success: false, error: e.message }; }
        } else {
            const response = await fetch('/api/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await response.json();
        }
    }
    
    async deleteProgress(id) {
        if (this.isElectron) {
            return await window.electronAPI.deleteProgress(id);
        } else if (this.isMobile) {
             try {
                 await this.db.progress.delete(Number(id));
                 return { success: true };
             } catch (e) { return { success: false, error: e.message }; }
        } else {
             const response = await fetch(`/api/progress/${id}`, { method: 'DELETE' });
             return await response.json();
        }
    }

    // ================== 辅助函数 ==================

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // 导入数据辅助方法 (供 Parser 调用)
    async importQuestions(bankName, questions) {
        if (!this.isMobile) return { success: false, error: "Not in mobile mode" };
        
        try {
            const result = await this.db.transaction('rw', this.db.banks, this.db.questions, async () => {
                // 1. 记录 Bank
                const existing = await this.db.banks.where('name').equals(bankName).first();
                if (!existing) {
                    await this.db.banks.add({ name: bankName, uploadDate: new Date() });
                }

                // 2. 准备问题数据
                // 确保 ID 为字符串，增加唯一性
                const batch = questions.map((q, idx) => ({
                    ...q,
                    bank: bankName,
                    id: `local_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`
                }));

                // 3. 批量添加
                await this.db.questions.bulkAdd(batch);
                return batch.length;
            });
            return { success: true, count: result };
        } catch (error) {
            console.error("Import failed", error);
            return { success: false, error: error.message };
        }
    }
}

// 导出全局实例
window.storageService = new StorageService();
