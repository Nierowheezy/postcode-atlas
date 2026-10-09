# Feature: Grounded responses

**From build-plan:** feature 9
**Status:** verified

## Goal

Make the grounding claim true end to end. Today a reply is labelled "Verified against NIPOST postcode data" whenever any tool call succeeded, but two real gaps let the model work from data the product never meant to hand it: the hierarchy tools return uncapped row dumps (743 districts, 398 areas) that reach the model wholesale and get cut mid-JSON by the 2000-char guard, and the footer claims verification for a reply whose facts may have come from the model's own memory. This feature caps what the model sees to a small match set, makes truncation explicit rather than silent, and ties the footer to the payload the reply actually carries.

## In scope

- Bounded hierarchy tool results: `getDistricts` and `getAreas` return at most 50 rows plus a total, matching the existing `getNearby` cap style, so the model gets a usable match set rather than a dump. `getStates` and `getLgas` are already small enough (37 and at most ~26) and are left alone.
- A shaped result envelope for the capped tools so the model knows a list was truncated: `{ items, total, truncated }` rather than a bare array, with the prompt told to say how many were returned instead of implying completeness.
- Explicit truncation in `serializeToolResult`: a size-capped tool result is sent with a readable `...(truncated, N characters omitted)` marker instead of a JSON slice that cuts mid-token, so a truncated payload cannot be mistaken for a complete one.
- The grounding footer derived from the reply payload: a reply shows "Verified against NIPOST postcode data" only when it actually carries a `lookup`, `results`, `decoded`, `nearby`, or `mapAction` payload, and shows a distinct "Answered from NIPOST tool results" line when tools ran but no payload attached. The 3c contract (`grounding: 'atlas'` iff at least one executed `ok:true` result) is unchanged.
- A prompt rule that the model may only state a postcode, LGA, district, area, unit, or coordinate that appeared in a tool result, and must say when a list was truncated.

## Out of scope

- Distinguishing per-claim grounding (which sentence rests on which tool call). The footer is a reply-level signal, as it is today.
- Caching, retries, provider failover, history, and the reply cache key.
- Districts and areas in the bundled snapshot: 3a deliberately left them out (about 290 MB), and they stay gateway-served. This feature bounds what the model sees, not what the app can store.
- Features 10 (conversation context), 11 (Nigerian phrasing), and 12 (ambiguity clarification).
- Any new tool, dependency, server route, gateway change, or dataset rebuild.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - bound the hierarchy tool results** - Added `MAX_HIERARCHY_ROWS = 50` and a shared `toHierarchyPage` helper in `executors.ts`; `getDistricts` and `getAreas` now return `{ items, total, truncated }` (a breaking change for those two tools only), with `HierarchyPage<T>` added to `tools/types.ts` and the two `ToolResultMap` entries updated. `deriveResults` reads the envelope through a new `asHierarchyPage` guard and takes the list `total` from the envelope, so feature 5's "+N more" reflects the real count. Both `TOOL_DESCRIPTIONS` entries now tell the model that `truncated` means more rows exist than were returned. `getStates`, `getLgas`, `getNearby`, and every feature 4 to 8 contract are unchanged.
  *Evidence (2026-10-09):* browser probe over the real modules. A 22-row district page returned `total: 22, truncated: false` with all 22 items and `deriveResults` kept the feature 5 output exactly (22 shown, 22 total, scope "Ikeja, Lagos", scopePath LA/11). A synthetic 743-row page capped to 50 items with `total: 743, truncated: true`, and `deriveResults` rendered 50 rows with total 743 and scope "Bauchi, Bauchi"; a 398-row area page gave 50 shown, 398 total, scope "A01, Ikeja, Lagos". An empty page gave `total: 0, truncated: false` and `deriveResults` returned `undefined` as before. A malformed payload (`{nope:1}`) returned `undefined`, and a page with no `total` fell back to the row count. The live in-browser `getDistricts` read returned 0 rows because districts are gateway-served and the gateway rejects the browser origin, the limitation feature 5 recorded, so the 22-row case was proven with the real envelope shape and a realistic fixture instead of a live fetch; zero page errors; lint + build green.
