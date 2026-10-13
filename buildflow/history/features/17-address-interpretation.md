# Feature: Address interpretation

**From build-plan:** feature 17
**Status:** verified

## Goal

Let a user paste a Nigerian address (for example "12 Allen Avenue, Ikeja, Lagos")
into Ask Atlas and get back the part of the Atlas hierarchy the data can actually
support: the state, the LGA, the district and area when a postcode or verified
landmark pins them, and the postcode when the address or a matching verified
landmark carries one. The parts the Atlas cannot place - house numbers, street
names, local descriptions - come back as unplaced rather than turned into an
invented postcode.

Why it matters: ordinary users give an address, not a state/LGA/postcode menu.
The Atlas can already search a place name, decode a postcode, and assemble one
from chosen segments, but it cannot yet take the shape people actually have - a
full address on one line - and say what it resolves to and what it does not.
"Where supported" is the honest boundary of the feature, not a marketing line:
NIPOST/NDAPS through `atlasStore`/`postcodeApi` stays the only source of truth.

## Design reference

Not a visual feature; there is no target image. The reply surface reuses the
existing Ask Atlas message pattern (the `VerifiedLookup` chip from feature 4 and
the `AtlasResultList` list from feature 5), so it reads as another grounded Atlas
answer. Intent lives in `buildflow/project-plan.md` section 7 (UI/UX, grounding)
and `buildflow/build-plan.md` item 17.

## In scope

- A structural address parser: split a free-text address into ordered parts,
  pull out a dashed or compact postcode, and classify each part as a street,
  a postcode, or a place.
- A resolver that places those parts in the hierarchy using the existing Atlas
  data, and reports what it placed and what it could not.
- A new `interpretAddress` tool in the Atlas tool layer, so the chat loop can
  call it with the same validation and error contract as the other tools.
- Grounding in the Ask pipeline: prompt guidance to call the tool when the user
  gives a full address, and a client-side derivation so the rendered answer
  comes from the tool result, never from the model's prose.
- A reply surface in the Ask Atlas panel: the resolved breadcrumbs, a postcode
  chip, the unplaced parts, and a `[View on map]` action when a state or LGA
  resolved.

## Out of scope

- **Geocoding arbitrary streets, house numbers, or unnamed landmarks.** NDAPS has
  no street or house-number index, so "12 Allen Avenue" cannot be placed beyond
  its Ikeja, Lagos parent. This feature reports that boundary; it does not invent
  coordinates, and it does not add a geocoder or a second data path.
- **Address verification scoring, deliverability, or correction suggestions.**
  Those belong to the future developer API and business workflows (items 21-22).
- Changes to the map-search box (`src/components/search/MapSearch.tsx`), the
  assemble/disassemble drawer, or the `searchLocation` tool.
- Reverse geocoding, nearby search, or any provider call the tools do not
  already use.
- Multilingual address phrasing beyond what feature 18 already does for queries.
- Persisting addresses, adding storage, or changing any stored shape.

## Data / contracts

`src/lib/address/types.ts` (new) is the contract. `InterpretedAddress` is
**load-bearing**: the future developer API (item 21) will expose this shape, so
keep it stable and documented.

- `AddressSegment { text: string; kind: 'postcode' | 'street' | 'place' }` - one
  comma, semicolon, or newline-separated part, normalized. A street-type word or
  a leading house number makes it `street`; a postcode token makes it `postcode`;
  everything else is a `place` candidate for a state, LGA, or landmark.
- `ParsedAddress { raw: string; segments: AddressSegment[]; postcode?: string }` -
  the pure parser's output, no data lookups.
- `AddressLookup` - the injected adapter the resolver reads, so resolution is
  testable without IndexedDB or the network:
  - `states(): Promise<AtlasState[]>`
  - `lgas(state: string): Promise<AtlasLga[]>`
  - `discoveryPoints(): Promise<PostcodeLocation[]>`
  - `search(query: string): Promise<LocationCandidate[]>` (wraps the trusted
    `atlasStore.searchLocations`, so a part that is a known area/landmark can
    still be placed)
  - `lookupPostcode(code: string): Promise<PostcodeLocation | null>`
- `InterpretedAddress`:
  - `input: string`
  - `state?: { code: string; name: string }`
  - `lga?: { code: string; name: string }`
  - `district?: { code: string; name?: string }`
  - `area?: { code: string; name?: string }`
  - `postcode?: { code: string; verified: boolean }`
  - `landmark?: { name?: string; postcode: string }`
  - `unresolved: string[]` - the input parts that were not placed
  - `resolvedTo: 'none' | 'state' | 'lga' | 'district' | 'area' | 'postcode'` -
    the deepest level the data supported

`interpretAddress` tool args: `{ text: string }`, 1 to 300 characters. Result:
`InterpretedAddress`. Add `interpretAddress: InterpretedAddress` to
`ToolResultMap`, and `address?: InterpretedAddress` to `AskAtlasResponse` and
`AskAtlasMessage`.

