import { describe, expect, it } from 'vitest';
import type { AtlasLga, AtlasState, LocationCandidate } from '../atlas/dataset';
import type { PostcodeLocation } from '../../types/postcode';
import { parseAddressText } from './parse';
import { resolveAddress } from './resolve';
import type { AddressLookup } from './types';

const STATES: AtlasState[] = [
  { code: 'LA', name: 'Lagos' },
  { code: 'KN', name: 'Kano' },
  { code: 'FC', name: 'FCT' },
];

const LGAS: Record<string, AtlasLga[]> = {
  LA: [
    { state: 'LA', code: 'LA-05', name: 'Ikeja' },
    { state: 'LA', code: 'LA-09', name: 'Surulere' },
  ],
  KN: [{ state: 'KN', code: 'KN-01', name: 'Nassarawa' }],
  FC: [{ state: 'FC', code: 'FC-01', name: 'Abuja Municipal' }],
};

const DISCOVERY: PostcodeLocation[] = [
  {
    postcode: 'LA-05-A10-BB-02',
    name: 'Ikeja City Mall',
    state: 'LA',
    stateName: 'Lagos',
    lga: 'LA-05',
    lgaName: 'Ikeja',
  },
];

const RECORD: PostcodeLocation = {
  postcode: 'LA-05-A10-BB-02',
  state: 'LA',
  stateName: 'Lagos',
  lga: 'LA-05',
  lgaName: 'Ikeja',
  district: 'D1',
  area: 'A1',
};

interface Overrides {
  discoveryPoints?: PostcodeLocation[];
  search?: (query: string) => LocationCandidate[];
  lookupPostcode?: (code: string) => PostcodeLocation | null;
}

function lookup(overrides: Overrides = {}): AddressLookup {
  return {
    states: async () => STATES,
    lgas: async (state) => LGAS[state] ?? [],
    discoveryPoints: async () => overrides.discoveryPoints ?? [],
    search: async (query) => (overrides.search ?? (() => []))(query),
    lookupPostcode: async (code) => (overrides.lookupPostcode ?? (() => null))(code),
  };
}

const interpret = (raw: string, overrides: Overrides = {}) =>
  resolveAddress(parseAddressText(raw), lookup(overrides));

describe('resolveAddress', () => {
  it('places the state and LGA an address names and reports the street unplaced', async () => {
    const result = await interpret('12 Allen Avenue, Ikeja, Lagos');
    expect(result.state).toEqual({ code: 'LA', name: 'Lagos' });
    expect(result.lga).toEqual({ code: 'LA-05', name: 'Ikeja' });
    expect(result.unresolved).toEqual(['12 Allen Avenue']);
    expect(result.resolvedTo).toBe('lga');
    expect(result.postcode).toBeUndefined();
  });

  it('fills district, area, and a verified postcode when the address carries a code', async () => {
    const result = await interpret('12 Allen Avenue, Ikeja, Lagos LA-05-A10-BB-02', {
      lookupPostcode: (code) => (code === 'LA-05-A10-BB-02' ? RECORD : null),
    });
    expect(result.postcode).toEqual({ code: 'LA-05-A10-BB-02', verified: true });
    expect(result.district).toEqual({ code: 'D1' });
    expect(result.area).toEqual({ code: 'A1' });
    expect(result.resolvedTo).toBe('postcode');
    expect(result.unresolved).toEqual(['12 Allen Avenue']);
  });

  it('marks a pattern-valid code with no record unverified', async () => {
    const result = await interpret('Lagos LA-05-A10-BB-08');
    expect(result.postcode).toEqual({ code: 'LA-05-A10-BB-08', verified: false });
    expect(result.state).toEqual({ code: 'LA', name: 'Lagos' });
  });

  it('resolves a state-only answer', async () => {
    const result = await interpret('Lagos');
    expect(result).toMatchObject({ resolvedTo: 'state', state: { code: 'LA', name: 'Lagos' } });
    expect(result.unresolved).toEqual([]);
  });

  it('resolves an LGA written without its state, the way the lookup tools do', async () => {
    const result = await interpret('Ikeja', {
      search: () => [{ type: 'lga', code: 'LA-05', name: 'Ikeja', state: 'LA' }],
    });
    expect(result.state).toEqual({ code: 'LA', name: 'Lagos' });
    expect(result.lga).toEqual({ code: 'LA-05', name: 'Ikeja' });
    expect(result.resolvedTo).toBe('lga');
  });

  it('matches a verified landmark by name and takes its postcode', async () => {
    const result = await interpret('Ikeja City Mall, Lagos', { discoveryPoints: DISCOVERY });
    expect(result.landmark).toEqual({ name: 'Ikeja City Mall', postcode: 'LA-05-A10-BB-02' });
    expect(result.postcode).toEqual({ code: 'LA-05-A10-BB-02', verified: true });
    expect(result.state).toEqual({ code: 'LA', name: 'Lagos' });
    expect(result.lga).toEqual({ code: 'LA-05', name: 'Ikeja' });
    expect(result.unresolved).toEqual([]);
  });

  it('leaves a place it cannot find at all unresolved', async () => {
    const result = await interpret('Nowhereville, Lagos');
    expect(result.unresolved).toEqual(['Nowhereville']);
    expect(result.state).toEqual({ code: 'LA', name: 'Lagos' });
    expect(result.resolvedTo).toBe('state');
  });

  it('does not guess when a place matches more than one place', async () => {
    const result = await interpret('Bida, Lagos', {
      search: () => [
        { type: 'lga', code: 'X', name: 'Bida' },
        { type: 'lga', code: 'Y', name: 'Bida' },
      ],
    });
    expect(result.unresolved).toEqual(['Bida']);
    expect(result.state).toEqual({ code: 'LA', name: 'Lagos' });
    expect(result.lga).toBeUndefined();
  });

  it('resolves nothing for a non-address string', async () => {
    const result = await interpret('???');
    expect(result.resolvedTo).toBe('none');
    expect(result.unresolved).toEqual(['???']);
    expect(result.postcode).toBeUndefined();
  });
});
