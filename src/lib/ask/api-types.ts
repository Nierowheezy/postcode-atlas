/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Wire contract for `POST /api/ask`. The server (api/ask.ts and the Vite dev
 * middleware) validates against these shapes; the client posts them verbatim.
 */

import type { AskAtlasRequest, AskAtlasResponse } from './types';

export const ASK_API_ENDPOINT = '/api/ask';

/** JSON body accepted by the endpoint. */
export type AskApiRequest = AskAtlasRequest;

/** Successful (200) response body. */
export type AskApiResponse = AskAtlasResponse;

export type AskApiErrorCode = 'bad_request' | 'all_providers_unavailable';

/** Error body for 400 and 503 responses. */
export interface AskApiErrorResponse {
  error: {
    code: AskApiErrorCode;
    message: string;
    retryAfterSeconds?: number;
  };
}
