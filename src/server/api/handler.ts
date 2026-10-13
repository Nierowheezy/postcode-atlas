/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public developer API (feature 21a), served by the Vercel Function
 * `api/v1/[...path].ts` and an identical Vite dev middleware.
 *
 * One locked contract for every route: `{ data }` on success,
 * `{ error: { code, message } }` on failure, one HTTP status per error code.
 * Feature 21b adds routes here; 21c adds the access gate around them.
 */

import { fetchNipostJson, type NipostGatewayEnv } from '../nipost/gateway';
import { normalizePostcodeCode, toPostcodeRecord } from './postcode';

/** Version prefix for every route. */
export const API_PREFIX = '/api/v1';

/** Contract version. Feature 22 documents it; a future `v2` can coexist. */
export const API_VERSION = 1;

/** Every error code the public contract can return. */
export type ApiErrorCode =
  | 'invalid_code'
  | 'method_not_allowed'
  | 'not_found'
  | 'unknown_route'
  | 'not_configured'
  | 'internal_error'
  | 'upstream_unreachable'
  | 'upstream_error';

/** Fixed HTTP status for each error code. */
const ERROR_STATUS: Record<ApiErrorCode, number> = {
  invalid_code: 400,
  method_not_allowed: 405,
  not_found: 404,
  unknown_route: 404,
  not_configured: 500,
  internal_error: 500,
  upstream_unreachable: 502,
  upstream_error: 502,
};

/** Read-only public API: any origin may read, and only `GET` and `OPTIONS`. */
const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
};

function jsonResponse(
  body: unknown,
  status: number,
  cacheControl: string
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': cacheControl,
      ...CORS_HEADERS,
    },
  });
}

/** A `{ data }` success body. NDAPS records are cacheable at the edge. */
function dataResponse(data: unknown): Response {
  return jsonResponse({ data }, 200, 'public, max-age=300');
}

function errorResponse(code: ApiErrorCode, message: string): Response {
  return jsonResponse({ error: { code, message } }, ERROR_STATUS[code], 'no-store');
}

/** Ensure a leading slash and drop any trailing slash (`/` stays `/`). */
function normalizePath(pathname: string): string {
  const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
}

/**
 * Resolve the API path for one request. The dev middleware mounts `/api/v1`, so
 * connect already stripped the prefix; on Vercel the catch-all function is
 * reached through `/api/v1/[...path]` and the `vercel.json` rewrite carries the
 * API path in a `path` query parameter, exactly like the NIPOST proxy.
 */
export function resolveApiPath(url: URL): string {
  const carried = url.searchParams.get('path');
  if (carried !== null) return normalizePath(carried);
  return normalizePath(
    url.pathname.startsWith(API_PREFIX)
      ? url.pathname.slice(API_PREFIX.length)
      : url.pathname
  );
}

/** Decode a path segment, falling back to the raw text on malformed encoding. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Look one postcode up and return its public record or a mapped error. */
async function handlePostcode(rawCode: string, env: NipostGatewayEnv): Promise<Response> {
  const code = normalizePostcodeCode(rawCode);
  if (!code) {
    return errorResponse('invalid_code', 'The postcode in the path is not well-formed.');
  }

  const result = await fetchNipostJson('/v1/lookup', { code, level: '1' }, env);

  if (!result.ok) {
    switch (result.reason) {
      case 'not_configured':
        return errorResponse(
          'not_configured',
          'The NIPOST gateway is not configured on the server.'
        );
      case 'unreachable':
        return errorResponse('upstream_unreachable', 'The NIPOST gateway could not be reached.');
      case 'upstream_status':
        return result.status === 404
          ? errorResponse('not_found', 'No record was found for that postcode.')
          : errorResponse('upstream_error', 'The NIPOST gateway returned an unexpected status.');
      case 'bad_response':
        return errorResponse('upstream_error', 'The NIPOST gateway returned a non-JSON body.');
    }
  }

  const record = toPostcodeRecord(code, result.data);
  if (!record.valid) {
    return errorResponse('not_found', 'No record was found for that postcode.');
  }

  return dataResponse(record);
}

/** Route and serve one public API request. */
export async function handleApi(
  request: Request,
  env: NipostGatewayEnv
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'GET') {
    return errorResponse('method_not_allowed', `Use GET for ${API_PREFIX} routes.`);
  }

  const path = resolveApiPath(new URL(request.url));

  if (path === '/') {
    return dataResponse({ name: 'Postcode Atlas API', version: API_VERSION });
  }

  if (path === '/postcodes') {
    return errorResponse('invalid_code', 'Provide a postcode in the path: /postcodes/{code}.');
  }

  const postcodeMatch = path.match(/^\/postcodes\/([^/]+)$/);
  if (postcodeMatch) {
    return handlePostcode(safeDecode(postcodeMatch[1]), env);
  }

  return errorResponse('unknown_route', 'No route matches that path.');
}
