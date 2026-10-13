/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Structural parsing for a pasted Nigerian address (feature 17). The parser is
 * deterministic and data-free: it only shapes and tags the text. Deciding
 * which state, LGA, or postcode a part belongs to is the resolver's job, so
 * this module stays pure and works from the address alone.
 */

import { POSTCODE_PATTERN, toDashedCode } from '../atlas/postcodeCode';
import type { AddressSegment, AddressSegmentKind, ParsedAddress } from './types';

/** Commas, semicolons, and newlines are how people stack address lines. */
const SEPARATORS = /[,;\r\n]+/;

/**
 * A dashed or compact postcode anywhere in a part. The dashed branch is held
 * together by its separators; the compact branch is bounded by word
 * characters so it cannot be a slice of a longer token. A compact candidate
 * still has to pass `POSTCODE_PATTERN` before it counts, which is what keeps
 * an 11-letter word from being read as a code.
 */
const POSTCODE_TOKEN = /([A-Z]{2}-\d{2}-[A-Z0-9]{3}-[A-Z]{2}-\d{2})|\b([A-Z0-9]{11})\b/gi;

/** Words that mark a part as a street rather than a place name. */
const STREET_TYPES = new Set([
  'close',
  'street',
  'avenue',
  'road',
  'crescent',
  'way',
  'drive',
  'lane',
  'boulevard',
  'expressway',
]);

/**
 * A leading house or building number: "12", "No. 5", "Flat 3B", "Plot 7".
 * Anchored to the start of a part, so "12 Allen Avenue" reads as a street
 * while the street name alone stays a place.
 */
const HOUSE_NUMBER =
  /^(?:(?:no|number|flat|plot|block|suite|unit|apt|apartment|house)\.?\s*)?\d+[a-z]?\b/i;

/** First code in a part that satisfies the pattern, and where it sits. */
interface PostcodeHit {
  index: number;
  length: number;
  code: string;
}

function firstPostcodeHit(part: string): PostcodeHit | null {
  POSTCODE_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = POSTCODE_TOKEN.exec(part)) !== null) {
    if (match[1]) {
      return { index: match.index, length: match[0].length, code: match[1].toUpperCase() };
    }
    const dashed = toDashedCode(match[2]);
    if (POSTCODE_PATTERN.test(dashed)) {
      return { index: match.index, length: match[0].length, code: dashed };
    }
  }
  return null;
}

/** Collapse the runs of whitespace a pasted address tends to carry. */
function normalize(part: string): string {
  return part.replace(/\s+/g, ' ').trim();
}

/** Split on the separators, normalize each part, and drop the empties. */
function toParts(raw: string): string[] {
  return raw
    .split(SEPARATORS)
    .map(normalize)
    .filter((part) => part.length > 0);
}

/** Whether any word in the part is a street-type word. */
function hasStreetType(part: string): boolean {
  return part.split(/\s+/).some((word) => STREET_TYPES.has(word.toLowerCase()));
}

/** A leading number or a street word makes the part a street, not a place. */
function classify(part: string): Exclude<AddressSegmentKind, 'postcode'> {
  return HOUSE_NUMBER.test(part) || hasStreetType(part) ? 'street' : 'place';
}

function pushSegment(segments: AddressSegment[], text: string): void {
  const cleaned = normalize(text);
  if (!cleaned) return;
  segments.push({ text: cleaned, kind: classify(cleaned) });
}

/**
 * Split an address into ordered parts, pull any postcode into its own segment
 * and the top-level `postcode` (always dashed), and classify the rest. An
 * empty or non-address string yields no segments rather than throwing: the
 * caller decides how to report that.
 */
export function parseAddressText(raw: string): ParsedAddress {
  const segments: AddressSegment[] = [];
  let postcode: string | undefined;

  for (const part of toParts(raw)) {
    const hit = firstPostcodeHit(part);
    if (!hit) {
      pushSegment(segments, part);
      continue;
    }
    pushSegment(segments, part.slice(0, hit.index));
    segments.push({ text: hit.code, kind: 'postcode' });
    postcode ??= hit.code;
    pushSegment(segments, part.slice(hit.index + hit.length));
  }

  return postcode ? { raw, segments, postcode } : { raw, segments };
}
