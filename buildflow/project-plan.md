# Project Plan

> One of the two planning docs for the Nigerian Postcode Atlas N-ATLAS integration. This project extends the existing Nigerian Postcode Atlas into a conversational map and postcode exploration experience powered by N-ATLAS. The existing Atlas remains the primary data and visualization layer; N-ATLAS provides natural-language understanding and orchestration.

## 1. Problem - What problem are we solving?

Nigeria's digital postcode/addressing system contains a structured hierarchy of states, LGAs, districts, areas, units, and postcodes, but this structure is not always easy for ordinary users to understand or navigate.

The existing Nigerian Postcode Atlas makes this information visually explorable through a map and structured navigation, but users still need to understand how to navigate the hierarchy or know which specific lookup operation to perform.

This project adds a conversational interface powered by N-ATLAS so users can interact with the existing Atlas using natural language.

Instead of requiring users to know whether they need to search, decode, assemble, locate, or explore, they can simply ask:

- "What's the postcode for Ikeja?"
- "Show me districts in Ikeja."
- "Which LGA is Yaba in?"
- "Decode this postcode."
- "What areas are around here?"
- "How does this Nigerian postcode work?"
- "Take me to Lagos."
- "Show me the postcode for this location."

N-ATLAS will understand the user's intent and determine which Atlas capability is appropriate.

The application will not rely on the language model's internal knowledge for authoritative postcode information. NIPOST/NDAPS data accessed through the existing Atlas API layer remains the source of truth.

The core product becomes:

> **A conversational map for exploring Nigeria's digital addressing and postcode system.**

The goal is to demonstrate a practical Nigerian AI application where N-ATLAS provides natural-language intelligence while deterministic application tools provide authoritative Nigerian geographic and postcode data.

### Core architecture principle

**N-ATLAS understands the request.**

**Atlas tools retrieve authoritative data.**

**The Atlas UI visualizes the result.**

The model should not invent postcodes, districts, LGAs, or other authoritative geographic information.

---

## 2. Users - Who is this for?

### Primary users

- Nigerians looking for postal codes or location information.
- People unfamiliar with Nigeria's new digital postcode/addressing hierarchy.
- Users who prefer asking questions naturally instead of navigating hierarchical menus.
- Students and researchers exploring Nigerian geography and addressing data.
- Developers and innovators interested in experimenting with Nigeria-specific AI applications.

### Secondary users

- Businesses that need to understand Nigerian locations and postcodes.
- Delivery and logistics users.
- Developers building applications around Nigerian addressing data.
- International users who need to understand Nigerian locations.

### Challenge/judging audience

The project should also be understandable to an N-ATLAS challenge judge within a short demonstration.

A judge should immediately understand:

1. What the existing Atlas does.
2. What N-ATLAS adds.
3. Why N-ATLAS is necessary.
4. How the application grounds AI responses in authoritative data.
5. Why the solution is useful beyond being a generic chatbot.

---

## 3. Features - What does the MVP need?

### Existing Atlas capabilities

- Interactive Nigeria map.
- State → LGA → District → Area → Unit exploration.
- Postcode lookup and inspection.
- Postcode decoding.
- Postcode assembly through hierarchical selection.
- Browser location lookup.
- Nearby location search.
- Deep-linked state and postcode views.
- Postcode Hunt exploration game.
- Data/telemetry view.
- Density visualization.
- Dark/light themes.
- Existing PWA/offline infrastructure.

### N-ATLAS capabilities

- Conversational "Ask Atlas" interface.
- N-ATLAS-powered natural-language intent recognition.
- N-ATLAS tool calling/orchestration.
- Nigerian English query understanding.
- Natural-language postcode lookup.
- Natural-language state/LGA/district/area exploration.
- Natural-language postcode decoding.
- Natural-language postcode assembly where practical.
- Natural-language nearby-location queries.
- Natural-language map navigation commands.
- Context-aware follow-up questions.
- Grounded answers based on Atlas/NIPOST API results.
- Clear distinction between authoritative data and AI-generated explanations.

### Atlas tools exposed to N-ATLAS

The AI layer should have access to a deliberately small set of application tools, such as:

- `searchLocation`
- `getState`
- `getLgas`
- `getDistricts`
- `getAreas`
- `getPostcode`
- `decodePostcode`
- `getNearby`
- `navigateMap`

Exact names and schemas will be finalized during implementation based on the existing codebase.

### UI integration

- Add an "Ask Atlas" entry point to the existing application.
- Display AI responses alongside relevant Atlas data.
- Allow AI responses to trigger map navigation.
- Highlight locations returned from AI queries.
- Allow users to continue conversations using the current Atlas context.
- Provide clear loading, error, and unavailable-data states.

### Evaluation

- Create a small benchmark of representative Nigerian queries.
- Test standard English queries.
- Test Nigerian English/Pidgin-style queries.
- Test ambiguous location queries.
- Test postcode decoding queries.
- Test hierarchical navigation queries.
- Measure tool-selection accuracy.
- Measure factual accuracy of returned postcode/location data.
- Record failed/ambiguous cases for iteration.

