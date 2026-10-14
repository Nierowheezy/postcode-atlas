# Feature: Overlay bounds and touch targets

**From build-plan:** feature 24c

**Status:** verified

## Goal

Two loose ends from the phone work (24a, 24b), in one slice.

First, overlay bounds. Only the Ask Atlas card is clamped to the map area today; the other three floating cards can still be dragged completely off screen:

- the Postcode Hunt objective bar (`src/App.tsx:551`)
- the Postcode Inspector (`src/App.tsx:597`)
- the Drag Telemetry HUD (`src/App.tsx:618`)

The clamp mechanism already exists (`dragConstraintsRef` on `src/components/ui/DraggableCard.tsx`), so this is mostly opting them in. It also carries 24b's recorded residual: a clamped card can be stranded outside the map area if the map area shrinks after a drag, because the bounds are re-measured but the current offset is not re-clamped.

Second, touch targets. `src/index.css:209` forces `min-width/min-height: 44px` on every `button`, `[role="button"]`, and `a[href]` under `(pointer: coarse)`. That is a real accessibility gain, but it is delivered by inflating the control's painted box, so compact controls break their own layout on touch. Measured with system Chrome against the dev server, coarse pointer vs fine pointer at the same viewport (390x844 unless noted; the fine column is the right control because the 16px select rule keys off viewport width, not pointer):

| Control | Fine pointer | Coarse pointer |
| --- | --- | --- |
| Ask Atlas header (whole bar) | 50px | 65px |
| Ask header clear / close button | 26x26 | 44x44 |
| Composer send button | 36x36 | 44x44 |
| Zoom in/out/layer/fullscreen button | 32x32 | 44x44 |
| Map search bar (whole pill) | 38px | 62px |
| Map search locate button | 20x20 | 44x44 |
| Reply-language chip, 390 wide | 54x21 | 66x30 |
| Reply-language chip, 1024 wide | 54x21 | 54x21 (rule never matches it) |

So the phone Ask header is 15px taller than it needs to be (eating conversation height that 24b fought for), the map control stack grows 48px taller, the search pill grows 24px taller, and inline text actions inside chat bubbles and the Hunt bar each become a 44px row. Meanwhile the controls the blanket rule never matched stay small: the reply-language chip is a 21px target on a coarse tablet, and the floating cards' drag bars are about 26px.

This slice reconciles the rule: compact controls keep their designed size, their touch target still reaches at least 44x44 through a hit-area expansion, and the controls the blanket rule missed get a target too.

## Design reference

No mockup. This is a correctness and accessibility fix with observable criteria: every in-scope control keeps its fine-pointer painted box on touch, every in-scope target measures at least 44x44 of effective hit area, adjacent targets do not overlap, and the floating cards cannot leave the map area. Intent lives in `buildflow/project-plan.md` section 7 (Responsive design, Accessibility) and `buildflow/build-plan.md` item 24c.

## In scope

- **Card bounds.** The Hunt, Postcode Inspector, and Telemetry cards opt into the existing `dragConstraintsRef` clamp against `<main>`, matching the Ask Atlas card.
- **Resize re-clamp.** A clamped card whose current offset no longer fits after the map area resizes (rotation, header height change, keyboard resize) is pulled back inside, without re-projecting on every content resize (the 24b trap).
- **A compact-target mechanism.** A documented, opt-in utility that gives a control a 44x44 hit area without changing its painted box, plus a spacing helper so neighbouring expanded targets in a dense cluster do not overlap.
- **Apply it wherever the 44px box distorts a compact container:** the Ask Atlas panel chrome (reply-language chip, clear, close, composer send, message-bubble action buttons), the map control stack (zoom in/out, layer, fullscreen), the map search pill (locate, and clear while typing), the Hunt bar's Details and cancel controls, and the Inspector's save, close, and Center controls.
- **Extend coverage to the reply-language chip**, which the blanket rule never matched.
- **Make the floating cards' drag bar a full target** under a coarse pointer, since the bar is the card's only drag affordance and is about 26px tall.

## Out of scope

