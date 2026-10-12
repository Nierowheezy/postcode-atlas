# Feature: Phone viewport and safe areas

**From build-plan:** feature 24a
**Status:** verified

## Goal

Stop mobile browser chrome from cropping the app, and make the shell respect notches and the home indicator. Today the root uses `w-screen h-screen` (`100vh`) at `src/App.tsx:404` with `body { overflow: hidden }` (`src/index.css:18`), so when a phone's toolbars show or hide the layout crops or jumps. The repo already defines `.safe-top/.safe-bottom/.safe-left/.safe-right` (`src/index.css:164-177`) but no component uses them. This slice makes the shell viewport-correct and applies those insets where the app meets the screen edge.

## Design reference

No external mockup. The target is not a look-alike but a correctness fix with observable criteria: the root tracks the visible viewport, and edge-anchored surfaces clear the safe-area insets. Intent lives in `buildflow/project-plan.md` section 7 (Responsive design, Accessibility).

## In scope

- `index.html` opts into edge-to-edge painting with `viewport-fit=cover`, so the shell can fill the screen and the safe-area insets become non-zero.
- The app root and map container switch to a dynamic viewport height with a `100vh` fallback.
- The existing `.safe-*` helpers become inset-only (drop the fixed 12px floor) so a device without a notch renders exactly as before.
- Safe-area insets applied to: the top header, the phone bottom sheet, the side drawers, the bottom-anchored map corner controls, the floating overlays mounted in `src/App.tsx`, and the toast.
- Retire the unused `.drawer-content` helper.

## Out of scope

- Ask Atlas panel layout on phones and its composer inset (feature 24b).
- Draggable-card bounds and the coarse-pointer touch-target reconciliation (feature 24c).
- Drawers and modals phone presentation (feature 24d).
- Any behavior or copy change. This is layout only.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Dynamic viewport and edge-to-edge meta** - add `viewport-fit=cover` to the viewport meta in `index.html` so the insets become non-zero, then give the root container and the map `<main>` in `src/App.tsx` a `100dvh`-based height with a `100vh` fallback (a CSS `@supports (height: 100dvh)` rule or an equivalent), keeping `body { overflow: hidden }`. *Done when:* the served HTML carries `viewport-fit=cover`, at 390x844 and 844x390 the layout fills the visible viewport with no document scroll, and the root's height resolves from a dynamic viewport unit (the applied class or computed style shows `dvh`), not plain `100vh`.

- [x] **Step 2 - Inset-only helpers, header, and phone sheet** - change `.safe-top/.safe-bottom/.safe-left/.safe-right` in `src/index.css` from `max(12px, env(...))` to inset-only `env(..., 0px)` so they are a no-op without a notch, then apply them so the header clears the top inset and the phone bottom sheet clears the home indicator, and move the sheet's `max-h-[80vh]` cap to a dynamic viewport unit, in `src/components/navigation/TopBar.tsx` and `src/index.css`. *Done when:* the header and the sheet carry the safe-area utilities in the DOM, the header is unchanged in height at 1280 (no inset present), the header still lays out on one row at 390, the sheet's height cap resolves from a dynamic unit, and on a notched device (manual Try) the header text and sheet actions are not flush against the cutout or home indicator.

- [x] **Step 3 - Drawers and map corner controls** - apply the insets to the two full-height side drawers (`src/components/explorer/StateExplorerDrawer.tsx`, `src/components/assembly/PostcodeAssemblyDrawer.tsx`) and to the bottom-anchored map chrome (`src/components/map/ScaleCenterControl.tsx`, the right control stack in `src/components/map/AtlasMap.tsx`, and the Leaflet attribution rule in `src/index.css`). *Done when:* each carries the inset in the DOM, and every bottom-anchored element sits above the home-indicator area rather than flush to the true edge.

- [x] **Step 4 - Floating overlays, toast, and shell chrome** - apply the insets to the floating overlays mounted in `src/App.tsx` (the search capsule, the hunt card, the postcode inspector, and the data HUD, excluding the Ask Atlas wrapper which belongs to 24b), the toast (`src/components/ui/Toast.tsx`), the update banner (`src/components/ui/UpdateBanner.tsx`), the header's horizontal edges, and the TopBar dropdowns (the phone breadcrumb panel and the two tablet menus). *Done when:* each carries the inset in the DOM, the header and every top-anchored surface clear the top inset, and the left and right insets clear a landscape notch. The App.tsx overlays are transparent wrappers with no padding of their own, so they take the helpers directly; the header's `px-3`, the TopBar dropdowns' own padding, and the ScaleCenterControl capsule keep their spacing and compose the inset with `calc()`.

- [x] **Step 5 - Retire dead CSS helpers** - remove the unused `.drawer-content` helper from `src/index.css` and any other helper this slice leaves unused. *Done when:* a search for `drawer-content` under `src/` returns nothing and Verify is green.

## Files / areas

- `index.html` - viewport meta gains `viewport-fit=cover`.
- `src/App.tsx` - root container, map `<main>`, floating overlays.
- `src/index.css` - viewport-height fallback, inset-only safe-area helpers, dead helper.
- `src/components/navigation/TopBar.tsx` - header, phone bottom sheet, and the phone/tablet dropdowns.
- `src/components/explorer/StateExplorerDrawer.tsx`, `src/components/assembly/PostcodeAssemblyDrawer.tsx` - side sheets.
- `src/components/map/ScaleCenterControl.tsx`, `src/components/map/AtlasMap.tsx` - bottom corner controls and the Leaflet attribution.
- `src/components/ui/Toast.tsx` - top-anchored toast.
- `src/components/ui/UpdateBanner.tsx` - top and bottom update notices.

