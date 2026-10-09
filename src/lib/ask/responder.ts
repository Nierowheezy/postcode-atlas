/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AskAtlasRequest,
  AskAtlasResponder,
  AskAtlasResponse,
  AskToolCall,
  AskToolResult,
  AskToolTurn,
  VerifiedLookup,
} from './types';
import { ASK_API_ENDPOINT, AskApiErrorResponse } from './api-types';
import { AskApiError } from './errors';
import { runTool } from '../tools/registry';
import type { PostcodeLocation } from '../../types/postcode';
import type { LocationCandidate } from '../atlas/dataset';

const RESPONSE_DELAY_MS = 400;

interface StubRule {
  pattern: RegExp;
  reply: () => AskAtlasResponse;
}

const RULES: StubRule[] = [
  {
    pattern: /\b(ikeja|yaba|surulere|lekki|ikoyi|victoria island)\b/i,
    reply: () => ({
      text: 'That is a real Lagos place, but the placeholder responder cannot look up verified postcodes. Start the app with the answer service connected (API mode, the default) to ask for real lookups.',
      grounding: 'unverified',
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
      text: 'The placeholder responder cannot verify postcodes. Start the app with the answer service connected (API mode, the default) and I can look up real postcodes for places, landmarks, and codes.',
      grounding: 'unverified',
    }),
  },
];

const FALLBACK: AskAtlasResponse = {
  text: 'Ask Atlas is running with its placeholder responder. Start the app in API mode (the default) for live answers; stub mode replies are canned.',
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
const TOOL_LOOP_EXHAUSTED_COPY =
  'I could not finish verifying that with the available tools in time. Please try again or rephrase.';

/** Max completed tool rounds per ask (the server allows one more, so we stay under it). */
const MAX_TOOL_ROUNDS = 3;

/** Error fed back when a tool call's `arguments` is not valid JSON. */
function invalidArgsError(): AskToolResult['error'] {
  return { code: 'invalid_args', message: 'Tool arguments were not valid JSON.' };
}

/**
 * Run one tool call locally through the 3b dispatcher. `runTool` never throws
 * and safe-parses arguments again, so malformed arguments surface as a failed
 * result (`ok: false`, `invalid_args`) that feeds back - never a rejection.
 */
async function executeToolCalls(calls: AskToolCall[]): Promise<AskToolResult[]> {
  const results: AskToolResult[] = [];
  for (const call of calls) {
    let args: unknown;
    try {
      args = JSON.parse(call.arguments);
    } catch {
      results.push({ tool_call_id: call.id, name: call.name, ok: false, error: invalidArgsError() });
      continue;
    }
    const outcome = await runTool(call.name, args);
    results.push({
      tool_call_id: call.id,
      name: call.name,
      ok: outcome.ok,
      ...(outcome.ok ? { data: outcome.data } : { error: outcome.error }),
    });
  }
  return results;
}

/**
 * Narrow an executed `getPostcode` result's data to a location record.
 * A `null` (unmapped code) or shape-mismatched payload yields undefined.
 */
function asPostcodeLocation(value: unknown): PostcodeLocation | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  return typeof (value as Record<string, unknown>).postcode === 'string'
    ? (value as PostcodeLocation)
    : undefined;
}

/** Narrow executed search data to candidate records (unknowns are dropped). */
function asLocationCandidates(value: unknown): LocationCandidate[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is LocationCandidate =>
      typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).code === 'string',
  );
}

/** A landmark candidate is always backed by the bundled verified dataset. */
function landmarkToLookup(candidate: LocationCandidate): VerifiedLookup {
  return {
    postcode: candidate.code,
    label: candidate.name,
    coordinates: candidate.coordinates,
    verified: true,
  };
}

function locationToLookup(location: PostcodeLocation): VerifiedLookup {
  return {
    postcode: location.postcode,
    label: location.name,
    stateName: location.stateName,
    lgaName: location.lgaName,
    coordinates:
      location.lat !== undefined && location.lng !== undefined ? [location.lat, location.lng] : undefined,
    // A lookup is built only from an executed Atlas tool result; discovery and
    // gateway records are NIPOST data, so it is verified by construction even
    // when the record omits a `verified` flag (the bundled discovery list does).
    verified: true,
  };
}

