# Fix: Desktop header hides the primary actions behind a burger menu

**Type:** Fix
**Status:** verified
**Branch:** `fix/desktop-action-nav`
**Completed:** 2026-10-12

## Problem

On every viewport wider than a phone, the header showed the hamburger (Actions)
button, so the primary actions were only reachable by opening it. The five items
were `States`, `Assemble`, `Surprise me`, `Hunt`, and `About`.

Cause: in `src/components/navigation/TopBar.tsx` the Actions button had no
responsive visibility class, so it rendered at every width. Only the panels it
opened were gated: the bottom sheet was `md:hidden` (phones) and the dropdown
`hidden md:block` (tablet and up). Measured live before the fix: the burger
rendered at 768, 1024, 1280, and 1440.

Review feedback after the first pass: `About` is not a place action, so it should
not sit in the primary nav. It belongs with the version, and the version should
not show as a badge in the bar.

## The fix

- Desktop (`lg` and up): render the four place actions inline as icon + label
  buttons (`States`, `Assemble`, `Surprise me`, `Hunt`), and hide the burger.
- `md` and up: one meta menu at the far right, replacing the visible `v1.1.0`
  badge. It holds `About` and the version / release notes together. The version
  text no longer shows in the bar.
- `md`..`lg` (tablet): the burger dropdown shows the four place actions; `About`
  and the version live in the meta menu.
- `< md` (phone): the bottom sheet still lists all five actions and keeps its
  version / release notes footer.
- The tablet dropdown is scoped to `hidden md:block lg:hidden`, and opening one
  menu closes the other.

One source of truth: `primaryActions` (four) plus `aboutAction` compose `actions`
(five), so the phone sheet keeps `About` while desktop and tablet get it from the
meta menu. No action handlers changed.

Breakpoints now:

| Width | Actions | About + version |
|---|---|---|
| `< md` (phone) | Burger -> bottom sheet, all five | Sheet footer (version + release notes) |
| `md`..`lg` (tablet) | Burger -> dropdown, four place actions | Meta menu |
| `lg+` (desktop, 1024px+) | Four inline icon + label buttons | Meta menu |

## Build steps

- [x] **1. Inline desktop action nav.** Added the `hidden lg:flex` nav, hid the
  burger at `lg+`, and scoped the dropdown to `md` only.
- [x] **2. Verify fit and behavior.** Checked every breakpoint in a real browser.
- [x] **3. Group About with the version.** Split the list into `primaryActions`
  and `aboutAction`; replaced the version badge with a `md+` meta menu holding
  `About` and the version / release notes, with Escape and click-outside close.
  *Done when:* the desktop nav drops `About`, the meta menu opens both entries,
  and the phone sheet still reaches every action.

## Files / areas

- `src/components/navigation/TopBar.tsx` - the inline desktop nav, the meta menu
  for About and the version, the `lg:hidden` burger, and the `lg`-scoped dropdown.

## Verify

- `npm run test && npm run lint && npm run build`.
- Browser at 1440, 1280, 1024: burger absent, the four place actions visible, the
  meta menu present, no `v1.1.0` text in the bar, no horizontal scroll.
- Browser at 768: burger dropdown shows the four place actions; the meta menu
  holds `About` and the version.
- Browser at 390: bottom sheet lists all five actions.

## Evidence

`npm run test && npm run lint && npm run build` -> 10 files / 76 tests passed,
`tsc --noEmit` clean, `vite build` clean (only pre-existing config-loader and
chunk-size warnings).

Browser sweep against the dev server on `:3001`:

| Viewport | Overflow | Inline nav | Burger | Meta | Version text in bar |
|---|---|---|---|---|---|
| 390 (phone) | 0 | hidden | shown | hidden | no |
| 768 (tablet) | 0 | hidden | shown | shown | no |
| 1024 | 0 | States, Assemble, Surprise me, Hunt | hidden | shown | no |
| 1280 | 0 | States, Assemble, Surprise me, Hunt | hidden | shown | no |
| 1440 | 0 | States, Assemble, Surprise me, Hunt | hidden | shown | no |

Behavior:

- Meta menu items: `About Postcode Atlas`, `Release notes`.
- `About` opened the story modal; `Release notes` opened the changelog dialog.
- Escape closed the meta menu.
- Tablet burger dropdown: `States`, `Assemble`, `Surprise me`, `Hunt` (About moved
  to the meta menu); the phone sheet was not visible on tablet.
- Phone sheet: `States`, `Assemble`, `Surprise me`, `Hunt`, `About`.

## Known limitations / follow-ups

- At exactly 1024px the inline nav takes about 424px and the left zone keeps
  about 305px, so on deep navigation the breadcrumbs truncate as before. Nothing
  overflows at any tested width.
- This is a presentational change with no new logic, and the project has no
  component test runner, so it rides on browser evidence rather than a new unit
  test.
