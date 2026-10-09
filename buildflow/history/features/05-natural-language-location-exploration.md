# Feature: Natural-language location exploration (5)

**From build-plan:** feature 5
**Status:** verified

## Goal

Let people explore Nigeria's postal hierarchy by conversation: ask for the states, the LGAs of a state, the districts of an LGA, the areas of a district, and the known verified postcode units in a scope. N-ATLAS picks the tool, the Atlas tools retrieve from the local NIPOST dataset (never the model), and the reply shows a short grounded list beside the prose. This turns Ask Atlas from a single-postcode lookup into a browsable hierarchy driven by plain language.

## In scope

- A new `getStates` tool that lists all states, completing the hierarchy tool set.
- Name-or-code argument handling for the hierarchy tools: `getLgas`, `getDistricts`, and `getAreas` resolve a state name to its code and an LGA name to its code, so "LGAs in Lagos" works without a manual code step.
- A client-derived exploration result contract (`AtlasResultList`) built from the executed tool results, with the last list-producing result winning (same precedence rule as the feature 4 lookup).
- Bundled verified postcode units for the current scope: discovery landmarks filtered by postcode segment, capped, shown as a secondary section.
- System-prompt guidance telling N-ATLAS when and how to list the hierarchy, and that a state, LGA, district, or area has no single postcode.
- A results-list UI in the assistant bubble: level, count, and scope header; rows with name, code, and parent context; a "+N more" line; and the known-units section. Selectable text, dark mode, list semantics.
- One line added to the panel's empty-state hint with an exploration example.

## Out of scope

- Postcode decoding presentation (feature 6).
- Radius/coordinate "near me" unit lists through `getNearby` (feature 7). Feature 5's units are hierarchy-scoped bundled landmarks only.
- Map navigation, zoom, selection, and highlight (feature 8). `[View on map]` stays disabled.
- Conversation context and pronoun follow-ups (feature 10): the existing history window is unchanged.
- Nigerian phrasing coverage (feature 11) and the ambiguity clarification flow (feature 12). The list shows candidates but adds no new disambiguation step.
- A server-side proxy for the NIPOST gateway and any bundling of districts/areas. See the data reality in Notes.
- No new dependencies, no change to the 3c transport loop, no gateway change.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - `getStates` and hierarchy argument resolution** - Add `getStates` to the tool layer (schema, description, registry, provider schema map, `ToolName`, `ToolResultMap`). Extract a `resolveState(wanted)` helper from `getState` that returns the matched record and add `resolveLgaCode(stateCode, wanted)`, then make `getLgas`, `getDistricts`, and `getAreas` resolve the state and LGA before reading the store. District stays code-only (no name resolution). An unresolved state or LGA throws `ToolFault('not_found', ...)`, matching `getState`. *Done when:* a browser probe that hydrates the store first shows `getStates` returns 37 rows; `getLgas {state: "Lagos"}` and `getLgas {state: "LA"}` both return the 20 Lagos LGAs; `getDistricts {state: "Lagos", lga: <Lagos LGA name>}` resolves past the name; `getLgas {state: "Narnia"}` returns `not_found`; lint and build green.
  *Evidence (2026-10-09):* browser probe over the hydrated real bundle: `getStates` 37 rows; `getLgas` by name "Lagos" and code "LA" each returned the 20 Lagos LGAs; `getDistricts {Lagos, Ikeja}` resolved the name to a code before the store call; `getLgas {Narnia}` and a bad LGA each returned `not_found`; zero page errors; lint + build green.

- [x] **Step 2 - exploration result contract and derivation** - Add `AtlasResultList` and `AtlasResultItem` to `types.ts` plus a `results` field on `AskAtlasResponse` and `AskAtlasMessage`. Add `deriveResults(toolTurns)` to the responder: map successful `getStates`, `getLgas`, `getDistricts`, `getAreas`, and `searchLocation` results into rows, resolve the scope label from the local store, and keep the last list-producing result. Make the reply attach step async (it now reads the store) and thread `results` beside the existing `lookup`. A failed result or an empty array leaves the list unset. *Done when:* a probe calling `deriveResults` with fabricated turns returns correct rows and scope for each tool, returns `undefined` for an empty array or a failed result, and keeps the existing `deriveLookup` output unchanged; lint and build green.
  *Evidence (2026-10-09):* browser probe calling `deriveResults` returned the expected level, scope, scopePath, and rows for `getStates`/`getLgas`/`getDistricts`/`getAreas`/`searchLocation`; an empty array, a failed result, and no turns each returned `undefined`; the last list wins across turns; `deriveLookup` output unchanged; zero page errors; lint + build green.

