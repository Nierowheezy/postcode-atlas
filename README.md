# Postcode Atlas

An interactive cartographic explorer for Nigeria's **National Digital Alphanumeric Postcode System (NDAPS)** — the 11-character digital addressing standard run by the Nigerian Postal Service (NIPOST).

Instead of a postcode as an opaque string, NDAPS encodes a full administrative hierarchy into every address in the country. Postcode Atlas makes that hierarchy visible: you can browse it on a map, drill into it segment by segment, reverse-geocode your own GPS position into it, and play with it as a puzzle.

---

## Table of Contents

- [What the app does](#what-the-app-does)
- [The NDAPS postcode format](#the-ndaps-postcode-format)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Deployment to Vercel](#deployment-to-vercel)
- [Architecture notes](#architecture-notes)
- [Security notes](#security-notes)
- [Scripts](#scripts)
- [License](#license)

---

## What the app does

Postcode Atlas is a single-page React application backed by the official NIPOST NDAPS API at `api.postcode.gov.ng`. It has four jobs:

**Explore.** An interactive Leaflet map of Nigeria with all 37 states and the Federal Capital Territory. Selecting a state flies the camera to its centroid and reports its LGA count and geopolitical zone. From there you can drill into Local Government Areas.

**Decode.** Enter any 11-character postcode and the app resolves it against the NDAPS gateway, then breaks it into its five constituent segments — state, LGA, district, area, and unit — showing you what each one means. There is also an assembly tool that works in reverse, letting you build a valid postcode segment by segment.

**Locate.** Grant geolocation permission and the app reverse-geocodes your coordinates to the nearest NDAPS unit, reporting the distance to it. There is also manual "search nearby" for any coordinate you tap on the map.

**Play.** A "Postcode Hunt" mode gives you a target postcode and a vague geographic hint; you have to navigate the map and find the exact location. It is a small gamification layer over the dataset.

There is also a **Data mode** that overlays a telemetry HUD showing live viewport statistics, and a **"Surprise me"** action that jumps the map to one of six landmark postcodes verified against the real API.

---

## The NDAPS postcode format

Every NDAPS postcode follows the template `AA-99-H77-BB-55`, where each segment is a discrete level of the administrative hierarchy:

| Segment | Example | Level | Meaning |
| --- | --- | --- | --- |
| 1 | `LA` | State | Two-letter code for the state or FCT (`LA` Lagos, `FC` Abuja) |
| 2 | `11` | LGA | Two-digit Local Government Area code within the state |
| 3 | `A12` | District | Postal District, three characters |
| 4 | `AK` | Area | Postal Code Area, two letters |
| 5 | `08` | Unit | The specific delivery unit, usually a street-level segment |

A full example: **`LA-11-A12-AK-08`** resolves to Ikeja LGA in Lagos State — specifically unit 08 of area AK in district A12. Each level is discoverable through the API's reference endpoints, which is what powers the cascading State → LGA → District → Area pickers in the UI.

---

## Features

- **Full-screen Leaflet map** of Nigeria with OpenStreetMap tiles, custom zoom and scale controls, and draggable floating panels.
- **Three view modes** — `map` (cartographic), `data` (telemetry HUD), and `density` (spatial distribution visualisation).
- **Segment-aware autocomplete** that figures out which hierarchy level you are searching and suggests codes for that level.
- **Bidirectional postcode tooling** — assemble a postcode from segments, or disassemble an existing one, with validation at each step.
- **Reverse geocoding** from your GPS position to the nearest NDAPS unit, with distance reporting.
- **Nearby search** across digital postcode units with point geometry, capped at a 300 m radius.
- **Postcode Hunt**, a scored geolocation challenge mode with multiple difficulty tiers.
- **URL deep linking** — `?code=LA-11-A12-AK-08` resolves and flies to a postcode on load; `?state=LA` flies to a state.
- **Light and dark themes**, persisted via `localStorage`.
- **Client-side response caching** with per-endpoint TTLs (3 minutes to 1 hour) to stay fast and respect gateway rate limits.
- **Lazy geolocation** — your coordinates are only sent to the NDAPS gateway when you explicitly press the locate button.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | React 19 |
| Language | TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS 4 |
| Map | Leaflet + react-leaflet |
| Animation | Motion (Framer Motion successor) |
| Icons | lucide-react |
| AI SDK | `@google/genai` (present, no feature wired yet) |

The AI SDK is installed but currently unused. `GEMINI_API_KEY` is documented in `.env.example` for when an AI feature is added; nothing in the codebase calls it today.

---

## Project structure

```
postcode-atlas/
├── index.html                  # Entry HTML, fonts, favicons, meta/OG tags
├── vercel.json                 # Vercel build + SPA rewrite config
├── vite.config.ts              # React + Tailwind plugins, version injection, @ alias
├── CHANGELOG.md                # Release history (Keep a Changelog)
├── public/                     # Static assets, copied verbatim to dist/
│   ├── favicon.svg / .ico      # Browser tab icons
│   ├── apple-touch-icon.png    # Home-screen icon (180px)
│   ├── icon-512.png            # PWA / high-DPI icon
│   ├── logo.svg                # Full brand lockup
│   ├── logo-header.svg         # Compact lockup (top bar, light)
│   ├── logo-header-dark.svg    # Compact lockup (top bar, dark)
│   └── og-image.png            # 1200x1200 social card
├── src/
│   ├── App.tsx                 # Root component, all app state and orchestration
│   ├── types/postcode.ts       # NDAPS domain types
│   ├── lib/
│   │   ├── api/postcodeClient.ts   # All NIPOST gateway access + caching
│   │   └── geo/
│   │       ├── nigeriaData.ts      # All 37 states: centroid, capital, zone, LGA count
│   │       └── discoveryPoints.ts  # Verified landmark postcodes
│   ├── components/
│   │   ├── map/                # AtlasMap, CustomZoomControl, ScaleCenterControl
│   │   ├── search/             # MapSearch — autocomplete + locate
│   │   ├── navigation/         # TopBar — modes, breadcrumbs, actions
│   │   ├── postcode/           # PostcodeInspector — resolved location detail
│   │   ├── assembly/           # PostcodeAssemblyDrawer — assemble/disassemble
│   │   ├── explorer/           # StateExplorerDrawer — state → LGA drill-down
│   │   ├── data/               # DataModeOverlay — telemetry HUD
│   │   ├── hunt/               # PostcodeHuntModal — challenge mode
│   │   ├── story/              # DatasetStoryModal — NDAPS explainer
│   │   └── ui/                 # Toast, ThemeToggle, DraggableCard, SearchableSelect
│   └── hooks/                  # useTheme, useToast
└── .env.example                # Template for required variables
```

---

## Getting started

**Prerequisites:** Node.js 20 or newer.

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy the template and fill in your NIPOST publishable key:

   ```bash
   cp .env.example .env
   ```

   You need a key from the NIPOST NDAPS gateway. Use the **publishable** (`nipost_pk_...`) tier — see [Security notes](#security-notes).

3. **Start the dev server**

   ```bash
   npm run dev
   ```

   The app is served at `http://localhost:3001`.

---

## Environment variables

| Variable | Required | Exposed to browser | Purpose |
| --- | --- | --- | --- |
| `VITE_NIPOST_PUBLISHABLE_KEY` | Yes | Yes | Publishable NDAPS key sent as the `X-API-Key` header |
| `VITE_NIPOST_API_BASE_URL` | No | Yes | Gateway base URL, defaults to `https://api.postcode.gov.ng` |
| `GEMINI_API_KEY` | No | No | Reserved for a future AI feature. Unused today. |

Variables prefixed `VITE_` are inlined into the client bundle at build time and are therefore readable by anyone who opens the deployed site. Only publishable values belong in them.

---

## Deployment to Vercel

The app builds to a fully static bundle and talks to the NIPOST gateway directly from the browser, so there is no server to deploy.

1. **Push to a Git repository** and import it into Vercel, or run `npx vercel` from the project root.

2. **Add the environment variable.** In Vercel, go to **Project Settings → Environment Variables** and add:

   ```
   VITE_NIPOST_PUBLISHABLE_KEY = nipost_pk_...
   ```

   Apply it to Production, Preview, and Development. Optionally add `GEMINI_API_KEY` if you later wire up an AI feature.

3. **Deploy.** `vercel.json` already sets `buildCommand: npm run build` and `outputDirectory: dist`, plus a catch-all rewrite so client-side routes resolve on refresh. Vercel should detect the framework as Vite; if not, set the preset manually.

4. **Rebuild after changing env vars.** Because `VITE_` values are baked in at build time, you must redeploy for a key change to take effect. Editing the variable alone is not enough.

---

## Architecture notes

**No backend, by design.** This is a static bundle. All gateway traffic goes browser → `api.postcode.gov.ng`, authorised by the publishable key. The NIPOST NDAPS gateway permits direct browser calls with a publishable key, which is what makes this deployment shape possible.

**Caching is in-memory and per-session.** `postcodeClient.ts` keeps a `Map` of responses with per-endpoint TTLs — reference data (states, LGAs, districts, areas) is cached for an hour since it changes rarely, lookups for ten minutes, and nearby searches for three minutes. A page reload clears the cache.

**Single point of gateway access.** Every NIPOST call funnels through the private `gateway()` method in `postcodeClient.ts`, which attaches the `X-API-Key` header, unwraps the `data` envelope, and normalises errors. Adding an endpoint means adding one method there; no component touches `fetch` directly.

**State lives at the root.** `App.tsx` owns selection, camera, breadcrumbs, and modal state, and passes handlers down. Components are presentational, which keeps the drill-down flows readable.

**Geolocation is opt-in.** Coordinates are only transmitted when the user presses locate. Nothing is collected passively.

---

## Security notes

This deployment shape is only safe because the NIPOST key in use is the **publishable** tier (`nipost_pk_...`), which NIPOST issues specifically for client-side use.

- Anything in a `VITE_` variable is public. Never put a secret `sk_` key in `VITE_NIPOST_PUBLISHABLE_KEY`.
- If you later need secret-tier access, reintroduce a server or serverless function to hold that key. Do not inline it.
- `.env` is git-ignored; only `.env.example` is committed.
- If you add an AI feature using `GEMINI_API_KEY`, it must run server-side. A `VITE_`-prefixed Gemini key would be exposed. Note that bundling Gemini into a static-only app is the main reason you may want a server later.

---

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server on port 3001 |
| `npm run build` | Build the production bundle into `dist/` |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | Type-check with `tsc --noEmit` |
| `npm run clean` | Remove the `dist/` directory |

---

## Versioning and releases

The app follows [Semantic Versioning](https://semver.org). `package.json` holds
the single source of truth, and everything else derives from it at build time.

**How a version reaches users.** `vite.config.ts` reads `package.json` and:

1. Inlines the version as `__APP_VERSION__` (`src/lib/version.ts`), which the
   top-bar badge and release-notes modal display.
2. Writes `version.json` into the build output, recording the version and build
   timestamp.

At runtime the app fetches `version.json` with cache-busting every five minutes
and whenever the tab regains focus. If the deployed version is newer than the
running bundle, a banner offers a reload. Polling pauses while the tab is
hidden. This matters because a long-lived SPA keeps executing the JavaScript it
loaded at first paint, so without this people would sit on a stale build
indefinitely.

**Shipping a release:**

```bash
# 1. Bump the version and record what changed
npm version 1.2.0 --no-git-tag-version     # or edit package.json
# 2. Add a CHANGELOG.md section for the new version
# 3. Commit, tag, and publish
git add -A && git commit -m "Release 1.2.0"
git tag -a v1.2.0 -m "Release 1.2.0"
git push origin main --follow-tags
gh release create v1.2.0 --title "v1.2.0" --notes-file CHANGELOG_SECTION.md
# 4. Deploy — the version is baked in at build time
vercel --prod
```

Because the version is inlined at build time, changing `package.json` without
rebuilding has no effect on the deployed app. Rebuild and redeploy.

GitHub releases are also mirrored as tags, so the Releases page and the
in-app changelog stay in step.

---

## Branding

The mark is a location pin on Nigerian green, paired with an `NPA` wordmark. The
five short bars under the wordmark echo the five segments of an NDAPS postcode
(`AA-99-H77-BB-55`) — one code for each level of the address hierarchy.

All artwork is hand-authored SVG with no design-tool dependency. Raster fallbacks
(`favicon.ico`, `apple-touch-icon.png`, `icon-512.png`, `og-image.png`) are
committed alongside the SVGs so older browsers and platform icon pickers still
have something to serve.

Primary green is `#008751`, with `#0F7B4D` for text accents and `#10B981` for
dark-mode equivalents.

---

## PWA (Progressive Web App)

The app includes a Web App Manifest (`manifest.webmanifest`) and a Workbox service worker (`sw.js`) for offline support and installability.

**Current limitation:** Vercel's modern project configuration doesn't pick up `vercel.json` routes/rewrites via API. To enable the PWA manifest and service worker, manually add these rewrites in the Vercel Dashboard → Project Settings → Rewrites:

| Source | Destination |
|--------|-------------|
| `/manifest.webmanifest` | `/manifest.webmanifest` |
| `/sw.js` | `/sw.js` |
| `/workbox-:hash.js` | `/workbox-:hash.js` |
| `/favicon.ico` | `/favicon.ico` |
| `/favicon.svg` | `/favicon.svg` |
| `/apple-touch-icon.png` | `/apple-touch-icon.png` |
| `/icon-512.png` | `/icon-512.png` |
| `/og-image.png` | `/og-image.png` |
| `/logo.svg` | `/logo.svg` |
| `/logo-header.svg` | `/logo-header.svg` |
| `/logo-header-dark.svg` | `/logo-header-dark.svg` |
| `/version.json` | `/version.json` |
| `/(.*)` | `/index.html` |

Also add these headers:
- `/sw.js` → `Service-Worker-Allowed: /`, `Cache-Control: no-cache, no-store, must-revalidate`
- `/manifest.webmanifest` → `Cache-Control: public, max-age=31536000, immutable`

Once configured, the app will be fully installable as a PWA with offline caching for:
- NIPOST API responses (24hr TTL, NetworkFirst)
- Google Fonts (1yr TTL, CacheFirst)
- OpenStreetMap tiles (30d TTL, CacheFirst)

The core app, mobile experience, versioning, and all other features work without this step.

---

## License

Apache-2.0. Postal and address data is provided by the Nigerian Postal Service (NIPOST) through the official NDAPS API; map tiles are © OpenStreetMap contributors and used under the Open Database License.