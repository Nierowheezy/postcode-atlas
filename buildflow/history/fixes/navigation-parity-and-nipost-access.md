# Fix: phone layout, desktop menu parity, and NIPOST gateway access

## Type

Fix (not a build-plan item).

## Status

verified

## Why now

A read-only audit of the phone layout found one concrete clipping bug. Reviewing
that work then surfaced three more defects: desktop had lost its action menus, the
States drawer covered the whole phone screen, and every NIPOST call was failing, so
the LGA list was empty. All four are bounded, measured defects, so they run as one
fix rather than as build-plan features.

Later work (multilingual input, voice-to-text) is separate and comes after this.

## Part 1 (done): the phone header clipped past the right edge

Clipped elements are elements outside the Leaflet panes whose right edge passes the
viewport (Playwright, `body` has `overflow: hidden`, so they were unreachable):

| Viewport | Clipped elements |
| --- | --- |
| 360 x 640 (small Android) | 35 |
| 390 x 844 (iPhone 14) | 24 |
| 430 x 932 (iPhone Pro Max) | 11 |
| 768 x 1024 and wider | 0 |

Cause: `src/index.css` forced the version badge and theme toggle to
`display: flex !important` below 768px, which beat their own `hidden md:flex` and
`hidden sm:flex` classes, so a phone header tried to fit six clusters. Separately,
`index.html` set `user-scalable=no, maximum-scale=1.0`, which blocked pinch-zoom.

Fix, shipped in this branch:

- Deleted the two `!important` blocks. The badge and toggle now hide on phones and
  stay reachable from the actions menu.
- The viewport meta is now `width=device-width, initial-scale=1.0`.
- Dropped the two now-dead class names from `TopBar.tsx`.

Verified: 0 clipped elements at 360, 390, 430, and 844 x 390; header right edge
equals the viewport; every header control is 44px or taller under a coarse pointer;
the menu still exposes version and theme.

## Part 2 (done): desktop lost the action menus

Commit `4cab753` ("PWA: add manifest, service worker, mobile TopBar, animations")
rewrote the top bar mobile-first. It moved States, Assemble, Surprise me, Hunt, and
About into a `mobileActions` list rendered only inside the phone bottom sheet, and
`.mobile-hamburger` is `display: none` at 768px and up. So desktop has no way to
reach any of the five, while a phone can reach all of them. Version and theme are
fine on both (desktop header, phone menu).

Fix, shipped in this branch: one `actions` list feeds both layouts. A phone keeps
the bottom sheet; desktop gets a dropdown from the same button. Both render the same
five items, so the two layouts cannot drift again.

Verified at 1440 and 390: the same five actions appear and open; the phone sheet and
the desktop dropdown never show at the same time; Escape and the click-catcher close
the menu; version and theme stay reachable from the sheet.

## Part 3 (done): the States drawer covers the whole phone screen

`StateExplorerDrawer` is `w-full sm:w-88 md:w-96`, so on a phone it is 100% wide, and
its `fixed inset-0 ... backdrop-blur-xs` backdrop blurs and dims the whole map.

| Viewport | Drawer width | Map visible |
| --- | --- | --- |
| 390 phone | 390 (100%) | no |
| 1440 desktop | 384 (27%) | yes |

`PostcodeAssemblyDrawer` uses the same `w-full` plus `backdrop-blur-xs` pattern.

Fix, shipped in this branch: on phones both drawers are partial-width sheets (85%
wide, capped) over a light scrim with no blur, so a strip of map stays visible. On
desktop both keep their panel width and simply lose the blur.

Verified: at 390 the States drawer is 332 px (85%) with 59 px of map visible and
`backdrop-filter: none`; at 1440 it is still 384 px (27%).

## Part 4 (done): every NIPOST call fails, so LGAs are empty

The publishable key is locked to origins that are not ours:

| Call | Result |
| --- | --- |
| `/v1/reference/lgas?state=LA`, no Origin | HTTP 200, real LGA list |
| same, `Origin: http://localhost:3001` | HTTP 403 `origin_not_allowed` |
| same, `Origin: https://nigerian-postalcode-atlas.vercel.app` | HTTP 403 `origin_not_allowed` |
| same, the ngrok domain | HTTP 403 `origin_not_allowed` |

So every browser call fails (LGAs, autocomplete, lookup, reverse geocode, districts,
areas), and the app degrades quietly to "No LGAs found". Reproduced on the live
production site as well: the LGA list is empty in prod, not only locally. The key
only works server-side, where there is no `Origin` header.

