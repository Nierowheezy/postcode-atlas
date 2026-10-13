# Feature: Search, decode, and nearby endpoints

**From build-plan:** feature 21c
**Status:** verified

## Goal

Expose the Atlas search and geospatial capabilities on the public API: segment-aware
autocomplete, a structural postcode decode, nearby units, and reverse geocode.
21a opened a single postcode lookup and 21b opened the reference hierarchy; this
sub-feature opens the three NDAPS search paths plus a local decode, so an
integrator can turn a partial name into a code, a code into its parts, and a
point on the map into addresses - all on the same locked envelope.

## In scope

- `src/server/api/search.ts`: the public search shapes (`AtlasSuggestion`,
  `AtlasAutocomplete`, `AtlasNearbyUnit`), the query-param validators
  (`normalizeSearchQuery`, `normalizeCoordinate`, `normalizeRadius`), and the
  pure mappers from an NDAPS search body to the public shape (`toAutocomplete`,
  `toNearbyUnits`, `toReverseUnit`).
- `src/server/api/postcode.ts`: the public decode shape (`AtlasDecodedPostcode`)
  and `decodePostcode(input)` - a structural split of a well-formed code, no
  upstream call.
- Four read-only routes on the 21a contract:
  - `GET /api/v1/search/autocomplete?q={query}`
  - `GET /api/v1/postcodes/{code}/segments`
  - `GET /api/v1/search/nearby?lat={lat}&lng={lng}&radius={metres}`
  - `GET /api/v1/search/reverse?lat={lat}&lng={lng}`
- Query-param validation (non-empty query, finite in-range coordinates, bounded
  radius) before any upstream call.
- Cache headers: one hour for the immutable decode, five minutes for the three
  NDAPS-backed routes.
- Unit tests for the validators and mappers, and per route for the upstream path
  and query, the envelope, error mapping, and cache header.

## Out of scope

- Editorial explanations: feature 21d.
- API keys, rate limiting, quotas, and tiers: feature 21e.
- Documentation, examples, and OpenAPI: feature 22.
- Assembling segments into a code (`POST /v1/assembly/assemble`). No consumer
  needs it on the public API yet, and the Atlas never writes postcodes.
- A configurable reverse-geocode distance. The route mirrors the browser
  client's fixed 250 m search radius; exposing it is a later, separate decision.
- Pagination or a result cap on nearby. NDAPS returns a bounded list; revisit
  only if a real point returns an unwieldy one.
- Names for districts and areas (still code-only upstream), and any write route.
- Changing the 21a or 21b routes, the `/api/nipost` proxy, or any browser module.

## Build steps

- [x] **Step 1 - Search contracts, validation, and mappers** - add
  `src/server/api/search.ts` with `AtlasSuggestion`, `AtlasAutocomplete`,
  `AtlasNearbyUnit`, the validators (`normalizeSearchQuery`,
  `normalizeCoordinate`, `normalizeRadius`), and the mappers (`toAutocomplete`,
  `toNearbyUnits`, `toReverseUnit`). Add `AtlasDecodedPostcode` and
  `decodePostcode` to `src/server/api/postcode.ts`. Pure functions, no HTTP.
  *Done when:* `search.test.ts` proves the query trims and rejects empty and
  over-long input, coordinates reject missing, non-numeric, empty-string, and
  out-of-range values while accepting the +-90/+-180 boundaries, radius defaults
  to 300 and rejects 0, 301, negative, and non-integers, autocomplete defaults a
  missing segment to `state` and a missing or non-array suggestion list to `[]`
  and drops code-less entries, nearby drops non-object and code-less units and
  turns `point_geometry.coordinates` (`[lng, lat]`) into `{ lat, lng }`, and
  reverse returns `null` unless `found === true` and otherwise echoes the query
  point as the unit's coordinates; `postcode.test.ts` proves `decodePostcode`
  accepts dashed, spaced, and compact forms and returns `null` for a malformed
  one; `npm run test && npm run lint` pass.

