# Feature: Natural-language postcode lookup (4)

**From build-plan:** feature 4
**Status:** in progress

## Goal

Make "what is the postcode for X?" work end to end: the model resolves a plain-language place or landmark through the 3b tools, and the reply carries a deterministic, verified postcode payload derived from the tool results the client already executed - so the chat returns Atlas data, not just claims about it.

## Design reference

None. Behavioral feature plus one small self-defined result chip; the chip structure is specified in step 3.

## In scope

- **Lookup workflow in the system prompt** - `searchLocation` first for place names; never call `getPostcode` with a guessed code; a landmark result carrying a five-segment postcode is verified and quoted verbatim; state/LGA/district/area matches have no single postcode (postcodes are unit-level) and the reply must say that and offer to narrow; an explicit code goes through `getPostcode` and the returned record is reported exactly; ambiguous searches list candidates and ask the user to pick.
- **Verified lookup payload** - `VerifiedLookup` on `AskAtlasResponse` and `AskAtlasMessage`, derived client-side in `deriveLookup(toolTurns)` from the executed tool results (zero new provider calls): last successful `getPostcode` with data wins; otherwise the last `searchLocation` with exactly one landmark candidate; ambiguity means no payload.
- **Location slot wiring** - when the derived lookup carries coordinates, set `response.location` so the (feature 8) map slot is populated; the `[View on map]` button stays disabled.
- **Verified postcode chip** - `AskAtlasMessageBubble` renders the payload above the grounding footer: mono dashed postcode, label, state/LGA names when present, "Verified postcode" tag.
- **Stub honesty cleanup (small, strikable)** - remove the canned `Ikeja -> "Postcode: 100001"` rule and the stale "N-ATLAS integration arrives in feature 2" copy from the dev stub so nothing in the app fabricates a postcode.

## Out of scope

- Feature 5 (location exploration), 6 (decoding), 7 (nearby), 8 (map navigation button activation), 9 (grounding indicator chrome), 12 (formal ambiguity resolution chips).
- Narrowing follow-ups ("which district?") beyond what the existing `history` transport already carries; rich conversation context is feature 10.
- Changing the 3c `grounding` wiring; the footer stays the only signal when no postcode-bearing result exists.
- New NIPOST endpoints, snapshot changes, provider/key changes, models.

## Build loop

Build one step at a time, never the whole feature at once. Plan mode lays out each step before any code; the AI implements just that step, shows the diff, and `/implement` ticks the box. Progress is tracked in this file, so a fresh session resumes from the first unchecked step.

- [x] **Step 1 - system prompt: verified postcode lookup workflow** - extend `src/server/ask/prompt.ts` with the lookup procedure: place names go through `searchLocation` first (never a synthesized code into `getPostcode`); a landmark result with a postcode is verified and quoted exactly as returned; state/LGA/district/area matches have no single postcode and the reply must say so plainly and offer to narrow; an explicit code (dashed or compact) goes through `getPostcode` and an empty result is reported as unmapped; ambiguous searches list the candidates and ask the user to pick before answering with a code. Keep the existing honest text-only rules intact.
  *Done when:* a dev probe imports `buildSystemPrompt` and asserts the workflow copy is present (searchLocation-first, no-invent rule, verbatim quoting) for every reply language; no "not connected yet" phrasing returns; lint + build green.
  *Evidence (2026-10-09):* probe passed 20/20 prompt checks (searchLocation-first, no-invent, quote-verbatim, NO-single-postcode, no-stale-copy) for en/yo/ha/ig; lint + build green (tsc --noEmit, ~400ms rolldown build).