Fix (chosen by the user): route NIPOST through our own server. A new `/api/nipost/*`
handler is shared by a Vite dev middleware and a Vercel Function, mirroring the
existing `/api/ask` pattern. The key moves to a server-only variable and leaves the
bundle. The handler forwards only the NDAPS paths this app uses, so it cannot be used
as an open proxy.

Fix, shipped in this branch: a shared handler at `src/server/nipost/handler.ts`
forwards only the NDAPS paths the app calls. It runs as Vite dev middleware
(`/api/nipost`) and as a Vercel Function (`api/nipost/[...path].ts`). The client
calls `/api/nipost`, and the key moved from `VITE_NIPOST_PUBLISHABLE_KEY` to the
server-only `NIPOST_PUBLISHABLE_KEY`.

Verified: the States drawer lists real Lagos LGAs (for example Agege) at 390 and at
1440; `curl` on `/api/nipost/v1/reference/lgas?state=LA` returns HTTP 200 with
`data.lgas`; the built bundle holds no real key (the only `nipost_pk_` text is the
old changelog copy the release-notes modal renders).

Known limitation, out of scope: `/v1/lookup` with this key returns
`level_not_granted` (granted up to level 1 only). That is a NIPOST account setting,
not a code defect, and is noted so it is not mistaken for a regression.

## Build steps

- [x] **Part 1, header fits on phones.** Removed the two `!important` blocks in
  `src/index.css`; the `index.html` viewport meta is now
  `width=device-width, initial-scale=1.0`. Done when no element outside the Leaflet
  panes passes the viewport at 360, 390, 430, or 844 x 390 and the menu still exposes
  version and theme.
- [x] **Part 1, touch targets hold.** Re-measured with the coarse pointer rule: no
  overflow at 360/390/430/700, and every header control is 44px or taller. Done when
  no control needs changing.
- [x] **Part 2, desktop actions reachable.** Make the actions menu available at every
  width: bottom sheet on phones, dropdown on desktop, one shared list. Done when
  States, Assemble, Surprise me, Hunt, and About are each reachable at 390 and at
  1440, and the year-long shortcut path is unchanged.
- [x] **Part 3, drawer keeps the map visible.** Phone width 85% plus a light scrim
  with no blur on both drawers. Done when the States and Assembly drawers at 390
  leave map pixels visible and the map is not blurred, and the desktop panel width is
  unchanged.
- [x] **Part 3 tests.** No new unit test: this is layout only.
- [x] **Part 4, NIPOST proxy.** Add `src/server/nipost/handler.ts`, mount it as Vite
  middleware, add the Vercel Function, and point the client at `/api/nipost`. Done
  when the States drawer lists real Lagos LGAs in the running app and the key is no
  longer in the bundle.
- [x] **Part 4, guard test.** Add `src/server/nipost/handler.test.ts` covering the
  path allowlist. Done when `npm run test` passes with the new cases.
- [x] **Part 4, env and docs follow the rename.** `NIPOST_PUBLISHABLE_KEY` and
  `NIPOST_API_BASE_URL` replace the `VITE_` pair in `.env.example`, the README, the
  architecture doc, and `scripts/build-atlas-dataset.mjs`.

## Verify

Automated, in the repo root:

```bash
npm run test && npm run lint && npm run build
```

Browser (dev server on `:3001`):

1. At 1440, open the menu button: States, Assemble, Surprise me, Hunt, and About all
  appear and open.
- At 390, open the same menu: the same five appear in the bottom sheet.
- At 390, open States: the drawer is partial width, the map is visible and not
  blurred, and clicking Lagos lists the real LGAs.

Automated, no browser:

```bash
curl -s "http://localhost:3001/api/nipost/v1/reference/lgas?state=LA" | head -c 200
```

Done when it returns `data.lgas` with real names, and grep of the built bundle finds
no `nipost_pk_`.

## Must not break

- The Ask Atlas flow and the `/api/ask` middleware.
- Mobile drawer contents (States list, LGAs, Assembly steps).
- Map interaction, including click-outside and Escape closing menus.
- The existing test suite.

## Risks

- The proxy needs `NIPOST_PUBLISHABLE_KEY` in the Vercel environment before the fix
  reaches production; the VITE_ variants should be removed there.
- Hiding the theme toggle from the phone header keeps it one tap deeper (in the
  menu). Acceptable, since the menu already owns mobile actions.
- Enabling pinch-zoom may expose other layout rough edges under zoom. That is
  expected and preferable to a zoom-locked page.
