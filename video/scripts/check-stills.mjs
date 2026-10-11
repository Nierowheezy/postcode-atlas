/**
 * Quick sanity check for captured stills: confirm map tiles actually loaded and
 * the injected panel content rendered, so the video doesn't use blank frames.
 */
import { chromium } from 'playwright';

const BASE = process.env.ATLAS_URL || 'https://nigerian-postalcode-atlas.vercel.app/';
const KEY = 'ask-atlas:conversation:v1';
const browser = await chromium.launch({ channel: 'chrome', headless: true });

// 1. Map tiles on the Lagos view.
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(BASE + '?state=LA', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(5000);
  const tiles = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img.leaflet-tile')];
    return {
      total: imgs.length,
      loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      header: (document.querySelector('header')?.innerText || '').replace(/\n+/g, ' | ').slice(0, 180),
    };
  });
  console.log('lagos tiles:', JSON.stringify(tiles));
  await page.close();
}

// 2. Injected panel content.
{
  const convo = {
    version: 1,
    language: 'en',
    messages: [
      { id: 'msg-1', role: 'user', content: "What's the postcode of The Infrastructure Bank PLC?", timestamp: 1 },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'The Infrastructure Bank PLC is located at FC-02-D43-LG-01.',
        question: "What's the postcode of The Infrastructure Bank PLC?",
        grounding: 'atlas',
        engine: { provider: 'natlas', model: 'natlas', attempt: 1 },
        lookup: { postcode: 'FC-02-D43-LG-01', label: 'The Infrastructure Bank PLC', stateName: 'Federal Capital Territory', lgaName: 'Abuja Municipal', verified: true },
        timestamp: 2,
      },
    ],
  };
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(convo)]);
  await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);
  const open = page.getByRole('button', { name: 'Open Ask Atlas' });
  if (await open.count()) await open.click();
  await page.waitForTimeout(700);
  const card = await page.evaluate(() => {
    const el = document.querySelector('div[class*="94vw"]');
    return el ? el.innerText.replace(/\n+/g, ' | ') : '(none)';
  });
  console.log('panel:', card.slice(0, 400));
  await page.close();
}

await browser.close();
