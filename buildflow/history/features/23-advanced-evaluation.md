# Feature: Advanced evaluation

**From build-plan:** feature 23

**Status:** verified

## Goal

Strengthen the Ask Atlas evaluation so it finds real weaknesses instead of only
confirming known-good behaviour. Today the benchmark is one 435-line script with
21 cases, its pass/fail logic has no test of its own, and the four axes the build
plan names (languages, regional terminology, ambiguity, tool accuracy) are each
covered by a handful of cases at most.

This feature turns the harness into testable modules, adds grouped cases across
those four axes, and reports per-group results with a regression diff against the
last recorded run. A new failing case is a *result* this feature produces, not a
defect it must fix: model and prompt changes belong to `/fix` or a new plan item,
and a case is never weakened to make a run green.

## In scope

- Split `scripts/eval-atlas.mjs` into importable modules: the case table and the
  pure reply checks, so both can be tested offline with no browser.
- Offline tests for the harness checks and for the case table's integrity.
- New benchmark cases grouped as `languages`, `regional-terms`, `ambiguity`, and
  `tool-accuracy`, each labelled with the expected answer shape and the tool it
  intends to exercise.
- `GROUP=` filtering so a run can execute one axis instead of the full suite.
- A grouped report (per-group totals in both `.md` and `.json`) and a regression
  diff against the previously recorded report.
- Tool accuracy at the schema level: `src/lib/tools/provider.test.ts`, proving the
  tool surface the model sees is coherent, plus direct coverage for the executors
  that currently have none.
- Repair F-01, the unknown-LGA mis-resolution eval case 37 revealed. It is an
  approved extra reviewed step (Step 8), because the defect makes a reply claim
  NIPOST verification for a place that does not exist.

## Out of scope

- Any change to the model, the prompt, the provider chain, or the tool
  vocabulary. This feature measures; it does not tune, except for the single
  resolution defect F-01 records in Step 8.
- Fixing any other defect the new cases or tests reveal. Each becomes a finding
  or a separate `/fix`; only F-01 is repaired here.
- New tools, new hierarchy levels, or new languages in the detector. Feature 18
  and 11 own detection and terminology; this feature tests what ships.
- CI wiring, a ruleset, or scheduled runs (that is `/ci`), and converting the
  benchmark into a browser test suite (`/browser-tests`).
- An eval dashboard, hosted result storage, or per-language scoring models.

## Build loop

Build one step at a time. Plan mode lays out the step first, the AI implements
just that step and shows the diff, and you read it before approving. `/complete`
makes the single feature-level commit at the end.

## Build steps

- [x] **Step 1 - Split the harness into testable modules** - move the pure reply
  checks into `scripts/eval/checks.mjs` (postcode extraction, the grounding
  label, `noInvented`, `noShortCode`, `isNatlas`, the Natlas meter test) and the
  21-case table into `scripts/eval/cases.mjs`; `scripts/eval-atlas.mjs` imports
  both and keeps the browser, the run loop, and the report. Add
  `scripts/**/*.test.mjs` to `test.include` in `vitest.config.ts` so a harness
  module can be tested where it lives. No case, check, or report change. *Done
  when:* `npm run test && npm run lint && npm run build` is green, and a subset
  live run (`CASE=1,4,8,13,21 npm run eval`) reports the same pass/fail as those
  cases in the committed `scripts/eval-report.md`.

- [x] **Step 2 - Offline tests for the harness checks** - add
  `scripts/eval/checks.test.mjs` with inline reply fixtures shaped like the
  runner's `readState()` output: a dashed postcode with no verified footer fails
  `noInvented`; the same reply with the footer passes; `groundingLabel` maps each
  of the five footers; `noShortCode` catches a bare library code and passes a
  reply with no digits; `isNatlas` accepts `natlas · try 12` and rejects a
  non-natlas meter; `postcodes()` de-duplicates. *Done when:* the new file runs
  under `npm run test`, and inverting any helper's logic makes that file fail.

- [x] **Step 3 - Case vocabulary: groups, integrity, and the new checks** - add
  `group` and `expectTool` to every case in `scripts/eval/cases.mjs` (`group` is
  one of `languages`, `regional-terms`, `ambiguity`, `tool-accuracy`, `core`; the
  21 existing cases become `core` unless a group fits better). Add the helpers the
  new groups need to `scripts/eval/checks.mjs`: `hasSegments` (a decode reply
  names the five parts), `notVerified` (the reply makes no verified-NIPOST claim),
  `mentionsPlace(names)` (a named place appears), and `honestFallback` (an unknown
  parent is answered honestly rather than with an invented postcode), each with a
  passing and a failing fixture in `scripts/eval/checks.test.mjs`. Add
  `scripts/eval/cases.test.mjs` asserting case numbers are unique, every group is
  in the allowed set, every case has a name, a `text` or `turns`, and an `expect`
  line, and that every `expectTool` names a tool in `TOOL_NAMES`. *Done when:* the
  new helpers each have fixtures shaped like a real reply, the integrity test fails
  on a duplicate number, an unknown group, or an unknown tool name, and every
  `expectTool` matches a name parsed from `src/lib/tools/types.ts`.

