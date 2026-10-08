/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AskLanguage, AskAtlasResponse, AtlasContextSnapshot } from '../../lib/ask/types';
import { buildSystemPrompt } from './prompt';
import { resolveProviders, type AskChatMessage } from './providers';
import { ChainExhaustedError, runChain } from './chain';

/** Max body size we accept, roughly 16 kB, guards against huge payloads. */
const MAX_BODY_BYTES = 16_384;

const MAX_TEXT_LENGTH = 500;
const MAX_HISTORY_ENTRIES = 10;

const LANGUAGES: readonly AskLanguage[] = ['en', 'yo', 'ha', 'ig'];

/** Server-only env keys, looked up once by the caller. */
export type AskServerEnv = Record<string, string | undefined>;

/**
 * In-memory reply cache (per warm instance).
 *
 * Same key as the client cache: text + language + selection. A question that
 * was already answered with no meaningful provider cost is served from here:
 * repeated identical asks across visitors on a warm instance cost one provider
 * call total, not one per ask. Best effort and ephemeral; a shared KV cache is
 * a later optimization. Failures are never cached.
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
  ];

  try {
    const result = await runChain(env, messages);

    // Safari and old browsers may absent-map; rebuild with explicit shape.
    const response: AskAtlasResponse = {
      text: result.text,
      grounding: 'unverified',
      engine: { provider: result.provider.id, model: result.provider.model, attempt: result.attempt },
    };

    replyCache.set(cacheKey, { at: now, reply: response });
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