- [x] **Step 2 - VerifiedLookup contract + client derivation** - add `VerifiedLookup` and `lookup?: VerifiedLookup` to `AskAtlasResponse` and `AskAtlasMessage` in `src/lib/ask/types.ts`. Add a pure exported `deriveLookup(toolTurns: AskToolTurn[]): VerifiedLookup | undefined` in `responder.ts` scanning executed results in order: prefer the last `ok: true` `getPostcode` result with non-null data; else the last `ok: true` `searchLocation` result whose data holds exactly one `type: 'landmark'` candidate; otherwise `undefined`. Fields: `postcode` (dashed), `label` (record `name`), `stateName`/`lgaName` when the source record carries them, `coordinates` when present, `verified` is always true: a lookup is built only from an executed Atlas tool result, and both the discovery (curated bundled set) and gateway sources are NIPOST data by construction - never model invention. Wire into both return branches of `createApiResponder` (final answer and cap-exhausted); when the lookup has coordinates also set `response.location = { lat, lng, label }`. Map `lookup: res.lookup` into the reply message in `AskAtlasPanel.handleSend`.
  *Done when:* types compile; a dev probe imports `deriveLookup` and table-tests: single-landmark search -> lookup; two-landmark search -> undefined; LGA-only search -> undefined; successful non-null `getPostcode` outranks an earlier landmark search; `getPostcode` null is ignored; failed tool results are ignored; empty turns -> undefined; lint + build green.
  *Evidence (2026-10-09):* 8/8 deriveLookup table tests passed (single landmark, two landmarks, LGA-only, getPostcode-outranks, null ignored, null-keeps-prior, failed ignored, empty); 3 full mocked-loop cases passed over real `runTool` + local store (15/15 asserts); `verified: true` by construction after a data-driven contract amendment (discovery records carry no per-record `verified` flag, so pass-through was false); lint + build green.
- [x] **Step 3 - verified postcode chip in the bubble** - in `AskAtlasMessageBubble.tsx`, when `message.lookup` is present render above the grounding footer: the dashed postcode in the mono/`font-mono` chip style, the label line when present, a state/LGA names line when present, and a small "Verified postcode" tag. Match the existing bubble palette in dark and light; the grounding footer and engine line stay unchanged; a message without `lookup` renders exactly as today.
  *Done when:* a dev browser probe injects a message with a lookup and the chip shows postcode + label in both dark and light; a message without lookup renders unchanged; lint + build green.
  *Evidence (2026-10-09):* real `AskAtlasMessageBubble` rendered with a lookup message in light + dark; DOM text asserts postcode, label, state/LGA names, "Verified postcode" tag, and grounding footer all present in both themes, zero page errors; screenshot `atlas-feature4/feature4-chip-demo.png`; lint + build green.
- [x] **Step 4 - stub honesty cleanup (small, strikable)** - in `responder.ts`, remove the canned `Ikeja -> "Postcode: 100001"` rule and the stale "N-ATLAS integration arrives in feature 2" wording from the stub; the postcode rule becomes an honest placeholder explaining that real lookups need the answer service (API mode). `VITE_ASK_MODE === 'stub'` stays the debug fallback but never fabricates a postcode.
  *Done when:* grep confirms no postcode value is fabricated anywhere in the stub; stub still answers place-name questions with the placeholders; lint + build green.
  *Evidence (2026-10-09):* `grep -rn "100001" src/` returns zero matches (app-wide, not just the stub); stub rules now answer place names with the honest API-mode placeholder; lint + build green.
- [x] **Step 5 - browser loop + live provider evidence** - extend 3c's probe: a mocked-`/api/ask` browser loop over real `runTool` covers (a) "What is the postcode for The Infrastructure Bank PLC?" -> round 1 `searchLocation`, round 2 final text, final response carries `lookup { postcode: 'FC-02-D43-LG-01', verified: true, coordinates }` and `location`; (b) "postcode for Ikeja" -> final text says an LGA has no single postcode, `lookup` absent, `grounding` still 'atlas' (the search result was ok); (c) "postcode for FC-02-D43-LG-01" -> `getPostcode` path yields a lookup. Then one origin-less Node probe with real keys asks the landmark question through the tools-accepting provider and derives the lookup from the live loop. Finally a dev-browser panel check with a real ask screenshots the bubble showing the verified chip and the grounding footer.
  *Done when:* probe asserts the lookup payload on cases (a) and (c) and its absence on (b); at least one live provider path produces a lookup-carrying reply (or the probe records the text-only fallback honestly if tools providers are flaky that day); the panel screenshot shows the chip; lint + build green.
  *Evidence (2026-10-09):* browser probe 43/43 PASS (prompt x4 languages, deriveLookup table, loop cases a/b/c over the real local store; real data: landmark FC-02-D43-LG-01 found, Ikeja -> 1 candidate / 0 landmarks, getPostcode returns the discovery record). Live origin-less Node probe with real keys: gemini, openrouter, AND nvidia each accepted the tools payload and emitted `searchLocation {"query":"The Infrastructure Bank PLC"}`. Live panel E2E (real /api/ask): nvidia-first run -> grounded reply, chip `FC-02-D43-LG-01` + "Verified postcode" + "Verified against NIPOST postcode data" footer, screenshot `atlas-feature4/feature4-panel-live.png`; a default-order run under free-tier flakiness (gemini HTTP 400, openrouter quota 401) honestly fell back to nvidia text-only -> "Not verified against NIPOST data", no chip (correct: no tool result backed it). lint + build green.

