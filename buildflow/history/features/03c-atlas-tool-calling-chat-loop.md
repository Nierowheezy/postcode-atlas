# Feature: Tool-calling chat loop (3c)

**From build-plan:** feature 3c (MVP, split from feature 3)
**Status:** verified

## Goal

Wire the 3b Atlas tools into the Ask provider chain so the model can request Atlas data, and give the chat layer a small multi-round loop: the client executes each tool call locally through 3b `runTool` and feeds the verified results back until the model answers from them. Also keep an honest text-only path - when a model does not call tools (or a provider rejects the tools payload), it must answer from prompt-guided general knowledge and say plainly what it cannot verify, never inventing postcodes or places.

## Design reference

None. Behavioral/infrastructure feature; no visual target.

## In scope

- **Provider tools payload** - one OpenAI-compatible serializer over the 3b zod schemas (`z.toJSONSchema`), memoized, exactly the eight tools: `{ type: 'function', function: { name, description, parameters } }`.
- **Server provider layer** - `callProvider` accepts `tools` and parses `choices[0].message.tool_calls` into a stable `AskToolCall` shape; a provider that rejects the tools payload with HTTP 400 is retried once without tools (the transport-level honest fallback) before the chain moves on.
- **Multi-round but stateless `/api/ask`** - the request may carry `toolTurns` (assistant tool_calls + client-executed tool results); the server appends them to the provider messages after the last user text, and a non-final round answers with `toolCalls` instead of text. The client drives the loop; the server never executes a tool.
- **Client loop** - `createApiResponder` runs each `AskToolCall` through `runTool`, builds `AskToolResult`s, posts the next round, capped at 3 tool rounds per ask. A failed tool call is a *successful result* (`ok: false` with the 3b error taxonomy) that feeds back so the model can self-correct - never a thrown error.
- **Grounding wiring** - a final reply that followed at least one successful tool result returns `grounding: 'atlas'`; text-only replies stay `'unverified'`. Load-bearing for feature 9's indicator.
- **System prompt** - replace the "tools are not connected yet" copy: tools are connected, describe when to call each, call `searchLocation` when a place is ambiguous, and keep the honest text-only rules (say plainly when a tool returns `[]` or an error).

## Out of scope

- Any UI or message rendering for tool calls, chips, or grounding indicators (features 4-9); `navigateMap` (feature 8); conversation context (feature 10); ambiguity UX (feature 12).
- Server-side tool execution: tools run client-side by design so data lookups make zero LLM provider calls.
- Retraining or changing models/providers; the existing failover chain and `ASK_AI_ORDER` behavior stay.
- New NIPOST endpoints, snapshot changes, or provider/key changes.
- Per-sentence citation and content-level grounding (feature 9).
- `AskAtlasMessage`/history-type changes: tool turns travel in `toolTurns`, never in `history`.

## Build loop

Build one step at a time, never the whole feature at once. Plan mode lays out each step before any code; the AI implements just that step, shows the diff, and `/implement` ticks the box. Progress is tracked in this file, so a fresh session resumes from the first unchecked step.

- [x] **Step 1 - shared tool-call contracts + provider tools serializer** - extend `src/lib/ask/types.ts` with `AskToolCall`, `AskToolResult`, `AskToolTurn`; add `toolTurns?: AskToolTurn[]` to `AskAtlasRequest` and `toolCalls?: AskToolCall[]` to `AskAtlasResponse` (`text` may be `''` when `toolCalls` is present). Add `src/lib/tools/provider.ts` exposing `toProviderTools()` (memoized `ATLAS_PROVIDER_TOOLS`) built with `z.toJSONSchema` over the 3b schemas.
  *Done when:* `npm run lint` + `npm run build` green; a dev probe imports `provider.ts` and asserts 8 entries, names match `ToolName`, each `parameters` is a JSON Schema object (`type: 'object'`, `additionalProperties: false`), and the new ask types compile (`AskAtlasResponse` accepts `{ text: '', toolCalls: [...] }`).
