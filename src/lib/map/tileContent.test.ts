import { describe, expect, it } from 'vitest';
import {
  EMPTY_TILE_STATS,
  FEATURELESS_SHARE,
  MIN_SAMPLED_TILES,
  SAMPLE_WINDOW,
  isFeatureless,
  nextTileSample,
  spreadOf,
  viewportLooksEmpty,
} from './tileContent';
import type { TileSampleStats } from './tileContent';

/** Builds an RGBA sample from [r, g, b] triples. */
const pixels = (triples: number[][]) => {
  const data = new Uint8ClampedArray(triples.length * 4);
  triples.forEach(([r, g, b], index) => {
    data[index * 4] = r;
    data[index * 4 + 1] = g;
    data[index * 4 + 2] = b;
    data[index * 4 + 3] = 255;
  });
  return data;
};

describe('spreadOf', () => {
  it('reports no spread for a flat grey tile', () => {
    expect(spreadOf(pixels([[242, 242, 242], [242, 242, 242]]))).toBe(0);
  });

  it('reports no spread for a flat tile of any colour', () => {
    // An empty OpenStreetMap tile is flat pale ground, not grey. Measuring
    // across channels instead of per channel scored this 9 and hid the mask.
    const ground = () => pixels([[242, 239, 233], [242, 239, 233], [242, 239, 233]]);
    expect(spreadOf(ground())).toBe(0);
  });

  it('reports the widest per-channel range across the sample', () => {
    expect(spreadOf(pixels([[10, 200, 100], [50, 200, 100]]))).toBe(40);
    expect(spreadOf(pixels([[10, 200, 100], [10, 160, 90]]))).toBe(40);
  });

  it('handles an empty sample without throwing', () => {
    expect(spreadOf(new Uint8ClampedArray(0))).toBe(0);
  });
});

describe('isFeatureless', () => {
  it('counts a measured empty tile as featureless', () => {
    expect(isFeatureless(0)).toBe(true);
  });

  it('does not count a tile with drawn content as featureless', () => {
    // Low-water marks measured on real tiles: rural road 14, Esri canvas 8, city 47.
    expect(isFeatureless(8)).toBe(false);
    expect(isFeatureless(14)).toBe(false);
    expect(isFeatureless(47)).toBe(false);
  });
});

describe('viewportLooksEmpty', () => {
  const statsWith = (recent: boolean[]): TileSampleStats => ({ level: 19, recent });

  it('stays quiet until enough tiles have been measured', () => {
    const few = Array.from({ length: MIN_SAMPLED_TILES - 1 }, () => true);
    expect(viewportLooksEmpty(statsWith(few))).toBe(false);
  });

  it('reports an empty viewport when the measured tiles are flat', () => {
    expect(viewportLooksEmpty(statsWith(Array.from({ length: 24 }, () => true)))).toBe(true);
  });

  it('stays quiet when a tenth of the tiles carry content', () => {
    const recent = Array.from({ length: 20 }, (_, index) => index >= 3);
    expect(viewportLooksEmpty(statsWith(recent))).toBe(false);
  });

  it('stays quiet before anything has loaded', () => {
    expect(viewportLooksEmpty(EMPTY_TILE_STATS)).toBe(false);
  });
});

describe('nextTileSample', () => {
  it('records each tile at one level, oldest first', () => {
    const one = nextTileSample(EMPTY_TILE_STATS, 19, true);
    const two = nextTileSample(one, 19, false);
    expect(two).toEqual({ level: 19, recent: [true, false] });
  });

  it('starts over when the zoom level changes', () => {
    const deep: TileSampleStats = { level: 19, recent: Array.from({ length: 24 }, () => true) };
    expect(nextTileSample(deep, 16, false)).toEqual({ level: 16, recent: [false] });
  });

  it('holds the window at its size and lets recent tiles win', () => {
    let stats: TileSampleStats = {
      level: 18,
      recent: Array.from({ length: SAMPLE_WINDOW }, () => false),
    };
    for (let i = 0; i < SAMPLE_WINDOW; i += 1) {
      stats = nextTileSample(stats, 18, true);
      expect(stats.recent.length).toBeLessThanOrEqual(SAMPLE_WINDOW);
    }
    expect(viewportLooksEmpty(stats)).toBe(true);
  });

  it('turns back off after panning into mapped detail', () => {
    let stats: TileSampleStats = {
      level: 18,
      recent: Array.from({ length: SAMPLE_WINDOW }, () => true),
    };
    for (let i = 0; i < SAMPLE_WINDOW / 2; i += 1) stats = nextTileSample(stats, 18, false);
    expect(viewportLooksEmpty(stats)).toBe(false);
  });
});
