import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from './access';
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

/** A request with explicit headers, for the access-gate cases. */
function requestWith(
  headers: Record<string, string>,
  path = '/api/v1/explanations'
): Request {
  return new Request(`https://atlas.test${path}`, { headers });
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
  resetRateLimits();
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

describe('handleApi hierarchy routes', () => {
  const STATES_BODY = { data: { states: [{ code: 'LA', name: 'Lagos' }] } };
  const LGAS_BODY = { data: { lgas: [{ code: '11', name: 'Ikeja' }] } };
  const DISTRICTS_BODY = { data: { districts: [{ code: 'A12' }] } };
  const AREAS_BODY = { data: { areas: [{ code: 'AK' }] } };

  it('lists states with a one-hour cache', async () => {
    const fetchMock = stubLookup(jsonResponse(STATES_BODY));

    const response = await handleApi(get('/api/v1/states'), ENV);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith('https://api.postcode.gov.ng/v1/reference/states', {
      headers: { 'X-API-Key': 'nipost_pk_test' },
    });
    expect(response.headers.get('cache-control')).toContain('max-age=3600');
    await expect(response.json()).resolves.toEqual({ data: [{ code: 'LA', name: 'Lagos' }] });
  });

  it('lists LGAs for a state', async () => {
    const fetchMock = stubLookup(jsonResponse(LGAS_BODY));

    const response = await handleApi(get('/api/v1/states/LA/lgas'), ENV);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postcode.gov.ng/v1/reference/lgas?state=LA',
      { headers: { 'X-API-Key': 'nipost_pk_test' } }
    );
    await expect(response.json()).resolves.toEqual({ data: [{ code: '11', name: 'Ikeja' }] });
  });

  it('lists districts for a state and LGA', async () => {
    const fetchMock = stubLookup(jsonResponse(DISTRICTS_BODY));

    const response = await handleApi(get('/api/v1/states/LA/lgas/11/districts'), ENV);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postcode.gov.ng/v1/reference/districts?state=LA&lga=11',
      { headers: { 'X-API-Key': 'nipost_pk_test' } }
    );
    await expect(response.json()).resolves.toEqual({ data: [{ code: 'A12' }] });
  });

  it('lists areas for a state, LGA, and district', async () => {
    const fetchMock = stubLookup(jsonResponse(AREAS_BODY));

    const response = await handleApi(get('/api/v1/states/LA/lgas/11/districts/A12/areas'), ENV);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postcode.gov.ng/v1/reference/areas?state=LA&lga=11&district=A12',
      { headers: { 'X-API-Key': 'nipost_pk_test' } }
    );
    await expect(response.json()).resolves.toEqual({ data: [{ code: 'AK' }] });
  });

  it('normalizes lower-case path params before the call', async () => {
    const fetchMock = stubLookup(jsonResponse(AREAS_BODY));

    await handleApi(get('/api/v1/states/la/lgas/11/districts/a12/areas'), ENV);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postcode.gov.ng/v1/reference/areas?state=LA&lga=11&district=A12',
      { headers: { 'X-API-Key': 'nipost_pk_test' } }
    );
  });

  it('rejects a malformed param without calling upstream', async () => {
    const fetchMock = stubLookup(jsonResponse(STATES_BODY));

    const response = await handleApi(get('/api/v1/states/l1/lgas'), ENV);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'invalid_code' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed LGA in a deeper path without calling upstream', async () => {
    const fetchMock = stubLookup(jsonResponse(STATES_BODY));

    const response = await handleApi(get('/api/v1/states/LA/lgas/xx/districts'), ENV);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'invalid_code' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps an unknown state (upstream 400) to not_found', async () => {
    stubLookup(new Response(JSON.stringify({ error: { code: 'bad_request' } }), { status: 400 }));

    const response = await handleApi(get('/api/v1/states/ZZ/lgas'), ENV);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_found' } });
  });

  it('keeps an empty list a 200 with an empty array', async () => {
    stubLookup(jsonResponse({ data: { districts: [] } }));

    const response = await handleApi(get('/api/v1/states/LA/lgas/99/districts'), ENV);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [] });
  });

  it('treats a body missing the list key as an empty list', async () => {
    stubLookup(jsonResponse({ data: {} }));

    const response = await handleApi(get('/api/v1/states'), ENV);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [] });
  });

  it('maps a 5xx upstream failure to upstream_error', async () => {
    stubLookup(new Response('boom', { status: 503 }));

    const response = await handleApi(get('/api/v1/states'), ENV);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'upstream_error' } });
  });

  it('maps an unreachable gateway to upstream_unreachable', async () => {
    stubLookup(new Error('offline'));

    const response = await handleApi(get('/api/v1/states'), ENV);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'upstream_unreachable' },
    });
  });

  it('maps a non-JSON upstream body to upstream_error', async () => {
    stubLookup(new Response('<html>no</html>', { status: 200 }));

    const response = await handleApi(get('/api/v1/states'), ENV);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'upstream_error' } });
  });

  it('reports not_configured when the server holds no key', async () => {
    const response = await handleApi(get('/api/v1/states'), {});

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_configured' } });
  });

  it('returns unknown_route for a hierarchy prefix with no leaf route', async () => {
    const response = await handleApi(get('/api/v1/states/LA'), ENV);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'unknown_route' } });
  });
});

