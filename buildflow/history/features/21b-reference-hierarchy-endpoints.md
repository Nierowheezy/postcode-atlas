# Feature: Reference hierarchy endpoints

**From build-plan:** feature 21b
**Status:** verified

## Goal

Expose Nigeria's NDAPS reference hierarchy - state, LGA, district, and area - as
public read-only JSON on the 21a contract. Today `/api/v1` can look up one
postcode, but an integrator who only has a state name, or who wants to fill a
state/LGA picker, has no public way in. This sub-feature opens the hierarchy so
external apps can navigate down it, ending with the codes the postcode lookup
already consumes.

## In scope

- `src/server/api/hierarchy.ts`: the public reference shape (`AtlasNamedCode`),
  the path-param validators for state, LGA, district, and area, and a pure
  mapper from an NDAPS reference body to the public list.
- Four read-only routes on the 21a contract:
  - `GET /api/v1/states`
  - `GET /api/v1/states/{state}/lgas`
  - `GET /api/v1/states/{state}/lgas/{lga}/districts`
  - `GET /api/v1/states/{state}/lgas/{lga}/districts/{district}/areas`
- Parameter validation and normalization (trim, upper-case, shape) before any
  upstream call.
- The verified upstream error mapping: an unknown state is an upstream `400`, but
  an unknown LGA or district is an upstream `200` with an empty list.
- A longer success cache for reference lists (`public, max-age=3600`) than the
  postcode lookup uses, because the hierarchy changes only when NIPOST updates it.
- Unit tests for the mapper and validators, and for each route's upstream call,
  envelope, error mapping, and cache header.

## Out of scope

- Search, autocomplete, postcode decode, nearby, and reverse geocode: feature 21c.
- Editorial explanations: feature 21d.
- API keys, rate limiting, quotas, and tiers: feature 21e.
- Documentation, examples, and OpenAPI: feature 22.
- A single-state detail route (`GET /api/v1/states/{state}`): no consumer needs
  it, and NDAPS supplies only `code` and `name` here - the richer state fields
  (capital, zone, centroid) live in the browser dataset, not the gateway.
- Pagination and sorting. Return the full list; areas can be long but finite.
- District and area names. NDAPS returns those code-only.
- Any change to the 21a routes, the `/api/nipost` proxy, or the browser client.

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

- [x] **Step 1 - Hierarchy contracts, mapper, and param validation** - add
  `src/server/api/hierarchy.ts` with `AtlasNamedCode`, the four path-param
  patterns, `normalizeReferenceParam(kind, value)`, and `toNamedCodes(raw, key)`
  mapping an NDAPS reference body (`{ states }`, `{ lgas }`, `{ districts }`,
  `{ areas }`) into the public list. Pure functions, no HTTP. *Done when:*
  `hierarchy.test.ts` proves code-plus-name mapping, code-only district/area
  entries, a missing key and a non-array key yield an empty list, non-object
  entries are dropped, values are trimmed and upper-cased, each pattern accepts
  its real shape and rejects a malformed one, and a consistency test ties the
  patterns to `POSTCODE_PATTERN`'s segments; `npm run test && npm run lint` pass.

- [x] **Step 2 - The four routes on the API** - extend `src/server/api/handler.ts`:
  match the four nested paths, validate each param (reject with `400 invalid_code`
  before any upstream call), call `fetchNipostJson` on the matching reference path
  (`/v1/reference/states`, `/v1/reference/lgas?state=`,
  `/v1/reference/districts?state=&lga=`,
  `/v1/reference/areas?state=&lga=&district=`), map errors, and return the list
  with a one-hour cache. *Done when:* `handler.test.ts` adds, per route, the exact
  upstream path and query, a `200 { data: [...] }` body, the cache header, and
  `400 invalid_code` for a malformed param with no fetch call; it also proves an
  upstream `400`/`404` maps to `404 not_found`, an upstream `500` maps to
  `502 upstream_error`, an unreachable gateway maps to `502 upstream_unreachable`,
  a missing key maps to `500 not_configured`, and an upstream empty list stays
  `200 { data: [] }`; `npm run lint` passes. If this diff reads too large, split
  the deepest route (areas, three params) into its own step.

- [x] **Step 3 - Verify against the live gateway** - run `npm run dev` and confirm
  the real hierarchy end to end, then fold any confirmed detail into these Notes.
  *Done when:* `/api/v1/states` returns 37 states; `/api/v1/states/LA/lgas`
  returns Ikeja and its siblings; `/api/v1/states/LA/lgas/11/districts/A12/areas`
  returns areas; `/api/v1/states/ZZ/lgas` returns `404 not_found` (upstream `400`
  for an unknown state); `/api/v1/states/LA/lgas/99/districts` returns
  `200 { "data": [] }`; a malformed `/api/v1/states/l1/lgas` returns
  `400 invalid_code`; and `npm run test && npm run lint && npm run build` pass.

## Files / areas

- New: `src/server/api/hierarchy.ts`, `src/server/api/hierarchy.test.ts`.
- Changed: `src/server/api/handler.ts` (the four routes plus an optional cache
  duration on the success helper), `src/server/api/handler.test.ts`.

## Data / contracts

Extends the 21a locked contract. Do not reshape the envelope or the error codes.

Public hierarchy reference (all four routes return a list of these):

```ts
interface AtlasNamedCode {
  code: string;
  name?: string;   // present for states and LGAs; absent for code-only districts and areas
}
```

