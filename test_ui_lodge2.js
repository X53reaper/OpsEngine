const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Go to a lodge detail page
  await page.goto('https://www.safarizetu.com/lodges/the-hide-safari-camp');
  console.log('Page loaded:', page.url());
  
  // Check for console errors
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  
  await page.waitForTimeout(10000);
  
  // Check the page content
  const bodyText = await page.textContent('body');
  console.log('Body text includes "Enquire":', bodyText?.includes('Enquire'));
  console.log('Body text includes "Reserve":', bodyText?.includes('Reserve'));
  console.log('Body text length:', bodyText?.length);
  
  // Check if there's a listing
  const listingTitle = await page.locator('h1').first().textContent();
  console.log('Listing title:', listingTitle);
  
  // Check all buttons
  const buttons = await page.locator('button').allTextContents();
  console.log('All buttons:', buttons);
  
  await browser.close();
})();