- [x] **Step 4 - Language and regional-terminology cases** - add four `languages`
  cases (Pidgin map request, Pidgin landmark postcode question, a code-mixed
  Yoruba and English postcode question, an Igbo hierarchy list) and four
  `regional-terms` cases (`Computer Village, Ikeja`, `Lekki Phase 1`, `GRA` with
  no state, `Nsukka`). Add the missing `src/lib/atlas/names.test.ts` covering
  `matchStateName` and `matchLgaName` as they behave today: the `Lagos State`
  form, the Abuja to FCT alias, code and case-insensitive matches, and `undefined`
  for an unknown name. *Done when:* the new tests pass offline, and
  `GROUP=languages npm run eval` and `GROUP=regional-terms npm run eval` each run
  only their own cases and are recorded in the report.

- [x] **Step 5 - Ambiguity and tool-accuracy cases** - add three `ambiguity` cases
  (bare `Kano`, bare `Abeokuta`, bare `Eket`) and five `tool-accuracy` cases: a
  decode of `LA-11-A12-AK-08` asserting the five-part breakdown, a nearby
  question ("What postcodes are near Wuse 2, Abuja?"), an editorial question
  ("What does NDAPS stand for?") asserting the reply does not claim NIPOST
  verification, an address paste (`12 Allen Avenue, Ikeja, Lagos`) asserting the
  reply places Ikeja and Lagos, and an unknown parent (`List the districts in
  Nowhereville, Lagos`) asserting an honest fallback. *Done when:* each new case
  runs under its group and its expected answer shape is stated in `expect`.

- [x] **Step 6 - Group report and regression diff** - add `GROUP=` filtering to
  `scripts/eval-atlas.mjs`; write per-group totals into both report files and add
  a per-group table plus a "Changes since the last run" section to the markdown;
  add `groups`, `regressions`, and `fixed` to the JSON. Before overwriting the
  report, read the previous `REPORT_BASE + '.json'` and, only when its `target`
  matches, compare `pass` by case number to list regressions (pass to fail) and
  fixes (fail to pass). Print per-group totals and any regression in the console;
  keep the exit code rule (non-zero when any case fails). Note the `GROUP` and
  `CASE` env vars on the `npm run eval` line in `AGENTS.md`. *Done when:* a run
  writes the new report shape, a seeded previous report produces the expected
  regression list, and a mismatched `target` reports no baseline instead of
  comparing across targets.

- [x] **Step 7 - Tool-layer accuracy tests** - add `src/lib/tools/provider.test.ts`
  asserting the registry keys, `TOOL_NAMES`, and `ATLAS_PROVIDER_TOOLS` name the
  same 12 tools exactly once each; every provider tool has a non-empty
  description and a `parameters` object that serializes with `JSON.stringify`;
  and the required-argument tools expose their required keys. Extend
  `src/lib/tools/executors.test.ts` so every tool has at least one happy path and
  one failing path through `runTool`: `searchLocation`, `getStates`, `getState`
  (found, and unknown name as `not_found`), `getLgas`, `getDistricts`, `getAreas`
  (rows and the empty page shape), `getNearby` (coordinate validation and the
  300 m cap), `navigateMap` (a state target and an unknown target), and
  `decodePostcode` (a well-formed code's five segments and a malformed code's
  honest result). *Done when:* every registered tool is exercised through
  `runTool` at least once, the new tests pass offline with the store and gateway
  stubbed at the module boundary, and removing a tool from the registry fails
  `provider.test.ts`.

- [x] **Step 8 - Repair F-01: an unknown LGA must not inherit another LGA's
  districts** - `resolveStateAndLga` in `src/lib/tools/executors.ts` takes the
  place-name fallback whenever any part of the `(state, LGA)` pair fails, so the
  resolvable state "Lagos" plus the unknown LGA "Nowhereville" fell back to the
  first LGA whose name merely starts with "Lagos" ("Lagos Island") and returned
  its real gateway districts, which then wore the verified footer. Take the
  fallback only when the state slot did not resolve to a state, and make
  `findLgaByName` refuse a name that is itself a state name. Cover both with
  offline `runTool` tests and re-run eval case 37. *Done when:*
  `getDistricts({ state: 'Lagos', lga: 'Nowhereville' })` and the lga-slot state
  name both return `not_found` without reading districts, the new tests fail
  against the pre-step code, and live case 37 passes.

