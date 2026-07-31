const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Test a simple endpoint on Vercel
  const response = await page.request.get('https://www.safarizetu.com/api/consumer/stats');
  
  console.log('Stats API Status:', response.status());
  const body = await response.text();
  console.log('Stats API Response:', body.substring(0, 200));
  
  await browser.close();
})();