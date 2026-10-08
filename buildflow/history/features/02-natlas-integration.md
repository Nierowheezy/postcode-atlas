# Feature: N-ATLAS integration

**From build-plan:** feature 2 (MVP)
**Status:** verified

## Goal

Make Ask Atlas answer with a real LLM instead of canned stub replies. One
server-side endpoint holds the keys, calls providers through a single
OpenAI-compatible adapter, and fails over automatically across free-tier
providers whose daily quotas run out, with an N-ATLAS slot first in line for
when credentials arrive.

Decisions already made with the user (do not relitigate):

- **No model switcher.** Failover is background engineering, not user choice.
  Each reply carries a small engine meta line (`via gemini-3.1-flash-lite - attempt 1`)
  for transparency.
- **Keep the existing panel.** No Grok-style chat window; map-first principle.
- **No settings screen.** One meaningful control only: a reply-language chip
  (English / Yoruba / Hausa / Igbo), since multilingual support is N-ATLAS's
  differentiator.
- **Keys never reach the browser.** Provider keys stay server-side in
  `api/ask.ts` (Vercel Function) and the Vite dev middleware. This was already
  anticipated in `project-overview.md` (Deployment section).
- **TanStack Query on the client** (React Query, added at the user's request
  during Step 1). `useMutation` drives the chat call: retry with exponential
  backoff only on transient failures (network, 5xx), `isPending` for the typing
  indicator, and an in-memory response cache so repeated identical questions do
  not burn free-tier quota. The same QueryClient gives features 3+ a ready
  `useQuery` layer for grounded lookups. Client retry is transport-level only;
  provider failover stays server-side in the chain (Step 3). No streaming.

## In scope

- `POST /api/ask` endpoint: Vercel Function for production, same handler
  mounted as Vite dev middleware so `npm run dev` keeps working.
- Provider chain: Gemini (`gemini-3.1-flash-lite`, proven live) -> OpenRouter (free
  tool-capable model) -> NVIDIA (NIM), all through one OpenAI-compatible
  `fetch` adapter. Sequential failover on 429 / quota 403 / 5xx / timeout /
  network error, with per-attempt timeout and in-memory cooldown.
- N-ATLAS provider slot, prepended when `NATLAS_*` env is set (OpenAI-compatible
  assumed; Awarri docs unverified `> TODO`), with required attribution when it
  serves a reply.
- Client responder swap: `createApiResponder()` replaces the stub as the default;
  the stub stays reachable via `VITE_ASK_MODE=stub` as a quota-free dev escape
  hatch.
- Multi-turn: the panel passes recent history; the server caps it (last 10).
- System prompt: short factual tone, current-map context line, reply-language
  directive, and the hard rule: never invent postcodes, districts, or LGAs.
- Reply-language chip + engine meta line in the panel.
- All-providers-down error copy mapped onto the existing error state.
- Client query layer: `QueryClientProvider` in `main.tsx`, a `useAskAtlas()`
  custom hook (`useMutation` + response cache + retry policy), a typed
  `AskApiError` so retries fire only on transient failures, and the panel split
  into small custom components (`AskAtlasHeader`, `AskAtlasMessageBubble`,
  `AskAtlasComposer`).
- Server-side in-memory reply cache in the handler, keyed like the client
  cache (text + language + selection), TTL 10 min, capped size. Repeated
  identical questions across visitors on a warm instance answer from memory so
  free-tier quota is not burned per ask. Per-instance and best-effort; a
  shared KV cache is a later optimization, and per-user abuse limits are
  feature 14. Every genuinely new turn still costs exactly one provider call.

## Out of scope

- Token streaming (deferred until the tool pipeline in feature 3+ exists; the
  typing indicator covers perceived latency for now).
- Structured tool calls and grounded postcode data (features 3, 4, 9).
- Advanced follow-up/context resolution (feature 10), Nigerian-phrasing tuning
  (11), ambiguity flows (12).
- Retry/backoff polish, monitoring, security hardening, and authentication or
  abuse rate-limiting on `/api/ask` (feature 14). See the Notes warning.
- Deploy verification and Vercel dashboard env setup (feature 16; this spec
  only documents which vars to set).
- Multilingual reliability guarantees and Pidgin (feature 18). The chip is a
  basic prompt directive, not a reliability claim.
