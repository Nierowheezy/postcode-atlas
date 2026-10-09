# Feature: Atlas dataset cache (3a)

**From build-plan:** feature 3a (MVP, split from feature 3)
**Status:** verified

## Goal

Give the app a versioned, offline-readable copy of the NIPOST naming hierarchy (37 states + ~774 LGAs) plus the bundled discovery landmarks, seeded once per release from a server-served dataset snapshot, so deterministic location and postcode lookups run locally with zero provider calls. This is the data foundation for the Atlas tool layer: shared types, a build-time snapshot generator, an IndexedDB store, and a local-first read API that falls back to the NIPOST gateway when online. Features 3b (tools), 3c (chat loop), and 4-9 consume this store; this sub-feature ships no tools and no UI.

**Scope decision (measured live, 2026-10):** NDAPS districts (~222,277) and areas (~5M) are code-only with no human names; storing them client-side would mean a ~290 MB snapshot and an 8-12 h generation walk. The snapshot carries states + LGAs only; district and area reads resolve through the gateway read-through fallback (they already work that way today). The `atlasStore` surface and snapshot shape stay load-bearing for 3b either way.

## Design reference

None. Data layer only, no visual target.

## In scope

- **Snapshot generator** - `scripts/build-atlas-dataset.mjs` walks the NDAPS reference API (states, then per-state LGAs) with bounded concurrency and Retry-After-aware retries, and writes `public/atlas-data.json` (flat arrays with parent codes, plus `version`, `generatedAt`, `counts`). The host serves that static asset like `version.json`.
- **Snapshot types + fetcher** - `src/lib/atlas/dataset.ts`: `AtlasSnapshot`, `AtlasState`, `AtlasLga`, `AtlasDistrict`, `AtlasArea`, `AtlasDatasetMeta`, and a cache-busted `fetchAtlasSnapshot()` mirroring `src/lib/version.ts`.
- **IndexedDB store** - `src/lib/atlas/storage.ts`: database `atlas-dataset` with `meta`, `states`, `lgas`, `districts`, `areas` object stores; composite out-of-line keys; clear, bulk-put, and keyrange reads; in-memory fallback when IndexedDB is unavailable (private mode).
- **Read API** - `src/lib/atlas/store.ts` exposing `atlasStore`: `getStates()`, `getLgas(state)`, `getDistricts(state, lga)`, `getAreas(state, lga, district)`, `searchLocations(q)`, `getPostcode(code)`, `getDiscoveryPoints()`, `ensureHydrated()`, `getStatus()`. Every read is local-first with gateway read-through through the existing `postcodeApi` when a key is missing and the network is up.
- **Version gating + release refresh** - dataset `version` mirrors `APP_VERSION` (package.json), so a new release rehydrates automatically; hydration runs once at app start, non-blocking and idempotent.
- **Graceful degradation** - failed fetches keep existing data, missing keys return empty results (never throw), partial hydration falls back per key.

## Out of scope

- The structured tool schemas and executors (3b) and the tool-calling chat loop (3c); they consume this store.
- `navigateMap` (feature 8).
- A runtime regeneration endpoint that walks the gateway on demand: the full NDAPS walk is ~445k calls (measured: 222,277 districts, ~5M areas, code-only) and cannot fit a serverless request, so the snapshot is generated at build time. On-demand regeneration can be revisited in hardening.
- A postcode index beyond the bundled discovery landmarks; unknown postcodes read through to the gateway.
- Hydration status UI; the store exposes status for later features but renders nothing.
- Replacing any existing Atlas data flow (map, explore, decode, hunt); those keep using `postcodeApi` and are not rebuilt.
- State geo metadata (capitals, zones, centroids): that stays in `src/lib/geo/nigeriaData.ts`; the snapshot carries only NDAPS reference code + name.

## Build loop

Build one step at a time, never the whole feature at once. Plan mode lays out each step before any code; the AI implements just that step, shows the diff, and `/implement` ticks the box. Progress is tracked in this file, so a fresh session resumes from the first unchecked step.

