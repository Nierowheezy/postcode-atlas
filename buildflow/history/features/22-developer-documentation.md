# Feature: Developer documentation

**From build-plan:** feature 22
**Status:** verified

## Goal

Give external developers everything they need to call the public API without
reading the source: what the API is, how to authenticate, how it behaves under
load, the locked response envelope, and a page per endpoint with a
copy-pasteable request and a representative response. Features 21a-21e shipped
the API and froze its contract, so this feature only documents it - the single
exception is exporting the error-status map so a test can hold the docs to the
code as the contract evolves.

## In scope

- `docs/api-reference.md` - the reference:
  - Base URL (`/api/v1`) and version, `GET`-only, `OPTIONS` returning `204`.
  - Authentication: `Authorization: Bearer <key>` or `X-API-Key: <key>`; keys
    come from `ATLAS_API_KEYS`; an unset or empty list leaves the API open, and a
    configured list answers `401` without a valid key.
  - Rate limits: `ATLAS_API_RATE_LIMIT` per identity per 60 s (default 60,
    per-instance and best-effort), identity is `key:<key>` once authenticated and
    `ip:<client ip>` otherwise, `429` with `Retry-After`.
  - The success and error envelope, the per-route `cache-control` values, and
    CORS behavior.
  - The complete error table: all ten codes with their fixed statuses.
  - An endpoint catalog: every route with path, parameters, cache value, and a
    sample request and response.
- `docs/api-examples.md` - runnable examples: `curl` per route family, a small
  typed `fetch` client with error handling and a `Retry-After` retry, and a local
  dev walkthrough using `ATLAS_API_KEYS` and `ATLAS_API_RATE_LIMIT`.
- `README.md` - a `## Developer API` section linking both docs.
- `src/server/api/handler.ts` - export the existing error-status map as
  `API_ERROR_STATUS` (a rename, no behavior change).
- `src/server/api/docs.test.ts` - a guard that fails when the docs and the code
  drift apart.

## Out of scope

- Any new route, error code, response header, or envelope change. 21a-21e are the
  contract; this feature describes them.
- OpenAPI or Swagger, a hosted API console, a Postman collection, and client SDK
  packages.
- Per-key provisioning, rotation, quotas, and usage dashboards. Keys stay
  operator-configured environment values.
- Durable cross-instance rate limiting, `X-RateLimit-*` headers, and a
  success-path `Retry-After`. Feature 21e documented these as absent; the docs
  must say the same.
- Rewriting the existing README env rows or the existing feature docs.

## Build loop

Build one step at a time, never the whole feature at once. Plan mode lays out the
step before any code, the AI implements just that step, shows the diff (not full
files), and you read it and understand it before approving. Checkpoints are
optional; `/complete` makes the real feature-level commit at the end.

## Build steps

- [x] **Step 1 - Reference fundamentals** - create `docs/api-reference.md` with
  the base URL and version, the `GET` plus `OPTIONS 204` behavior, both auth
  headers and the `ATLAS_API_KEYS` open-when-unset rule, rate limiting (identity,
  60 s window, `ATLAS_API_RATE_LIMIT`, default 60, per-instance and best-effort,
  `429` with `Retry-After`), the success and error envelope, the per-route cache
  values, CORS, and the full error table. *Done when:* the doc matches the code -
  both key headers, the open-when-unset default, and a ten-row error table with
  `invalid_code` 400, `unauthorized` 401, `not_found` 404, `unknown_route` 404,
  `method_not_allowed` 405, `rate_limited` 429, `not_configured` 500,
  `internal_error` 500, `upstream_unreachable` 502, `upstream_error` 502 - and
  names the envelope `{ data }` / `{ error: { code, message } }`.

- [x] **Step 2 - Endpoint catalog** - add the catalog to `docs/api-reference.md`:
  `GET /`, `/postcodes/{code}`, `/postcodes/{code}/segments`,
  `/search/autocomplete?q=`, `/search/nearby?lat=&lng=&radius=`,
  `/search/reverse?lat=&lng=`, `/states`, `/states/{state}/lgas`,
  `/states/{state}/lgas/{lga}/districts`,
  `/states/{state}/lgas/{lga}/districts/{district}/areas`, `/explanations`, and
  `/explanations/{topic}`. *Done when:* every route a caller can hit appears with
  its path, required and optional params, its cache value, and a sample `200`
  body plus the request that produces it - and the auth, rate-limit, and error
  behavior from Step 1 is not restated per route.

