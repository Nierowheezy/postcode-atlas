# Feature: Conversational map control

**From build-plan:** feature 8
**Status:** verified

## Goal

Let the user drive the map by talking: "show me Lagos", "zoom into Ikeja", "reset the map". N-ATLAS requests a validated map action, the app acts on it through the same handlers the sidebar and search already use, and the existing `[View on map]` button becomes a real control instead of a disabled placeholder.

## In scope

- A new `navigateMap` tool in the 3b layer (schema, description, registry, provider schema map, `ToolName`, `ToolResultMap`) that validates a requested map action against the local snapshot and resolves it to real coordinates, never mutating app state itself.
- A client-derived `mapAction` payload on the reply, built only from an executed `navigateMap` result, so the action the app runs is the one the tool verified rather than something parsed from prose.
- `App.tsx` wiring: one `applyMapAction` handler that reuses the existing `handleSelectState`, `handleSelectLGA`, `handleSelectLocation`, and `handleResetBreadcrumbs` paths, so a conversational action and a sidebar click leave identical state.
- The `[View on map]` button in `AskAtlasMessageBubble` becomes enabled and calls the same handler with the reply's `location`.
- Prompt guidance: when the user asks to see, show, go to, zoom into, or reset a place, call `navigateMap` with a real place; resolve an unknown name with `searchLocation` first; never call it without a place; and answer briefly since the map moves on its own.

## Out of scope

- Drawing or measuring on the map, adding markers the user did not ask for, clustering, and heatmap or density changes.
- Navigation from the hierarchy lists and nearby results: this feature activates the map for the existing `[View on map]` control and for explicit map requests, not for clicking every row in features 5 or 7.
- Highlight styling beyond the existing `selectedLocation` marker and inspector.
- Conversation context across turns (feature 10), Nigerian phrasing (feature 11), ambiguity clarification (feature 12).
- Grounding changes (feature 9), and any server route, gateway change, dependency, or 3c transport change.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - `navigateMap` tool** - Added `navigateMapSchema` as a Zod discriminated union on `target` (`state` / `lga` / `postcode` / `reset`), its description, the `navigateMap` executor, the registry entry, the provider schema map, `TOOL_NAMES`, and `ToolResultMap`, plus the shared `MapAction` union in `tools/types.ts`. The executor resolves a state or LGA through the existing `resolveState` and `resolveLgaCode` helpers, reads the center and zoom from `NIGERIA_STATES`, uses zoom 12 for an LGA (matching the explorer) and the national center at zoom 6 for reset, resolves a postcode through `atlasStore.getPostcode`, and throws `ToolFault('not_found', ...)` for an unknown state, an unknown LGA, an unmapped postcode, or a record without coordinates. It is read-only and returns an intent; React stays the only place that acts on it.
  *Evidence (2026-10-09):* browser probe over the hydrated real store: `{target:'state', state:'Lagos'}` and the code form `'LA'` both resolved to Lagos (center 6.5244, 3.3792, zoom 10); `{target:'lga', state:'Lagos', lga:'Ikeja'}` resolved to LGA code 11 "Ikeja" at zoom 12; `{target:'reset'}` returned center 9.082, 8.6753 at zoom 6; the bundled `FC-02-D43-LG-01` returned a postcode action carrying the full landmark record and its coordinates. Through `runTool`, `Narnia` and `Atlantis` each returned `not_found`, while a missing target, `{target:'state'}` with no `state`, and a conflicting state-plus-lga object each returned `invalid_args` (the union members are strict objects so an extra field is rejected rather than silently ignored); zero page errors; lint + build green.
