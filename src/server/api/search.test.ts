import { describe, expect, it } from 'vitest';
import {
  NEARBY_DEFAULT_RADIUS_M,
  normalizeCoordinate,
  normalizeRadius,
  normalizeSearchQuery,
  toAutocomplete,
  toNearbyUnit,
  toNearbyUnits,
  toReverseUnit,
} from './search';

describe('normalizeSearchQuery', () => {
  it('trims a usable query', () => {
    expect(normalizeSearchQuery('  Ikeja ')).toBe('Ikeja');
  });

  it('rejects a missing, empty, or whitespace-only query', () => {
    expect(normalizeSearchQuery(null)).toBeNull();
    expect(normalizeSearchQuery('')).toBeNull();
    expect(normalizeSearchQuery('   ')).toBeNull();
  });

  it('rejects an over-long query but accepts the cap', () => {
    expect(normalizeSearchQuery('a'.repeat(64))).toBe('a'.repeat(64));
    expect(normalizeSearchQuery('a'.repeat(65))).toBeNull();
  });
});

describe('normalizeCoordinate', () => {
  it('accepts finite numbers, including negatives and decimals', () => {
    expect(normalizeCoordinate('6.6018', '3.349')).toEqual({ lat: 6.6018, lng: 3.349 });
    expect(normalizeCoordinate('-12.5', '-170')).toEqual({ lat: -12.5, lng: -170 });
  });

  it('accepts the coordinate boundaries', () => {
    expect(normalizeCoordinate('90', '180')).toEqual({ lat: 90, lng: 180 });
    expect(normalizeCoordinate('-90', '-180')).toEqual({ lat: -90, lng: -180 });
  });

  it('rejects a missing, empty, or non-numeric value', () => {
    expect(normalizeCoordinate(null, '3.3')).toBeNull();
    expect(normalizeCoordinate('6.5', null)).toBeNull();
    expect(normalizeCoordinate('', '3.3')).toBeNull();
    expect(normalizeCoordinate('   ', '3.3')).toBeNull();
    expect(normalizeCoordinate('abc', '3.3')).toBeNull();
    expect(normalizeCoordinate('NaN', '3.3')).toBeNull();
  });

  it('rejects an out-of-range value', () => {
    expect(normalizeCoordinate('90.1', '0')).toBeNull();
    expect(normalizeCoordinate('0', '180.1')).toBeNull();
  });
});

describe('normalizeRadius', () => {
  it('defaults an absent or empty radius', () => {
    expect(normalizeRadius(null)).toBe(NEARBY_DEFAULT_RADIUS_M);
    expect(normalizeRadius('')).toBe(NEARBY_DEFAULT_RADIUS_M);
    expect(normalizeRadius('   ')).toBe(NEARBY_DEFAULT_RADIUS_M);
  });

  it('accepts an integer within range', () => {
    expect(normalizeRadius('1')).toBe(1);
    expect(normalizeRadius('300')).toBe(300);
  });

  it('rejects zero, an over-cap value, a negative, and a non-integer', () => {
    expect(normalizeRadius('0')).toBeNull();
    expect(normalizeRadius('301')).toBeNull();
    expect(normalizeRadius('-5')).toBeNull();
    expect(normalizeRadius('12.5')).toBeNull();
    expect(normalizeRadius('abc')).toBeNull();
  });
});

describe('toAutocomplete', () => {
  it('maps a full body', () => {
    expect(
      toAutocomplete({
        segment: 'state',
        suggestions: [{ code: 'LA', label: 'Lagos' }, { code: 'AB' }],
      })
    ).toEqual({
      segment: 'state',
      suggestions: [{ code: 'LA', label: 'Lagos' }, { code: 'AB' }],
    });
  });

  it('defaults a missing segment and a missing or non-array suggestion list', () => {
    expect(toAutocomplete({})).toEqual({ segment: 'state', suggestions: [] });
    expect(toAutocomplete({ segment: 'lga', suggestions: null })).toEqual({
      segment: 'lga',
      suggestions: [],
    });
  });

  it('drops non-object and code-less suggestions and trims values', () => {
    expect(
      toAutocomplete({
        segment: 'lga',
        suggestions: [null, 'x', { label: 'no code' }, { code: '  11 ', label: ' Ikeja ' }],
      })
    ).toEqual({ segment: 'lga', suggestions: [{ code: '11', label: 'Ikeja' }] });
  });

  it('survives a non-object body', () => {
    expect(toAutocomplete(null)).toEqual({ segment: 'state', suggestions: [] });
    expect(toAutocomplete('nope')).toEqual({ segment: 'state', suggestions: [] });
  });
});

