# Fix: Retire the committed mobile probes

**Type:** Fix
**Status:** verified
**Branch:** `fix/retire-mobile-probes`
**Completed:** 2026-10-12

## The problem

`test-mobile.cjs`, `test-mobile2.cjs`, and `test-mobile3.cjs` are tracked at the
repo root. They are throwaway Playwright probes written while debugging earlier
mobile fixes (commits `523f482` Mobile: fix hamburger visibility, logo width,
version badge, search input font-size, and `ad71897` PWA: fix service worker
navigation fallback). They were never cleaned up:

- Each hardcodes a 375x667 iPhone user agent and always hits the deployed
  production URL, so it tests whatever is live, not the working tree.
- They write screenshots to `/tmp` and assert nothing; they print geometry for a
  human to read.
- They use scratch selectors such as `.grid.grid-cols-3 button` that are tied to
  a phone sheet markup that has since changed.
- They overlap each other, and the repo root is the wrong home for them.
  `npm run eval` (`scripts/eval-atlas.mjs`) is the supported browser benchmark.

No npm script references the probes, and `playwright` stays a devDependency
because `npm run eval` needs it.

## The fix

Delete the three files. Do not port them into `scripts/` or the test suite: the
behavior they probed is covered by the unit tests and the `eval` benchmark, and
the repo does not keep scratch probes. No other file changes.

Must not break: `npm run eval` (it must still resolve `playwright`) and the
unit suite.

## Build steps

- [x] **Step 1 - Delete the probes** - remove `test-mobile.cjs`, `test-mobile2.cjs`, and `test-mobile3.cjs` from the repo root. *Done when:* the three files are gone, `git status` shows them as deletions only, and no source or config file still references them.

## Verify

- `npm run test` - 76 tests still pass.
- `npm run lint` - clean.
- `npm run build` - builds.
- `git ls-files | grep -i test-mobile` - no output.
- Optional: `npm run eval` still starts and drives Playwright (needs system
  Chrome).

## Verification evidence

- `git rm test-mobile.cjs test-mobile2.cjs test-mobile3.cjs` staged the three
  deletions; `git status --short` then showed only the three `D` entries for the
  probes plus `M buildflow/context/current-feature.md`.
- `git ls-files | grep -i test-mobile` returned nothing, so no probe stays
  tracked.
- `grep -rn "test-mobile" . --exclude-dir=node_modules --exclude-dir=.git
  --exclude-dir=dist --exclude-dir=.vercel` returned only the fix spec's own
  prose and `buildflow/.state/run.json` (generated state). No source, script,
  or config file references the probes.
- `npm run test` - 10 files, 76 tests passed.
- `npm run lint` (`tsc --noEmit`) - clean.
- `npm run build` - built in 325ms (pre-existing chunk-size warning only).

## Follow-ups found

None.
