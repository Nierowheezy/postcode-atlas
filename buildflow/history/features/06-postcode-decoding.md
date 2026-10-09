# Feature: Postcode decoding

**From build-plan:** feature 6
**Status:** verified

## Goal

Make "decode this postcode" work by conversation: the user submits a code (dashed or compact) and Ask Atlas explains its structure and location. N-ATLAS calls the existing `decodePostcode` tool, the reply carries a deterministic decoded payload derived from the executed tool result, and the bubble shows a short breakdown of the five segments beside the prose. This teaches the NDAPS structure (state, LGA, district, area, unit) instead of only returning a location.

## In scope

- A client-derived decoded payload on the reply, built only from the executed `decodePostcode` tool result (zero new provider calls), following the feature 4 and 5 pattern.
- A decoded breakdown card in the assistant bubble: the dashed postcode, the five labelled segment values, resolved state and LGA names when present, the compact form, and honest status tags (valid structure, location confirmed, or the invalid reason).
- An honest "location confirmed" signal: a decode counts as verified only when the full postcode mapped to a record. This fixes `decodePostcode`, whose `verified` is currently `lookup?.verified` and so is `undefined` for the bundled records, which carry no per-record flag.
- System-prompt guidance: decode only postcode-shaped input, call `decodePostcode`, explain the segments and location from the result, give the expected format when invalid, and use `searchLocation` for a place name instead.
- The map location slot populated from decoded coordinates, exactly like feature 4, with `[View on map]` still disabled.

## Out of scope

- Map navigation, zoom, selection, and highlight (feature 8). `[View on map]` stays disabled.
- Nearby coordinate queries (feature 7) and the nearby-unit list.
- Conversation context and pronoun follow-ups (feature 10); the history window is unchanged.
- Nigerian phrasing coverage (feature 11) and the ambiguity clarification flow (feature 12). Decoding is deterministic on structure, so it needs no new disambiguation step.
- Any new tool, gateway change, snapshot change, dependency, or 3c transport change. The `decodePostcode` tool already exists (feature 3b).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - decoded payload and derivation** - Add `decoded?: DecodedPostcode` to `AskAtlasResponse` and `AskAtlasMessage`, reusing the existing `src/lib/tools/types.ts` shape (the module `ask/types.ts` already imports `ToolError` from). Add a pure, exported `deriveDecoded(toolTurns): DecodedPostcode | undefined` to `responder.ts`: the last `ok: true` `decodePostcode` result that passes a light shape guard wins, including an invalid-structure payload (`valid: false`) so the UI can explain it; a failed result or no decode yields `undefined`. Thread `decoded` beside `lookup` and `results` in the attach step, and set `response.location` from decoded coordinates when present and no location is set yet. In `executors.ts`, set `verified: lookup ? lookup.verified !== false : false` so a decode is confirmed when the full postcode mapped to a record and the record is not explicitly unverified; a missing flag (bundled landmarks) counts as confirmed, matching feature 4's by-construction rule. *Done when:* a probe table-tests `deriveDecoded`: a mapped decode returns the segments, names, coordinates, and `verified: true`; an invalid structure returns `valid: false` with the reason; a failed result and a reply with no decode both return `undefined`; a decode of a bundled landmark reports `verified: true`; lint and build green.
  *Evidence (2026-10-09):* browser probe over the real modules on the dev server: FC-02-D43-LG-01 gave `mappedVerified: true` with coordinates [9.057977, 7.493727], and `deriveDecoded` returned `verified: true` with the same coordinates; invalid input `12345` returned `valid: false` with reason "Expected STATE-LGA-DISTRICT-AREA-UNIT, for example FC-02-D43-LG-01."; a failed decode result and an empty turn list both returned `undefined`; zero page errors; lint + build green.
- [x] **Step 2 - decoded breakdown card** - Added `AskAtlasDecodedCard` and rendered `message.decoded` in `AskAtlasMessageBubble` below the results list; the panel passes `decoded` from the reply. A valid decode shows the dashed postcode in mono, a five-cell grid of labelled segments (State, LGA, District, Area, Unit), the resolved state and LGA names when present, a muted "Also written <compact>" line, a "Valid structure" tag, and a "Location verified" tag only when `verified` is true (otherwise "Location not confirmed in the Atlas dataset"). An invalid decode shows the submitted input, a "Not a valid postcode" tag, and the `reason` line. Segment cells are `<li>` inside a `<ul role="list">`, text stays selectable, and the bubble palette is matched in light and dark.
  *Evidence (2026-10-09):* demo probe over the real component in light and dark: mapped decode rendered `FC-02-D43-LG-01` with segments FC / 02 / D43 / LG / 01, names "Federal Capital Territory, Abuja Municipal Area Council", "Also written FC02D43LG01", and both the "Valid structure" and "Location verified" tags; the valid-but-unmapped case rendered the "Location not confirmed in the Atlas dataset" line instead of the verified tag; the invalid case rendered "12345", "Not a valid postcode", and the expected-form reason; 2 lists with 5 cells each; user-select computed `auto`; zero console errors; screenshots `step2-light.png` and `step2-dark.png`. lint + build green.
