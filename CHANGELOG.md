# Changelog

All notable changes to Postcode Atlas are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

Nothing yet.

---

## [1.1.0] — 2026-10-07

### Added

- **Brand identity.** A location pin on Nigerian green, paired with an `NPA`
  wordmark and a five-bar motif standing in for the five segments of an NDAPS
  postcode (`AA-99-H77-BB-55`).
  - `favicon.svg` and a multi-resolution `favicon.ico` (16/32/48) for browsers
  - `apple-touch-icon.png` (180) and `icon-512.png` (512) for home-screen and
    PWA installs
  - `logo.svg` — full lockup for documentation and print
  - `logo-header.svg` / `logo-header-dark.svg` — compact single-line lockups
    used in the top bar, with a dedicated dark-mode variant
  - `og-image.png` — 1200×1200 social card used for link previews
- **Version badge** in the top bar showing the running version, clickable to
  open release notes from inside the app.
- **Update detection.** The app polls a generated `version.json` manifest every
  five minutes and on tab focus. When a newer deploy is found, a dismissible
  banner offers a one-click reload, followed by a short confirmation once
  applied. Polling pauses while the tab is hidden so idle tabs cost nothing.
- **`version.json`** is emitted into the build output by a Vite plugin,
  recording the deployed version and build timestamp.
- **In-app release notes.** `CHANGELOG.md` is bundled and rendered in a modal,
  so the release history is readable offline without leaving the site.
- `theme-color` and Open Graph / Twitter image metadata.

### Changed

- The top-bar wordmark is now the logo lockup instead of a text label.
- The version is injected from `package.json` at build time rather than
  hardcoded, so the badge, manifest, and changelog can never disagree.

---

## [1.0.0] — 2026-10-07

Initial public release. Deployed to `https://postcode-atlas.vercel.app`.

### Added

- **Interactive Leaflet map** of Nigeria with all 37 states and the Federal
  Capital Territory, OpenStreetMap tiles, custom zoom and scale controls, and
  draggable floating panels.
- **Three view modes** — Map (cartographic), Data (telemetry HUD), and Density
  (spatial distribution).
- **Segment-aware autocomplete** that infers which level of the NDAPS hierarchy
  you are searching and suggests codes for that level.
- **Assembly engine.** Assemble a postcode segment by segment, or disassemble an
  existing one, with validation at each step.
- **Reverse geocoding** from GPS position to the nearest NDAPS unit, with
  distance reporting.
- **Nearby search** across digital postcode units with point geometry, capped at
  a 300 m radius.
- **State explorer** with cascading State → LGA drill-down.
- **Postcode Hunt**, a scored geolocation challenge with multiple difficulty
  tiers.
- **"Surprise me"** jumps to one of six landmark postcodes verified against the
  official NDAPS API.
- **Dataset story modal** explaining the NDAPS architecture inline.
- **URL deep linking** — `?code=LA-11-A12-AK-08` resolves and flies to a
  postcode on load; `?state=LA` flies to a state.
- **Light, dark, and system themes**, persisted to `localStorage`.
- **In-memory response caching** with per-endpoint TTLs, from three minutes for
  nearby searches up to one hour for static reference data.

### Changed

- Migrated from an Express backend to a **fully static build** that calls the
  NIPOST NDAPS gateway directly from the browser using a publishable
  (`nipost_pk_`) key. No server is required to deploy.
- All gateway access is funnelled through a single `gateway()` method that
  attaches the `X-API-Key` header, unwraps the `data` envelope, and normalises
  errors.
- Discovery landmarks moved client-side into `src/lib/geo/discoveryPoints.ts`
  so they work without a network round trip.

### Removed

- The Express server (`server.ts`) and its proxy routes, made unnecessary by the
  static migration.
- All AI Studio scaffolding: the app manifest, `DISABLE_HMR` agent-edit config,
  and Cloud Run secret-injection wiring.

### Security

- The client only ever receives the **publishable** `nipost_pk_` NIPOST key.
  Secret-tier `sk_` keys must never be placed in a `VITE_` variable, since those
  are inlined into the public bundle.
- `GEMINI_API_KEY` is documented but intentionally not shipped to the client. A
  future AI feature must run server-side.
- Geolocation is opt-in. Coordinates are only transmitted when the user
  explicitly presses the locate control.

[Unreleased]: https://github.com/Nierowheezy/postcode-atlas/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Nierowheezy/postcode-atlas/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Nierowheezy/postcode-atlas/releases/tag/v1.0.0