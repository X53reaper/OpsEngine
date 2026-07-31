const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Test the chat API on the other production deployment
  const apiResponse = await page.request.post('https://safari-zetu-2alf89hqf-x53reapers-projects.vercel.app/api/chat', {
    headers: { 'Content-Type': 'application/json' },
    data: { messages: [{ role: 'user', content: 'Hello' }] }
  });
  
  console.log('Next.js Chat API Status:', apiResponse.status());
  const apiBody = await apiResponse.text();
  console.log('Next.js Chat API Response:', apiBody.substring(0, 500));
  
  await browser.close();
})();