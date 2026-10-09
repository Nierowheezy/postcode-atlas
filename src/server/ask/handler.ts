/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AskLanguage,
  AskToolResult,
  AskToolTurn,
  AskAtlasResponse,
  AtlasContextSnapshot,
} from '../../lib/ask/types';
import type { ToolError, ToolErrorCode } from '../../lib/tools/types';
import { ATLAS_PROVIDER_TOOLS } from '../../lib/tools/provider';
import { buildSystemPrompt } from './prompt';
import { resolveProviders, type AskChatMessage, type ProviderToolCall } from './providers';
import { ChainExhaustedError, runChain } from './chain';

/** Max body size we accept, roughly 64 kB: multi-round tool payloads ride here. */
const MAX_BODY_BYTES = 65_536;

const MAX_TEXT_LENGTH = 500;
const MAX_HISTORY_ENTRIES = 10;

const LANGUAGES: readonly AskLanguage[] = ['en', 'yo', 'ha', 'ig'];

// --- tool-call round caps (client stays at 3 rounds; server allows 4) ------
const MAX_TOOL_TURNS = 4;
const MAX_TOOL_MESSAGES_PER_TURN = 8;
const MAX_TOOL_RESULT_CHARS = 2000;
const MAX_TOOL_ID_CHARS = 64;
const MAX_TOOL_NAME_CHARS = 64;
const MAX_TOOL_ARGUMENT_CHARS = 4000;

const TOOL_ERROR_CODES: readonly ToolErrorCode[] = ['invalid_args', 'unknown_tool', 'not_found', 'internal_error'];

/** Server-only env keys, looked up once by the caller. */
export type AskServerEnv = Record<string, string | undefined>;

/**
 * In-memory reply cache (per warm instance).
 *
 * Same key as the client cache: text + language + selection. A question that
 * was already answered with no meaningful provider cost is served from here:
 * repeated identical asks across visitors on a warm instance cost one provider
 * call total, not one per ask. Best effort and ephemeral; a shared KV cache is
 * a later optimization. Failures are never cached, and neither are
 * intermediate tool-call rounds (their answer depends on the executed tools).
 */
const REPLY_CACHE_TTL_MS = 10 * 60_000;
const REPLY_CACHE_MAX_ENTRIES = 200;
const replyCache = new Map<string, { at: number; reply: AskAtlasResponse }>();

function replyCacheKey(language: AskLanguage | undefined, text: string, context: AtlasContextSnapshot): string {
  return JSON.stringify([
    language ?? 'en',
    text.trim().toLowerCase(),
    context.selectedState?.code ?? '',
    context.selectedLga?.code ?? '',
    context.selectedPostcode ?? '',
  ]);
}

/** Prune expired entries, and evict oldest when the cache is full. */
function pruneReplyCache(now: number): void {
  for (const [key, entry] of replyCache) {
    if (now - entry.at > REPLY_CACHE_TTL_MS) replyCache.delete(key);
  }
  if (replyCache.size > REPLY_CACHE_MAX_ENTRIES) {
    const oldestKey = replyCache.keys().next().value;
    if (typeof oldestKey === 'string') replyCache.delete(oldestKey);
  }
}

/** JSON error body used for 400 and 503 responses. */
function errorBody(
  code: 'bad_request' | 'all_providers_unavailable',
  message: string,
  retryAfterSeconds?: number,
): string {
  const body: { error: { code: string; message: string; retryAfterSeconds?: number } } = {
    error: { code, message },
  };
  if (retryAfterSeconds !== undefined) body.error.retryAfterSeconds = retryAfterSeconds;
  return JSON.stringify(body);
}

/** Strip + validate the request body into a safe `AtlasContextSnapshot`. */
function sanitizeContext(context: unknown): AtlasContextSnapshot {
  if (typeof context !== 'object' || context === null) return { mapCenter: [0, 0], mapZoom: 4 };
  const raw = context as Record<string, unknown>;

  const str = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

  return {
    selectedState: typeof raw.selectedState === 'object' && raw.selectedState !== null ? raw.selectedState as AtlasContextSnapshot['selectedState'] : undefined,
    selectedLga: typeof raw.selectedLga === 'object' && raw.selectedLga !== null ? raw.selectedLga as AtlasContextSnapshot['selectedLga'] : undefined,
    selectedDistrict: str(raw.selectedDistrict),
    selectedArea: str(raw.selectedArea),
    selectedPostcode: str(raw.selectedPostcode),
    mapCenter: [0, 0],
    mapZoom: 4,
  };
}

