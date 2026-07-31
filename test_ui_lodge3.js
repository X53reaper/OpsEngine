const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Go to a lodge detail page with correct slug
  await page.goto('https://www.safarizetu.com/lodges/the-hide-safari-camp-main');
  console.log('Page loaded:', page.url());
  
  // Check for console errors
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  await page.waitForTimeout(10000);
  
  // Check the page content
  const bodyText = await page.textContent('body');
  console.log('Body text includes "Enquire":', bodyText?.includes('Enquire'));
  console.log('Body text includes "Reserve":', bodyText?.includes('Reserve'));
  
  // Check if there's a listing
  const listingTitle = await page.locator('h1').first().textContent();
  console.log('Listing title:', listingTitle);
  
  // Check all buttons
  const buttons = await page.locator('button').allTextContents();
  console.log('All buttons:', buttons);
  
  // Check if Enquire button exists
  const enquireButtons = await page.locator('button:has-text("Enquire")').count();
  console.log('Enquire buttons found:', enquireButtons);
  
  // Click first enquire button if found
  if (enquireButtons > 0) {
    await page.locator('button:has-text("Enquire")').first().click();
    await page.waitForTimeout(1000);
    
    // Check if drawer opened
    const drawer = await page.locator('[class*="translate-x-0"]').count();
    console.log('Drawer open:', drawer > 0);
    
    // Check for chat input
    const input = await page.locator('input[placeholder*="Ask about"], input[placeholder*="safari"]').count();
    console.log('Chat input found:', input > 0);
  }
  
  await browser.close();
})();