import { describe, expect, it } from 'vitest';
import { POSTCODE_PATTERN } from '../../lib/atlas/postcodeCode';
import {
  REFERENCE_LIST_KEY,
  REFERENCE_PATH,
  normalizeReferenceParam,
  toNamedCodes,
  type ReferenceLevel,
} from './hierarchy';

const LEVELS: ReferenceLevel[] = ['state', 'lga', 'district', 'area'];

describe('normalizeReferenceParam', () => {
  it('canonicalizes case and trims whitespace', () => {
    expect(normalizeReferenceParam('state', ' la ')).toBe('LA');
    expect(normalizeReferenceParam('district', 'a12')).toBe('A12');
    expect(normalizeReferenceParam('lga', ' 11 ')).toBe('11');
    expect(normalizeReferenceParam('area', ' ak ')).toBe('AK');
  });

  it('rejects a malformed or empty value', () => {
    expect(normalizeReferenceParam('state', '')).toBeNull();
    expect(normalizeReferenceParam('state', 'LAGOS')).toBeNull();
    expect(normalizeReferenceParam('lga', 'L1')).toBeNull();
    expect(normalizeReferenceParam('district', 'AK')).toBeNull();
    expect(normalizeReferenceParam('area', 'A12')).toBeNull();
  });
});

describe('reference patterns match POSTCODE_PATTERN segments', () => {
  const match = POSTCODE_PATTERN.exec('LA-11-A12-AK-08');
  if (!match) throw new Error('fixture code must be well-formed');

  const segmentFor: Record<ReferenceLevel, string> = {
    state: match[1],
    lga: match[2],
    district: match[3],
    area: match[4],
  };

  it.each(LEVELS)('accepts a real %s segment from a well-formed postcode', (level) => {
    expect(normalizeReferenceParam(level, segmentFor[level])).toBe(segmentFor[level]);
  });

  it('rejects a value shaped like a different level', () => {
    expect(normalizeReferenceParam('state', segmentFor.lga)).toBeNull();
    expect(normalizeReferenceParam('lga', segmentFor.state)).toBeNull();
    expect(normalizeReferenceParam('district', segmentFor.area)).toBeNull();
    expect(normalizeReferenceParam('area', segmentFor.district)).toBeNull();
  });
});

describe('reference metadata', () => {
  it('names one list key and one NDAPS path per level', () => {
    expect(LEVELS.map((level) => REFERENCE_LIST_KEY[level])).toEqual([
      'states',
      'lgas',
      'districts',
      'areas',
    ]);
    expect(LEVELS.map((level) => REFERENCE_PATH[level])).toEqual([
      '/v1/reference/states',
      '/v1/reference/lgas',
      '/v1/reference/districts',
      '/v1/reference/areas',
    ]);
  });
});

describe('toNamedCodes', () => {
  it('maps state and LGA entries with codes and names', () => {
    expect(toNamedCodes({ states: [{ code: 'LA', name: 'Lagos' }] }, 'states')).toEqual([
      { code: 'LA', name: 'Lagos' },
    ]);
  });

  it('keeps code-only district and area entries', () => {
    expect(toNamedCodes({ districts: [{ code: 'A12' }] }, 'districts')).toEqual([{ code: 'A12' }]);
    expect(toNamedCodes({ areas: [{ code: 'AK' }] }, 'areas')).toEqual([{ code: 'AK' }]);
  });

  it('trims codes and names, and ignores a blank name', () => {
    expect(toNamedCodes({ lgas: [{ code: ' 11 ', name: ' Ikeja ' }] }, 'lgas')).toEqual([
      { code: '11', name: 'Ikeja' },
    ]);
    expect(toNamedCodes({ states: [{ code: ' LA ', name: '   ' }] }, 'states')).toEqual([
      { code: 'LA' },
    ]);
  });

  it('drops entries without a usable code', () => {
    expect(
      toNamedCodes(
        { states: [null, 'LA', { name: 'Lagos' }, { code: '  ' }, { code: 'LA' }] },
        'states'
      )
    ).toEqual([{ code: 'LA' }]);
  });

  it('returns an empty list for a missing, non-array, or non-object body', () => {
    expect(toNamedCodes({}, 'states')).toEqual([]);
    expect(toNamedCodes({ states: 'LA' }, 'states')).toEqual([]);
    expect(toNamedCodes(null, 'states')).toEqual([]);
    expect(toNamedCodes('nope', 'states')).toEqual([]);
  });
});