- [x] **Step 2 - Autocomplete and decode routes** - extend
  `src/server/api/handler.ts`: thread the request `URL` into the new handlers,
  match `/search/autocomplete` and `/postcodes/{code}/segments`, validate `q`
  (reject empty/over-long with `400 invalid_code` before any fetch), call
  `fetchNipostJson('/v1/search/autocomplete', { q })`, map the body with
  `toAutocomplete`, and return the list with a five-minute cache. Answer the
  segments route locally from `decodePostcode` with `400 invalid_code` on a
  malformed code and a one-hour cache. *Done when:* `handler.test.ts` adds, per
  route, the exact upstream path and query (autocomplete only; segments makes no
  fetch call), the `200 { data }` body, and the cache header, plus `400
  invalid_code` for an empty `q` and for a malformed code with no fetch call; it
  also proves an upstream non-2xx maps to `502 upstream_error`, an unreachable
  gateway to `502 upstream_unreachable`, and a missing key to `500
  not_configured`; `npm run lint` passes.

- [x] **Step 3 - Nearby and reverse routes** - extend `src/server/api/handler.ts`:
  match `/search/nearby` and `/search/reverse`, validate `lat`/`lng` (and
  `radius` for nearby) with `400 invalid_code` before any fetch, call
  `fetchNipostJson` (`/v1/search/nearby` with `lat`, `lng`, `radius`;
  `/v1/search/reverse` with `lat`, `lng`, `max_distance_m=250`), map the bodies
  with `toNearbyUnits` and `toReverseUnit`, and return a five-minute cache. An
  empty nearby list stays `200 { data: [] }`; a reverse miss (`found` not `true`)
  is `404 not_found`. *Done when:* `handler.test.ts` adds, per route, the exact
  upstream path and query, the success body, the cache header, and `400
  invalid_code` for a missing or out-of-range coordinate (and radius) with no
  fetch call; it proves an empty nearby array stays `200 { data: [] }`, a
  `found: false` reverse body maps to `404 not_found`, an unreachable gateway to
  `502 upstream_unreachable`, and an upstream non-2xx to `502 upstream_error`;
  `npm run lint` passes.

- [x] **Step 4 - Verify against the live gateway** - run `npm run dev` and confirm
  the real search surface end to end, then fold any confirmed detail into these
  Notes. *Done when:* `/api/v1/search/autocomplete?q=la` returns
  `200 { "data": { "segment": "state", "suggestions": [] } }` (the current key's
  search index is empty, so the shape is what is being checked);
  `/api/v1/postcodes/LA11A12AK08/segments` returns the five segments;
  `/api/v1/search/nearby?lat=6.5&lng=3.3` returns `200 { "data": [] }`;
  `/api/v1/search/reverse?lat=6.5&lng=3.3` returns `404 not_found`; a missing
  `q`, a `lat=abc`, and a `radius=0` each return `400 invalid_code`; and
  `npm run test && npm run lint && npm run build` pass.

## Files / areas

- New: `src/server/api/search.ts`, `src/server/api/search.test.ts`.
- Changed: `src/server/api/handler.ts` (URL threading plus the four routes and a
  decode cache constant), `src/server/api/handler.test.ts`,
  `src/server/api/postcode.ts` (decode shape and helper), and
  `src/server/api/postcode.test.ts`.

## Data / contracts

Extends the 21a locked contract. Do not reshape the envelope. `invalid_code`
(single `400`, the malformed request input it carries, path or query), keep the
existing codes, and add no new ones.

Public search shapes:

```ts
interface AtlasSuggestion {
  code: string;
  label?: string;               // absent when upstream sends only a code
}

interface AtlasAutocomplete {
  segment: string;              // upstream inference: "state", "lga", "district", "area"
  suggestions: AtlasSuggestion[];
}

interface AtlasNearbyUnit {
  code: string;                 // canonical dashed postcode
  display: string;
  compact: string;
  state?: string;
  stateName?: string;
  lga?: string;
  lgaName?: string;
  district?: string;
  area?: string;
  unit?: string;
  coordinates?: AtlasCoordinate;   // { lat, lng }, flipped from NDAPS [lng, lat]
  distanceMetres?: number;
  address?: string;
}

interface AtlasDecodedPostcode {
  code: string;                 // canonical dashed code
  display: string;
  compact: string;
  segments: AtlasPostcodeSegments;
}
```

Routes:

