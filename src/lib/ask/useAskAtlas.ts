/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { AskApiError } from './errors';
import type { AskAtlasRequest, AskAtlasResponse, AskAtlasResponder } from './types';

/**
 * Hook contract returned by `useAskAtlas`.
 */
export interface UseAskAtlasResult {
  /**
   * Send one turn. Resolves with the reply (from cache when the same
   * question was already answered), rejects with the final error after
   * the retry policy gives up.
   */
  send: (request: AskAtlasRequest) => Promise<AskAtlasResponse>;
  /** True while a send is in flight (including its retries). */
  isReplying: boolean;
}

/** Max transport-level retries for one chat send. */
const MAX_SEND_RETRIES = 2;

/** Exponential backoff: 1s, 2s, capped at 4s. */
function sendRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 4000);
}

/**
 * Cache key for a completed reply.
 *
 * Keyed on everything that changes the answer: the question text, the
 * requested reply language, and the map selection that travels into the
 * system prompt. Conversation history is deliberately not part of the key
 * (per this feature's data contract): repeating the exact same question
 * should answer from memory instead of burning free-tier quota. Nuanced
 * follow-ups are different text, so they still miss the cache and get a
 * genuinely new answer.
 */
function askReplyCacheKey(request: AskAtlasRequest): QueryKey {
  return [
    'ask-reply',
    request.language ?? 'en',
    request.text.trim().toLowerCase(),
    request.context.selectedState?.code ?? '',
    request.context.selectedLga?.code ?? '',
    request.context.selectedPostcode ?? '',
  ];
}

/**
 * Chat transport for Ask Atlas.
 *
 * Wraps the injected responder (API or stub) in a TanStack Query mutation
 * so every send gets:
 *
 * - a response cache: identical repeat questions answer from memory instead
 *   of burning free-tier provider quota;
 * - a transport-aware retry policy: exponential backoff only for failures
 *   that can actually succeed later (network blips, transient 5xx), never
 *   for bad requests or exhausted provider quotas;
 * - `isReplying` pending state for the typing indicator.
 *
 * Server-side provider failover (the chain in feature 2) is complementary:
 * that retries providers, this retries the HTTP call itself.
 */
export function useAskAtlas(responder: AskAtlasResponder): UseAskAtlasResult {
  const queryClient = useQueryClient();

  const mutation = useMutation<AskAtlasResponse, Error, AskAtlasRequest>({
    mutationFn: async (request) => {
      // Serve identical repeat questions from the in-memory reply cache.
      const cacheKey = askReplyCacheKey(request);
      const cached = queryClient.getQueryData<AskAtlasResponse>(cacheKey);
      if (cached) return cached;

      const response = await responder.respond(request);
      queryClient.setQueryData(cacheKey, response);
      return response;
    },
    // Retry only when the error says a retry can help, and never more
    // than MAX_SEND_RETRIES times.
    retry: (failureCount, error) =>
      failureCount < MAX_SEND_RETRIES && error instanceof AskApiError && error.retryable,
    retryDelay: sendRetryDelay,
  });

  return {
    send: mutation.mutateAsync,
    isReplying: mutation.isPending,
  };
}