- [x] **Step 1 - snapshot generator script** - `scripts/build-atlas-dataset.mjs` + an `npm run dataset` script. Uses `loadEnv` from vite (the existing `vite.config.ts` pattern) to read `VITE_NIPOST_PUBLISHABLE_KEY`, walks states -> LGAs with bounded concurrency and Retry-After-aware backoff, writes the snapshot atomically (tmp file, then rename) and only on full success. Fails loudly with a nonzero exit on gateway failure.
  *Done when:* a fresh `npm run dataset` emits a valid `public/atlas-data.json` (37 states, 774 LGAs; district/area arrays empty with zero counts per the scope decision), `node -e` reads it back with the version matching package.json, and `npm run lint` + `npm run build` remain green.
  *Evidence:* `npm run dataset` wrote `public/atlas-data.json` (34.9 KB, v1.1.0); `node -e` verified version === package.json, counts 37/774/0/0, LA->20 LGAs, shape regexes; lint + build green.
- [x] **Step 2 - snapshot types + fetcher** - `src/lib/atlas/dataset.ts` with the snapshot, entity, meta, and candidate shapes plus `fetchAtlasSnapshot()` (cache-busted, mirroring `fetchRemoteVersion`).
  *Done when:* the code compiles, and a dev-server probe fetches `/atlas-data.json` and parses the meta block (version + counts) with zero console errors.
  *Evidence:* probe PASS - `/atlas-data.json?t=` fetched + parsed: version 1.1.0, counts 37/774/0/0, no console errors from the parse.
- [x] **Step 3 - IndexedDB store** - `src/lib/atlas/storage.ts`: open/create stores, bulk-put, composite-key reads via keyrange, meta read/write, and an in-memory fallback when IndexedDB is unavailable.
  *Done when:* a dev-console probe hydrates a small fixture, a reload keeps the data, and simulating a version bump clears and refills exactly once.
  *Evidence:* probe PASS - app hydrates once (fetch count delta), IDB counts 37/774/0/0, meta.version 1.1.0, reload skips refetch and keeps data, forced stale meta (9.9.9) refills exactly once to 1.1.0, post-bump reload skips again.
- [x] **Step 4 - read API with gateway fallback** - `src/lib/atlas/store.ts` implementing the full `atlasStore` surface; every read prefers local storage and reads through to `postcodeApi` when a key is missing and online; `getPostcode` normalizes codes (strip dashes/spaces, uppercase) and checks discovery landmarks first, then the gateway.
  *Done when:* a probe returns the Lagos state + LGA tree from local storage with zero network; deleting a key (or reading the unstored district/area levels) makes that read hit the gateway instead; returned counts match the snapshot meta.
  *Evidence:* probe PASS - getStates 37 + getLgas('la') 20 with zero gateway calls; searchLocations('ike') local, prefix, name-ordered (Ikeduru, Ikeja, ...), zero gateway; getDistricts fires the gateway fallback (delta 1) and degrades to [] without throwing under the environmental browser 403 (Origin-less Node fetch proves the gateway serves 21/23 codes when reachable); getPostcode never throws.
- [x] **Step 5 - app integration + release refresh** - fire `ensureHydrated()` once at app start (non-blocking, idempotent); add the `/atlas-data.json` passthrough to `vercel.json` next to `/version.json`.
  *Done when:* first load hydrates once and a reload skips it; bumping `APP_VERSION` in a dev run triggers exactly one rehydrate; lint + build green; zero console errors.
  *Evidence:* App.tsx hydration effect on mount (probe: hydrates once per load, reloads skip); vercel.json passthrough added; lint + build green; no unexpected console errors.
- [x] **Step 6 - edge hardening + evidence** - failed fetches keep the old dataset, mid-hydration failure leaves prior data intact, offline reads still answer from storage, private-mode IndexedDB uses the in-memory fallback, missing keys return empty results.
  *Done when:* with the network throttled off, previously hydrated reads still answer; a simulated mid-hydration failure keeps the old dataset; all reads return `[]` or `null` (never throw) when data is missing; build green.
  *Evidence:* probe PASS - offline getStates 37 + getLgas 20 still answer; getLgas('ZZ') -> [] and getPostcode('000000') -> null without throwing; malformed snapshot write (un-cloneable value) rejects and the prior dataset stays byte-identical (meta + counts); no unexpected console errors. Private-mode memory fallback is code-reviewed (writeMemory used only when `indexedDB` is unavailable).

