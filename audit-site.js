const { chromium } = require('playwright');

const PAGES = [
  { name: 'homepage', url: 'https://safarizetu.com' },
  { name: 'search', url: 'https://safarizetu.com/search' },
  { name: 'lodges', url: 'https://safarizetu.com/lodges' },
  { name: 'experiences', url: 'https://safarizetu.com/experiences' },
  { name: 'destinations', url: 'https://safarizetu.com/destinations' },
  { name: 'itinerary', url: 'https://safarizetu.com/itinerary/new' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });

  const results = {};

  for (const page of PAGES) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`CHECKING: ${page.name} (${page.url})`);
    console.log('='.repeat(60));

    const tab = await context.newPage();
    const consoleLogs = [];
    const failedRequests = [];
    const networkRequests = [];

    // Capture console
    tab.on('console', msg => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });

    // Capture failed requests
    tab.on('requestfailed', req => {
      failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
    });

    // Capture all network requests
    tab.on('response', res => {
      networkRequests.push({ url: res.url(), status: res.status() });
    });

    try {
      await tab.goto(page.url, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Wait a bit more for any lazy-loaded content
      await tab.waitForTimeout(3000);

      // Take screenshot
      await tab.screenshot({ path: `D:\\Projects\\SafariZetu Automation\\screenshots\\${page.name}.png`, fullPage: true });

      // Extract page content
      const content = await tab.evaluate(() => {
        return {
          title: document.title,
          bodyText: document.body?.innerText?.substring(0, 5000) || '',
          hasListings: document.querySelectorAll('[class*="listing"], [class*="lodge"], [class*="card"]').length,
          hasImages: document.querySelectorAll('img').length,
          hasZeroCounters: document.body?.innerText?.includes('0 Destinations') || 
                          document.body?.innerText?.includes('0 Partners') ||
                          document.body?.innerText?.includes('0 Experiences') ||
                          document.body?.innerText?.includes('0 Local Jobs'),
          hasDollarDash: document.body?.innerText?.includes('$—') || document.body?.innerText?.includes('$ -'),
          forms: document.querySelectorAll('form').length,
          links: document.querySelectorAll('a[href]').length,
        };
      });

      // Check for specific audit items
      const auditChecks = {
        statCounters: await tab.evaluate(() => {
          const text = document.body?.innerText || '';
          return {
            found0Destinations: /0\s*Destinations/i.test(text),
            found0Partners: /0\s*Partners/i.test(text),
            found0Experiences: /0\s*Experiences/i.test(text),
            found0Jobs: /0\s*Local Jobs/i.test(text),
            counterElements: document.querySelectorAll('[class*="counter"], [class*="stat"], [class*="metric"]').length,
          };
        }),
        estimatedCost: await tab.evaluate(() => {
          const text = document.body?.innerText || '';
          return {
            foundDollarDash: text.includes('$—') || text.includes('$ —') || text.includes('$ -'),
            foundEstimatedCost: text.includes('Estimated Cost') || text.includes('estimated cost'),
            costElements: document.querySelectorAll('[class*="cost"], [class*="price"]').length,
          };
        }),
        searchResults: await tab.evaluate(() => {
          const text = document.body?.innerText || '';
          return {
            hasResultsText: /\d+\s*results?/i.test(text) || /showing/i.test(text),
            hasNoResults: /no results/i.test(text) || /nothing found/i.test(text),
            listingCards: document.querySelectorAll('[class*="listing"], [class*="result"], [class*="card"]').length,
          };
        }),
      };

      results[page.name] = {
        url: page.url,
        title: content.title,
        bodyLength: content.bodyText.length,
        hasListings: content.hasListings,
        hasImages: content.hasImages,
        forms: content.forms,
        links: content.links,
        auditChecks,
        failedRequests: failedRequests.length,
        failedRequestUrls: failedRequests.map(r => r.url).slice(0, 5),
        consoleErrors: consoleLogs.filter(l => l.type === 'error').map(l => l.text).slice(0, 5),
        networkApiCalls: networkRequests.filter(r => r.url.includes('/api/')).map(r => ({ url: r.url, status: r.status })).slice(0, 10),
        bodyPreview: content.bodyText.substring(0, 500),
      };

      console.log(`Title: ${content.title}`);
      console.log(`Body length: ${content.bodyText.length} chars`);
      console.log(`Listings/cards: ${content.hasListings}`);
      console.log(`Images: ${content.hasImages}`);
      console.log(`Audit - Stat counters:`, JSON.stringify(auditChecks.statCounters));
      console.log(`Audit - Estimated cost:`, JSON.stringify(auditChecks.estimatedCost));
      console.log(`Audit - Search results:`, JSON.stringify(auditChecks.searchResults));
      console.log(`Failed requests: ${failedRequests.length}`);
      console.log(`Console errors: ${consoleLogs.filter(l => l.type === 'error').length}`);
      console.log(`API calls: ${networkRequests.filter(r => r.url.includes('/api/')).length}`);
      console.log(`\nBody preview:\n${content.bodyText.substring(0, 300)}`);

    } catch (error) {
      console.log(`ERROR: ${error.message}`);
      results[page.name] = { error: error.message };
    }

    await tab.close();
  }

  // Save results
  const fs = require('fs');
  fs.writeFileSync('D:\\Projects\\SafariZetu Automation\\audit-results.json', JSON.stringify(results, null, 2));
  console.log('\n\nResults saved to audit-results.json');

  await browser.close();
})();
