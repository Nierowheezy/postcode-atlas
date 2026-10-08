# Nigerian Postcode Atlas — N-ATLAS Integration - Project Overview

<!-- buildflow:source-hash 042dffb0540de25c5442be3c0a4e2cf29bf56669e5fdaf94227d47ff35f6445c -->

> A conversational map for exploring Nigeria's digital addressing and postcode system, extending the existing Postcode Atlas.

## Problem

Nigeria's digital postcode hierarchy (state → LGA → district → area → unit → postcode) is structured but hard for ordinary users to navigate: they must know whether they need to search, decode, assemble, locate, or explore, and which lookup to perform. Postcode Atlas already makes the hierarchy visually explorable, but this project adds N-ATLAS on top so users can ask in natural language ("What's the postcode for Ikeja?", "Show me districts in Ikeja.") and get grounded answers.

Core principle: **N-ATLAS understands the request; Atlas tools retrieve authoritative data; the Atlas UI visualizes the result.** NIPOST/NDAPS data through the existing `postcodeClient` remains the source of truth — the model must never invent postcodes, districts, or LGAs.

## Users

- Primary: Nigerians seeking postcodes/location info, people new to the digital addressing hierarchy, users preferring natural questions over menus, students/researchers.
- Secondary: businesses, logistics/delivery users, developers, international users.
- Challenge judges: must quickly grasp what the Atlas does, what N-ATLAS adds, why N-ATLAS is needed, how grounding works, and why it's not a generic chatbot.

## Features

MVP, in build-plan order:

1. **Ask Atlas interface** - conversational entry point added to the existing Atlas.
2. **N-ATLAS integration** - connect Ask Atlas to N-ATLAS for NLU.
3. **Atlas tool layer** - expose postcode, location, hierarchy, nearby-search, and decoding capabilities as structured tools.
4. **Natural-language postcode lookup** - verified Atlas results from normal language.
5. **Natural-language location exploration** - states, LGAs, districts, areas, units via conversation.
6. **Postcode decoding** - conversational decode, explaining structure and location.
7. **Nearby location queries** - conversational nearby postcode areas/locations.
8. **Conversational map control** - AI requests navigate/zoom/select/highlight on the map.
9. **Grounded responses** - facts come from NIPOST/Atlas data, not model guesses.
10. **Conversation context** - follow-ups using current location, selected map state, previous conversation.
11. **Nigerian query handling** - common Nigerian English phrasing/terminology.
12. **Ambiguity handling** - clarify instead of guessing when unresolved.
13. **AI evaluation benchmark** - representative Nigerian queries, tool-selection and factual accuracy.
14. **Production hardening** - API failures, invalid tool calls, loading states, rate limits, security.
15. **Challenge-ready demo** - polished end-to-end conversational experience.
16. **Deployment readiness** - deploy and verify production app + N-ATLAS integration.

Post-MVP (17–23): address interpretation, multilingual queries (Yoruba/Hausa/Igbo/Pidgin), richer Atlas explanations, saved discoveries, developer API, developer docs, advanced evaluation.

Existing Atlas capabilities (map, explore/decode/assemble/locate, Hunt game, data/density views, themes, PWA) are treated as shipped and are not rebuilt.

## Data model

### Existing Atlas data (via postcodeClient → NIPOST/NDAPS)

- `State` - `code` (string, e.g. `LA`), `name`, `capital`, `zone` (geopolitical zone), `lgaCount`, `centroid` ([lat, lng])
- `Lga` - `code` (2-digit), `name`, `stateCode`
- `District` - `code` (e.g. `A12`), `name`?, `lgaCode`
- `Area` - `code` (2 letters), `districtCode`
- `Unit` - `code` (2 digits), `areaCode`, `coordinates`
- `Postcode` - `code` (`AA-99-H77-BB-55`), segments (state/lga/district/area/unit), location metadata, `coordinates`
- `DiscoveryPoint` - verified landmark postcode, `name`, `postcode`, `coordinates`

### N-ATLAS runtime data (ephemeral, no persistence in MVP)

- `ConversationMessage` - `role`, `content`, `timestamp`
- `AtlasContext` - `selectedState?`, `selectedLga?`, `selectedDistrict?`, `selectedArea?`, `selectedPostcode?`, `mapCoords?`
- `ToolCall` - `tool`, `args`, `result`, `error?`

### Evaluation benchmark entry

- `EvalCase` - `query`, `expectedIntent`, `expectedTool`, `expectedLocation?`, `expectedResult?`, `acceptable` (bool)

## Tech stack

- **React 19 + TypeScript + Vite** - existing SPA framework
- **Tailwind CSS + Leaflet/React-Leaflet + Motion + Lucide** - existing styling/map/animation/icons
- **N-ATLAS** - model integration, requires structured tool/function calling with strict schemas
- **existing `postcodeClient.ts`** - sole NIPOST data path; in-memory caching stays
- **Zod (if it fits)** - typed schemas for tool args/results, identifiers, postcode responses
- **No new global state library** - AI layer talks to existing React state via explicit validated actions

### Atlas tool layer (names per project-plan §3, finalized in implementation)

`searchLocation`, `getState`, `getLgas`, `getDistricts`, `getAreas`, `getPostcode`, `decodePostcode`, `getNearby`, `navigateMap`

Architectural constraint: N-ATLAS cannot directly mutate app state; it requests a defined action, the app validates (e.g. `navigateMap({state:"LA"})` → validate → `flyTo(Lagos)`), then acts.

## Monetization

Not in MVP. Public Atlas stays free; potential future developer API (free/developer/business tiers), business integrations, enterprise services. No subscriptions/payments/ads/accounts in MVP.

## UI/UX

Keep the existing Atlas visual identity — an interactive geographic instrument, not a generic AI chatbot. Map-first, clean, fast, minimal noise, AI integrated not dominant.

- `Ask Atlas` - chat-style entry point extending existing search; concise responses with `[View on map]` actions and a grounding indicator ("Verified against NIPOST postcode data" where verifiable)
- Response tone: prefer short factual answers over long prose
- Loading: `Understanding your request…` / `Finding the location…`
- Errors: state inability clearly + suggest a rephrased query; ask clarifying questions for ambiguous locations
- Constraint: AI UI must not obscure the map on mobile; keyboard-accessible, sufficient contrast, no critical functionality map-only

## Deployment

- **Vercel**, static Vite SPA (`npm run build` → `dist/`), existing SPA rewrites in `vercel.json`
- Dev: `npm run dev` (port 3001)
- Env: `VITE_NIPOST_PUBLISHABLE_KEY` (publishable only, never `sk_`)
- N-ATLAS credentials: if a secret server-side credential is required, add a minimal Vercel Function proxy (`/api/health` if introduced); do **not** put it in `VITE_*`. Exact architecture depends on official N-ATLAS auth requirements (`> TODO`)
- No database, no workers/cron, existing PWA/version-check preserved; AI requests need network but cached Atlas resources keep working offline

## Open questions

- N-ATLAS API/auth requirements unverified — decides whether a server proxy is needed (`> TODO`)
- Exact N-ATLAS tool schemas/names to be finalized during `/feature 3`
- Build plan items 1–4 (Ask Atlas UI, integration, tool layer, lookup) are all unchecked; existing Atlas features are documented as pre-build and intentionally not tracked as features
