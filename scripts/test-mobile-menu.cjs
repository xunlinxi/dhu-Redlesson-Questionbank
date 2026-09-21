const {chromium}=require(process.env.CODEX_NODE_MODULES+'/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2] || 'http://127.0.0.1:50123/static-test/index.html',{waitUntil:'networkidle'});
 const btn=page.locator('#gnavMenuBtn');await btn.waitFor({state:'visible'});
 const cdp=await context.newCDPSession(page);
 async function drag(x,y){
  const rect=await btn.boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 await drag(105,345);
 let rect=await btn.boundingBox();
 assert.ok(Math.abs(rect.x-80)<3&&Math.abs(rect.y-320)<3,'touch drag should move button to release point');
 assert.equal(await page.locator('.nav-links').evaluate(el=>el.classList.contains('is-open')),false,'drag must not open menu');
 await btn.tap();assert.equal(await page.locator('.nav-links').evaluate(el=>el.classList.contains('is-open')),true,'tap opens menu once');
 await btn.tap();
 await page.reload({waitUntil:'networkidle'});rect=await btn.boundingBox();
 assert.ok(Math.abs(rect.x-80)<3&&Math.abs(rect.y-320)<3,'reload restores position');
 await drag(389,843);rect=await btn.boundingBox();
 assert.ok(rect.x+rect.width<=382&&rect.y+rect.height<=836,'button stays inside viewport');
 await page.setViewportSize({width:320,height:568});await page.waitForTimeout(150);rect=await btn.boundingBox();
 assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=320&&rect.y+rect.height<=568,'resize clamps position');
 await page.mouse.move(rect.x+20,rect.y+20);await page.mouse.down();await page.mouse.move(65,180,{steps:6});await page.mouse.up();
 rect=await btn.boundingBox();assert.ok(Math.abs(rect.x-45)<3&&Math.abs(rect.y-160)<3,'mouse drag');
 await btn.tap();
 assert.equal(await btn.getAttribute('aria-expanded'),'true','touch toggles aria once');
 await page.locator('.nav-links [data-page="import"]').tap();
 assert.equal(await page.locator('#import-page').evaluate(el=>el.classList.contains('active')),true,'menu route works');
 assert.equal(await btn.getAttribute('aria-expanded'),'false','selecting route closes menu');
 await btn.tap();
 const menu=await page.locator('.nav-links').boundingBox();
 assert.ok(menu.x>=0&&menu.y>=0&&menu.x+menu.width<=320&&menu.y+menu.height<=568,'opened menu also stays in viewport');
 await page.locator('.nav-position-reset').tap();
 assert.equal(await page.evaluate(()=>localStorage.getItem('mobileMenuBtnPos')),null,'reset clears position');
 await btn.focus();await page.keyboard.press('Enter');
 assert.equal(await btn.getAttribute('aria-expanded'),'true','keyboard enter opens');
 await page.keyboard.press('Escape');
 assert.equal(await btn.getAttribute('aria-expanded'),'false','Escape closes');
 assert.deepEqual(errors,[],'no script errors');
 await page.screenshot({path:'test-environment/artifacts/draggable-menu-mobile.jpg',quality:75});
 console.log('PASS: touch/mouse drag, tap, persistence, bounds/resize, route selection, reset and keyboard');
 await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
