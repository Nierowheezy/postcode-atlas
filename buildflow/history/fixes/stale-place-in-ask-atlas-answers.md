# Fix: Ask Atlas answers unrelated questions with a stale place

**Type:** Fix
**Status:** verified
**Branch:** `fix/stale-place-in-ask-atlas-answers`
**Completed:** 2026-10-15

## Problem

After one turn resolved a place, later unrelated questions were answered as if the
user were still asking about that place. On the feature 25 Try pass the user typed
`are you listening to what I am saying` and the replies kept coming back about
Ikeja.

The dictation was not at fault. The request payloads were captured and the `text`
sent was exactly the user's words (`{"text":"are you listening to what I am saying"}`),
and the server forwards no history by design.

Two app-side mechanisms over-supplied a "current place" on every request:

1. **Ambient map selection, always emitted.** `src/App.tsx`
   (`getAskAtlasContext`) copies the map breadcrumbs (`selectedState`,
   `selectedLga`, `selectedDistrict`, `selectedArea`, `selectedPostcode`) into
   every request context, and `src/server/ask/prompt.ts` then always printed them
   as `Current map scope: map center ..., state Lagos, LGA Ikeja, ...`. Once the
   map moved to Ikeja, every question's system prompt named Ikeja.
2. **A loose follow-up trigger, plus topic-first wording.** `src/lib/ask/followup.ts`
   flagged any message containing `it / its / this / that / these / those / they / them`
   as a follow-up, and `prompt.ts` then added
   `The conversation is currently about the lga Ikeja in state LA.` The leading
   phrase reads to an 8B model as "the topic is Ikeja".

The model also drifts on its own: in one probe it called `interpretAddress` with
the previous message's text while answering a different question. The app cannot
fix the model, but it can stop handing it a stale place.

## Out of scope

- A hard guard that rejects a model tool call whose arguments do not appear in the
  user text. This is the next reliability lever if drift persists, not this fix.
- Any change to the model, the providers, the failover chain, or the `/api/ask`
  contract.
- Refreshing `buildflow/CODEBASE-ARCHITECTURE.md`, which still describes the removed
  `describeSelection` and `referentBlock`. It is a descriptive snapshot generated at
  feature 10 and is already stale by many features; a partial rewrite would be worse
  than leaving it for a dedicated refresh.

## In scope

- The always-on prompt line carries only the reply language and the map center.
- The detailed map selection (state, LGA, district, area, postcode) and the
  referent sentence are emitted only when the message leans on them: a genuine
  anaphoric follow-up, or a spatially deictic question.
- The anchored block leads with the condition rather than declaring a topic.
- Nothing that already worked may break: anaphora, "near me"/"here", a named place
  that must win, and a first self-contained question.

## Data / contracts

- `AtlasContextSnapshot` is unchanged, and the client still sends the map
  breadcrumbs; only the prompt decides when to use them.
- `buildSystemPrompt(context, language, anchor)` now takes a `PromptAnchor`
  (`{ followUp?, spatial? }`) instead of a bare `followUp` boolean. It has one
  caller, `src/server/ask/handler.ts`.
- No route, endpoint, env var, dependency, stored shape, or request payload change.

## Build steps

- [x] **1. Gate the scope, not just the referent.** Add `isSpatialQuestion` next to
  `isFollowUp` in `src/lib/ask/followup.ts` (`here`, `near me`, `nearby`,
  `near this`, `around here`, `this area`, `current location`; a phrase that names
  a place or asks to move the map is deliberately not a trigger). In
  `src/server/ask/prompt.ts`, keep only the reply language and the map center on
  the always-on line, move the selection and referent into a gated block, reword
  that block to lead with the condition, and grow `selectionPhrase` to name
  district and area (which the old always-on line used to print). Delete the dead
  `describeSelection`. In `src/server/ask/handler.ts`, pass
  `{ followUp: isFollowUp(text), spatial: isSpatialQuestion(text) }`. Add
  `src/server/ask/prompt.test.ts` and extend `src/lib/ask/followup.test.ts`.
  *Done when:* the new prompt tests pin the behavior and `npm run lint` is clean.

- [x] **2. Evidence and sweep.** Reproduce the reported flow on the running app,
  capture the request context the model actually receives, and run the built prompt
  before and after for that identical context. Confirm no contract or payload
  change. *Done when:* Verify passes and the before/after prompt is recorded.

## Files / areas

- `src/lib/ask/followup.ts` - the spatial detector.
- `src/lib/ask/followup.test.ts` - spatial cases.
- `src/server/ask/prompt.ts` - gated place, reworded block, district/area phrase.
- `src/server/ask/prompt.test.ts` - new prompt tests.
- `src/server/ask/handler.ts` - passes the anchor.

## Verify

- `npm run test && npm run lint && npm run build`.
- Manual: open Ask Atlas, ask `12 Allen Avenue is in Ikeja, Lagos.`, view it on the
  map, then ask `are you listening to what I am saying` and confirm the reply is not
  about Ikeja. Then ask `what are its LGAs?` and confirm it still resolves to Ikeja.

## Outcome

- 472 tests pass, up from 461 (`tsc --noEmit` clean, build clean). New
  `src/server/ask/prompt.test.ts` has 8 cases; `followup.test.ts` gains 3
  `isSpatialQuestion` cases.
- Reproduced the reported flow on the running app: after `show me Ikeja on the map`
  the next request for `are you listening to what I am saying` carried
  `selectedLga {code 11, name Ikeja}`, `selectedState {LA, Lagos}`, and
  `referent {kind lga, code 11, name Ikeja, state LA}`.
- Built prompt for that identical captured context, before and after:
  - before: `Current map scope: map center 6.5244, 3.3792, state Lagos, LGA Ikeja.`
  - after: `Current map center: 6.5244, 3.3792.`

  The `Ikeja`/`Lagos` mentions that remain are the unchanged static examples inside
  the tool descriptions, not the current place.

## Known limitations

- The model still drifts on its own. In the same live probe the unrelated question
  was answered with an `explainAtlas` reply about the address hierarchy. This fix
  removes the stale-place signal the app supplied; it does not change model
  behavior. The tool-call guard noted as out of scope is the next lever.
- A question that points at the map without a spatial word (no `here`, `near me`)
  will not get the selection. This is the intended trade, and the words that matter
  were added as triggers.
