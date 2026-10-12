/**
 * Ask Atlas evaluation benchmark (build-plan feature 13).
 *
 * Drives the real Ask Atlas chat UI in a browser against a running Atlas dev
 * server (or any ATLAS_URL), sends a battery of representative Nigerian
 * queries, and checks each reply for:
 *
 *   1. the competition rule - only N-ATLAS answers (provider === "natlas");
 *   2. the grounding invariant - never invent a postcode: a dashed postcode
 *      must be backed by a "Verified against NIPOST postcode data" reply;
 *   3. intent - the right family of answer (map, list, decode, refusal,
 *      small-talk, or an honest "no single postcode" clarification);
 *   4. follow-up context - "its" resolves to the previous place.
 *
 * It is read-only: it never deploys, commits, or writes outside the report
 * files it prints. Usage:
 *
 *   npm run dev            # in one terminal (serves /api/ask + the UI)
 *   node scripts/eval-atlas.mjs
 *
 * Env:
 *   ATLAS_URL   base URL of the Atlas app (default http://localhost:3001/)
 *   HEADFUL=1   run with a visible browser window
 *   CASE=10,12  run only the listed case numbers
 *   EVAL_REPORT report path base, default scripts/eval-report (.md/.json
 *               appended); set to /tmp/... to benchmark production without
 *               overwriting the committed local report
 */

