# Feature: Developer API foundation and postcode lookup

**From build-plan:** feature 21a
**Status:** verified

## Goal

Open the Atlas postcode data to external applications through a stable, versioned
HTTP API. This sub-feature builds the server-side foundation the rest of feature
21 needs - a shared NDAPS gateway client and one locked public contract (success
and error envelopes, error codes, CORS, cache headers) - and proves it end to end
with postcode lookup, `GET /api/v1/postcodes/{code}`. Today the Atlas can only
read postcodes inside the browser, over `/api/nipost`; there is no server-side way
to answer a postcode query as normalized JSON.

## In scope

- `src/server/nipost/gateway.ts`: a server-side NDAPS client that shares the
  proxy's base-URL and key resolution and returns typed JSON results
  (`fetchNipostJson`) instead of a passthrough `Response`.
- A public API mounted at `/api/v1`, served by both runtimes exactly like the
  existing `/api/nipost` and `/api/ask`: a Vercel Function
  (`api/v1/[...path].ts`) plus identical Vite dev middleware, and the
  `vercel.json` rewrite placed before the SPA fallback.
- The locked public contract (see Data / contracts): `{ data }` on success,
  `{ error: { code, message } }` on failure, one HTTP status per error code,
  `Access-Control-Allow-Origin: *`, `OPTIONS` preflight, and `Cache-Control` on
  success.
- Two routes: `GET /api/v1` (service identity, name plus version) and
  `GET /api/v1/postcodes/{code}` (a normalized postcode record).
- Postcode normalization: accept dashed (`LA-11-A12-AK-08`), spaced, and
  11-character compact forms; reject anything else.
- Unit tests for the gateway client, the normalizer/mapper, the router and
  envelope, and the new Vercel rewrite ordering.

## Out of scope

- Every other endpoint - states, LGAs, districts, areas, free-text search,
  postcode decode, nearby, and editorial explanations: feature 21b.
- API keys, rate limiting, quotas, tiers, accounts, and billing: feature 21c.
- Documentation, examples, and OpenAPI: feature 22.
- The internal model-facing tool layer (`src/lib/tools/*`), the Ask Atlas
  provider path, and the browser client `src/lib/api/postcodeClient.ts` are
  untouched. The public API does not call `runTool`, and server code must never
  import browser-only modules.
- Address interpretation (`interpretAddress`) as a public endpoint: not part of
  feature 21's default surface.
- Map control (`navigateMap`), any UI, and any change to the app shell.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files) - you read and understand it.
4. You approve, then either take a checkpoint commit or continue straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at
   the end.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big - split it.

## Build steps

- [x] **Step 1 - Shared NDAPS gateway client** - add
  `src/server/nipost/gateway.ts` exporting `resolveNipostBaseUrl(env)`,
  `readNipostApiKey(env)`, and `fetchNipostJson(pathname, params, env)`; the last
  builds the upstream URL with `URLSearchParams`, sends `X-API-Key`, and returns
  `{ ok: true; status; data }` or
  `{ ok: false; reason: 'not_configured' | 'unreachable' | 'bad_response' | 'upstream_status'; status }`.
  Refactor `src/server/nipost/handler.ts` to import the two resolvers so the base
  URL default and the key env name live in one place, with the proxy's behavior
  unchanged. *Done when:* the existing `handler.test.ts` still passes, new
  `gateway.test.ts` proves base-URL defaulting/trailing-slash trimming, key
  resolution, query encoding, the `X-API-Key` header, 2xx JSON parsing, and each
  failure reason (including a non-JSON upstream body), and `npm run test && npm run lint` pass.

- [x] **Step 2 - Postcode normalization and the public record** - add
  `src/server/api/postcode.ts` with `normalizePostcodeCode(input): string | null`
  (via `toDashedCode` + `POSTCODE_PATTERN` from
  `src/lib/atlas/postcodeCode.ts`) and
  `toPostcodeRecord(code, raw): AtlasPostcodeRecord`, mapping an NDAPS lookup
  body into the locked public shape. Pure functions, no HTTP. *Done when:* tests
  cover dashed/spaced/compact acceptance, malformed rejection, and the raw-to-record
  mapping including a record with no geometry and one with missing optional
  fields.