Routes:

```text
GET /api/v1/states                                                200 { "data": AtlasNamedCode[] }
GET /api/v1/states/{state}/lgas                                   200 { "data": AtlasNamedCode[] }
GET /api/v1/states/{state}/lgas/{lga}/districts                   200 { "data": AtlasNamedCode[] }
GET /api/v1/states/{state}/lgas/{lga}/districts/{district}/areas  200 { "data": AtlasNamedCode[] }
                                                                  400 { "error": { "code": "invalid_code", ... } }
                                                                  404 { "error": { "code": "not_found", ... } }
                                                                  500 { "error": { "code": "not_configured", ... } }
                                                                  502 { "error": { "code": "upstream_error" | "upstream_unreachable", ... } }
```

- Path params (validated locally, then trimmed and upper-cased): `state` matches
  `^[A-Z]{2}$`, `lga` `^\d{2}$`, `district` `^[A-Z0-9]{3}$`, `area` `^[A-Z]{2}$`.
  These mirror the segment shapes of `POSTCODE_PATTERN`.
- Upstream reference mapping (verified live during 21b):
  - `GET /v1/reference/states` -> `{ data: { states: [{ code, name }] } }` (37 states).
  - `GET /v1/reference/lgas?state=LA` -> `{ data: { lgas: [{ code, name }] } }`.
  - `GET /v1/reference/districts?state=LA&lga=11` -> `{ data: { districts: [{ code }] } }`.
  - `GET /v1/reference/areas?state=LA&lga=11&district=A12` -> `{ data: { areas: [{ code }] } }`.
  - An unknown state is HTTP `400` with `{ error: { code: "bad_request", message: "unknown state code" } }`.
  - An unknown LGA or district is HTTP `200` with the list key set to `[]`.
  - `fetchNipostJson` already unwraps the `{ data }` envelope, so the mapper's
    input is `{ states }`, `{ lgas }`, `{ districts }`, or `{ areas }`.

## Testing

Verification command: `npm run test && npm run lint && npm run build`.

- Logic under test (vitest): the mapper and param validation in Step 1, and the
  router plus error and cache mapping in Step 2. Stub `fetch` with
  `vi.stubGlobal`, matching the existing server tests' style.
- No `Browser tests` command is declared in `AGENTS.md`; the integration evidence
  is the live dev `curl` check in Step 3, as in 21a.
- Edge cases: a malformed state/LGA/district param, an unknown state, an unknown
  LGA or district (empty list), a missing key, an unreachable gateway, an
  upstream non-2xx, and an upstream body whose list key is missing.

## Notes for the AI

- **Extends the 21a locked contract.** Keep the `{ data }` / `{ error: { code, message } }`
  envelope and the error codes exactly as 21a shipped them. Reuse `invalid_code`,
  `not_found`, `not_configured`, `upstream_error`, and `upstream_unreachable`; add
  no new codes.
- **Server-side only.** Do not import browser-only modules (`src/lib/atlas/store.ts`,
  `src/lib/api/postcodeClient.ts`, `src/lib/tools/executors.ts`) into
  `src/server/api/*`. Reuse `fetchNipostJson` from `../nipost/gateway`.
- **An unknown state is a 400, an unknown child is an empty list.** Verified live:
  NDAPS answers `400` for a state it does not know, but `200` with an empty array
  for an unknown LGA or district. Map the upstream `400`/`404` to a public
  `404 not_found` (the request is well-formed, the resource is not there), and
  keep an empty list a `200 { data: [] }` so a valid parent with no children is
  not an error.
- **Cache reference lists for an hour.** Use `public, max-age=3600`, longer than
  the postcode lookup's five minutes. Add an optional duration to the existing
  success helper rather than a second response builder.
- **Normalize before validating.** Trim and upper-case the state and district
  params so `la` and `LA` behave the same, matching the postcode route's tolerance.
- **No pagination.** Return the full list. Areas can be long but finite; revisit
  only if a list becomes unwieldy.
- **Provenance.** The 21a postcode record carries `source: 'nipost-ndaps'`.
  Hierarchy lists stay plain (`code`, optional `name`) so the envelope shape does
  not change; feature 22 documents that these codes are canonical NDAPS values.
- **Keep the proxy and the 21a routes unchanged.** This feature adds routes and a
  cache parameter; it does not touch `/api/nipost`, `handleNipostProxy`, or the
  postcode lookup behavior.

## Red-team notes

- Nested paths deliberately lock a public URL shape that feature 22 will document.
  NDAPS itself uses query params, but the parent-child relationship is the point
  of this API, so `states/{state}/lgas/...` reads and caches better than
  `lgas?state=`.
- `name` is optional because districts and areas are genuinely code-only upstream.
  A consumer must not assume every reference carries a name.
- An unknown state returns `404 not_found`, not NDAPS's `400 bad_request` echoed
  through: the request is well-formed and the resource simply does not exist.
  `invalid_code` stays reserved for malformed input, so a typo and a
  not-yet-assigned code are distinguishable.
- Step 2 lands four routes at once, but each is a thin, uniform wrapper over one
  `fetchNipostJson` call, so the diff should stay readable; the fallback is to
  split the areas route into its own step.
- Deferred on purpose: a single-state detail route, pagination, and district or
  area names. None of the named consumers need them, so they stay out to keep 21b
  contained.
