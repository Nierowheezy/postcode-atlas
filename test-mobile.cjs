const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  console.log('=== Navigating to production ===');
  await page.goto('https://nigerian-postalcode-atlas.vercel.app/', { waitUntil: 'networkidle', timeout: 30000 });

  const header = await page.$('header');
  if (header) { console.log('Header box:', await header.boundingBox()); }

  const logo = await page.$('img[alt="Postcode Atlas"]');
  if (logo) { console.log('Logo box:', await logo.boundingBox()); }

  const searchInput = await page.$('input[type="text"]');
  if (searchInput) {
    console.log('Search input box:', await searchInput.boundingBox());
    const s = await searchInput.evaluate(el => getComputedStyle(el));
    console.log('Input font-size:', s.fontSize, 'width:', s.width, 'max-width:', s.maxWidth);
  }

  const hamburger = await page.$('button[aria-label="Open menu"]');
  if (hamburger) { console.log('Hamburger box:', await hamburger.boundingBox()); }

  const mapContainer = await page.$('.leaflet-container');
  if (mapContainer) { console.log('Map container box:', await mapContainer.boundingBox()); }

  const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
  const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
  console.log('Body scrollWidth:', bodyScrollWidth, 'clientWidth:', bodyClientWidth, 'overflow:', bodyScrollWidth > bodyClientWidth);

  await page.screenshot({ path: '/tmp/mobile-home.png', fullPage: true });
  console.log('Screenshot saved');

  if (hamburger) {
    await hamburger.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: '/tmp/mobile-menu-open.png', fullPage: true });
    console.log('Menu screenshot saved');
  }

  const menuItems = await page.$$('.grid.grid-cols-3 button');
  console.log('Menu items found:', menuItems.length);
  for (let i = 0; i < menuItems.length; i++) {
    const item = menuItems[i];
    const box = await item.boundingBox();
    const text = await item.textContent();
    console.log(`  Item ${i}: "${text?.trim()}" box:`, box);
  }

  await browser.close();
  console.log('Done');
})();
