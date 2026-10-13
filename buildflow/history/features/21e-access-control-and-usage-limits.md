# Feature: Access control and usage limits

**From build-plan:** feature 21e
**Status:** verified

## Goal

Put a gate in front of the public developer API. Today every `/api/v1` route is
open; this sub-feature adds API-key verification (401) and per-caller rate
limiting (429) on the 21a contract, so the Atlas API can be handed to external
applications without leaving the NDAPS gateway and the editorial copy fully
unmetered. One gate wraps every existing route at once, in one place, rather
than a check scattered per route.

## In scope

- A new pure module `src/server/api/access.ts`:
  - key resolution from `ATLAS_API_KEYS`, extraction from the request, and
    constant-time comparison;
  - caller identity (the matched key, else the client IP);
  - an in-memory fixed-window rate limiter with a bounded identity table.
- Two new error codes on the 21a contract: `unauthorized` (401) and
  `rate_limited` (429), plus their response headers (`www-authenticate`,
  `retry-after`).
- One access gate in `handleApi` that runs for every non-preflight request,
  before method validation and routing.
- CORS updates so a browser may send `Authorization`/`X-API-Key` and read
  `Retry-After`.
- Request-header forwarding in the `/api/v1` Vite dev middleware so keys and
  client IPs reach the handler in `npm run dev`, exactly as they do on Vercel.
- README rows for the two new env vars.
- Unit tests for the access module and the gate, plus a live dev check.

## Out of scope

- Developer documentation, integration examples, and OpenAPI: feature 22. The
  401/429 shapes and the key header are documented there.
- Per-key provisioning, rotation, scopes, quotas, and analytics. Keys come from
  the environment; there is no store.
- Durable, cross-instance rate limiting. The limiter is per-instance and
  best-effort; platform-level (for example Vercel WAF) limits remain the durable
  layer.
- `X-RateLimit-*` response headers and a `Retry-After` on success paths.
- Key requirements for `/api/nipost` or `/api/ask`, which are the app's own
  server routes, not the public API.
- Any change to 21a-21d route behavior, response shapes, or cache headers.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at
   the end.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Key handling** - create `src/server/api/access.ts` with the
  pure key surface: `resolveApiKeys(env)` (comma-split, trim, drop blanks),
  `extractApiKey(request)` (`Authorization: Bearer` first, then `X-API-Key`),
  `matchesApiKey(presented, keys)` (constant-time, over the whole list), and
  `rateLimitIdentity(request, authenticatedKey?)` (the `key:`/`ip:` namespaced
  identity). No rate limiter yet.
  *Done when:* `src/server/api/access.test.ts` proves `resolveApiKeys` returns
  `[]` for a missing, blank, or whitespace-only value and `['a','b']` for
  `' a , b ,, '`; `extractApiKey` reads a `Bearer` token with any scheme casing
  and trims it, reads `X-API-Key`, prefers `Authorization` when both are sent,
  ignores a non-`Bearer` scheme so `X-API-Key` is still read, and returns
  `undefined` for a missing header or a blank token; `matchesApiKey` is
  case-sensitive, true only on an exact member of the list, and false for no
  presented key or no configured keys; `rateLimitIdentity` returns
  `key:<presented>` for an authenticated caller and otherwise an `ip:` identity
  from the first `x-forwarded-for` hop, then `x-real-ip`, then `unknown`, and a
  key that reads like an IP literal cannot collide with that IP's bucket.

- [x] **Step 2 - Fixed-window rate limiter** - add to `access.ts`:
  `RATE_WINDOW_MS` (60 s), `DEFAULT_RATE_LIMIT` (60), `MAX_TRACKED_IDENTITIES`
  (10000), `resolveRateLimit(env)`, `checkRateLimit(limit, identity, now?)`
  returning `{ allowed: true }` or `{ allowed: false, retryAfterSeconds }`, and
  a test-only `resetRateLimits()`. State is a module-level `Map` keyed by
  identity; a new or rolled-over window is re-inserted (delete then set) and the
  oldest entries are evicted past the cap.
  *Done when:* `resolveRateLimit` returns the default for a missing, blank,
  non-numeric, zero, negative, or fractional value and the parsed integer for
  `' 30 '`; `checkRateLimit` allows exactly `limit` calls in one window and
  blocks the next with `retryAfterSeconds` equal to the whole seconds remaining
  (at least 1); a block does not raise the stored count; after `now` reaches the
  window end the identity is allowed again with a fresh count; identities have
  independent windows; once tracked identities pass the cap the oldest is
  evicted so a fresh call for it starts a new window; `resetRateLimits()` empties
  the table.

