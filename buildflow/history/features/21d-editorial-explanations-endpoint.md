# Feature: Editorial explanations endpoint

**From build-plan:** feature 21d
**Status:** verified

## Goal

Expose the curated feature 19 Atlas copy on the public API. That content explains
the Nigerian digital addressing system in four topics (hierarchy, postcode parts,
single postcode, and NDAPS) and already grounds the `explainAtlas` tool; this
sub-feature serves the same copy as read-only API content. It is editorial Atlas
prose, not NIPOST data, so every payload is labelled `source: "editorial"` - the
provenance idiom the postcode record already uses with `source: "nipost-ndaps"`.

## In scope

- `src/server/api/explain.ts`: the public editorial shapes
  (`AtlasExplanationSummary`, `AtlasExplanationDetail`) and two pure readers
  (`listExplanations`, `readExplanation`) over the feature 19 content.
- Two read-only routes on the 21a contract:
  - `GET /api/v1/explanations`
  - `GET /api/v1/explanations/{topic}`
- The `source: "editorial"` provenance label on both payloads.
- A long cache header for the static copy.
- Unit tests for the readers, and per route for the envelope, labelling, the
  `404`, the cache header, and the no-upstream guarantee.

## Out of scope

- Access control, API keys, rate limiting, and quotas: feature 21e.
- Developer documentation, examples, and OpenAPI: feature 22.
- Any new topic or copy edit. This feature serves the feature 19 content as it
  stands; adding a topic is a content change in `src/lib/explain/topics.ts`, not
  an API change.
- Changing the feature 19 content, the `explainAtlas` tool, or the
  `AtlasExplanation` contract.
- Changing any 21a, 21b, or 21c route, the `/api/nipost` proxy, or any browser
  module.

## Build steps

- [x] **Step 1 - Editorial readers and shapes** - add
  `src/server/api/explain.ts` with `AtlasExplanationSummary` (`topic`, `title`,
  `source`), `AtlasExplanationDetail` (the `AtlasExplanation` fields plus
  `source: "editorial"`), `listExplanations()`, and `readExplanation(topic)`.
  Pure functions over `EXPLAIN_TOPICS`, `getExplanation`, and
  `EXPLANATION_CONTENT` from `src/lib/explain/topics.ts`; trim and lowercase the
  topic before lookup; return a fresh object so the shared content constant is
  never mutated. *Done when:* `explain.test.ts` proves `listExplanations()`
  returns one labelled row per declared topic with the content titles,
  `readExplanation("hierarchy")` returns the full content with
  `source: "editorial"`, a whitespace-padded and mixed-case topic resolves, an
  unknown or blank topic returns `null`, and mutating a result leaves
  `EXPLANATION_CONTENT` unchanged.

- [x] **Step 2 - Explanation routes** - extend `src/server/api/handler.ts`: add
  `EDITORIAL_MAX_AGE_SECONDS` (86400) and `handleExplanationIndex` /
  `handleExplanation`, and wire `GET /explanations` and
  `GET /explanations/{topic}` into `handleApi`, returning `404 not_found` for an
  unknown topic. No upstream call, so the routes work with no gateway key.
  *Done when:* handler tests prove `/api/v1/explanations` returns
  `200 { data: [ <four rows> ] }` with `source: "editorial"` and
  `cache-control: public, max-age=86400`, `/api/v1/explanations/postcode_parts`
  returns the full content including its `example` while an empty-key env still
  answers `200`, a mixed-case topic resolves, `/api/v1/explanations/not_a_topic`
  returns `404 not_found` with `no-store`, `/api/v1/explanations/` resolves to
  the index, and no test triggers the fetch stub.

- [x] **Step 3 - Verify against the live route** - run `npm run dev` and confirm
  the editorial surface end to end, then fold any confirmed detail into these
  Notes. *Done when:* `/api/v1/explanations` returns the four-row index,
  `/api/v1/explanations/postcode_parts` returns the full content with
  `source: "editorial"`, `/api/v1/explanations/not_a_topic` returns
  `404 not_found`, and `npm run test && npm run lint && npm run build` pass.

## Files / areas

- New: `src/server/api/explain.ts`, `src/server/api/explain.test.ts`.
- Changed: `src/server/api/handler.ts` (one cache constant and two routes),
  `src/server/api/handler.test.ts`.
- Read-only reuse: `src/lib/explain/topics.ts` (`getExplanation`,
  `EXPLANATION_CONTENT`) and `src/lib/tools/types.ts` (`EXPLAIN_TOPICS`,
  `AtlasExplanation`, `ExplainTopic`).

## Data / contracts

Extends the 21a locked contract. Keep the `{ data }` /
`{ error: { code, message } }` envelope, reuse `not_found`, and add no new error
codes.

Public editorial shapes:

