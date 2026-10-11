import { describe, expect, it } from 'vitest';
import { deriveMapAction, deriveReferent, hasEmptyScopeList } from './responder';
import type { AskToolResult, AskToolTurn } from './types';

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
