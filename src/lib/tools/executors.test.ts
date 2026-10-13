import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * These executors answer from the Atlas store and nothing else, so stub the
 * store at the module boundary. That keeps the tests offline and focused on
 * the code, not on a live dataset or the network.
 */
const {
  storeGetPostcode,
  storeGetStates,
  storeGetLgas,
  storeGetDistricts,
  storeGetAreas,
  storeGetDiscovery,
  storeSearch,
} = vi.hoisted(() => ({
  storeGetPostcode: vi.fn(),
  storeGetStates: vi.fn(),
  storeGetLgas: vi.fn(),
  storeGetDistricts: vi.fn(),
  storeGetAreas: vi.fn(),
  storeGetDiscovery: vi.fn(),
  storeSearch: vi.fn(),
}));

/** The one network call in the executor set, stubbed so getNearby stays offline. */
const { apiFetchNearby } = vi.hoisted(() => ({ apiFetchNearby: vi.fn() }));

vi.mock('../atlas/store', () => ({
  atlasStore: {
    getPostcode: storeGetPostcode,
    getStates: storeGetStates,
    getLgas: storeGetLgas,
    getDistricts: storeGetDistricts,
    getAreas: storeGetAreas,
    getDiscoveryPoints: storeGetDiscovery,
    searchLocations: storeSearch,
  },
}));

vi.mock('../api/postcodeClient', () => ({
  postcodeApi: { fetchNearby: apiFetchNearby },
}));

import { getPostcode, interpretAddress } from './executors';
import { runTool } from './registry';

describe('getPostcode format guard', () => {
  beforeEach(() => {
    storeGetPostcode.mockReset();
    storeGetPostcode.mockResolvedValue(null);
  });

  it('rejects a malformed code before touching the store', async () => {
    await expect(getPostcode({ code: 'NG-01-001-001-001-001' })).rejects.toMatchObject({
      name: 'ToolFault',
      code: 'invalid_args',
    });
    expect(storeGetPostcode).not.toHaveBeenCalled();
  });

  it('passes a well-formed code through to the store', async () => {
    await getPostcode({ code: 'FC-02-D43-LG-01' });
    expect(storeGetPostcode).toHaveBeenCalledWith('FC-02-D43-LG-01');
  });

  it('accepts the compact 11-character form', async () => {
    await getPostcode({ code: 'FC02D43LG01' });
    expect(storeGetPostcode).toHaveBeenCalledWith('FC-02-D43-LG-01');
  });

  it('returns null for a well-formed code with no record', async () => {
    await expect(getPostcode({ code: 'FC-02-D43-LG-01' })).resolves.toBeNull();
    expect(storeGetPostcode).toHaveBeenCalledOnce();
  });
});

describe('interpretAddress', () => {
  beforeEach(() => {
    storeGetStates.mockReset().mockResolvedValue([
      { code: 'LA', name: 'Lagos' },
      { code: 'KN', name: 'Kano' },
    ]);
    storeGetLgas.mockReset().mockResolvedValue([{ state: 'LA', code: 'LA-05', name: 'Ikeja' }]);
    storeGetDiscovery.mockReset().mockResolvedValue([]);
    storeSearch.mockReset().mockResolvedValue([]);
  });

  it('places the state and LGA of a pasted address and reports the street', async () => {
    const result = await interpretAddress({ text: '12 Allen Avenue, Ikeja, Lagos' });
    expect(result.state).toEqual({ code: 'LA', name: 'Lagos' });
    expect(result.lga).toEqual({ code: 'LA-05', name: 'Ikeja' });
    expect(result.unresolved).toEqual(['12 Allen Avenue']);
    expect(result.resolvedTo).toBe('lga');
    expect(result.postcode).toBeUndefined();
  });

  it('reports honestly when only a state can be placed', async () => {
    const result = await interpretAddress({ text: 'Nowhereville, Kano' });
    expect(result.state).toEqual({ code: 'KN', name: 'Kano' });
    expect(result.unresolved).toEqual(['Nowhereville']);
    expect(result.postcode).toBeUndefined();
    expect(result.resolvedTo).toBe('state');
  });

  it('runs through runTool and rejects an empty address as invalid_args', async () => {
    await expect(runTool('interpretAddress', { text: '   ' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_args' },
    });
  });
});

describe('explainAtlas', () => {
  it('returns the curated copy for a known topic', async () => {
    const result = await runTool('explainAtlas', { topic: 'postcode_parts' });
    expect(result).toMatchObject({
      ok: true,
      data: { topic: 'postcode_parts' },
    });
    if (result.ok) {
      const explanation = result.data as { title: string; points: string[] };
      expect(explanation.title.length).toBeGreaterThan(0);
      expect(explanation.points.length).toBeGreaterThan(0);
    }
  });

  it('rejects an unknown topic at the schema boundary', async () => {
    await expect(runTool('explainAtlas', { topic: 'made_up' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_args' },
    });
  });

  it('rejects a missing topic', async () => {
    await expect(runTool('explainAtlas', {})).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_args' },
    });
  });
});

