/**
 * @license
 * @generated-not-shipped
 *
 * Capture real UI stills for the demo video. Run from the repo root:
 *
 *   node video/scripts/capture-stills.mjs
 *
 * It drives the DEPLOYED app in system Chrome, injects faithful Ask Atlas
 * conversations into localStorage (so no model call is needed), and writes
 * PNGs to video/public/captures/. Point ATLAS_URL at localhost to capture a
 * local build instead.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = process.env.ATLAS_URL || 'https://nigerian-postalcode-atlas.vercel.app/';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/captures');
const KEY = 'ask-atlas:conversation:v1';
const ENGINE = { provider: 'natlas', model: 'natlas', attempt: 1 };

/** Deterministic conversation builder: [role, content, extra?]. */
const convo = (...turns) => ({
  version: 1,
  language: 'en',
  messages: turns.map(([role, content, extra], i) => ({
    id: `msg-${i + 1}`,
    role,
    content,
    timestamp: 1_700_000_000_000 + i,
    ...(extra || {}),
  })),
});

const assistant = (content, extra) => ['assistant', content, { question: content, grounding: 'atlas', engine: ENGINE, ...extra }];

const CONVERSATIONS = {
  verified: convo(
    ['user', "What's the postcode of The Infrastructure Bank PLC?"],
    assistant('The Infrastructure Bank PLC is located at FC-02-D43-LG-01.', {
      question: "What's the postcode of The Infrastructure Bank PLC?",
      lookup: {
        postcode: 'FC-02-D43-LG-01',
        label: 'The Infrastructure Bank PLC',
        stateName: 'Federal Capital Territory',
        lgaName: 'Abuja Municipal',
        verified: true,
      },
    }),
  ),
  decode: convo(
    ['user', 'Decode FC-02-D43-LG-01'],
    assistant('The postcode FC-02-D43-LG-01 reads as state FC, LGA 02, district D43, area LG, unit 01.', {
      question: 'Decode FC-02-D43-LG-01',
      decoded: {
        postcode: 'FC-02-D43-LG-01',
        compact: 'FC02D43LG01',
        display: 'FC 02 D43 LG 01',
        valid: true,
        segments: { state: 'FC', lga: '02', district: 'D43', area: 'LG', unit: '01' },
        stateName: 'Federal Capital Territory',
        lgaName: 'Abuja Municipal',
        verified: true,
      },
    }),
  ),
  refusal: convo(
    ['user', "What's the weather in Lagos today?"],
    ['assistant', "I'm sorry, I cannot help with weather information. Would you like to know the postcode for Lagos?", {
      question: "What's the weather in Lagos today?",
      grounding: 'unverified',
      engine: ENGINE,
    }],
  ),
  map: convo(
    ['user', 'Show me Lagos on the map'],
    assistant('Showing Lagos on the map.', {
      question: 'Show me Lagos on the map',
      mapAction: { target: 'state', state: { code: 'LA', name: 'Lagos' }, center: [6.5, 3.4], zoom: 9 },
    }),
  ),
  lga: convo(
    ['user', 'List the LGAs in Kano'],
    assistant('Kano State has 44 LGAs. Here are the first twelve.', {
      question: 'List the LGAs in Kano',
      results: {
        level: 'lga',
        scope: 'Kano',
        items: [
          { type: 'lga', code: '01', name: 'Ajingi' },
          { type: 'lga', code: '02', name: 'Albasu' },
          { type: 'lga', code: '03', name: 'Bagwai' },
          { type: 'lga', code: '04', name: 'Bebeji' },
          { type: 'lga', code: '05', name: 'Bichi' },
          { type: 'lga', code: '06', name: 'Bunkure' },
          { type: 'lga', code: '07', name: 'Dala' },
          { type: 'lga', code: '08', name: 'Dambatta' },
          { type: 'lga', code: '09', name: 'Dawakin Kudu' },
          { type: 'lga', code: '10', name: 'Dawakin Tofa' },
          { type: 'lga', code: '11', name: 'Doguwa' },
          { type: 'lga', code: '12', name: 'Fagge' },
        ],
        total: 44,
      },
    }),
  ),
  greeting: convo(
    ['user', 'hi'],
    assistant(
      "Hello! I'm here to help you with any Nigerian postcode or place questions. Ask me something specific, like \"What's the postcode for Ikeja?\"",
      { question: 'hi', grounding: 'atlas' },
    ),
  ),
  nearby: convo(
    ['user', 'what postcodes are near me?'],
    assistant('There are no postcodes within 300 meters of your current location. Would you like to search for a specific area or place?', {
      question: 'what postcodes are near me?',
      nearby: { origin: { lat: 9.082, lng: 8.6753 }, items: [], total: 0, radius_m: 300 },
    }),
  ),
  mixed: convo(
    ['user', "What's the postcode of The Infrastructure Bank PLC?"],
    assistant('The Infrastructure Bank PLC is located at FC-02-D43-LG-01.', {
      question: "What's the postcode of The Infrastructure Bank PLC?",
      lookup: {
        postcode: 'FC-02-D43-LG-01',
        label: 'The Infrastructure Bank PLC',
        stateName: 'Federal Capital Territory',
        lgaName: 'Abuja Municipal',
        verified: true,
      },
    }),
    ['user', 'Decode FC-02-D43-LG-01'],
    assistant('FC-02-D43-LG-01 reads as state FC, LGA 02, district D43, area LG, unit 01.', {
      question: 'Decode FC-02-D43-LG-01',
      decoded: {
        postcode: 'FC-02-D43-LG-01',
        compact: 'FC02D43LG01',
        display: 'FC 02 D43 LG 01',
        valid: true,
        segments: { state: 'FC', lga: '02', district: 'D43', area: 'LG', unit: '01' },
        stateName: 'Federal Capital Territory',
        lgaName: 'Abuja Municipal',
        verified: true,
      },
    }),
  ),
};