- [x] **Step 3 - Wire the gate** - extend `src/server/api/handler.ts`: add
  `unauthorized` (401) and `rate_limited` (429) to `ApiErrorCode` and
  `ERROR_STATUS`, let `errorResponse` take extra headers, add the CORS
  `access-control-allow-headers` and `access-control-expose-headers` entries, and
  add one `accessGate(request, env)` called right after the `OPTIONS`
  short-circuit and before the method check. Correct the stale `21c` access-gate
  comment in the file header.
  *Done when:* `src/server/api/handler.test.ts` (with `resetRateLimits()` added
  to its existing `afterEach`) proves: with `ATLAS_API_KEYS` set, no key, a wrong
  key, or a non-`Bearer` scheme is `401 { error: { code: 'unauthorized' } }` with
  `www-authenticate: Bearer`, `no-store`, and no fetch; `Authorization: Bearer`
  and `X-API-Key` both succeed; an unauthenticated `POST` and an unauthenticated
  unknown path are both `401` rather than `405`/`404`; `OPTIONS` is `204` with no
  key; with `ATLAS_API_KEYS` unset or empty every 21a-21d route behaves exactly
  as before; exceeding `ATLAS_API_RATE_LIMIT` for one identity is
  `429 { error: { code: 'rate_limited' } }` with a `retry-after` of at least 1
  and `no-store`, while another identity is unaffected; a valid key is limited
  per key, independent of the IP bucket; and every response carries the widened
  CORS headers.

- [x] **Step 4 - Dev parity, docs, and live verification** - forward the incoming
  request headers in the `/api/v1` dev middleware in `vite.config.ts` (as
  `toWebRequest` already does for the Vercel function), add `ATLAS_API_KEYS` and
  `ATLAS_API_RATE_LIMIT` rows to the README env table, then run the live check.
  *Done when:* `npm run dev` started with
  `ATLAS_API_KEYS=test-key ATLAS_API_RATE_LIMIT=3` answers `401` (with
  `www-authenticate`) for `/api/v1/explanations` with no key, `200` with
  `Authorization: Bearer test-key` and again with `X-API-Key: test-key`, `401`
  with a wrong key, `429` with `retry-after` on the fourth keyed call, and `204`
  for `OPTIONS`; a restart with `ATLAS_API_KEYS` unset answers `200` with no key;
  and `npm run test && npm run lint && npm run build` pass.

## Files / areas

- New: `src/server/api/access.ts`, `src/server/api/access.test.ts`.
- Changed: `src/server/api/handler.ts` (two codes, response headers, CORS, the
  gate, one comment), `src/server/api/handler.test.ts`, `vite.config.ts` (dev
  middleware header forwarding), `README.md` (env table).
- Read-only reuse: `src/server/nipost/gateway.ts` (`NipostGatewayEnv`).

## Data / contracts

Extends the 21a locked contract. The `{ data }` /
`{ error: { code, message } }` envelope is unchanged; this feature adds exactly
two codes and two response headers, and nothing else.

| Code | Status | When |
| --- | --- | --- |
| `unauthorized` | 401 | `ATLAS_API_KEYS` is configured and the request sends no key, a wrong key, or a non-`Bearer` scheme |
| `rate_limited` | 429 | The caller's identity is at its window limit |

Gate order for every `/api/v1` request:

```text
1. OPTIONS                 -> 204 (never gated; preflight carries no key)
2. rate limit exceeded     -> 429 + retry-after
3. keys set and no match   -> 401 + www-authenticate: Bearer
4. method is not GET       -> 405 method_not_allowed
5. routing                 -> 200 / 400 / 404 ... as today
```

Configuration and caller identity:

```text
ATLAS_API_KEYS         comma-separated accepted keys; unset or empty = the API stays open
ATLAS_API_RATE_LIMIT   requests allowed per identity per 60 s window; default 60

Key presentation:  Authorization: Bearer <key>   (preferred)
                   X-API-Key: <key>
Identity:          key:<presented key> when authenticated, else ip:<client ip>
Client IP:         first x-forwarded-for hop, else x-real-ip, else "unknown"
Rate-limited 429:  retry-after: <whole seconds until the window ends>
Unauthorized 401:  www-authenticate: Bearer
```

Load-bearing for feature 22: the two codes, the two headers, the two env vars,
and the "unset means open" rule.

## Testing

Verification command: `npm run test && npm run lint && npm run build`.

- Logic under test (vitest): all of `access.ts` (Steps 1 and 2) and the gate
  (Step 3). Handler tests call `handleApi` directly, so they can set
  `Authorization`, `X-API-Key`, and `x-forwarded-for`, and pass `ATLAS_API_KEYS`
  or `ATLAS_API_RATE_LIMIT` in the env argument.
- The limiter holds module-level state, so `handler.test.ts` must call
  `resetRateLimits()` in its existing `afterEach`; without it the 63 existing
  handler calls would trip the default 60-per-minute bucket. Vitest isolates each
  test file, so no other file needs it.
