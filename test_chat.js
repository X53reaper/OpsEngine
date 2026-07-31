const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Test the chat API with text response
  const apiResponse = await page.request.post('https://www.safarizetu.com/api/chat', {
    headers: { 'Content-Type': 'application/json' },
    data: { messages: [{ role: 'user', content: 'Hello' }] }
  });
  
  console.log('Chat API Status:', apiResponse.status());
  const apiText = await apiResponse.text();
  console.log('Chat API Response (first 500 chars):', apiText.substring(0, 500));
  
  // Test the page
  await page.goto('https://www.safarizetu.com');
  console.log('Page loaded:', page.url());
  
  // Check for console errors
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  await page.waitForTimeout(3000);
  
  // Check if Enquiry button exists
  const enquireButtons = await page.locator('button:has-text("Enquire"), button:has-text("Enquiry")').count();
  console.log('Enquire buttons found:', enquireButtons);
  
  await browser.close();
})();