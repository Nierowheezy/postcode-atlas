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

import { fetchNipostJson, type NipostFetchResult, type NipostGatewayEnv } from '../nipost/gateway';
import { listExplanations, readExplanation } from './explain';
import { decodePostcode, normalizePostcodeCode, toPostcodeRecord } from './postcode';
import {
  NEARBY_MAX_RADIUS_M,
  normalizeCoordinate,
  normalizeRadius,
  normalizeSearchQuery,
  toAutocomplete,
  toNearbyUnits,
  toReverseUnit,
} from './search';
import {
  REFERENCE_LIST_KEY,
  REFERENCE_PATH,
  normalizeReferenceParam,
  toNamedCodes,
  type ReferenceLevel,
} from './hierarchy';

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

/** Postcode lookups can change; cache them at the edge for five minutes. */
const LOOKUP_MAX_AGE_SECONDS = 300;

/** The hierarchy changes only when NIPOST updates it, so it caches for an hour. */
const REFERENCE_MAX_AGE_SECONDS = 3600;

/** A decoded postcode is pure structure that never changes; cache it the same. */
const DECODE_MAX_AGE_SECONDS = 3600;

/** Editorial copy changes only on deploy, so it caches at the edge for a day. */
const EDITORIAL_MAX_AGE_SECONDS = 86400;

/** A `{ data }` success body. NDAPS records are cacheable at the edge. */
function dataResponse(data: unknown, maxAgeSeconds = LOOKUP_MAX_AGE_SECONDS): Response {
  return jsonResponse({ data }, 200, `public, max-age=${maxAgeSeconds}`);
}

function errorResponse(code: ApiErrorCode, message: string): Response {
  return jsonResponse({ error: { code, message } }, ERROR_STATUS[code], 'no-store');
}

type NipostFailure = Extract<NipostFetchResult, { ok: false }>;

/**
 * Map a failed gateway call onto the public error contract. `notFoundStatuses`
 * are the upstream HTTP statuses that mean "the resource is not there" for the
 * calling route; any other upstream status becomes `upstream_error`. A route
 * with no not-found status (the search routes) omits both arguments.
 */
function upstreamErrorResponse(
  result: NipostFailure,
  notFoundStatuses: readonly number[] = [],
  notFoundMessage = ''
): Response {
  switch (result.reason) {
    case 'not_configured':
      return errorResponse(
        'not_configured',
        'The NIPOST gateway is not configured on the server.'
      );
    case 'unreachable':
      return errorResponse('upstream_unreachable', 'The NIPOST gateway could not be reached.');
    case 'upstream_status':
      return notFoundStatuses.includes(result.status)
        ? errorResponse('not_found', notFoundMessage)
        : errorResponse('upstream_error', 'The NIPOST gateway returned an unexpected status.');
    case 'bad_response':
      return errorResponse('upstream_error', 'The NIPOST gateway returned a non-JSON body.');
  }
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
    return upstreamErrorResponse(result, [404], 'No record was found for that postcode.');
  }

  const record = toPostcodeRecord(code, result.data);
  if (!record.valid) {
    return errorResponse('not_found', 'No record was found for that postcode.');
  }

  return dataResponse(record);
}

/**
 * Decode a well-formed postcode into its five segments. Purely structural, so it
 * never calls the gateway and works even when NIPOST is unreachable.
 */
function handleDecode(rawCode: string): Response {
  const decoded = decodePostcode(rawCode);
  if (!decoded) {
    return errorResponse('invalid_code', 'The postcode in the path is not well-formed.');
  }
  return dataResponse(decoded, DECODE_MAX_AGE_SECONDS);
}

/**
 * Answer one autocomplete query. NDAPS infers which level the query names and
 * returns its suggestions; an empty list is a valid answer.
 */
async function handleAutocomplete(url: URL, env: NipostGatewayEnv): Promise<Response> {
  const q = normalizeSearchQuery(url.searchParams.get('q'));
  if (!q) {
    return errorResponse(
      'invalid_code',
      'Provide a non-empty q query parameter (at most 64 characters).'
    );
  }

  const result = await fetchNipostJson('/v1/search/autocomplete', { q }, env);
  if (!result.ok) {
    return upstreamErrorResponse(result);
  }
  return dataResponse(toAutocomplete(result.data));
}

/**
 * Answer a nearby search. The radius is bounded before the call; an empty list
 * is a valid answer, not an error.
 */
async function handleNearby(url: URL, env: NipostGatewayEnv): Promise<Response> {
  const point = normalizeCoordinate(url.searchParams.get('lat'), url.searchParams.get('lng'));
  if (!point) {
    return errorResponse('invalid_code', 'Provide numeric lat and lng query parameters in range.');
  }
  const radius = normalizeRadius(url.searchParams.get('radius'));
  if (radius === null) {
    return errorResponse(
      'invalid_code',
      `Provide a radius in metres between 1 and ${NEARBY_MAX_RADIUS_M}.`
    );
  }

  const result = await fetchNipostJson(
    '/v1/search/nearby',
    { lat: String(point.lat), lng: String(point.lng), radius: String(radius) },
    env
  );
  if (!result.ok) {
    return upstreamErrorResponse(result);
  }
  return dataResponse(toNearbyUnits(result.data));
}

/**
 * Answer a reverse-geocode query. A miss (`found` is not `true`) is a 404,
 * matching the lookup route; the returned unit echoes the queried point. The
 * fixed 250 m search radius mirrors the browser client.
 */
