const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  
  // Check listings page
  await p.goto('https://www.safarizetu.com/listings', { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(5000);
  const listingCards = await p.locator('article').count();
  const title = await p.title();
  console.log('Listings: ' + listingCards + ' cards, title: ' + title);
  
  // Check itinerary page has new features
  await p.goto('https://www.safarizetu.com/itinerary/new', { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(3000);
  const hasPricing = await p.locator('text=From $350').count();
  const hasWhyThisMatters = await p.locator('text=Why This Matters').count();
  console.log('Itinerary: pricing=' + (hasPricing > 0) + ', whyThisMatters=' + (hasWhyThisMatters > 0));
  
  // Check no beta banner
  await p.goto('https://www.safarizetu.com', { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(3000);
  const beta = await p.locator('text=currently in beta').count();
  console.log('Beta banner: ' + (beta > 0 ? 'VISIBLE (BAD)' : 'GONE (GOOD)'));
  
  // Check lodges
  await p.goto('https://www.safarizetu.com/lodges', { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(5000);
  const lodgeCards = await p.locator('article').count();
  console.log('Lodges: ' + lodgeCards + ' cards');
  
  await browser.close();
})();
