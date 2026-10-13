/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reference hierarchy mapping for the developer API (feature 21b).
 *
 * NDAPS serves the addressing hierarchy - state, LGA, district, area - as flat
 * reference lists. The public API exposes those lists with validated, normalized
 * path parameters and one stable shape. The browser client does the same work in
 * `src/lib/api/postcodeClient.ts`, which is browser-only, so the public API gets
 * its own pure mapping here.
 */

/**
 * One entry in a reference list, the shape every hierarchy route returns.
 * Load-bearing for features 21c and 22 - keep the field names and meanings
 * stable.
 */
export interface AtlasNamedCode {
  /** Canonical NDAPS code for the level, for example `LA`, `11`, or `A12`. */
  code: string;
  /**
   * Human-readable name. Present for states and LGAs; absent for districts and
   * areas, which NDAPS serves code-only.
   */
  name?: string;
}

/** The four reference levels, in hierarchy order. */
export type ReferenceLevel = 'state' | 'lga' | 'district' | 'area';

/**
 * Path-param shape for each level. These mirror the segment shapes of
 * `POSTCODE_PATTERN` in `src/lib/atlas/postcodeCode.ts`; the two are tied
 * together by a consistency test so they cannot drift.
 */
const REFERENCE_PATTERNS: Record<ReferenceLevel, RegExp> = {
  state: /^[A-Z]{2}$/,
  lga: /^\d{2}$/,
  district: /^[A-Z0-9]{3}$/,
  area: /^[A-Z]{2}$/,
};

/**
 * Canonicalize one path parameter for its level: trim, upper-case, and check the
 * shape. Returns the canonical value, or `null` when malformed. State and
 * district are case-insensitive so `la` and `LA` behave the same.
 */
export function normalizeReferenceParam(level: ReferenceLevel, value: string): string | null {
  const canonical = value.trim().toUpperCase();
  return REFERENCE_PATTERNS[level].test(canonical) ? canonical : null;
}

/** NDAPS names the list field per level; the mapper reads this key. */
export const REFERENCE_LIST_KEY: Record<ReferenceLevel, string> = {
  state: 'states',
  lga: 'lgas',
  district: 'districts',
  area: 'areas',
};

/** The NDAPS reference path that answers each level. */
export const REFERENCE_PATH: Record<ReferenceLevel, string> = {
  state: '/v1/reference/states',
  lga: '/v1/reference/lgas',
  district: '/v1/reference/districts',
  area: '/v1/reference/areas',
};

/**
 * Map one NDAPS reference body into the public list.
 *
 * `raw` is the already-unwrapped body (`{ states }`, `{ lgas }`, `{ districts }`,
 * or `{ areas }`) and `key` is its list field, normally
 * `REFERENCE_LIST_KEY[level]`. A missing or non-array field yields an empty list,
 * and entries without a usable code are dropped, so a malformed upstream body
 * degrades to an empty list rather than throwing.
 */
export function toNamedCodes(raw: unknown, key: string): AtlasNamedCode[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const list = (raw as Record<string, unknown>)[key];
  if (!Array.isArray(list)) return [];

  const codes: AtlasNamedCode[] = [];
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue;

    const code = (entry as Record<string, unknown>).code;
    if (typeof code !== 'string' || code.trim() === '') continue;

    const name = (entry as Record<string, unknown>).name;
    codes.push(
      typeof name === 'string' && name.trim() !== ''
        ? { code: code.trim(), name: name.trim() }
        : { code: code.trim() }
    );
  }
  return codes;
}
