const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Go to the site
  await page.goto('https://www.safarizetu.com');
  console.log('Page loaded:', page.url());
  
  // Check for console errors
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  await page.waitForTimeout(3000);
  
  // Check if Enquire button exists
  const enquireButtons = await page.locator('button:has-text("Enquire"), button:has-text("Enquiry")').count();
  console.log('Enquire buttons found:', enquireButtons);
  
  // Click first enquire button if found
  if (enquireButtons > 0) {
    await page.locator('button:has-text("Enquire"), button:has-text("Enquiry")').first().click();
    await page.waitForTimeout(1000);
    
    // Check if drawer opened
    const drawer = await page.locator('[class*="translate-x-0"]').count();
    console.log('Drawer open:', drawer > 0);
    
    // Check for chat input
    const input = await page.locator('input[placeholder*="Ask about"], input[placeholder*="safari"]').count();
    console.log('Chat input found:', input > 0);
    
    // Type a message
    if (input > 0) {
      await page.locator('input[placeholder*="Ask about"], input[placeholder*="safari"]').fill('I want a 5-day safari for 2 people');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      
      // Check for AI response
      const messages = await page.locator('[class*="bg-primary"]').count();
      console.log('AI messages:', messages);
    }
  }
  
  await browser.close();
})();