- Adopting zod (manual validation now; zod arrives with feature 3 tools if at
  all), and removing the unused `@google/genai` dependency (housekeeping).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Contract evolution + API responder + query layer (client)** -
  change `AskAtlasResponder.respond` to a single request object
  (`{ text, context, history?, language? }`) so history and language travel
  together; add `AskLanguage` and the optional `engine` field to
  `AskAtlasResponse`; add `src/lib/ask/api-types.ts` (API request/response/error
  shapes); add `createApiResponder()` in `responder.ts` (POST `/api/ask`,
  content-type guard because Vite's SPA fallback answers unknown routes with
  `index.html` + 200, mapped error messages); add `AskApiError` (kind +
  retryable flag), a `QueryClientProvider` in `main.tsx`, and a `useAskAtlas()`
  custom hook wrapping `useMutation` (retry with exponential backoff on
  transient failures only, response cache keyed on text + language +
  selection); split the panel into `AskAtlasHeader` / `AskAtlasMessageBubble` /
  `AskAtlasComposer` components; App selects the API responder by default and
  the stub only when `VITE_ASK_MODE=stub`; the panel passes its message history
  on each call. *Done when:* `npm run lint` + `npm run build` pass, in the
  browser a message with no server yet renders the existing error state
  (service-unavailable copy, no crash, no retry storm on 404), a repeated
  identical question answers from the reply cache (stub-mode timing proof in
  Step 1; no-second-POST proof against the real endpoint in Step 2; failures
  are never cached so retries still reach the network), and
  `VITE_ASK_MODE=stub` still serves the canned `!fail` behavior.

- [x] **Step 2 - Server core: provider call, prompt, handler, routes** - add
  `src/server/ask/providers.ts` (registry of gemini/openrouter/nvidia with
  base URLs, env-key lookup accepting both `GEMINI_API_KEY` and the existing
  `GEMNINI_API_KEY` typo, model defaults, one OpenAI-compatible `fetch` call
  with 15 s `AbortController` timeout), `src/server/ask/prompt.ts` (minimal
  system prompt for now: role + reply language), `src/server/ask/handler.ts`
  (POST-only, body validation: text 1..500 chars, history max 10 entries
  filtered to `user`/`assistant` and mapped to bare `{ role, content }` (strip
  ids, timestamps, context, location, error-role entries), language enum; runs the first configured provider only), `api/ask.ts` (Vercel wrapper,
  `export const maxDuration = 60`, reads `process.env`), and the Vite
  `configureServer` middleware using `loadEnv` (env object passed to the
  handler, never to `import.meta.env`); add `@types/node` devDep and include
  `node` in tsconfig `types`. *Done when:* after restarting `npm run dev`
  (vite.config changed), `curl -X POST http://localhost:3001/api/ask` returns a
  real Gemini reply JSON with an `engine` object, the panel renders that reply
  with the `unverified` grounding indicator, and lint + build pass.

- [x] **Step 3 - Failover chain + quota resilience** - add
  `src/server/ask/chain.ts`: provider order from `ASK_AI_ORDER` (default
  `gemini,openrouter,nvidia`), sequential attempts with per-attempt timeout,
  in-memory cooldown (429 honours `Retry-After` else 10 min, quota 403 15 min,
  best effort per warm instance), and the all-failed 503 response
  (`all_providers_unavailable` + `retryAfterSeconds`); handler switches to the
  chain; client maps 503 to the daily-limits error copy. *Done when:* with a
  forced first-provider failure via `ASK_AI_ORDER` (bogus model override), curl
  shows `engine.attempt > 1` and a successful reply still renders in the panel;
  with every configured provider failing, the panel shows the daily-limits
  error state, not a crash.