## Data / contracts

None. This slice changes layout CSS and class names only; no data shape, type, or route changes.

## Testing

- No unit test: the project's runner (`vitest`) covers `src/lib/**` and `src/server/**` logic, and this is a presentational change with no assertable logic. See the Testing gate in `buildflow/context/coding-standards.md`.
- Verify with `npm run test && npm run lint && npm run build`.
- Browser evidence at 390x844, 844x390, 768x1024: assert the root height resolves from `dvh`, there is no document scroll, the served HTML carries `viewport-fit=cover`, and the header, sheet, drawers, map controls, and overlays carry the safe-area utilities (DOM assertions).
- Desktop regression check at 1280x900: the header height, the floating overlay positions, and the map control offsets are unchanged from the pre-change values, proving the inset-only helpers are a no-op without a notch.
- Safe-area `env()` insets are not simulatable in headless Chrome. Real notch and home-indicator behavior rides on the manual Try path on a notched phone, not on the automated check.

## Verification evidence

Verify (`npm run test && npm run lint && npm run build`) is green: 76 tests, `tsc --noEmit` clean, build succeeds.

Playwright with system Chrome at 390x844, 844x390, 768x1024, 1280x900, reading the running dev server:

- Served HTML carries `viewport-fit=cover`. The root's computed height equals the `100dvh` probe at every viewport, and `scrollHeight` equals `clientHeight` with `scrollTo(0, 500)` leaving `scrollY` at 0, so there is no document scroll.
- Built CSS emits `.app-viewport{height:100vh}` followed by `@supports (height:100dvh){.app-viewport{height:100dvh}}`, and `@supports (height:100dvh){.supports-\[height\:100dvh\]\:max-h-\[80dvh\]{max-height:80dvh}}`.
- No-inset no-op: at 390x844, 844x390, and 1280x900 the header is 48px with `padding-top: 0` and `padding-left/right: 12px` (the original `px-3`), the search capsule stays at top 64 / left 16, the scale capsule resolves to `bottom: 12px; left: 12px` (the original `bottom-3 left-3`), the right control stack keeps `padding-bottom/right: 0`, and the Leaflet attribution keeps `margin-bottom/right: 0`. Every element still reports the inset utilities in its class list.
- Non-zero path, via Chrome 154 `Emulation.setSafeAreaInsetsOverride` (a fresh browser per case):
  - Portrait, insets top 47 / bottom 34: header `padding-top: 47px`, `min-height: 95px`, height 95 (the content row stays 48px), map `<main>` top 95; toast `padding-top: 47px`; phone sheet `padding-bottom: 50px` (= 16 + 34) with `max-height: 675.2px` (= 80dvh); drawer `padding: 47 / 0 / 34`; scale capsule `bottom: 46px` (= 12 + 34); right stack `padding-bottom: 34px`; attribution `margin-bottom: 34px`.
  - Landscape, insets left 48 / right 48 / bottom 21: header `padding-left/right: 60px` (= 12 + 48) at height 48; search wrapper `padding-left: 48px`; scale capsule `bottom: 33px / left: 60px`; right stack `padding-bottom: 21px / padding-right: 48px`; attribution `margin-bottom: 21px / margin-right: 48px`.
  - No document scroll in either case.

## Follow-ups found (out of 24a scope)

- The phone actions trigger is `lg:hidden` while its bottom sheet is `md:hidden`, so between 768px and 1023px the trigger opens a panel that never becomes visible. Pre-existing; belongs with 24d.
- `Grep` for `drawer-content` returns nothing; the `.leaflet-control-scale` / `.leaflet-control-scale-line` rules in `src/index.css` are dead because AtlasMap renders no `ScaleControl`. Left in place (pre-existing), candidate for a cleanup fix.
- The Leaflet attribution and the custom bottom-right control stack overlap slightly at the true bottom-right corner on every device (about 5px). Pre-existing, unrelated to this slice.

## Notes for the AI

- The `.safe-*` helpers in `src/index.css` force a 12px floor (`max(12px, env(...))`), so make them inset-only (`env(..., 0px)`) in this slice; that floor is what stops them being a no-op without a notch. Use a helper only where the element has no spacing of its own on that side (the header's top). Where the element already has spacing or a margin (the phone sheet, drawers, map controls, overlays, toast), compose the inset with the existing value instead of clobbering it, e.g. `pb-[calc(1rem_+_env(safe-area-inset-bottom,0px))]` or `bottom-[calc(1.5rem_+_env(safe-area-inset-bottom,0px))]`. Do not add a second class-based safe-area abstraction.
- The header keeps its 48px content row on a notched device: `min-h-[calc(3rem_+_env(safe-area-inset-top,0px))]` plus the `safe-top` padding, so the row does not shrink as the inset grows.
- When there is no notch or home indicator the insets must resolve to 0, so desktop and non-notched devices render exactly as before. This slice must not shift any layout that has no inset.
- `index.html`'s viewport meta must gain `viewport-fit=cover`. Without it the insets are always 0 and the rest of this slice has no effect.
- Provide a `100vh` fallback before the `dvh` value so older mobile browsers keep a full-height layout.
- Keep the map-first, single-screen layout: no page scrolling, no `overflow` regressions.
- Stay inside 24a's scope. Do not touch the Ask Atlas panel layout or composer inset (24b), touch targets or drag bounds (24c), or drawer and modal phone presentation (24d).
- Match existing Tailwind v4 patterns, and use hyphen separators in any comment (no em dashes).
