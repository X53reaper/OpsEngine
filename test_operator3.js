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
  
  // Click "Send Inquiry" button
  await page.locator('button:has-text("Send Inquiry")').first().click();
  await page.waitForTimeout(1000);
  
  // Check if drawer opened
  const drawer = await page.locator('[class*="translate-x-0"]').count();
  console.log('Drawer open on operator:', drawer > 0);
  
  // Check for chat input
  const input = await page.locator('input[placeholder*="Ask about"], input[placeholder*="safari"]').count();
  console.log('Chat input found:', input > 0);
  
  // Type a message
  if (input > 0) {
    await page.locator('input[placeholder*="Ask about"], input[placeholder*="safari"]').fill('I want a 5-day safari for 2 people');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);
    
    // Check for AI response
    const drawerEl = page.locator('[class*="translate-x-0"]');
    const aiMsgs = await drawerEl.locator('[class*="bg-surface"]').allTextContents();
    console.log('AI messages:', aiMsgs);
  }
  
  await browser.close();
})();