```text
GET /api/v1/search/autocomplete?q=                 200 { "data": AtlasAutocomplete }
                                                   400 { "error": { "code": "invalid_code", ... } }
                                                   502 { "error": { "code": "upstream_error" | "upstream_unreachable", ... } }

GET /api/v1/postcodes/{code}/segments              200 { "data": AtlasDecodedPostcode }
                                                   400 { "error": { "code": "invalid_code", ... } }

GET /api/v1/search/nearby?lat=&lng=&radius=        200 { "data": AtlasNearbyUnit[] }
                                                   400 { "error": { "code": "invalid_code", ... } }
                                                   502 { "error": { "code": "upstream_error" | "upstream_unreachable", ... } }

GET /api/v1/search/reverse?lat=&lng=               200 { "data": AtlasNearbyUnit }
                                                   400 { "error": { "code": "invalid_code", ... } }
                                                   404 { "error": { "code": "not_found", ... } }
                                                   502 { "error": { "code": "upstream_error" | "upstream_unreachable", ... } }
```

- Query params:
  - `q` is required, trimmed, and capped at 64 characters. Empty or over-long is
    `400 invalid_code` (an explicit divergence from NDAPS, which answers an empty
    `q` with `200 { segment: "state", suggestions: [] }`).
  - `lat` and `lng` are required finite numbers; `lat` in `[-90, 90]`, `lng` in
    `[-180, 180]`. Any other value, including an empty string, is
    `400 invalid_code`.
  - `radius` is optional; absent or empty means 300, and a present value must be
    an integer in `[1, 300]`. Anything else is `400 invalid_code`.
- Upstream mapping (NDAPS shapes, verified live during 21c):
  - `GET /v1/search/autocomplete?q=<q>` -> `{ data: { segment, suggestions: [{ code, label? }] } }`.
    The current publishable key's index is empty, so every query returns an empty
    `suggestions` list; `segment` is inferred from `q` (`la` -> `state`,
    `ikeja` -> `district`).
  - `GET /v1/search/nearby?lat=<lat>&lng=<lng>&radius=<r>` -> `{ data: [ unit ] }`.
    `radius` is optional upstream; an out-of-range or empty result is `{ data: [] }`.
  - `GET /v1/search/reverse?lat=<lat>&lng=<lng>&max_distance_m=250` ->
    `{ data: { found: true, unit: {...} } }` on a hit, or
    `{ data: { found: false, coordinate: [lng, lat], message, radius_m } }` on a
    miss. `max_distance_m=250` mirrors the browser client; its effect is not
    observable with the current key, which finds nothing.
  - `GET /v1/assembly/disassemble?code=<code>` exists upstream and returns
    `{ data: { state, lga, district, area, unit } }` for 11- or 12-character
    input, but the public decode does **not** call it (see Notes for the AI).
  - Nearby units mirror the lookup geometry: `point_geometry.coordinates` is
    `[lng, lat]` and is exposed as `{ lat, lng }`.
  - A malformed nearby or reverse query is upstream `400 { error: { code: "bad_request" } }`;
    `fetchNipostJson` already unwraps the `{ data }` envelope, so each mapper's
    input is the inner object or array.

## Testing

Verification command: `npm run test && npm run lint && npm run build`.

- Logic under test (vitest): the validators and mappers in Step 1 (and
  `decodePostcode` in `postcode.test.ts`), and the router, error mapping, and
  cache headers in Steps 2 and 3. Stub `fetch` with `vi.stubGlobal`, matching the
  existing server tests' style.
- No `Browser tests` command is declared in `AGENTS.md`; the integration evidence
  is the live dev `curl` check in Step 4, as in 21a and 21b.
- The search index behind the current key is empty, so no live hit body exists
  for nearby or reverse. The hit mapping is proven by unit tests with a
  representative body built from the browser client's own field names
  (`src/lib/api/postcodeClient.ts`: `unit.postcode`, `unit.display`, `state`,
  `state_name`, `lga_name`, `district`, `area`, `unit.address`,
  `unit.distance_m`), and Step 4 re-checks the live miss shapes.
- Edge cases: an empty and an over-long `q`; a missing, non-numeric, empty, and
  out-of-range coordinate; the `+-90`/`+-180` boundaries; radius `0`, `301`,
  negative, non-integer, and absent; a missing segment and a non-array suggestion
  list; a code-less nearby unit; a non-array nearby body; `found` absent,
  `found: false`, and a hit; and an unreachable gateway.

## Notes for the AI