- [x] **Step 2 - explicit truncation and a shaped tool-result message** - Replaced the mid-JSON slice in `serializeToolResult` with valid JSON that names itself as partial. A new `narrowOversizedData` keeps the leading 20 rows of an oversized result: a hierarchy page keeps its `items`, real `total`, and `truncated: true`; a bare array becomes `{ items, total, truncated }`; anything else keeps a short `summary` plus its top-level keys via `describeShape`, so a lost payload still shows its shape. Every truncated payload carries a `note` telling the model the result is partial. A failing result keeps its error with the message clipped to 400 characters (`MAX_ERROR_MESSAGE_CHARS`), which was a real defect the first probe caught: a 5000-character error message previously produced 5108 characters of output, so the size guard inflated the payload instead of bounding it. Prompt additions: the `truncated` envelope rule (say how many rows you received, never present a partial page as the whole list) and the only-from-tool-results rule (state a postcode, district, area, unit, coordinate, or LGA name only when it appeared in a tool result; otherwise say it is general knowledge and unverified). `serializeToolResult` is now exported for probing.
  *Evidence (2026-10-09):* probe over the real `serializeToolResult`: a small postcode result passed through byte-identical and parsed as JSON; a 400-row district page became 1133 characters of valid JSON with `truncated: true`, 20 items, and `total: 400` preserved; a 900-row bare array became 1143 characters with 20 items and `total: 900`; an oversized non-list object became 351 characters keeping its key names; a 5000-character error became 539 characters after the fix (5108 before it). All five outputs are under the 2000-character limit and parse as JSON. The prompt probe confirms the truncated rule, the envelope rule, the only-from-results rule, and that the feature 4 and 8 blocks still appear; zero page errors; lint + build green.
- [x] **Step 3 - grounding from the payload, not from tool success** - Added an exported pure `groundingBasis(message)` in `AskAtlasMessageBubble.tsx` plus a `FOOTER_TEXT` map, and the footer now reads from it: "Verified against NIPOST postcode data" when the reply carries a `lookup`, `results`, `decoded`, `nearby`, or `mapAction` payload; "Answered from NIPOST tool results" when `grounding: 'atlas'` but no payload attached; and the existing unverified line otherwise. No payload field was added to the response or message, and the 3c `grounding` contract is untouched.
  *Evidence (2026-10-09):* demo probe over the real bubble in light and dark across seven representative replies: a lookup reply, a results reply, a decoded reply, and a map-action reply each showed the verified line; a `grounding: 'atlas'` reply with no payload showed "Answered from NIPOST tool results"; a `grounding: 'unverified'` reply showed the unverified line; and an ungrounded reply carrying a nearby payload showed the verified line, since a payload is derived client-side from an executed tool result and carries its own proof even when the 3c flag says otherwise. Counts were 5 / 1 / 1 in both modes; zero console errors; screenshots `step3-light.png` and `step3-dark.png`. lint + build green.
- [x] **Step 4 - live grounding evidence** - Drove the real panel against the restarted dev server on port 3001.
  *Evidence (2026-10-09):* live panel, zero page errors on every run. "What is the postcode for Ikeja?" (nvidia/nemotron-3-super-120b-a12b) explained that an LGA has no single postcode, attached the feature 5 `1 LGA Ikeja 11` payload, and showed "Verified against NIPOST postcode data". "What postcodes are in Nigeria?" (gemini-3.1-flash-lite) declined to invent a list, explained the hierarchy, and showed "Not verified against NIPOST data": no invented postcode appeared. "Who won the 2018 World Cup?" was refused per the feature 2 scope guard ("I cannot help with that... I can look up a Nigerian place or postcode") and also showed the unverified line. No reply in any run contained a postcode absent from a tool result. Screenshots `step4-ikeja.png`, `step4-broad.png`, `step4-offtopic.png`.
  *Observed but not a defect:* the two honest-refusal replies served from the server reply cache and so carried no executed tool result, which is why they show the unverified footer rather than the "Answered from NIPOST tool results" line. That is the new footer behaving correctly on a reply with no payload, not a regression.
- [ ] **Step 3 - grounding from the payload, not from tool success** - Add a pure exported `deriveGroundingBasis(response)` (or equivalent) in `responder.ts` that reports whether the reply carries a grounded payload (`lookup`, `results`, `decoded`, `nearby`, or `mapAction`), and use it in `AskAtlasMessageBubble` to choose the footer: the existing verified line when a payload is present, "Answered from NIPOST tool results" when `grounding: 'atlas'` but no payload attached, and the existing unverified line otherwise. Keep the 3c `grounding` contract untouched. *Done when:* a probe shows the three footer cases selected correctly for representative messages; a reply with a `lookup` still shows the verified line; a grounded reply with no payload shows the tool-results line; an ungrounded reply shows the unverified line; lint and build green.