/** Accept a `ToolError`-shaped value, or `undefined` when it is not well-formed. */
function sanitizeToolError(value: unknown): ToolError | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  const code = raw.code;
  const message = typeof raw.message === 'string' && raw.message.length > 0 ? raw.message : undefined;
  if (!TOOL_ERROR_CODES.includes(code as ToolErrorCode) || !message) return undefined;
  const error: ToolError = { code: code as ToolErrorCode, message };
  if (Array.isArray(raw.issues)) {
    const issues = raw.issues.filter((issue): issue is string => typeof issue === 'string');
    if (issues.length > 0) error.issues = issues;
  }
  return error;
}

/**
 * Validate the client's completed tool-call rounds into a safe `AskToolTurn[]`,
 * or return an error message the caller 400s on. Anything malformed is
 * rejected rather than partially accepted, so the provider never sees shapes
 * we did not intend.
 */
function sanitizeToolTurns(raw: unknown): { turns: AskToolTurn[]; error?: string } {
  if (raw === undefined) return { turns: [] };
  if (!Array.isArray(raw)) return { turns: [], error: 'toolTurns must be an array.' };
  if (raw.length > MAX_TOOL_TURNS) return { turns: [], error: `Too many tool rounds (max ${MAX_TOOL_TURNS}).` };

  const str = (value: unknown, max: number, label: string): string | undefined =>
    typeof value === 'string' && value.length > 0 && value.length <= max ? value : undefined;

  const turns: AskToolTurn[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) {
      return { turns: [], error: 'Each toolTurns entry must be an object.' };
    }
    const turn = entry as Record<string, unknown>;
    if (!Array.isArray(turn.assistantToolCalls) || !Array.isArray(turn.toolResults)) {
      return { turns: [], error: 'Each tool round needs assistantToolCalls and toolResults arrays.' };
    }
    if (
      turn.assistantToolCalls.length > MAX_TOOL_MESSAGES_PER_TURN ||
      turn.toolResults.length > MAX_TOOL_MESSAGES_PER_TURN
    ) {
      return { turns: [], error: `Too many tool messages per round (max ${MAX_TOOL_MESSAGES_PER_TURN}).` };
    }

    const assistantToolCalls: AskToolTurn['assistantToolCalls'] = [];
    for (const call of turn.assistantToolCalls) {
      const item = typeof call === 'object' && call !== null ? (call as Record<string, unknown>) : null;
      const id = str(item?.id, MAX_TOOL_ID_CHARS, 'tool call id');
      const name = str(item?.name, MAX_TOOL_NAME_CHARS, 'tool name');
      const argumentsRaw = str(item?.arguments, MAX_TOOL_ARGUMENT_CHARS, 'tool arguments');
      if (!id || !name || argumentsRaw === undefined) {
        return { turns: [], error: 'Malformed assistant tool call.' };
      }
      assistantToolCalls.push({ id, name, arguments: argumentsRaw });
    }

    const toolResults: AskToolResult[] = [];
    for (const result of turn.toolResults) {
      const item = typeof result === 'object' && result !== null ? (result as Record<string, unknown>) : null;
      const tool_call_id = str(item?.tool_call_id, MAX_TOOL_ID_CHARS, 'tool call id');
      const name = str(item?.name, MAX_TOOL_NAME_CHARS, 'tool name');
      if (!tool_call_id || !name || typeof item?.ok !== 'boolean') {
        return { turns: [], error: 'Malformed tool result.' };
      }
      const error = item.ok ? undefined : sanitizeToolError(item.error);
      if (!item.ok && !error) {
        return { turns: [], error: 'Malformed tool result: a failed result needs a well-formed error.' };
      }
      toolResults.push({
        tool_call_id,
        name,
        ok: item.ok,
        ...(item.ok ? { data: item.data } : { error }),
      });
    }

    turns.push({ assistantToolCalls, toolResults });
  }
  return { turns };
}

/** One provider-visible tool call array for an assistant round. */
function toProviderToolCalls(turn: AskToolTurn): ProviderToolCall[] {
  return turn.assistantToolCalls.map((call) => ({
    id: call.id,
    type: 'function' as const,
    function: { name: call.name, arguments: call.arguments },
  }));
}

/** Compact JSON for a tool result; truncated so a bad reply cannot bloat the request. */
function serializeToolResult(result: AskToolResult): string {
  const payload = result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error };
  const json = JSON.stringify(payload) ?? '';
  return json.length <= MAX_TOOL_RESULT_CHARS
    ? json
    : `${json.slice(0, MAX_TOOL_RESULT_CHARS)}...(truncated)`;
}