- [x] **Step 3 - API envelope, router, and the postcodes route** - add
  `src/server/api/handler.ts` exporting `handleApi(request, env)`: resolve the
  API path (Vercel `path` query, or the dev pathname minus `/api/v1`), dispatch
  the root and `/postcodes/{code}` routes through the gateway and normalizer, and
  return the envelope and error JSON with CORS headers. Handle `OPTIONS` (204)
  and non-`GET` (405). *Done when:* tests with a stubbed global `fetch` prove
  `{ data }` on success, the identity body at the root, and the exact status and
  code for `invalid_code` (400), `not_found` (404), `unknown_route` (404),
  `method_not_allowed` (405), `not_configured` (500), `upstream_unreachable`
  (502), and `upstream_error` (502), plus an `OPTIONS` preflight returning 204
  with the CORS headers.

- [x] **Step 4 - Production function, dev middleware, and routing** - add
  `api/v1/[...path].ts` mirroring `api/ask.ts`; add the `/api/v1/:path*` rewrite
  to `vercel.json` before the SPA fallback; add `apiV1DevMiddleware(env)` to
  `vite.config.ts` mirroring `nipostDevMiddleware`; extend
  `src/server/nipost/vercelRouting.test.ts` (or a sibling) to guard the new
  rewrite ordering. *Done when:* `npm run test && npm run lint && npm run build`
  pass, the routing test fails if the rewrite is dropped or moved after the SPA
  fallback, and a live `npm run dev` check -
  `curl 'http://localhost:3001/api/v1/postcodes/LA-11-A12-AK-08'` - returns the
  public JSON envelope (a record, or a typed `not_found`/`upstream_unreachable`
  error), never the HTML app shell.

## Files / areas

- New: `src/server/nipost/gateway.ts`, `src/server/api/postcode.ts`,
  `src/server/api/handler.ts`, `api/v1/[...path].ts`.
- New tests: `src/server/nipost/gateway.test.ts`,
  `src/server/api/postcode.test.ts`, `src/server/api/handler.test.ts`.
- Changed: `src/server/nipost/handler.ts` (import the shared resolvers),
  `vite.config.ts` (add the dev middleware), `vercel.json` (add the rewrite),
  `src/server/nipost/vercelRouting.test.ts` (guard the new ordering).

## Data / contracts

Load-bearing for features 21b, 21c, and 22 - keep these shapes stable once 21a
lands.

Public envelope (all responses are JSON):

```ts
interface ApiSuccess<T> { data: T }
interface ApiFailure { error: { code: ApiErrorCode; message: string } }

type ApiErrorCode =
  | 'invalid_code'          // 400
  | 'method_not_allowed'    // 405
  | 'not_found'             // 404
  | 'unknown_route'         // 404
  | 'not_configured'        // 500
  | 'internal_error'        // 500
  | 'upstream_unreachable'  // 502
  | 'upstream_error';       // 502
```

Public postcode record:

```ts
interface AtlasCoordinate { lat: number; lng: number }

interface AtlasPostcodeSegments {
  state: string; lga: string; district: string; area: string; unit: string;
}

interface AtlasPostcodeRecord {
  code: string;                 // canonical dashed: LA-11-A12-AK-08
  display: string;              // dashes replaced with spaces
  compact: string;              // dashes removed (11 characters)
  segments: AtlasPostcodeSegments;
  coordinates?: AtlasCoordinate;   // from point_geometry.coordinates (lng, lat)
  address?: string;
  locality?: string;
  buildingUse?: string;         // 'residential' | 'non-residential' | ... | free string
  status?: string;
  valid: boolean;
  verified: boolean;
  source: 'nipost-ndaps';       // provenance, not editorial Atlas copy
}
```

Routes:

