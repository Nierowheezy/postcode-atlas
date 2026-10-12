# Fix: Non-English postcode questions let the LGA short code through

**Type:** Fix
**Status:** verified
**Branch:** `fix/non-english-postcode-guard`
**Completed:** 2026-10-12

## Problem

When the reply language is Yoruba, Hausa, or Igbo, a postcode question that only
resolves to a state or an LGA is not guarded, so the model can present the LGA
short code as a postcode and the bubble still says the reply was verified.

`asksForPostcode` in `src/lib/ask/responder.ts` matches only the English words
`postcode`, `postal code`, and `zip`. When it returns false the deterministic
`postcodeScopeCopy` never runs, and the model's own sentence stands. The same
false negative happens for any non-English phrasing.

Observed on Auto (from the user's own run):

| Question | Reply | Footer |
|---|---|---|
| `Kí ni kòòdù Ikeja?` | `Ikeja jẹ LGA kan ni ipinlẹ Eko, kòòdù rẹ̀ ni 11.` | `Auto · Yoruba`, `Verified against NIPOST postcode data` |
| `Postcode for Ikeja, Lagos` | `Ikeja is a Local Government Area, so it has no single postcode...` | `Auto · English`, guarded |

The English wording is protected by `postcodeScopeCopy`; the Yoruba one is not.
The payload (`1 LGA / Ikeja / 11`) also makes `groundingBasis` return `payload`,
which is why the footer claims verification.

`Menene lambar gidan waya na Ikeja?` (Hausa) took the same path and came back in
English, because the guard did not fire and the model answered in English.

## Out of scope

- Model reply-language drift on its own: one observed Hausa reply was model text,
  not a guard. This fix removes that instance by guarding, it does not retrain the
  model.
- The `how far` greeting, which routed to small talk correctly and was answered
  oddly by the model.
- The other deterministic copy (`mapActionCopy`, `SCOPE_UNAVAILABLE_COPY`, the
  engine-down and generic error strings). They stay English for now.
- The grounding footer wording and when it says verified.

## In scope

- Recognize a postcode request in Yoruba, Hausa, Igbo, and Pidgin, not just
  English.
- Make the deterministic postcode copy reply in the resolved reply language, so
  this fix does not trade a wrong code for an English sentence.

## Data / contracts

- `AskLanguage` (`en`, `yo`, `ha`, `ig`) is unchanged. The fix reads the value the
  panel already sends: `request.language` in `responder.ts`, then threads it
  through `attachDerived`.
- No server change and no `/api/ask` shape change.
- Detection folds diacritics before matching, the way `smalltalk.ts` does, so
  `kòòdù` and `koodu` both match.

## Build steps

- [x] **1. Multilingual postcode detection.** In `responder.ts`, fold diacritics and
  match a postcode request in English (`postcode`, `postal code`, `zip`), Yoruba
  (`kòòdù`, `koodu`), Hausa (`lambar`, `lambar gidan waya`), and Igbo (`koodu`,
  `koodu ozi`). Keep `attachDerived` behavior otherwise identical.
  *Done when:* an English unit test asserts the recognized forms, and
  `Kí ni kòòdù Ikeja?` reaches the deterministic copy instead of the model text.

- [x] **2. Reply language for the deterministic postcode copy.** Thread
  `request.language` into `attachDerived`, `postcodeScopeCopy`, and
  `postcodeFallback`, and render that copy in Yoruba, Hausa, Igbo, and English.
  Draft the three translations and flag them in the diff for review; a native
  speaker should read them before merge.
  *Done when:* with Auto and a Yoruba question, the guarded reply is Yoruba and
  writes no postcode for Ikeja; the English reply is unchanged.

- [x] **3. Eval coverage.** Add a Yoruba case to `scripts/eval-atlas.mjs` for
  `Kí ni kòòdù Ikeja?` that asserts `natlas`, the `Auto · Yoruba` label, and that
  the reply presents no short code as a postcode.
  *Done when:* the new case passes against a running app, and the report shows it.

## Files / areas

- `src/lib/ask/responder.ts` - detection and localized copy.
- `src/lib/ask/responder.test.ts` - focused tests for both.
- `scripts/eval-atlas.mjs` and the regenerated report - the new case.

## Verify

- `npm run test && npm run lint && npm run build`.
- Browser, on Auto: ask `Kí ni kòòdù Ikeja?` and `Menene lambar gidan waya na Ikeja?`.
  Each reply must be in its own language and must not present an LGA short code
  as a postcode. Confirm against the English starter question that its protected
  reply is unchanged.

## Outcome

- 71 tests pass (9 files), `tsc --noEmit` clean, build clean.
- `node scripts/eval-atlas.mjs`: 21/21. The Yoruba, Hausa, and Igbo cases now get
  the localized guard reply with no short code; English and Pidgin are unchanged.
- The Yoruba case was strengthened in place rather than duplicated as a new case.

## Known limitations

- The three non-English guard strings are first drafts and still need a native
  speaker's read.
- The guard only fires when the model calls a listing tool. One Yoruba run
  answered without tools and the guard did not run; it still presented no short
  code, and the re-runs were consistent. Making the guard independent of tool
  choice is a separate reliability item.
- The app's own copy is still English for map moves, empty district or area
  lists, and errors.
- The detector still cannot help an English reply if the model drifts and no
  guard fires.
