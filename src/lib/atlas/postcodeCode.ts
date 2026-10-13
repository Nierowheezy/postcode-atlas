/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared postcode codec (feature 17).
 *
 * NIPOST writes a postcode as STATE-LGA-DISTRICT-AREA-UNIT, five dashed
 * groups. People and the model also hand us the 11-character compact form.
 * Both the tool executors and the address parser need to tell a real code
 * apart from a place name, so the shape lives here rather than in either
 * caller, where the two copies would drift.
 */

/** A well-formed dashed postcode: AA-99-H77-BB-55. */
export const POSTCODE_PATTERN = /^([A-Z]{2})-(\d{2})-([A-Z0-9]{3})-([A-Z]{2})-(\d{2})$/;

/** Length of the compact form with its separators stripped. */
export const COMPACT_POSTCODE_LENGTH = 11;

/** Reinsert dashes so both `FC-02-D43-LG-01` and `FC02D43LG01` read the same. */
export function toDashedCode(input: string): string {
  const compact = input.trim().toUpperCase().replace(/[\s-]+/g, '');
  if (compact.length !== COMPACT_POSTCODE_LENGTH) return compact;

  return [
    compact.slice(0, 2),
    compact.slice(2, 4),
    compact.slice(4, 7),
    compact.slice(7, 9),
    compact.slice(9, 11),
  ].join('-');
}
