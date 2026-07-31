const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  
  await p.goto('http://localhost:3000/itinerary/new', { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(3000);
  
  // Fill form to trigger price estimate
  await p.fill('input[placeholder="e.g. August 2024"]', 'September 2026');
  await p.fill('input[placeholder="Guest count"]', '4');
  await p.click('text=Wildlife');
  await p.waitForTimeout(1000);
  
  await p.screenshot({ path: 'D:/Projects/SafariZetu Automation/screenshots/itinerary_v2.png', fullPage: true });
  console.log('Itinerary v2 screenshot saved');
  await browser.close();
})();
