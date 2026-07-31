const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  
  // Check listings page with longer wait
  await p.goto('https://www.safarizetu.com/listings', { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(8000);
  
  const listingCards = await p.locator('article').count();
  const bodyText = await p.textContent('body');
  const hasListings = bodyText.includes('listings found');
  const hasError = bodyText.includes('Unable to load');
  
  console.log('Listing cards: ' + listingCards);
  console.log('Has "listings found" text: ' + hasListings);
  console.log('Has error text: ' + hasError);
  console.log('Body text snippet: ' + bodyText.substring(0, 200));
  
  await browser.close();
})();
