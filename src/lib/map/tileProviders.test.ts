import { describe, expect, it } from 'vitest';
import {
  DARK_CANVAS_TILE,
  MAX_MAP_ZOOM,
  MIN_MAP_ZOOM,
  TILE_PROVIDERS,
  TRANSPARENT_TILE,
  resolveTileProvider,
} from './tileProviders';

describe('resolveTileProvider', () => {
  it('returns the provider for each style in light mode', () => {
    expect(resolveTileProvider('light', false)).toBe(TILE_PROVIDERS.light);
    expect(resolveTileProvider('voyager', false)).toBe(TILE_PROVIDERS.voyager);
    expect(resolveTileProvider('satellite', false)).toBe(TILE_PROVIDERS.satellite);
  });

  it('swaps only the light-style basemap in dark mode', () => {
    expect(resolveTileProvider('light', true)).toBe(DARK_CANVAS_TILE);
    expect(resolveTileProvider('voyager', true)).toBe(TILE_PROVIDERS.voyager);
    expect(resolveTileProvider('satellite', true)).toBe(TILE_PROVIDERS.satellite);
  });

  it('names a provider for every style and theme', () => {
    for (const isDark of [false, true]) {
      for (const style of ['light', 'voyager', 'satellite'] as const) {
        const provider = resolveTileProvider(style, isDark);
        expect(provider.name.length).toBeGreaterThan(0);
        expect(provider.url).toContain('{z}');
        expect(provider.url).toContain('{x}');
        expect(provider.url).toContain('{y}');
      }
    }
  });
});

describe('provider data depth', () => {
  const providers = [...Object.values(TILE_PROVIDERS), DARK_CANVAS_TILE];

  it('keeps every provider inside the camera range', () => {
    for (const provider of providers) {
      expect(provider.nativeMax).toBeGreaterThanOrEqual(MIN_MAP_ZOOM);
      expect(provider.nativeMax).toBeLessThanOrEqual(MAX_MAP_ZOOM);
    }
  });

  it('keeps the canvas styles at their real depth of 16', () => {
    // Regression guard: these two carry no tiles past 16, and treating that as a
    // layer maxZoom blanked the map. The camera caps to this value instead.
    expect(TILE_PROVIDERS.voyager.nativeMax).toBe(16);
    expect(DARK_CANVAS_TILE.nativeMax).toBe(16);
  });

  it('keeps the camera ceiling above every provider', () => {
    for (const provider of providers) {
      expect(MAX_MAP_ZOOM).toBeGreaterThanOrEqual(provider.nativeMax);
    }
  });

  it('declares cross-origin support on every provider', () => {
    // The empty-viewport sampler can only read a tile that allowed a
    // cross-origin read, so every provider states this rather than defaulting.
    for (const provider of providers) {
      expect(provider.cors).toBe(true);
    }
  });
});

describe('TRANSPARENT_TILE', () => {
  it('is an inline transparent image, not a file that can 404', () => {
    expect(TRANSPARENT_TILE.startsWith('data:image/png;base64,')).toBe(true);
  });
});