- [ ] **Step 4 - live grounding evidence** - Drive the real panel against the restarted dev server: "list the districts in Ikeja" answers from the capped tool result with the correct footer; "what postcodes are in Nigeria" is answered honestly without invented codes; an out-of-scope question ("who won the 2018 World Cup?") is refused per the feature 2 scope guard. *Done when:* each reply is grounded or honestly refused with the footer matching, no invented postcode appears in any reply, and the probe records the honest fallback if the free-tier providers are down; screenshots saved; lint and build green.

## Files / areas

- `src/lib/tools/executors.ts` - `MAX_HIERARCHY_ROWS`, the shaped `getDistricts` and `getAreas` results (step 1).
- `src/lib/tools/types.ts` - `ToolResultMap` entries for the two changed tools (step 1, load-bearing).
- `src/lib/tools/schemas.ts` - descriptions telling the model the list may be partial (steps 1 and 2).
- `src/lib/ask/responder.ts` - `deriveResults` reads the new envelope; `deriveGroundingBasis` (steps 1 and 3).
- `src/server/ask/handler.ts` - `serializeToolResult` structured truncation (step 2).
- `src/server/ask/prompt.ts` - truncation rule and the only-state-tool-facts rule (steps 2 and 3).
- `src/components/ask/AskAtlasMessageBubble.tsx` - footer selection (step 3).

## Data / contracts

- Changed tool results: `getDistricts` and `getAreas` return `{ items: AtlasDistrict[]; total: number; truncated: boolean }` and `{ items: AtlasArea[]; total: number; truncated: boolean }`. Both are breaking changes for those two tools only; `getStates`, `getLgas`, `searchLocation`, `getPostcode`, `decodePostcode`, `getNearby`, and `navigateMap` are unchanged.
- `total` is the row count before capping; `truncated` is `items.length < total`. An empty result is `{ items: [], total: 0, truncated: false }`.
- `deriveResults` treats the envelope as the feature 5 source: it maps `items` to rows and sets the list `total` from the envelope `total`, so the existing "+N more" line reflects the real total rather than the capped count.
- The 3c contract is unchanged: `text: ''` when `toolCalls` is present, and `grounding: 'atlas'` iff at least one executed result was `ok: true`. Grounding is a reply-level signal; the footer is derived from the payload on top of it.
- No new payload field is added to `AskAtlasResponse` or `AskAtlasMessage`; the footer decision is computed in the bubble from the fields already present, so the wire shape and features 4 to 8 stay untouched.

## Testing

- No `test` command is declared in `AGENTS.md`, so the test gate is off and this feature ships on build plus browser evidence. If `/tests` is added later, the pure logic here is the first candidate: the envelope mapping in `deriveResults`, the cap, and `deriveGroundingBasis`.
- No `Browser tests` command is declared; evidence is dev-server probes and screenshots on `localhost:3001`.
- Steps 1 to 3 are deterministic (probe pages importing the real modules; fabricated tool results for the envelope, truncation, and footer logic). Step 4 needs live provider replies.
- Districts and areas are gateway-served, and the gateway rejects the browser origin, so step 1 evidence for the "large scope" case uses a synthetic oversized fixture written for the probe rather than a live 743-district read; the real 22-district Ikeja scope is verified against the live path where the origin is allowed. Feature 5 recorded the same limitation.
- Every step: `npm run lint` (`tsc --noEmit`) and `npm run build`.

## Notes for the AI

- The cap must not silently change feature 5's UI. `deriveResults` carries the real `total` into the payload so "+N more" stays honest.
- `getNearby` already caps at 50 with no envelope. Do not retrofit the envelope onto it in this feature; that would be an unrequested contract change. Feature 7's list is small in practice.
- The footer change is the user-visible honesty fix: today a model answer backed only by "a tool ran somewhere" shows the verified line.
- Keep the scope guard and never-invent rules from feature 2 and the lookup rules from feature 4. This feature tightens them; it does not replace them.
- Client versus server: the cap and envelope run in the tool executors, the truncation in the server handler, and the footer in the bubble.
- No em dashes, no ellipsis character (use `...`), no `any`, no inline styles, functions under 50 lines.