---

## 4. Data - What are we storing?

The MVP should remain primarily client-side and should avoid introducing a database unless the N-ATLAS integration requires one.

### Existing application data

- Nigerian states.
- State metadata.
- LGA information.
- District information.
- Area information.
- Unit information.
- Postcodes.
- Geographic coordinates.
- State centroids.
- State capitals.
- Geopolitical zones.
- Map/discovery points.
- Verified landmark postcodes.

### N-ATLAS interaction data

During the MVP, conversations should preferably remain ephemeral.

Potential runtime data includes:

- Conversation messages.
- Current Atlas context.
- Selected state.
- Selected LGA.
- Selected district.
- Selected area.
- Selected postcode.
- Current map coordinates.
- Tool calls.
- Tool results.
- AI response metadata.
- Error states.

This data does not need to be persisted to a user account for the challenge MVP.

### Evaluation data

A local/static benchmark should contain:

- User query.
- Expected intent.
- Expected tool.
- Expected location/postcode where applicable.
- Expected result.
- Whether the model response is acceptable.

Example:

```text
Query:
"What's the postcode for Ikeja?"

Expected intent:
postcode_lookup

Expected tool:
getPostcode

Expected location:
Ikeja, Lagos
```

### No user database in MVP

The MVP does not require:

- User accounts.
- Profiles.
- Saved conversations.
- Payment information.
- User dashboards.
- Persistent chat history.

---

## 5. Tech - What stack are we using?

The project will extend the existing Nigerian Postcode Atlas rather than introduce a separate application.

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Leaflet
- React Leaflet
- Motion
- Lucide React

### AI

- N-ATLAS as the primary AI/model integration.
- Structured tool/function calling where supported.
- Strict schemas for tool inputs and outputs.
- Application-controlled tool execution.
- N-ATLAS responses treated as untrusted instructions/data and validated before affecting the application.

### Existing data/API

- NIPOST/NDAPS API.
- Existing `postcodeClient.ts` abstraction.
- Existing API response normalization.
- Existing in-memory caching.

### Validation

Use strongly typed schemas for:

- Tool arguments.
- Tool results.
- Location identifiers.
- Postcode responses.
- AI action requests.

Zod may be introduced if it fits the existing codebase and N-ATLAS integration requirements.

### State management

Continue using the existing React application state architecture where practical.

Do not introduce Redux, Zustand, or another global state library unless implementation reveals a genuine need.

The AI layer should communicate with existing application state through explicit actions rather than directly manipulating arbitrary UI state.

### Architecture

```text
User
  │
  ▼
Ask Atlas UI
  │
  ▼
N-ATLAS
  │
  │ natural-language understanding
  │ tool selection
  ▼
Atlas Tool Layer
  │
  ├── searchLocation()
  ├── getState()
  ├── getLgas()
  ├── getDistricts()
  ├── getAreas()
  ├── getPostcode()
  ├── decodePostcode()
  ├── getNearby()
  └── navigateMap()
          │
          ▼
Existing postcodeClient
          │
          ▼
NIPOST / NDAPS API
          │
          ▼
Structured result
          │
          ▼
Atlas UI + Map
```

### Important architectural constraint

N-ATLAS must not directly control arbitrary application state.

The AI can request a defined action, but the application validates the request and decides what actually happens.

For example:

```text
N-ATLAS:
navigateMap({
  state: "LA"
})

        ↓

Application:
validate state "LA"

        ↓

Atlas:
flyTo(Lagos)
```

---

## 6. Monetize - How will this make money?

The challenge MVP is not primarily a monetization product.

The immediate objective is to demonstrate a useful N-ATLAS-powered Nigerian application.

The public Atlas should remain free.

Potential future monetization could include:

### Developer API

Offer a commercial API for applications that need:

- Nigerian postcode lookup.
- Address hierarchy resolution.
- Location search.
- Nearby postcode lookup.
- Nigerian addressing data.

Possible model:

- Free tier.
- Developer tier.
- Business/API usage tier.

### Business integrations

Provide addressing/location functionality for:

- Logistics companies.
- E-commerce platforms.
- Delivery services.
- Fintech onboarding systems.
- Address verification workflows.

### Enterprise services

Potentially provide higher-volume location and addressing APIs with:

- Usage limits.
- SLA.
- Monitoring.
- Dedicated support.

### Explicit MVP exclusion

No:

- subscriptions,
- payments,
- advertisements,
- API billing,
- user accounts,
- premium plans

will be implemented for the N-ATLAS challenge MVP unless required by the challenge.

---

## 7. UI/UX - How should this look and feel?

The existing Nigerian Postcode Atlas visual identity should remain the foundation.

The product should feel like an **interactive geographic instrument**, not a generic AI chatbot.

### Core principles

- Map-first.
- Clean.
- Fast.
- Nigerian context.
- Data-oriented.
- Minimal visual noise.
- AI integrated into the Atlas rather than dominating it.
- No generic "AI dashboard" aesthetic.