- **Extends the 21a locked contract.** Keep the `{ data }` /
  `{ error: { code, message } }` envelope and reuse `invalid_code`, `not_found`,
  `not_configured`, `upstream_error`, and `upstream_unreachable`. Add no new
  codes: `invalid_code` is already the public `400` for malformed input, so it
  also covers a bad query param. Do not reshape any 21a or 21b response.
- **Decode locally, do not call NDAPS.** A code's five segments are pure
  structure (`POSTCODE_PATTERN` in `src/lib/atlas/postcodeCode.ts`), not a data
  lookup, and 21a already derives `AtlasPostcodeRecord.segments` the same way. A
  local decode always works - even when the gateway is down or the code has no
  record - and keeps the public decode consistent with the lookup route's notion
  of well-formed (11 compact characters, unlike NDAPS's 11-or-12). No fetch, no
  key, and no `not_configured` on this route.
- **Server-side only.** Do not import browser modules (`src/lib/atlas/store.ts`,
  `src/lib/api/postcodeClient.ts`, `src/lib/tools/executors.ts`) into
  `src/server/api/*`. Reuse `fetchNipostJson` from `../nipost/gateway`,
  `normalizePostcodeCode` from `./postcode`, and `AtlasCoordinate` /
  `AtlasPostcodeSegments` from `./postcode`.
- **An empty list is not an error.** Nearby with no neighbours is
  `200 { data: [] }`, matching 21b's empty reference lists. Only a reverse miss
  (`found` not `true`) is a `404 not_found`, matching 21a's lookup miss.
- **Echo the query point on reverse.** Set the returned unit's `coordinates` to
  the requested `{ lat, lng }`, as the browser client does, rather than the
  unit's own geometry. Deterministic and always defined.
- **Thread the `URL`, not just the path.** `handleApi` already builds a `URL` for
  `resolveApiPath`; pass it to the query-param handlers. The Vercel rewrite keeps
  the original query string beside the carried `path` param (the NIPOST proxy
  relies on the same behavior), so `url.searchParams.get('q')` is correct on both
  the dev middleware and the function.
- **Cache the decode for an hour.** Structure never changes, so the segments
  route uses `public, max-age=3600`; the three NDAPS-backed routes use the
  five-minute lookup cache. Add one named constant for the decode duration rather
  than reusing the reference one.
- **Keep the proxy and the earlier routes unchanged.** The four NDAPS paths are
  already in `ALLOWED_PATHS`; this feature adds routes and a cache constant only.
  `handleNipostProxy`, `/api/nipost`, and the 21a and 21b routes stay as they are.

## Red-team notes

- **`invalid_code` now covers query input too.** The 400 code is named for
  codes, but it is the only `400` in the locked contract, and 21b already
  stretched it to path parameters. Reusing it keeps the contract stable for 21e
  and 22 instead of introducing a breaking new code; a future `invalid_request`
  belongs in a v2, not here. This is called out in the spec deliberately.
- **Decode is a public shape the upstream cannot fill.** NDAPS `disassemble`
  takes 11 *or* 12 characters and returns bare segments; the public route takes
  only what `POSTCODE_PATTERN` accepts and returns `code`/`display`/`compact`
  alongside the segments. That is a deliberate, narrower contract: consistent
  with `/postcodes/{code}`, and honest about not inventing names.
- **No live hit for the search routes.** The current key's index returns empty
  suggestions and no nearby or reverse hits, so the hit mapping rests on the
  browser client's own field names plus unit tests. Step 4 pins the live miss
  shapes; if a key with search data appears later, re-verify then.
- **`max_distance_m=250` is inherited, not verified.** It mirrors the browser
  client, and the endpoint accepts it, but its effect cannot be observed while
  every reverse query misses. It is fixed on purpose so 21c stays contained;
  exposing a caller-tuned distance is deferred.
- **Four routes at once, but each is thin.** Two are pure local validation plus
  one mapper (autocomplete, decode); two add coordinate validation around one
  `fetchNipostJson` call. The fallback if Step 3 reads too large is to split
  nearby and reverse into separate steps.
- **Range checks are intentionally strict.** `lat`/`lng` are bounded to real
  coordinates and `radius` to `[1, 300]`; an empty string is rejected rather than
  coerced to `0`. Better a clear `400` than a silently wrong nearby search.