- [x] **Step 4 - System prompt, language chip, engine meta** - flesh out
  `prompt.ts` (short factual tone, current-selection context line from
  `AtlasContextSnapshot`, reply-language directive, and the never-invent
  postcodes/districts/LGAs rule with honest "Atlas data tools not connected
  yet" handling for specific postcode asks); panel: small reply-language select
  (EN/YO/HA/IG) in the header, engine meta line under each assistant message,
  history included in the request. *Done when:* with the chip on Yoruba a test
  question comes back in Yoruba; "What's the postcode of Zedville?" yields no
  fabricated postcode; a follow-up question references the previous turn; the
  meta line reads `via gemini-3.1-flash-lite - attempt 1`; lint + build pass.
  *Evidence (2026-10-08, model = `gemini-3.1-flash-lite`):* browser chip=YO ->
  real Yoruba reply "Postcode fun Ikeja, Lagos ni **100271**..."; provider probe
  for Zedville refuses without fabricating ("I do not have information on a
  location called 'Zedville'..."); curl follow-up with history answers "Yes,
  Alausa is located within the Ikeja area and typically falls under the 100271
  postcode." (references the prior turn); meta line `via gemini-3.1-flash-lite
  - attempt 1` in browser + curl; panel error copy unchanged and no crash under
  sustained Gemini throttling; lint + build pass. Panel is also expandable
  (auto-grows to 70vh; drag handle sets an explicit px height; users can grow
  the conversation).

- [x] **Step 5 - N-ATLAS slot, attribution, final evidence pass** - add the
  `natlas` provider (env `NATLAS_BASE_URL`, optional `NATLAS_API_KEY`,
  `NATLAS_MODEL`; prepended to the chain only when the base URL is set; skipped
  silently otherwise) and the attribution line (Awarri/NCAIR, link to the HF
  model card) shown only when N-ATLAS actually served a reply; document the
  Vercel env var names (names only) in the spec's Testing section for feature
  16; run the full evidence pass. *Done when:* with a dummy
  `NATLAS_BASE_URL` curl shows the chain starting at natlas and succeeding via
  fallback (`engine.attempt = 2`), unsetting it restores the normal chain,
  lint + build pass, and the browser evidence below is green.
  *Evidence (2026-10-08):* dummy `NATLAS_BASE_URL=http://127.0.0.1:59999/v1`
  -> server log `[ask] provider natlas failed (server): Provider natlas
  unreachable: fetch failed`, then Gemini answered with `engine.attempt = 2`
  and text "The general postcode for Ikeja, Lagos, is 100271."; unset ->
  Gemini straight through with `engine.attempt = 1` (no natlas attempt);
  lint + build pass. Browser (mock OpenAI-compatible NATLAS endpoint on
  59999): panel rendered the mock N-ATLAS reply with the attribution line
  "Served by N-ATLAS, Nigeria's open multilingual model by Awarri & NCAIR."
  plus a working link to `https://huggingface.co/NCAIR1/N-ATLaS`, engine meta
  `via NCAIR1/N-ATLaS - attempt 1`, zero console errors. NVIDIA default
  switched after a live sweep to `nvidia/nemotron-3-super-120b-a12b` (the only
  free-endpoint model that fits the 15 s budget and actually answers; glm-5.3
  is inconsistent, gpt-oss-20b refuses everything). Note: N-ATLAS ships under
  Awarri's Open-Source Research and Innovation License, which requires
  attribution, caps public use at 1,000 active end-users per 30 days, and
  needs a separate agreement for commercial deployment; flagged for review.

## Files / areas

- New server: `src/server/ask/providers.ts`, `src/server/ask/chain.ts`,
  `src/server/ask/prompt.ts`, `src/server/ask/handler.ts`, `api/ask.ts`
- New client: `src/lib/ask/api-types.ts`, `src/lib/ask/errors.ts`,
  `src/lib/ask/queryClient.ts`, `src/lib/ask/useAskAtlas.ts`,
  `src/components/ask/AskAtlasHeader.tsx`,
  `src/components/ask/AskAtlasMessageBubble.tsx`,
  `src/components/ask/AskAtlasComposer.tsx`,
  `src/components/ask/AskAtlasResizeHandle.tsx` (drag-to-resize conversation
  area plus auto-grow default)
- Changed client: `src/lib/ask/types.ts` (request-object contract, `engine`),
  `src/lib/ask/responder.ts` (`createApiResponder`), `src/App.tsx` (responder
  selection), `src/main.tsx` (`QueryClientProvider`),
  `src/components/ask/AskAtlasPanel.tsx` (composition, history, language chip,
  engine meta, error copy, expandable conversation list: auto-grows to 70vh
  and honors an explicit px height from the resize handle),
  `src/components/ask/AskAtlasMessageBubble.tsx` (N-ATLAS attribution line +
  model card link, shown only when `engine.provider === 'natlas'`)
- Changed server: `src/server/ask/providers.ts` (natlas slot prepended when
  `NATLAS_BASE_URL` set, optional `NATLAS_API_KEY`, default model
  `NCAIR1/N-ATLaS`, conditional auth header),
  `src/server/ask/chain.ts` (natlas allowed in `ASK_AI_ORDER` and prepended to
  the default order when `NATLAS_BASE_URL` set), NVIDIA default model
- Config: `vite.config.ts` (dev middleware + `loadEnv`), `tsconfig.json`
  (`types`), `package.json` (`@types/node` devDep, `@tanstack/react-query`
  dep), `.env.example` note: keys are server-only; do **not** add `VITE_`
  prefixes (N-ATLAS slot vars documented)

## Data / contracts

Load-bearing; features 3+ build on these:

- `AskAtlasRequest` - `{ text: string; context: AtlasContextSnapshot;
  history?: AskAtlasMessage[]; language?: AskLanguage }`. This replaces the
  feature 1 positional `respond(text, ctx)` signature; the archived feature 1
  spec records the old shape. The panel stays implementation-agnostic.
- `AskLanguage` - `'en' | 'yo' | 'ha' | 'ig'`.
- `AskAtlasResponse.engine?` - `{ provider: 'gemini' | 'openrouter' | 'nvidia' |
  'natlas'; model: string; attempt: number }`; absent on stub replies.
- `AskApiError` (`src/lib/ask/errors.ts`) - `kind` one of `network` |
  `service-unavailable` | `bad-request` | `all-providers-unavailable` |
  `unexpected`, plus `retryable`. Client retry policy: exponential backoff,
  max 2 retries, only when `retryable` (network + 5xx); never on 400/503
  quota. Cache key: trimmed text + language + selected state/LGA/postcode.
- API: `POST /api/ask` -> `200` with the `AskAtlasResponse` JSON; `400
  { error: { code: 'bad_request', message } }` on invalid input; `503
  { error: { code: 'all_providers_unavailable', retryAfterSeconds } }` when the
  chain is exhausted. Content type `application/json` on every response.
- Server-only env contract: `GEMINI_API_KEY` (also accept the existing
  `GEMNINI_API_KEY` spelling), `OPENROUTER_API_KEY`, `NVIDIA_API_KEY`,
  `ASK_AI_ORDER`, optional `NATLAS_BASE_URL` / `NATLAS_API_KEY` /
  `NATLAS_MODEL`, model overrides `ASK_AI_MODEL_GEMINI` /
  `ASK_AI_MODEL_OPENROUTER` / `ASK_AI_MODEL_NVIDIA`. Client env: only
  `VITE_ASK_MODE`.
- Provider defaults (free lists rotate; re-verify at implementation):
  gemini `gemini-3.1-flash-lite` (current-gen lite: much higher free-tier RPM
  than the retired-for-new-users `gemini-2.5-flash`; verified correct on
  English, Yoruba, and fabricated-place refusal probes), openrouter
  `nvidia/nemotron-3-ultra-550b-a55b:free`, nvidia
  `nvidia/nemotron-3-super-120b-a12b` (verified live 2026-10-08: fast, honest
  refusals on fabricated places, and actually answers within the 15 s budget;
  the older `nvidia/llama-3.1-nemotron-70b-instruct` id 404s on this account
  and glm-5.3 is inconsistent). N-ATLAS slot defaults to `NCAIR1/N-ATLaS`
  when `NATLAS_MODEL` is unset. All tool-capable so feature 3 does not need a
  model migration.

## Testing

No test runner and no `Verify` command are declared in `AGENTS.md`, so no unit
gate applies; verify with:

- `npm run lint` and `npm run build` after every step.
- curl against `http://localhost:3001/api/ask` (dev server restart required
  after Step 2, because `vite.config.ts` changed). Keep request bodies small;
  the keys live in `.env` and are never printed.
- Browser evidence per step's done-when (dev server on port 3001): happy-path
  reply, error states (service-unavailable and daily-limits), failover engine
  meta, language chip, 375 px width with the panel open, dark + light theme,
  zero console errors.
- Vercel env names for feature 16 (set in the dashboard, values never in the
  repo): `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `NVIDIA_API_KEY`, plus the
  optional `NATLAS_*` and `ASK_AI_ORDER`.
- If `/tests` later lands, the in-scope logic worth testing here is the
  failover chain (order, timeout, cooldown decisions) and the request-body
  validation; note that rather than installing a runner mid-feature.

## Notes for the AI

- `buildflow/context/coding-standards.md` still contains default Next.js /
  Prisma sections; this project is a Vite/React SPA. Follow the real code:
  functional components, Tailwind utilities, no inline styles, no `any`.
- No em dashes (U+2014) in code, comments, specs, or UI copy.
- Import direction: `src/server/*` may import types from `src/lib/ask/*`;
  client code must never import `src/server/*`. Provider keys are read only in
  `src/server/*` and `api/ask.ts`.
- The `.env` file has a stray quote around line 6 that breaks `source .env` in
  zsh, and the `GEMNINI_API_KEY` misspelling; accept both spellings in code,
  and offer the user the rename (their file, their call).
- `/api/ask` may be shadowed on Vercel by the SPA catch-all rewrite
  `/(.*) -> /index.html` in `vercel.json`; functions normally win over
  rewrites, but verify this during the feature 16 preview deploy and add an
  explicit `/api` exclusion only if proven necessary.
- Keep the stub responder working; it is the quota-free path for UI work and
  the offline-honest error path stays in the API responder.
- `/api/ask` is unauthenticated in this feature by design; feature 14 owns auth
  and abuse controls. Until then anyone who finds the endpoint can spend
  provider quota (caps here limit each call, not who calls). Say so plainly at
  review time so the user accepts the risk consciously.
- Response tone per project overview: short factual answers; loading copy is
  already "Understanding your request..." in the panel.
