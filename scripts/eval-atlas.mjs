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
 * The case table lives in `eval/cases.mjs` and the reply checks in
 * `eval/checks.mjs`, both browser free so vitest can import and test them.
 *
 * Env:
 *   ATLAS_URL   base URL of the Atlas app (default http://localhost:3001/)
 *   HEADFUL=1   run with a visible browser window
 *   CASE=10,12  run only the listed case numbers
 *   GROUP=x,y   run only the listed groups (core, languages, regional-terms,
 *               ambiguity, tool-accuracy); combines with CASE
 *   EVAL_REPORT report path base, default scripts/eval-report (.md/.json
 *               appended); set to /tmp/... to benchmark production without
 *               overwriting the committed local report
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { cases } from './eval/cases.mjs';
import { groundingLabel, runChecks } from './eval/checks.mjs';

const BASE = process.env.ATLAS_URL || 'http://localhost:3001/';
const REPORT_BASE = process.env.EVAL_REPORT || 'scripts/eval-report';
const HEADFUL = process.env.HEADFUL === '1';
const ONLY = (process.env.CASE || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map(Number);
const GROUPS = (process.env.GROUP || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const INPUT = 'input[placeholder="Ask about a place or postcode..."]';

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
  if (GROUPS.length > 0 && !GROUPS.includes(c.group)) continue;
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

  // The pass/fail logic lives in scripts/eval/checks.mjs so it can be tested
  // offline; the runner only drives the browser and writes the report.
  const failures = runChecks(c, after, before);

  const pass = failures.length === 0;
  results.push({
    n: c.n,
    name: c.name,
    group: c.group || 'core',
    expectTool: c.expectTool || 'none',
    expect: c.expect,
    pass,
    failures,
    grounding: groundingLabel(after),
    meter: after.meter,
    reply: after.reply,
  });
  console.log(`${pass ? 'PASS' : 'FAIL'}  #${c.n}  ${c.name}`);
  if (!pass) failures.forEach((f) => console.log(`        - ${f}`));
  else console.log(`        ${groundingLabel(after)} · ${after.meter.replace(/\s+/g, ' ')}`);
}

await browser.close();

// --- report -----------------------------------------------------------------
const passed = results.filter((r) => r.pass).length;
const mdPath = `${REPORT_BASE}.md`;
const jsonPath = `${REPORT_BASE}.json`;

// Read the report the last run left behind. Compare only when it recorded the
// same target: diffing a production run against local results would invent
// regressions that are really just a different environment.
let previous = null;
try {
  previous = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch {
  previous = null;
}
const sameTarget = Boolean(previous && previous.target === BASE);
const regressions = [];
const fixed = [];
if (sameTarget) {
  const before = new Map((previous.results || []).map((r) => [r.n, r]));
  for (const r of results) {
    const was = before.get(r.n);
    if (!was) continue;
    if (was.pass && !r.pass) regressions.push(r.n);
    if (!was.pass && r.pass) fixed.push(r.n);
  }
}

const groups = {};
for (const r of results) {
  const g = (groups[r.group] = groups[r.group] || { passed: 0, total: 0 });
  g.total += 1;
  if (r.pass) g.passed += 1;
}

const lines = [];
lines.push('# Ask Atlas evaluation benchmark');
lines.push('');
lines.push(`- Target: ${BASE}`);
lines.push(`- Date: ${new Date().toISOString()}`);
lines.push(`- Result: **${passed}/${results.length} passed**`);
lines.push('');
lines.push('| Group | Passed | Total |');
lines.push('|-------|--------|-------|');
for (const [name, g] of Object.entries(groups)) {
  lines.push(`| ${name} | ${g.passed} | ${g.total} |`);
}
lines.push('');
lines.push('| # | Case | Expectation | Result | Grounding |');
lines.push('|---|------|-------------|--------|-----------|');
for (const r of results) {
  lines.push(
    `| ${r.n} | ${r.name} | ${r.expect} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.grounding.replace(/\|/g, '/')} |`,
  );
}
lines.push('');
lines.push('## Changes since the last run');
lines.push('');
if (!sameTarget) {
  lines.push('No baseline: no previous report for this target.');
} else if (regressions.length === 0 && fixed.length === 0) {
  lines.push('No change for the cases in both runs.');
} else {
  if (regressions.length) lines.push(`- Regressions: ${regressions.map((n) => `#${n}`).join(', ')}`);
  if (fixed.length) lines.push(`- Fixed: ${fixed.map((n) => `#${n}`).join(', ')}`);
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

writeFileSync(mdPath, lines.join('\n'));
writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      target: BASE,
      date: new Date().toISOString(),
      passed,
      total: results.length,
      groups,
      regressions,
      fixed,
      results,
    },
    null,
    2,
  ),
);

console.log('\nBy group:');
for (const [name, g] of Object.entries(groups)) console.log(`  ${name}: ${g.passed}/${g.total}`);
if (!sameTarget) {
  console.log('No baseline: no previous report for this target.');
} else {
  if (regressions.length) console.log(`REGRESSIONS: ${regressions.map((n) => `#${n}`).join(', ')}`);
  if (fixed.length) console.log(`Fixed since the last run: ${fixed.map((n) => `#${n}`).join(', ')}`);
}
console.log(`\n${passed}/${results.length} passed -> ${mdPath}`);
process.exit(passed === results.length ? 0 : 1);