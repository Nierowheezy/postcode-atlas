# Developer API examples

Copy-pasteable snippets for the [`/api/v1` reference](api-reference.md). Replace
`http://localhost:3001` with your host in production.

## Local development

The API is served by the dev server alongside the app:

```bash
npm run dev
```

It listens on `http://localhost:3001`. The API is open unless a key list is set,
so both of these work:

```bash
# open /api/v1 (the default)
npm run dev

# require a key and cap each caller at 5 requests per minute
ATLAS_API_KEYS=dev-key ATLAS_API_RATE_LIMIT=5 npm run dev
```

`ATLAS_API_KEYS` is a comma-separated list, so `dev-key,second-key` accepts
either. `ATLAS_API_RATE_LIMIT` is requests per identity per 60 seconds and
defaults to 60. The [reference](api-reference.md#authentication) names the
identity rule and the per-instance caveat.

The env vars are operator settings; there is no sign-up endpoint.

## curl

Service check:

```bash
curl -s "http://localhost:3001/api/v1/"
```

Read a postcode and decode it:

```bash
curl -s "http://localhost:3001/api/v1/postcodes/LA-11-A12-AK-08"
curl -s "http://localhost:3001/api/v1/postcodes/LA11A12AK08/segments"
```

Search by name or by point:

```bash
curl -s "http://localhost:3001/api/v1/search/autocomplete?q=ikeja"
curl -s "http://localhost:3001/api/v1/search/nearby?lat=6.6018&lng=3.349&radius=300"
curl -s "http://localhost:3001/api/v1/search/reverse?lat=6.6018&lng=3.349"
```

Walk the hierarchy:

```bash
curl -s "http://localhost:3001/api/v1/states"
curl -s "http://localhost:3001/api/v1/states/LA/lgas"
curl -s "http://localhost:3001/api/v1/states/LA/lgas/11/districts"
curl -s "http://localhost:3001/api/v1/states/LA/lgas/11/districts/A12/areas"
```

Read the editorial explanations:

```bash
curl -s "http://localhost:3001/api/v1/explanations"
curl -s "http://localhost:3001/api/v1/explanations/ndaps"
```

Send a key when one is configured:

```bash
curl -s -H "Authorization: Bearer dev-key" "http://localhost:3001/api/v1/states"
curl -s -H "X-API-Key: dev-key" "http://localhost:3001/api/v1/states"
```

Only `GET` is served; `OPTIONS` answers `204` for a browser preflight.

## A typed client

The envelope is the same on every route, so one helper covers the API. This
client retries `429` with the server's `Retry-After`.

```ts
const BASE_URL = process.env.ATLAS_API_URL ?? 'https://<host>/api/v1';
const API_KEY = process.env.ATLAS_API_KEY;

/** One row of a hierarchy list. `name` is absent for districts and areas. */
export interface AtlasNamedCode {
  code: string;
  name?: string;
}

/** The postcode lookup record. Optional fields are omitted when unknown. */
export interface AtlasPostcodeRecord {
  code: string;
  display: string;
  compact: string;
  segments: { state: string; lga: string; district: string; area: string; unit: string };
  coordinates?: { lat: number; lng: number };
  address?: string;
  locality?: string;
  buildingUse?: string;
  status?: string;
  valid: boolean;
  verified: boolean;
  source: 'nipost-ndaps';
}

/** A failed request, already unwrapped from the error envelope. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

async function call<T>(path: string, attempts = 3): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {},
    });

    if (response.ok) {
      const body = (await response.json()) as { data: T };
      return body.data;
    }

    if (response.status === 429 && attempt < attempts) {
      const seconds = Number(response.headers.get('retry-after') ?? 60);
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      continue;
    }

    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    throw new ApiError(
      response.status,
      body.error?.code ?? 'unknown',
      body.error?.message ?? response.statusText
    );
  }
}

export const listStates = () => call<AtlasNamedCode[]>('/states');

export const listLgas = (state: string) =>
  call<AtlasNamedCode[]>(`/states/${state}/lgas`);

export const getPostcode = (code: string) =>
  call<AtlasPostcodeRecord>(`/postcodes/${code}`);
```

## Handling errors

Branch on `error.code`, not on `message`: the code is stable, the message is not.

```ts
import { ApiError, getPostcode } from './atlas-client';

try {
  const record = await getPostcode('LA-11-A12-AK-08');
  console.log(record.locality);
} catch (error) {
  if (error instanceof ApiError) {
    // 401 unauthorized, 404 not_found, 429 rate_limited, ...
    console.error(error.status, error.code, error.message);
  }
}
```

A `401` also carries `www-authenticate: Bearer`, and a `429` carries
`retry-after` in whole seconds. Nothing else is added on the success path, so a
successful response needs only `data`.
