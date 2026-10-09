/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Provider registry + one OpenAI-compatible chat call.
 *
 * Servers only. Provider keys live in `process.env`, are resolved here, and
 * never leave the server.
 *
 * Tool calling (3c): every call may carry the Atlas `tools` payload. When the
 * model answers with `tool_calls` instead of text, the call returns them so
 * the chain can hand them to the handler, which sends them back to the client.
 * A provider that rejects the tools payload (HTTP 400) is retried once
 * without tools so the chat still degrades to an honest text-only answer.
 */

import type { AskToolCall } from '../../lib/ask/types';
import type { ProviderTool } from '../../lib/tools/provider';

/** The always-available free-tier providers, plus the optional N-ATLAS slot. */
export type AskProviderId = 'gemini' | 'openrouter' | 'nvidia' | 'natlas';

/** A resolved provider: base URL, key, and model are all concrete. */
export interface AskProvider {
  id: AskProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** A tool call in the provider's native OpenAI shape. */
export interface ProviderToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/**
 * Chat message shapes sent to the provider. Assistant messages may carry a
 * `tool_calls` array (a round the client is about to execute), and `role:
 * 'tool'` messages carry the client-executed results back.
 */
export type AskChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ProviderToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

/** One provider completion: the text answer and/or the tool calls requested. */
export interface ProviderCallResult {
  text: string;
  toolCalls: AskToolCall[];
}

/** Why a provider call failed, so the failover chain can decide what to do. */
export type ProviderErrorKind =
  /** 429: rate limited. Retry later, honouring Retry-After. */
  | 'rate-limited'
  /** 401/403: quota exhausted or key rejected. Long cooldown. */
  | 'quota'
  /** 400: the request itself was rejected (for example a bogus model). */
  | 'bad-request'
  /** 5xx, network failure, or timeout. Retry may help. */
  | 'server'
  /** 200 but the body is not a usable completion. Not retryable meaningfully. */
  | 'invalid-response';

/** Typed provider failure; the chain consumes `kind` + `retryAfterSeconds`. */
export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly retryAfterSeconds?: number;

  constructor(kind: ProviderErrorKind, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** The three always-configured providers live in the static registry. */
type RegistryProviderId = Exclude<AskProviderId, 'natlas'>;

/** Default base URLs and models; `ASK_AI_MODEL_*` env can override models. */
const REGISTRY: Record<
  RegistryProviderId,
  { baseUrl: string; model: string; keyNames: string[] }
> = {
  // OpenRouter's Gemini endpoint, OpenAI-compatible.
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    // Current-gen lite: much higher free-tier RPM than 2.5-flash, verified
    // correct on English, Yoruba, and fabricated-place refusal probes.
    model: 'gemini-3.1-flash-lite',
    keyNames: ['GEMINI_API_KEY', 'GEMNINI_API_KEY'],
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    keyNames: ['OPENROUTER_API_KEY'],
  },
  nvidia: {
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    // Verified live on this account (Oct 2026 sweep): nemotron-3-super-120b
    // answers fast (1-4s) with caveated general knowledge, honest refusals on
    // fabricated places (Zedville), and honest Yoruba phrasing. It is the only
    // free-endpoint model that both stays within the 15s call budget and
    // actually answers. glm-5.3 is inconsistent (empty content + fabricated
    // codes), gpt-oss-20b refuses everything, and the flash/deepseek/kimi
    // models exceed the budget. The older llama-3.1 nemotron ID 404s.
    model: 'nvidia/nemotron-3-super-120b-a12b',
    keyNames: ['NVIDIA_API_KEY'],
  },
};

/** First key name that has a value, or undefined. */
function firstKey(env: Record<string, string | undefined>, names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name];
    if (value && value.trim().length > 0) return value;
  }
  return undefined;
}

/**
 * Resolve every provider that has a key configured. Model overrides come
 * from `ASK_AI_MODEL_<PROVIDER>` env. Order is fixed: gemini, openrouter,
 * nvidia (this is the default chain order for Step 3 too), with the N-ATLAS
 * slot prepended when `NATLAS_BASE_URL` is set (its key and model are
 * optional; the endpoint may be a public or key-less gateway).
 */
export function resolveProviders(env: Record<string, string | undefined>): AskProvider[] {
  const providers: AskProvider[] = [];

  const natlasBase = env.NATLAS_BASE_URL?.trim();
  if (natlasBase) {
    // N-ATLAS: OpenAI-compatible assumed (Awarri docs unverified); slot is
    // present only when a base URL is configured, and skipped otherwise.
    providers.push({
      id: 'natlas',
      baseUrl: natlasBase.replace(/\/+$/, ''),
      apiKey: env.NATLAS_API_KEY?.trim() ?? '',
      model: env.NATLAS_MODEL?.trim() || 'NCAIR1/N-ATLaS',
    });
  }

  for (const id of Object.keys(REGISTRY) as RegistryProviderId[]) {
    const entry = REGISTRY[id];
    const apiKey = firstKey(env, entry.keyNames);
    if (!apiKey) continue;
    providers.push({
      id,
      baseUrl: entry.baseUrl,
      apiKey,
      model: env[`ASK_AI_MODEL_${id.toUpperCase()}`]?.trim() || entry.model,
    });
  }
  return providers;
}

