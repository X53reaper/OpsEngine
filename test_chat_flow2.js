const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Go to a lodge detail page with correct slug
  await page.goto('https://www.safarizetu.com/lodges/the-hide-safari-camp-main');
  console.log('Page loaded:', page.url());
  
  // Check for console errors
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  await page.waitForTimeout(5000);
  
  // Click Enquire Now button
  await page.locator('button:has-text("Enquire Now")').first().click();
  await page.waitForTimeout(1000);
  
  // Type a message
  await page.locator('input[placeholder*="Ask about"], input[placeholder*="safari"]').fill('I want a 5-day safari for 2 people');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(8000);
  
  // Check for chat messages in the drawer specifically
  const drawer = page.locator('[class*="translate-x-0"]');
  const userMsgs = await drawer.locator('[class*="bg-primary"]').allTextContents();
  const aiMsgs = await drawer.locator('[class*="bg-surface"]').allTextContents();
  console.log('User messages:', userMsgs);
  console.log('AI messages:', aiMsgs);
  
  // Check for loading indicator
  const loading = await drawer.locator('[class*="animate-bounce"]').count();
  console.log('Loading indicators:', loading);
  
  await browser.close();
})();