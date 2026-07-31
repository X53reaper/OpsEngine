const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Test operator page with ID
  await page.goto('https://www.safarizetu.com/operators/op-001');
  console.log('Operator page loaded:', page.url());
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  await page.waitForTimeout(5000);
  
  const buttons = await page.locator('button').allTextContents();
  console.log('Operator page buttons:', buttons);
  
  const enquireButtons = await page.locator('button:has-text("Enquire")').count();
  console.log('Enquire buttons on operator page:', enquireButtons);
  
  if (enquireButtons > 0) {
    await page.locator('button:has-text("Enquire")').first().click();
    await page.waitForTimeout(1000);
    const drawer = await page.locator('[class*="translate-x-0"]').count();
    console.log('Drawer open on operator:', drawer > 0);
  }
  
  await browser.close();
})();