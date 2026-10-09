# Feature: Nearby location queries

**From build-plan:** feature 7
**Status:** verified

## Goal

Answer "what postcodes are near me?" or "what is near Ikeja?" through conversation. The model resolves a real coordinate (the current map view, an explicit coordinate in the question, or a landmark's location from another tool) and calls the existing `getNearby` tool; the reply carries a client-derived nearby list showing each unit's postcode, distance, and area context, so the user gets real nearby units rather than a guess.

## In scope

- A client-derived `nearby` payload on the reply, built only from the executed `getNearby` result, following the feature 4/5/6 pattern (zero new provider calls).
- A nearby list UI in the assistant bubble: the origin coordinate, unit rows with postcode, address when present, and distance, plus an honest empty state when nothing is within range.
- Prompt guidance: use `getNearby` for "near me" or "near <place>" questions, resolve the coordinate first, never invent coordinates, and say plainly when the search returned nothing.
- A coordinate in the prompt so "near me" is answerable: the server currently sanitizes `mapCenter` to a hardcoded `[0, 0]`, so the model never sees the user's actual view. Step 3 includes a validated `mapCenter` in the map-scope line (finite lat/lng only, `mapZoom` untouched) so "near me" resolves against the real view instead of always being unanswerable.
- The map location slot left alone: nearby is a list, not a single focus point, so no `location` is set from it.

## Out of scope

- Map navigation, zoom, selection, and highlight (feature 8). `[View on map]` stays disabled.
- A "use my GPS location" permission flow or any browser geolocation call. The origin is the map view or a named place, not the device.
- Radius controls, sorting, pagination, or map markers for the nearby units. One default radius, one order.
- The gateway `/v1/search/nearby` contract change, the 3b tool schema change, the 3c transport, and the dataset snapshot.
- Conversation context and pronoun follow-ups across turns (feature 10), Nigerian phrasing (feature 11), and the ambiguity flow (feature 12). "Near me" is deliberately part of this feature, not feature 10: it needs one coordinate, not remembered turns.
- No new tool, dependency, server route, or gateway proxy.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps
- [x] **Step 1 - nearby payload and derivation** - Added `NearbyResultList` and `NearbyResultItem` to `src/lib/ask/types.ts` plus `nearby?` on the response and message, and a pure exported `deriveNearby(toolTurns)` in `responder.ts`, threaded through `attachDerived`. The last successful `getNearby` result wins; each `NearbyUnit` becomes a row with postcode, `address` as the label, `distance_m`, and `parent` (LGA and state names joined). An empty array yields a payload with `items: []` and `total: 0`; a failed result or no `getNearby` yields `undefined`. The origin and radius come from the matching tool call's own `arguments`, parsed with the same guards as the 3c path: malformed JSON, a non-numeric coordinate, or out-of-range lat/lng drops the origin but keeps the rows, and `radius_m` falls back to the executor's 300 m cap. Spec correction: the row carries `parent`, not `locality`, because the 3b `NearbyUnit` has no `locality` field; the spec and contract now say so.
  *Evidence (2026-10-09):* browser probe over the real module: a 3-unit result gave `origin {9.0579, 7.4937}`, `radius_m: 250`, rows carrying address label, distance (82.4, 210.9, 45) and parent "Abuja Municipal, FCT" (the third unit has neither address nor names, so both are absent); an empty array gave `items: []`, `total: 0`, and the 300 m default; malformed `{not json` arguments and `{lat: 'north'}` coordinates both dropped the origin, kept the 3 rows, and did not throw; a failed result, an empty turn list, and non-array data each returned `undefined`; across two turns the last call won (origin 40/50, radius 100, 1 row); zero page errors; lint + build green.
- [x] **Step 2 - nearby list UI** - Added `AskAtlasNearbyList` and rendered `message.nearby` in `AskAtlasMessageBubble` below the decoded card; the panel passes `nearby` from the reply. The header counts the units, the second line states the origin ("within <radius> of <lat, lng>", or the bare radius when the origin did not parse), and each row shows the postcode in mono, the address label, the parent context, and the distance rounded to metres ("<n> m away"). Rows cap at 12 with a "+N more" line; an empty payload shows "No verified units within that range." Rows are `<li>` inside `<ul role="list">`, text stays selectable, and the bubble palette is matched in light and dark.
  *Evidence (2026-10-09):* demo probe over the real component in light and dark: a 3-unit payload rendered "3 NEARBY UNITS", "within 250 m of 9.0579, 7.4937", rows "FC-02-D43-LG-01 / Infrastructure Bank, Abuja / Abuja Municipal, FCT / 82 m away", "FC-02-D43-LG-02 ... 211 m away", and a row with no address or parent showing only "45 m away"; a 15-unit payload rendered 12 rows plus "+3 more"; an empty payload rendered "No verified units within that range."; a payload with no parsed origin rendered the bare "within 300 m"; 3 lists; user-select computed `text`; zero console errors; screenshots `step2-light.png` and `step2-dark.png`. lint + build green.
- [x] **Step 3 - nearby prompt guidance and a usable map coordinate** - Added a nearby block to the system prompt: resolve the coordinate first (map center for "here"/"near me"/"around here", landmark coordinates from `searchLocation` or `getPostcode`, or one the user typed), never guess a coordinate or pass a place name as lat/lng, state the radius, and when the result is empty say no verified units are within that range instead of widening the search. To make "near me" answerable, `sanitizeContext` now keeps a range-checked `mapCenter` pair instead of hardcoding `[0, 0]`, and `describeSelection` prints it through a new `formatCenter` helper that says "map center unknown" for non-finite values. `sanitizeContext` is now exported so it can be probed. The lookup, exploration, and decode blocks are unchanged, and `mapZoom` is untouched.
  *Evidence (2026-10-09):* probe for every reply language (en, yo, ha, ig): the nearby block, the never-guess rule, the empty-result rule, and "map center 9.0579, 7.4937" are all present while the feature 4, 5, and 6 blocks still appear. `sanitizeContext` kept a valid `[6.5244, 3.3792]` and returned `[0,0]` for NaN, string, out-of-range `[99, 3.3]`, missing, and short-pair input; `mapZoom` stayed `4`; a non-finite center rendered "map center unknown"; zero page errors; lint + build green.
- [x] **Step 4 - live nearby evidence** - Drove the real panel against the restarted dev server on port 3001.
  *Evidence (2026-10-09):* live panel, provider nvidia/nemotron-3-super-120b-a12b, zero page errors. "What postcodes are near me?" resolved the origin from the new map-center line (the model reported latitude 9.082, longitude 8.6753, matching the live view), called `getNearby`, and rendered "NEARBY UNITS / within 300 m of 9.082, 8.6753" plus the honest empty state and the verified footer. "What is near coordinates 6.5244, 3.3792?" and a Lagos coordinate did the same with their own origin line. Screenshots `step4-near-me.png`, `step4-near-lagos.png`, `step4-near-abuja.png`.
  *Data reality found while gathering this evidence:* the NIPOST `/v1/search/nearby` endpoint returns `200` with an empty `data` array for every coordinate tried, including the exact coordinates of the bundled discovery landmarks, at 300 m, 1000 m, and 5000 m radii, and with both `radius` and `max_distance_m` parameter names. The sibling `/v1/lookup` endpoint answers normally (200 with a `not_found` record), so the key and the gateway path are healthy; the nearby index itself carries no rows. Consequently every live nearby reply renders the empty state, and the populated-list rendering is proven by the step 2 demo probe rather than by live data. This matches the spec's anticipation for the one gateway-only tool, and no server proxy was added.

- [ ] **Step 3 - nearby prompt guidance and a usable map coordinate** - Add a nearby block to the system prompt: for "near me" or "near <place>", call `getNearby` with a real coordinate; resolve the origin from the map center line, a landmark's coordinates from `searchLocation` or `getPostcode`, or a coordinate the user gave; never invent or guess a coordinate; state the radius used; when the result is empty, say no verified units are within that range instead of listing something else. In `handler.ts`, make `sanitizeContext` keep a validated `mapCenter` pair (finite numbers inside the lat/lng ranges) instead of hardcoding `[0, 0]`, falling back to `[0, 0]` when absent or malformed, and print it in the map-scope line in `prompt.ts`. Keep the existing lookup, exploration, and decode blocks intact. *Done when:* `buildSystemPrompt` contains the nearby guidance and the center coordinate for every reply language; a probe shows `sanitizeContext` keeping a valid center and rejecting a malformed one; lint and build green.

- [ ] **Step 4 - live nearby evidence** - Drive the panel against the restarted dev server: "what postcodes are near FC-02-D43-LG-01" (or a coordinate the model can resolve) renders the nearby list with the verified footer; a place with no nearby units renders the empty state; a plain lookup question is unchanged. *Done when:* the live replies show the nearby list and the verified footer, or the probe records the honest text-only fallback if the free-tier providers are down that run; screenshots saved; lint and build green.

## Files / areas

- `src/lib/ask/types.ts` - `NearbyResultList`, `NearbyResultItem`, `nearby` on response and message (step 1, load-bearing).
- `src/lib/ask/responder.ts` - `deriveNearby`, attach wiring (step 1).
- `src/components/ask/AskAtlasNearbyList.tsx` - new list component (step 2).
- `src/components/ask/AskAtlasMessageBubble.tsx` - render the nearby list (step 2).
- `src/components/ask/AskAtlasPanel.tsx` - pass `nearby` from the reply (step 2).
- `src/server/ask/prompt.ts` - nearby guidance and the map center line (step 3).
- `src/server/ask/handler.ts` - validated `mapCenter` in `sanitizeContext` (step 3).

## Data / contracts

- `NearbyResultItem`: `{ postcode: string; label?: string; distance_m?: number; parent?: string }`. `parent` is the LGA and state names joined, matching the feature 5 row convention. The 3b `NearbyUnit` has no `locality` field, so the row does not claim one.
- `NearbyResultList`: `{ origin?: { lat: number; lng: number; label?: string }; items: NearbyResultItem[]; total: number; radius_m?: number }`.
- `AskAtlasResponse.nearby?: NearbyResultList` and `AskAtlasMessage.nearby?: NearbyResultList`. Client-derived only; the server never sets it.
- `deriveNearby(toolTurns)`: last `ok: true` `getNearby` result, mapping `NearbyUnit` rows. An empty array yields a payload with `items: []` and `total: 0` (a real answer); a failed result or no `getNearby` leaves `nearby` unset. Independent of `deriveLookup`, `deriveResults`, and `deriveDecoded`; a nearby reply normally carries only `nearby`.
- The origin is derived client-side from the matching `AskToolCall.arguments` in the same turn (the coordinate the model actually sent), not from the prose and not from the map context. Parsing is guarded exactly like the 3c argument path: malformed JSON, a missing or non-numeric `lat`/`lng`, or out-of-range values drop the origin but keep the rows. `radius_m` is the call's own `radius` when present and positive, otherwise 300, matching `NEARBY_RADIUS_CAP`. The map context stays feature 8/10 territory.
- The tool contract is unchanged: `getNearby({ lat, lng, radius? })` returns `NearbyUnit[]` already capped at 50 by the executor. The display cap of 12 is a UI concern with `total` kept for the "+N more" line.
- Server context: `AtlasContextSnapshot.mapCenter` becomes real instead of the hardcoded `[0, 0]`. Validation is finite-number plus range checked inside `sanitizeContext`, with `[0, 0]` as the fallback, so no unchecked client value reaches the prompt. `mapZoom` stays as-is and stays unused by the prompt. This is server input validation, so it travels with the step 3 diff.

## Testing

- No `test` command is declared in `AGENTS.md`, so the test gate is off and this feature ships on build plus browser evidence. If `/tests` is added later, `deriveNearby` is a first candidate: pure and assertable with fixed turns for populated, empty, failed, and no-call cases.
- No `Browser tests` command is declared; evidence is dev-server probes and screenshots on `localhost:3001`.
- Steps 1 and 2 are deterministic (probe pages importing the real modules; fabricated tool turns for the derivation; a demo page rendering the real component). Step 3 asserts the built prompt text. Step 4 needs one live provider reply.
- `getNearby` is the one tool that is gateway-only: `fetchNearby` has no bundled snapshot equivalent. The NIPOST gateway rejects the browser origin (`403 origin_not_allowed`), so in-browser nearby evidence depends on the origin being allowed; if it is not, the probe records the honest empty/permission outcome and the model text path rather than pretending nearby data was returned. Do not add a server proxy to work around this; feature 5 set that precedent.
- Every step: `npm run lint` (`tsc --noEmit`) and `npm run build`.

## Notes for the AI

- Keep the 3b tool result shapes stable and do not change the `getNearby` schema, description, or the 50-unit executor cap. Features 4, 5, and 6 must not regress.
- Widening `sanitizeContext` to pass a real `mapCenter` touches a shared server input path. Keep it to the center pair only: no new fields, no loosening of the existing string and object validation, and a `[0, 0]` fallback on anything malformed.
- Nearby is the weakest data path in the product: it is the only tool with no offline snapshot. Be honest in the copy when nothing is nearby rather than falling back to a wider or invented search.
- Never let the model state a distance, postcode, or locality that is not in the tool result. The card and the prose both read from the executed result only.
- Client versus server: derivation and UI run client-side; only prompt text changes server-side. Provider keys stay server-side.
- No em dashes, no ellipsis character (use `...`), no `any`, no inline styles, functions under 50 lines.
- Keep the list compact and consistent with the feature 5 results list; the model says the sentence, the card shows the rows.