# Fix: NIPOST proxy route does not match in production

**Type:** Fix
**Status:** verified
**Branch:** `fix/nipost-proxy-production-route`
**Completed:** 2026-10-12

## Problem

The NIPOST proxy worked in `npm run dev` but not on Vercel. Every
`GET /api/nipost/v1/...` request returned the SPA shell (`index.html`) instead of
reaching `api/nipost/[...path].ts`, so live NDAPS lookups silently returned empty
and the deploy-time `NIPOST_PUBLISHABLE_KEY` was never used.

Evidence, before the fix:

- `GET https://postcode-atlas.vercel.app/api/nipost/v1/reference/states` returned
  `content-type: text/html` and the app shell, not JSON.
- The same happened on the older 17h and 1d deployments, so the route never
  worked in production.
- `api/nipost/[...path]` (literal, URL-encoded) reached the handler and returned
  its own `404 unknown_path` JSON, so the function itself was fine.

Root cause, read from the generated `.vercel/output/config.json`: `vercel.json`
ended with the SPA fallback `{ "source": "/(.*)", "destination": "/index.html" }`.
Vercel emitted the dynamic function's route (`^/api/nipost/([^/]+)$`) after that
fallback, and that route only matched a single path segment. Every allowed NDAPS
path is multi-segment (`/v1/reference/states`, `/v1/search/autocomplete`,
`/v1/assembly/assemble`), so requests fell through to `index.html`. The static
`/api/ask` function worked only because Vercel's `filesystem` handler matches it
before the rewrites.

## The fix

Added an explicit proxy rewrite ahead of the SPA fallback, carrying the NDAPS
path in a query parameter the shared handler reads:

```json
{ "source": "/api/nipost/:path*", "destination": "/api/nipost/[...path]?path=/:path*" }
```

- `vercel.json`: inserted the rewrite before `/(.*) -> /index.html`.
- `src/server/nipost/handler.ts`: `resolveUpstreamTarget(url)` resolves the path
  from the `path` query parameter when present (Vercel), and keeps the existing
  prefix-strip for the dev middleware. Other query parameters, such as
  `state=LA`, are forwarded upstream unchanged.
- The client and the NDAPS allowlist are unchanged, so a cached service-worker
  client keeps working and the endpoint stays a closed proxy.

## Build steps

- [x] **1. Route and resolve.** Add the rewrite to `vercel.json` before the SPA
  fallback; add `resolveUpstreamTarget` and use it in `handleNipostProxy`.
  *Done when:* `npm run test && npm run lint && npm run build` is green and tests
  cover the carried-`path` and dev-prefix cases.

- [x] **2. Regression guard and production proof.** Add the `vercel.json` routing
  test, deploy, and confirm the proxy returns JSON in production.
  *Done when:* production returns `application/json` for the proxy and `/api/ask`
  still answers.

## Files / areas

- `vercel.json` - the `/api/nipost/*` rewrite, ordered ahead of the SPA fallback.
- `src/server/nipost/handler.ts` - `resolveUpstreamTarget` and the fetch URL.
- `src/server/nipost/handler.test.ts` - focused resolver tests.
- `src/server/nipost/vercelRouting.test.ts` - new ordering regression guard.

## Verify

- `npm run test && npm run lint && npm run build`.
- Production: `curl -s -D - https://postcode-atlas.vercel.app/api/nipost/v1/reference/states`
  returns `content-type: application/json`, not `text/html`.

## Outcome

- 76 tests pass (10 files), `tsc --noEmit` clean, build clean.
- Deployed to production: `dpl_6JPoRRFVGXD1LSCwv8xwWWzL9XFw`, aliased to
  `https://postcode-atlas.vercel.app`.
- `GET /api/nipost/v1/reference/states` -> `200 application/json` (37 states).
- `GET /api/nipost/v1/reference/lgas?state=LA` -> Lagos LGAs (Agege, ...).
- `GET /api/nipost/v1/reference/lgas?state=KN` -> Kano LGAs (Ajingi, ...), which
  confirms Vercel preserves the original query string through the rewrite.
- `POST /api/ask` still answers via N-ATLAS.
- Generated route table confirms the proxy rewrite now sits before the SPA
  fallback.

## Known limitations / follow-ups

- The rewrite injects the NDAPS path as a `path` query parameter; the dev
  middleware keeps using the prefix strip. `resolveUpstreamTarget` covers both.
- The proxy rewrite must stay ahead of the SPA fallback. `vercelRouting.test.ts`
  fails if it is removed or reordered.
- The now-unused `VITE_NIPOST_PUBLISHABLE_KEY` still exists in Vercel Production
  and can be removed separately.
