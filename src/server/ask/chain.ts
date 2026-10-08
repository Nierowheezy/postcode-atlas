/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  callProvider,
  ProviderError,
  resolveProviders,
  type AskChatMessage,
  type AskProvider,
  type AskProviderId,
} from './providers';

/** One successful chain run. */
export interface ChainResult {
  text: string;
  provider: AskProvider;
  /** 1-based position in the attempt order of the provider that answered. */
  attempt: number;
}

/** Provider currently cooling down after a rate limit or quota failure. */
interface CooldownEntry {
  /** Earliest time (ms epoch) this provider may be tried again. */
  until: number;
  reason: string;
}

const COOLDOWN_RATE_LIMITED_MS = 10 * 60_000; // 429 default: 10 min
const COOLDOWN_QUOTA_MS = 15 * 60_000; // 401/403 quota: 15 min
const COOLDOWN_SERVER_MS = 30_000; // transient 5xx: 30 s, just to back off
const COOLDOWN_MIN_MS = 30_000; // never hot-loop a sub-30 s Retry-After

/** Thrown when every provider in the order failed or is cooling down. */
export class ChainExhaustedError extends Error {
  /** Seconds until the earliest cooldown lifts, for the 503 response. */
  readonly retryAfterSeconds?: number;

  constructor(retryAfterSeconds?: number) {
    super('All Ask Atlas providers failed');
    this.name = 'ChainExhaustedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * In-memory cooldown ledger (per warm instance, best effort): a provider
 * that just told us it is rate limited or quota-exhausted is skipped for a
 * while instead of being hit again and again. Serverless instances reset
 * this, which is fine; persistent cooldown state is a later optimization.
 */
const cooldowns = new Map<AskProviderId, CooldownEntry>();

/** Milliseconds of cooldown still in effect, or 0 when the provider is clear. */
function cooldownLeft(id: AskProviderId, now: number): number {
  const entry = cooldowns.get(id);
  if (!entry) return 0;
  const remaining = entry.until - now;
  if (remaining <= 0) {
    cooldowns.delete(id);
    return 0;
  }
  return remaining;
}

/** Record a failure so future runs skip this provider for a while. */
function markCooldown(providerId: AskProviderId, kind: ProviderError['kind'], retryAfterSeconds?: number): void {
  const base =
    kind === 'quota' ? COOLDOWN_QUOTA_MS : kind === 'rate-limited' ? COOLDOWN_RATE_LIMITED_MS : COOLDOWN_SERVER_MS;
  // Honour Retry-After for rate limits when present, but never below the floor.
  const wait =
    kind === 'rate-limited' && retryAfterSeconds !== undefined
      ? Math.max(retryAfterSeconds * 1000, COOLDOWN_MIN_MS)
      : base;
  cooldowns.set(providerId, { until: Date.now() + wait, reason: kind });
}

/**
 * Resolve the provider order. `ASK_AI_ORDER` (comma-separated ids, unknown
 * ids ignored) overrides the default; the N-ATLAS slot is prepended to the
 * default order when `NATLAS_BASE_URL` is set, matching the spec: first in
 * line when credentials arrive, skipped silently otherwise.
 */
function resolveOrder(env: Record<string, string | undefined>): AskProviderId[] {
  const allowed: AskProviderId[] = ['gemini', 'openrouter', 'nvidia', 'natlas'];
  const raw = (env.ASK_AI_ORDER ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (raw.length > 0) {
    return raw.filter((id): id is AskProviderId => (allowed as readonly string[]).includes(id));
  }

  const defaultOrder: AskProviderId[] = ['gemini', 'openrouter', 'nvidia'];
  if (env.NATLAS_BASE_URL?.trim()) defaultOrder.unshift('natlas');
  return defaultOrder;
}

/** Earliest moment (ms epoch) at which any provider in the order will be clear. */
function earliestCooldownEnd(order: AskProviderId[]): number | null {
  let earliest: number | null = null;
  for (const id of order) {
    const entry = cooldowns.get(id);
    if (!entry) continue;
    earliest = earliest === null ? entry.until : Math.min(earliest, entry.until);
  }
  return earliest;
}

/**
 * Run every provider in order until one answers.
 *
 * Providers configured without a key are skipped silently. Providers in
 * cooldown are skipped without being called. Each actual call counts toward
 * `attempt` so the engine meta can show where the chain landed.
 */
export async function runChain(
  env: Record<string, string | undefined>,
  messages: AskChatMessage[],
): Promise<ChainResult> {
  const order = resolveOrder(env);
  const byId = new Map(resolveProviders(env).map((provider) => [provider.id, provider]));

  const now = Date.now();
  let attempt = 0;
  let lastFailure: ProviderError | null = null;

  for (const id of order) {
    const provider = byId.get(id);
    if (!provider) continue; // no key configured for this provider

    if (cooldownLeft(id, now) > 0) continue; // cooling down; skip without calling

    attempt += 1;
    try {
      const text = await callProvider(provider, messages);
      return { text, provider, attempt };
    } catch (cause) {
      if (cause instanceof ProviderError) {
        lastFailure = cause;
        console.error(`[ask] provider ${provider.id} failed (${cause.kind}): ${cause.message}`);
        markCooldown(provider.id, cause.kind, cause.retryAfterSeconds);
      } else {
        lastFailure = new ProviderError('server', `Provider ${provider.id} threw ${String(cause)}`);
        markCooldown(provider.id, 'server');
      }
    }
  }

  // All providers exhausted: surface how soon the chain can be retried.
  const earliestUntil = earliestCooldownEnd(order);
  const suggested =
    earliestUntil === null ? undefined : Math.max(1, Math.ceil((earliestUntil - Date.now()) / 1000));
  throw new ChainExhaustedError(suggested ?? lastFailure?.retryAfterSeconds);
}