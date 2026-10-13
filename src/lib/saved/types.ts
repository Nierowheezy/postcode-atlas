/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The saved-discovery contract (feature 20). A saved discovery is a small,
 * client-local snapshot of something the user found: a verified postcode, a
 * discovery landmark, or a state or LGA selection. It carries only what the
 * drawer row, the map refocus, and the share link need, so the shape stays cheap
 * to persist and stable across the feature.
 */

/** The two things a discovery can be. A landmark rides the `postcode` kind. */
export const SAVED_KINDS = ['postcode', 'place'] as const;
export type SavedKind = (typeof SAVED_KINDS)[number];

export interface SavedDiscovery {
  /**
   * Dedupe key. `postcode:<CODE>` for a postcode or landmark; for a place
   * `place:<state>[-<lga>]`, falling back to `place:<lat>,<lng>` when the source
   * carries no code. Saving the same id twice is what makes the toggle remove.
   */
  id: string;
  kind: SavedKind;
  /** Primary display text: landmark name, address, postcode, LGA, or state. */
  label: string;
  /** Dashed postcode, present for a `postcode` (including discovery landmarks). */
  postcode?: string;
  /** State code and name, when known; drives the `?state=` link and reopen. */
  stateCode?: string;
  stateName?: string;
  /** LGA code and name, when the discovery is or sits inside an LGA. */
  lgaCode?: string;
  lgaName?: string;
  /** Coordinates, when the source has them. */
  lat?: number;
  lng?: number;
  /** Landmark classification from the source record, when it has one. */
  category?: string;
  /** When it was saved, as epoch milliseconds. Set by the store on insert. */
  savedAt: number;
}