- **Overlay to overlay.** 24b's out-of-scope note assigned "the panel overlapping the bottom-right map controls on phones" to 24c. Deferred again, flagged for your call. The Ask Atlas panel is bottom-right anchored by design and covers the bottom-right map stack whenever it is open, on desktop as well as phones; resolving it means either hiding the map controls while the panel is open or reflowing them, both bigger product decisions than "constrain the cards and fix touch targets". Once the cards are bounded, a user can always drag the panel off the control. If you want it in this slice, say so and I will add a step rather than guess a behaviour.
- **Full-page chrome** (TopBar, drawers, modals, toast, update banner). Their 44px boxes already fit their containers, so the blanket rule stays the default there and no churn is added. The new utility is available if a later slice wants it.
- **Primary action buttons that have room** (for example the Inspector's Copy postcode grid, dialog actions). Their 44px box does not break a compact row, so they stay on the blanket rule.
- Phone presentation for the drawers, modals, and clear dialogs. That is 24d.
- Any change to fine-pointer rendering. The target is that a coarse pointer paints the same controls as a fine pointer at the same viewport, plus a larger hit area.
- iOS Safari keyboard behaviour and `interactive-widget` (24b), and the TopBar tablet-band bug.

## Data / contracts

No type, route, API, or stored-shape change. One new internal pure helper, `clampOffset(bounds, offset)` in `src/lib/ui/dragBounds.ts`, and a small family of CSS utility classes in `src/index.css`'s coarse-pointer block, all built around the same `.touch-target` hit-area overlay: `.touch-target` (cancel the blanket 44px and paint a centred `max(100%, 44px)` overlay), `.touch-spaced` (cluster gap, `var(--touch-gap, 1.5rem)`), `.touch-divider` (the same gap before a divided cluster whose wrapper sets `margin-left`, not `gap`), `.touch-column` (compact `--touch-gap: 0.75rem` plus `overflow: visible`), `.touch-column-divider` (hide the zoom column's now-redundant 1px dividers), `.touch-bar` (a 44px minimum drag-bar height, a real height rather than an overlay because the card root clips its own overflow), and `.touch-edge-room` (trade gap for trailing padding on a cluster whose last control sits against that clipped edge, so its centred overlay fits). None leave the UI.

## Build loop

Small steps, each reviewed before the next. `/implement` ticks the steps off here as it finishes them, so a fresh session resumes from the first unchecked one.

## Build steps

- [x] **Step 1 - Bound the three floating cards to the map area** - in `src/App.tsx`, pass the existing `mainRef` as `dragConstraintsRef` to the `DraggableCard`s for the Hunt objective bar (line 551), the Postcode Inspector (line 597), and the Drag Telemetry HUD (line 618). No new mechanism; the Ask Atlas card already works this way. *Done when:* at 390x844 and 1280x900, dragging each of the three cards hard toward each edge (in repeated on-screen steps, since one long drag would leave the viewport) clamps it inside `<main>`'s rect with no residual transform, each card is still fully visible after a drag to a corner, and the Ask Atlas card's behaviour is unchanged.

- [x] **Step 2 - Re-clamp a clamped card when the map area resizes** - add `clampOffset(bounds, offset)` to `src/lib/ui/dragBounds.ts`: clamp each axis into the range spanned by the two bound values, treating them as an unordered pair so a card larger than the container pins to one edge instead of flicking out. Cover it in `dragBounds.test.ts` (inside, at, and beyond each bound; the inverted case). In `src/components/ui/DraggableCard.tsx`, add a second `ResizeObserver` that watches only the constraint container and, when a drag is not in flight, re-measures and sets the motion values to `clampOffset(...)`. Observe the container, never the card: re-clamping on the card's own resize is exactly the 24b trap where the grip pulls the panel down as it grows. Guard with a ref flipped by `onDragStart`/`onDragEnd`, and hold a resize that lands mid-drag in a pending ref applied on `onDragEnd`, so the gesture is never interrupted and a card cannot settle outside an area that shrank while it was being moved. Leave the existing card-plus-container observer as it is, so waiting bounds and the drag behaviour are unchanged. *Done when:* at 390x844 a card dragged against an edge is pulled fully back inside after the map area shrinks; rotating portrait to landscape with a card near an edge leaves it inside; growing the Ask Atlas panel with its grip still does not move the card; a drag in flight when a resize fires is not interrupted and its card is inside the new bounds once the gesture ends; and `dragBounds.test.ts` passes.