The postcode's `verified` follows the feature 4 meaning: true only when the code
resolves to a record (a bundled verified landmark or a confirmed gateway lookup);
a pattern-valid code with no record stays `verified: false`. No code is ever
synthesized.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Split and classify an address** - add `src/lib/address/parse.ts`
  with `parseAddressText(text)` returning `ParsedAddress`, and
  `src/lib/address/parse.test.ts`. Split on commas, semicolons, and newlines;
  trim and collapse whitespace; drop empties; move a dashed
  (`AA-99-H77-BB-55`) or compact (11-character) postcode into its own segment and
  the top-level `postcode`; classify each remaining segment `street` when it
  carries a street-type word (close, street, avenue, road, crescent, way, drive,
  lane, boulevard, expressway) or a leading house number (`12`, `No. 5`,
  `Flat 3B`), otherwise `place`. *Done when:* tests cover comma, semicolon, and
  newline splitting; whitespace and empty segments; a dashed and a compact
  postcode; house-number and street-type detection; a mixed part such as
  "12 Allen Avenue"; an all-place address; empty and non-address input; and
  preserved segment order.

- [x] **Step 2 - Resolve the parts against the Atlas data** - add
  `src/lib/address/types.ts` and `src/lib/address/resolve.ts` with
  `resolveAddress(parsed, lookup)` taking an injected `AddressLookup`, plus
  `resolve.test.ts`. Resolve a parsed postcode, or a landmark match, first
  through the lookup for its segments and names; otherwise match `place`
  segments to a state (name, code, or the existing `STATE_ALIASES`), then to an
  LGA inside that state, then fall back to `lookup.search(segment)` for a place
  the Atlas already knows (an LGA, district, area, or landmark). Match discovery
  points by name and address tokens. When a segment matches more than one
  distinct place (two LGAs of the same name, or a state name that is also an LGA
  name), do not pick one silently: leave it in `unresolved` unless an explicit
  state or LGA elsewhere in the address disambiguates it. Leave everything else
  in `unresolved` and set `resolvedTo` to the deepest level actually found.
  *Done when:* tests cover "12 Allen Avenue, Ikeja, Lagos" resolving to Lagos and
  Ikeja with the street unplaced; an address with a verified postcode filling
  district and area; a state-only address; a landmark match; a place name that is
  a valid LGA but not a state (resolve it as a place, as the existing tools do);
  an unknown place landing in `unresolved`; an ambiguous segment staying
  unresolved while a certain state resolves alongside it; ambiguity resolved by
  an explicit state elsewhere in the address; and no postcode appearing when the
  input carries none.

- [x] **Step 3 - Expose `interpretAddress` as a tool** - add `src/lib/address/lookup.ts`
  building an `AddressLookup` from `atlasStore` and `postcodeApi`, then the
  executor in `src/lib/tools/executors.ts`, and register the tool:
  `interpretAddress` in `TOOL_NAMES` and `ToolResultMap` (`src/lib/tools/types.ts`),
  the Zod input and a `TOOL_DESCRIPTIONS` line (`schemas.ts`), the provider
  schema map (`provider.ts`), and `registry.ts`. *Done when:*
  `runTool('interpretAddress', { text: '12 Allen Avenue, Ikeja, Lagos' })` returns
  the resolved shape, an empty or over-long `text` yields `invalid_args`,
  `ATLAS_PROVIDER_TOOLS` advertises the tool, executor tests pass, and Verify is
  green.
  *Evidence (2026-10-13):* a dev probe asserted `ATLAS_PROVIDER_TOOLS` carries
  `interpretAddress` with a `text` object schema and an address description;
  `executors.test.ts` covers the resolved shape, the honest state-only case, and
  the `invalid_args` boundary through `runTool`; full Verify green (140 tests at
  that step).

- [x] **Step 4 - Ground it in the Ask pipeline** - add `address?: InterpretedAddress`
  to `AskAtlasResponse` and `AskAtlasMessage` (`src/lib/ask/types.ts`), derive it
  in a new `deriveAddress` (`src/lib/ask/responder.ts`), and add the tool
  guidance plus an address-aware scope line to `src/server/ask/prompt.ts` (call
  `interpretAddress` when the user gives a full address rather than a bare place
  name, and never state a postcode the tool did not return). *Done when:* a
  completed `interpretAddress` tool turn yields an `address` payload on the
  reply, `responder.test.ts` covers an address turn and the no-address case, the
  system prompt lists the tool, and Verify is green.
  *Evidence (2026-10-13):* a dev probe over `buildSystemPrompt` for every reply
  language (en, yo, ha, ig) shows the `interpretAddress` block and the
  never-state-an-unreturned-postcode rule, with the feature 4-10 blocks intact;
  `responder.test.ts` covers `deriveAddress` on an address turn, the last-wins
  case, a failed or unrelated turn, and a bad shape; `grounding.test.ts` covers
  the placed and placed-nothing cases; full Verify green (145 tests).