```ts
interface AtlasExplanationSummary {
  topic: ExplainTopic;   // "hierarchy" | "postcode_parts" | "single_postcode" | "ndaps"
  title: string;
  source: 'editorial';
}

interface AtlasExplanationDetail {   // AtlasExplanation plus provenance
  topic: ExplainTopic;
  title: string;
  summary: string;
  points: string[];
  example?: string;      // present only on postcode_parts
  source: 'editorial';
}
```

Routes:

```text
GET /api/v1/explanations          200 { "data": AtlasExplanationSummary[] }

GET /api/v1/explanations/{topic}  200 { "data": AtlasExplanationDetail }
                                  404 { "error": { "code": "not_found", ... } }
```

- No query parameters and no upstream fetch, so these routes can never return
  `not_configured`, `upstream_error`, or `upstream_unreachable`.
- `{topic}` is trimmed and lowercased before lookup; an unknown or blank topic is
  `404 not_found`. A trailing slash (`/explanations/`) resolves to the index.
- Cache: `public, max-age=86400` on both success bodies; the `404` rides the
  shared error path, which is already `no-store`.

## Testing

Verification command: `npm run test && npm run lint && npm run build`.

- Logic under test (vitest): the readers in Step 1, and the routing, labelling,
  cache headers, and `404` in Step 2. Use the existing `get()` helper and assert
  the fetch stub is never called, since these routes are upstream-free.
- No `Browser tests` command is declared in `AGENTS.md`; the integration evidence
  is the live dev `curl` check in Step 3, as in 21a, 21b, and 21c.
- Edge cases: an unknown topic, a whitespace-padded and mixed-case topic, a
  trailing slash, the `example` present only on `postcode_parts`, a result object
  that is a copy rather than the shared constant, and a route that never fetches.

## Notes for the AI

- **Extends the 21a locked contract.** Reuse `not_found` and add no codes. Do not
  reshape any 21a, 21b, or 21c response.
- **Label provenance, do not wrap it in prose.** Follow the record's own idiom:
  `source: "nipost-ndaps"` on records, `source: "editorial"` on explanations.
  That one field is the machine-readable "not NIPOST data" label. Do not invent a
  `verified: false` flag (that is a NIPOST concept) or a `meta` sibling to `data`
  (the envelope is locked).
- **Reuse the feature 19 content; do not copy it.** `src/lib/explain/topics.ts`
  is the single source of truth and is pure (`import type` only), so it is safe
  to import from `src/server/api/*`. `topics.test.ts` already asserts the copy is
  em-dash-free; add no new prose here.
- **No upstream call.** `getExplanation` reads a module constant, so these routes
  never touch the gateway: no fetch, no key, and no `not_configured`. They must
  not call `fetchNipostJson`.
- **Return a copy.** `{ ...explanation, source: 'editorial' }` rather than
  mutating the shared `EXPLANATION_CONTENT` entry.
- **Server-side only.** Do not import browser modules (`src/lib/atlas/store.ts`,
  `src/lib/api/postcodeClient.ts`, `src/lib/tools/executors.ts`) into
  `src/server/api/*`. A type-only import of `src/lib/tools/types.ts` for
  `EXPLAIN_TOPICS` is fine.
- **A long cache is right here.** The copy changes only on deploy, so
  `public, max-age=86400` is deliberate; a deploy replaces the asset and the
  edge cache. Do not reuse the one-hour reference value.
- **Plain `toLowerCase()`.** The topics are ASCII slugs, so no locale argument is
  needed.

## Red-team notes

- **The index returns summaries, not full content, to match the sibling routes.**
  `/states` returns `{ code, name }` rows and a separate route carries the
  detail; `/explanations` mirrors that with `{ topic, title, source }` plus
  `/explanations/{topic}`. The four explanations are small enough to inline, but
  matching the existing shape keeps the surface predictable for feature 22, which
  documents it.
- **`source` is the label, so it is load-bearing.** The build-plan line asks for
  the copy "labelled as editorial rather than verified NIPOST data". A
  `source: "editorial"` field, matching the record's `source: "nipost-ndaps"`, is
  the smallest honest label. It is flagged for feature 22.
- **`not_found` is the only error here.** There is no malformed-input case: a
  route with a query param would need `invalid_code`, but these have none. An
  unknown topic is a missing resource, and an extra path segment falls through to
  the existing `unknown_route`.
- **A trailing slash is the index, not a `404`.** `handleApi` already strips
  trailing slashes, so `/explanations/` resolves to `/explanations`. Only a
  non-empty, unknown slug is a `404`; a blank-but-present slug (`/explanations/%20`)
  trims to empty and is a `404`.
- **Normalizing the topic is a deliberate, tiny divergence.** The reference
  routes normalize their path parameters; doing the same for the topic means
  `/explanations/Hierarchy` resolves instead of 404ing on case. The stored slugs
  stay lowercase.
- **No access gate yet.** These routes are open, like every 21a-21c route; 21e
  adds the gate around all of them together. Adding a per-route key check now
  would be inconsistent and premature.