/**
 * Derive the verified postcode payload (feature 4) from the tool results the
 * client already executed. Deterministic and side-effect free: a later result
 * replaces the payload only when it itself yields one - the last successful
 * `getPostcode` record, else the last `searchLocation` holding exactly one
 * landmark candidate. Zero or multiple landmark postcodes, a failed result, or
 * an unmapped `getPostcode` is ambiguous for this contract and leaves the
 * payload as it was; an empty turn list yields undefined.
 */
export function deriveLookup(toolTurns: AskToolTurn[]): VerifiedLookup | undefined {
  let lookup: VerifiedLookup | undefined;

  for (const turn of toolTurns) {
    for (const result of turn.toolResults) {
      if (!result.ok) continue;

      if (result.name === 'getPostcode') {
        const location = asPostcodeLocation(result.data);
        if (location) lookup = locationToLookup(location);
        continue;
      }
      if (result.name === 'searchLocation') {
        const landmarks = asLocationCandidates(result.data).filter((c) => c.type === 'landmark');
        if (landmarks.length === 1) lookup = landmarkToLookup(landmarks[0]);
      }
    }
  }

  return lookup;
}

/**
 * Attach the derived lookup to a final reply, plus the feature 8 location
 * slot when the lookup carries coordinates. Returns the reply unchanged when
 * no unambiguous postcode-bearing result backs it.
 */
function withLookup(response: AskAtlasResponse, toolTurns: AskToolTurn[]): AskAtlasResponse {
  const lookup = deriveLookup(toolTurns);
  if (!lookup) return response;

  return {
    ...response,
    lookup,
    ...(lookup.coordinates
      ? {
          location: {
            lat: lookup.coordinates[0],
            lng: lookup.coordinates[1],
            label: lookup.label ?? lookup.postcode,
          },
        }
      : {}),
  };
}

/** One POST to `/api/ask`. Transport + error mapping only; no loop logic. */
async function postAsk(request: AskAtlasRequest): Promise<AskAtlasResponse> {
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
        ...(request.toolTurns && request.toolTurns.length > 0 ? { toolTurns: request.toolTurns } : {}),
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
}

/**
 * Production responder: POSTs to the server-side `/api/ask` endpoint, so
 * provider keys never reach the browser, and runs the 3c multi-round tool
 * loop: while the server answers with `toolCalls`, execute each call locally
 * via `runTool` and feed the results back. Capped at `MAX_TOOL_ROUNDS`;
 * a final reply is grounded `'atlas'` iff at least one executed tool result
 * succeeded.
 */
export function createApiResponder(): AskAtlasResponder {
  return {
    async respond(request: AskAtlasRequest): Promise<AskAtlasResponse> {
      let toolTurns: AskToolTurn[] = [];
      let grounded = false;

      // Round 0 posts without tool turns; each later round appends one more.
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
        const response = await postAsk({ ...request, toolTurns });

        if (!response.toolCalls || response.toolCalls.length === 0) {
          // Final answer. Upgrade its grounding only when tools really ran,
          // and attach the derived verified lookup (feature 4).
          return grounded ? withLookup({ ...response, grounding: 'atlas' }, toolTurns) : withLookup(response, toolTurns);
        }

        if (round === MAX_TOOL_ROUNDS) {
          // Cap reached and the model still wants tools: honest text reply.
          return withLookup(
            {
              text: TOOL_LOOP_EXHAUSTED_COPY,
              grounding: grounded ? 'atlas' : 'unverified',
              engine: response.engine,
            },
            toolTurns,
          );
        }

        const toolResults = await executeToolCalls(response.toolCalls);
        grounded = grounded || toolResults.some((result) => result.ok);
        toolTurns = [...toolTurns, { assistantToolCalls: response.toolCalls, toolResults }];
      }

      // The loop always returns inside; this keeps the type checker honest.
      throw new Error('unreachable: ask loop over-ran its bounds');
    },
  };
}