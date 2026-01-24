/**
 * 前端题目解析器 (Parser Service)
 * 替代后端的 Python 解析逻辑，用于 .docx 和 .txt 解析
 */

class QuestionParser {
    constructor() {
        // 单选题标识
        this.singleChoicePatterns = [
            /^单项选择题[:：]?\s*$/,
            /^单选题[:：]?\s*$/,
            /^[一二三四五六七八九十][、\.．\s]\s*单项选择题[:：]?\s*$/,
            /^[一二三四五六七八九十][、\.．\s]\s*单选题[:：]?\s*$/,
            /^一[、\.\s\t]+单项选择题/,
            /^一[、\.\s\t]+单选题/
        ];
        
        // 多选题标识
        this.multiChoicePatterns = [
            /^多项选择题[:：]?\s*$/,
            /^多选题[:：]?\s*$/,
            /^[一二三四五六七八九十][、\.．\s]\s*多项选择题[:：]?\s*$/,
            /^[一二三四五六七八九十][、\.．\s]\s*多选题[:：]?\s*$/,
            /^二[、\.\s\t]+多项选择题/,
            /^二[、\.\s\t]+多选题/
        ];

        // 章节标识
        this.chapterPatterns = [
            /^第[一二三四五六七八九十百千\d]+章/,
            /^导论\s*$/
        ];

        // 题号模式
        this.questionNumberPattern = /^(\d+)[\.、．\s]\s*/;
        
        // 答案提取模式
        this.answerPatterns = [
            /[（(]\s*([A-Za-zＡ-Ｚａ-ｚ](?:\s*[A-Za-zＡ-Ｚａ-ｚ])*)\s*[）)]/,
            /\?\s*([A-Za-zＡ-Ｚａ-ｚ]+)/,
            /[（(]\s*([A-Za-zＡ-Ｚａ-ｚ]{2,})\s*$/
        ];
        
        this.optionStartPattern = /^([A-Za-zＡ-Ｚａ-ｚ])[\.、．\s]/;
    }

    /**
     * 解析文件对象 (File)
     */
    async parseFile(file) {
        console.log(`Parsing file: ${file.name}`);
        if (file.name.toLowerCase().endsWith('.docx')) {
             const arrayBuffer = await this.readFileAsArrayBuffer(file);
             return await this.parseDocx(arrayBuffer);
        } else if (file.name.toLowerCase().endsWith('.txt')) {
             const text = await this.readFileAsText(file);
             return this.parseText(text);
        } else {
            throw new Error("不支持的文件格式，仅支持 .docx 和 .txt");
        }
    }

    async parseDocx(arrayBuffer) {
        if (!window.mammoth) throw new Error("Mammoth.js 未加载");
        try {
            const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            const text = result.value;
            const messages = result.messages; // Warnings
            if (messages.length > 0) console.warn("Mammoth warnings:", messages);
            return this.parseText(text);
        } catch (e) {
            console.error(e);
            throw new Error("Docx 解析失败: " + e.message);
        }
    }
    
    parseText(text) {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        const questions = [];
        
        // 状态变量
        let currentType = 'single';
        let currentChapter = '默认章节';
        let currentQuestion = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 1. 检查题型变更
            const newType = this.checkType(line);
            if (newType) {
                currentType = newType;
                continue;
            }

            // 2. 检查章节变更
            const newChapter = this.checkChapter(line);
            if (newChapter) {
                currentChapter = newChapter;
                continue;
            }
            
            // 3. 检查新题目开始
            if (this.isQuestionStart(line)) {
                // 保存上一题
                if (currentQuestion) {
                    this.finalizeQuestion(questions, currentQuestion);
                }
                // 初始化新题目
                currentQuestion = this.initQuestion(line, currentType, currentChapter);
                continue;
            }
            
            // 4. 检查选项行
            if (currentQuestion) {
                // 尝试解析选项
                const optionParsed = this.parseOptionLine(line, currentQuestion);
                if (optionParsed) continue;
            }
            
            // 5. 题目或选项内容的延续
            if (currentQuestion) {
                 // 如果还没有任何选项，则追加到题目内容
                 if (Object.keys(currentQuestion.options).length === 0) {
                     currentQuestion.question += ' ' + line;
                 } else {
                     // 否则追加到最后一个选项
                     const keys = Object.keys(currentQuestion.options);
                     const lastKey = keys[keys.length - 1];
                     currentQuestion.options[lastKey] += ' ' + line;
                 }
            }
        }
        
        // 保存最后一题
        if (currentQuestion) {
             this.finalizeQuestion(questions, currentQuestion);
        }
        
        console.log(`Parsed ${questions.length} questions`);
        return questions;
    }

