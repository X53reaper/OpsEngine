const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Test contact page
  await page.goto('https://www.safarizetu.com/contact');
  console.log('Contact page loaded:', page.url());
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  await page.waitForTimeout(5000);
  
  const buttons = await page.locator('button').allTextContents();
  console.log('Contact page buttons:', buttons);
  
  const enquireButtons = await page.locator('button:has-text("Enquire"), button:has-text("Inquiry")').count();
  console.log('Enquire buttons on contact page:', enquireButtons);
  
  if (enquireButtons > 0) {
    await page.locator('button:has-text("Enquire"), button:has-text("Inquiry")').first().click();
    await page.waitForTimeout(1000);
    const drawer = await page.locator('[class*="translate-x-0"]').count();
    console.log('Drawer open on contact:', drawer > 0);
  }
  
  await browser.close();
})();