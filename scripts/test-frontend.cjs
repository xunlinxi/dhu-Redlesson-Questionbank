const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function context() {
 const element = () => ({classList:{add(){},remove(){},toggle(){},contains(){return false}}, style:{}, textContent:'', innerHTML:'', value:'', dataset:{}});
 const c = vm.createContext({console, TextDecoder, Uint8Array, Math:Object.create(Math), window:{}, document:{addEventListener(){},getElementById:element,querySelector:element,querySelectorAll:()=>[]}, setTimeout,clearTimeout,setInterval,clearInterval});
 vm.runInContext(fs.readFileSync('platforms/web/frontend/js/app.js','utf8'),c);
 vm.runInContext(fs.readFileSync('platforms/web/frontend/js/modules/parser.js','utf8'),c);
 return c;
}
test('shuffle preserves identities of duplicate option text',()=>{
 const c=context(); c.Math.random=()=>0;
 const r=vm.runInContext("shuffleEntries([['A','重复'],['B','重复'],['C','其他']],['A'])",c);
 assert.equal(Object.keys(r.reverseAnswerMap).length,3);
 assert.equal(r.reverseAnswerMap[r.shuffledAnswer[0]],'A');
 assert.equal(new Set(Object.values(r.reverseAnswerMap)).size,3);
});
test('clearing last exam choice clears saved answer',()=>{
 const c=context();
 vm.runInContext("isExamMode=true; practiceQuestions=[{answer:['A'],type:'multi'}]; questionResults=[{answered:true,userAnswer:['A']}]; selectedAnswers=['A']; renderQuestionNav=()=>{}; selectOption('A',true)",c);
 assert.equal(vm.runInContext('questionResults[0].userAnswer.length',c),0);
 assert.equal(vm.runInContext('questionResults[0].answered',c),false);
});
test('repeated submit counts a practice answer once',async()=>{
 const c=context();
 await vm.runInContext("practiceQuestions=[{answer:['A']}]; questionResults=[{answered:false}]; selectedAnswers=['A']; submitAnswer().then(()=>submitAnswer())",c);
 assert.equal(vm.runInContext('correctCount',c),1);
});
test('parser supports standalone answers, judge, separators, fullwidth',()=>{
 const p=context().window.questionParser;
 const q=p.parseText('第一章 测试\n一、单项选择题\n1、选择\nA. 甲 B. 乙\n答案：Ｂ\n二、多项选择题\n2、多选（A、C）\nA.甲 B.乙 C.丙\n三、判断题\n3、天空是蓝色\n答案：正确');
 assert.equal(q.length,3); assert.deepEqual(Array.from(q[0].answer),['B']);
 assert.deepEqual(Array.from(q[1].answer),['A','C']); assert.equal(q[2].type,'judge');
 assert.deepEqual(Array.from(q[2].answer),['对']); assert.equal(q[0].options.B,'乙');
});
test('UTF16 BOM is decoded before GBK',()=>{
 const p=context().window.questionParser;
 const bytes=Buffer.concat([Buffer.from([255,254]),Buffer.from('1、测试（A）\r\nA.甲\r\nB.乙','utf16le')]);
 assert.ok(p.detectEncodingAndDecode(bytes).includes('测试'));
});
test('missing answer rejected instead of silently importing ungradable question',()=>{
 const p=context().window.questionParser;
 assert.throws(()=>p.parseText('1、缺少答案\nA.甲\nB.乙'),/答案/);
});
