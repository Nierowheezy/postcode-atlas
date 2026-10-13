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
- [Developer API](#developer-api)
- [Deployment to Vercel](#deployment-to-vercel)
- [Local inference (N-ATLAS)](docs/local-inference.md)
- [Architecture notes](#architecture-notes)
- [Security notes](#security-notes)
- [Scripts](#scripts)
- [License](#license)

---

## What the app does

Postcode Atlas is a single-page React application backed by the official NIPOST NDAPS API at `api.postcode.gov.ng`. It has five jobs:

**Explore.** An interactive Leaflet map of Nigeria with all 37 states and the Federal Capital Territory. Selecting a state flies the camera to its centroid and reports its LGA count and geopolitical zone. From there you can drill into Local Government Areas.

**Decode.** Enter any 11-character postcode and the app resolves it against the NDAPS gateway, then breaks it into its five constituent segments — state, LGA, district, area, and unit — showing you what each one means. There is also an assembly tool that works in reverse, letting you build a valid postcode segment by segment.

**Locate.** Grant geolocation permission and the app reverse-geocodes your coordinates to the nearest NDAPS unit, reporting the distance to it. There is also manual "search nearby" for any coordinate you tap on the map.

**Play.** A "Postcode Hunt" mode gives you a target postcode and a vague geographic hint; you have to navigate the map and find the exact location. It is a small gamification layer over the dataset.

**Ask.** An in-app assistant, Ask Atlas, answers questions about states, LGAs, districts, areas, landmarks and postcodes — "List the LGAs in Kano", "What is the postcode for The Infrastructure Bank PLC?", "Decode FC-02-D43-LG-01" — and can move the map to wherever you ask about. It runs through a server-side provider chain and is honest by construction: answers backed by real NIPOST data carry a "Verified against NIPOST postcode data" footer, invented postcodes are stripped, and out-of-scope questions get a graceful refusal instead of a guess.

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
- **Ask Atlas chat assistant** — grounded answers about states, LGAs, districts, areas and postcodes, with a "Verified against NIPOST postcode data" footer on every reply backed by a tool result.
- **Honest AI guard rails** — a postcode-invention guard strips any code a tool never returned, out-of-scope questions are refused rather than guessed, and map moves produce deterministic replies.
- **Tool-calling loop with failover** — the browser drives a multi-round tool loop against the server-side `/api/ask` chain, which retries and falls over to the next provider on rate limits and quota errors.
- **Follow-up awareness** — "what are its LGAs?" resolves against the place you just asked about, without leaking stale context into a new question.

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
| Assistant | Ask Atlas: OpenAI-compatible provider chain behind a server-side `/api/ask` function |

Ask Atlas is the only server logic in the app. A Vercel Function (`/api/ask`) speaks an OpenAI-compatible chat protocol to a provider chain — an optional N-ATLAS slot (prepended when `NATLAS_BASE_URL` is set), then Gemini, OpenRouter and NVIDIA free tiers — falling over to the next provider on rate limits and quota errors. Provider keys are read from `process.env` server-side only and never reach the browser; the client drives the tool-calling loop over plain HTTP.

---

## Project structure

```
postcode-atlas/
├── index.html                  # Entry HTML, fonts, favicons, meta/OG tags
├── vercel.json                 # Vercel build + SPA rewrite config
├── vite.config.ts              # React + Tailwind plugins, version injection, /api/ask dev middleware
├── api/
│   └── ask.ts                  # Vercel Function: POST /api/ask (Ask Atlas)
├── CHANGELOG.md                # Release history (Keep a Changelog)
├── docs/
│   └── local-inference.md      # Serving N-ATLAS from a Mac (reference deployment)
├── scripts/                    # Dataset snapshot + evaluation benchmark
│   ├── build-atlas-dataset.mjs # Regenerates public/atlas-data.json
│   └── eval-atlas.mjs          # 16-case Ask Atlas browser benchmark
├── public/                     # Static assets, copied verbatim to dist/
│   ├── favicon.ico, -16, -32   # Browser tab icons
│   ├── apple-touch-icon.png    # Home-screen icon (180px)
│   ├── android-chrome-*.png    # PWA / high-DPI icons (192, 512)
│   ├── logo.svg                # Full brand lockup
│   ├── logo-header.svg         # Compact lockup (top bar, light)
│   ├── logo-header-dark.svg    # Compact lockup (top bar, dark)
│   ├── atlas-data.json         # Bundled offline NDAPS snapshot
│   ├── manifest.webmanifest    # PWA manifest
│   └── og.jpg                  # 1200x630 social share card (link previews)
├── src/
│   ├── App.tsx                 # Root component, all app state and orchestration
│   ├── types/postcode.ts       # NDAPS domain types
│   ├── lib/
│   │   ├── api/postcodeClient.ts   # All NIPOST gateway access + caching
│   │   ├── ask/                    # Ask Atlas client: responder, guards, follow-up, small-talk
│   │   └── geo/
│   │       ├── nigeriaData.ts      # All 37 states: centroid, capital, zone, LGA count
│   │       └── discoveryPoints.ts  # Verified landmark postcodes
│   ├── server/ask/             # Ask Atlas server: handler, provider chain, tools
│   ├── components/
│   │   ├── map/                # AtlasMap, CustomZoomControl, ScaleCenterControl
│   │   ├── search/             # MapSearch — autocomplete + locate
│   │   ├── navigation/         # TopBar — modes, breadcrumbs, actions
│   │   ├── postcode/           # PostcodeInspector — resolved location detail
│   │   ├── assembly/           # PostcodeAssemblyDrawer — assemble/disassemble
│   │   ├── explorer/           # StateExplorerDrawer — state → LGA drill-down
│   │   ├── data/               # DataModeOverlay — telemetry HUD
│   │   ├── hunt/               # PostcodeHuntModal — challenge mode
│   │   ├── ask/                # AskAtlasPanel and friends — the assistant UI
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
| `NIPOST_PUBLISHABLE_KEY` | Yes | No | Publishable NDAPS key; the `/api/nipost` proxy attaches it to the upstream call |
| `NIPOST_API_BASE_URL` | No | No | Gateway base URL, defaults to `https://api.postcode.gov.ng` |
| `ATLAS_API_KEYS` | No | No | Comma-separated keys for the public `/api/v1` API; unset leaves it open |
| `ATLAS_API_RATE_LIMIT` | No | No | Requests allowed per caller per minute on `/api/v1`, default 60 |
| `GEMINI_API_KEY` | No¹ | No | Server-side Gemini key for the Ask Atlas chain |
| `OPENROUTER_API_KEY` | No¹ | No | Server-side OpenRouter key (failover) |
| `NVIDIA_API_KEY` | No¹ | No | Server-side NVIDIA key (failover) |
| `NATLAS_BASE_URL` | No | No | When set, prepends the N-ATLAS provider slot to the chain |
| `NATLAS_API_KEY` / `NATLAS_MODEL` | No | No | Optional N-ATLAS key and model (default `NCAIR1/N-ATLaS`) |
| `ASK_AI_ORDER` | No | No | Provider failover order (default `gemini,openrouter,nvidia`; N-ATLAS first when configured) |

¹ At least one provider key must be set for Ask Atlas to answer; with the default order that is `GEMINI_API_KEY`.

Variables prefixed `VITE_` are inlined into the client bundle at build time and are therefore readable by anyone who opens the deployed site. Only publishable values belong in them. The NIPOST key and the Ask Atlas provider keys are server-only: `/api/nipost` and `/api/ask` read them from `process.env` and never ship them to the browser.

The NIPOST gateway is reached through the `/api/nipost` proxy, not from the browser. The publishable key is locked to an origin allowlist, so a direct browser call is rejected with `origin_not_allowed`, while a server-side call carries no browser `Origin` and is served. That is also why the NIPOST variables are server-only rather than `VITE_`.

---

## Developer API

Alongside the app, `/api/v1` publishes a read-only JSON API for external applications: postcode lookups and decodes, the state-to-area reference lists, editorial explanations, and coordinate search. It is open by default and needs no key; set `ATLAS_API_KEYS` to require one and `ATLAS_API_RATE_LIMIT` to change the per-caller budget (see [Environment variables](#environment-variables)).

- [API reference](docs/api-reference.md) - the contract: authentication, rate limits, envelopes, every route and error code
- [API examples](docs/api-examples.md) - copy-pasteable curl and a typed `fetch` client

The API reads NDAPS server-side through the same gateway as the app, so it stays read-only and the publishable NIPOST key never reaches a browser.

---

## Deployment to Vercel

The app builds to a static bundle. Two small Vercel Functions are deployed alongside it: `/api/nipost/*` proxies every NIPOST NDAPS request (the publishable key is origin-locked, so browser calls are rejected), and `/api/ask` forwards chat traffic to LLM providers. The same handlers run as Vite dev middleware under `npm run dev`, so no separate server is needed locally.

1. **Push to a Git repository** and import it into Vercel, or run `npx vercel` from the project root.

2. **Add the environment variables.** In Vercel, go to **Project Settings → Environment Variables** and add:

   ```
   ```
   NIPOST_PUBLISHABLE_KEY = nipost_pk_...
   ```

   Apply to Production, Preview, and Development. For Ask Atlas, also add at least one server-side provider key (`GEMINI_API_KEY`, plus `OPENROUTER_API_KEY` / `NVIDIA_API_KEY` for failover) and, optionally, `NATLAS_BASE_URL` to route through N-ATLAS. All of these are read by the server functions (`/api/nipost` and `/api/ask`) and never reach the browser. See [`docs/local-inference.md`](docs/local-inference.md) for how the local N-ATLAS endpoint is stood up and pinned.

3. **Deploy.** `vercel.json` already sets `buildCommand: npm run build` and `outputDirectory: dist`, plus a catch-all rewrite so client-side routes resolve on refresh. Vercel should detect the framework as Vite; if not, set the preset manually.

4. **Redeploy after changing function env vars.** The NIPOST and provider keys are read at request time from the function environment, not baked into the bundle, so a redeploy is enough to pick up a change. Set them for Production, Preview, and Development so previews keep working.

---

## Architecture notes

**A static bundle plus two functions.** The UI is a static bundle. NIPOST traffic goes browser → `/api/nipost/*` → `api.postcode.gov.ng`, because the publishable key is locked to an origin allowlist and rejects browser `Origin`s with `origin_not_allowed`. Ask Atlas chat goes browser → `/api/ask` → LLM providers, because provider keys must not live in the bundle. Both are small Vercel Functions, and the same handlers run as Vite dev middleware under `npm run dev`.

**Caching is in-memory and per-session.** `postcodeClient.ts` keeps a `Map` of responses with per-endpoint TTLs — reference data (states, LGAs, districts, areas) is cached for an hour since it changes rarely, lookups for ten minutes, and nearby searches for three minutes. A page reload clears the cache.

**Single point of gateway access.** Every NIPOST call funnels through the private `gateway()` method in `postcodeClient.ts`, which calls the same-origin `/api/nipost` proxy, unwraps the `data` envelope, and normalises errors. Adding an endpoint means adding one method there; no component touches `fetch` directly. The proxy attaches the `X-API-Key` header server-side and forwards only the NDAPS paths the app actually calls.

**State lives at the root.** `App.tsx` owns selection, camera, breadcrumbs, and modal state, and passes handlers down. Components are presentational, which keeps the drill-down flows readable.

**Geolocation is opt-in.** Coordinates are only transmitted when the user presses locate. Nothing is collected passively.

**Ask Atlas is a server-side provider chain.** `POST /api/ask` validates and caches requests, then calls an OpenAI-compatible chain — optional N-ATLAS first (when `NATLAS_BASE_URL` is set), then Gemini, OpenRouter and NVIDIA — retrying and falling over on rate limits and quota errors. Keys come from `process.env`; none are `VITE_`-prefixed. The N-ATLAS reference deployment is documented in [`docs/local-inference.md`](docs/local-inference.md).

**Ask Atlas is honest by construction.** The client drives a multi-round tool-calling loop against read-only Atlas tools (states, LGAs, districts, areas, postcodes, decode, landmarks, nearby, map navigation). Replies that cite a tool result carry a "Verified against NIPOST postcode data" footer; a postcode-invention guard strips any code the tools never returned and the user never typed; out-of-scope questions are refused rather than guessed; and pure map moves produce deterministic replies.

---

## Security notes

The NIPOST key is held server-side, in the `/api/nipost` function environment, and never reaches the browser. The key in use is the **publishable** tier (`nipost_pk_...`).

- Anything in a `VITE_` variable is public. Never give a key a `VITE_` prefix unless it is safe for the shipped bundle.
- Do not put a secret `sk_` key in `NIPOST_PUBLISHABLE_KEY` either: the proxy only needs the publishable tier.
- `.env` is git-ignored; only `.env.example` is committed.
- Ask Atlas provider keys (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `NVIDIA_API_KEY`, `NATLAS_*`) are server-only: the `/api/ask` function reads them from `process.env` and they are never shipped in the bundle. If a key is missing or exhausted, the chain falls over to the next provider rather than exposing it.

---

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server on port 3001 (also mounts the `/api/ask` dev middleware) |
| `npm run build` | Build the production bundle into `dist/` |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | Type-check with `tsc --noEmit` |
| `npm run test` | Run the Vitest unit suite (38 tests) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run dataset` | Regenerate `public/atlas-data.json` from NDAPS |
| `npm run eval` | Drive the real chat UI through the 16-case Ask Atlas benchmark, writing `scripts/eval-report.md` |
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
(`favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`,
`android-chrome-192x192.png`, `android-chrome-512x512.png`) are committed
alongside the SVGs so older browsers and platform icon pickers still have
something to serve.

The social share card (`public/og.jpg`, 1200x630) is generated from the Remotion
project in `video/` (`npm run og`); `index.html` references it with absolute
`og:image` / `twitter:image` URLs for link previews.

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
| `/favicon-16x16.png` | `/favicon-16x16.png` |
| `/favicon-32x32.png` | `/favicon-32x32.png` |
| `/apple-touch-icon.png` | `/apple-touch-icon.png` |
| `/android-chrome-192x192.png` | `/android-chrome-192x192.png` |
| `/android-chrome-512x512.png` | `/android-chrome-512x512.png` |
| `/og.jpg` | `/og.jpg` |
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