### Ask Atlas

The primary AI interaction should feel like a natural extension of the existing search functionality.

Example:

```text
┌─────────────────────────────────────────────┐
│ Ask Atlas                                   │
│                                             │
│ "What's the postcode for Ikeja?"        →   │
└─────────────────────────────────────────────┘
```

Response:

```text
I found Ikeja, Lagos.

Postcode: 100001

Lagos
└── Ikeja
    └── [District]
        └── 100001

[View on map]
```

The map should simultaneously navigate to the relevant location.

### AI response design

Responses should be concise and useful.

Prefer:

```text
Ikeja is in Lagos State.

Postcode: 100001

[View on map]
```

over a long conversational response.

### Grounding indicator

Where appropriate, show that factual information came from the Atlas/NIPOST data layer.

Example:

```text
Verified against NIPOST postcode data
```

The exact wording should reflect what can actually be verified by the underlying API.

### Loading state

The user should understand that the AI is processing a request without seeing raw implementation details.

Example:

```text
Understanding your request…
Finding the location…
```

### Error states

Examples:

```text
I couldn't confidently identify that location.

Try:
"postcode for Ikeja, Lagos"
```

or:

```text
I found the location, but NIPOST did not return a postcode for it.
```

### Ambiguity

The AI should ask for clarification instead of guessing.

Example:

> "Which Ikeja do you mean?"

where multiple interpretations genuinely exist.

### Responsive design

The existing Atlas must continue to work on:

- Desktop.
- Tablet.
- Mobile.

The AI interface must not obscure the map on smaller screens.

### Accessibility

- Keyboard-accessible interaction.
- Clear focus states.
- Sufficient contrast.
- Screen-reader-friendly controls.
- No critical functionality dependent solely on map interaction.

---

## 8. Deployment - Where and how will this ship?

### Frontend

Deploy the existing React/Vite application to:

**Vercel**

Application type:

- Static React SPA.
- Vite production build.
- Existing SPA rewrite configuration.

### Build

```bash
npm run build
```

### Development

```bash
npm run dev
```

The existing development port should remain unchanged unless implementation requires otherwise.

### Output

Vite production output:

```text
dist/
```

### Existing environment variables

The current project uses:

```text
VITE_NIPOST_PUBLISHABLE_KEY
```

This must remain a publishable key only.

A secret NIPOST key must never be placed in a `VITE_*` environment variable because Vite exposes these values to the browser.

### N-ATLAS configuration

N-ATLAS credentials/configuration must follow the official N-ATLAS integration requirements.

If N-ATLAS requires a secret server-side credential, it must **not** be exposed through a `VITE_*` environment variable.

In that case, introduce a minimal server-side/API boundary, such as:

```text
Vercel Function
       ↓
N-ATLAS
```

while keeping the existing NIPOST client architecture intact.

The exact architecture will be determined after verifying the official N-ATLAS API/authentication requirements.

### Database

No database is required for the MVP.

### Storage

No persistent application storage is required for the MVP.

### Workers / Cron

No worker or scheduled job is required for the MVP.

The existing version-checking mechanism may remain unchanged.

### Health check

For a static deployment, no traditional server health endpoint is required.

If a server-side N-ATLAS proxy is introduced, provide:

```text
/api/health
```

returning a simple healthy/unhealthy response.

### PWA

Preserve the existing:

- manifest
- service worker
- Workbox configuration
- offline caching strategy

where compatible with the new AI functionality.

AI requests obviously require network access, but previously cached Atlas resources should continue to function where possible.

### Domain

Continue using the existing Nigerian Postcode Atlas deployment/domain initially.

A custom domain can be added later if needed.

### Deployment principle

The final deployment should remain simple:

```text
User
  ↓
Vercel
  ↓
React Atlas
  ├── NIPOST/NDAPS API
  └── N-ATLAS API/proxy
```

No unnecessary backend infrastructure should be introduced unless required by N-ATLAS security or API requirements.

---

## Explicit MVP Exclusions

The following are intentionally outside the MVP:

- Building a new map engine.
- Replacing the existing NIPOST API integration.
- Training or fine-tuning a new language model.
- Building a general-purpose Nigerian chatbot.
- General web search.
- General Nigerian knowledge retrieval.
- User accounts.
- Persistent chat history.
- Payments.
- Subscriptions.
- Advertising.
- Multi-agent architecture.
- Vector database/RAG infrastructure without a demonstrated need.
- Mobile-native applications.
- Rebuilding existing Explore, Decode, Assemble, Locate, or Hunt functionality.
- Allowing the model to invent or directly modify authoritative postcode data.
- Claiming that AI-generated information is official NIPOST information.
- Adding unrelated AI features merely to increase the feature count.

The MVP succeeds if a user can **naturally talk to the Atlas, have N-ATLAS correctly understand the request, retrieve authoritative postcode/location information through application tools, and see the result reflected in the existing map and Atlas interface.**
