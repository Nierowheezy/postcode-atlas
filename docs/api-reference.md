# Developer API reference

The Atlas public API serves read-only JSON for Nigeria's NDAPS addressing
hierarchy: postcode lookups and decodes, the state-to-area reference lists,
editorial explanations, and coordinate search. It is the same data the Atlas app
uses, exposed with one stable contract.

## Base URL and version

| Item | Value |
| --- | --- |
| Base URL | `/api/v1` on the deployment host |
| Version | `1` |
| Service check | `GET /api/v1/` returns the name and version |
| Methods | `GET`; `OPTIONS` answers `204` |
| Content type | `application/json` |

Version 1 is carried by the base path, so a future version can live beside it.
Every route is read-only: no writes, no sessions, no cookies.

## Authentication

Authentication is optional and configured by the operator:

- `ATLAS_API_KEYS` unset, empty, or whitespace only: the API is open. This is the
  default and suits local development and demos.
- `ATLAS_API_KEYS` set to a comma-separated list: every request must present one
  of those keys.

Send the key as either header:

```http
Authorization: Bearer <key>
```

```http
X-API-Key: <key>
```

`Authorization` wins when both are present. The scheme is case-insensitive; any
other scheme is ignored, so `X-API-Key` is still read.

A missing or wrong key returns `401`:

```json
{ "error": { "code": "unauthorized", "message": "..." } }
```

with `www-authenticate: Bearer`.

Keys are server-side environment values. There is no sign-up endpoint.

## Rate limits

Every request is counted against the caller:

| Item | Value |
| --- | --- |
| Setting | `ATLAS_API_RATE_LIMIT` |
| Meaning | Requests per identity per window |
| Default | `60` |
| Window | 60 seconds |
| Identity | `key:<key>` when authenticated, otherwise `ip:<client ip>` |

A value that is not a positive integer falls back to the default. The client IP
is the first `x-forwarded-for` hop, then `x-real-ip`, then `unknown`.

Over the limit the API returns `429`:

```json
{ "error": { "code": "rate_limited", "message": "..." } }
```

with a `retry-after` header holding whole seconds until the window resets. The
window is not extended by a limited attempt.

The limiter is in-memory and per instance: a cold start clears it and each
instance counts on its own, so treat it as abuse protection rather than an
accurate quota.

## Responses

Every success is:

```json
{ "data": ... }
```

Every failure is:

```json
{ "error": { "code": "...", "message": "..." } }
```

`code` is stable and scriptable; `message` is human-readable and may change.
`cache-control` is set per route, and every error is `no-store`.

## CORS

| Header | Value |
| --- | --- |
| `access-control-allow-origin` | `*` |
| `access-control-allow-methods` | `GET, OPTIONS` |
| `access-control-allow-headers` | `Content-Type, Authorization, X-API-Key` |
| `access-control-expose-headers` | `Retry-After` |

`OPTIONS` answers `204` and is never gated or rate limited, so a browser
preflight always succeeds.

## Errors

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `invalid_code` | A path or query parameter is malformed |
| `401` | `unauthorized` | Keys are configured and the request has none, or none matches |
| `404` | `not_found` | The resource does not exist |
| `404` | `unknown_route` | No route matches the path |
| `405` | `method_not_allowed` | The method is not `GET` or `OPTIONS` |
| `429` | `rate_limited` | The caller passed its allowance for the window |
| `500` | `not_configured` | The server has no NDAPS key for a route that needs one |
| `500` | `internal_error` | An unexpected server failure |
| `502` | `upstream_unreachable` | The NIPOST gateway could not be reached |
| `502` | `upstream_error` | The NIPOST gateway returned an unusable response |

`unauthorized` and `rate_limited` are answered before routing, so an
unauthenticated `POST` or an unknown path returns `401` rather than `405` or
`404` while keys are configured.

## Endpoints

Every route is `GET`. Names in `{braces}` are path parameters.

