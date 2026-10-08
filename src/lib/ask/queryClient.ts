/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * App-wide TanStack Query client.
 *
 * Defaults here are tuned for Ask Atlas today and for the grounded postcode
 * lookups arriving in features 3+:
 *
 * - Chat calls use `useMutation` (see `useAskAtlas.ts`), which defaults to
 *   no retries; the hook opts into its own transport-aware retry policy.
 * - Future `useQuery` lookups retry once, serve fresh data for 5 minutes,
 *   and keep results in memory for 10 minutes, so repeated postcode questions
 *   never re-hit a provider or the map data endpoints.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