## Files / areas

- `scripts/build-atlas-dataset.mjs` (new) - snapshot generator
- `package.json` - add `dataset` script
- `public/atlas-data.json` (generated, committed) - served snapshot, regenerated per release
- `src/lib/atlas/dataset.ts` (new) - types + fetcher
- `src/lib/atlas/storage.ts` (new) - IndexedDB wrapper
- `src/lib/atlas/store.ts` (new) - `atlasStore` read API
- `src/App.tsx` - app-start hydration effect
- `vercel.json` - `/atlas-data.json` passthrough

`public/atlas-data.json` is committed so deploys are deterministic and first visits work without a live gateway walk. No new dependency is expected: the generator uses `vite`'s `loadEnv` and the existing `postcodeClient` patterns.

## Data / contracts

- **Snapshot shape (load-bearing for 3b)** - flat arrays with parent codes:
  `{ version, generatedAt, counts: { states, lgas, districts, areas }, states: AtlasState[], lgas: AtlasLga[], districts: AtlasDistrict[], areas: AtlasArea[] }`
  where `AtlasState { code, name }`, `AtlasLga { state, code, name }`, `AtlasDistrict { state, lga, code, name? }`, `AtlasArea { state, lga, district, code, name? }`. NDAPS returns districts and areas as code-only, so `name` is optional. In this scope the snapshot ships empty `districts`/`areas` arrays with zero counts (see the scope decision); 3b must read those levels through the gateway fallback.
- **Store types** - `AtlasDatasetMeta { version, counts, generatedAt }`; `LocationCandidate { type: 'state' | 'lga' | 'district' | 'area' | 'landmark', code, name?, state?, lga?, coordinates? }` from `searchLocations` (prefix-first matches over names and codes, capped results). 3b maps these to tool results; it does not redefine them.
- **`atlasStore` surface** - the method names and signatures above are the load-bearing contract for 3b and features 4-9; locked in this spec.
- **IndexedDB keys** - composite arrays (`[state, code]`, `[state, lga, code]`, `[state, lga, district, code]`) stored as out-of-line keys via `add(value, key)`; IDB `keyPath` cannot be an array, so keys are never a property of the record.
- **Versioning** - dataset `version` === `APP_VERSION` (package.json), equality check against the stored meta. A snapshot regenerated mid-release without a version bump does not rehydrate; that is a documented limitation, not a bug.

## Testing

- `AGENTS.md` declares no `test` command (lint + build only), so there is no unit gate: in-scope logic (version gating, keyrange reads, read-through fallback, code normalization) is verified with `npm run lint` + `npm run build`, a `node -e` validation of the generated snapshot, and dev-server/browser probes (IndexedDB contents, snapshot parse, offline behavior) captured as `/check` evidence.
- No `Browser tests` command is declared; direct browser + console evidence is used instead.

## Notes for the AI

- **Client vs server** - the generator is Node/build-time only and reads the publishable key (`VITE_NIPOST_PUBLISHABLE_KEY`) through vite's `loadEnv`, merged with `process.env` exactly like `vite.config.ts`. Never accept or embed a secret `sk_` key anywhere.
- **Single NIPOST data path** - all gateway calls go through the existing `src/lib/api/postcodeClient.ts`; the read-through fallback in step 4 reuses its methods so the gateway behavior stays in one place.
- **Mirror existing patterns** - cache-busting fetch and `APP_VERSION` come from `src/lib/version.ts`; interface-first types per `src/types/postcode.ts`.
- **Expected size** - the states+LGAs snapshot is ~35 KB raw (~6 KB gzipped on the wire); the client fetches it once per release, so this is trivial for any client and IndexedDB handles it comfortably. (The measured full hierarchy with districts/areas would be ~290 MB raw — the reason for the scope decision.)
- **Conventions** - interfaces, camelCase, functions under 50 lines, strict TypeScript with no `any`, comments only for why, no em dashes in generated content.