import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.ATLAS_URL || 'http://localhost:3001/';
const REPORT_BASE = process.env.EVAL_REPORT || 'scripts/eval-report';
const HEADFUL = process.env.HEADFUL === '1';
const ONLY = (process.env.CASE || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map(Number);

const INPUT = 'input[placeholder="Ask about a place or postcode..."]';
const POSTCODE_RE = /\b[A-Z]{2}-\d{2}-[A-Z0-9]{3}-[A-Z]{2}-\d{2}\b/g;
const VERIFIED = /Verified against NIPOST postcode data/i;
const UNVERIFIED = /Not verified against NIPOST data/i;
const FROM_TOOLS = /Answered from NIPOST tool results/i;
const MAP_MOVED = /Map moved using NIPOST location data/i;

const postcodes = (text) => {
  const found = text.match(POSTCODE_RE) || [];
  return [...new Set(found)];
};
const hasVerified = (r) => VERIFIED.test(r.full);
const hasToolResults = (r) => FROM_TOOLS.test(r.full);
const groundingLabel = (r) =>
  VERIFIED.test(r.full)
    ? 'Verified against NIPOST'
    : MAP_MOVED.test(r.full)
      ? 'Map moved (NIPOST location data)'
      : FROM_TOOLS.test(r.full)
        ? 'Answered from NIPOST tool results'
        : UNVERIFIED.test(r.full)
          ? 'Not verified'
          : 'No data footer';
const noInvented = (r) => postcodes(r.reply).length === 0 || hasVerified(r);
const isNatlas = (r) => /natlas\s*·\s*try\s*\d+/i.test(r.meter);

// --- case definitions -------------------------------------------------------
// check(reply, ctx) -> true | string (string = failure reason)
const cases = [
  {
    n: 1,
    name: 'Postcode for Ikeja, Lagos',
    text: 'What is the postcode for Ikeja, Lagos?',
    expect: 'honest LGA answer, no invented postcode',
    check: (r) => isNatlas(r) || `provider not natlas (${r.meter})`,
    check2: (r) => noInvented(r) || `invented postcode: ${postcodes(r.reply).join(', ')}`,
  },
  {
    n: 2,
    name: 'List the LGAs in Kano',
    text: 'List the LGAs in Kano',
    expect: 'grounded LGA list for Kano',
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) => /kano/i.test(r.listText) || /LGAs?/i.test(r.listText) || 'no Kano LGA list',
    check3: (r) => noInvented(r) || 'invented postcode in list answer',
  },
  {
    n: 3,
    name: 'Show Kano state on the map',
    text: 'Show me Kano state on the map',
    expect: 'map frames Kano (breadcrumb + zoom change)',
    map: { state: 'Kano', zoomMin: 7 },
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) => noInvented(r) || 'invented postcode on map request',
  },
  {
    n: 4,
    name: 'Decode FC-02-D43-LG-01',
    text: 'Decode FC-02-D43-LG-01',
    expect: 'five-part NDAPS breakdown',
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) =>
      /state|lga|district|area|unit|decode/i.test(r.full) || 'no structural breakdown',
  },
  {
    n: 5,
    name: 'Where is Wuse 2?',
    text: 'Where is Wuse 2?',
    expect: 'Abuja/FCT location, grounded or honest',
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) => noInvented(r) || 'invented postcode',
  },
  {
    n: 6,
    name: 'Landmark postcode lookup',
    text: 'What is the postcode of The Infrastructure Bank PLC?',
    expect: 'verified landmark postcode or honest',
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) => noInvented(r) || 'unverified postcode presented',
  },
  {
    n: 7,
    name: 'Show Lagos on the map',
    text: 'Show me Lagos on the map',
    expect: 'map frames Lagos (breadcrumb + zoom change)',
    map: { state: 'Lagos', zoomMin: 7 },
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) => noInvented(r) || 'invented postcode on map request',
  },
  {
    n: 8,
    name: 'Greeting',
    text: 'hello',
    expect: 'friendly, no tool call, no data',
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) => (!hasToolResults(r) ? true : 'greeting triggered a tool call'),
    check3: (r) => noInvented(r) || 'greeting invented a postcode',
  },
  {
    n: 9,
    name: 'Out-of-scope question',
    text: "What's the weather in Lagos today?",
    expect: 'graceful refusal, no invented data',
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) =>
      /cannot|can't|can not|unable|only|sorry|outside|not able|Nigerian postcode/i.test(r.reply) ||
      'no refusal language',
    check3: (r) => noInvented(r) || 'refusal invented a postcode',
  },
  // --- ambiguity handling (feature 12) --------------------------------------
  {
    n: 10,
    name: 'Ambiguous: "Lagos"',
    text: 'Lagos',
    expect: 'resolves or asks; never a fake postcode',
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) => noInvented(r) || `invented postcode for Lagos: ${postcodes(r.reply).join(', ')}`,
  },
  {
    n: 11,
    name: 'Ambiguous: "Port Harcourt"',
    text: 'Port Harcourt',
    expect: 'honest city/LGA answer',
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) => noInvented(r) || 'invented postcode',
  },
  {
    n: 12,
    name: 'Ambiguous: "Wuse"',
    text: 'Wuse',
    expect: 'narrows or resolves; no invented postcode',
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) => noInvented(r) || 'invented postcode',
  },
  {
    n: 13,
    name: 'Bare LGA: "Ikeja"',
    text: 'Ikeja',
    expect: 'asks for a specific area, no invented postcode',
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) => noInvented(r) || 'invented postcode for Ikeja',
  },
  {
    n: 14,
    name: 'Ambiguous: "Delta"',
    text: 'Delta',
    expect: 'state, not a postcode',
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) => noInvented(r) || 'invented postcode for Delta',
  },
  {
    n: 15,
    name: 'Postcode for Lagos state',
    text: 'What is the postcode for Lagos state?',
    expect: 'says a state has no single postcode',
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) => /lagos/i.test(r.full) || 'did not address Lagos',
    check3: (r) =>
      noInvented(r) || `state given a postcode: ${postcodes(r.reply).join(', ')}`,
  },
  {
    n: 16,
    name: 'Follow-up: "what are its districts?"',
    turns: ['List the LGAs in Kano', 'what are its districts?'],
    expect: 'resolves "its" to Kano',
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) =>
      /kano|district/i.test(r.full) || 'follow-up did not resolve to Kano',
    check3: (r) => noInvented(r) || 'invented postcode',
  },
  // --- multilingual (feature 18) --------------------------------------------
  {
    n: 17,
    name: 'Yoruba: postcode for Ikeja',
    text: 'Kí ni kòòdù Ikeja?',
    language: 'Yoruba',
    expect: 'auto-detects Yoruba, no invented code, natlas',
    check: (r) => isNatlas(r) || `provider not natlas (${r.meter})`,
    check2: (r) => noInvented(r) || `invented postcode: ${postcodes(r.reply).join(', ')}`,
  },
  {
    n: 18,
    name: 'Hausa: postcode for Ikeja',
    text: 'Menene lambar gidan waya na Ikeja?',
    language: 'Hausa',
    expect: 'auto-detects Hausa, no invented code, natlas',
    check: (r) => isNatlas(r) || `provider not natlas (${r.meter})`,
    check2: (r) => noInvented(r) || `invented postcode: ${postcodes(r.reply).join(', ')}`,
  },
  {
    n: 19,
    name: 'Igbo: postcode for Ikeja',
    text: 'Gịnị bụ koodu ozi nke Ikeja?',
    language: 'Igbo',
    expect: 'auto-detects Igbo, no invented code, natlas',
    check: (r) => isNatlas(r) || `provider not natlas (${r.meter})`,
    check2: (r) => noInvented(r) || `invented postcode: ${postcodes(r.reply).join(', ')}`,
  },
  {
    n: 20,
    name: 'Yoruba greeting',
    text: 'Ẹ ku aaro',
    language: 'Yoruba',
    expect: 'small talk, no tool call',
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) => (!hasToolResults(r) ? true : 'greeting triggered a tool call'),
    check3: (r) => noInvented(r) || 'greeting invented a postcode',
  },
  {
    n: 21,
    name: 'Pidgin: postcode for Ikeja',
    text: 'Abeg, wetin be the postcode for Ikeja?',
    language: 'English',
    expect: 'Pidgin detected, English reply, grounded',
    check: (r) => isNatlas(r) || 'provider not natlas',
    check2: (r) => noInvented(r) || 'invented postcode',
  },
];

