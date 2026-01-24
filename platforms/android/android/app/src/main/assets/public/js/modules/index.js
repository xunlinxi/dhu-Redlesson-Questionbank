// ==================== 模块化入口文件 ====================
// 此文件用于组合所有模块，提供向后兼容的入口点
// 
// 模块加载顺序（按依赖关系）：
// 1. state.js      - 全局状态变量
// 2. utils.js      - 工具函数
// 3. core.js       - 核心初始化
// 4. stats.js      - 统计信息
// 5. upload.js     - 文件上传
// 6. banks.js      - 题库管理
// 7. practice.js   - 刷题功能
// 8. modes.js      - 做题模式
// 9. settings.js   - 设置
// 10. rankings.js  - 排名系统
// 11. wrongbook.js - 错题本
// 12. progress.js  - 进度保存
//
// 在 HTML 中按上述顺序引入各模块文件即可

console.log('炸红题库 - 模块化版本已加载');
console.log('已加载模块: state, utils, core, stats, upload, banks, practice, modes, settings, rankings, wrongbook, progress');
