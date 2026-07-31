const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Test the chat API via ops engine
  const apiResponse = await page.request.post('https://ops.safarizetu.com/api/chat', {
    headers: { 
      'Content-Type': 'application/json',
      'X-Api-Key': 'dee222cc2eb4afd36e7ed1057700e32e'
    },
    data: { messages: [{ role: 'user', content: 'Hello' }] }
  });
  
  console.log('Ops Engine Chat API Status:', apiResponse.status());
  const apiBody = await apiResponse.text();
  console.log('Ops Engine Chat API Response:', apiBody.substring(0, 500));
  
  await browser.close();
})();