## Files / areas

- `src/server/ask/prompt.ts` (extend) - postcode lookup workflow copy
- `src/lib/ask/types.ts` (extend) - `VerifiedLookup`, `lookup?` on `AskAtlasResponse` and `AskAtlasMessage`
- `src/lib/ask/responder.ts` (extend) - pure exported `deriveLookup`, wiring in both `createApiResponder` branches, stub cleanup (step 4)
- `src/components/ask/AskAtlasMessageBubble.tsx` (extend) - verified postcode chip
- `src/components/ask/AskAtlasPanel.tsx` (extend) - map `lookup` into the reply message
- Consumes (no edits): `runTool`, `searchLocation`/`getPostcode` executors, `atlasStore` discovery points, `LocationCandidate`/`PostcodeLocation` shapes

## Data / contracts

- **`VerifiedLookup`** - `{ postcode: string; label?: string; stateName?: string; lgaName?: string; coordinates?: [number, number]; verified: boolean }` - `postcode` is always the dashed form (for example `FC-02-D43-LG-01`); `verified` is always true because a lookup is derived only from an executed Atlas tool result, and both discovery (the curated bundled set) and gateway records are NIPOST data.
- **Derivation priority** - last `ok: true` `getPostcode` with non-null data, else last `ok: true` `searchLocation` whose data holds exactly one `type: 'landmark'` candidate, else none. Ambiguity (zero or multiple landmark postcodes) means no payload by design: the model should narrow, and feature 12 formalizes that UX.
- **Client-derived only** - the server never sets `lookup`; the additive optional field keeps the shared `AskAtlasResponse` contract stable. The client reply cache stores the response including `lookup`, so repeat questions render the same chip.
- **Prose vs payload** - the model may format the code differently in prose; the chip is authoritative because it is derived from the executed tool result, never from the reply text.
- **`location` slot** - set from lookup coordinates with `label = lookup.label ?? lookup.postcode`; `[View on map]` stays disabled until feature 8.
- **`grounding` unchanged** - 3c semantics stay (atlas iff at least one ok result); an honest LGA reply can still be atlas, and a lookup chip is only one way to be atlas.
- **Data truth** - the LGA no-single-postcode answer is correct: NDAPS postcodes are unit-level, LGAs/districts have none, and the discovery list holds the curated landmark subset (3a); nothing invents `100001`.

## Testing

- `AGENTS.md` declares no `test` command or `Browser tests` command: verification is `npm run lint` + `npm run build` plus Node/browser probes.
- `deriveLookup` is pure and exported precisely so the probe can table-test its edge cases (single/multi landmark, LGA-only, `getPostcode` null, failure-only turns, empty turns).
- Reuse the 3c technique: the server modules are browser-safe TS, so `buildSystemPrompt` and `deriveLookup` import in-page; the `/api/ask` loop runs mocked with real `runTool`; one live origin-less Node probe with real `.env` keys closes the loop.
- Env caveat unchanged: `api.postcode.gov.ng` 403s browser origins, so in-browser lookups derive from the bundled discovery landmarks (verified), never the gateway.

## Notes for the AI

- **Zero provider cost** - the payload is derived from tool results the client already executed in the 3c loop; no new provider call, no new request field, no server change.
- **Do not weaken 3c wiring** - `grounding`, caps, cache rules, and the no-tools retry stay exactly as shipped; `lookup` is additive.
- **The chip must not lie** - attach a lookup only when the derivation rules find an unambiguous postcode-bearing result; no "looks like a postcode" heuristics or prose scraping.
- **Stub cleanup is its own step** - keep it small and separate from the loop work so it can be struck from review without touching the payload.
- **No `any`, no em dashes in generated content** - strict TS, interfaces, camelCase, functions under 50 lines, comments only for why.