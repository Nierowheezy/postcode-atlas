import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_NIPOST_UPSTREAM,
  fetchNipostJson,
  readNipostApiKey,
  resolveNipostBaseUrl,
} from './gateway';

const ENV = { NIPOST_PUBLISHABLE_KEY: 'nipost_pk_test' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveNipostBaseUrl', () => {
  it('falls back to the public gateway', () => {
    expect(resolveNipostBaseUrl({})).toBe(DEFAULT_NIPOST_UPSTREAM);
  });

  it('uses NIPOST_API_BASE_URL and trims trailing slashes', () => {
    expect(resolveNipostBaseUrl({ NIPOST_API_BASE_URL: 'https://ndaps.test//' })).toBe(
      'https://ndaps.test'
    );
  });
});

describe('readNipostApiKey', () => {
  it('returns the key when present', () => {
    expect(readNipostApiKey({ NIPOST_PUBLISHABLE_KEY: 'nipost_pk_test' })).toBe('nipost_pk_test');
  });

  it('returns undefined when missing or blank', () => {
    expect(readNipostApiKey({})).toBeUndefined();
    expect(readNipostApiKey({ NIPOST_PUBLISHABLE_KEY: '   ' })).toBeUndefined();
  });
});

describe('fetchNipostJson', () => {
  it('refuses to call upstream when the key is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchNipostJson('/v1/lookup', { code: 'LA-11-A12-AK-08' }, {})).resolves.toEqual({
      ok: false,
      reason: 'not_configured',
      status: 500,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the key, encodes params, and returns the parsed JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { postcode: 'LA-11-A12-AK-08' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchNipostJson('/v1/lookup', { code: 'LA 11 12', level: '1' }, ENV);

    expect(result).toEqual({
      ok: true,
      status: 200,
      data: { postcode: 'LA-11-A12-AK-08' },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${DEFAULT_NIPOST_UPSTREAM}/v1/lookup?code=LA+11+12&level=1`,
      { headers: { 'X-API-Key': 'nipost_pk_test' } }
    );
  });

  it('passes a body without a data envelope through unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ found: true })));

    await expect(fetchNipostJson('/v1/lookup', {}, ENV)).resolves.toEqual({
      ok: true,
      status: 200,
      data: { found: true },
    });
  });

  it('falls back to the whole body when data is null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: null })));

    await expect(fetchNipostJson('/v1/lookup', {}, ENV)).resolves.toEqual({
      ok: true,
      status: 200,
      data: { data: null },
    });
  });

  it('maps an unreachable gateway to a 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(fetchNipostJson('/v1/lookup', {}, ENV)).resolves.toEqual({
      ok: false,
      reason: 'unreachable',
      status: 502,
    });
  });

  it('carries a non-2xx upstream status through', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404 })));

    await expect(fetchNipostJson('/v1/lookup', { code: 'X' }, ENV)).resolves.toEqual({
      ok: false,
      reason: 'upstream_status',
      status: 404,
    });
  });

  it('maps a non-JSON 2xx body to bad_response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>not json</html>', { status: 200 }))
    );

    await expect(fetchNipostJson('/v1/lookup', {}, ENV)).resolves.toEqual({
      ok: false,
      reason: 'bad_response',
      status: 502,
    });
  });
});
