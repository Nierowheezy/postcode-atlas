/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Access control for the public developer API (feature 21e).
 *
 * External callers authenticate with a key from `ATLAS_API_KEYS`. When that list
 * is empty the API stays open, exactly as 21a-21d shipped it, so the public demo
 * and the dev loop keep working until an operator opts in. This module stays pure:
 * it turns a request and the env map into plain values, and the handler is the
 * only place a `Response` is built. Rate limiting is a process-local fixed
 * window, so it is best-effort by design (see `checkRateLimit`).
 */

import type { NipostGatewayEnv } from '../nipost/gateway.js';

/** Name of the server-only env var holding the accepted API keys. */
export const API_KEYS_ENV = 'ATLAS_API_KEYS';

/** Resolve the accepted keys. An empty list means the API is open. */
export function resolveApiKeys(env: NipostGatewayEnv): string[] {
  const configured = env[API_KEYS_ENV];
  if (!configured) return [];

  return configured
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
}

/**
 * Read the key a request presents. `Authorization: Bearer <token>` wins; any
 * other scheme is ignored so an `X-API-Key` header is still read.
 */
export function extractApiKey(request: Request): string | undefined {
  const authorization = request.headers.get('authorization');
  if (authorization) {
    const [scheme, ...rest] = authorization.trim().split(/\s+/);
    if (scheme.toLowerCase() === 'bearer') {
      const token = rest.join(' ').trim();
      if (token) return token;
    }
  }

  const headerKey = request.headers.get('x-api-key')?.trim();
  return headerKey ? headerKey : undefined;
}

/**
 * Compare a presented key against the configured list in constant time, so a
 * wrong key cannot be narrowed down by response timing. Length is the only thing
 * this leaks, which is standard for bearer tokens.
 */
export function matchesApiKey(presented: string, keys: readonly string[]): boolean {
  let matched = false;
  for (const key of keys) {
    if (constantTimeEqual(presented, key)) matched = true;
  }
  return matched;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Identity a request is counted against: the key once it has been authenticated,
 * otherwise the client IP. The prefixes stop a key that reads like an IP literal
 * from sharing that IP's bucket.
 */
export function rateLimitIdentity(request: Request, authenticatedKey?: string): string {
  if (authenticatedKey) return `key:${authenticatedKey}`;
  return `ip:${clientIp(request)}`;
}

/** Client IP from the proxy headers, or `unknown` when none are sent. */
function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const real = request.headers.get('x-real-ip')?.trim();
  return real ? real : 'unknown';
}

/** Name of the server-only env var overriding the per-window request limit. */
export const RATE_LIMIT_ENV = 'ATLAS_API_RATE_LIMIT';

/** Fixed window length for every identity. */
export const RATE_WINDOW_MS = 60_000;

/** Requests allowed per window when the env var is unset or unusable. */
export const DEFAULT_RATE_LIMIT = 60;

/** Tracked identities before the oldest windows are evicted. */
export const MAX_TRACKED_IDENTITIES = 10_000;

/** Outcome of one rate-limit decision. */
export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/** Resolve the per-window limit, falling back on a missing or invalid value. */
export function resolveRateLimit(env: NipostGatewayEnv): number {
  const configured = env[RATE_LIMIT_ENV]?.trim();
  if (!configured || !/^\d+$/.test(configured)) return DEFAULT_RATE_LIMIT;

  const limit = Number(configured);
  return limit > 0 ? limit : DEFAULT_RATE_LIMIT;
}

interface RateWindow {
  count: number;
  resetAt: number;
}

/**
 * Caller windows, keyed by identity. Process-local and best-effort: a cold start
 * clears it and each instance counts on its own, so this caps casual abuse
 * rather than enforcing a global quota.
 */
const windows = new Map<string, RateWindow>();

/**
 * Count one request against an identity and report whether it is allowed. `now`
 * is injectable so the window logic is testable without timers.
 */
export function checkRateLimit(
  limit: number,
  identity: string,
  now = Date.now()
): RateLimitResult {
  const window = windows.get(identity);

  if (!window || now >= window.resetAt) {
    // Delete before set so a refreshed caller moves to the newest position and
    // is not evicted ahead of an idle one.
    windows.delete(identity);
    windows.set(identity, { count: 1, resetAt: now + RATE_WINDOW_MS });
    evictOldest();
    return { allowed: true };
  }

  if (window.count < limit) {
    window.count += 1;
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
  };
}

/** Test-only: drop every tracked window so cases start from a clean table. */
export function resetRateLimits(): void {
  windows.clear();
}

/** Drop the oldest windows once the table passes its cap. */
function evictOldest(): void {
  while (windows.size > MAX_TRACKED_IDENTITIES) {
    const oldest = windows.keys().next().value;
    if (oldest === undefined) return;
    windows.delete(oldest);
  }
}