- [x] **Step 3 - decode prompt guidance** - Added a decode block to the system prompt: when asked to decode or explain a postcode, or what a code's parts mean, call `decodePostcode` and answer by reading the five segments left to right (STATE, LGA, DISTRICT, AREA, UNIT); when `valid` is false, say the input is not a valid postcode and give the expected form `STATE-LGA-DISTRICT-AREA-UNIT` (for example `FC-02-D43-LG-01`); when `verified` is not true, say the structure is valid but the location is not confirmed in the Atlas dataset and do not infer a place from the codes; for a place name use `searchLocation` instead. The feature 4 lookup block and the feature 5 exploration block are unchanged.
  *Evidence (2026-10-09):* probe over `buildSystemPrompt` for every reply language (en, yo, ha, ig): the decode block, the segment order, the expected-form hint, the not-confirmed caveat, the feature 4 `getPostcode` rule, and the feature 5 `getStates` exploration block are all present; zero page errors; lint + build green.
- [x] **Step 4 - live decode evidence** - Drove the real panel against the restarted dev server on port 3001.
  *Evidence (2026-10-09):* live panel, provider nvidia/nemotron-3-super-120b-a12b. "Decode FC-02-D43-LG-01" returned a per-segment explanation in prose and rendered the card with all five segments, the resolved names, the compact form, and both green tags, plus the "Verified against NIPOST postcode data" footer and the disabled `[View on map]` placeholder. "decode 12345" rendered the invalid state ("Not a valid postcode" plus the expected-form reason) and no verified tag. The unchanged feature 4 path still behaves: "What is the postcode for Ikeja?" explained that an LGA has no single postcode and attached no verified chip. All three replies grounded, zero page errors; screenshots `step4-decode-valid.png`, `step4-decode-invalid.png`, `step4-placename.png`.

## Files / areas

- `src/lib/tools/executors.ts` - `decodePostcode` verified signal (step 1).
- `src/lib/ask/types.ts` - `decoded?: DecodedPostcode` on response and message (step 1, load-bearing).
- `src/lib/ask/responder.ts` - `deriveDecoded`, attach wiring, location slot (step 1).
- `src/components/ask/AskAtlasDecodedCard.tsx` - new breakdown card (step 2).
- `src/components/ask/AskAtlasMessageBubble.tsx` - render the decoded card (step 2).
- `src/components/ask/AskAtlasPanel.tsx` - pass `decoded` from the reply (step 2).
- `src/server/ask/prompt.ts` - decode guidance (step 3).

## Data / contracts

- Reuses the existing tool shape (no new type): `DecodedPostcode` from `src/lib/tools/types.ts` (the same module `ask/types.ts` already imports `ToolError` from, so no new cycle) - `postcode`, `compact`, `display`, `valid`, `reason?`, `segments`, `stateName?`, `lgaName?`, `coordinates?`, `verified?`.
- `AskAtlasResponse.decoded?: DecodedPostcode` and `AskAtlasMessage.decoded?: DecodedPostcode`. Client-derived only; the server never sets it, so the shared wire shape stays stable.
- `deriveDecoded(toolTurns)`: last `ok: true` `decodePostcode` result, narrowed by a light shape guard (`postcode` is a string, `segments` is an object). Priority is independent of `deriveLookup` and `deriveResults`; a decode reply normally carries only `decoded`. A failed result or no decode leaves it unset.
- `verified` semantics: true only when `decodePostcode` mapped the full code to a record and the record is not explicitly unverified (`lookup ? lookup.verified !== false : false`). Names alone are not proof, because `decodePostcode` resolves `stateName`/`lgaName` from the structural snapshot even when no unit record exists. This is the honest "location confirmed" signal the card and the prose both use.
- Location slot: when `decoded.coordinates` is present and the reply has no location yet, set `response.location = { lat, lng, label: decoded.postcode }`. Same slot as feature 4; `[View on map]` stays disabled until feature 8.

## Testing

- No `test` command is declared in `AGENTS.md`, so the test gate is off and this feature ships on build plus browser evidence. If `/tests` is added later, `deriveDecoded` is the first candidate: pure and assertable with fixed turns for mapped, unmapped, invalid, failed, and empty cases.
- No `Browser tests` command is declared; evidence is dev-server probes and screenshots on `localhost:3001`.
- Steps 1 and 2 are deterministic (a probe importing the real modules; fabricated tool turns; a demo page rendering the real card). Step 3 asserts the built prompt text. Step 4 needs one live provider reply; the free-tier chain is flaky, so retry, or use the `ASK_AI_ORDER` override for evidence only and restore it after.
- Probes must call `atlasStore.ensureHydrated()` first. The NIPOST gateway rejects the browser origin (`403 origin_not_allowed`), so a mapped bundled landmark (for example `FC-02-D43-LG-01`) is the in-browser verified case; a structurally valid but unbundled code shows the honest unmapped state.
- Every step: `npm run lint` (`tsc --noEmit`) and `npm run build`.

## Notes for the AI

- Keep the 3b tool result shapes stable apart from the `verified` signal, and do not change the `decodePostcode` argument schema. Features 4 and 5 must not regress.
- Decoding structure is local and always available; only the location confirmation depends on a record. Say so plainly and never infer a location from the segment codes alone.
- The `decodePostcode` executor is pure async and reads the local store plus gateway fallback; do not add a provider call or a server route.
- Client versus server: derivation and UI run client-side; only prompt text changes server-side. Provider keys stay server-side.
- No em dashes, no ellipsis character (use `...`), no `any`, no inline styles, functions under 50 lines.
- Keep the card compact. The model explains the meaning of the segments in prose; the card shows the values, so it must not restate the whole breakdown.