/** Launch a page with a theme and optional injected conversation. */
async function makePage(browser, { theme = 'light', conversation } = {}) {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([t, k, v]) => {
    localStorage.setItem('theme', t);
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  }, [theme, KEY, conversation ? JSON.stringify(conversation) : null]);
  return page;
}

async function settle(page, ms = 3500) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

async function openAsk(page) {
  const open = page.getByRole('button', { name: 'Open Ask Atlas' });
  if (await open.count()) {
    await open.click();
    await page.waitForTimeout(700);
  }
}

/** Screenshot just the Ask Atlas card. */
async function shootPanel(page, name) {
  const box = await page.evaluate(() => {
    const card = document.querySelector('div[class*="94vw"]');
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  if (!box) {
    console.warn(`  ! panel not found for ${name}`);
    return;
  }
  const pad = 12;
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    clip: {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    },
  });
  console.log(`  ✓ ${name}.png (panel ${Math.round(box.width)}x${Math.round(box.height)})`);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir(OUT, { recursive: true });

// --- full app shots ---------------------------------------------------------
for (const [name, opts] of [
  ['app-nigeria-light', { theme: 'light' }],
  ['app-nigeria-dark', { theme: 'dark' }],
  ['app-lagos-light', { theme: 'light', query: '?state=LA' }],
  ['app-lagos-dark', { theme: 'dark', query: '?state=LA' }],
]) {
  const page = await makePage(browser, { theme: opts.theme });
  await page.goto(BASE + (opts.query || ''), { waitUntil: 'domcontentloaded' });
  await settle(page, 5000);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`  ✓ ${name}.png (app)`);
  await page.close();
}

// --- panel shots ------------------------------------------------------------
for (const [name, conversation] of Object.entries(CONVERSATIONS)) {
  if (name === 'mixed') continue;
  const page = await makePage(browser, { theme: 'light', conversation });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  await openAsk(page);
  await shootPanel(page, `panel-${name}`);
  await page.close();
}

// --- full app with the panel open (hero) ------------------------------------
{
  const page = await makePage(browser, { theme: 'light', conversation: CONVERSATIONS.mixed });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  await openAsk(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'app-ask-open.png') });
  console.log('  ✓ app-ask-open.png (app + panel)');
  await page.close();
}

await browser.close();
console.log(`\nDone. Stills in ${OUT}`);
