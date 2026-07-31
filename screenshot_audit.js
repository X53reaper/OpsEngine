const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  const pages = [
    { name: 'homepage', url: 'http://localhost:3000' },
    { name: 'listings', url: 'http://localhost:3000/listings' },
    { name: 'lodges', url: 'http://localhost:3000/lodges' },
    { name: 'itinerary-new', url: 'http://localhost:3000/itinerary/new' },
    { name: 'destinations', url: 'http://localhost:3000/destinations' },
    { name: 'experiences', url: 'http://localhost:3000/experiences' },
    { name: 'login', url: 'http://localhost:3000/login' },
  ];
  
  const viewports = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ];
  
  for (const page of pages) {
    for (const vp of viewports) {
      await context.close();
      const newContext = await browser.newContext({
        viewport: { width: vp.width, height: vp.height }
      });
      const p = await newContext.newPage();
      
      try {
        await p.goto(page.url, { waitUntil: 'networkidle', timeout: 30000 });
        await p.waitForTimeout(2000);
        
        const filename = `D:/Projects/SafariZetu Automation/screenshots/${page.name}_${vp.name}.png`;
        await p.screenshot({ path: filename, fullPage: true });
        console.log(`✓ ${page.name} @ ${vp.name} (${vp.width}px)`);
      } catch (err) {
        console.log(`✗ ${page.name} @ ${vp.name}: ${err.message}`);
      }
    }
  }
  
  await browser.close();
  console.log('Done!');
})();