- [x] **Step 3 - bundled verified units for the scope** - When the derived list is an LGA, district, or area list, filter the bundled discovery points by the scope's postcode segments (state, then state and LGA, then state, LGA, and district), map matches to `unit` rows, cap at 8, and attach `units` and `unitsTotal`. *Done when:* a probe shows known Lagos units for an LGA scope, no units for a scope with no bundled landmarks, and the cap respected with `unitsTotal` above 8 via the extracted pure selector (`selectScopeUnits`, 20 synthetic rows give 8 shown); lint and build green.
  *Evidence (2026-10-09):* browser probe: the real bundled landmark `FC-02-D43-LG-01` ("The Infrastructure Bank PLC") attached to an area scope with parent "Abuja Municipal Area Council, Federal Capital Territory"; the densest state scope (Lagos) attached 2 real units; a scope with no bundled landmarks attached none; the pure `selectScopeUnits` gave 8 shown / 20 total for 20 synthetic rows and 1/1 for a duplicate; zero page errors; lint + build green.

- [x] **Step 4 - results-list UI** - Add `AskAtlasResultsList` and render `message.results` under the prose in `AskAtlasMessageBubble`. Header reads "<total> <level> in <scope>" (or "<total> matches" with no scope), rows show name or code with the code in a muted mono and parent context, the list shows at most 12 rows with a "+N more" line, and the units section reads "Known verified postcode units". Use `<ul>`/`<li>` list semantics, dark mode tokens, and selectable text. Add an exploration example to the panel empty state. *Done when:* a demo probe with fabricated lists renders light and dark screenshots for a state list, an LGA list, and a units list; rows are selectable; truncation shows "+N more"; zero console errors.
  *Evidence (2026-10-09):* demo probe over the real component in light and dark: headings "20 LGAs in Lagos", "37 states", "2 matches", "2 districts in Ikeja, Lagos"; the "Known verified postcode units" section with the landmark name and postcode; "+17 more", "+34 more", "+1 more"; the landmark row was selectable; zero console errors; screenshots `step4-light.png` and `step4-dark.png`. lint + build green.

- [x] **Step 5 - exploration prompt guidance** - Add a listing and exploration block to the system prompt: use `getStates`, `getLgas`, `getDistricts`, `getAreas` for list and explore requests, resolve an unknown place name with `searchLocation` first, never claim a postcode for a state, LGA, district, or area, and keep the prose short because the interface lists the rows. *Done when:* a live reply to "list the LGAs in Lagos" calls `getLgas` and renders the list with the verified footer; "what states are there" calls `getStates`; a plain postcode question still behaves as feature 4; screenshots saved.
  *Evidence (2026-10-09):* live panel against the restarted dev server: `buildSystemPrompt` contains the exploration guidance, `getStates`, and the no-single-postcode rule; "List the LGAs in Lagos" -> "20 LGAs in Lagos" and "What states are there?" -> "37 states", both grounded with the verified footer, first attempt each; zero page errors; screenshots `step5-lgas.png` and `step5-states.png`. lint + build green.

## Files / areas

- `src/lib/tools/schemas.ts` - `getStatesSchema` and its `TOOL_DESCRIPTIONS` entry (step 1).
- `src/lib/tools/types.ts` - `getStates` in `ToolName`, `TOOL_NAMES`, and `ToolResultMap` (step 1, load-bearing).
- `src/lib/tools/executors.ts` - `getStates`; `resolveState` and `resolveLgaCode`; resolved `getLgas`, `getDistricts`, `getAreas` (step 1).
- `src/lib/tools/registry.ts` - register `getStates` (step 1).
- `src/lib/tools/provider.ts` - `SCHEMAS.getStates` (step 1; the `Record<ToolName, ZodType>` forces it).
- `src/lib/ask/types.ts` - `AtlasResultList`, `AtlasResultItem`, `results` on response and message (step 2, load-bearing for features 6 to 9).
- `src/lib/ask/responder.ts` - `deriveResults`, async attach, units enrichment (steps 2 and 3).
- `src/components/ask/AskAtlasResultsList.tsx` - new list component (step 4).
- `src/components/ask/AskAtlasMessageBubble.tsx` - render the results list (step 4).
- `src/components/ask/AskAtlasPanel.tsx` - pass `results` from the reply; empty-state example (step 4).
- `src/server/ask/prompt.ts` - exploration guidance (step 5).