- [x] **Step 2 - server provider: tools payload, tool_calls parsing, text-only retry** - widen `AskChatMessage` in `providers.ts` to the tool-calling shapes (`assistant` may carry `tool_calls`; new `role: 'tool'` with `tool_call_id` + `content`). `callProvider(provider, messages, tools?)` adds `tools` to the body, parses `choices[0].message.tool_calls` into `{ id, name, arguments }`, returns `{ text: string | null, toolCalls }` (content may be empty or null when tool_calls exist - do not throw `invalid-response` then). On HTTP 400 when `tools` were sent, retry that provider once without `tools` (honest text-only fallback) before failing over. `chain.ts` threads `tools` and returns `toolCalls` on `ChainResult`.
  *Done when:* a dev probe stubs `window.fetch` and asserts: a canned 200 with `tool_calls` parses into `[{ id, name, arguments }]`; a canned 400-with-tools is retried without tools and returns text; a canned completion with neither content nor tool_calls still throws `invalid-response`; lint + build green.
- [x] **Step 3 - server handler: multi-round contract, caps, cache guard** - `handler.ts` accepts and validates `toolTurns` (cap 4 turns/request; 8 tool messages per turn; result content capped at 2000 chars each; raise `MAX_BODY_BYTES` 16,384 to 65,536). Build the provider messages by appending each tool turn (assistant `tool_calls` message + `role: 'tool'` result messages, ordered by `tool_call_id`) after the last user text. When the chain returns `toolCalls`, respond `200 { text: '', toolCalls, grounding: 'unverified', engine }` and never cache it; final text responses cache as today. Oversized or too-many-turn requests return `400 bad_request`.
  *Done when:* a dev probe calls `handleAsk` (imported from the dev server) with a stubbed provider fetch: a turn-one request returns `toolCalls` for `getState`; feeding `toolTurns` back returns a final text response; >4 turns or an oversized body returns `400`; repeated identical text asks still hit the server reply cache (provider fetch count stays 1); lint + build green.
- [x] **Step 4 - client multi-round loop** - `createApiResponder` in `responder.ts`: post the ask; if `toolCalls` present, `JSON.parse` each `arguments` (a parse failure becomes `ok: false` with `invalid_args`), execute via `runTool(name, parsed)`, build `AskToolTurn` with results in call order, and repeat; cap at 3 rounds. On cap exhaustion return an honest text reply ("I could not finish verifying that with the available tools..."). Set `grounding: 'atlas'` on the final reply iff at least one executed tool result was `ok: true`. The stub responder is untouched.
  *Done when:* a dev probe mocks `POST /api/ask` (round 1 returns `toolCalls`, round 2 returns final text) and asserts: `runTool` really executed against the local store (`getState('LA')` data present in the tool result), the final response text is returned, `grounding` is `'atlas'`; a text-only mocked reply returns directly with `grounding: 'unverified'`; a tool call with unparsable arguments feeds back `ok: false` without throwing; lint + build green.
- [x] **Step 5 - system prompt: connected tools + honest fallback copy** - rewrite `prompt.ts`: name the eight tools and when to call them, require `searchLocation` for ambiguous place names, and keep the hard honesty rules - never invent a postcode/district/LGA; if a tool returns `[]` or an error, say what you found and ask to narrow it; a text-only answer must be labeled as unverified general knowledge.
  *Done when:* a dev probe imports `buildSystemPrompt` and asserts it contains the tool-call instruction, the honesty rule, and no "not connected yet" phrasing; a rendered prompt for each reply language still reads coherently; lint + build green.
- [x] **Step 6 - live provider + end-to-end loop probe** - an origin-less Node probe (real server keys from `.env`) calls each configured provider with `ATLAS_PROVIDER_TOOLS` on a land-marked question (for example "What is the postcode for The Infrastructure Bank PLC?") and records which providers accept tools, whether they emit `tool_calls`, and the exact `arguments` shape. Then a full browser-loop dry run over the real dev server: mocked provider fetch on the server side is not used here; instead reuse Step 4's mocked `/api/ask` loop against real `runTool` and the local snapshot, and confirm the final reply reads as a grounded answer.
  *Done when:* probe output is captured showing at least one provider accepts the tools payload (or, if none do, that the text-only fallback path returns an honest answer for every provider); the end-to-end browser loop produces a final reply whose text came from a real tool result; lint + build green.

## Files / areas