```text
GET /api/v1                      200 { "data": { "name": "Postcode Atlas API", "version": 1 } }
GET /api/v1/postcodes/{code}     200 { "data": AtlasPostcodeRecord }
                                 400 { "error": { "code": "invalid_code", ... } }
                                 404 { "error": { "code": "not_found", ... } }
```

Internal (21b reuses it): `fetchNipostJson` returns
`{ ok: true; status; data }` for a 2xx JSON body, and otherwise
`{ ok: false; reason; status }` with `reason` one of `not_configured`,
`unreachable`, `bad_response` (non-JSON body), or `upstream_status` (non-2xx).
The API maps those to `not_configured` (500), `upstream_unreachable` (502),
`upstream_error` (502), and `not_found` (404 only for an upstream 404).

## Testing

Verification command: `npm run test && npm run lint && npm run build`.

- Logic under test (vitest, already configured): the gateway client (Step 1),
  the normalizer/mapper (Step 2), and the router/envelope/error mapping
  (Step 3). Stub `fetch` with `vi.stubGlobal` / `vi.resetModules`, matching the
  existing server tests' style. Extend the routing test for the new rewrite
  (Step 4).
- No `Browser tests` command is declared in `AGENTS.md`; `npm run eval` is a
  chat benchmark, not an API test. The integration evidence is the live dev
  `curl` check in Step 4's done-when.
- Edge cases to cover: empty or malformed code, a valid code with no upstream
  record, missing key, unreachable gateway, a non-JSON upstream body, unknown
  route, and non-`GET` methods.

## Notes for the AI

- **Client vs server.** Everything here runs server-side: the Vercel Node
  runtime and the Vite dev middleware. Do not import browser-only modules such as
  `src/lib/atlas/store.ts` (IndexedDB) or `src/lib/api/postcodeClient.ts`
  (relative `fetch`) into `src/server/api/*`.
- **Reuse, don't re-derive.** Use `POSTCODE_PATTERN` and `toDashedCode` from
  `src/lib/atlas/postcodeCode.ts`; use the shared base/key resolvers in
  `gateway.ts` rather than re-reading `NIPOST_*` in the API.
- **Keep the proxy unchanged.** `handleNipostProxy` must still pass the upstream
  body through untouched and keep `cache-control: no-store`. Step 1 only moves
  the base-URL default and key env name behind the shared resolvers.
- **NDAPS lookup shape (verified live during 21a).** Every NDAPS response is
  wrapped in `{ data: ... }`, and a miss is HTTP 200 carrying
  `{ postcode, valid: false, status: 'not_found', verified: false }` - not a 404.
  So `fetchNipostJson` unwraps the envelope (matching the browser client's
  `json?.data ?? json`) and `handlePostcode` returns 404 `not_found` when the
  record's `valid` is false. The keys read from a real record are `postcode`,
  `valid`, `verified`, `status`, `building_use_status`,
  `recent_house_address.recent`, `administrative_address.locality_name`, and
  `point_geometry.coordinates` (`[lng, lat]`). The success-body mapping is covered
  by unit tests because the gateway answered `not_found` for every postcode
  tried; re-check it against a real record when one becomes available.
- **Keyless on purpose.** The access gate (API key, rate limiting) is feature
  21c, so 21a ships without one; the endpoint set stays closed and successes are
  cacheable. Nothing is deployed by this workflow - deployment is explicit - so
  do not add a gate now, but keep the envelope unchanged so 21c can drop one in
  without reshaping responses.
- **Versioning.** Mount everything under `/api/v1` and keep `API_VERSION = 1` in
  one place so 22 can document it and a future `v2` can coexist.
- **Provenance.** `source: 'nipost-ndaps'` records where the data came from.
  Editorial Atlas copy (the explanations) is a separate 21b concern and must not
  be presented as NIPOST-verified data.
- **CORS.** `Access-Control-Allow-Origin: *` is intended for a public read API.
  When 21c introduces keys, revisit `Access-Control-Allow-Headers` then.