## Files / areas

- New: `scripts/eval/cases.mjs`, `scripts/eval/checks.mjs`,
  `scripts/eval/checks.test.mjs`, `scripts/eval/cases.test.mjs`,
  `src/lib/atlas/names.test.ts`, `src/lib/tools/provider.test.ts`.
- Changed: `scripts/eval-atlas.mjs` (imports the modules, gains `GROUP=` and the
  group and regression report), `vitest.config.ts` (one extra `include` pattern),
  `src/lib/tools/executors.test.ts` (added tool coverage, plus the two F-01
  regression tests in Step 8), `AGENTS.md` (the `npm run eval` line gains the
  `GROUP`/`CASE` note), `src/lib/tools/executors.ts` (Step 8: F-01 resolution
  fix), and `scripts/eval-report.md` plus `scripts/eval-report.json` (refreshed
  by the full run).

## Data / contracts

- The eval case shape gains two fields: `group` (the reporting bucket) and
  `expectTool` (the tool the case intends to exercise, recorded in the report as
  an annotation). Both are metadata; assertions stay in each case's check
  functions, because the model's tool choice is not deterministic and no case may
  fail on tool selection alone.
- `scripts/eval/checks.mjs` is the harness's single source for reply checks. It
  is browser-free, provider-free, and pure: text in, verdict out. Load-bearing
  for both the runner and its tests, so keep the exported names stable.
- The report JSON keeps its top-level keys (`target`, `passed`, `total`,
  `results`) and gains `date`, `groups`, `regressions`, and `fixed`. `results`
  entries keep `n`, `name`, `expect`, `pass`, `failures`, `grounding`, `meter`,
  `reply`, and gain `group`.
- The 12 tool names live in `src/lib/tools/types.ts`. `scripts/` is Node ESM and
  cannot import that TypeScript module, so `cases.test.mjs` reads the file and
  extracts the `TOOL_NAMES` array to check `expectTool` against it. That regex
  over a known literal is a stated limit, not a general TypeScript parser.

## Testing

- `npm run test` is the gate. It gains the harness checks
  (`scripts/eval/checks.test.mjs`), the case-table integrity test
  (`scripts/eval/cases.test.mjs`), the name matcher
  (`src/lib/atlas/names.test.ts`), the tool surface
  (`src/lib/tools/provider.test.ts`), and the widened executor coverage in
  `src/lib/tools/executors.test.ts`. All of it is offline and deterministic.
- `npm run eval` is the acceptance evidence for the live cases and is not part of
  `Verify` (it needs Chrome, a running dev server, and a model, so it is slow and
  can be flaky). Run one group per new-case step and record the run in
  `scripts/eval-report.md`; a full run is a manual check, not a gate.
- Full local verification for every step: `npm run test && npm run lint && npm
  run build`.
- Runtime note: each case allows up to about 30 s of settling and a retry for an
  empty reply, so a full 37-case run is a long manual check. That is why the
  `GROUP` filter is in scope.

## Notes for the AI

- The harness must stay Node ESM (`.mjs`): `npm run eval` is `node
  scripts/eval-atlas.mjs` and Node cannot import the TypeScript in `src/`. Only
  `eval-atlas.mjs` may import `playwright`; the cases and checks modules must stay
  browser-free so Vitest can import them.
- `vitest.config.ts` currently includes only `src/**/*.test.ts`. Adding
  `scripts/**/*.test.mjs` is part of Step 1, so confirm the glob with an actual
  `npm run test` before adding tests that depend on it.
- `tsc --noEmit` has `allowJs` but not `checkJs`, so the `.mjs` harness files are
  parsed but not fully type-checked. Keep them small, keep the JSDoc on exported
  helpers, and rely on the tests for behaviour.
- Add cases only with a real expected answer. If a case fails, record it (a
  finding or a `/fix` proposal) and do not soften the case to pass.
- Match `scripts/eval-atlas.mjs` for style: no em dashes or en dashes in new
  content, lowercase comment voice, and a short header comment on each module
  pointing at the feature number.
- Keep the existing report sections and table columns; add the group information
  rather than rearranging what a reader already relies on.

## Red-team notes

- **Coverage: the harness had no test at all.** Every assertion the benchmark
  makes about a reply (postcode extraction, the grounding footer, the library-code
  guard) was unverified, so a bug in `noInvented` would silently pass cases.
  Steps 1-2 fix that before adding cases.
- **Coverage: the check module had to be importable.** The script imports
  `playwright` and runs top-level awaits, so it can never be imported by a test;
  splitting the pure helpers out is a prerequisite, not a tidy-up. That forced the
  `vitest.config.ts` include change, which is why it is in Step 1 rather than
  discovered in Step 2.
