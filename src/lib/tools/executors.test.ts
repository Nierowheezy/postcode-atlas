import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * These executors answer from the Atlas store and nothing else, so stub the
 * store at the module boundary. That keeps the tests offline and focused on
 * the code, not on a live dataset or the network.
 */
const { storeGetPostcode, storeGetStates, storeGetLgas, storeGetDiscovery, storeSearch } = vi.hoisted(
  () => ({
    storeGetPostcode: vi.fn(),
    storeGetStates: vi.fn(),
    storeGetLgas: vi.fn(),
    storeGetDiscovery: vi.fn(),
    storeSearch: vi.fn(),
  }),
);

vi.mock('../atlas/store', () => ({
  atlasStore: {
    getPostcode: storeGetPostcode,
    getStates: storeGetStates,
    getLgas: storeGetLgas,
    getDiscoveryPoints: storeGetDiscovery,
    searchLocations: storeSearch,
  },
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