    checkType(line) {
        for (let p of this.singleChoicePatterns) if (p.test(line)) return 'single';
        for (let p of this.multiChoicePatterns) if (p.test(line)) return 'multi';
        return null;
    }
    
    checkChapter(line) {
        for (let p of this.chapterPatterns) if (p.test(line)) return line;
        return null;
    }
    
    isQuestionStart(line) {
        // 必须以数字开头
        if (!this.questionNumberPattern.test(line)) return false;
        // 最好还要有点号或顿号
        return true; 
    }
    
    initQuestion(line, type, chapter) {
         let answer = [];
         
         // 提取答案
         for (let p of this.answerPatterns) {
             const m = line.match(p);
             if (m) {
                 const rawAnswer = m[1].replace(/[\s\?？]/g, '');
                 answer = rawAnswer.split('').map(c => this.normalizeOptionLetter(c));
                 // 只取第一个匹配到的答案? 通常一行就包含一个答案标记
                 break; 
             }
         }
         
         const cleanLine = this.cleanQuestionText(line);
         
         return {
             question: cleanLine,
             type: type,
             chapter: chapter,
             options: {},
             answer: answer,
             rawLine: line
         };
    }
    
    cleanQuestionText(text) {
        let t = text;
        
        // 移除答案标记 (...)
        const answerCleanPattern = /[（(]\s*[A-Za-zＡ-Ｚａ-ｚ](?:\s*[A-Za-zＡ-Ｚａ-ｚ])*\s*[）)]/;
        t = t.replace(answerCleanPattern, '（  ）');
        
        // 移除 ?A 格式
        t = t.replace(/\?\s*[A-Za-zＡ-Ｚａ-ｚ]+/, '（  ）');
        
        // 移除题号 1. 2、
        t = t.replace(this.questionNumberPattern, '');
        
        // 修复嵌套括号
        t = t.replace(/[（(]\s*[（(]\s*[）)]\s*[）)]/g, '（  ）');
        
        return t.trim();
    }
    
    isOptionLine(line) {
        // 简单的行首检测
        return this.optionStartPattern.test(line);
    }
    
    parseOptionLine(line, question) {
        // 查找行内的所有选项 A. B.
        let foundAny = false;
        const text = line;
        
        // 扫描所有可能的选项起始点
        const matches = [];
        const regex = /(?:^|\s+|[\u3000])([A-Ha-hＡ-Ｈａ-ｈ])[\.\.、．\s]/g;
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            const letter = this.normalizeOptionLetter(match[1]);
            // 验证：如果是ABCDEFGH之一
            if ("ABCDEFGH".includes(letter)) {
                 matches.push({
                     key: letter,
                     index: match.index, // 注意这是匹配开始位置，可能包含前导空格
                     matchStr: match[0],
                     contentStart: match.index + match[0].length
                 });
            }
        }
        
        if (matches.length === 0) return false;
        
        for (let i = 0; i < matches.length; i++) {
            const current = matches[i];
            const next = matches[i+1];
            
            const start = current.contentStart;
            const end = next ? next.index : text.length;
            
            let content = text.substring(start, end).trim();
            
            if (content) {
                question.options[current.key] = content;
                foundAny = true;
            }
        }
        return foundAny;
    }
    
    finalizeQuestion(list, q) {
        if (!q.question) return;
        // 验证：必须有答案? 或者至少有题目
        list.push(q);
    }
    
    normalizeOptionLetter(char) {
        const full = "ＡＢＣＤＥＦＧＨａｂｃｄｅｆｇｈ";
        const half = "ABCDEFGHABCDEFGH";
        const idx = full.indexOf(char);
        if (idx >= 0) return half[idx];
        return char.toUpperCase();
    }
    
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file, 'UTF-8');
        });
    }
}

// 导出全局实例
window.questionParser = new QuestionParser();
