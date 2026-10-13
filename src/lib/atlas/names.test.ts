/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import type { AtlasLga, AtlasState } from './dataset';
import { matchLgaName, matchStateName, trimQualifier } from './names';

/**
 * These two matchers decide whether a spoken Nigerian place name lands on a
 * real catalogue record, so the cases below characterise the behaviour the
 * tools rely on: the "Lagos State" form, the Abuja to FCT alias, codes, and a
 * clear miss. The lists are small fixtures on purpose: the matchers take the
 * catalogue as an argument, so the test stays offline and readable.
 */
const states: AtlasState[] = [
  { code: 'LA', name: 'Lagos' },
  { code: 'FC', name: 'Federal Capital Territory' },
  { code: 'KN', name: 'Kano' },
];

const lgas: AtlasLga[] = [
  { state: 'LA', code: '11', name: 'Ikeja' },
  { state: 'FC', code: '06', name: 'Abuja Municipal' },
];

describe('trimQualifier', () => {
  it('trims a trailing qualifier, case-insensitively', () => {
    expect(trimQualifier('Lagos State', 'state')).toBe('Lagos');
    expect(trimQualifier('lagos state', 'state')).toBe('lagos');
    expect(trimQualifier('Ikeja LGA', 'lga')).toBe('Ikeja');
  });

  it('leaves a bare name alone and trims surrounding space', () => {
    expect(trimQualifier('  Lagos ', 'state')).toBe('Lagos');
  });
});

describe('matchStateName', () => {
  it('matches the plain name and the "State" form', () => {
    expect(matchStateName(states, 'Lagos')?.code).toBe('LA');
    expect(matchStateName(states, 'Lagos State')?.code).toBe('LA');
  });

  it('ignores case', () => {
    expect(matchStateName(states, 'kano state')?.code).toBe('KN');
  });

  it('matches the state code', () => {
    expect(matchStateName(states, 'FC')?.name).toBe('Federal Capital Territory');
  });

  it('resolves the Abuja aliases to the FCT record', () => {
    for (const alias of ['Abuja', 'FCT', 'Abuja FCT', 'Federal Capital']) {
      expect(matchStateName(states, alias)?.code, `${alias} should resolve`).toBe('FC');
    }
  });

  it('returns undefined for a name the catalogue does not hold', () => {
    expect(matchStateName(states, 'Nowhere')).toBeUndefined();
  });

  it('does not treat a city as its own state', () => {
    expect(matchStateName(states, 'Ikeja')).toBeUndefined();
  });
});

describe('matchLgaName', () => {
  it('matches the LGA name and the "LGA" form', () => {
    expect(matchLgaName(lgas, 'Ikeja')?.code).toBe('11');
    expect(matchLgaName(lgas, 'Ikeja LGA')?.code).toBe('11');
  });

  it('matches the LGA code and ignores case', () => {
    expect(matchLgaName(lgas, '06')?.name).toBe('Abuja Municipal');
    expect(matchLgaName(lgas, 'abuja municipal')?.code).toBe('06');
  });

  it('returns undefined for an LGA that is not in the resolved state list', () => {
    expect(matchLgaName(lgas, 'Fagge')).toBeUndefined();
  });
});