describe('handleApi search and decode routes', () => {
  const AUTOCOMPLETE_BODY = {
    data: { segment: 'state', suggestions: [{ code: 'LA', label: 'Lagos' }] },
  };

  it('answers an autocomplete query with the mapped suggestions and a five-minute cache', async () => {
    const fetchMock = stubLookup(jsonResponse(AUTOCOMPLETE_BODY));

    const response = await handleApi(get('/api/v1/search/autocomplete?q=lag'), ENV);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postcode.gov.ng/v1/search/autocomplete?q=lag',
      { headers: { 'X-API-Key': 'nipost_pk_test' } }
    );
    expect(response.headers.get('cache-control')).toContain('max-age=300');
    await expect(response.json()).resolves.toEqual({
      data: { segment: 'state', suggestions: [{ code: 'LA', label: 'Lagos' }] },
    });
  });

  it('trims the autocomplete query before the upstream call', async () => {
    const fetchMock = stubLookup(jsonResponse(AUTOCOMPLETE_BODY));

    await handleApi(get('/api/v1/search/autocomplete?q=%20lag%20'), ENV);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postcode.gov.ng/v1/search/autocomplete?q=lag',
      { headers: { 'X-API-Key': 'nipost_pk_test' } }
    );
  });

  it('serves the Vercel carried-path form with its query string', async () => {
    const fetchMock = stubLookup(jsonResponse(AUTOCOMPLETE_BODY));

    const response = await handleApi(
      new Request('https://atlas.test/api/v1/%5B...path%5D?path=%2Fsearch%2Fautocomplete&q=lag'),
      ENV
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postcode.gov.ng/v1/search/autocomplete?q=lag',
      { headers: { 'X-API-Key': 'nipost_pk_test' } }
    );
  });

  it('rejects an empty or missing autocomplete query without calling upstream', async () => {
    const fetchMock = stubLookup(jsonResponse(AUTOCOMPLETE_BODY));

    const empty = await handleApi(get('/api/v1/search/autocomplete?q='), ENV);
    const missing = await handleApi(get('/api/v1/search/autocomplete'), ENV);

    expect(empty.status).toBe(400);
    expect(missing.status).toBe(400);
    await expect(empty.json()).resolves.toMatchObject({ error: { code: 'invalid_code' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps an upstream failure on autocomplete to upstream_error', async () => {
    stubLookup(new Response('boom', { status: 503 }));

    const response = await handleApi(get('/api/v1/search/autocomplete?q=lag'), ENV);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'upstream_error' } });
  });

  it('maps an unreachable gateway on autocomplete to upstream_unreachable', async () => {
    stubLookup(new Error('offline'));

    const response = await handleApi(get('/api/v1/search/autocomplete?q=lag'), ENV);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'upstream_unreachable' },
    });
  });

  it('reports not_configured on autocomplete when the server holds no key', async () => {
    const response = await handleApi(get('/api/v1/search/autocomplete?q=lag'), {});

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_configured' } });
  });

  it('decodes a compact code locally with no upstream call and an hour cache', async () => {
    const fetchMock = stubLookup(jsonResponse({ data: {} }));

    const response = await handleApi(get('/api/v1/postcodes/LA11A12AK08/segments'), ENV);

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toContain('max-age=3600');
    await expect(response.json()).resolves.toEqual({
      data: {
        code: 'LA-11-A12-AK-08',
        display: 'LA 11 A12 AK 08',
        compact: 'LA11A12AK08',
        segments: { state: 'LA', lga: '11', district: 'A12', area: 'AK', unit: '08' },
      },
    });
  });

  it('decodes even when the server holds no gateway key', async () => {
    const response = await handleApi(get('/api/v1/postcodes/LA11A12AK08/segments'), {});

    expect(response.status).toBe(200);
  });

  it('rejects a malformed decode code with invalid_code and no upstream call', async () => {
    const fetchMock = stubLookup(jsonResponse({ data: {} }));

    const response = await handleApi(get('/api/v1/postcodes/not-a-code/segments'), ENV);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'invalid_code' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('handleApi nearby and reverse routes', () => {
  const NEARBY_BODY = {
    data: [
      {
        postcode: 'LA-11-A12-AK-08',
        point_geometry: { coordinates: [3.349, 6.6018] },
        distance_m: 12.5,
      },
    ],
  };

  it('answers a nearby search with the mapped units and the default radius', async () => {
    const fetchMock = stubLookup(jsonResponse(NEARBY_BODY));

    const response = await handleApi(get('/api/v1/search/nearby?lat=6.6018&lng=3.349'), ENV);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postcode.gov.ng/v1/search/nearby?lat=6.6018&lng=3.349&radius=300',
      { headers: { 'X-API-Key': 'nipost_pk_test' } }
    );
    expect(response.headers.get('cache-control')).toContain('max-age=300');
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          code: 'LA-11-A12-AK-08',
          display: 'LA 11 A12 AK 08',
          compact: 'LA11A12AK08',
          coordinates: { lat: 6.6018, lng: 3.349 },
          distanceMetres: 12.5,
        },
      ],
    });
  });

  it('passes an explicit radius through', async () => {
    const fetchMock = stubLookup(jsonResponse(NEARBY_BODY));

    await handleApi(get('/api/v1/search/nearby?lat=6.5&lng=3.3&radius=50'), ENV);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postcode.gov.ng/v1/search/nearby?lat=6.5&lng=3.3&radius=50',
      { headers: { 'X-API-Key': 'nipost_pk_test' } }
    );
  });

  it('keeps an empty nearby list a 200 with an empty array', async () => {
    stubLookup(jsonResponse({ data: [] }));

    const response = await handleApi(get('/api/v1/search/nearby?lat=6.5&lng=3.3'), ENV);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [] });
  });

  it('rejects a missing or out-of-range coordinate without calling upstream', async () => {
    const fetchMock = stubLookup(jsonResponse(NEARBY_BODY));

    const missing = await handleApi(get('/api/v1/search/nearby?lat=abc&lng=3.3'), ENV);
    const range = await handleApi(get('/api/v1/search/nearby?lat=91&lng=3.3'), ENV);

    expect(missing.status).toBe(400);
    expect(range.status).toBe(400);
    await expect(missing.json()).resolves.toMatchObject({ error: { code: 'invalid_code' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range radius without calling upstream', async () => {
    const fetchMock = stubLookup(jsonResponse(NEARBY_BODY));

    const response = await handleApi(get('/api/v1/search/nearby?lat=6.5&lng=3.3&radius=0'), ENV);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'invalid_code' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a non-2xx nearby failure to upstream_error', async () => {
    stubLookup(new Response('boom', { status: 503 }));

    const response = await handleApi(get('/api/v1/search/nearby?lat=6.5&lng=3.3'), ENV);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'upstream_error' } });
  });

  it('maps an unreachable gateway on nearby to upstream_unreachable', async () => {
    stubLookup(new Error('offline'));

    const response = await handleApi(get('/api/v1/search/nearby?lat=6.5&lng=3.3'), ENV);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'upstream_unreachable' },
    });
  });

  it('reports not_configured on nearby when the server holds no key', async () => {
    const response = await handleApi(get('/api/v1/search/nearby?lat=6.5&lng=3.3'), {});

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_configured' } });
  });

  it('reverse-geocodes a hit, echoing the query point and the fixed search radius', async () => {
    const fetchMock = stubLookup(
      jsonResponse({
        data: {
          found: true,
          state: 'LA',
          district: 'A12',
          area: 'AK',
          unit: { postcode: 'LA-11-A12-AK-08', display: 'LA 11 A12 AK 08', distance_m: 42 },
        },
      })
    );

    const response = await handleApi(get('/api/v1/search/reverse?lat=6.5&lng=3.3'), ENV);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postcode.gov.ng/v1/search/reverse?lat=6.5&lng=3.3&max_distance_m=250',
      { headers: { 'X-API-Key': 'nipost_pk_test' } }
    );
    expect(response.headers.get('cache-control')).toContain('max-age=300');
    await expect(response.json()).resolves.toEqual({
      data: {
        code: 'LA-11-A12-AK-08',
        display: 'LA 11 A12 AK 08',
        compact: 'LA11A12AK08',
        coordinates: { lat: 6.5, lng: 3.3 },
        state: 'LA',
        district: 'A12',
        area: 'AK',
        distanceMetres: 42,
      },
    });
  });

  it('maps a reverse miss to 404 not_found', async () => {
    stubLookup(jsonResponse({ data: { found: false, radius_m: 25 } }));

    const response = await handleApi(get('/api/v1/search/reverse?lat=6.5&lng=3.3'), ENV);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_found' } });
  });

  it('rejects a malformed reverse coordinate without calling upstream', async () => {
    const fetchMock = stubLookup(jsonResponse({ data: { found: false } }));

    const response = await handleApi(get('/api/v1/search/reverse?lat=6.5'), ENV);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'invalid_code' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a non-2xx reverse failure to upstream_error', async () => {
    stubLookup(new Response('boom', { status: 500 }));

    const response = await handleApi(get('/api/v1/search/reverse?lat=6.5&lng=3.3'), ENV);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'upstream_error' } });
  });
});

