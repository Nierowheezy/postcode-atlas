/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AskAtlasRequest, AskAtlasResponder, AskAtlasResponse } from './types';
import { ASK_API_ENDPOINT, AskApiErrorResponse } from './api-types';
import { AskApiError } from './errors';

const RESPONSE_DELAY_MS = 400;

interface StubRule {
  pattern: RegExp;
  reply: () => AskAtlasResponse;
}

const RULES: StubRule[] = [
  {
    pattern: /\b(ikeja|yaba|surulere|lekki|ikoyi|victoria island)\b/i,
    reply: () => ({
      text: 'I found Ikeja, Lagos.\n\nPostcode: 100001\n\nLagos\n  Ikeja\n    A12\n      100001',
      grounding: 'unverified',
      location: { lat: 6.6018, lng: 3.3515, label: 'Ikeja, Lagos' },
    }),
  },
  {
    pattern: /\blagos\b/i,
    reply: () => ({
      text: 'Lagos State has 20 Local Government Areas. Ask me for a specific LGA, district, or postcode to narrow it down.',
      grounding: 'unverified',
    }),
  },
  {
    pattern: /\b(decode|structure|explain)\b.*\bpostcode\b|\bpostcode\b.*\b(decode|structure|explain)\b/i,
    reply: () => ({
      text: 'An NDAPS postcode has five segments: state (LA), LGA (11), district (A12), area (AK), and unit (08).\n\nExample: LA-11-A12-AK-08',
      grounding: 'unverified',
    }),
  },
  {
    pattern: /\b(postcode|postal code|zip)\b/i,
    reply: () => ({
      text: 'Tell me a place name (for example "postcode for Ikeja") and I will look it up once N-ATLAS is connected.',
      grounding: 'unverified',
    }),
  },
];

const FALLBACK: AskAtlasResponse = {
  text: 'Ask Atlas is running with a placeholder responder. N-ATLAS integration arrives in feature 2, so replies are canned for now.',
  grounding: 'unverified',
};

function pickReply(text: string): AskAtlasResponse {
  const rule = RULES.find((r) => r.pattern.test(text));
  return rule ? rule.reply() : FALLBACK;
}

/** Dev stub: canned replies, artificial latency, rejects for "!fail". */
export function createStubResponder(): AskAtlasResponder {
  return {
    respond({ text }: AskAtlasRequest): Promise<AskAtlasResponse> {
      const trimmed = text.trim();
      if (trimmed.startsWith('!fail')) {
        return new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Stub responder failure (requested via !fail)')), RESPONSE_DELAY_MS),
        );
      }
      return new Promise((resolve) =>
        setTimeout(() => resolve(pickReply(trimmed)), RESPONSE_DELAY_MS),
      );
    },
  };
}

const SERVICE_UNAVAILABLE_COPY =
  'Ask Atlas cannot reach its answer service right now.\n\nTry again in a moment.';
const ALL_ENGINES_DOWN_COPY =
  'Ask Atlas is having trouble answering right now.\n\nTry again in a few minutes.';
const GENERIC_ERROR_COPY =
  'Ask Atlas could not process that request.\n\nTry rephrasing or ask again in a moment.';

/**
 * Production responder: POSTs to the server-side `/api/ask` endpoint, so
 * provider keys never reach the browser. Until the endpoint exists (feature 2
 * Step 2) it fails gracefully into the panel's existing error state.
 */
export function createApiResponder(): AskAtlasResponder {
  return {
    async respond(request: AskAtlasRequest): Promise<AskAtlasResponse> {
      let raw: Response;
      try {
        raw = await fetch(ASK_API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: request.text,
            context: request.context,
            history: request.history,
            language: request.language,
          }),
        });
      } catch {
        // fetch() itself failed: offline, DNS, connection reset.
        throw new AskApiError('network', SERVICE_UNAVAILABLE_COPY, { retryable: true });
      }

      // Vite's SPA fallback and Vercel's catch-all rewrite answer unknown
      // routes with index.html, so trust only real JSON responses.
      const contentType = raw.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new AskApiError(
          // A 5xx HTML page is likely a transient gateway failure (retriable);
          // a 200/404 HTML page means the endpoint is simply not deployed yet.
          raw.status >= 500 ? 'network' : 'service-unavailable',
          SERVICE_UNAVAILABLE_COPY,
          { retryable: raw.status >= 500 },
        );
      }

      let body: unknown;
      try {
        body = await raw.json();
      } catch {
        throw new AskApiError('unexpected', GENERIC_ERROR_COPY, { retryable: false });
      }

      if (!raw.ok) {
        const error = (body as Partial<AskApiErrorResponse>)?.error;
        // Server said quota is gone for every provider: back off hard.
        if (error?.code === 'all_providers_unavailable') {
          throw new AskApiError('all-providers-unavailable', ALL_ENGINES_DOWN_COPY, {
            retryable: false,
            retryAfterSeconds: error.retryAfterSeconds,
          });
        }
        // Bad request will fail identically on every retry.
        if (error?.code === 'bad_request') {
          throw new AskApiError('bad-request', error.message || GENERIC_ERROR_COPY, { retryable: false });
        }
        // Other 5xx JSON errors are worth one more attempt later.
        throw new AskApiError(
          raw.status >= 500 ? 'network' : 'unexpected',
          error?.message || GENERIC_ERROR_COPY,
          { retryable: raw.status >= 500 },
        );
      }

      return body as AskAtlasResponse;
    },
  };
}
