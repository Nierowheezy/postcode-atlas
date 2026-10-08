/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Provider registry + one OpenAI-compatible chat call.
 *
 * Servers only. Provider keys live in `process.env`, are resolved here, and
 * never leave the server.
 */

/** The always-available free-tier providers, plus the optional N-ATLAS slot. */
export type AskProviderId = 'gemini' | 'openrouter' | 'nvidia' | 'natlas';

/** A resolved provider: base URL, key, and model are all concrete. */
export interface AskProvider {
  id: AskProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** Chat message shape sent to the provider (bare roles only). */
export interface AskChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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
 * One OpenAI-compatible chat completion call against `provider`.
 * Throws `ProviderError` with a `kind` the failover chain can act on.
 */
export async function callProvider(
  provider: AskProvider,
  messages: AskChatMessage[],
  timeoutMs = TIMEOUT_MS,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // The N-ATLAS key is optional (public gateways); send auth only when set.
    if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;
    response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: 0.4,
      }),
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

  const content = extractContent(data);
  if (content === null) {
    throw new ProviderError('invalid-response', `Provider ${provider.id} returned no usable content`);
  }
  return content;
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

/** Pull `choices[0].message.content` out of an OpenAI-style response. */
function extractContent(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  const content = message?.content;
  return typeof content === 'string' ? content : null;
}