- [x] **Step 3 - Compact targets in the Ask Atlas panel** - in `src/index.css`, after the blanket block at line 209 (so it wins the cascade), add an unlayered `@media (pointer: coarse)` block: `.touch-target` cancels the blanket `min-width/min-height` and sets `position: relative`; `.touch-target::after` paints a centred transparent overlay of `max(100%, 44px)` in both axes; `.touch-spaced` sets the cluster gap to `var(--touch-gap, 1.5rem)`. Qualify the opt-out selectors (`button.touch-target`, `a.touch-target`, `[role="button"].touch-target`, plain `.touch-target`) because `a[href]` outranks a bare class. Apply `touch-target` to the reply-language chip, the clear button, and the close button in `src/components/ask/AskAtlasHeader.tsx`; the composer send button in `AskAtlasComposer.tsx`; and the `[View on map]` and `[Save]` buttons in `AskAtlasMessageBubble.tsx`. The reply-language chip's control is a native `<select>`, a replaced element whose `::after` paints no box, and an overlay on the wrapper would swallow the tap before the select sees it, so the wrapper carries `touch-target` and forwards a tap that lands on the overlay (the wrapper itself, not the select) to `select.showPicker()`, guarded by `event.target !== event.currentTarget` so a tap on the select itself is not double-handled. Apply `touch-spaced` to the header controls row (`gap-1` today) so the expanded targets stay clear of each other instead of overlapping. *Done when:* under coarse-pointer emulation at 390x844 the Ask header is 50px tall (down from 65) and the clear/close boxes are 26x26 (down from 44x44), while every in-scope control measures at least 44x44 of hit area; the reply-language chip reaches 44px of hit height; the message list gains the recovered pixels; a probe that hit-tests each control's painted centre shows it engages its own control, and no adjacent expanded target overlaps a neighbour's painted centre (the 24px default gap leaves a small deliberate dead strip between the 26px icons, which is a safe outcome, not a miss); and the fine-pointer rendering at the same viewport is unchanged.

- [x] **Step 4 - Compact targets in the map controls and search** - apply `touch-target` to the four `CustomZoomControl` buttons (`src/components/map/CustomZoomControl.tsx`) and `touch-column` (compact `--touch-gap: 0.75rem` plus `overflow: visible`) to its column, so the 32px controls keep a 44px pitch. The column is `overflow-hidden` and holds non-semantic 1px divider divs, so the coarse state must also stop clipping the end targets and drop the now-redundant dividers, which `touch-column-divider` hides. Apply `touch-target` to the search pill's `Find my location` and `Clear input` buttons (`src/components/search/MapSearch.tsx`), and `touch-divider` to the locate wrapper (a `border-l` cluster that sets `margin-left`, not `gap`) so the two expanded targets do not overlap. *Done when:* under coarse-pointer emulation each zoom button paints 32x32 (down from 44x44) with an unclipped 44x44 hit area and no overlap between adjacent vertical targets, the search pill paints 38px tall with clear and locate hit areas of at least 44x44, and every button still performs its action.

- [x] **Step 5 - Compact targets in the floating cards** - apply `touch-target` to the Hunt bar's Details and cancel controls (`src/App.tsx:560`, `:566`), `touch-spaced` to that row (`gap-2.5` today), and `touch-edge-room` too, because the cancel is the row's last control and the card root's rounded `overflow-hidden` clips about 4px off a centred 44px overlay that reaches past the row's trailing padding. Apply `touch-target` plus `touch-spaced` to the Inspector's save and close icons and its Center control (`src/components/postcode/PostcodeInspector.tsx:105`, `:120`, `:189`), whose row is `gap-0.5` today. In `src/components/ui/DraggableCard.tsx`, give the built-in drag bar a 44px minimum height under a coarse pointer through `touch-bar`, a real height rather than an overlay because the card root clips its own overflow. *Done when:* under coarse-pointer emulation the Hunt bar and the Inspector header return to their fine-pointer heights, each in-scope control keeps its fine-pointer painted box with at least a 44x44 hit area (including the Hunt cancel, which needs the trailing room) and no adjacent overlap, the drag bar is at least 44px tall and still drags the card, and the fine-pointer rendering is unchanged.

## Files / areas

