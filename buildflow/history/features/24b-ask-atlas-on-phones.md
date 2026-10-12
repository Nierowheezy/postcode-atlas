# Feature: Ask Atlas on phones

**From build-plan:** feature 24b
**Status:** verified

## Goal

Make the Ask Atlas panel work on phones. Today the panel is anchored 24px above the bottom edge of the shell (`src/App.tsx:534`) and its conversation area opens at a fixed preferred height of 300 to 480px (`src/components/ask/AskAtlasPanel.tsx:69-77`), so on a landscape phone the panel is taller than the screen and its header, including the Close button, is pushed off the top edge. On a notched phone the composer sits inside the home-indicator strip, and the card can be dragged completely off screen because its drag has no bounds (`src/components/ui/DraggableCard.tsx`).

Measured on the deployed build (which already carries 24a), the panel's chrome (Ask Atlas header, resize grip, composer) is 122px on a desktop-width card and 144px under mobile emulation, and the preferred list height is 480px tall viewports and 300px on short ones. That gives:

| Viewport | Panel height | Panel top | Result |
| --- | --- | --- | --- |
| 390x844 portrait phone | 624 | 196 | fits |
| 844x390 landscape phone | 444 | -78 | 78px cropped; the whole header, including Close, is off screen |
| 768x1024 tablet | 608 | 392 | fits |
| 1280x900 desktop | 602 | 274 | fits |

So the defect is the short-viewport case: at 844x390 the floor in `defaultListHeight` (300) beats 62% of 390, and the 24px bottom offset pushes the panel past the top edge. This slice bounds the panel to the visible viewport, clears the safe-area insets, and clamps its drag, without changing the desktop presentation.

## Design reference

No external mockup. The target is a correctness fix with observable criteria: the panel's header and composer stay on screen at every phone size and orientation, the composer clears the home indicator, and the card cannot leave the viewport. Intent lives in `buildflow/project-plan.md` section 7 (Responsive design, Accessibility) and `buildflow/build-plan.md` item 24b.

There is a deliberate addition beyond the plan line, flagged for review: the Android keyboard. A chat panel whose composer is covered while typing cannot ship as "works on phones", so Step 2 also asks the viewport meta for `interactive-widget=resizes-content`. It is one token and mobile-only. If you would rather keep it out of this slice, cut it in review.

## In scope

- A bounded panel: the card caps its height to the map area it floats in and the message list absorbs the shrink, so the header, resize grip, and composer always fit and the list scrolls instead. The map area, not the viewport, is the measure, because the shell header above it clips whatever rises past it.
- Safe-area clearance: the panel clears the home indicator and a landscape notch, reusing the inset-only helpers from 24a.
- Android keyboard: `interactive-widget=resizes-content` on the viewport meta so the shell resizes when the keyboard opens and the composer stays visible.
- Drag clamp: the Ask Atlas card cannot be dragged outside the map area. The mechanism is an opt-in prop on the shared card so 24c can reuse it for the other cards.
- An honest resize cap: the grip's maximum follows the room above the panel instead of a flat 85% of the window height.

## Out of scope

- Bounds for the Hunt, Postcode Inspector, and Drag Telemetry cards, and the coarse-pointer 44px rule. That is 24c. This slice adds the opt-in mechanism and enables it for the Ask Atlas card only.
- Phone presentation for the State Explorer, Assembly, changelog, story, and clear dialogs, including `AskAtlasClearDialog`. That is 24d.
- Chat content: responder, grounding, language detection, persistence, and copy are untouched.
- The panel overlapping the bottom-right map controls on phones. Overlay-to-overlay bounds are 24c.
- The TopBar tablet band bug (the actions trigger is `lg:hidden` while its sheet is `md:hidden`, so 768 to 1023px opens nothing). Separate fix.
- iOS keyboard behavior. `interactive-widget` is not implemented in Safari; the layout viewport does not shrink there. Real-device behavior rides on the Try path (see Notes).

## Data / contracts

None. No type, route, API, or stored shape changes. The new surfaces are a UI prop on `DraggableCard` (`dragConstraintsRef`) and two pure helper modules (`src/lib/ask/panelLayout.ts`, `src/lib/ui/dragBounds.ts`), all internal to the UI.

## Build loop

Small steps, each reviewed before the next. `/implement` ticks the steps off here as it finishes them, so a fresh session resumes from the first unchecked one.

## Build steps

