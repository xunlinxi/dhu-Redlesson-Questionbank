const { chromium } = require(process.env.CODEX_NODE_MODULES + '/playwright');
(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  await page.goto('https://www.cho-kaguyahime.com/', {waitUntil: 'domcontentloaded'});
  await page.waitForTimeout(15000);
  await page.screenshot({path: 'test-environment/reference.jpg', quality: 45});
  console.log(await page.locator('body').evaluate(el => ({background: getComputedStyle(el).background, font: getComputedStyle(el).fontFamily})));
  await browser.close();
})();