async function handleReverse(url: URL, env: NipostGatewayEnv): Promise<Response> {
  const point = normalizeCoordinate(url.searchParams.get('lat'), url.searchParams.get('lng'));
  if (!point) {
    return errorResponse('invalid_code', 'Provide numeric lat and lng query parameters in range.');
  }

  const result = await fetchNipostJson(
    '/v1/search/reverse',
    { lat: String(point.lat), lng: String(point.lng), max_distance_m: '250' },
    env
  );
  if (!result.ok) {
    return upstreamErrorResponse(result);
  }

  const unit = toReverseUnit(result.data, point);
  if (!unit) {
    return errorResponse('not_found', 'No postcode was found near that point.');
  }
  return dataResponse(unit);
}

/**
 * Answer the editorial explanation index. The copy is bundled in the deployment,
 * so this route never calls the gateway and works with no key.
 */
function handleExplanationIndex(): Response {
  return dataResponse(listExplanations(), EDITORIAL_MAX_AGE_SECONDS);
}

/**
 * Answer one editorial explanation by topic, or `404 not_found` for an unknown
 * one. Upstream-free, like the index.
 */
function handleExplanation(rawTopic: string): Response {
  const explanation = readExplanation(rawTopic);
  if (!explanation) {
    return errorResponse('not_found', 'No explanation exists for that topic.');
  }
  return dataResponse(explanation, EDITORIAL_MAX_AGE_SECONDS);
}

/**
 * Answer one hierarchy reference route. The NDAPS path and list field come from
 * the level; `params` are the already-validated parent codes.
 */
async function handleReference(
  level: ReferenceLevel,
  params: Record<string, string>,
  env: NipostGatewayEnv
): Promise<Response> {
  const result = await fetchNipostJson(REFERENCE_PATH[level], params, env);

  if (!result.ok) {
    // NDAPS answers 400 for a state it does not know, and 200 with an empty list
    // for an unknown child. Either way the parent in the path is the problem.
    return upstreamErrorResponse(
      result,
      [400, 404],
      'No reference data was found for that hierarchy path.'
    );
  }

  return dataResponse(
    toNamedCodes(result.data, REFERENCE_LIST_KEY[level]),
    REFERENCE_MAX_AGE_SECONDS
  );
}

/** `400 invalid_code` for a malformed hierarchy path parameter. */
function invalidReferenceParam(level: ReferenceLevel): Response {
  return errorResponse('invalid_code', `The ${level} in the path is not well-formed.`);
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

  const url = new URL(request.url);
  const path = resolveApiPath(url);

  if (path === '/') {
    return dataResponse({ name: 'Postcode Atlas API', version: API_VERSION });
  }

  if (path === '/postcodes') {
    return errorResponse('invalid_code', 'Provide a postcode in the path: /postcodes/{code}.');
  }

  const segmentsMatch = path.match(/^\/postcodes\/([^/]+)\/segments$/);
  if (segmentsMatch) {
    return handleDecode(safeDecode(segmentsMatch[1]));
  }

  const postcodeMatch = path.match(/^\/postcodes\/([^/]+)$/);
  if (postcodeMatch) {
    return handlePostcode(safeDecode(postcodeMatch[1]), env);
  }

  if (path === '/search/autocomplete') {
    return handleAutocomplete(url, env);
  }

  if (path === '/search/nearby') {
    return handleNearby(url, env);
  }

  if (path === '/search/reverse') {
    return handleReverse(url, env);
  }

  if (path === '/explanations') {
    return handleExplanationIndex();
  }

  const explanationMatch = path.match(/^\/explanations\/([^/]+)$/);
  if (explanationMatch) {
    return handleExplanation(safeDecode(explanationMatch[1]));
  }

  if (path === '/states') {
    return handleReference('state', {}, env);
  }

  const lgasMatch = path.match(/^\/states\/([^/]+)\/lgas$/);
  if (lgasMatch) {
    const state = normalizeReferenceParam('state', safeDecode(lgasMatch[1]));
    if (!state) return invalidReferenceParam('state');
    return handleReference('lga', { state }, env);
  }

  const districtsMatch = path.match(/^\/states\/([^/]+)\/lgas\/([^/]+)\/districts$/);
  if (districtsMatch) {
    const state = normalizeReferenceParam('state', safeDecode(districtsMatch[1]));
    if (!state) return invalidReferenceParam('state');
    const lga = normalizeReferenceParam('lga', safeDecode(districtsMatch[2]));
    if (!lga) return invalidReferenceParam('lga');
    return handleReference('district', { state, lga }, env);
  }

  const areasMatch = path.match(/^\/states\/([^/]+)\/lgas\/([^/]+)\/districts\/([^/]+)\/areas$/);
  if (areasMatch) {
    const state = normalizeReferenceParam('state', safeDecode(areasMatch[1]));
    if (!state) return invalidReferenceParam('state');
    const lga = normalizeReferenceParam('lga', safeDecode(areasMatch[2]));
    if (!lga) return invalidReferenceParam('lga');
    const district = normalizeReferenceParam('district', safeDecode(areasMatch[3]));
    if (!district) return invalidReferenceParam('district');
    return handleReference('area', { state, lga, district }, env);
  }

  return errorResponse('unknown_route', 'No route matches that path.');
}