- [x] **Step 1 - Bound the panel to the visible viewport** - add a small utility to `src/index.css` next to `.app-viewport`, named `.ask-atlas-panel-fit`, that caps a bottom-anchored panel: `max-height: calc(100vh - 1.5rem)` with an `@supports (height: 100dvh)` override of `calc(100dvh - 1.5rem - env(safe-area-inset-bottom, 0px))`. The 1.5rem matches the wrapper's `bottom-6`. Then make the panel a flex column: `src/components/ask/AskAtlasPanel.tsx` adds `flex flex-col` plus the utility to the card's `className`, the message list gains `min-h-0` (keeping its inline pixel height as the preferred size and its `overflow-y-auto`), and `AskAtlasHeader`, `AskAtlasResizeHandle`, and `AskAtlasComposer` each add `shrink-0` so only the list gives. *Done when:* at 390x844 the panel's rect is fully inside the viewport (`rect.top >= 0`, `rect.bottom <= window.innerHeight`) with the header and composer visible; at 844x390 the panel's rect is inside the viewport and the list shrinks to absorb the short viewport, but it is still taller than the 339px map area, so `<main>`'s `overflow-hidden` clips its header. This cap could not fix that on its own, because it measures the viewport while the shell header above `<main>` takes its top 51px; Step 5 makes the cap map-area-relative. At 1280x900 the panel measures exactly as before (card width 420px, panel height 602px, list 480px) because the cap does not bind; and a conversation taller than the room scrolls inside the list rather than pushing the composer off screen.

- [x] **Step 2 - Clear the safe areas and keep the composer above the keyboard** - in `src/App.tsx`, add `safe-bottom` and `safe-right` to the Ask Atlas wrapper at line 534. It is a transparent wrapper, so per the 24a rule the inset-only helpers shift the card without adding a visible margin; no `calc()` composition is needed because the wrapper has no padding of its own. In `index.html`, add `interactive-widget=resizes-content` to the viewport meta. *Done when:* with a 34px bottom inset forced (Chrome `Emulation.setSafeAreaInsetsOverride`, the same method 24a used) the panel's bottom edge sits at least 34px above the viewport bottom with the composer fully above it; with no inset the panel's bottom edge is still 24px above the viewport bottom, exactly as before; and the served HTML carries `interactive-widget=resizes-content`.

- [x] **Step 3 - Clamp the panel drag to the map area** - add an optional `dragConstraintsRef?: React.RefObject<HTMLElement | null>` to `src/components/ui/DraggableCard.tsx`; when it is set, measure the room around the card against that element and hand motion plain relative `dragConstraints` bounds (a pure `dragBounds` helper in `src/lib/ui/dragBounds.ts`, with tests) plus `dragElastic={0}` for a hard clamp, and when it is absent keep today's free drag and `0.08` elasticity. Put a ref on the `<main>` element at `src/App.tsx:442` and thread it through `AskAtlasPanel` to its `DraggableCard`. *Amended during implementation:* handing the ref to motion's own `dragConstraints` installs a `ResizeObserver` on the card and re-projects it on every resize (`scalePositionWithinConstraints`), which slid the panel down by its 24px bottom anchor on every grip move; measured relative bounds take the object path, which installs no observer and resolves once at drag start. *Done when:* at 390x844 and 844x390, repeated in-viewport drags in each of the four directions clamp the card to `<main>`'s edges with no residual transform on it (a single 500px drag leaves the viewport and Playwright stops delivering moves, so the probe pushes in repeated on-screen steps); and the Hunt, Postcode Inspector, and Drag Telemetry cards still drag freely, unchanged.

