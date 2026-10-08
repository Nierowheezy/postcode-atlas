# Feature: Ask Atlas interface

**From build-plan:** feature 1 (MVP)
**Status:** verified

## Goal

Add a conversational "Ask Atlas" entry point to the existing Nigerian Postcode Atlas: a panel where a user types a natural-language question and sees a rendered conversation. This feature ships the UI shell and the responder contract with a stub responder only; N-ATLAS wiring is feature 2, real tools are feature 3+.

It matters because it is the visible surface every later N-ATLAS feature plugs into. The message model and responder contract defined here are load-bearing.

## Design reference

- `buildflow/project-plan.md` §7 (UI/UX) contains the ASCII wireframes for the Ask Atlas panel and response format: input row, concise reply, `[View on map]` action slot, grounding indicator, loading and error copy.
- No `prototypes/` and no image mockup exists yet. If you have a screenshot/mockup, put it in `buildflow/reference/` and link it here before Step 2 starts.

## In scope

- "Ask Atlas" button in `TopBar`, toggling a panel layered over the map.
- Panel: message list (user/assistant), input + send, empty state, loading state ("Understanding your request..."), error state, clear button.
- Message model and `AskAtlasResponder` contract, with a `createStubResponder()` returning canned replies so the full UI is exercisable before N-ATLAS exists.
- Context snapshot captured on each send (selected state/LGA/postcode, map center/zoom) and stored on the message.
- Grounding flag per assistant message (`'atlas' | 'unverified'`), rendered as the grounding indicator text; stub replies carry `'unverified'`.
- Disabled `[View on map]` action slot rendered when an assistant message carries a location affordance (no-op; map control lands in feature 8).
- Responsive behavior: panel must not obscure the map on mobile; keyboard-accessible; dark/light theme.

## Out of scope

- N-ATLAS integration, real NLU, real tool calls (features 2 and 3).
- Any actual map navigation from AI replies (feature 8).
- Conversation persistence, history across reloads, multi-turn context logic (feature 10).
- Conversation context follow-up resolution, ambiguity flows, Nigerian phrasing (features 10-12).
- PWA/service worker changes.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Contracts and stub responder** - add `src/lib/ask/types.ts` with `AskAtlasMessage`, `AtlasContextSnapshot`, `AskAtlasResponse`, and the `AskAtlasResponder` interface; add `createStubResponder()` (canned reply map, artificial ~400 ms delay, rejects for input beginning with `!fail` so the error path is observable). *Done when:* `npm run lint` passes, and a quick dev-console call to the stub returns a typed response and rejects for `!fail`.

- [x] **Step 2 - Panel shell and entry point** - add `src/components/ask/AskAtlasPanel.tsx` (reusing the existing `DraggableCard` pattern) with empty state, message list, input, send button, clear, loading and error rendering driven by local state; add the "Ask Atlas" toggle to `TopBar` and mount the panel in `App.tsx`. *Done when:* clicking Ask Atlas opens the panel, it can be dismissed, the empty state shows before the first message, and the app still builds and behaves as before with the panel closed.

- [x] **Step 3 - Message flow** - wire send -> loading -> responder -> render: user message appears immediately, loading copy shows while awaiting, assistant reply renders with grounding indicator and timestamp, failures render the error state with the plan's suggested-rephrase copy; capture `AtlasContextSnapshot` at send time and store it on the message; wire the disabled `[View on map]` slot when a stub reply flags one. *Done when:* a normal message ends as user + assistant messages with an `unverified` grounding indicator; `!fail` renders the error state without breaking the panel; whitespace-only input never sends; clearing resets to the empty state.

- [x] **Step 4 - Responsive, keyboard, theme pass** - verify the panel placement at mobile widths (map must stay usable), Tab/Enter/Escape handling (Escape closes), focus into the input on open, and correct rendering in both themes. *Done when:* at 375 px width the map is still draggable with the panel open, Enter sends, Escape closes, and dark and light screenshots both look correct.

## Files / areas

- New: `src/lib/ask/types.ts`, `src/lib/ask/responder.ts` (stub), `src/components/ask/AskAtlasPanel.tsx`
- Changed: `src/App.tsx` (panel state + mount), `src/components/navigation/TopBar.tsx` (toggle button), possibly `src/index.css` if any panel-specific styles are needed (prefer Tailwind classes)

## Data / contracts

Load-bearing; later features depend on these shapes:

- `AtlasContextSnapshot` - `selectedState?`, `selectedLga?`, `selectedDistrict?`, `selectedArea?`, `selectedPostcode?`, `mapCenter` ([lat, lng]), `mapZoom` (per project-plan §4 / overview data model).
- `AskAtlasResponder` - `respond(text: string, ctx: AtlasContextSnapshot): Promise<AskAtlasResponse>`; feature 2 supplies the N-ATLAS implementation behind this same interface.
- `AskAtlasResponse` - `text`, `grounding: 'atlas' | 'unverified'`, optional `location?: { lat: number; lng: number; label: string }` (slot only; acting on it is feature 8).
- `AskAtlasMessage` - `id`, `role: 'user' | 'assistant' | 'error'`, `content`, `grounding?`, `context?`, `timestamp`.
- No API shape changes; NIPOST client untouched.

## Testing

No test runner is declared in `AGENTS.md` (`npm run lint` is typecheck only), so no unit-test gate applies. Verify with:

- `npm run lint` and `npm run build` after every step.
- Direct browser evidence per step's done-when (dev server on port 3001), including the `!fail` error path and a 375 px width screenshot for Step 4.
- If a test runner is later added via `/tests`, the stub responder's input->reply mapping is the in-scope logic worth a test; note this in the spec rather than installing a runner mid-feature.

## Notes for the AI

- `buildflow/context/coding-standards.md` is still the default Next.js template; this project is a Vite/React SPA with no server, no Prisma, no Server Actions. Ignore those sections; follow the actual code: functional components, Tailwind utility classes, no inline styles, no `any`.
- No em dashes (U+2014) in comments, specs, or UI copy; use hyphens or colons.
- Keep `App.tsx` as the single owner of panel open/close state; the panel is presentational and receives props plus the responder instance.
- The responder is injected, never imported directly by the panel, so feature 2 swaps the stub for N-ATLAS without touching UI code.
- Do not fetch NIPOST in this feature; the stub is self-contained. No new dependencies.
- Reuse existing UI atoms (`DraggableCard`, `Toast`, `lucide-react` icons) before writing anything new.
