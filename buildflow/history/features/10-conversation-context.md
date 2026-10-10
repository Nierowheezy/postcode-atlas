# Feature: Conversation context

**From build-plan:** feature 10
**Status:** verified

## Goal

Make Ask Atlas hold a conversation. Today every turn is effectively standalone: the client sends the raw history but the reply cache keys on text plus selected map scope, so "and its LGAs?" or "what is the postcode for that?" cannot reuse the place the user just mentioned. This feature makes a follow-up inherit the referent of the previous turn, so the assistant answers about Lagos after the user has only said "show me Lagos".

## In scope

- A client-derived `followUp` payload: when a reply's tool results identify exactly one place, that place is carried on the reply so the next turn's context snapshot can name it as the current referent.
- The context snapshot gains a `referent` field (the last resolved place: `{ kind: 'state' | 'lga' | 'district' | 'area' | 'postcode'; code: string; name?: string; state?: string }`), populated by the panel from the previous reply's `referent` or from the map selection when the user has not said anything new.
- Prompt guidance for follow-ups: resolve "it", "that place", "there", "its", "what about ...", and bare questions against the current referent and the map scope; when both the referent and a new place name appear, prefer the new name; when no referent exists, ask rather than assume.
- Reply-cache correctness: the cache key includes the referent, so the same words with a different referent are not served a stale answer. This is a correctness fix the feature requires, not an optimization.
- One line in the panel empty-state hint showing a follow-up example.

## Out of scope

- Ambiguity clarification flows (feature 12). This feature resolves a referent; it does not add a disambiguation step when a place stays ambiguous.
- Nigerian phrasing variants (feature 11).
- Persisting a conversation across page reloads or across devices. History stays in memory for the session, as it is today.
- Changing `MAX_HISTORY_ENTRIES`, the 3c transport loop, or any tool result shape.
- A model-side summarization or memory store. The client sends the existing capped history plus the referent field.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - `referent` contract and derivation** - Added `AtlasReferent` to `ask/types.ts` plus `referent?` on `AskAtlasResponse`, `AskAtlasMessage`, and `AtlasContextSnapshot`, and a pure exported `deriveReferent(toolTurns)` in `responder.ts` wired through `attachDerived`. It ranks places by specificity (decoded or looked-up or navigated postcode 0, single landmark 1, LGA 2, state 3) and returns the unique winner. Two candidates at the same rank are ambiguous and yield `undefined`, matching the feature 4 rule.
  *Evidence (2026-10-09):* probe over the real module: a decoded postcode gave `{kind:'postcode', code:'FC-02-D43-LG-01', state:'FC'}`; a `getPostcode` lookup gave a postcode referent with state LA (the first probe exposed a defect here: `getPostcode` was routed through the decode guard, which requires a `segments` object a location record lacks, so it silently derived nothing; it now uses the existing location guard); a single landmark gave a postcode referent with its name; a `getState` gave `{kind:'state', code:'LA', name:'Lagos'}`; a `getLgas` gave `{kind:'lga', code:'05', name:'Ikorodu', state:'LA'}`; `navigateMap` state and postcode actions both resolved. With a state, an LGA, and a landmark in one conversation the postcode won. Two landmarks in one result, two landmarks across turns, and two states across turns each returned `undefined`. A failed result, no turns, an invalid decode, and a reset navigation each returned `undefined`. lint + build green.
- [x] **Step 2 - panel and context wiring** - Added an exported pure `latestReferent(messages)` in `AskAtlasPanel` that returns the most recent assistant reply's referent; `handleSend` merges it into the request context over `getContext()`, and the reply's `referent` is threaded onto the message. Added `referent.code` to both `askReplyCacheKey` (client, now exported for probing) and the server's `replyCacheKey`, so the same words under different referents cannot share a cached answer on either side. Added `sanitizeReferent` to `handler.ts`: it keeps only a known `kind`, a trimmed string `code`, and optional string `name`/`state`, dropping the field entirely otherwise. Added a follow-up example to the empty-state hint. Spec correction: the referent is resolved in the panel, not `App.tsx`, because `App` does not hold conversation state.
  *Evidence (2026-10-09):* probe over the real helpers. `latestReferent` returned `undefined` for an empty list and for a reply with no referent, returned the newest of two assistant referents, and skipped intervening user turns. The cache key differs between a Lagos referent and a Kano referent, and an absent referent reproduces the prior key shape. `sanitizeContext` kept `{kind:'lga', code:'11', name:'Ikeja', state:'LA'}`, trimmed `'  LA  '` to `LA`, dropped `{kind:'mars'}`, `{kind:'state'}` with no code, a non-object referent, and extra fields such as `evil` and `coords`, and produced no referent when the field was absent. `tsc --noEmit` confirms the field flows through request, message, and both cache keys; zero page errors; lint + build green.
- [x] **Step 3 - follow-up prompt guidance** - Added a `referentBlock(context)` that is emitted only when there is something to resolve against: the referent phrase when a reply resolved a place, otherwise a `selectionPhrase` from the map selection, and nothing at all on a bare first question so the model is never told about "it" with no referent in scope. `referentPhrase` and `selectionPhrase` name the place and its parent state where one exists. The block tells the model to resolve unnamed references to that place, prefer a newly named place over it, ask which place is meant when there is nothing to resolve against, and never treat an earlier postcode, district, or area as a place of its own. Every existing block is unchanged.
  *Evidence (2026-10-09):* probe of `buildSystemPrompt` for every reply language (en, yo, ha, ig) with a Lagos referent: the follow-up block, the prefer-new-place rule, the ask-when-nothing rule, and the never-a-place rule are all present, and the feature 2 scope guard, the feature 4 lookup block, the feature 5 exploration block, the feature 6 decode block, the feature 7 nearby block, the feature 8 map block, and the feature 9 truncation rule all still appear. The block names a postcode referent as "the postcode FC-02-D43-LG-01 in state FC", an LGA referent as "the lga Ikeja in state LA", a map selection as "the state Kano", and a selected postcode as "postcode LA-11-A12-AK-08", and it is omitted entirely when neither a referent nor a selection exists; zero page errors; lint + build green.