- [x] **Step 2 - `mapAction` payload and app wiring** - Added `mapAction?: MapAction` to the response and message, a pure exported `deriveMapAction` in `responder.ts` with the shape guards `asMapCenter` and `asNamedCode`, and threaded it through `attachDerived`. In `App.tsx`, `handleMapAction` switches on the target and delegates to the existing `handleSelectLocation`, `handleResetBreadcrumbs`, `handleSelectState`, and `handleSelectLGA` handlers, so a spoken request leaves exactly the same state as a sidebar click (toasts and URL sync included); both props are passed to `AskAtlasPanel`, which calls `onMapAction` once after appending a reply carrying one. `handleViewLocation` sets `flyToCoords` and `flyToZoom` at 17 and raises a toast, and it backs the now-enabled `[View on map]` button, whose feature 8 placeholder title is gone. The button stays disabled when no handler is wired, so a bubble rendered without `onViewLocation` degrades safely.
  *Evidence (2026-10-09):* probe over the real `deriveMapAction`: state, LGA, postcode, and reset actions each round-tripped intact; the last action won across two turns; a failed result, an empty turn list, a non-`navigateMap` tool, a missing `target`, a non-numeric `center`, an LGA action with no `lga`, an unknown `target`, a non-object payload, and a postcode action with no `location` each returned `undefined`, while a valid reset still passed; zero page errors; `tsc --noEmit` confirms the new props flow through panel and bubble; lint + build green.
- [x] **Step 3 - map prompt guidance** - Added a map-control block to the system prompt: for "show me", "take me to", "go to", "zoom into", or "show me on the map", call `navigateMap` with one real target (state, lga, postcode, or reset); resolve an unresolved place name with `searchLocation` first; do not call it for a fact-only question; never invent a place to navigate to; and keep the reply brief because the map moves on its own. The lookup, exploration, decode, and nearby blocks are unchanged.
  *Evidence (2026-10-09):* probe of `buildSystemPrompt` for every reply language (en, yo, ha, ig): the map block, the reset target, the search-first rule, and the never-invent-a-place rule are all present, and the feature 4, 5, 6, and 7 blocks still appear; zero page errors; lint + build green.
- [x] **Step 4 - live map evidence** - Drove the real panel against the restarted dev server on port 3001.
  *Evidence (2026-10-09):* live panel, provider nvidia/nemotron-3-super-120b-a12b, zero page errors on every run. "Show me Lagos state on the map" moved the map to Lagos (scale bar 10 km) and the breadcrumb read "Nigeria > Lagos", with the existing Lagos toast raised. "Zoom into Ikeja" selected the LGA (reply carried the feature 5 `1 LGA Ikeja 11` row) and raised the Ikeja toast. "Reset the map" returned to the national view: breadcrumb back to "Nigeria", scale bar 200 km, and all 37 state markers visible. The `[View on map]` button on a decode reply was enabled (`disabled: false`, title "Show FC-02-D43-LG-01 on the map"); clicking it flew the map to the landmark at zoom 17 (scale bar 100 m) with the landmark marker centered. Screenshots `step4-lagos.png`, `step4-ikeja.png`, `step4-reset.png`, `step4-view-on-map.png`.
- [ ] **Step 3 - map prompt guidance** - Add a map-control block to the system prompt: when the user asks to see, show, go to, zoom into, or reset a place, call `navigateMap` with a real place name or code; resolve an unresolved name with `searchLocation` first; call `navigateMap` with `target: 'reset'` only when the user wants the national view back; never call it for a question that needs no map movement; and do not claim the map moved unless the tool returned an action. Keep the lookup, exploration, decode, and nearby blocks intact. *Done when:* `buildSystemPrompt` contains the map guidance for every reply language; lint and build green.

- [ ] **Step 4 - live map evidence** - Drive the real panel against the restarted dev server: "show me Lagos state" flies the map to Lagos and updates the breadcrumb; "zoom into Ikeja" selects the LGA; "reset the map" returns to the national view; the `[View on map]` button on a lookup reply flies to that postcode. *Done when:* the live replies move the map and update state as specified, or the probe records the honest fallback if the free-tier providers are down that run; screenshots saved; lint and build green.

## Files / areas

