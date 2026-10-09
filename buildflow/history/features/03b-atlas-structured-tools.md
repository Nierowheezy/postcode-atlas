# Feature: Atlas structured tools (3b)

**From build-plan:** feature 3b (MVP, split from feature 3)
**Status:** verified

## Goal

Turn the eight Atlas capabilities into one client-side tool layer: a shared, validated schema per tool plus one executor per tool, backed by the feature 3a `atlasStore` and the existing `postcodeApi`. The chat loop (3c) picks a tool and arguments; these executors answer from the local dataset cache (with the gateway as read-through fallback) so the model never invents postcodes. This sub-feature ships schemas and executors only: no chat loop, no UI, no provider or server changes.

The eight tools: `searchLocation`, `getState`, `getLgas`, `getDistricts`, `getAreas`, `getPostcode`, `decodePostcode`, `getNearby`. `navigateMap` stays out (feature 8, and it mutates app state).

## Design reference

None. Data/tool layer only, no visual target.

## In scope

- **Tool contracts** - `src/lib/tools/types.ts`: `ToolName`, `ToolDefinition`, `ToolExecutionResult`, `ToolError`/`ToolErrorCode`, and the result payloads that do not already exist in 3a (`StateSummary`, `DecodedPostcode`, `NearbyUnit`). Existing 3a/existing types are reused, never redefined (`LocationCandidate`, `AtlasLga`, `AtlasDistrict`, `AtlasArea`, `PostcodeLocation`, `PostcodeSegments`, `StateGeoInfo`).
- **Validated arg schemas** - `src/lib/tools/schemas.ts`: one zod schema per tool, derived arg types (`z.infer`), and one-line descriptions. These schemas are the single source of truth for the provider `tools` payload that 3c serializes.
- **Client executors** - `src/lib/tools/executors.ts`: one async executor per tool. Hierarchy and search executors read through `atlasStore` (local-first, gateway fallback). `decodePostcode` parses the code structure locally and enriches best-effort. `getNearby` maps the gateway's nearby units into a stable `NearbyUnit` shape.
- **Registry + dispatcher** - `src/lib/tools/registry.ts`: `TOOL_REGISTRY` (name to definition) and `runTool(name, rawArgs)`, which validates raw args and returns a typed `ToolExecutionResult` without ever throwing. This is the validation boundary 3c reuses.
- **zod dependency** - add `zod` (v4) as the schema engine: runtime validation of untrusted model arguments, `z.infer` types, and `z.toJSONSchema()` for the OpenAI-compatible tool definitions 3c sends.

## Out of scope

- The tool-calling chat loop, the multi-round `/api/ask` contract, and the provider `tools` payload (3c). 3b only guarantees the schemas serialize to JSON Schema.
- `navigateMap` and any app-state mutation (feature 8). Every 3b tool is read-only.
- Any UI, panel, or message rendering (features 4-9). Nothing in the app imports the tool layer until 3c.
- Server/API changes: `POST /api/ask`, the provider chain, and `src/server/ask/**` are untouched.
- New NIPOST endpoints or a wider snapshot: 3b reuses `postcodeApi` and `atlasStore` exactly as shipped in 3a.
- Extra caching beyond `postcodeApi`'s in-memory cache and 3a's IndexedDB snapshot.
- Resolving a place name to coordinates: `getNearby` takes `{ lat, lng }`, and whoever calls it (3c, feature 7) supplies them from the map center or a resolved location.

## Build loop

Build one step at a time, never the whole feature at once. Plan mode lays out each step before any code; the AI implements just that step, shows the diff, and `/implement` ticks the box. Progress is tracked in this file, so a fresh session resumes from the first unchecked step.

- [x] **Step 1 - tool contracts + validated arg schemas** - add `zod`; write `src/lib/tools/types.ts` (`ToolName`, `ToolDefinition`, `ToolExecutionResult`, `ToolError`, `ToolErrorCode`, `StateSummary`, `DecodedPostcode`, `NearbyUnit`) and `src/lib/tools/schemas.ts` (one schema + derived arg type + description per tool).
  *Done when:* `npm run lint` + `npm run build` are green; a dev probe imports the schemas, `safeParse` accepts a valid arg object and rejects a malformed one for each of the eight, and `z.toJSONSchema(schema)` returns a JSON Schema object for all eight (proving the 3c serialization path).
- [x] **Step 2 - searchLocation + getState executors** - `searchLocation` wraps `atlasStore.searchLocations`; `getState` merges `atlasStore.getStates` with `NIGERIA_STATES` geo metadata into a `StateSummary`.
  *Done when:* a probe returns search matches for `ike` from the local store with zero gateway calls, and a `StateSummary` for `LA` whose `capital`/`zone`/`lgaCount` match `NIGERIA_STATES`; an unknown-but-well-formed code returns `{ ok: false, error: { code: 'not_found' } }` and never throws.
