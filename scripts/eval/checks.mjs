/**
 * Ask Atlas evaluation checks (build-plan features 13 and 23).
 *
 * The pure half of the benchmark: reply text in, verdict out. These helpers
 * used to live inside `eval-atlas.mjs`, which imports Playwright and runs
 * top-level awaits, so no test could import them. Keeping them here, browser
 * free and side-effect free, lets vitest check the pass/fail logic itself
 * before the live run ever scores a reply.
 *
 * Keep the exported names stable: the runner and its tests both read them.
 */

export const POSTCODE_RE = /\b[A-Z]{2}-\d{2}-[A-Z0-9]{3}-[A-Z]{2}-\d{2}\b/g;
export const VERIFIED = /Verified against NIPOST postcode data/i;
export const UNVERIFIED = /Not verified against NIPOST data/i;
export const FROM_TOOLS = /Answered from NIPOST tool results/i;
export const MAP_MOVED = /Map moved using NIPOST location data/i;

export const postcodes = (text) => {
  const found = text.match(POSTCODE_RE) || [];
  return [...new Set(found)];
};
export const hasVerified = (r) => VERIFIED.test(r.full);
export const hasToolResults = (r) => FROM_TOOLS.test(r.full);
export const groundingLabel = (r) =>
  VERIFIED.test(r.full)
    ? 'Verified against NIPOST'
    : MAP_MOVED.test(r.full)
      ? 'Map moved (NIPOST location data)'
      : FROM_TOOLS.test(r.full)
        ? 'Answered from NIPOST tool results'
        : UNVERIFIED.test(r.full)
          ? 'Not verified'
          : 'No data footer';
export const noInvented = (r) => postcodes(r.reply).length === 0 || hasVerified(r);
// The guard replies for a state or LGA postcode question name no postcode at
// all. The observed failure was the model presenting the LGA short code
// (Ikeja is 11) as a postcode, so a bare number in the reply fails the case.
export const noShortCode = (r) => {
  const hit = r.reply.match(/\b\d{1,3}\b/);
  return hit ? `reply presents a short code: ${hit[0]}` : true;
};
export const isNatlas = (r) => /natlas\s*·\s*try\s*\d+/i.test(r.meter);

/**
 * Reply checks for the harder cases: they look for positive evidence of the
 * right answer path instead of only for an invented postcode.
 */

/** A decode reply should name all five NDAPS parts. */
export const SEGMENTS = ['state', 'lga', 'district', 'area', 'unit'];
export function hasSegments(r, parts = SEGMENTS) {
  const missing = parts.filter((p) => !new RegExp(`\\b${p}\\b`, 'i').test(r.full));
  return missing.length === 0 ? true : `breakdown missing: ${missing.join(', ')}`;
}

/**
 * The editorial explanation path answers from curated copy, not from a NIPOST
 * record, so it must not wear the verified footer.
 */
export const notVerified = (r) =>
  VERIFIED.test(r.full) ? 'editorial answer claims NIPOST verification' : true;

export const mentionsPlace = (r, names) =>
  names.some((n) => new RegExp(`\\b${n}\\b`, 'i').test(r.full))
    ? true
    : `reply does not mention ${names.join(' or ')}`;

/**
 * An unknown parent (a district list for a made-up place) is answered by
 * saying so, never by inventing rows or a postcode.
 */
export const HONEST_FALLBACK =
  /cannot|can't|can not|unable|sorry|don't have|do not have|no (?:matching|such|known|districts?|areas?|lgas?|results?|records?|information)|not (?:find|found|available|recognised|recognized)|could not|couldn't|does not (?:exist|have)|isn't|is not/i;
export const honestFallback = (r) =>
  HONEST_FALLBACK.test(r.full) || 'no honest fallback wording';

/**
 * Run one case's checks against the settled reply and return the failure
 * reasons, empty when the case passes. The per-case `check` functions and the
 * shared language-chip and map-framing rules are all here, so the runner only
 * drives the browser and writes the report.
 */
export function runChecks(caseDef, after, before = null) {
  const failures = [];
  const ctx = { before, after, case: caseDef };
  for (const fn of [caseDef.check, caseDef.check2, caseDef.check3].filter(Boolean)) {
    const out = fn(after, ctx);
    if (out !== true) failures.push(out);
  }
  // Multilingual cases assert the chip's Auto mode resolved to the expected
  // reply language, which the bubble shows as "Auto · <language>".
  if (caseDef.language) {
    const label = `Auto · ${caseDef.language}`;
    if (!after.full.includes(label)) failures.push(`no auto-detect label "${label}"`);
  }
  // Map cases also assert the map actually framed the requested state: the
  // top-bar breadcrumb gains the state name and the zoom leaves the national
  // default (6.0).
  if (caseDef.map) {
    const crumbs = after.breadcrumb || '';
    if (!new RegExp(caseDef.map.state, 'i').test(crumbs))
      failures.push(`breadcrumb "${crumbs}" did not include ${caseDef.map.state}`);
    if (caseDef.map.zoomMin && !(after.zoom && after.zoom >= caseDef.map.zoomMin))
      failures.push(`zoom ${after.zoom} below ${caseDef.map.zoomMin}`);
  }
  return failures;
}
