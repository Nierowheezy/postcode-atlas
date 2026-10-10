/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Postcode text guards shared by the client responder and the server handler.
 *
 * N-ATLAS is an 8B model that occasionally manufactures a postcode no tool
 * returned (for example `FC-02-11-01-01` for the Ikeja LGA, built from the
 * prompt's own example shape and the LGA code). The competition rule is strict:
 * only tool data may be shown, so a code with no backing result is dropped.
 */

/**
 * A dashed five-segment postcode as the model tends to write it. The leading
 * `[A-Z]{2}-\d{2}` is a strong state/LGA signal, so the remaining segments are
 * loose enough to catch a malformed code such as `FC-02-11-01-01`.
 */
const POSTCODE_LIKE = /\b[A-Z]{2}-\d{2}-[A-Z0-9]{1,4}-[A-Z0-9]{1,4}-\d{1,3}\b/g;

/** Every postcode-like token in a string, uppercased for comparison. */
export function postcodesIn(value: string): Set<string> {
  const found = new Set<string>();
  for (const match of value.toUpperCase().matchAll(POSTCODE_LIKE)) found.add(match[0]);
  return found;
}

/** True when `text` quotes a postcode that is absent from `allowed`. */
export function hasUnbackedPostcode(text: string, allowed: Set<string>): boolean {
  for (const code of postcodesIn(text)) {
    if (!allowed.has(code)) return true;
  }
  return false;
}

/**
 * Drop every sentence of `text` that quotes a postcode absent from `allowed`.
 * Returns the text unchanged when every code is grounded, and `fallback` when
 * nothing survives (so a wholly invented answer is never shown verbatim).
 */
export function stripUnbackedPostcodes(text: string, allowed: Set<string>, fallback: string): string {
  let changed = false;
  const sentences = text.split(/(?<=[.!?])\s+/).filter((sentence) => {
    for (const code of postcodesIn(sentence)) {
      if (!allowed.has(code)) {
        changed = true;
        return false;
      }
    }
    return true;
  });
  if (!changed) return text;

  const joined = sentences.join(' ').trim();
  return joined.length > 0 ? joined : fallback;
}
