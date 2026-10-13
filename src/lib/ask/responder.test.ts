import { describe, expect, it } from 'vitest';
import { deriveAddress, deriveMapAction, deriveReferent, hasEmptyScopeList, asksForPostcode, postcodeScopeCopy } from './responder';
import type { AskToolResult, AskToolTurn, AtlasResultList } from './types';

function turn(...toolResults: AskToolResult[]): AskToolTurn {
  return { assistantToolCalls: [], toolResults };
}

function ok(name: string, data: unknown): AskToolResult {
  return { tool_call_id: 'c1', name, ok: true, data };
}

describe('deriveReferent', () => {
  it('reads a valid decoded postcode as the referent', () => {
    const referent = deriveReferent([
      turn(ok('decodePostcode', { postcode: 'FC-02-D43-LG-01', valid: true, segments: { state: 'FC' } })),
    ]);
    expect(referent).toEqual({ kind: 'postcode', code: 'FC-02-D43-LG-01', state: 'FC' });
  });

  it('ignores an invalid decode', () => {
    expect(
      deriveReferent([turn(ok('decodePostcode', { postcode: 'X', valid: false, segments: {} }))]),
    ).toBeUndefined();
  });

  it('uses the first LGA from a getLgas list', () => {
    const referent = deriveReferent([
      turn(
        ok('getLgas', [
          { code: '01', name: 'Ajingi', state: 'KN' },
          { code: '02', name: 'Albasu', state: 'KN' },
        ]),
      ),
    ]);
    expect(referent).toEqual({ kind: 'lga', code: '01', name: 'Ajingi', state: 'KN' });
  });

  it('reads a state summary', () => {
    expect(deriveReferent([turn(ok('getState', { code: 'KN', name: 'Kano' }))])).toEqual({
      kind: 'state',
      code: 'KN',
      name: 'Kano',
    });
  });

  it('reads a lone landmark search hit as a postcode referent', () => {
    expect(
      deriveReferent([turn(ok('searchLocation', [{ type: 'landmark', code: 'NGCTABJKE001', name: 'Bank' }]))]),
    ).toEqual({ kind: 'postcode', code: 'NGCTABJKE001', name: 'Bank' });
  });

  it('ignores a search that names no landmark', () => {
    expect(
      deriveReferent([turn(ok('searchLocation', [{ type: 'state', code: 'LA', name: 'Lagos' }]))]),
    ).toBeUndefined();
  });

  it('returns nothing when two equally specific results are ambiguous', () => {
    const referent = deriveReferent([
      turn(ok('getLgas', [{ code: '01', name: 'A', state: 'KN' }]), ok('getLgas', [{ code: '02', name: 'B', state: 'LA' }])),
    ]);
    expect(referent).toBeUndefined();
  });

  it('prefers the most specific places over a list', () => {
    const referent = deriveReferent([
      turn(
        ok('getLgas', [{ code: '01', name: 'Ajingi', state: 'KN' }]),
        ok('getPostcode', { postcode: 'FC-02-D43-LG-01', name: 'Ikeja', state: 'FC' }),
      ),
    ]);
    expect(referent).toEqual({ kind: 'postcode', code: 'FC-02-D43-LG-01', name: 'Ikeja', state: 'FC' });
  });

  it('ignores failed results', () => {
    expect(deriveReferent([turn({ tool_call_id: 'c1', name: 'getLgas', ok: false })])).toBeUndefined();
  });

  it('returns nothing for an empty turn', () => {
    expect(deriveReferent([])).toBeUndefined();
  });
});

describe('deriveMapAction', () => {
  it('keeps the last successful navigateMap action', () => {
    const action = deriveMapAction([
      turn(ok('navigateMap', { target: 'state', state: { code: 'KN', name: 'Kano' }, center: [11.9, 8.5], zoom: 9 })),
    ]);
    expect(action).toEqual({ target: 'state', state: { code: 'KN', name: 'Kano' }, center: [11.9, 8.5], zoom: 9 });
  });

  it('parses a reset action', () => {
    expect(deriveMapAction([turn(ok('navigateMap', { target: 'reset', center: [9, 8], zoom: 6 }))])).toEqual({
      target: 'reset',
      center: [9, 8],
      zoom: 6,
    });
  });

  it('ignores failed and non-map results', () => {
    expect(deriveMapAction([turn({ tool_call_id: 'c1', name: 'navigateMap', ok: false })])).toBeUndefined();
    expect(deriveMapAction([turn(ok('getState', { code: 'KN', name: 'Kano' }))])).toBeUndefined();
  });
});