/**
 * The rest of the registry, exercised through `runTool` like the chat loop
 * does: one happy path and one failing path per tool, with the store and the
 * one gateway call stubbed at the module boundary.
 */
describe('getPostcode through runTool', () => {
  beforeEach(() => {
    storeGetPostcode.mockReset().mockResolvedValue(null);
  });

  it('answers a well-formed code, even when the record is absent', async () => {
    await expect(runTool('getPostcode', { code: 'FC-02-D43-LG-01' })).resolves.toEqual({
      ok: true,
      data: null,
    });
  });

  it('rejects a place name passed as a code', async () => {
    await expect(runTool('getPostcode', { code: 'Ikeja' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_args' },
    });
    expect(storeGetPostcode).not.toHaveBeenCalled();
  });
});

describe('searchLocation', () => {
  beforeEach(() => {
    storeSearch.mockReset();
  });

  it('returns the candidates the store found', async () => {
    storeSearch.mockResolvedValue([{ type: 'lga', code: 'LA-05', name: 'Ikeja', state: 'LA' }]);
    await expect(runTool('searchLocation', { query: 'Ikeja' })).resolves.toMatchObject({
      ok: true,
      data: [{ code: 'LA-05', name: 'Ikeja' }],
    });
    expect(storeSearch).toHaveBeenCalledWith('Ikeja');
  });

  it('rejects a blank query at the schema boundary', async () => {
    await expect(runTool('searchLocation', { query: '   ' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_args' },
    });
    expect(storeSearch).not.toHaveBeenCalled();
  });
});

describe('getStates', () => {
  it('lists the whole state catalogue', async () => {
    storeGetStates.mockReset().mockResolvedValue([{ code: 'LA', name: 'Lagos' }]);
    await expect(runTool('getStates', {})).resolves.toEqual({
      ok: true,
      data: [{ code: 'LA', name: 'Lagos' }],
    });
  });
});

describe('getState', () => {
  beforeEach(() => {
    storeGetStates.mockReset().mockResolvedValue([
      { code: 'FC', name: 'Federal Capital Territory' },
      { code: 'KN', name: 'Kano' },
      { code: 'LA', name: 'Lagos' },
    ]);
  });

  it('adds the geo summary for a resolved state', async () => {
    await expect(runTool('getState', { state: 'Lagos State' })).resolves.toMatchObject({
      ok: true,
      data: {
        code: 'LA',
        name: 'Lagos',
        capital: 'Ikeja',
        zone: 'South West',
        center: [6.5244, 3.3792],
        zoom: 10,
        lgaCount: 20,
      },
    });
  });

  it('resolves the Abuja alias to the FCT record', async () => {
    await expect(runTool('getState', { state: 'Abuja' })).resolves.toMatchObject({
      ok: true,
      data: { code: 'FC', name: 'Federal Capital Territory', capital: 'Abuja' },
    });
  });

  it('returns not_found for a name the catalogue does not hold', async () => {
    await expect(runTool('getState', { state: 'Nowhereville' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
  });
});

describe('getLgas', () => {
  beforeEach(() => {
    storeGetStates.mockReset().mockResolvedValue([{ code: 'KN', name: 'Kano' }]);
    storeGetLgas.mockReset().mockResolvedValue([{ state: 'KN', code: 'KN-10', name: 'Fagge' }]);
  });

  it('lists the LGAs of a resolved state', async () => {
    await expect(runTool('getLgas', { state: 'kano state' })).resolves.toMatchObject({
      ok: true,
      data: [{ code: 'KN-10', name: 'Fagge' }],
    });
    expect(storeGetLgas).toHaveBeenCalledWith('KN');
  });

  it('returns not_found for a state the catalogue does not hold', async () => {
    storeSearch.mockReset().mockResolvedValue([]);
    await expect(runTool('getLgas', { state: 'Nowhereville' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
  });
});

describe('getDistricts', () => {
  beforeEach(() => {
    storeGetStates.mockReset().mockResolvedValue([{ code: 'LA', name: 'Lagos' }]);
    storeGetLgas.mockReset().mockResolvedValue([{ state: 'LA', code: 'LA-05', name: 'Ikeja' }]);
    storeGetDistricts.mockReset();
    storeSearch.mockReset().mockResolvedValue([]);
  });

  it('pages the districts of a resolved state and LGA', async () => {
    storeGetDistricts.mockResolvedValue([
      { state: 'LA', lga: 'LA-05', code: 'D43', name: 'Oregun' },
    ]);
    await expect(runTool('getDistricts', { state: 'Lagos', lga: 'Ikeja' })).resolves.toMatchObject({
      ok: true,
      data: { items: [{ code: 'D43' }], total: 1, truncated: false },
    });
    expect(storeGetDistricts).toHaveBeenCalledWith('LA', 'LA-05');
  });

  it('returns an empty page, not an error, when the LGA has no districts', async () => {
    storeGetDistricts.mockResolvedValue([]);
    await expect(runTool('getDistricts', { state: 'Lagos', lga: 'Ikeja' })).resolves.toEqual({
      ok: true,
      data: { items: [], total: 0, truncated: false },
    });
  });

  it('caps a long list and reports the real total', async () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      state: 'LA',
      lga: 'LA-05',
      code: `D${index}`,
    }));
    storeGetDistricts.mockResolvedValue(rows);
    const result = await runTool('getDistricts', { state: 'Lagos', lga: 'Ikeja' });
    expect(result).toMatchObject({
      ok: true,
      data: { total: 51, truncated: true },
    });
    if (result.ok) {
      const page = result.data as { items: unknown[] };
      expect(page.items).toHaveLength(50);
      expect(page.items[0]).toEqual(rows[0]);
    }
  });

  it('treats an LGA named as the state as that LGA', async () => {
    storeSearch.mockResolvedValue([{ type: 'lga', code: 'LA-05', name: 'Ikeja', state: 'LA' }]);
    storeGetDistricts.mockResolvedValue([]);
    await expect(runTool('getDistricts', { state: 'Ikeja', lga: 'Ikeja' })).resolves.toMatchObject(
      { ok: true },
    );
    expect(storeGetDistricts).toHaveBeenCalledWith('LA', 'LA-05');
  });

  it('returns not_found when neither parent name matches anything', async () => {
    storeSearch.mockResolvedValue([]);
    await expect(
      runTool('getDistricts', { state: 'Nowhereville', lga: 'Nowheresville' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect(storeGetDistricts).not.toHaveBeenCalled();
  });

  // F-01: the store's prefix search for "Lagos" returns the state and the two
  // LGAs whose names begin with it, exactly like the real snapshot. The state
  // slot resolving to a real state must end the fallback, or an unknown LGA
  // quietly inherits "Lagos Island" districts and the verified footer.
  it('returns not_found for an unknown LGA in a known state', async () => {
    storeSearch.mockImplementation(async (query: string) =>
      query.trim().toLowerCase() === 'lagos'
        ? [
            { type: 'state', code: 'LA', name: 'Lagos' },
            { type: 'lga', code: '14', name: 'Lagos Island', state: 'LA' },
            { type: 'lga', code: '15', name: 'Lagos Mainland', state: 'LA' },
          ]
        : [],
    );
    await expect(
      runTool('getDistricts', { state: 'Lagos', lga: 'Nowhereville' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect(storeGetDistricts).not.toHaveBeenCalled();
  });

  it('refuses the place fallback when the lga slot names a state', async () => {
    storeSearch.mockImplementation(async (query: string) =>
      query.trim().toLowerCase() === 'lagos'
        ? [
            { type: 'state', code: 'LA', name: 'Lagos' },
            { type: 'lga', code: '14', name: 'Lagos Island', state: 'LA' },
          ]
        : [],
    );
    await expect(
      runTool('getDistricts', { state: 'Nowhereville', lga: 'Lagos' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect(storeGetDistricts).not.toHaveBeenCalled();
  });
});

describe('getAreas', () => {
  beforeEach(() => {
    storeGetStates.mockReset().mockResolvedValue([{ code: 'LA', name: 'Lagos' }]);
    storeGetLgas.mockReset().mockResolvedValue([{ state: 'LA', code: 'LA-05', name: 'Ikeja' }]);
    storeGetAreas.mockReset();
  });

  it('pages the areas of a resolved district', async () => {
    storeGetAreas.mockResolvedValue([
      { state: 'LA', lga: 'LA-05', district: 'D43', code: 'A12' },
    ]);
    await expect(
      runTool('getAreas', { state: 'Lagos', lga: 'Ikeja', district: 'D43' }),
    ).resolves.toMatchObject({
      ok: true,
      data: { items: [{ code: 'A12' }], total: 1, truncated: false },
    });
    expect(storeGetAreas).toHaveBeenCalledWith('LA', 'LA-05', 'D43');
  });

  it('returns an empty page when the district has no areas', async () => {
    storeGetAreas.mockResolvedValue([]);
    await expect(
      runTool('getAreas', { state: 'Lagos', lga: 'Ikeja', district: 'D99' }),
    ).resolves.toEqual({ ok: true, data: { items: [], total: 0, truncated: false } });
  });

  it('rejects a missing district at the schema boundary', async () => {
    await expect(runTool('getAreas', { state: 'Lagos', lga: 'Ikeja' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_args' },
    });
    expect(storeGetAreas).not.toHaveBeenCalled();
  });
});

describe('getNearby', () => {
  beforeEach(() => {
    apiFetchNearby.mockReset();
  });

  it('caps the radius at 300 metres and normalizes the units', async () => {
    apiFetchNearby.mockResolvedValue([
      {
        postcode: 'FC-02-D43-LG-01',
        point_geometry: { coordinates: [7.49, 9.05] },
        distance_m: 12,
        state_name: 'FCT',
      },
    ]);
    const result = await runTool('getNearby', { lat: 9.05, lng: 7.49, radius: 5000 });
    expect(apiFetchNearby).toHaveBeenCalledWith(9.05, 7.49, 300);
    expect(result).toMatchObject({
      ok: true,
      data: [
        {
          postcode: 'FC-02-D43-LG-01',
          coordinates: [9.05, 7.49],
          distance_m: 12,
          stateName: 'FCT',
        },
      ],
    });
  });

  it('drops a unit with no postcode instead of inventing one', async () => {
    apiFetchNearby.mockResolvedValue([{ distance_m: 5 }, { code: 'FC-02-D43-LG-02' }]);
    await expect(runTool('getNearby', { lat: 9, lng: 7 })).resolves.toMatchObject({
      ok: true,
      data: [{ postcode: 'FC-02-D43-LG-02' }],
    });
  });

  it('rejects an out-of-range coordinate at the schema boundary', async () => {
    await expect(runTool('getNearby', { lat: 91, lng: 7 })).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_args' },
    });
    expect(apiFetchNearby).not.toHaveBeenCalled();
  });
});

describe('navigateMap', () => {
  beforeEach(() => {
    storeGetStates.mockReset().mockResolvedValue([
      { code: 'KN', name: 'Kano' },
      { code: 'LA', name: 'Lagos' },
    ]);
    storeGetLgas.mockReset().mockResolvedValue([{ state: 'LA', code: 'LA-05', name: 'Ikeja' }]);
    storeGetPostcode.mockReset().mockResolvedValue(null);
    storeSearch.mockReset().mockResolvedValue([]);
  });

  it('resolves a state target to its centre and zoom', async () => {
    await expect(runTool('navigateMap', { target: 'state', state: 'Lagos State' })).resolves.toMatchObject(
      {
        ok: true,
        data: { target: 'state', state: { code: 'LA', name: 'Lagos' }, center: [6.5244, 3.3792], zoom: 10 },
      },
    );
  });

  it('resolves an LGA target inside a state', async () => {
    await expect(
      runTool('navigateMap', { target: 'lga', state: 'Lagos', lga: 'Ikeja' }),
    ).resolves.toMatchObject({
      ok: true,
      data: { target: 'lga', lga: { code: 'LA-05', name: 'Ikeja' }, zoom: 12 },
    });
  });

  it('frames an LGA named as a state instead of failing', async () => {
    storeSearch.mockResolvedValue([{ type: 'lga', code: 'LA-05', name: 'Ikeja', state: 'LA' }]);
    await expect(
      runTool('navigateMap', { target: 'state', state: 'Ikeja' }),
    ).resolves.toMatchObject({
      ok: true,
      data: { target: 'lga', state: { code: 'LA' }, lga: { code: 'LA-05' }, zoom: 12 },
    });
  });

  it('frames a mapped postcode when it has coordinates', async () => {
    storeGetPostcode.mockResolvedValue({ postcode: 'FC-02-D43-LG-01', lat: 9.05, lng: 7.49 });
    await expect(
      runTool('navigateMap', { target: 'postcode', code: 'FC-02-D43-LG-01' }),
    ).resolves.toMatchObject({
      ok: true,
      data: { target: 'postcode', postcode: 'FC-02-D43-LG-01' },
    });
  });

  it('returns the national view for a reset without reading the store', async () => {
    await expect(runTool('navigateMap', { target: 'reset' })).resolves.toMatchObject({
      ok: true,
      data: { target: 'reset', zoom: 6 },
    });
    expect(storeGetStates).not.toHaveBeenCalled();
  });

  it('returns not_found when the target names nothing real', async () => {
    await expect(
      runTool('navigateMap', { target: 'state', state: 'Nowhereville' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'not_found' } });
  });

  it('returns not_found when a postcode target has no mapped record', async () => {
    await expect(
      runTool('navigateMap', { target: 'postcode', code: 'FC-02-D43-LG-01' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'not_found' } });
  });

  it('rejects a partial target at the schema boundary', async () => {
    await expect(runTool('navigateMap', { target: 'state' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_args' },
    });
  });
});

describe('decodePostcode', () => {
  beforeEach(() => {
    storeGetStates.mockReset().mockResolvedValue([{ code: 'FC', name: 'Federal Capital Territory' }]);
    storeGetLgas.mockReset().mockResolvedValue([{ state: 'FC', code: '02', name: 'Abuja Municipal' }]);
    storeGetPostcode.mockReset().mockResolvedValue(null);
  });

  it('splits a well-formed code into its five segments', async () => {
    await expect(runTool('decodePostcode', { code: 'FC-02-D43-LG-01' })).resolves.toMatchObject({
      ok: true,
      data: {
        postcode: 'FC-02-D43-LG-01',
        compact: 'FC02D43LG01',
        display: 'FC 02 D43 LG 01',
        valid: true,
        segments: { state: 'FC', lga: '02', district: 'D43', area: 'LG', unit: '01' },
        stateName: 'Federal Capital Territory',
        lgaName: 'Abuja Municipal',
      },
    });
  });

  it('accepts the compact 11-character form', async () => {
    await expect(runTool('decodePostcode', { code: 'FC02D43LG01' })).resolves.toMatchObject({
      ok: true,
      data: { postcode: 'FC-02-D43-LG-01', valid: true },
    });
  });

  it('answers a malformed code honestly instead of fabricating segments', async () => {
    const result = await runTool('decodePostcode', { code: 'FC-2-D43-LG-1' });
    expect(result).toMatchObject({
      ok: true,
      data: {
        valid: false,
        segments: { state: '', lga: '', district: '', area: '', unit: '' },
      },
    });
    if (result.ok) {
      const decoded = result.data as { reason?: string };
      expect(decoded.reason).toContain('STATE-LGA-DISTRICT-AREA-UNIT');
    }
  });
});