// --- browser helpers --------------------------------------------------------
async function openPanel(page) {
  const open = page.getByRole('button', { name: 'Open Ask Atlas' });
  if ((await open.count()) > 0) {
    await open.click();
    await page.waitForTimeout(500);
  }
}

async function readState(page) {
  return page.evaluate(() => {
    const inp = document.querySelector('input[placeholder="Ask about a place or postcode..."]');
    let el = inp;
    while (el && !el.querySelector('button[aria-label="Close Ask Atlas"]')) el = el.parentElement;
    const list = el ? el.querySelector('[aria-live="polite"]') : null;
    const assistants = list
      ? [...list.children].filter((c) => /natlas\s*·\s*try/i.test(c.innerText || ''))
      : [];
    const last = assistants[assistants.length - 1];
    let meter = '',
      reply = '';
    if (last) {
      for (const s of last.querySelectorAll('span')) {
        const t = s.textContent || '';
        if (/natlas\s*·\s*try/i.test(t)) meter = t;
      }
      const rs = last.querySelector('span.whitespace-pre-wrap');
      reply = rs ? rs.textContent.trim() : (last.innerText || '').trim();
    }
    const body = document.body.innerText;
    const zm = body.match(/Z:\s*([\d.]+)/);
    const nig = [...document.querySelectorAll('button')].find(
      (b) => (b.textContent || '').trim() === 'Nigeria',
    );
    return {
      meter,
      reply,
      full: last ? last.innerText : '',
      listText: list ? list.innerText : '',
      breadcrumb: nig && nig.parentElement ? (nig.parentElement.innerText || '').replace(/\s+/g, ' ').trim() : '',
      zoom: zm ? Number(zm[1]) : null,
    };
  });
}

async function sendTurn(page, text) {
  const input = page.locator(INPUT);
  await input.fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();
  let last = '';
  let stable = 0;
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(1000);
    const s = await readState(page);
    const busy = /Generating a reply|Connecting to N-ATLAS|Finding the location|Understanding your request/i.test(
      s.full + s.listText,
    );
    const now = s.listText + '|' + s.reply;
    if (!busy && now === last) {
      stable += 1;
      if (stable >= 2) return readState(page);
    } else {
      stable = 0;
    }
    last = now;
  }
  return readState(page);
}

