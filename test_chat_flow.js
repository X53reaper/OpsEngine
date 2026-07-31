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
  await page.waitForTimeout(5000);
  
  // Check for AI response
  const messages = await page.locator('[class*="bg-primary"]').count();
  console.log('AI messages:', messages);
  
  // Get the message text
  const messageTexts = await page.locator('[class*="bg-primary"]').allTextContents();
  console.log('Message contents:', messageTexts);
  
  await browser.close();
})();