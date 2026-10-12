# Feature: Multilingual queries with auto-detected replies

**From build-plan:** feature 18
**Status:** verified
**Branch:** `feature/multilingual-queries` (created by `/implement`)

## Goal

Let a user type in Yoruba, Hausa, Igbo, or Nigerian Pidgin and get a factual reply in
the same language, without changing any setting. The reply-language chip already
exists but is manual and English-first, and the pipeline mishandles non-English text:
a Yoruba or Hausa postcode question makes the model call `getPostcode` with an invented
code, and a non-English greeting is routed to `navigateMap` (a map reset) instead of
small talk. This feature adds client-side language detection, an Auto reply mode (the
chip stays a manual override), and the routing fixes that keep non-English answers
grounded.

## In scope

- A deterministic, offline language detector for Yoruba, Hausa, Igbo, and Nigerian
  Pidgin, defaulting to English when unsure.
- An **Auto** mode on the reply-language chip (new default). The existing EN / YO / HA
  / IG options remain and always override Auto.
- Auto wiring: on send, Auto resolves the question to one reply language and the panel
  sends that concrete language in the existing `language` field.
- Non-English routing correctness: multilingual small-talk phrases, a postcode-format
  guard in `getPostcode`, and one concise prompt line so non-English place questions
  still reach `searchLocation` first.
- A small, honest indicator on the reply showing the auto-detected language.
- Unit tests for the detector, small talk, and the postcode guard, plus multilingual
  eval cases in the existing benchmark.

## Out of scope

- A first-class **Pidgin reply mode**. Pidgin is detected and answered in English; the
  plan item says "where N-ATLAS supports them reliably", and written Pidgin reply
  quality is unverified. Revisit as its own item if the eval shows it is reliable.
- Advertising the feature with non-English starter prompts: that ships user-facing copy
  in another language, which needs reviewed translation first.
- Translating app chrome or any UI copy.
- Changing tool schemas, the `/api/ask` request shape, the provider chain, or the
  `/api/nipost` proxy.
- Voice input (separate later item).

## Design reference

None. No visual target; the chip and footer reuse existing styles and tokens.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. With `stepReview: "feature"`, steps collect into one review packet at the end. A
   failed check, a decision, or scope drift stops the loop early.

Never accept a step you haven't read. If a diff is too big to review, the step was too
big, so split it.

## Build steps

- [x] **Step 1 - Language detector module** - Add `src/lib/ask/language.ts`:
  `detectLanguage(text): { replyLanguage: AskLanguage; detected: DetectedLanguage;
  confidence: number }` with `DetectedLanguage = 'en' | 'yo' | 'ha' | 'ig' | 'pcm'`.
  Score candidates deterministically from (a) distinctive marked characters and
  (b) a curated function-word / postcode-vocabulary lexicon; return English unless the
  top non-English score clears a confidence floor. No model call, no network.
  Add `language.test.ts`.
  *Done when:* `npm run test` is green and the detector classifies the measured
  sentences correctly: "Kí ni kòòdù ìpín-ìpínlẹ̀ tí Ikeja?" as `yo`,
  "Menene lambar gidan waya na Ikeja?" as `ha`, "Gịnị bụ koodu ozi nke Ikeja?" as
  `ig`, "How far, wetin dey happen?" as `pcm`, while "What is the postcode for Ikeja,
  Lagos?", "Show me Lagos on the map", and "hello" stay `en`.

- [x] **Step 2 - Auto reply-language mode** - Widen the panel's language state to
  `LanguageMode = AskLanguage | 'auto'`, default to `'auto'`, add an **Auto** option to
  the header chip (listed first), persist the mode, and resolve it on send:
  `mode === 'auto' ? detectLanguage(text).replyLanguage : mode`. `AskAtlasRequest.language`
  keeps its current concrete `AskLanguage` type, so the server contract is unchanged.
  Update `persistence.ts` so `'auto'` is a valid stored value. Bump the stored
  `version` to 2 and migrate on read: a v1 record's `en` becomes `auto` (that was the
  old forced default), while a v1 `yo` / `ha` / `ig` is kept as that manual mode, so
  returning users get Auto without losing a deliberate choice.
  *Done when:* with the chip on Auto, a Yoruba question sends `language: "yo"` in the
  `/api/ask` request body and the reply is Yoruba; selecting YO forces Yoruba for an
  English question; selecting EN forces English for a Yoruba question; the choice
  survives a panel close and reopen.

- [x] **Step 3 - Multilingual small talk and prompt steering** - Fold diacritics in
  `normalize` and add Yoruba, Hausa, Igbo, and Pidgin greetings to
  `src/lib/ask/smalltalk.ts` (for example "Ẹ ku aaro", "Bawo ni", "Sannu", "Ina kwana",
  "Ndewo", "Kedu", "How far", "No wahala") so they reach small talk instead of tools.
  Matching stays exact after normalization, so "hello, postcode for Ikeja" and "abeg
  show me Lagos" still reach the tools. Add at most one concise line to
  `src/server/ask/prompt.ts` so a non-English place question still prefers
  `searchLocation` and never invents a code (keep the prompt short; the 8B model loses
  tool calls when it grows).
  *Done when:* `isSmallTalk('Ẹ ku aaro')`, `isSmallTalk('Sannu da zuwa')`,
  `isSmallTalk('Ndewo')`, and `isSmallTalk('How far')` are true while
  `isSmallTalk('hello, postcode for Ikeja')` stays false; the English eval cases still
  pass.

