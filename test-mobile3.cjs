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

  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
  });

  await page.goto('https://nigerian-postalcode-atlas.vercel.app/', { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for React to hydrate
  await page.waitForSelector('header', { timeout: 10000 });
  await page.waitForTimeout(1000);

  console.log('=== Page loaded ===');

  const header = await page.$('header');
  if (header) { console.log('Header box:', await header.boundingBox()); }

  const logos = await page.$$('img[alt="Postcode Atlas"]');
  console.log('Logos found:', logos.length);
  for (let i = 0; i < logos.length; i++) {
    const logo = logos[i];
    const box = await logo.boundingBox();
    const src = await logo.getAttribute('src');
    const classes = await logo.getAttribute('class');
    console.log(`  Logo ${i}: src=${src} class=${classes} box=${JSON.stringify(box)}`);
  }

  const hamburgers = await page.$$('button[aria-label*="menu" i], button[aria-label*="Menu" i]');
  console.log('Hamburgers found:', hamburgers.length);
  for (let i = 0; i < hamburgers.length; i++) {
    const hb = hamburgers[i];
    const box = await hb.boundingBox();
    const aria = await hb.getAttribute('aria-label');
    console.log(`  Hamburger ${i}: aria-label="${aria}" box=${JSON.stringify(box)}`);
  }

  const headerButtons = await page.$$('header button');
  console.log('Header buttons:', headerButtons.length);
  for (let i = 0; i < headerButtons.length; i++) {
    const btn = headerButtons[i];
    const box = await btn.boundingBox();
    const aria = await btn.getAttribute('aria-label');
    const text = await btn.textContent();
    console.log(`  Btn ${i}: "${text?.trim()}" aria="${aria}" box=${JSON.stringify(box)}`);
  }

  const searchInput = await page.$('input[type="text"]');
  if (searchInput) {
    console.log('Search input box:', await searchInput.boundingBox());
    const styles = await searchInput.evaluate(el => {
      const cs = getComputedStyle(el);
      return { fontSize: cs.fontSize, width: cs.width, maxWidth: cs.maxWidth, minWidth: cs.minWidth, padding: cs.padding, boxSizing: cs.boxSizing };
    });
    console.log('Search input styles:', styles);
  }

  await page.screenshot({ path: '/tmp/mobile-home-new.png', fullPage: true });
  console.log('Screenshot saved');

  // Try clicking hamburger
  if (hamburgers.length > 0) {
    await hamburgers[0].click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/mobile-menu-open-new.png', fullPage: true });
    console.log('Clicked hamburger, screenshot saved');
    
    const gridItemsAfter = await page.$$('.grid.grid-cols-3 button');
    console.log('Grid buttons after click:', gridItemsAfter.length);
    for (let i = 0; i < gridItemsAfter.length; i++) {
      const item = gridItemsAfter[i];
      const box = await item.boundingBox();
      const text = await item.textContent();
      console.log(`  Item ${i}: "${text?.trim()}" box=${JSON.stringify(box)}`);
    }
  }

  await browser.close();
  console.log('Done');
})();
