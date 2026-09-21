const {chromium}=require(process.env.CODEX_NODE_MODULES+'/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
 for(const mode of ['web','static','android']) {
  const bankName = '流程测试_' + mode + '_' + Date.now();
  const context=await browser.newContext({viewport:{width:390,height:844}});
  if(mode==='android') await context.addInitScript(()=>{window.Capacitor={};});
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:50123/'+(mode==='web'?'':mode==='static'?'static-test/index.html':'android-test/index.html'),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.storageService&&window.questionParser);
  await page.evaluate(async()=>{await window.storageService.ready; switchPage('import');});
  const upload=async()=>{
   await page.locator('#file-input').setInputFiles({name:'流程测试.txt',mimeType:'text/plain',buffer:Buffer.from('一、单项选择题\n1、完整测试（A）\nA.甲\nB.乙\n二、多项选择题\n2、多选（AB）\nA.甲\nB.乙\n三、判断题\n3、判断（对）')});
   await page.fill('#bank-name',bankName);await page.locator('#import-btn').click();
   await page.waitForFunction(()=>document.getElementById('import-result').textContent.includes('成功导入')&&!importInFlight);
  };
  await upload();await upload();
  assert.equal(await page.evaluate(async bank=> (await storageService.getQuestions({bank})).questions.length,bankName),3,mode+' replacement');
  await page.evaluate(()=>switchPage('practice'));
  await page.waitForFunction(bank=>[...document.querySelector('#practice-bank').options].some(o=>o.value===bank),bankName);
  await page.selectOption('#practice-bank',bankName);
  for(const type of ['single','multi','judge']) await page.fill('#practice-'+type+'-count','1');
  await page.evaluate(()=>startPractice(true));
  assert.equal(await page.evaluate(()=>practiceQuestions.length),3);
  // Actual clicks, one wrong answer, one cleared draft, one correct judge.
  for(let i=0;i<3;i++) {
   await page.evaluate(i=>goToQuestion(i),i);
   const answer=await page.evaluate(()=>{
    const q=practiceQuestions[currentQuestionIndex];
    if(q.type==='single')return {keys:[(q.shuffledOptions||Object.entries(q.options)).map(e=>e[0]).find(k=>!(q.shuffledAnswer||q.answer).includes(k))],clear:false};
    return {keys:q.shuffledAnswer||q.answer,clear:q.type==='multi'};
   });
   for(const key of answer.keys) await page.locator('.option-btn').filter({has:page.locator('.option-key',{hasText:key})}).first().click();
   if(answer.clear)for(const key of answer.keys)await page.locator('.option-btn').filter({has:page.locator('.option-key',{hasText:key})}).first().click();
  }
  await page.evaluate(()=>saveCurrentProgress());
  const saved=await page.evaluate(async()=>await storageService.getProgressList());
  assert.ok(saved.progress_list?.length,mode+' save progress');
  const id=saved.progress_list.find(p=>p.bank===bankName).id;
  await page.evaluate(id=>loadProgress(id),id);
  assert.equal(await page.evaluate(()=>practiceQuestions.length),3);
  await page.evaluate(()=>Promise.all([finishPractice(),finishPractice()]));
  assert.equal(await page.locator('#result-correct').textContent(),'1',mode+' score');
  assert.equal(await page.locator('#result-wrong').textContent(),'2',mode+' wrong score');
  const wrong=await page.evaluate(bank=>storageService.getPracticeWrong({bank,single_count:1,multi_count:1,judge_count:1}),bankName);
  assert.equal(wrong.questions.length,1,mode+' wrongbook');
  const remaining=await page.evaluate(()=>storageService.getProgressList());
  assert.equal(remaining.progress_list.filter(p=>p.id===id).length,0,mode+' completed progress removed');
  assert.deepEqual(errors,[],mode+' browser exceptions');
  console.log(mode+': import/replace, exam click/clear, save/load, single settlement, wrongbook PASS');
  await context.close();
 }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
