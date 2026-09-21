const {chromium}=require(process.env.CODEX_NODE_MODULES+'/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',hasTouch:label==='mobile'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:50123/static-test/index.html',{waitUntil:'networkidle'});
  await page.locator('#pageLoader').waitFor({state:'detached'});
  async function shot(name){
   await page.screenshot({path:`test-environment/artifacts/ui-${name}-${label}.jpg`,quality:72});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${name} ${label} overflow`);
  }
  await shot('home');
  await page.locator('#features-section').scrollIntoViewIfNeeded();await page.evaluate(()=>scrollTo(0,document.querySelector('#features-section').offsetTop-82));await shot('features');
  await page.locator('.library-band').scrollIntoViewIfNeeded();await page.evaluate(()=>scrollTo(0,document.querySelector('.library-band').offsetTop-82));await shot('overview');
  for(const route of ['import','manage','wrongbook','practice']){
   await page.evaluate(route=>switchPage(route),route);
   await page.waitForTimeout(120);
   await shot(route);
  }
  await page.waitForFunction(()=>document.querySelector('#practice-bank').options.length>1);
  for(const type of ['single','multi','judge'])await page.fill('#practice-'+type+'-count','1');
  await page.evaluate(()=>startPractice(false));
  await shot('question');
  for(let i=0;i<3;i++){
   await page.evaluate(i=>goToQuestion(i),i);
   const keys=await page.evaluate(()=>{
    const q=practiceQuestions[currentQuestionIndex];const correct=q.shuffledAnswer||q.answer;
    return q.type==='single' ? [(q.shuffledOptions||Object.entries(q.options)).map(e=>e[0]).find(k=>!correct.includes(k))] : correct;
   });
   for(const key of keys)await page.locator(`.option-btn[data-key="${key}"]`).click();
   await page.locator('#submit-btn').click();
   if(i===0)await shot('feedback');
  }
  await page.evaluate(()=>finishPractice());await shot('result');
  await page.evaluate(()=>switchPage('wrongbook'));await page.waitForTimeout(150);await shot('wrongbook-filled');
  await page.evaluate(()=>switchPage('manage'));await page.waitForTimeout(150);
  await page.evaluate(async()=>{const q=(await storageService.getQuestions({})).questions[0];await editQuestion(q.id)});
  await shot('edit-dialog');
  assert.deepEqual(errors,[],label+' script errors');
  console.log(label+': 12 page/state screenshots, no horizontal overflow or script errors');
  await context.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