- [x] **Step 3 - getLgas + getDistricts + getAreas executors** - thin wrappers over `atlasStore.getLgas` / `getDistricts` / `getAreas` with normalized parent codes.
  *Done when:* a probe returns `LA`'s LGAs from local storage with zero gateway calls; `getDistricts('LA','01')` fires the gateway fallback and degrades to `[]` (a successful empty result) without throwing under the browser 403; `getAreas('LA','01','A01')` returns 23 code-only rows (measured live 2026-10-09; `H77` is empty upstream).
- [x] **Step 4 - getPostcode + decodePostcode executors** - `getPostcode` wraps `atlasStore.getPostcode` (discovery landmarks first, then gateway) and returns `null` for unknown codes. `decodePostcode` normalizes the code, parses the five segments locally, resolves the state name from local states and the LGA name from local LGAs, and enriches best-effort from the gateway lookup; malformed input returns `{ valid: false, reason }` as a successful result, not a tool error.
  *Done when:* a probe decodes a bundled landmark (for example `FC-02-D43-LG-01`) offline into its five segments plus `stateName` and `lgaName`; the compact form `FC02D43LG01` decodes to the same segments; a malformed `ZZ` returns `{ valid: false }` without throwing.
- [x] **Step 5 - getNearby executor** - args `{ lat, lng, radius? }` (coordinates come from the caller, not 3b); clamp `radius` to `(0, 300]` (the gateway cap). Map each nearby unit into `NearbyUnit` against the documented unit fields (`postcode`, `display`, `compact`, `state`, `lga`, `district`, `area`, `unit`, `point_geometry.coordinates` as `[lng, lat]`, `distance_m`), dropping unknown fields.
  *Done when:* a probe that stubs the `/v1/search/nearby` response with one synthetic unit returns exactly one `NearbyUnit` with `coordinates` and `distance_m` populated; with the live gateway (which currently serves no unit geometry, measured 2026-10-09) or an unreachable gateway, `getNearby` returns `[]` and never throws; `radius: 900` clamps to `300`.
- [x] **Step 6 - registry + runTool dispatcher + edge hardening** - assemble `TOOL_REGISTRY` (exactly eight entries) and `runTool(name, rawArgs)`; validation via `safeParse`; unknown tool to `unknown_tool`, invalid args to `invalid_args` with issue paths, an executor fault caught to `internal_error`.
  *Done when:* a probe runs all eight through `runTool` with valid args (`ok: true`) and with invalid args (`ok: false`, correct code); `runTool('doesNotExist', {})` returns `unknown_tool`; the registry has eight entries; `npm run lint` + `npm run build` are green with no unexpected console errors.

## Files / areas

- `src/lib/tools/types.ts` (new) - tool contracts + new result payloads
- `src/lib/tools/schemas.ts` (new) - zod arg schemas, descriptions, derived arg types
- `src/lib/tools/executors.ts` (new) - the eight executors
- `src/lib/tools/registry.ts` (new) - `TOOL_REGISTRY` + `runTool`
- `package.json` + lockfile - add `zod`
- Consumes (no edits expected): `src/lib/atlas/store.ts`, `src/lib/atlas/dataset.ts`, `src/lib/api/postcodeClient.ts`, `src/lib/geo/nigeriaData.ts`, `src/types/postcode.ts`

Nothing imports these modules until 3c. That is intentional: `tsc --noEmit` type-checks them and the dev probe exercises them at runtime. It is not dead code to flag.

## Data / contracts

Load-bearing for 3c and features 4-9. Reuse 3a shapes where they exist; only add what is missing.

- **Contracts**
  - `ToolName` - the eight literal names.
  - `ToolDefinition<Args, Data>` - `{ name, description, schema: z.ZodType<Args>, execute(args: Args): Promise<Data> }`.
  - `ToolExecutionResult<Data>` - `{ ok: true, data: Data } | { ok: false, error: ToolError }`.
  - `ToolError` - `{ code: ToolErrorCode, message: string, issues?: string[] }`.
  - `ToolErrorCode` - `'invalid_args' | 'unknown_tool' | 'not_found' | 'internal_error'`.
- **Per-tool `data` shapes**
  - `searchLocation({ query })` -> `LocationCandidate[]` (3a type; prefix-first, capped at 12)
  - `getState({ state })` -> `StateSummary`
  - `getLgas({ state })` -> `AtlasLga[]` (3a type)
  - `getDistricts({ state, lga })` -> `AtlasDistrict[]` (3a type)
  - `getAreas({ state, lga, district })` -> `AtlasArea[]` (3a type)
  - `getPostcode({ code })` -> `PostcodeLocation | null` (existing type)
  - `decodePostcode({ code })` -> `DecodedPostcode`
  - `getNearby({ lat, lng, radius? })` -> `NearbyUnit[]`
