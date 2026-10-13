# Feature: Atlas explanations

**From build-plan:** feature 19
**Status:** verified

## Goal

Let Ask Atlas explain Nigeria's digital addressing and postcode system in depth, from curated, authoritative copy rather than model improvisation. Today the only rich explanation of the system lives in the static NDAPS modal (`DatasetStoryModal.tsx`), and any "how does this work" question sent to Ask Atlas is answered from the model's memory with no sourcing. This feature adds a curated `explainAtlas` tool the model calls for system questions, a structured `AtlasExplanation` payload the client derives and renders, and a distinct grounding footer so editorial copy is never presented as NIPOST-verified data (project-plan line 109: "Clear distinction between authoritative data and AI-generated explanations").

## In scope

- A curated content module of explanation topics about the system, written to match the authoritative copy already shipped in `DatasetStoryModal.tsx`.
- A new `explainAtlas` tool: a topic enum schema, an executor that returns the curated topic, and registration in the tool layer and provider advertisement.
- Client derivation of an `AtlasExplanation` payload from the executed tool result, carried on the reply and the message (and therefore through persistence).
- A distinct `'explanation'` grounding basis and footer so a curated explanation is labelled as Atlas copy, not NIPOST data.
- An `AskAtlasExplanationCard` rendered under the reply, mirroring the decoded card's treatment.
- Prompt guidance so the model routes system questions to `explainAtlas` and answers only from what it returns.

## Out of scope

- Localizing the curated explanation copy. The reply prose follows the selected reply language (feature 18); the card copy stays English for now. Translating curated copy belongs with the later evaluation overhaul (item 23).
- A standalone "Learn" or "About the system" page, and opening `DatasetStoryModal` from a chat action. The card delivers the explanation inline.
- Editing `DatasetStoryModal.tsx`. The module's copy is written to be consistent with it; pointing the modal at the shared module is a possible later cleanup, noted below.
- Street-level or building-level explanation depth, postcode verification scoring, and any developer API surface (items 21 and 22).
- Changes to `decodePostcode` (feature 6). That tool explains one code's five segments; this feature explains the system around it.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on. Checkpoints are optional; `/complete` makes the real feature-level commit at the end. This project runs `stepReview: "feature"`, so the one review packet lands after the last step.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Curated explanation topics** - add `src/lib/explain/topics.ts` with `EXPLANATION_CONTENT` for the four topics (`hierarchy`, `postcode_parts`, `single_postcode`, `ndaps`) and a `getExplanation(topic)` lookup. Add `EXPLAIN_TOPICS`, `ExplainTopic`, and the `AtlasExplanation` interface to `src/lib/tools/types.ts` (next to `TOOL_NAMES` and `DecodedPostcode`). Copy states the five levels, the `AA-99-H77-BB-55` template, why a state/LGA/district/area has no single postcode, and what NDAPS is, consistent with the NDAPS modal. *Done when:* `npm run test` passes a new `src/lib/explain/topics.test.ts` proving every topic in `EXPLAIN_TOPICS` resolves to non-empty `title`, `summary`, and `points`, that the content carries no em dash, en dash, or ellipsis, and that an unknown topic yields `undefined`.

- [x] **Step 2 - The `explainAtlas` tool** - add `explainAtlasSchema` (`topic: z.enum(EXPLAIN_TOPICS)`) and its `TOOL_DESCRIPTIONS` entry to `src/lib/tools/schemas.ts`; add the `explainAtlas` executor to `src/lib/tools/executors.ts` (returns `getExplanation(topic)`, throwing `ToolFault('not_found', ...)` only if a valid enum value somehow has no content); add `'explainAtlas'` to `TOOL_NAMES`; register it in `TOOL_REGISTRY` and in `provider.ts` `SCHEMAS`. *Done when:* `npm run test` passes new executor cases (a known topic returns its content; an unknown topic fails schema validation with `invalid_args`), `npm run lint` is clean, and `ATLAS_PROVIDER_TOOLS` advertises twelve tools including `explainAtlas`.

- [x] **Step 3 - Carry and derive the payload** - add `deriveExplanation(toolTurns)` to `responder.ts` (last successful `explainAtlas` result wins, shape-guarded like `asDecodedPostcode`) and attach it in `attachDerived`; add `explanation?` to `AskAtlasResponse` and `AskAtlasMessage` in `src/lib/ask/types.ts`; copy `explanation: res.explanation` in `AskAtlasPanel.tsx`; add the `explainAtlas` guidance line and a "answer only from what it returns" rule to `src/server/ask/prompt.ts`. Include `next.explanation` in the `hasData` and empty-scope guards in `attachDerived`. *Done when:* `npm run test` passes new `responder.test.ts` cases (last result wins, a failed result is ignored, a shape-mismatched payload is dropped), `npm run lint` is clean, and a manual ask of "how does the Nigerian postcode system work" returns a reply whose stored message carries an `explanation` payload.

- [x] **Step 4 - Label the explanation honestly** - add `'explanation'` to `GroundingBasis`, return it in `groundingBasis` after the verified-payload block and before the map/chat branches, and add `explanation: 'Atlas explanation, not NIPOST data'` to `GROUNDING_FOOTER` in `src/lib/ask/grounding.ts`. *Done when:* `npm run test` passes new `grounding.test.ts` cases: an explanation-only reply labels `'explanation'` with that footer, an explanation plus a verified payload still labels `'payload'`, and a map-only reply still labels `'map'`.