- [x] **Step 4 - Postcode format guard** - In `src/lib/tools/executors.ts`, `getPostcode`
  validates the code against `POSTCODE_PATTERN` after `toDashedCode` and throws
  `ToolFault('invalid_args', ...)` on a malformed code instead of looking it up. A
  well-formed code with no record keeps returning `null` (unchanged).
  *Done when:* `getPostcode({ code: 'NG-01-001-001-001-001' })` rejects with
  `invalid_args` and `getPostcode({ code: 'FC-02-D43-LG-01' })` still resolves or
  returns `null`; the existing tool tests stay green.

- [x] **Step 5 - Show the auto-detected language** - Record the resolved reply language
  and whether it came from Auto on the assistant message, and render a small footer
  label in `AskAtlasMessageBubble` (for example "Auto · Yoruba") only when Auto was
  used. Manual modes show nothing.
  *Done when:* with Auto, a Yoruba reply shows the "Auto · Yoruba" label and an English
  reply shows "Auto · English"; with YO or EN chosen manually, no Auto label appears.

- [x] **Step 6 - Multilingual eval coverage** - Add cases to `scripts/eval-atlas.mjs`
  for a Yoruba, Hausa, and Igbo postcode question (auto-selected language, no invented
  postcode, provider `natlas`), a non-English greeting (small talk, no tool call), and a
  Pidgin question (English reply, grounded). Extend the case shape with an optional
  `language` field for the auto-detect assertion. Regenerate `scripts/eval-report.md`
  and `.json` when the local N-ATLAS server is up.
  *Done when:* `CASE=<new-numbers> node scripts/eval-atlas.mjs` passes those cases
  against the running app, and the report shows the new cases.

## Files / areas

- `src/lib/ask/language.ts` (new) and `language.test.ts` (new) - detector.
- `src/lib/ask/types.ts` - `DetectedLanguage`, `LanguageMode` (types only; `AskLanguage`
  and `AskAtlasRequest` stay stable).
- `src/components/ask/AskAtlasHeader.tsx` - Auto chip option.
- `src/components/ask/AskAtlasPanel.tsx` - mode state, detect on send, persist mode.
- `src/lib/ask/persistence.ts` - persist `LanguageMode`.
- `src/lib/ask/smalltalk.ts` and `smalltalk.test.ts` - multilingual phrases.
- `src/lib/tools/executors.ts` and a test - `getPostcode` format guard.
- `src/server/ask/prompt.ts` - one multilingual line.
- `src/components/ask/AskAtlasMessageBubble.tsx` - detected-language label.
- `scripts/eval-atlas.mjs` (+ regenerated report) - multilingual cases.

## Data / contracts

- `AskLanguage = 'en' | 'yo' | 'ha' | 'ig'` is **unchanged** and remains the only value
  accepted by `/api/ask` and by `buildSystemPrompt`. Auto never travels over the wire.
- New `DetectedLanguage = 'en' | 'yo' | 'ha' | 'ig' | 'pcm'`; the detector maps `pcm`
  to reply language `'en'`.
- New `LanguageMode = AskLanguage | 'auto'`, used only by the panel and persistence.
- The detector result is the load-bearing shape later items (voice, advanced eval)
  reuse: `{ replyLanguage, detected, confidence }`.
- The assistant message gains `replyLanguage?: AskLanguage` and `autoDetected?: boolean`
  for the label. Persistence already tolerates extra message fields.

## Testing

- Configured runner: `npm run test` (Vitest). Logic-bearing steps ship their test in
  the same diff.
- Step 1: detector unit tests, including the measured sentences above and English
  negatives (a place name inside a non-English sentence must not flip the result, and a
  plain English question must stay `en`).
- Step 2: no new pure logic beyond the wiring; verify with a browser check of the sent
  request when Auto is on (Network tab shows the resolved `language`).
- Step 3: `smalltalk.test.ts` additions (multilingual true cases and English false
  cases).
- Step 4: an `executors` test covering the malformed-code rejection and a valid-code
  pass-through.
- Step 5: browser evidence at 390px and 1440px that the label renders on Auto and is
  absent on manual.
- Step 6: run the eval case subset locally.
- Not tested at unit level (per coding standards): the chip, panel, and bubble
  components; those ride on browser evidence plus the build.

## Notes for the AI

- Detection is **client-side** in the browser; the server keeps its current language
  contract. Do not add `'auto'` or `'pcm'` to the server's `LANGUAGES` array.
- Keep the detector deterministic and offline (no provider call, no network): it must
  work with the model offline and must not burn free-tier quota.
- Prefer the measured sentences from the earlier `/api/ask` probes as fixtures; they
  are the real failure modes.
- Never invent postcode data: the guard is a safety net, not a substitute for the
  grounding rules already in place.
- Write comments only for the non-obvious heuristics (thresholds, lexicon weighting).
- No em dashes, en dashes, or ellipsis characters in any generated text, per
  `coding-standards.md` (Writing).
- If the detector's false-positive rate on English turns out high in review, lower the
  lexicon weights or raise the confidence floor rather than adding model calls.

## Known limitations

- Yoruba, Hausa, or Igbo written without diacritics (common on phones) may score below
  the floor and fall back to English. The manual chip is the escape hatch; a smarter
  detector is a later refinement, not part of this feature.
- The detector reads text, so it cannot help with voice input yet; that pairs with the
  later voice-to-text item.
- A weak model sample can still answer in the wrong language or reach for a made-up
  code. The eval cases are the guardrail; Section 9 grounding rules and the Step 4
  format guard remain the safety net.
- The deterministic safety copy in `src/lib/ask/responder.ts` (the postcode fallback,
  the state or LGA postcode copy, the empty-district copy, and the map-action copy) is
  English only. When grounding replaces a non-English model reply, the user sees that
  English copy: eval case 18 reproduced it for a Hausa question. Carrying the resolved
  reply language into the responder and localizing those strings is a follow-up item,
  out of scope here because it translates user-facing copy.
