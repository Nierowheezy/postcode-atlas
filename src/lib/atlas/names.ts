/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Name matching for the Atlas hierarchy (features 4-9, 17).
 *
 * A person types "Lagos State", the model says "Abuja", and a user's address
 * ends in "FCT". All three have to land on the same bundled catalogue, so the
 * tolerance lives here, once, instead of in every caller that reads a name.
 */

import type { AtlasLga, AtlasState } from './dataset';

/** Aliases people and the model use for a state that is not its official name. */
export const STATE_ALIASES: Record<string, string> = {
  abuja: 'FC',
  fct: 'FC',
  'abuja fct': 'FC',
  'federal capital': 'FC',
};

/** Trim a trailing "state"/"lga" qualifier so "Lagos State" and "Ikeja LGA" resolve. */
export function trimQualifier(value: string, qualifier: string): string {
  return value.trim().replace(new RegExp(`\\s+${qualifier}$`, 'i'), '').trim();
}

/**
 * Match a spoken state name or code against the catalogue. Tolerates the
 * "Lagos State" form and the Abuja to FCT alias, and matches the code or the
 * name, so the model's natural phrasing still lands on a real record.
 */
export function matchStateName(states: AtlasState[], wanted: string): AtlasState | undefined {
  const cleaned = trimQualifier(wanted, 'state').toLowerCase();
  const aliasCode = STATE_ALIASES[cleaned];
  return states.find(
    (state) =>
      (aliasCode !== undefined && state.code.toUpperCase() === aliasCode) ||
      state.code.toUpperCase() === cleaned.toUpperCase() ||
      state.name.toLowerCase() === cleaned,
  );
}

/** Match an LGA name or code from within an already-resolved state's list. */
export function matchLgaName(lgas: AtlasLga[], wanted: string): AtlasLga | undefined {
  const cleaned = trimQualifier(wanted, 'lga').toLowerCase();
  return lgas.find(
    (lga) => lga.code.toUpperCase() === cleaned.toUpperCase() || lga.name.toLowerCase() === cleaned,
  );
}