- `src/lib/ask/types.ts` (extend) - `AskToolCall`, `AskToolResult`, `AskToolTurn`, request `toolTurns`, response `toolCalls`
- `src/lib/ask/api-types.ts` (unchanged aliases - no edit expected, verified on Step 1)
- `src/lib/ask/responder.ts` (extend) - multi-round loop inside `createApiResponder`
- `src/lib/tools/provider.ts` (new) - `toProviderTools()` + memoized `ATLAS_PROVIDER_TOOLS`
- `src/server/ask/providers.ts` (extend) - widened messages, `tools` body, `tool_calls` parse, no-tools retry
- `src/server/ask/chain.ts` (extend) - thread `tools`, return `toolCalls`
- `src/server/ask/handler.ts` (extend) - `toolTurns` validation, caps, response shaping, cache guard, body-size raise
- `src/server/ask/prompt.ts` (extend) - connected-tools prompt + honest fallback copy
- Consumes (no edits): `src/lib/tools/registry.ts` (`runTool`), `src/lib/tools/schemas.ts`, `src/lib/tools/types.ts`

## Data / contracts

Load-bearing for features 4-9.

- **`AskToolCall`** - `{ id: string; name: string; arguments: string }` - `arguments` is the raw JSON string from the provider; the client parses it (guarded), and `runTool` safe-parses anyway, so malformed arguments always surface as `invalid_args`.
- **`AskToolResult`** - `{ tool_call_id: string; name: string; ok: boolean; data?: unknown; error?: ToolError }` - mirrors 3b `ToolExecutionResult` plus the call id.
- **`AskToolTurn`** - `{ assistantToolCalls: AskToolCall[]; toolResults: AskToolResult[] }` - results in the same order as the calls.
- **Wire** - request gains `toolTurns?: AskToolTurn[]`; response gains `toolCalls?: AskToolCall[]`; `text` is `''` when `toolCalls` is present. The server converts each `AskToolResult` to a provider message `{ role: 'tool', tool_call_id, content }` where `content` is compact JSON `{ ok, data, error }` (capped), and the assistant turn to `{ role: 'assistant', content: null, tool_calls: [...] }`.
- **`grounding` semantics** - final reply is `'atlas'` iff at least one executed tool result was `ok: true`; otherwise `'unverified'`. (Feature 9 refines per-sentence grounding later.)
- **Provider tool definition** - `{ type: 'function', function: { name, description, parameters } }`, `parameters` = `z.toJSONSchema(schema)` (draft 2020-12, `additionalProperties: false`, verified in 3b). `tool_choice` stays unset (auto).
- **Caps** - client `MAX_TOOL_ROUNDS = 3`; server `MAX_TOOL_TURNS = 4` (client always stays under), `MAX_TOOL_MESSAGES_PER_TURN = 8`, `MAX_TOOL_RESULT_CHARS = 2000`; `MAX_BODY_BYTES` raised to 65,536. Worst case one ask = 4 chain runs; the 15 s provider timeout per call is unchanged.
- **Cache rule** - intermediate `toolCalls` responses are never cached (server or client); only final text responses enter the reply caches. The client cache keys on `(text, language, context)` with no tool turn, so repeat questions skip the loop entirely.

## Testing

- `AGENTS.md` declares no `test` command or `Browser tests` command: verification is `npm run lint` + `npm run build` plus Node/browser probes.
- Key technique: the server modules are browser-safe TS (they only use `fetch`), so the whole server path (validation, chain, parsing, fallback) is testable in the dev browser with `window.fetch` stubbed - no real provider quota burned. Step 6 is the single live endpoint probe (origin-less Node, real server keys from `.env`, per the feature 2 pattern).
- Env caveat unchanged: `api.postcode.gov.ng` 403s browser origins, so `runTool` results degrade to `[]`/`null` in-browser; the loop must feed those honest empties back to the model without failing.

## Notes for the AI

- **Client vs server** - tools execute client-side through 3b `runTool` (zero LLM provider calls for data); the server only shapes provider messages and returns `tool_calls`. Provider keys stay server-side; `runTool` needs only the browser-side store and the publishable `VITE_` key.
- **Do not touch history** - `AskAtlasMessage` and the `history` field keep their current user/assistant text semantics; tool turns ride in `toolTurns`.
- **Failed tool calls are results, not errors** - `ok: false` with the 3b `ToolError` feeds back so the model can fix args or give up honestly; only transport failures reject the ask.
- **Preserve the existing chain** - cooldowns, `ASK_AI_ORDER`, attempt counting, and 503 handling stay exactly as shipped in feature 2; the tools payload and the no-tools retry must not disturb them.
- **Memoize the provider tools once** - `ATLAS_PROVIDER_TOOLS` is a module-level constant; the schemas are static.
- **No `any`, no em dashes in generated content** - strict TS, interfaces, camelCase, functions under 50 lines, comments only for why.