describe('deriveAddress', () => {
  const payload = {
    input: '12 Allen Avenue, Ikeja, Lagos',
    state: { code: 'LA', name: 'Lagos' },
    lga: { code: 'LA-05', name: 'Ikeja' },
    unresolved: ['12 Allen Avenue'],
    resolvedTo: 'lga',
  };

  it('reads an interpretAddress result as the reply payload', () => {
    expect(deriveAddress([turn(ok('interpretAddress', payload))])).toEqual(payload);
  });

  it('keeps the last interpretation when several ran', () => {
    const later = { ...payload, input: 'Wuse 2, Abuja', resolvedTo: 'lga' };
    expect(deriveAddress([turn(ok('interpretAddress', payload), ok('interpretAddress', later))])).toEqual(later);
  });

  it('returns nothing for a failed or unrelated tool turn', () => {
    expect(deriveAddress([turn({ tool_call_id: 'c1', name: 'interpretAddress', ok: false })])).toBeUndefined();
    expect(deriveAddress([turn(ok('getState', { code: 'KN', name: 'Kano' }))])).toBeUndefined();
    expect(deriveAddress([])).toBeUndefined();
  });

  it('rejects a shape that is not an interpreted address', () => {
    expect(deriveAddress([turn(ok('interpretAddress', { input: 'x', resolvedTo: 'none' }))])).toBeUndefined();
  });
});

describe('hasEmptyScopeList', () => {
  it('is true for an empty district page', () => {
    expect(hasEmptyScopeList([turn(ok('getDistricts', { items: [], total: 0, truncated: false }))])).toBe(true);
  });

  it('is true for an empty area page', () => {
    expect(hasEmptyScopeList([turn(ok('getAreas', { items: [], total: 0 }))])).toBe(true);
  });

  it('is false when the page has rows', () => {
    expect(hasEmptyScopeList([turn(ok('getDistricts', { items: [{ code: 'A01' }], total: 1 }))])).toBe(false);
  });

  it('is false for a failed or unrelated result', () => {
    expect(hasEmptyScopeList([turn({ tool_call_id: 'c1', name: 'getDistricts', ok: false })])).toBe(false);
    expect(hasEmptyScopeList([turn(ok('getLgas', []))])).toBe(false);
  });
});

describe('asksForPostcode', () => {
  it('matches the English forms', () => {
    expect(asksForPostcode('Postcode for Ikeja')).toBe(true);
    expect(asksForPostcode('what is the postal code of Ikeja?')).toBe(true);
    expect(asksForPostcode('Ikeja zip')).toBe(true);
    expect(asksForPostcode('POSTCODE')).toBe(true);
  });

  it('matches Yoruba with and without tone marks', () => {
    expect(asksForPostcode('Kí ni kòòdù Ikeja?')).toBe(true);
    expect(asksForPostcode('Kí ni koodu Ikeja?')).toBe(true);
  });

  it('matches the Hausa forms', () => {
    expect(asksForPostcode('Menene lambar gidan waya na Ikeja?')).toBe(true);
    expect(asksForPostcode('lamba na Ikeja')).toBe(true);
  });

  it('matches the Igbo forms', () => {
    expect(asksForPostcode('gịnị bụ koodu ozi Ikeja?')).toBe(true);
  });

  it('does not fire on a place with no postcode wording', () => {
    expect(asksForPostcode('Ikeja')).toBe(false);
    expect(asksForPostcode('Where is Wuse 2?')).toBe(false);
    expect(asksForPostcode('gidan waya')).toBe(false);
  });
});

describe('postcodeScopeCopy', () => {
  const lgaList: AtlasResultList = {
    level: 'lga',
    scope: 'Lagos',
    items: [{ type: 'lga', code: '11', name: 'Ikeja' }],
    total: 1,
  };

  it('keeps the English guarded reply unchanged', () => {
    expect(postcodeScopeCopy(lgaList, 'en')).toBe(
      'Ikeja is a Local Government Area in Lagos, so it has no single postcode. Tell me a specific area, street, or landmark and I will find its unit postcode.',
    );
  });

  it('answers a Yoruba question in Yoruba and names no postcode', () => {
    const copy = postcodeScopeCopy(lgaList, 'yo');
    expect(copy).toContain('Ikeja jẹ Agbegbe Ijoba Ibile ni Lagos');
    expect(copy).toContain('ko ni koodu kan soso');
  });

  it('answers Hausa and Igbo in their own language', () => {
    expect(postcodeScopeCopy(lgaList, 'ha')).toContain('Ikeja Karamar Hukuma ce a Lagos');
    expect(postcodeScopeCopy(lgaList, 'ig')).toContain('Ikeja bụ Ọchịchị Ime Obodo na Lagos');
  });

  it('returns nothing when the list is not a state or LGA', () => {
    expect(postcodeScopeCopy({ ...lgaList, level: 'unit' }, 'en')).toBeUndefined();
  });
});