const TIMEOUT_MS = 15_000;

/**
 * One OpenAI-compatible chat completion call against `provider`, optionally
 * with the Atlas tools payload. Throws `ProviderError` with a `kind` the
 * failover chain can act on. A provider that rejects the tools payload with a
 * 400 is retried once without tools (task is on the caller to make sure the
 * text-only answer stays honest via the system prompt).
 */
export async function callProvider(
  provider: AskProvider,
  messages: AskChatMessage[],
  tools?: ProviderTool[],
  timeoutMs = TIMEOUT_MS,
): Promise<ProviderCallResult> {
  const attempts: (ProviderTool[] | undefined)[] = tools ? [tools, undefined] : [undefined];
  let lastError: ProviderError | null = null;

  for (const attemptTools of attempts) {
    try {
      return await callCompletion(provider, messages, attemptTools, timeoutMs);
    } catch (cause) {
      if (cause instanceof ProviderError && cause.kind === 'bad-request' && attemptTools) {
        console.warn(`[ask] provider ${provider.id} rejected the tools payload, retrying without tools`);
        lastError = cause;
        continue;
      }
      throw cause;
    }
  }

  throw lastError ?? new ProviderError('bad-request', `Provider ${provider.id} rejected the request`);
}

/** One raw POST + response parse; no fallback logic. */
async function callCompletion(
  provider: AskProvider,
  messages: AskChatMessage[],
  tools: ProviderTool[] | undefined,
  timeoutMs: number,
): Promise<ProviderCallResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // The N-ATLAS key is optional (public gateways); send auth only when set.
    if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;
    const body: Record<string, unknown> = {
      model: provider.model,
      messages,
      temperature: 0.4,
    };
    if (tools) body.tools = tools;
    response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (cause) {
    throw new ProviderError(
      'server',
      `Provider ${provider.id} unreachable: ${cause instanceof Error ? cause.message : 'network error'}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new ProviderError(...classifyHttpFailure(response));
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ProviderError('invalid-response', `Provider ${provider.id} returned non-JSON`);
  }

  return extractCompletion(data, provider.id);
}

/** Map a non-2xx provider response onto a ProviderError constructor tuple. */
function classifyHttpFailure(response: Response): ConstructorParameters<typeof ProviderError> {
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after'));
    return [
      'rate-limited',
      `Provider throttled (HTTP 429)`,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    ];
  }
  if (response.status === 401 || response.status === 403) {
    return ['quota', `Provider rejected the key or quota exhausted (HTTP ${response.status})`];
  }
  if (response.status === 400) {
    return ['bad-request', `Provider rejected the request (HTTP 400)`];
  }
  return ['server', `Provider error (HTTP ${response.status})`];
}

/**
 * Pull `choices[0].message.content` (text answer) and `tool_calls` (tool-call
 * round) out of an OpenAI-style response. Content may be empty when the model
 * only asked for tools; both empty is an unusable completion.
 */
function extractCompletion(data: unknown, providerId: string): ProviderCallResult {
  if (typeof data !== 'object' || data === null) {
    throw new ProviderError('invalid-response', `Provider ${providerId} returned a non-object body`);
  }
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new ProviderError('invalid-response', `Provider ${providerId} returned no choices`);
  }
  const message = (choices[0] as { message?: { content?: unknown; tool_calls?: unknown } }).message;
  if (typeof message !== 'object' || message === null) {
    throw new ProviderError('invalid-response', `Provider ${providerId} returned no message`);
  }

  const toolCalls = parseToolCalls(message.tool_calls);
  const text = typeof message.content === 'string' ? message.content : '';
  if (toolCalls.length === 0 && text.length === 0) {
    throw new ProviderError('invalid-response', `Provider ${providerId} returned no usable content`);
  }
  return { text, toolCalls };
}

/** Keep only well-formed function calls, dropping anything unexpected. */
function parseToolCalls(value: unknown): AskToolCall[] {
  if (!Array.isArray(value)) return [];
  const calls: AskToolCall[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const call = item as { id?: unknown; type?: unknown; function?: unknown };
    if (call.type !== 'function') continue;
    const fn = (call.function ?? {}) as { name?: unknown; arguments?: unknown };
    if (typeof call.id !== 'string' || typeof fn.name !== 'string' || typeof fn.arguments !== 'string') {
      continue;
    }
    calls.push({ id: call.id, name: fn.name, arguments: fn.arguments });
  }
  return calls;
}