- `src/lib/tools/schemas.ts` - `navigateMapSchema` and its `TOOL_DESCRIPTIONS` entry (step 1).
- `src/lib/tools/types.ts` - `navigateMap` in `TOOL_NAMES`, `ToolName`, and `ToolResultMap`, plus the resolved action shape (step 1, load-bearing).
- `src/lib/tools/executors.ts` - the `navigateMap` executor (step 1).
- `src/lib/tools/registry.ts` - register `navigateMap` (step 1).
- `src/lib/tools/provider.ts` - `SCHEMAS.navigateMap` (step 1; the `Record<ToolName, ZodType>` forces it).
- `src/lib/ask/types.ts` - `MapAction`, `mapAction` on response and message (step 2, load-bearing).
- `src/lib/ask/responder.ts` - `deriveMapAction`, attach wiring (step 2).
- `src/App.tsx` - `applyMapAction`, panel prop (step 2).
- `src/components/ask/AskAtlasPanel.tsx` - `onMapAction` prop and the single call (step 2).
- `src/components/ask/AskAtlasMessageBubble.tsx` - `onViewLocation`, enable `[View on map]` (step 2).
- `src/server/ask/prompt.ts` - map guidance (step 3).

## Data / contracts

- Tool result: `navigateMap` returns `MapAction` itself, so one shape serves both the model and the client derivation.
- `MapAction`: `{ target: 'state'; state: { code: string; name: string }; center: [number, number]; zoom: number }` | `{ target: 'lga'; state: { code, name }; lga: { code, name }; center: [number, number]; zoom: number }` | `{ target: 'postcode'; postcode: string; location: PostcodeLocation }` | `{ target: 'reset'; center: [number, number]; zoom: number }`.
- `AskAtlasResponse.mapAction?: MapAction` and `AskAtlasMessage.mapAction?: MapAction`. Client-derived only; the server never sets it.
- `deriveMapAction(toolTurns)`: last `ok: true` `navigateMap` result that passes a light shape guard (`target` is one of the four, and the fields that target requires are present with the right types). A failed result or no call leaves it unset. Independent of the lookup, results, decoded, and nearby derivations.
- The action is applied once per reply, after the message is appended. A repeated identical question served from the reply cache re-applies its action, because the cached response still carries `mapAction`; that is the intended behavior for a navigation request.
- The tool validates but never acts. `App.tsx` stays the only place that mutates `flyToCoords`, `flyToZoom`, `breadcrumbs`, and `selectedLocation`, which keeps a conversational action identical to a sidebar click, including the existing toasts and URL sync.

## Testing

- No `test` command is declared in `AGENTS.md`, so the test gate is off and this feature ships on build plus browser evidence. If `/tests` is added later, `deriveMapAction` is a first candidate: pure and assertable with fixed turns per target plus failed and empty cases.
- No `Browser tests` command is declared; evidence is dev-server probes and screenshots on `localhost:3001`.
- Steps 1 and 2 are deterministic (probe pages importing the real modules; fabricated tool turns for the derivation). Step 3 asserts the built prompt text. Step 4 needs one live provider reply and real map movement.
- Probes must call `atlasStore.ensureHydrated()` first. `navigateMap` reads only the bundled snapshot, so it works offline like the hierarchy tools; a postcode target resolves through the same store path as `getPostcode` and inherits its gateway fallback and the browser-origin limitation already recorded in features 5 and 7.
- Every step: `npm run lint` (`tsc --noEmit`) and `npm run build`.

## Notes for the AI

- The architectural rule from the overview holds: the model requests a defined action, the app validates, then the app acts. Keep `navigateMap` side-effect free; anything that touches React state belongs in `App.tsx`.
- Reuse the existing handlers rather than adding parallel ones. `handleSelectState`, `handleSelectLGA`, `handleSelectLocation`, and `handleResetBreadcrumbs` already set breadcrumbs, fly the map, update the URL, and raise toasts; calling them keeps conversational navigation and sidebar navigation from drifting apart.
- `[View on map]` appears whenever a reply carries `location`, which features 4 and 6 both set. Enabling it is the visible payoff of this feature.
- Keep features 4, 5, 6, and 7 working. This feature adds a tool, a payload, and props; it changes no existing derivation or result shape.
- Client versus server: the tool, the derivation, and the wiring run client-side; only prompt text changes server-side. Provider keys stay server-side.
- No em dashes, no ellipsis character (use `...`), no `any`, no inline styles, functions under 50 lines.