- [x] **Step 5 - Render the explanation card** - add `src/components/ask/AskAtlasExplanationCard.tsx` rendering the title, summary, ordered points, and the optional example in a mono line, styled like `AskAtlasDecodedCard.tsx`. Render it from `AskAtlasMessageBubble.tsx` when `message.explanation` is present. *Done when:* in the running dev server the card appears under an explanation reply in light and dark mode, the footer reads "Atlas explanation, not NIPOST data", and a captured screenshot is attached as evidence. No in-scope logic is added here (UI-only step), so it rides on screenshot plus build.
  - *Evidence:* live dev-server asks routed as intended: "how does the Nigerian postcode system work" and "what do the letters and numbers in a postcode mean" returned `hierarchy` and `postcode_parts`, "what is NDAPS" returned `ndaps`, "why doesn't Ikeja have one postcode" returned `single_postcode`, and "where is Ikeja" attached no explanation. The card and the "Atlas explanation, not NIPOST data" footer rendered in light and dark; screenshots saved to `.playwright-mcp/feature19/live-card-light.png`, `live-card-dark.png`, and `live-card-narrow.png` (generated, gitignored). The provider routed these through N-ATLAS.

## Files / areas

- `src/lib/explain/topics.ts` (new) and `topics.test.ts` (new) - curated content and lookup.
- `src/lib/tools/types.ts` - `EXPLAIN_TOPICS`, `ExplainTopic`, `AtlasExplanation`, and `'explainAtlas'` in `TOOL_NAMES`.
- `src/lib/tools/schemas.ts` - `explainAtlasSchema` and its description.
- `src/lib/tools/executors.ts` (+ `executors.test.ts`) - the `explainAtlas` executor and its tests.
- `src/lib/tools/registry.ts`, `src/lib/tools/provider.ts` - registration and provider advertisement.
- `src/lib/ask/types.ts` - `explanation?` on the response and message.
- `src/lib/ask/responder.ts` (+ `responder.test.ts`) - `deriveExplanation` and attachment.
- `src/lib/ask/grounding.ts` (+ `grounding.test.ts`) - the `'explanation'` basis and footer.
- `src/components/ask/AskAtlasExplanationCard.tsx` (new), `AskAtlasMessageBubble.tsx`, `AskAtlasPanel.tsx` - rendering and wiring.
- `src/server/ask/prompt.ts` - `explainAtlas` guidance.

## Data / contracts

- `EXPLAIN_TOPICS = ['hierarchy', 'postcode_parts', 'single_postcode', 'ndaps']` and `ExplainTopic`, defined in `src/lib/tools/types.ts` next to `TOOL_NAMES` because the schema enum and the content module both read it as a value.
- `AtlasExplanation` (`topic`, `title`, `summary`, `points: string[]`, optional `example`), also in `src/lib/tools/types.ts`. **Load-bearing** for the developer API (item 21); keep the shape stable.
- `GroundingBasis` gains `'explanation'`; `GROUNDING_FOOTER` gains the matching line. The footer text is the user-visible contract that separates curated Atlas copy from NIPOST data.
- `explanation?: AtlasExplanation` on both `AskAtlasResponse` and `AskAtlasMessage`, mirroring the existing payload fields, so it persists for free through `persistence.ts` (whole messages are stored).

## Testing

- Unit tests: Steps 1-4 ship tests (content lookup, executor + schema, derivation, grounding) since `npm run test` is configured in `AGENTS.md`. Step 5 is UI only and rides on a screenshot plus the build.
- Full Verify before completion: `npm run test && npm run lint && npm run build`.
- Direct evidence for Step 5: run `npm run dev`, ask a system question (for example "how does the Nigerian postcode system work"), and confirm the card plus the "Atlas explanation, not NIPOST data" footer in light and dark mode. There is no project `Browser tests` command (`AGENTS.md` ships a benchmark, `npm run eval`, not a browser suite), so use the dev server and a screenshot rather than adding a runner mid-feature.
- Optional model probe, not committed: follow the feature 17 pattern and use a throwaway provider probe to confirm N-ATLAS calls `explainAtlas` for a few phrasings ("how do Nigerian postcodes work", "what do the letters in the code mean", "why doesn't Ikeja have one postcode", "what is NDAPS") and does not call it for a plain place lookup. Record the outcome in the step's evidence line and delete the probe.

## Notes for the AI

- Keep the copy honest and bounded. Explain the system the Atlas data actually models: five levels and an 11-character alphanumeric code. Do not add claims the app cannot back (coverage statistics, delivery guarantees, timelines).
- Match the house writing rules (`coding-standards.md`): SPDX header on every new file, comment the why rather than the what, and no em dash, en dash, or ellipsis anywhere in code, copy, or comments.
- The card is the source of truth for the copy; the model's prose is a short lead. This matches the existing "the app already shows returned rows, keep prose short" rule in the prompt, so extend that wording rather than adding a competing block.
- The client executes tools (`runTool`) and derives payloads; no server response shape changes are needed beyond the system prompt in `src/server/ask/prompt.ts`.
- `withVerifiedPostcodes` already treats anything inside a tool result's data as grounded, so the example code in the `postcode_parts` content is not stripped when the model writes it.
- The static `DatasetStoryModal.tsx` remains the fuller reference and is left untouched. If its copy is later edited, this module should be updated to match; a follow-up could point the modal at the shared content.
- Reply language: the model's prose follows the language chip; the card copy is English. Do not add per-language copies of the curated strings in this feature.

## Notes for the AI after the red-team pass

The draft above already folds in these findings: the grounding label is its own basis rather than reusing `'payload'` or `'tools'`; the footer text is treated as a contract; the payload is added to the `hasData` and empty-scope guards so a map-plus-explanation reply keeps real prose; the postcode guard cannot fire because it requires `next.results`; and a non-English reply shows an English card as a stated limitation rather than a silent gap.