- [x] **Step 4 - live follow-up evidence** - Drove the real panel against the restarted dev server on port 3001, provider nvidia/nemotron-3-super-120b-a12b, zero page errors on every run.
  *Evidence (2026-10-09):* "show me Lagos state" alone, then the bare "what are its LGAs?", answered with the 20 Lagos LGAs (Agege through Oshodi-Isoso) and attached the feature 5 list "20 LGAs in Lagos". "Decode FC-02-D43-LG-01" alone, then "what is its LGA?", answered "Abuja Municipal (LGA code 02) in the Federal Capital Territory" with the decoded card. The referent switch and the cache-key fix together: after "show me Lagos state", then "show me Kano state", the third bare "what are its LGAs?" answered "Kano state has 44 LGAs" with the Kano rows and no mention of Lagos, proving a new named place overrides the referent and the same wording under a different referent did not reuse a cached reply. Screenshots `step4-lagos-lgas.png`, `step4-decode-lga.png`, `step4-switch-place.png`.
  *Not exercised live:* the ask-instead-of-guess branch, which needs a conversation with no referent and no map selection. It is covered deterministically in step 3, where the block is confirmed to be omitted entirely in that state, so the model has no instruction to resolve against.
## Files / areas

- `src/lib/ask/types.ts` - `AtlasReferent`, `referent` on response, message, and context snapshot (step 1, load-bearing).
- `src/lib/ask/responder.ts` - `deriveReferent`, attach wiring (step 1).
- `src/components/ask/AskAtlasPanel.tsx` - `latestReferent`, thread the referent into the request context, empty-state example (step 2). Spec correction: the referent is resolved here, not in `App.tsx`, because `App` does not hold conversation state and the panel does.
- `src/lib/ask/useAskAtlas.ts` - referent in `askReplyCacheKey` (step 2).
- `src/server/ask/handler.ts` - `sanitizeReferent`, referent in the server reply-cache key (step 2).
- `src/server/ask/prompt.ts` - follow-up guidance (step 3).

## Data / contracts

- `AtlasReferent`: `{ kind: 'state' | 'lga' | 'district' | 'area' | 'postcode'; code: string; name?: string; state?: string }`. `state` is present for LGA, district, area, and postcode referents so a follow-up tool call has the parent code without another lookup.
- `AskAtlasResponse.referent?`, `AskAtlasMessage.referent?`, and `AtlasContextSnapshot.referent?`. Client-derived only; the server never sets the response field, and `sanitizeContext` validates the incoming one.
- `deriveReferent(toolTurns)`: precedence postcode, then landmark, then LGA, then state, each from an `ok: true` result. A tie at the same specificity (two equally specific results, for example two landmarks) yields `undefined` rather than an arbitrary pick, matching the feature 4 ambiguity rule. A failed result or no tool turns yields `undefined`.
- Precedence for the next turn's referent: the most recent assistant reply that has one; otherwise the map selection (`selectedState` then `selectedLga`); otherwise `undefined`. A referent is never invented client-side from reply prose.
- `sanitizeContext` must strip an untrusted `referent`: it is a client-supplied field on the request path, so it accepts only a known `kind`, a string `code`, an optional string `name`, and an optional string `state`, dropping anything else. This is the feature 9 input-validation rule applied to a new field.
- `askReplyCacheKey` gains `request.context.referent?.code ?? ''`. This makes the key more specific, so it can only reduce cache hits, never serve a wrong reply.

## Testing

- No `test` command is declared in `AGENTS.md`, so the test gate is off and this feature ships on build plus browser evidence. If `/tests` is added later, `deriveReferent` is a first candidate: pure and assertable with fixed turns per specificity plus tie, failed, and empty cases.
- No `Browser tests` command is declared; evidence is dev-server probes and screenshots on `localhost:3001`.
- Steps 1 to 3 are deterministic (probe pages importing the real modules; fabricated tool turns for the derivation; direct calls to the prompt builder and the cache-key helper). Step 4 needs live provider replies, since follow-up resolution is the model's job.
- `deriveReferent` reads only executed tool results, so it needs no store hydration and no gateway. Probes must not claim live data for it.
- Every step: `npm run lint` (`tsc --noEmit`) and `npm run build`.

## Notes for the AI

- Feature 7 already proved the map center reaches the model. A follow-up needs the referent for named places, not a coordinate, so do not reuse `origin` logic here.
- Feature 12 owns clarification. When this feature finds no referent, the honest behavior is to ask, which is what the prompt rule says; do not build a disambiguation UI here.
- The reply cache key change is load-bearing: without it, "what are its LGAs?" asked after Lagos and after Kano would share one cached answer. Make the key strictly more specific.
- Client versus server: derivation and wiring run client-side; only prompt text and `sanitizeContext` change server-side.
- No em dashes, no ellipsis character (use `...`), no `any`, no inline styles, functions under 50 lines.
- Keep features 4 to 9 working. This feature adds one context field and one reply field; it changes no tool result shape and no existing derivation.