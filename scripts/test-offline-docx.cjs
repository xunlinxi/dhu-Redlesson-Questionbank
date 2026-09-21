const {chromium}=require(process.env.CODEX_NODE_MODULES+'/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
 for(const mode of ['static','android']){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  if(mode==='android') await context.addInitScript(()=>{window.Capacitor={};});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:50123/'+(mode==='static'?'static-test':'android-test')+'/index.html');
  await page.evaluate(async()=>{await storageService.ready;});
  assert.equal(await page.locator('.stat-pill').first().evaluate(el=>getComputedStyle(el).opacity),'1');
  await page.evaluate(()=>switchPage('import'));
  await page.locator('#file-input').setInputFiles('test-environment/artifacts/import-table.docx');
  const bank='DOCX_'+Date.now();await page.fill('#bank-name',bank);await page.click('#import-btn');
  await page.waitForFunction(()=>document.getElementById('import-result').textContent.includes('成功导入'));
  const result=await page.evaluate(bank=>storageService.getQuestions({bank}),bank);
  assert.equal(result.questions.length,1);assert.deepEqual(result.questions[0].answer,['A']);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'test-environment/artifacts/import-'+mode+'.jpg',quality:65});
  console.log(mode+': offline DOCX table, reduced motion, layout PASS');await context.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