## Data / contracts

New client shape, load-bearing for features 6 to 9:

```ts
export interface AtlasResultItem {
  type: 'state' | 'lga' | 'district' | 'area' | 'unit';
  code: string;
  name?: string;
  parent?: string;
}

export interface AtlasResultList {
  level: 'state' | 'lga' | 'district' | 'area' | 'unit';
  scope?: string;
  scopePath?: { state?: string; lga?: string; district?: string };
  items: AtlasResultItem[];
  total: number;
  units?: AtlasResultItem[];
  unitsTotal?: number;
}
```

- `AskAtlasResponse.results?: AtlasResultList` and `AskAtlasMessage.results?: AtlasResultList`.
- New tool result: `getStates: AtlasState[]` (existing `{ code, name }` records).
- Precedence mirrors `deriveLookup`: the last successful list-producing tool result wins; a failed or empty result leaves `results` unset. `results` and `lookup` can both attach to one reply.
- Mapping: `getStates` gives `state` rows; `getLgas` gives `lga` rows scoped to the state name; `getDistricts` gives `district` rows scoped to the LGA name; `getAreas` gives `area` rows scoped to the district. `searchLocation` maps each candidate by its `type`, with `landmark` becoming `unit`; for a mixed search reply `level` is the type of the first row. `total` is the number of rows before display capping.
- Verification: the list is built only from executed tool results, so it always travels with `grounding: 'atlas'` and the existing "Verified against NIPOST postcode data" footer.

## Testing

- No `test` command is declared in `AGENTS.md`, so the test gate is off and this feature ships on build plus browser evidence. If `/tests` is added later, the pure logic here is the first candidate: `resolveState`, `resolveLgaCode`, `deriveResults`, and `selectScopeUnits` (the unit filter), each assertable with fixed inputs and empty or malformed cases.
- No `Browser tests` command is declared; evidence is dev-server probes and screenshots on `localhost:3001`.
- Probes must call `atlasStore.ensureHydrated()` first. The NIPOST gateway rejects the browser origin (`403 origin_not_allowed`), so browser-side reads answer from the bundled `/atlas-data.json` snapshot only.
- States and LGAs verify against the real bundled snapshot. Districts and areas are never bundled, so their store and tool path is verified with a small fixture snapshot written into IndexedDB for the probe; the live district/area data stays gateway-served and appears only where the key's origin is allowed. This is a deliberate best-effort path, not a data bug.
- Steps 1 to 4 are deterministic (probe pages importing the real modules; fabricated tool turns for the derivation, the units filter, and the UI). Step 5 needs one live provider reply. The free-tier chain is flaky, so retry, or use the `ASK_AI_ORDER` override for evidence only and restore it after.
- Every step: `npm run lint` (`tsc --noEmit`) and `npm run build`.

## Notes for the AI

- Keep the 3b tool result shapes stable. Only add `getStates` and change argument handling. Feature 4's lookup derivation, chip, and footer must not regress.
- Client versus server: the tools, resolution, and derivation run client-side; only prompt text changes server-side. Provider keys stay server-side.
- Data reality for districts and areas: NDAPS exposes roughly 222,277 code-only districts and about 5M code-only areas, with no names, so 3a left them out of the snapshot (about 290 MB otherwise) and the store reads them through the gateway. They have no human names, so district and area rows are codes by nature. Do not add a proxy or bundle them in this feature.
- The store keys reads by code (`readRange('lgas', [state.toUpperCase()])`), so name resolution must happen before the store call, not inside it.
- `deriveResults` should return early, with no store reads, when no successful list-producing result is present, so a plain postcode lookup never triggers a store read or a gateway fallback. Resolve scope labels and units in one pass.
- No em dashes, no ellipsis character (use `...`), no `any`, no inline styles, functions under 50 lines.
- Cap rendered rows at 12 and units at 8, and keep the totals in the payload for the "+N more" line. Never let the model restate the whole list in prose.