- [x] **Step 5 - Show the resolution in the reply** - add
  `src/components/ask/AskAtlasAddress.tsx` and render it from `AskAtlasPanel.tsx`
  when a message carries `address`: the resolved breadcrumbs (State > LGA >
  district/area), a postcode chip marked verified or unverified, the unplaced
  parts under a short note that NDAPS has no street or house-number index, and a
  `[View on map]` action routed through the existing `onMapAction` when a state
  or LGA resolved. *Done when:* direct browser evidence (system Chrome, dev
  server) shows "12 Allen Avenue, Ikeja, Lagos" rendering Lagos and Ikeja with
  the street unplaced; an address carrying a postcode showing the chip; an
  address that resolves to nothing showing the honest empty result; the map
  action centring the resolved state or LGA; the block rendering at 390x844
  without clipping; and the desktop presentation unchanged. No browser test
  runner is declared in `AGENTS.md`, so this rides on a scratch probe, not a
  harness.
  *Evidence (2026-10-13):* system Chrome against the dev server (Vite on 3002,
  because 3001 was already serving), with the panel restored from a seeded
  conversation. The three cards rendered: "Lagos LA > Ikeja LA-05" with
  "12 Allen Avenue" unplaced and no postcode; "Lagos LA > Ikeja LA-05 > A10 >
  BB" with the LA-05-A10-BB-02 chip tagged "Verified postcode" and "Allen
  Avenue" unplaced; and "Nothing in this address matched the Atlas hierarchy."
  with both parts unplaced. Clicking [View on map] on the Ikeja card moved the
  map from Z: 6.0 to Z: 12.0 and set the header breadcrumb to Lagos. At 390x844
  the panel rect stayed inside the viewport (top 212, bottom 820) with no
  horizontal overflow and the last card unclipped. At 1280x900 the
  empty-conversation geometry was unchanged from feature 24b (card 420, panel
  602, list 480). Zero page errors. Screenshots: desktop-address.png,
  desktop-after-view-on-map.png, mobile-390x844.png, mobile-390x844-bottom.png,
  desktop-empty-1280x900.png.

## Files / areas

- `src/lib/address/types.ts` (new) - `AddressSegment`, `AddressLookup`,
  `InterpretedAddress`.
- `src/lib/address/parse.ts` and `parse.test.ts` (new) - the structural parser.
- `src/lib/address/resolve.ts` and `resolve.test.ts` (new) - the resolver.
- `src/lib/address/lookup.ts` (new) - the `atlasStore`/`postcodeApi` adapter.
- `src/lib/tools/types.ts`, `schemas.ts`, `provider.ts`, `registry.ts`,
  `executors.ts`, `executors.test.ts` - the new tool.
- `src/lib/ask/types.ts`, `responder.ts`, `responder.test.ts` - the derived
  payload.
- `src/server/ask/prompt.ts` - tool guidance and scope.
- `src/components/ask/AskAtlasPanel.tsx`, `src/components/ask/AskAtlasAddress.tsx`
  (new) - the reply surface.

## Testing

- `src/lib/address/parse.test.ts`, `resolve.test.ts` - the new pure logic
  (vitest, node environment), following the `src/lib/**/*.test.ts` convention.
- `src/lib/tools/executors.test.ts` - the new executor: invalid args, a resolved
  address, and a no-match address, with the store boundary mocked as the
  existing cases do.
- `src/lib/ask/responder.test.ts` - `deriveAddress` on an address tool turn and
  its absence otherwise.
- No component or browser runner exists, so Step 5's UI rides on direct browser
  evidence (screenshots and a scratch probe) as in features 24a and 24b.
- Verify with the project command: `npm run test && npm run lint && npm run build`.

## Notes for the AI

- Grounding is the point. Reuse `atlasStore`, `postcodeApi`, and the existing
  resolution helpers (`resolveState`, `findLgaByName`, `STATE_ALIASES`,
  `trimQualifier`). Do not add a geocoder, a street index, or a second data path.
- Districts and areas are code-only in NDAPS, so name matching rarely places
  them; they are filled from a resolved postcode's segments or a verified
  landmark, and left unplaced otherwise. Do not guess.
- Keep the parser structural and pure, and the resolver dependent on an injected
  `AddressLookup`, so both are unit-testable without IndexedDB or the network.
- Match the tool-layer conventions exactly: one Zod schema as the single
  validation source, a `TOOL_DESCRIPTIONS` line, a `provider.ts` schema entry, a
  `registry.ts` registration, and the executor error contract (`ToolFault` for
  typed errors, `invalid_args` from the schema).
- Client versus server: the parser, resolver, executor, and derivation run in the
  browser; only the `/api/ask` prompt guidance is server-side. The server never
  runs the parser, only the tool schema in the prompt.
- The reply must never show a postcode that did not come from a resolved record;
  the `verified` flag keeps the feature 4 meaning.
- `InterpretedAddress` is load-bearing for the developer API (item 21). Keep the
  shape stable.
- Stay inside 17. Do not build address verification, correction, or a public API
  here; those are items 21 and 22.
- No em dashes, en dashes, or the ellipsis character; use hyphens. Follow the
  existing file conventions: SPDX header comment, JSDoc on exported members,
  comments that explain why.
