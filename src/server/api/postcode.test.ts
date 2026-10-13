import { describe, expect, it } from 'vitest';
import { normalizePostcodeCode, toPostcodeRecord } from './postcode';

describe('normalizePostcodeCode', () => {
  it('accepts the dashed, spaced, and compact forms', () => {
    expect(normalizePostcodeCode('LA-11-A12-AK-08')).toBe('LA-11-A12-AK-08');
    expect(normalizePostcodeCode('LA 11 A12 AK 08')).toBe('LA-11-A12-AK-08');
    expect(normalizePostcodeCode('LA11A12AK08')).toBe('LA-11-A12-AK-08');
  });

  it('accepts the compact form in lower case', () => {
    expect(normalizePostcodeCode('la11a12ak08')).toBe('LA-11-A12-AK-08');
  });

  it('rejects anything that is not a well-formed postcode', () => {
    expect(normalizePostcodeCode('')).toBeNull();
    expect(normalizePostcodeCode('Ikeja')).toBeNull();
    expect(normalizePostcodeCode('LA-11')).toBeNull();
    expect(normalizePostcodeCode('12345678901')).toBeNull();
  });
});

describe('toPostcodeRecord', () => {
  it('maps a full NDAPS lookup body into the public record', () => {
    const record = toPostcodeRecord('LA-11-A12-AK-08', {
      postcode: 'LA-11-A12-AK-08',
      valid: true,
      verified: true,
      status: 'active',
      building_use_status: 'residential',
      recent_house_address: { recent: '12 Adeola Street' },
      administrative_address: { locality_name: 'Ikeja' },
      point_geometry: { coordinates: [3.349, 6.6018] },
    });

    expect(record).toEqual({
      code: 'LA-11-A12-AK-08',
      display: 'LA 11 A12 AK 08',
      compact: 'LA11A12AK08',
      segments: { state: 'LA', lga: '11', district: 'A12', area: 'AK', unit: '08' },
      coordinates: { lat: 6.6018, lng: 3.349 },
      address: '12 Adeola Street',
      locality: 'Ikeja',
      buildingUse: 'residential',
      status: 'active',
      valid: true,
      verified: true,
      source: 'nipost-ndaps',
    });
  });

  it('defaults valid to true and verified to false, and omits missing optionals', () => {
    expect(toPostcodeRecord('FC-02-D43-LG-01', {})).toEqual({
      code: 'FC-02-D43-LG-01',
      display: 'FC 02 D43 LG 01',
      compact: 'FC02D43LG01',
      segments: { state: 'FC', lga: '02', district: 'D43', area: 'LG', unit: '01' },
      valid: true,
      verified: false,
      source: 'nipost-ndaps',
    });
  });

  it('honours an upstream `valid: false` and ignores a malformed geometry', () => {
    const record = toPostcodeRecord('FC-02-D43-LG-01', {
      valid: false,
      point_geometry: { coordinates: ['x', 'y'] },
    });

    expect(record.valid).toBe(false);
    expect(record.coordinates).toBeUndefined();
  });

  it('survives a non-object body', () => {
    expect(toPostcodeRecord('FC-02-D43-LG-01', null).valid).toBe(true);
    expect(toPostcodeRecord('FC-02-D43-LG-01', 'nope').code).toBe('FC-02-D43-LG-01');
  });
});