| Route | Returns | `max-age` |
| --- | --- | --- |
| `GET /` | Service name and version | 300 |
| `GET /postcodes/{code}` | One postcode record | 300 |
| `GET /postcodes/{code}/segments` | The decoded postcode, no upstream call | 3600 |
| `GET /search/autocomplete?q=` | Suggestions for a partial name | 300 |
| `GET /search/nearby?lat=&lng=&radius=` | Postcodes near a point | 300 |
| `GET /search/reverse?lat=&lng=` | The postcode for a point | 300 |
| `GET /states` | States | 3600 |
| `GET /states/{state}/lgas` | LGAs of a state | 3600 |
| `GET /states/{state}/lgas/{lga}/districts` | Districts of an LGA | 3600 |
| `GET /states/{state}/lgas/{lga}/districts/{district}/areas` | Areas of a district | 3600 |
| `GET /explanations` | Editorial topic index | 86400 |
| `GET /explanations/{topic}` | One editorial explanation | 86400 |

`cache-control` is `public, max-age=<seconds>`; errors are `no-store`. A
trailing slash is ignored, so `/states/` and `/states` are the same.

### Service check

```bash
curl "https://<host>/api/v1/"
```

```json
{ "data": { "name": "Postcode Atlas API", "version": 1 } }
```

### Postcodes

A postcode is `AA-99-H77-BB-55`: two letters, two digits, three alphanumeric
district characters, two letters, and two digits. Dashed, spaced, and compact
forms are accepted, case-insensitively:

```text
LA-11-A12-AK-08
LA 11 A12 AK 08
LA11A12AK08
```

A malformed code is `400 invalid_code`, whatever the route.

**`GET /api/v1/postcodes/{code}`** looks the code up and returns the record. A
well-formed code NDAPS does not know is `404 not_found`. This route needs a
server NDAPS key, so without one it is `500 not_configured`.

```bash
curl "https://<host>/api/v1/postcodes/LA-11-A12-AK-08"
```

```json
{
  "data": {
    "code": "LA-11-A12-AK-08",
    "display": "LA 11 A12 AK 08",
    "compact": "LA11A12AK08",
    "segments": {
      "state": "LA",
      "lga": "11",
      "district": "A12",
      "area": "AK",
      "unit": "08"
    },
    "coordinates": { "lat": 6.6018, "lng": 3.349 },
    "address": "12 Adeola Street",
    "locality": "Ikeja",
    "buildingUse": "residential",
    "status": "active",
    "valid": true,
    "verified": true,
    "source": "nipost-ndaps"
  }
}
```

`coordinates`, `address`, `locality`, `buildingUse`, and `status` are omitted
when NDAPS does not send them. `valid` is `false` only when NDAPS says so, and
`verified` is `true` only when NDAPS marks the address verified. `source` is
always `nipost-ndaps`.

**`GET /api/v1/postcodes/{code}/segments`** decodes the code structurally, with
no upstream call. It works when the gateway is down and with no key.

```bash
curl "https://<host>/api/v1/postcodes/LA-11-A12-AK-08/segments"
```

```json
{
  "data": {
    "code": "LA-11-A12-AK-08",
    "display": "LA 11 A12 AK 08",
    "compact": "LA11A12AK08",
    "segments": {
      "state": "LA",
      "lga": "11",
      "district": "A12",
      "area": "AK",
      "unit": "08"
    }
  }
}
```

### Search

**`GET /api/v1/search/autocomplete?q=`** names a level and suggests codes for it.

| Param | Required | Value |
| --- | --- | --- |
| `q` | Yes | Up to 64 characters, trimmed |

A missing, blank, or over-long `q` is `400 invalid_code`.

```bash
curl "https://<host>/api/v1/search/autocomplete?q=lag"
```

```json
{
  "data": {
    "segment": "state",
    "suggestions": [{ "code": "LA", "label": "Lagos" }]
  }
}
```

`segment` is NDAPS's inference of the level the query names: `state`, `lga`,
`district`, or `area`. `label` is omitted when NDAPS sends only a code. An empty
`suggestions` list is a valid answer.

