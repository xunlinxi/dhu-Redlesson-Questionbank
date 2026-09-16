/** Browser TXT/DOCX parser. All platforms share this file via sync_frontends.py. */
class QuestionParser {
    async parseFile(file) {
        if (!file || !file.size) throw new Error('文件为空，请选择包含题目的文件');
        if (file.size > 20 * 1024 * 1024) throw new Error('文件超过 20 MB，请拆分题库后导入');
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'doc') throw new Error('离线端无法读取旧版 .doc，请用 Word 另存为 .docx 或 UTF-8 TXT');
        const buffer = await this.readFileAsArrayBuffer(file);
        if (ext === 'docx') return this.parseDocx(buffer);
        if (ext === 'txt') return this.parseText(this.detectEncodingAndDecode(buffer));
        throw new Error('请选择 .txt 或 .docx 文件');
    }
    async parseDocx(arrayBuffer) {
        if (!window.mammoth) throw new Error('Word 解析组件未加载，请刷新页面');
        let result;
        try { result = await window.mammoth.extractRawText({arrayBuffer}); }
        catch (_) { throw new Error('无法读取 DOCX，请确认文件未损坏、未加密，且不是重命名的 DOC 文件'); }
        return this.parseText(result.value);
    }
    normalize(text) {
        return text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    }
    answer(text, judge = false) {
        const value = this.normalize(text).replace(/[?？]/g, '').trim();
        if (/^(对|正确|√|✓|true|T)$/i.test(value)) return ['对'];
        if (/^(错|错误|×|✗|false|F)$/i.test(value) && (judge || !/^F$/i.test(value))) return ['错'];
        if (/^[A-H](?:[\s、,，;；]*[A-H])*$/i.test(value)) return [...new Set(value.toUpperCase().match(/[A-H]/g))];
        return [];
    }
    parseText(text) {
        const lines = this.normalize(text).replace(/^\uFEFF/, '').split(/\r\n|\r|\n/).flatMap(line => {
            // Only split a pasted next question inside an option line, never decimal numbers in a stem.
            const embedded = line.match(/\s+(\d{2,4}[、．.]\s*.*?[（(]\s*[A-H?？ ]+\s*[）)]\s*)$/);
            return embedded && /^[A-Ha-h][.．、]/.test(line.trim()) ? [line.slice(0, embedded.index), embedded[1]] : [line];
        });
        const questions = [];
        this.warnings = [];
        let type = 'single', chapter = '默认章节', current = null, analysis = false;
        const finalize = () => {
            if (!current) return;
            if (current.type !== 'judge' && current.answer.length > 1) current.type = 'multi';
            if (!current.question.trim()) throw new Error(`第 ${current.sourceLine} 行：题干为空`);
            if (!current.answer.length || current.answer.some(a => a == null)) throw new Error(`第 ${current.sourceLine} 行「${current.question.slice(0, 20)}」缺少有效答案`);
            if (current.type === 'judge') {
                if (!['对','错'].includes(current.answer[0])) throw new Error(`第 ${current.sourceLine} 行：判断题答案应为对或错`);
                current.options = {};
            } else if (Object.keys(current.options).length < 2 || current.answer.some(a => !current.options[a])) {
                throw new Error(`第 ${current.sourceLine} 行：选项不完整或答案指向不存在的选项`);
            }
            questions.push(current); current = null;
        };
        const finish = () => {
            try { finalize(); }
            catch (error) { this.warnings.push(error.message); current = null; }
        };
        const consume = line => {
            const standalone = line.match(/^(?:正确|参考)?答案\s*[:：]?\s*(.+)$/);
            const onlyBracket = line.match(/^[（(]\s*([^（）()]+)\s*[）)]$/);
            if (standalone || onlyBracket || (current.type === 'judge' && /^(对|错|正确|错误|√|✓|×|✗|true|false|T|F)$/i.test(line))) {
                const answer = this.answer(standalone?.[1] || onlyBracket?.[1] || line, current.type === 'judge');
                if (answer.length) { current.answer = answer; return; }
            }
            if (/^(?:答案)?解析\s*[:：]/.test(line)) { analysis = true; current.analysis = line.replace(/^(?:答案)?解析\s*[:：]\s*/, ''); return; }
            if (analysis) { current.analysis += '\n' + line; return; }
            // Replace only actual answer tokens; English abbreviations remain part of the stem.
            line = line.replace(/[（(]\s*([^（）()]+)\s*[）)]/g, (whole, raw) => {
                if (Object.keys(current.options).length) return whole;
                const answer = this.answer(raw, current.type === 'judge');
                if (!answer.length) return whole;
                current.answer = answer;
                if (answer[0] === '对' || answer[0] === '错') current.type = 'judge';
                return '（  ）';
            });
            const markers = [...line.matchAll(/([A-Ha-h])[.、．:：)]\s*|(?:^|\s)([A-Ha-h])(?:\s+|(?=[\u4e00-\u9fff]))/g)];
            if (markers.length) {
                const prefix = line.slice(0, markers[0].index).trim();
                if (prefix) current.question += (current.question ? ' ' : '') + prefix;
                markers.forEach((m, i) => {
                    const key = (m[1] || m[2]).toUpperCase();
                    current.options[key] = line.slice(m.index + m[0].length, markers[i + 1]?.index ?? line.length).trim();
                });
            } else {
                const keys = Object.keys(current.options);
                if (keys.length) current.options[keys[keys.length - 1]] += ' ' + line;
                else current.question += (current.question ? ' ' : '') + line;
            }
        };
        lines.forEach((raw, index) => {
            const line = raw.trim();
            if (!line) return;
            const heading = line.match(/^(?:[一二三四五六七八九十\d]+[、.．\s]\s*)?(单项选择题|单选题|多项选择题|多选题|判断题)(?:\s*[:：（(].*)?$/);
            if (heading) { finish(); type = heading[1].startsWith('多') ? 'multi' : heading[1] === '判断题' ? 'judge' : 'single'; return; }
            if (/^第[一二三四五六七八九十百千\d]+章|^导论\s*$/.test(line)) { finish(); chapter = line; return; }
            const start = line.match(/^\d+\s*[.、．)）]\s*/);
            if (start) {
                finish(); analysis = false;
                current = {question:'', options:{}, answer:[], type, chapter, sourceLine:index + 1};
                consume(line.slice(start[0].length));
            } else if (current) consume(line);
        });
        finish();
        if (!questions.length) throw new Error(this.warnings.join('；') || '没有识别到题目，请使用“1、题干（A）”与“A.选项”的格式');
        return questions;
    }
    detectEncodingAndDecode(buffer) {
        const bytes = new Uint8Array(buffer);
        if (bytes[0] === 255 && bytes[1] === 254) return new TextDecoder('utf-16le', {fatal:true}).decode(bytes);
        if (bytes[0] === 254 && bytes[1] === 255) return new TextDecoder('utf-16be', {fatal:true}).decode(bytes);
        for (const encoding of ['utf-8', 'gb18030']) {
            try {
                const text = new TextDecoder(encoding, {fatal:true}).decode(bytes);
                if (text.includes('\0')) throw new Error('文本包含空字节');
                return text;
            } catch (_) { /* Try next supported encoding. */ }
        }
        throw new Error('无法识别文本编码，请另存为 UTF-8 TXT');
    }
    readFileAsArrayBuffer(file) {
        if (file.arrayBuffer) return file.arrayBuffer();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('文件读取失败，请重新选择'));
            reader.readAsArrayBuffer(file);
        });
    }
}
window.questionParser = new QuestionParser();