- [x] **Step 4 - Make the resize grip's cap honest** - add `src/lib/ask/panelLayout.ts` with the constants and a pure `clampListHeight(value, { min, max })` and `maxListHeight({ currentHeight, panelHeight, panelTop, panelMaxHeight, containerTop, viewportHeight })` helpers, and a `src/lib/ask/panelLayout.test.ts`. Give `AskAtlasResizeHandle` an optional `getMaxHeight?: () => number`; `src/components/ask/AskAtlasPanel.tsx` supplies it from the panel's rect so the cap is the current list height plus `max(0, panelTop - containerTop - PANEL_TOP_GAP)`, bounded by the panel's own fit cap and never past `0.85 * window.innerHeight`, floored at 180px (today's value). Today the cap is a flat 85% of the window, which on a 390px-tall screen is 331px while the room is only about 222px (390 minus the 24px offset minus 144px of chrome), so the top of the drag is a dead zone. *Amended during implementation:* the room is measured from the top of the map area (`<main>`), not the window, because the shell header sits above `<main>` and `<main>`'s `overflow-hidden` clips the panel; and the panel's own fit cap is a second bound, so a card dragged down a short screen cannot grow past it. *Done when:* at 1280x900 the maximum is 698px at the default geometry (the 480px list plus the 218px of room above it) and stops with `panel.top` at `main.top + 8`; at 390x844 it is 617px and stops with `panel.top` at `main.top + 8`; at 844x390 the panel already overhangs the map area, so the maximum equals the current 222px and the list does not grow; dragging down still stops at the 180px floor; and `panelLayout.test.ts` covers both helpers (below the floor, above the cap, exactly at each bound, a max below the floor, the room above the panel, the panel's fit cap, and the no-room case).

- [x] **Step 5 - Cap the panel to the map area, not the viewport** - the landscape clip Step 4 surfaced. In `src/App.tsx`, make the Ask Atlas wrapper span the map area (`top-0` in addition to `bottom-6`) with `flex items-end` so the card stays at its bottom edge, `pt-2` for the gap the grip keeps, and `pointer-events-none` so the empty band above the card does not swallow map clicks; the card in `src/components/ask/AskAtlasPanel.tsx` gains `pointer-events-auto` for its own events. Replace the `.ask-atlas-panel-fit` rule with `max-height: 100%`, which now resolves against the wrapper's content box, and measure the grip's fit cap from that same box in `AskAtlasPanel` (the wrapper's `clientHeight` less its own padding) instead of reading the computed `max-height`, which stays a `calc()` string and made the grip report no growth. *Done when:* at 844x390 the panel's top stops at `main.top + 8` (59px) with the header hit-tested inside the card and the Close button the element at its own centre; at 390x844 and 1280x900 the default geometry and the grip maxima (617 and 698) are unchanged; at 1280x900 a point inside the wrapper band above the card still hits the map rather than the wrapper; rotating portrait to landscape with a 617px list re-caps the panel inside the map area; and with a 34px bottom inset forced the card's bottom edge is still 58px above the viewport bottom.

## Files / areas

- `src/App.tsx` - the Ask Atlas wrapper's safe-area classes and its full-height geometry, and a ref on `<main>` passed to the panel.
- `src/components/ask/AskAtlasPanel.tsx` - flex column, the map-area cap, the room and fit measurements handed to the grip, the drag bounds ref.
- `src/components/ask/AskAtlasHeader.tsx`, `AskAtlasComposer.tsx`, `AskAtlasResizeHandle.tsx` - `shrink-0`; the grip also takes an optional maximum.
- `src/components/ui/DraggableCard.tsx` - optional `dragConstraintsRef`, measured into plain relative bounds for a hard clamp.
- `src/lib/ui/dragBounds.ts` (new) and `src/lib/ui/dragBounds.test.ts` (new) - the drag bounds measurement.
- `src/lib/ask/panelLayout.ts` (new) and `src/lib/ask/panelLayout.test.ts` (new) - the clamp helper and constants.
- `src/index.css` - the map-area-relative panel cap.
- `index.html` - `interactive-widget=resizes-content`.

## Testing

- Logic is tested with vitest in the node environment, matching the existing `src/lib/ask/*.test.ts` files: `panelLayout.test.ts` covers the clamp helper at and beyond each bound. There is no jsdom or component-test library in this project, so components are not unit tested.
- No browser test runner is declared in `AGENTS.md`, so none is added. UI and layout claims ride on direct browser evidence: a scratch Playwright probe in system Chrome (as in 24a, deleted before `/complete`) asserting the panel rect, the header and composer visibility, and the drag bounds at 390x844, 844x390, 768x1024, and 1280x900, plus a desktop regression check that the panel's geometry is unchanged at 1280x900. It also hit-tests the landscape header and the Close button, rotates portrait to landscape with a long list, checks that the inert wrapper does not swallow a map click, and repeats the 34px-inset case.
- The safe-area case is reproducible with Chrome's `Emulation.setSafeAreaInsetsOverride` (insets forced on a fresh browser), which is how 24a proved the inset path.
- The iOS keyboard cannot be simulated. `interactive-widget` is verifiable only in the served HTML; the real keyboard path is a manual Try on a phone.
- Verify with the project command: `npm run test && npm run lint && npm run build`.

## Verification evidence

Measured against the production preview served from the worktree's `dist`
(`vite preview --port 4174`, system Chrome), re-run at `/complete`:

- **Serve:** the served HTML carries `viewport-fit=cover` and
  `interactive-widget=resizes-content`. `npm run test` 95 passed, `npm run lint`
  (`tsc --noEmit`) clean, `npm run build` clean.
- **Desktop 1280x900 unchanged:** card 420x602 at top 274, list 480. Grip floor
  180, grip max 698 with the panel top stopping at `main.top + 8` (59) and the
  card filling the wrapper content box. A point inside the wrapper band above the
  card hits the map, not the inert wrapper.
- **Tablet 768x1024 unchanged:** card 420x608 at top 392, list 480.
- **Portrait 390x844 unchanged:** card 367x624 at top 196, list 480, grip max
  617, floor 180. The card drag clamps exactly to `main`'s four edges (top/left
  and bottom/right) with no residual scale after the drag.
- **Landscape 844x390 (the F1 fix):** card 420x307 at 59..366 (top = `main.top +
  8`), a 163px list, no taller than the 339px map area. The header is
  hit-testable inside the card and the Close button is the element at its own
  centre. The grip reports no growth (163 before and after), so there is no dead
  zone.
- **Rotate portrait to landscape with a 617px list:** the card re-caps to fit
  inside `main` (59..366).
- **34px bottom inset forced:** the card's bottom edge sits 58px above the
  viewport bottom.
- The fresh probe ran 30/30 checks green. It lives outside the repo and is
  deleted with the other scratch probes before `/complete`.

## Notes for the AI

- Follows the 24a inset rule: `.safe-*` helpers where the element has no spacing of its own on that edge, `calc()` composition where it does. The Ask Atlas wrapper is transparent, so it takes the helpers directly.
- The panel's width is deliberately unchanged. At `w-[min(94vw,420px)]` it already fills a phone (367px of 390 at portrait), so this slice is about height, insets, and bounds, not width.
- Two implementation traps for Step 1. Do not use `flex-1` on the message list: `flex: 1 1 0%` zeroes the basis and discards its inline pixel height, so use the default `flex: 0 1 auto` plus `min-h-0`. Do not add `flex flex-col` to `DraggableCard`'s own base class either, or the other three cards change layout; pass it in the panel's `className`.
- Keep the desktop presentation byte-for-byte identical: a 420px card, the same list height, the same free drag with `dragElastic` 0.08. The phone problems are height, insets, and bounds.
- Only the Ask Atlas card opts into drag constraints. Do not enable it on the other three cards; that is 24c, and it will also reconcile the coarse-pointer 44px rule.
- The drag bound is the map area (`<main>`), so the card stops at the shell header's bottom edge rather than the window's top. That is stricter than Step 3's original wording and matches the ceiling Step 4 grew into.
- The landscape clip found while verifying Steps 3 and 4 is fixed in Step 5. At 844x390 the map area is 339px and the panel's chrome is 144px, so the panel cannot fit even at the 180px list floor; Step 1's viewport-based cap left it overhanging the map top, and `<main>`'s `overflow-hidden` clipped the header (a hit test at the header's height landed on the shell header, so Close and the grip were unreachable). The cap is relative to the map area now, so landscape shows a 163px list with a reachable header instead. Two things must stay together for that: the wrapper's definite height, without which the card's percentage resolves to `none`, and the wrapper's `pt-2`, which is the gap `PANEL_TOP_GAP` names. The grip's fit cap is measured from the wrapper's content box rather than from the card's computed `max-height`, so it can never report growth the panel cannot take. Where the fit cap and the 180px floor disagree (short landscape), fitting wins: a list below the floor is still usable, a clipped header is not.
- Do not go back to a viewport-based cap. `100dvh` and `100vh` measure the whole window, including the shell header that clips the panel, which is exactly the bug Step 5 fixed; the card's percentage needs the Ask Atlas wrapper to keep its `top-0 bottom-6` geometry.
- Residual: if the viewport shrinks after a drag (for example rotating while the panel sits high), the card can end up outside the new viewport until the next drag pulls it back inside. Noting it is enough; a resize re-clamp can ride with 24c's overlay bounds work.
- `interactive-widget=resizes-content` is Chrome-only. Do not build iOS keyboard workarounds here; note the residual risk and verify on a real device.
- No em dashes, en dashes, or the ellipsis character in code comments, copy, or docs. Use hyphens.
- Follow the existing file conventions: SPDX header comment, JSDoc on exported members, plain-English comments explaining why.