- No `Browser tests` command is declared in `AGENTS.md`; the integration evidence
  is the live dev `curl` check in Step 4, as in 21a-21d.
- Edge cases: no/blank/whitespace keys, a non-`Bearer` scheme, both headers
  present, missing IP headers, a fractional/zero/negative rate-limit value, a
  window rollover, the `retry-after` math, the identity cap, the `OPTIONS`
  exemption, and the open-when-unconfigured default.

## Notes for the AI

- **Extends the 21a locked contract, deliberately.** `unauthorized` and
  `rate_limited` are the first new codes since 21a. Add these two and nothing
  else; do not rename or reshape an existing code or response.
- **The gate is opt-in and non-breaking.** With `ATLAS_API_KEYS` unset or empty
  the API stays open, exactly as 21a-21d shipped it. That keeps the demo and the
  existing suite working. It is an availability-over-default-security choice for
  a public read-only API with no user data, so document it rather than assume it.
- **Rate limit before key verification.** Brute force has to be throttled too, so
  the limiter counts an identity before the key is judged, and an unauthorized
  caller cannot tell a real route from an unknown one. Order: identity -> limit
  -> 401.
- **The gate runs before the method check and routing.** An unauthenticated
  `POST` or unknown path is a `401`, not a `405`/`404`; only `OPTIONS` is exempt
  (a preflight carries no credentials).
- **Keep construction of `Response` objects in `handler.ts`.** `access.ts` stays
  pure: it takes a `Request` and an env map and returns plain values.
- **Compare keys in constant time.** Loop the whole list and OR the character
  differences; do not early-return on the first mismatch. Length is the only leak,
  which is standard for bearer tokens; no async digest in the hot path.
- **Bound the identity table.** Evict the oldest entries past the cap; since the
  window is fixed, insertion order is expiry order, and re-insert a rolled-over
  window so a hot caller is not evicted before a cold one. A module-level `Map`
  plus the test-only `resetRateLimits()` is the shape.
- **Be honest about the limiter.** It is per-instance, resets on a cold start, and
  N instances multiply the effective quota. State that plainly; do not imply a
  global quota.
- **Set each header only where it belongs:** `retry-after` on the 429,
  `www-authenticate` on the 401, and use lowercase names in the header maps.
- **Server-side only.** `access.ts` lives under `src/server/api/*` and must not
  import browser modules; a type-only import of `NipostGatewayEnv` is fine.
- **Do not touch the NIPOST key path.** `NIPOST_PUBLISHABLE_KEY` is the
  server-to-NDAPS credential; `ATLAS_API_KEYS` is what external callers present.
  Different secrets, different direction.
- **Confirmed live in Step 4.** `loadEnv(mode, cwd, '')` in `vite.config.ts` does
  include `process.env`, so `ATLAS_API_KEYS=... ATLAS_API_RATE_LIMIT=3 npm run dev`
  is enough to exercise the gate locally with no `.env` edit.

## Red-team notes

- **Coverage gap caught: the dev middleware forwards no request headers.** It
  builds its `Request` with only `method`, so `Authorization`, `X-API-Key`, and
  `x-forwarded-for` never reach the handler in dev. Left alone, enabling
  `ATLAS_API_KEYS` would lock a developer out of their own dev server. Header
  forwarding became Step 4.
- **Coverage gap caught: CORS would block the key.** `access-control-allow-headers`
  is `Content-Type` only, so a browser sending `Authorization` or `X-API-Key`
  fails preflight before the gate ever runs. Widening it is part of Step 3, not an
  afterthought, and `Retry-After` is exposed so a browser client can back off.
- **Test trap caught.** `handler.test.ts` makes 63 handler calls; with a shared
  in-memory bucket, a 60-per-minute default would fail that suite before the new
  tests ran. The reset is an explicit sub-item.
- **Split for review.** The draft had one `access.ts` step; key handling and the
  limiter are now separate steps, and dev/README/live work is a fourth.
- **Order is a decision, flagged.** Rate limit before auth, and the gate before
  the method check: an unauthenticated `POST` is a `401`, not a `405`. Chosen so
  an unauthenticated caller learns nothing about the route table.
- **"Unset means open" is the riskiest call here.** It preserves the public demo
  and the whole existing suite, but a production deploy that forgets
  `ATLAS_API_KEYS` serves the API openly. Failing closed would break the demo and
  every existing test. The README row states it; confirm at review.
- **Stated limit, not hidden.** The limiter caps casual abuse, not a distributed
  attack; platform limits are the durable layer. That is a deployment concern.
- **Constant-time compare leaks length only.** Standard for bearer tokens and not
  fixed here; hashing would need an async digest per request.
- **No `X-RateLimit-*` headers.** A `remaining` field was dropped from the result
  rather than carried unused, so no dead quota plumbing ships.