- **New result payloads**
  - `StateSummary` - `{ code, name }` plus the optional geo fields from `StateGeoInfo` (`capital`, `zone`, `center`, `zoom`, `lgaCount`). Implement as `Pick<StateGeoInfo, 'code' | 'name'> & Partial<Omit<StateGeoInfo, 'code' | 'name'>>` so the geo shape is not duplicated. When `NIGERIA_STATES` has no entry, return `{ code, name }` with the geo fields omitted rather than failing.
  - `DecodedPostcode` - `{ postcode, compact, display, valid, reason?, segments: PostcodeSegments, stateName?, lgaName?, coordinates?: [number, number], verified? }`.
  - `NearbyUnit` - `{ postcode, compact?, display?, state?, stateName?, lga?, lgaName?, district?, area?, unit?, coordinates?: [number, number], distance_m?, address? }`; unknown gateway fields are dropped so the contract is stable regardless of the raw response. Measured 2026-10-09: the gateway currently serves no unit-level postcodes or point geometry (a lookup of a bundled landmark returns `not_found`; nearby, reverse, and autocomplete return empty), so the mapping is verified against a stubbed response and the live empty case.
- **Error philosophy** - reads return `[]` or `null` for "no data" (mirrors 3a). Tool errors are reserved for invalid args, unknown tool, a missing single entity where `null` would be meaningless (`getState`), and internal faults. `decodePostcode` reports a malformed code inside a successful `{ valid: false }` result so the model can explain it.
- **Arg schemas are the source of truth** - 3c builds the provider `tools` array from these schemas through `z.toJSONSchema`; it must not hand-write separate definitions.
- **Postcode shape** - `state(2 letters)-lga(2 digits)-district(3 alphanumeric)-area(2 letters)-unit(2 digits)`, for example `FC-02-D43-LG-01`; the compact form drops the dashes.

## Testing

- `AGENTS.md` declares no `test` command (lint + build only) and no `Browser tests` command, so there is no unit or browser gate. In-scope logic here is the arg validators, the code normalizer/parser, and the nearby mapper - verified with `npm run lint` + `npm run build` plus a dev-server browser probe.
- Probe approach: Playwright imports `/src/lib/tools/registry.ts` from the running dev server and calls `runTool` per tool with valid, invalid, and edge args, recording the returned `ToolExecutionResult`. The `getNearby` mapping is exercised by stubbing `window.fetch` for `/v1/search/nearby` with one synthetic unit, because the live gateway currently serves no unit geometry (measured with an origin-less Node fetch on 2026-10-09).
- Environmental caveat (not 3b-caused): `api.postcode.gov.ng` returns 403 for every browser-origin request right now, so gateway-backed tools (districts, areas, postcode, nearby) degrade to `[]`/`null` in-browser locally. The done-whens above treat the empty degradation as the expected observable result and use origin-less Node fetch to prove the upstream shape where a live response is needed.

## Notes for the AI

- **Client vs server** - every executor runs in the browser. No provider keys, no LLM calls, no server changes; the only network path is the existing `postcodeApi`. "Zero provider calls" means zero LLM provider calls, not zero NIPOST gateway calls.
- **Reads never throw** - mirror 3a: local first, gateway read-through, degrade to `[]`/`null`. The dispatcher is the single place that turns a bad call into a structured `ToolError`.
- **Reuse, do not redefine** - `LocationCandidate`, `AtlasLga`, `AtlasDistrict`, `AtlasArea`, `PostcodeLocation`, `PostcodeSegments`, and `StateGeoInfo` already exist. Import them.
- **zod v4** - use `z.object` schemas and `z.infer`; keep `z.toJSONSchema` working for 3c. Do not hand-roll a second JSON Schema.
- **Single NIPOST data path** - go through `postcodeApi`; do not call the gateway directly. Local reads go through `atlasStore`.
- **Upstream limitation (measured 2026-10-09)** - the gateway serves the reference hierarchy (states, LGAs, districts, areas) but no unit-level postcode records or point geometry, so `getPostcode` (beyond bundled landmarks), `decodePostcode` enrichment, and `getNearby` return `null`/`[]` from the gateway today. The tools must degrade gracefully; do not treat the empty result as a 3b bug.
- **Conventions** - interfaces, camelCase, functions under 50 lines, strict TypeScript with no `any`, comments only for why, no em dashes in generated content.