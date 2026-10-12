import { describe, expect, it } from 'vitest';
import { isAllowedNipostPath, resolveUpstreamPath, resolveUpstreamTarget } from './handler';

describe('isAllowedNipostPath', () => {
  it('allows every NDAPS path the app calls', () => {
    const used = [
      '/v1/reference/states',
      '/v1/reference/lgas',
      '/v1/reference/districts',
      '/v1/reference/areas',
      '/v1/lookup',
      '/v1/search/autocomplete',
      '/v1/search/reverse',
      '/v1/search/nearby',
      '/v1/assembly/disassemble',
      '/v1/assembly/assemble',
    ];

    for (const path of used) {
      expect(isAllowedNipostPath(path), path).toBe(true);
    }
  });

  it('rejects paths the app does not call, so the proxy stays closed', () => {
    expect(isAllowedNipostPath('/v1/admin/keys')).toBe(false);
    expect(isAllowedNipostPath('/v1/reference/unknown')).toBe(false);
    expect(isAllowedNipostPath('/')).toBe(false);
    expect(isAllowedNipostPath('')).toBe(false);
  });

  it('does not treat a prefix match as allowed', () => {
    expect(isAllowedNipostPath('/v1/lookup/extra')).toBe(false);
  });
});

describe('resolveUpstreamPath', () => {
  it('strips the proxy prefix when the full path arrives (Vercel)', () => {
    expect(resolveUpstreamPath('/api/nipost/v1/reference/lgas')).toBe(
      '/v1/reference/lgas'
    );
  });

  it('leaves a bare upstream path alone (dev middleware)', () => {
    expect(resolveUpstreamPath('/v1/reference/lgas')).toBe('/v1/reference/lgas');
  });
});

describe('resolveUpstreamTarget', () => {
  it('reads the carried path and keeps the rest of the query (Vercel rewrite)', () => {
    const url = new URL(
      'https://atlas.test/api/nipost/%5B...path%5D?path=/v1/reference/lgas&state=LA'
    );

    expect(resolveUpstreamTarget(url)).toEqual({
      pathname: '/v1/reference/lgas',
      search: '?state=LA',
    });
  });

  it('reads the request path when no path is carried (dev middleware)', () => {
    const url = new URL('https://atlas.test/api/nipost/v1/search/reverse?lat=6.5&lng=3.3');

    expect(resolveUpstreamTarget(url)).toEqual({
      pathname: '/v1/search/reverse',
      search: '?lat=6.5&lng=3.3',
    });
  });

  it('returns no query when the carried path has none', () => {
    const url = new URL('https://atlas.test/api/nipost/%5B...path%5D?path=/v1/reference/states');

    expect(resolveUpstreamTarget(url)).toEqual({
      pathname: '/v1/reference/states',
      search: '',
    });
  });
});
