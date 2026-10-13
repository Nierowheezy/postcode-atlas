import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleApi, resolveApiPath } from './handler';

const ENV = { NIPOST_PUBLISHABLE_KEY: 'nipost_pk_test' };

const NDAPS_BODY = {
  valid: true,
  verified: true,
  status: 'active',
  building_use_status: 'residential',
  recent_house_address: { recent: '12 Adeola Street' },
  administrative_address: { locality_name: 'Ikeja' },
  point_geometry: { coordinates: [3.349, 6.6018] },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function get(path: string): Request {
  return new Request(`https://atlas.test${path}`);
}

function stubLookup(response: Response | Error): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn();
  if (response instanceof Error) fetchMock.mockRejectedValue(response);
  else fetchMock.mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveApiPath', () => {
  it('reads the dev pathname with the prefix stripped', () => {
    expect(resolveApiPath(new URL('https://atlas.test/api/v1/postcodes/FC-02-D43-LG-01'))).toBe(
      '/postcodes/FC-02-D43-LG-01'
    );
  });

  it('normalizes the root path', () => {
    expect(resolveApiPath(new URL('https://atlas.test/api/v1'))).toBe('/');
    expect(resolveApiPath(new URL('https://atlas.test/api/v1/'))).toBe('/');
  });

  it('reads the carried path on Vercel and trims a trailing slash', () => {
    const url = new URL(
      'https://atlas.test/api/v1/%5B...path%5D?path=%2Fpostcodes%2FFC-02-D43-LG-01%2F'
    );
    expect(resolveApiPath(url)).toBe('/postcodes/FC-02-D43-LG-01');
  });
});

describe('handleApi', () => {
  it('returns the service identity at the root with CORS and cache headers', async () => {
    const response = await handleApi(get('/api/v1'), ENV);

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('cache-control')).toContain('public');
    await expect(response.json()).resolves.toEqual({
      data: { name: 'Postcode Atlas API', version: 1 },
    });
  });

  it('returns the postcode record on success', async () => {
    const fetchMock = stubLookup(jsonResponse({ data: NDAPS_BODY }));

    const response = await handleApi(get('/api/v1/postcodes/LA-11-A12-AK-08'), ENV);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postcode.gov.ng/v1/lookup?code=LA-11-A12-AK-08&level=1',
      { headers: { 'X-API-Key': 'nipost_pk_test' } }
    );
    await expect(response.json()).resolves.toEqual({
      data: {
        code: 'LA-11-A12-AK-08',
        display: 'LA 11 A12 AK 08',
        compact: 'LA11A12AK08',
        segments: { state: 'LA', lga: '11', district: 'A12', area: 'AK', unit: '08' },
        coordinates: { lat: 6.6018, lng: 3.349 },
        address: '12 Adeola Street',
        locality: 'Ikeja',
        buildingUse: 'residential',
        status: 'active',
        valid: true,
        verified: true,
        source: 'nipost-ndaps',
      },
    });
  });

  it('normalizes a lowercase compact code before the lookup', async () => {
    const fetchMock = stubLookup(jsonResponse({ data: NDAPS_BODY }));

    await handleApi(get('/api/v1/postcodes/fc02d43lg01'), ENV);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postcode.gov.ng/v1/lookup?code=FC-02-D43-LG-01&level=1',
      { headers: { 'X-API-Key': 'nipost_pk_test' } }
    );
  });

  it('rejects a malformed code without calling upstream', async () => {
    const fetchMock = stubLookup(jsonResponse({ data: NDAPS_BODY }));

    const response = await handleApi(get('/api/v1/postcodes/not-a-code'), ENV);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'invalid_code' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a path with a malformed percent-encoding', async () => {
    const response = await handleApi(get('/api/v1/postcodes/%E0%A4%A'), ENV);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_code' },
    });
  });

  it('asks for a code when the postcodes route has none', async () => {
    const response = await handleApi(get('/api/v1/postcodes'), ENV);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_code' },
    });
  });

  it('maps an upstream 404 to not_found', async () => {
    stubLookup(new Response('missing', { status: 404 }));

    const response = await handleApi(get('/api/v1/postcodes/LA-11-A12-AK-08'), ENV);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_found' } });
  });

  it('maps a 200 body that reports not_found to 404', async () => {
    stubLookup(
      jsonResponse({
        data: { postcode: 'LA-11-A12-AK-08', valid: false, status: 'not_found', verified: false },
      })
    );

    const response = await handleApi(get('/api/v1/postcodes/LA-11-A12-AK-08'), ENV);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_found' } });
  });

  it('maps a non-404 upstream failure to upstream_error', async () => {
    stubLookup(new Response('boom', { status: 503 }));

    const response = await handleApi(get('/api/v1/postcodes/LA-11-A12-AK-08'), ENV);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'upstream_error' } });
  });

  it('maps a non-JSON upstream body to upstream_error', async () => {
    stubLookup(new Response('<html>no</html>', { status: 200 }));

    const response = await handleApi(get('/api/v1/postcodes/LA-11-A12-AK-08'), ENV);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'upstream_error' } });
  });

  it('maps an unreachable gateway to upstream_unreachable', async () => {
    stubLookup(new Error('offline'));

    const response = await handleApi(get('/api/v1/postcodes/LA-11-A12-AK-08'), ENV);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'upstream_unreachable' },
    });
  });

  it('reports a missing gateway key as not_configured', async () => {
    const response = await handleApi(get('/api/v1/postcodes/LA-11-A12-AK-08'), {});

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_configured' } });
  });

  it('returns unknown_route for an unmatched path', async () => {
    const response = await handleApi(get('/api/v1/nope'), ENV);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'unknown_route' } });
  });

  it('returns invalid_code when the postcode has no code segment', async () => {
    const response = await handleApi(get('/api/v1/postcodes/'), ENV);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'invalid_code' } });
  });

  it('returns unknown_route for extra postcode segments', async () => {
    const response = await handleApi(get('/api/v1/postcodes/LA-11/extra'), ENV);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'unknown_route' } });
  });

  it('rejects non-GET methods', async () => {
    const response = await handleApi(
      new Request('https://atlas.test/api/v1', { method: 'POST' }),
      ENV
    );

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'method_not_allowed' },
    });
  });

  it('answers an OPTIONS preflight with 204 and CORS headers', async () => {
    const response = await handleApi(
      new Request('https://atlas.test/api/v1/postcodes/LA-11-A12-AK-08', { method: 'OPTIONS' }),
      ENV
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toContain('GET');
  });

  it('serves the Vercel carried-path form', async () => {
    stubLookup(jsonResponse(NDAPS_BODY));

    const response = await handleApi(
      new Request(
        'https://atlas.test/api/v1/%5B...path%5D?path=%2Fpostcodes%2FLA-11-A12-AK-08'
      ),
      ENV
    );

    expect(response.status).toBe(200);
  });
});