/** Append the completed tool rounds after the last user text, in order. */
function toProviderMessages(turns: AskToolTurn[]): AskChatMessage[] {
  const messages: AskChatMessage[] = [];
  for (const turn of turns) {
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: toProviderToolCalls(turn),
    });
    for (const result of turn.toolResults) {
      messages.push({ role: 'tool', tool_call_id: result.tool_call_id, content: serializeToolResult(result) });
    }
  }
  return messages;
}

/** Handle one Ask Atlas request. Shared by the Vercel function and Vite dev middleware. */
export async function handleAsk(request: Request, env: AskServerEnv): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(errorBody('bad_request', 'Use POST to ask Ask Atlas a question.'), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Guard the body size before reading it.
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return new Response(errorBody('bad_request', 'That request is too large.'), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(errorBody('bad_request', 'The request body is not valid JSON.'), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const raw = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;

  // --- text: required, 1..500 chars after trim -------------------------------
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (text.length === 0 || text.length > MAX_TEXT_LENGTH) {
    return new Response(
      errorBody('bad_request', `Please ask in 1 to ${MAX_TEXT_LENGTH} characters.`),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // --- language: optional, must be one of the supported set ------------------
  const language = raw.language === undefined ? undefined : (raw.language as string);
  if (language !== undefined && !LANGUAGES.includes(language as AskLanguage)) {
    return new Response(errorBody('bad_request', 'Unsupported reply language.'), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const replyLanguage = language as AskLanguage | undefined;

  // --- history: optional, capped, stripped to bare {role, content} -----------
  const history: AskChatMessage[] = [];
  if (Array.isArray(raw.history)) {
    for (const entry of raw.history.slice(-MAX_HISTORY_ENTRIES)) {
      const item = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : null;
      const role = item?.role === 'assistant' ? 'assistant' : item?.role === 'user' ? 'user' : null;
      const content = typeof item?.content === 'string' ? item.content.trim() : '';
      // Strip ids, timestamps, context, location; error-role entries drop out.
      if (role && content.length > 0) history.push({ role, content });
    }
  }

  // --- context: optional, lenient ---------------------------------------------
  const context = sanitizeContext(raw.context);

  // --- tool rounds: optional, validated, capped -------------------------------
  const toolTurns = sanitizeToolTurns(raw.toolTurns);
  if (toolTurns.error) {
    return new Response(errorBody('bad_request', toolTurns.error), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- provider selection ------------------------------------------------------
  const providers = resolveProviders(env);
  if (providers.length === 0) {
    return new Response(
      errorBody('all_providers_unavailable', 'Ask Atlas is not configured yet. Check the server logs.'),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // --- serve from the in-memory reply cache when possible ----------------------
  const cacheKey = replyCacheKey(replyLanguage, text, context);
  const now = Date.now();
  pruneReplyCache(now);
  const cached = replyCache.get(cacheKey);
  if (cached) {
    // Cache hits echo the last engine, with the attempt count preserved.
    return new Response(JSON.stringify(cached.reply), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- build the prompt and run the failover chain --------------------------
  const systemPrompt = buildSystemPrompt(context, replyLanguage);
  const messages: AskChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: text },
    ...toProviderMessages(toolTurns.turns),
  ];

  try {
    const result = await runChain(env, messages, ATLAS_PROVIDER_TOOLS);

    // Safari and old browsers may absent-map; rebuild with explicit shape.
    const response: AskAtlasResponse = {
      text: result.text,
      grounding: 'unverified',
      engine: { provider: result.provider.id, model: result.provider.model, attempt: result.attempt },
      ...(result.toolCalls.length > 0 ? { toolCalls: result.toolCalls } : {}),
    };

    // Only final text answers are cacheable; tool-call rounds depend on the
    // executed results and must re-run the chain.
    if (result.toolCalls.length === 0) {
      replyCache.set(cacheKey, { at: now, reply: response });
    }
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (cause) {
    // Never leak provider internals to the client; log server-side only.
    console.error('[ask] all providers failed:', cause);
    const retryAfterSeconds = cause instanceof ChainExhaustedError ? cause.retryAfterSeconds : undefined;
    return new Response(
      errorBody('all_providers_unavailable', 'The AI engines are briefly unavailable. Try again in a moment.', retryAfterSeconds),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}