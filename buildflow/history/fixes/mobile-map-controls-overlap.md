# Fix: Overlapping bottom map controls on phones

**Type:** Fix
**Status:** verified
**Branch:** `fix/mobile-map-controls-overlap`
**Completed:** 2026-10-12

## The problem

On phones, the bottom-left **Center + scale control**
(`src/components/map/ScaleCenterControl.tsx`) and the bottom-right **lat/lng
telemetry HUD** inside the right-hand control stack
(`src/components/map/AtlasMap.tsx`, the `bottom-3 right-3` div) are pinned to the
same bottom row and run into each other. The HUD ("`9.0820° N, 8.6753° E | Cartographic Base | Z: 6.0`")
is ~330px wide, so on a narrow phone it sweeps left across the whole bottom edge
and lands on top of the 185px Center + scale capsule.

Measured geometry (read-only Playwright probe, dev server on `:3001`, same
bottom row, viewport height 800):

| Viewport | Center + scale (x → right) | lat/lng HUD (x → right) | Overlap |
| --- | --- | --- | --- |
| 320 | 12 → 197 | 0 → 308 | 185 × 32 px |
| 360 | 12 → 197 | 18 → 348 | 179 × 29 px |
| 390 | 12 → 197 | 48 → 378 | 149 × 29 px |
| 430 | 12 → 197 | 88 → 418 | 109 × 29 px |
| 768 / 1440 | 12 → 197 | right edge minus 330 | none |

At ≤ 360px the two capsules occupy the same vertical band (`y ≈ 776–808`) and
fully overlap. The HUD was also wider than the viewport at 320px, so its text
clipped at the left edge.

Reported by the user: "on mobile the center and the controls on the right are
almost overlapping the control that shows the long and lat."

## The fix

Reduce the two bottom capsules to their essential mobile content below the `sm`
breakpoint (640px), so both fit on one row with a comfortable gap. Nothing moves
and desktop/tablet is unchanged.

- **`src/components/map/AtlasMap.tsx`** (HUD): kept the live coordinates on
  phones; hid the provider name and zoom-level segments and their separators with
  `hidden sm:inline`. The HUD is now a compact coordinates pill (~150px) on
  phones.
- **`src/components/map/ScaleCenterControl.tsx`** (return): wrapped the divider +
  scale bar in a `hidden sm:flex` wrapper so phones show only the **Center**
  button. The scale bar is a proximity aid, not essential on a phone, and mobile
  map apps routinely omit it.

Must not break, and did not:
- The lat/lng readout stays visible on every width.
- The HUD still updates on cursor move and still shows provider name and zoom at
  `sm` and above.
- The scale bar still renders and updates at `sm` and above.
- The "Center map on Nigeria" button, its `aria-label`, and `onCenterClick` are
  untouched.

## Build steps

1. **Trim the two bottom capsules on phones.**
   - Added `hidden sm:inline` to the provider-name span, the zoom `Z:` span, and
     their two `|` separators in the HUD.
   - Wrapped the divider div and the scale-bar block in `ScaleCenterControl` in a
     `hidden sm:flex items-center gap-2.5` container.
   - Kept the Center button and the coordinates visible at all widths.
   - [x] **Done.** Phone gap (HUD.x − capsule.right): 65px @320, 105px @360,
     135px @390, 175px @430; capsule 81px wide (Center only), HUD 150px wide
     (coords only). At 768/1440 the capsule is 185px with the scale bar
     (`display: flex`) and the HUD is 330px. Provider/`Z` spans are
     `display: none` ≤ 430 and visible at ≥ 768. HUD coords still update on
     cursor move (`9.0820° → 11.7598°` at 390). Center button clicks cleanly.

## Verify

- `npm run test && npm run lint && npm run build` — 43 tests / 6 files pass,
  `tsc --noEmit` clean, Vite build clean.
- Geometry probe at 320, 360, 390, 430, 768, 1440: the Center capsule's right
  edge stayed left of the HUD's left edge with a positive gap at every phone
  width, both inside the viewport; at ≥ 768 the HUD still shows the provider name
  and `Z:` value and the left capsule still shows the scale bar.
- Behavioral spot-check at 390: HUD coords update on cursor move; the Center
  button clicks cleanly and recenters.

## Known follow-up

- The Leaflet attribution (`© OpenStreetMap contributors`) still tucks ~5px under
  the HUD's bottom edge at the very bottom-right. Pre-existing, unchanged in
  kind, and not user-visible behind the HUD's 95% background. Left out of scope
  deliberately.