- **Honesty: no faked determinism.** The grounding footer varies by reply shape
  (the same Ikeja question was labelled "Verified against NIPOST" in Yoruba and
  "Not verified" in Hausa in the committed report), so `expectTool` is recorded
  metadata and the assertions stay in per-case checks. A spec that asserted the
  model's tool choice would be flaky and would not measure anything.
- **Trap found: the explanation case collides with the postcode guard.** The
  editorial copy carries an example postcode, so a `noInvented` check would fail a
  correct editorial answer. The explainAtlas case therefore asserts the editorial
  path (no verified claim) and not the postcode rule, and the new `notVerified`
  helper exists for exactly that.
- **Runtime is a real cost.** 21 cases today, 37 after this feature, at up to
  about 30 s each. Without the `GROUP` filter a full run becomes a chore nobody
  repeats, so the filter is in scope and does not rely on someone remembering
  `CASE` numbers.
- **Regression comparison needs a guard.** The committed `eval-report.json` is
  the baseline, and a run against production would otherwise be diffed against
  local results. Comparing only when `target` matches keeps that honest.
- **Scope note.** The tool-layer tests in Step 7 are the "tool accuracy" half of
  the build-plan line: tests plus one config line and no runtime change. Step 8
  later added one runtime change of its own, the F-01 repair in
  `src/lib/tools/executors.ts`. If Step 7's diff proves too big
  to review in one pass, split it at implementation time into the provider surface
  and the executor coverage rather than shrinking one of them.

## Findings

### 23/F-01 [P1] closed - An unknown LGA gets invented district rows marked verified

**File:** scripts/eval/cases.mjs:439 (eval case 37, `getDistricts` path)
**Found:** 2026-10-13 by /implement (feature 23, eval case 37, two live runs)
**Why it matters:** Asking "List the districts in Nowhereville, Lagos" answers
with 23 rows, `A01` to `A23`, and closes "There are 23 districts in total". The
bubble wears the "Verified against NIPOST postcode data" footer, so fabricated
or mis-parented rows are presented to the user as verified NIPOST data for a
place that does not exist. It reproduced identically in two runs, so it is not
model sampling noise. The guard that already exists for a fabricated postcode
(`getPostcode` rejects a malformed code as `invalid_args`) has no counterpart
for a fabricated parent name in `getDistricts` or `getAreas`, so the failure
mode is the one the grounding invariant exists to prevent.
**Suggested fix:** Resolve the parent through the same name matcher the other
tools use and return an honest not-found when no LGA matches, instead of letting
a fabricated name reach the store; check whether the verified footer is applied
per tool result rather than per reply, and cover the outcome with an offline
`runTool` test plus this eval case.
**Resolution:** Repaired in Step 8 of feature 23 (2026-10-13). Root cause was
the place-name fallback in `resolveStateAndLga`, not the store: `state: "Lagos"`
resolved, `lga: "Nowhereville"` did not, and the catch then treated the state
argument as an LGA name. The store's own prefix search for "Lagos" returns the
Lagos Island LGA (code 14), so `getDistricts` returned that LGA's live gateway
districts (`A01`-`A23`) and the reply carried a real payload, hence the verified
footer. The state is now resolved first and the fallback only runs when no state
matched, so a known state plus an unknown LGA throws `not_found` without reading
districts; `findLgaByName` additionally refuses a name that matches a state,
closing the swapped-slots path. Covered by two offline `runTool` tests in
`src/lib/tools/executors.test.ts`, both of which failed before the change
(`not_found` expected, the mis-resolved pair received), and by live eval case
37, which now answers "Sorry, I couldn't find anything for \"Nowhereville\" in
Lagos State." under the Not verified footer. `npm run test` 441 passed,
`npm run lint` clean, `npm run build` succeeded.

**Re-review (2026-10-13, `/audit` scope: current, all lenses):** Closed. The
audit read the repaired `resolveStateAndLga` and `findLgaByName` and the two new
tests; the original defect is gone (`getDistricts({ state: 'Lagos', lga:
'Nowhereville' })` throws `not_found` before any store read, and the eval case
now answers honestly with a `Not verified` footer). The repair introduced no new
defect: the only other caller of `findLgaByName` is `navigateMap`, which resolves
a state before the fallback and whose LGA-in-state test still passes, and
`getAreas` shares the fixed helper. Offline gate re-run on the frozen tree:
`npm run test` 441 passed, `npm run lint` clean, `npm run build` succeeded. Live
`CASE=37` passed twice. One unrelated flake was observed and is not a code
defect: eval case 15 ("Postcode for Lagos state") failed once with "However, this
is not a valid postcode." and once with a reply about "Abia", then passed on the
next run, on a `getState` path this repair does not touch; the case correctly
flagged the model's bad answer.