describe('toNearbyUnit', () => {
  it('maps a full unit and flips the geometry to { lat, lng }', () => {
    expect(
      toNearbyUnit({
        postcode: 'LA-11-A12-AK-08',
        display: 'LA 11 A12 AK 08',
        compact: 'LA11A12AK08',
        state: 'LA',
        state_name: 'Lagos',
        lga: '11',
        lga_name: 'Ikeja',
        district: 'A12',
        area: 'AK',
        unit: '08',
        point_geometry: { coordinates: [3.349, 6.6018] },
        distance_m: 12.5,
        address: '12 Adeola Street',
      })
    ).toEqual({
      code: 'LA-11-A12-AK-08',
      display: 'LA 11 A12 AK 08',
      compact: 'LA11A12AK08',
      state: 'LA',
      stateName: 'Lagos',
      lga: '11',
      lgaName: 'Ikeja',
      district: 'A12',
      area: 'AK',
      unit: '08',
      coordinates: { lat: 6.6018, lng: 3.349 },
      distanceMetres: 12.5,
      address: '12 Adeola Street',
    });
  });

  it('canonicalizes the code and derives display and compact when absent', () => {
    expect(toNearbyUnit({ postcode: 'la11a12ak08' })).toEqual({
      code: 'LA-11-A12-AK-08',
      display: 'LA 11 A12 AK 08',
      compact: 'LA11A12AK08',
    });
  });

  it('falls back to a plain coordinates field', () => {
    expect(toNearbyUnit({ code: 'LA-11-A12-AK-08', coordinates: [3.3, 6.6] })).toMatchObject({
      coordinates: { lat: 6.6, lng: 3.3 },
    });
  });

  it('drops a non-object or code-less unit', () => {
    expect(toNearbyUnit(null)).toBeNull();
    expect(toNearbyUnit('LA-11-A12-AK-08')).toBeNull();
    expect(toNearbyUnit({ display: 'no code' })).toBeNull();
    expect(toNearbyUnit({ postcode: '   ' })).toBeNull();
  });
});

describe('toNearbyUnits', () => {
  it('maps an array and drops junk entries', () => {
    expect(
      toNearbyUnits([
        { postcode: 'LA-11-A12-AK-08' },
        null,
        { display: 'no code' },
        { postcode: 'FC-02-D43-LG-01' },
      ])
    ).toEqual([
      { code: 'LA-11-A12-AK-08', display: 'LA 11 A12 AK 08', compact: 'LA11A12AK08' },
      { code: 'FC-02-D43-LG-01', display: 'FC 02 D43 LG 01', compact: 'FC02D43LG01' },
    ]);
  });

  it('returns an empty list for a non-array body', () => {
    expect(toNearbyUnits(null)).toEqual([]);
    expect(toNearbyUnits({ data: [] })).toEqual([]);
  });
});

describe('toReverseUnit', () => {
  const point = { lat: 6.6018, lng: 3.349 };

  it('maps a hit, echoing the query point and reading top-level fallbacks', () => {
    expect(
      toReverseUnit(
        {
          found: true,
          state: 'LA',
          district: 'A12',
          area: 'AK',
          unit: {
            postcode: 'LA-11-A12-AK-08',
            display: 'LA 11 A12 AK 08',
            state_name: 'Lagos',
            lga_name: 'Ikeja',
            address: '12 Adeola Street',
            distance_m: 42,
          },
        },
        point
      )
    ).toEqual({
      code: 'LA-11-A12-AK-08',
      display: 'LA 11 A12 AK 08',
      compact: 'LA11A12AK08',
      coordinates: point,
      state: 'LA',
      stateName: 'Lagos',
      lgaName: 'Ikeja',
      district: 'A12',
      area: 'AK',
      address: '12 Adeola Street',
      distanceMetres: 42,
    });
  });

  it('returns null unless found is exactly true', () => {
    expect(toReverseUnit({ found: false }, point)).toBeNull();
    expect(toReverseUnit({ unit: { postcode: 'LA-11-A12-AK-08' } }, point)).toBeNull();
    expect(toReverseUnit(null, point)).toBeNull();
    expect(toReverseUnit('nope', point)).toBeNull();
  });

  it('returns null when a found body carries no usable postcode', () => {
    expect(toReverseUnit({ found: true, unit: {} }, point)).toBeNull();
  });

  it('falls back to the top-level area when the unit has no postcode', () => {
    expect(toReverseUnit({ found: true, area: 'AK' }, point)).toMatchObject({
      code: 'AK',
      coordinates: point,
    });
  });
});