- [x] **Step 3 - Examples and discoverability** - create `docs/api-examples.md`
  with a local dev walkthrough (`npm run dev`, `ATLAS_API_KEYS`,
  `ATLAS_API_RATE_LIMIT`), `curl` for the main route families, a small typed
  `fetch` client, and an error-handling sample that reads `Retry-After`. Add a
  `## Developer API` section to `README.md` linking both docs. *Done when:* a
  reader can copy a command or snippet and run it against the dev server, the
  examples use the documented headers, and the README points at
  `docs/api-reference.md` and `docs/api-examples.md`.

- [x] **Step 4 - Contract guard** - rename `ERROR_STATUS` to `API_ERROR_STATUS`
  and export it from `src/server/api/handler.ts`, then add
  `src/server/api/docs.test.ts`. *Done when:* the guard fails when a documented
  code or status stops matching `API_ERROR_STATUS`, or when a path in the doc's
  catalog no longer resolves through `handleApi`, and it passes on the current
  contract.

## Files / areas

- New: `docs/api-reference.md`, `docs/api-examples.md`,
  `src/server/api/docs.test.ts`.
- Changed: `README.md` (one section), `src/server/api/handler.ts` (one export
  rename, no behavior change).

## Data / contracts

- The locked 21a envelope: `{ data }` on success,
  `{ error: { code, message } }` on failure, one status per code.
- `ApiErrorCode` and its fixed statuses, now reachable as `API_ERROR_STATUS`.
- `API_PREFIX` (`/api/v1`) and `API_VERSION` (`1`).
- Load-bearing: the endpoint list and error table in `docs/api-reference.md` are
  the contract for external callers. `docs.test.ts` binds the doc's error table
  to `API_ERROR_STATUS` in both directions and probes every documented path, so a
  stale doc fails the suite. It does not enumerate the router: a brand-new route
  still needs its doc line, caught in review.

## Testing

- `npm run test` covers the guard in `src/server/api/docs.test.ts`:
  - the doc's error table and `API_ERROR_STATUS` hold the same code and status
    pairs in both directions, so a new or renamed code or status fails until it
    is documented;
  - every sample path in the doc's endpoint catalog resolves through `handleApi`
    to something other than `404 unknown_route`, with the fetch stub in place.
- No browser test. This feature changes no runtime behavior and no UI; the docs
  are read directly.
- Full local verification: `npm run test && npm run lint && npm run build`.

## Notes for the AI

- Match `docs/local-inference.md` for tone and formatting: prose headings, short
  tables, and no em dashes or en dashes in any new content.
- Document only what the code does. No `X-RateLimit-*` headers, no success-path
  `Retry-After`, no per-key quotas, and keys are not self-service: an operator
  sets `ATLAS_API_KEYS` and `ATLAS_API_RATE_LIMIT`.
- Keep the envelope and the error table identical in wording to the code so the
  guard's expectations stay simple.
- The only `src/` change is the export rename. Keep `API_ERROR_STATUS` a
  `Record<ApiErrorCode, number>` and leave `handleApi` behavior untouched.
- `docs.test.ts` reads markdown through `node:fs` and must not import a browser
  module (the server-only rule for `src/server/api/`).
- Keep the README section short: purpose, the two env vars, and links. The
  reference doc is the single source for detail.

## Red-team notes

- Coverage: the unhappy paths (missing key, over-limit, unknown route, upstream
  failure) ride on the shared error table and the envelope section rather than
  being restated per route, so the catalog stays readable.
- Contracts: freezing the routes and codes in a doc without a test invites
  drift, so Step 4 exports the status map and probes the routes.
- Order: Steps 1-2 are one file split by concern; Step 3 depends on the
  vocabulary from Steps 1-2; Step 4 depends on the docs existing.
- Testing: the drift guard is in-scope logic with a configured runner, so it
  ships tested. There is no UI or integration claim to check in a browser.
