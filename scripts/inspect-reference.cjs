const {chromium}=require(process.env.CODEX_NODE_MODULES+'/playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto('https://www.cho-kaguyahime.com/',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(12000);
 console.log(await page.evaluate(()=>({height:document.documentElement.scrollHeight,sections:[...document.querySelectorAll('section,[id]')].filter(e=>e.clientHeight>300).map(e=>({tag:e.tagName,id:e.id,cls:e.className,y:Math.round(e.getBoundingClientRect().top+scrollY),h:e.clientHeight})).slice(0,55)})));
 const height=await page.evaluate(()=>document.documentElement.scrollHeight);
 for(const [i,y] of [1200,2600,4300,6400,8500,11000,Math.max(0,height-1100)].entries()){
  await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(1700);
  await page.screenshot({path:'test-environment/artifacts/reference-depth-'+i+'.jpg',quality:55});
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