**`GET /api/v1/search/nearby?lat=&lng=&radius=`** lists postcodes near a point.

| Param | Required | Value |
| --- | --- | --- |
| `lat` | Yes | `-90` to `90` |
| `lng` | Yes | `-180` to `180` |
| `radius` | No | Integer `1` to `300` metres; default `300` |

Invalid coordinates or a radius outside that range is `400 invalid_code`. An
empty array is a valid answer.

```bash
curl "https://<host>/api/v1/search/nearby?lat=6.6018&lng=3.349&radius=300"
```

```json
{
  "data": [
    {
      "code": "LA-11-A12-AK-08",
      "display": "LA 11 A12 AK 08",
      "compact": "LA11A12AK08",
      "state": "LA",
      "stateName": "Lagos",
      "lga": "11",
      "area": "AK",
      "unit": "08",
      "coordinates": { "lat": 6.6018, "lng": 3.349 },
      "distanceMetres": 42,
      "address": "12 Adeola Street"
    }
  ]
}
```

The unit fields mirror the nearby unit: `stateName`, `lgaName`, `district`,
`coordinates`, `distanceMetres`, and `address` are present only when known.
`distanceMetres` is the distance from the queried point.

**`GET /api/v1/search/reverse?lat=&lng=`** resolves one point with a fixed 250 m
radius.

| Param | Required | Value |
| --- | --- | --- |
| `lat` | Yes | `-90` to `90` |
| `lng` | Yes | `-180` to `180` |

Invalid coordinates are `400 invalid_code`; nothing within 250 m is
`404 not_found` with the message `No postcode was found near that point.`

```json
{
  "data": {
    "code": "LA-11-A12-AK-08",
    "display": "LA 11 A12 AK 08",
    "compact": "LA11A12AK08",
    "state": "LA",
    "stateName": "Lagos",
    "lga": "11",
    "area": "AK",
    "unit": "08",
    "coordinates": { "lat": 6.6018, "lng": 3.349 }
  }
}
```

`coordinates` echoes the requested point, matching the browser client.

### Reference hierarchy

Each path parameter is trimmed and upper-cased, then checked against its level:

| Parameter | Shape | Example |
| --- | --- | --- |
| `{state}` | Two letters | `LA` |
| `{lga}` | Two digits | `11` |
| `{district}` | Three letters or digits | `A12` |

A well-formed parameter that NDAPS does not know is `404 not_found`. A
malformed one is `400 invalid_code`.

```bash
curl "https://<host>/api/v1/states"
curl "https://<host>/api/v1/states/LA/lgas"
curl "https://<host>/api/v1/states/LA/lgas/11/districts"
curl "https://<host>/api/v1/states/LA/lgas/11/districts/A12/areas"
```

States and LGAs carry names:

```json
{ "data": [{ "code": "LA", "name": "Lagos" }] }
```

```json
{ "data": [{ "code": "11", "name": "Ikeja" }] }
```

Districts and areas are code-only, so `name` is absent:

```json
{ "data": [{ "code": "A12" }] }
```

`GET /api/v1/states` needs no parent and is the only route here that does not.

### Editorial explanations

The four topics are `hierarchy`, `postcode_parts`, `single_postcode`, and
`ndaps`.

**`GET /api/v1/explanations`** lists them in declaration order.

```json
{
  "data": [
    { "topic": "hierarchy", "title": "How Nigeria's digital addressing hierarchy works", "source": "editorial" }
  ]
}
```

**`GET /api/v1/explanations/{topic}`** returns one explanation. The topic is
trimmed and lower-cased, so `ndaps` and ` NDAPS ` resolve alike. An unknown topic
is `404 not_found`.

```json
{
  "data": {
    "topic": "postcode_parts",
    "title": "What each part of a postcode means",
    "summary": "...",
    "points": ["..."],
    "example": "LA-11-A12-AK-08",
    "source": "editorial"
  }
}
```

`example` is present only for topics that have one. `source` is `editorial` -
this is Atlas prose, not a NIPOST record.
