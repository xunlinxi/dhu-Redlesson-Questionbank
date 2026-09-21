const {chromium}=require(process.env.CODEX_NODE_MODULES+'/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const [label,width,height] of [['desktop',1440,1080],['mobile',390,844]]){
   const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
   await page.goto('http://127.0.0.1:50123/static-test/index.html',{waitUntil:'networkidle'});
   await page.locator('#pageLoader').waitFor({state:'detached'});
   await page.screenshot({path:'test-environment/artifacts/final-home-'+label+'.jpg',quality:80});
   await page.evaluate(()=>switchPage('practice'));
   await page.waitForFunction(()=>document.querySelector('#practice-bank').options.length>1);
   await page.screenshot({path:'test-environment/artifacts/final-settings-'+label+'.jpg',quality:75});
   console.log(label,await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,externalResources:performance.getEntriesByType('resource').filter(r=>!r.name.startsWith(location.origin)).length})));
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