- `src/App.tsx` - the three card `dragConstraintsRef` props; the Hunt bar's inline controls.
- `src/components/ui/DraggableCard.tsx` - container-only resize re-clamp listener and drag-in-flight guard; drag bar coarse height.
- `src/lib/ui/dragBounds.ts` and `dragBounds.test.ts` - `clampOffset` plus tests.
- `src/index.css` - the coarse-pointer `touch-*` helper family and the comment explaining the opt-out next to the blanket rule.
- `src/components/ask/AskAtlasHeader.tsx`, `AskAtlasComposer.tsx`, `AskAtlasMessageBubble.tsx` - panel chrome targets.
- `src/components/map/CustomZoomControl.tsx` and `src/components/search/MapSearch.tsx` - map control and search targets.
- `src/components/postcode/PostcodeInspector.tsx` - inspector compact targets.

## Testing

- Logic gets vitest, node environment, next to the source: `dragBounds.test.ts` covers `clampOffset` at, inside, and beyond each bound, and the inverted case. There is no jsdom or component-test library, so components are not unit tested.
- `AGENTS.md` declares no `Browser tests` command, so none is added. The CSS and layout claims ride on direct browser evidence: a scratch Playwright probe in system Chrome (as 24a and 24b used, deleted before `/complete`) that, at 390x844 and 1024x768, measures each in-scope control's painted box and effective hit area in a fine-pointer context and a coarse-pointer context, hit-tests control centres and the adjacent expanded regions for overlap and for reaching past each painted edge, and drives the drag bounds, the container-shrink re-clamp, and the rotate and mid-drag resize cases. The fine-pointer run at the same viewport is the baseline; reuse the golden numbers in this spec (Ask header 50, clear/close 26, zoom 32, composer send 36, search pill 38).
- The probe asserts the fine-pointer rendering is unchanged, so this is a coarse-pointer-only change.
- Verify with the project command: `npm run test && npm run lint && npm run build`.

## Notes for the AI

- The help comment should sit with the rule it changes, so the next reader sees why the blanket 44px box remains the default for the rest of the app.
- The opt-out must come after the blanket block and be element-qualified, because `a[href]` has higher specificity than a bare class. Confirm the painted size in the probe rather than trusting the cascade.
- Spacing rule: for two adjacent controls of painted size s1 and s2, the centred overlays overlap when the gap is under `max(0, (44 - s1) / 2) + max(0, (44 - s2) / 2)`. Smallest cases in scope are the 24px Inspector icons (20px needed) and the 32px zoom buttons (12px), hence the `1.5rem` default and the `0.75rem` override. Verify with the probe rather than by eye.
- An expanded target is silent when an ancestor clips it. The zoom column is `overflow-hidden` and the `DraggableCard` root is `overflow-hidden` too, so confirm the measured hit area rather than trusting the CSS. This is also why the drag bar uses a real minimum height rather than an overlay. A cluster whose last control sits against that clipped edge needs trailing room (`.touch-edge-room`), traded against the gap so the cluster keeps its width: without it the Hunt cancel's centred overlay measures about 40px wide, not 44.
- Starting a Hunt shows a `z-50` toast pinned to the top centre for a few seconds that covers the Hunt bar's drag strip at 390x844 (the strip is at y 67 to 111, the toast at y 56 to 118). Wait for it to clear before measuring or dragging that card, or a drag will land on the toast.
- `.touch-target::after` is a transparent overlay inside the control, so events bubble to the control. Do not combine it with a Tailwind `after:` utility on the same element, and do not put it on a control whose own `overflow-hidden` would clip it.
- Keep the 24b traps in mind while touching `DraggableCard`: bounds are handed to motion as a plain object (not a ref) to avoid resize re-projection, and the Ask Atlas grip relies on the card's own content resize not moving it. The new re-clamp is a separate, container-only, drag-guarded path.
- Tailwind 4.3.3 is in use and its `pointer-coarse:` variant is an option for the one-off rules (the zoom overflow and dividers), but it is unused in this codebase today, so either confirm it compiles in the built CSS or keep those rules in the same CSS block. Do not guess.
- The blanket rule's `min-width` is currently what stops mis-taps between adjacent compact controls, so spacing is not optional in this slice: an expanded target that overlaps a neighbour's painted centre is a regression, not a win.
- The 24b measurements in `buildflow/history/features/24b-ask-atlas-on-phones.md` (chrome 122/144, grip maxima 617/698) become the "before"; if the header shrinks by 15px, note the new numbers in the completion archive rather than editing the 24b archive.
- No em dashes, en dashes, or the ellipsis character in code comments, copy, or docs. Use hyphens.
- Follow the existing file conventions: SPDX header comment, JSDoc on exported members, plain-English comments explaining why.