describe('handleApi explanation routes', () => {
  it('serves the editorial index with a one-day cache and no upstream call', async () => {
    const fetchMock = stubLookup(jsonResponse({ data: {} }));

    const response = await handleApi(get('/api/v1/explanations'), ENV);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('max-age=86400');
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          topic: 'hierarchy',
          title: "How Nigeria's digital addressing hierarchy works",
          source: 'editorial',
        },
        {
          topic: 'postcode_parts',
          title: 'What each part of a postcode means',
          source: 'editorial',
        },
        {
          topic: 'single_postcode',
          title: 'Why a state or LGA has no single postcode',
          source: 'editorial',
        },
        { topic: 'ndaps', title: 'What NDAPS is', source: 'editorial' },
      ],
    });
  });

  it('serves one explanation with its content and the editorial source', async () => {
    const fetchMock = stubLookup(jsonResponse({ data: {} }));

    const response = await handleApi(get('/api/v1/explanations/postcode_parts'), ENV);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('max-age=86400');
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      data: {
        topic: 'postcode_parts',
        title: 'What each part of a postcode means',
        example: 'LA-11-A12-AK-08',
        source: 'editorial',
      },
    });
  });

  it('serves an explanation with no gateway key configured', async () => {
    const response = await handleApi(get('/api/v1/explanations/hierarchy'), {});

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { topic: 'hierarchy', source: 'editorial' },
    });
  });

  it('resolves a mixed-case topic and a trailing slash', async () => {
    const mixedCase = await handleApi(get('/api/v1/explanations/Hierarchy'), ENV);
    const trailingSlash = await handleApi(get('/api/v1/explanations/'), ENV);

    expect(mixedCase.status).toBe(200);
    await expect(mixedCase.json()).resolves.toMatchObject({
      data: { topic: 'hierarchy', source: 'editorial' },
    });
    expect(trailingSlash.status).toBe(200);
    await expect(trailingSlash.json()).resolves.toEqual({
      data: expect.arrayContaining([
        expect.objectContaining({ topic: 'ndaps', source: 'editorial' }),
      ]),
    });
  });

  it('maps an unknown topic to 404 not_found without an upstream call', async () => {
    const fetchMock = stubLookup(jsonResponse({ data: {} }));

    const response = await handleApi(get('/api/v1/explanations/not_a_topic'), ENV);

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_found' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('access gate', () => {
  const KEYS_ENV = { ...ENV, ATLAS_API_KEYS: 'key-one,key-two' };

  it('rejects a keyless request when keys are configured', async () => {
    const response = await handleApi(get('/api/v1/explanations'), KEYS_ENV);

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer');
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'unauthorized' },
    });
  });

  it('rejects a wrong key and a non-Bearer scheme', async () => {
    for (const authorization of ['Bearer wrong', 'Basic key-one']) {
      const response = await handleApi(
        requestWith({ authorization }),
        KEYS_ENV
      );
      expect(response.status).toBe(401);
    }
  });

  it('accepts either header', async () => {
    const bearer = await handleApi(requestWith({ authorization: 'Bearer key-one' }), KEYS_ENV);
    expect(bearer.status).toBe(200);

    const apiKey = await handleApi(requestWith({ 'x-api-key': 'key-two' }), KEYS_ENV);
    expect(apiKey.status).toBe(200);
  });

  it('gates before the method check and routing', async () => {
    const post = await handleApi(
      new Request('https://atlas.test/api/v1/explanations', { method: 'POST' }),
      KEYS_ENV
    );
    expect(post.status).toBe(401);

    const unknown = await handleApi(get('/api/v1/nope'), KEYS_ENV);
    expect(unknown.status).toBe(401);
  });

  it('never gates a preflight', async () => {
    const response = await handleApi(
      new Request('https://atlas.test/api/v1/explanations', { method: 'OPTIONS' }),
      KEYS_ENV
    );

    expect(response.status).toBe(204);
  });

  it('stays open when no keys are configured', async () => {
    const response = await handleApi(get('/api/v1/explanations'), ENV);

    expect(response.status).toBe(200);
  });

  it('advertises the key headers and the retry header in CORS', async () => {
    const response = await handleApi(get('/api/v1/explanations'), ENV);
    const allowed = response.headers.get('access-control-allow-headers') ?? '';

    expect(allowed).toContain('Authorization');
    expect(allowed).toContain('X-API-Key');
    expect(response.headers.get('access-control-expose-headers')).toBe('Retry-After');
  });

  it('returns 429 past the limit and leaves another identity alone', async () => {
    const limited = { ...ENV, ATLAS_API_RATE_LIMIT: '2' };
    const headers = { 'x-forwarded-for': '10.0.0.1' };

    expect((await handleApi(requestWith(headers), limited)).status).toBe(200);
    expect((await handleApi(requestWith(headers), limited)).status).toBe(200);

    const blocked = await handleApi(requestWith(headers), limited);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
    expect(blocked.headers.get('cache-control')).toBe('no-store');
    await expect(blocked.json()).resolves.toMatchObject({ error: { code: 'rate_limited' } });

    const other = await handleApi(
      requestWith({ 'x-forwarded-for': '10.0.0.2' }),
      limited
    );
    expect(other.status).toBe(200);
  });

  it('limits a valid key independently of the client IP bucket', async () => {
    const limited = { ...ENV, ATLAS_API_KEYS: 'key-one', ATLAS_API_RATE_LIMIT: '1' };
    const keyed = { authorization: 'Bearer key-one', 'x-forwarded-for': '10.0.0.3' };

    expect((await handleApi(requestWith(keyed), limited)).status).toBe(200);
    expect((await handleApi(requestWith(keyed), limited)).status).toBe(429);

    // The same IP without a key is a different identity with its own window, so
    // it is rejected for the missing key, not blocked by the key's bucket.
    const unauthenticated = await handleApi(
      requestWith({ 'x-forwarded-for': '10.0.0.3' }),
      limited
    );
    expect(unauthenticated.status).toBe(401);
  });
});
