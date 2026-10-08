/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Typed client-side errors for the Ask Atlas API responder.
 *
 * The `retryable` flag is the contract with TanStack Query's retry policy:
 * transient transport failures retry with backoff, while quota and
 * validation failures fail fast because retrying cannot help them.
 */

export type AskApiErrorKind =
  /** fetch() rejected: offline, DNS failure, connection reset. Retriable. */
  | 'network'
  /** Endpoint not deployed (SPA fallback / 404) or an upstream 5xx page. */
  | 'service-unavailable'
  /** 400 from our own server: the request itself is invalid. Never retriable. */
  | 'bad-request'
  /** 503: every provider in the chain is cooling down. Come back later. */
  | 'all-providers-unavailable'
  /** Malformed JSON or a response shape we cannot map. Never retriable. */
  | 'unexpected';

export interface AskApiErrorOptions {
  /** Whether a client-side retry (with backoff) has any chance of helping. */
  retryable: boolean;
  /** Seconds the server asked us to wait (only on all-providers-unavailable). */
  retryAfterSeconds?: number;
}

/**
 * Error thrown by `createApiResponder()`. Its `message` is already
 * user-facing copy, so panels can render it directly in the error bubble.
 */
export class AskApiError extends Error {
  readonly kind: AskApiErrorKind;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;

  constructor(kind: AskApiErrorKind, message: string, options: AskApiErrorOptions) {
    super(message);
    this.name = 'AskApiError';
    this.kind = kind;
    this.retryable = options.retryable;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
