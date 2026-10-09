/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generates public/atlas-data.json: a versioned snapshot of the NDAPS
 * reference hierarchy (states + LGAs) for the client-side dataset cache
 * (feature 3a). Run once per release with `npm run dataset`.
 *
 * Scope note (measured live, 2026-10): NDAPS also exposes ~222,277 districts
 * and ~5M areas, both code-only with no human names. Storing them client-side
 * would mean a ~290 MB snapshot and an 8-12 h generation walk, so the snapshot
 * carries only the two naming levels (37 states, ~774 LGAs). District and area
 * reads resolve through the gateway read-through fallback in the atlas store.
 *
 * The snapshot is written only when every subtree was fetched, so a partial
 * run never ships, and the write is atomic (tmp file, then rename).
 */

import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { loadEnv } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };

const API_BASE = env.VITE_NIPOST_API_BASE_URL?.trim() || 'https://api.postcode.gov.ng';
const API_KEY = env.VITE_NIPOST_PUBLISHABLE_KEY?.trim() || '';

const LGA_CONCURRENCY = 6;
const RETRY_429 = 8; // rate limits can last a while; be patient
const RETRY_5XX = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Publishable-tier gateways rate-limit bursts; pace requests globally so a
// whole run rarely trips 429 in the first place.
const MIN_REQUEST_GAP_MS = 50;
let lastRequestAt = 0;
async function pace() {
  const wait = Math.max(0, lastRequestAt + MIN_REQUEST_GAP_MS - Date.now());
  lastRequestAt = Date.now() + wait;
  if (wait > 0) await sleep(wait);
}

/** One gateway GET with Retry-After-aware backoff; throws after retries. */
async function gateway(path) {
  let attempt = 0;
  for (;;) {
    await pace();
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'X-API-Key': API_KEY },
    });
    if (res.ok) {
      const json = await res.json();
      return json?.data ?? json;
    }
    attempt += 1;
    if (res.status === 429) {
      if (attempt > RETRY_429) {
        throw new Error(`gateway ${path} failed: HTTP 429 after ${RETRY_429} retries`);
      }
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : Math.min(5000 * 2 ** (attempt - 1), 120000));
      continue;
    }
    if (res.status >= 500 && attempt <= RETRY_5XX) {
      await sleep(1000 * attempt);
      continue;
    }
    throw new Error(`gateway ${path} failed: HTTP ${res.status}`);
  }
}

/** Run `fn` over items with at most `limit` calls in flight. */
async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function buildSnapshot() {
  process.stdout.write('Fetching states\n');
  const statesData = await gateway('/v1/reference/states');
  const states = (statesData?.states ?? []).map((s) => ({ code: s.code, name: s.name }));
  if (states.length === 0) throw new Error('states response was empty');

  process.stdout.write(`Fetching LGAs for ${states.length} states\n`);
  const perState = await mapConcurrent(states, LGA_CONCURRENCY, async (state) => {
    const data = await gateway(`/v1/reference/lgas?state=${encodeURIComponent(state.code)}`);
    return (data?.lgas ?? []).map((lga) => ({ state: state.code, code: lga.code, name: lga.name }));
  });
  const lgas = perState.flat();
  if (lgas.length === 0) throw new Error('lgas response was empty');

  // Districts and areas are intentionally empty (see scope note above); the
  // atlas store maps their reads to the gateway fallback.
  return {
    version: pkg.version,
    generatedAt: new Date().toISOString(),
    counts: { states: states.length, lgas: lgas.length, districts: 0, areas: 0 },
    states,
    lgas,
    districts: [],
    areas: [],
  };
}

async function main() {
  if (!API_KEY) {
    console.error('VITE_NIPOST_PUBLISHABLE_KEY is not set; add it to .env first.');
    process.exitCode = 1;
    return;
  }

  process.stdout.write('Walking the NDAPS reference API\n');
  const snapshot = await buildSnapshot();

  // Atomic: write a temp file, then rename, so a crash never leaves a partial snapshot.
  const outPath = new URL('../public/atlas-data.json', import.meta.url);
  const tmpPath = `${outPath.pathname}.tmp`;
  await mkdir(new URL('../public/', import.meta.url), { recursive: true });
  await writeFile(tmpPath, JSON.stringify(snapshot) + '\n', 'utf-8');
  await rename(tmpPath, outPath.pathname);

  const bytes = readFileSync(outPath.pathname).byteLength;
  console.log(
    `Wrote ${outPath.pathname} (${(bytes / 1024).toFixed(1)} KB) - ` +
      `${snapshot.counts.states} states, ${snapshot.counts.lgas} LGAs (v${snapshot.version})`
  );
}

main().catch((err) => {
  console.error('Dataset generation failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});