// --- run --------------------------------------------------------------------
const browser = await chromium.launch({ channel: 'chrome', headless: !HEADFUL });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });

const results = [];
for (const c of cases) {
  if (ONLY.length > 0 && !ONLY.includes(c.n)) continue;
  const turns = c.turns || [c.text];
  // Fresh session per case (except multi-turn cases keep their own history).
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await openPanel(page);

  const before = await readState(page);
  let state;
  for (const t of turns) {
    state = await sendTurn(page, t);
    // An empty reply (no text and no grounding meter) is an infrastructure
    // hiccup - a cold model, a dropped stream - not a wrong answer. Retry the
    // same turn once so the benchmark scores capability, not flakiness.
    if (!state.reply && !state.meter) {
      await page.waitForTimeout(600);
      state = await sendTurn(page, t);
    }
    await page.waitForTimeout(400);
  }
  const after = await readState(page);

  const checks = [c.check, c.check2, c.check3].filter(Boolean);
  const failures = [];
  for (const fn of checks) {
    const out = fn(after, { before, after, case: c });
    if (out !== true) failures.push(out);
  }
  // Multilingual cases assert the chip's Auto mode resolved to the expected
  // reply language, which the bubble shows as "Auto · <language>".
  if (c.language) {
    const label = `Auto · ${c.language}`;
    if (!after.full.includes(label)) failures.push(`no auto-detect label "${label}"`);
  }
  // Map cases also assert the map actually framed the requested state: the
  // top-bar breadcrumb gains the state name and the zoom leaves the national
  // default (6.0).
  if (c.map) {
    const crumbs = after.breadcrumb || '';
    if (!new RegExp(c.map.state, 'i').test(crumbs))
      failures.push(`breadcrumb "${crumbs}" did not include ${c.map.state}`);
    if (c.map.zoomMin && !(after.zoom && after.zoom >= c.map.zoomMin))
      failures.push(`zoom ${after.zoom} below ${c.map.zoomMin}`);
  }

  const pass = failures.length === 0;
  results.push({ n: c.n, name: c.name, expect: c.expect, pass, failures, grounding: groundingLabel(after), meter: after.meter, reply: after.reply });
  console.log(`${pass ? 'PASS' : 'FAIL'}  #${c.n}  ${c.name}`);
  if (!pass) failures.forEach((f) => console.log(`        - ${f}`));
  else console.log(`        ${groundingLabel(after)} · ${after.meter.replace(/\s+/g, ' ')}`);
}

await browser.close();

// --- report -----------------------------------------------------------------
const passed = results.filter((r) => r.pass).length;
const lines = [];
lines.push('# Ask Atlas evaluation benchmark');
lines.push('');
lines.push(`- Target: ${BASE}`);
lines.push(`- Date: ${new Date().toISOString()}`);
lines.push(`- Result: **${passed}/${results.length} passed**`);
lines.push('');
lines.push('| # | Case | Expectation | Result | Grounding |');
lines.push('|---|------|-------------|--------|-----------|');
for (const r of results) {
  lines.push(
    `| ${r.n} | ${r.name} | ${r.expect} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.grounding.replace(/\|/g, '/')} |`,
  );
}
lines.push('');
lines.push('## Replies');
for (const r of results) {
  lines.push('');
  lines.push(`### #${r.n} ${r.name} - ${r.pass ? 'PASS' : 'FAIL'}`);
  lines.push('');
  lines.push(`> ${r.reply.replace(/\n+/g, ' ')}`);
  if (r.failures.length) lines.push('', `Failures: ${r.failures.join('; ')}`);
}
lines.push('');

const mdPath = `${REPORT_BASE}.md`;
writeFileSync(mdPath, lines.join('\n'));
writeFileSync(`${REPORT_BASE}.json`, JSON.stringify({ target: BASE, passed, total: results.length, results }, null, 2));

console.log(`\n${passed}/${results.length} passed -> ${mdPath}`);
process.exit(passed === results.length ? 0 : 1);