/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NIPOST NDAPS gateway proxy, shared by the Vite dev middleware and the Vercel
 * Function for `/api/nipost/*`.
 *
 * The publishable key is locked to an origin allowlist, so a browser request to
 * `api.postcode.gov.ng` is rejected with `origin_not_allowed`. A request routed
 * through this handler carries no browser `Origin`, so the gateway serves it,
 * and the key never enters the shipped bundle.
 *
 * Only the NDAPS paths this app actually calls are forwarded. Keeping the list
 * closed stops the endpoint from being used as an open proxy.
 */

import {
  readNipostApiKey,
  resolveNipostBaseUrl,
  type NipostGatewayEnv,
} from './gateway';

/** Server-side environment. Matches `process.env` and Vite's `loadEnv` result. */
export type NipostServerEnv = NipostGatewayEnv;

/** Path this proxy is mounted at, in dev and on Vercel. */
const PROXY_PREFIX = '/api/nipost';

/** The only NDAPS paths the app calls. */
const ALLOWED_PATHS: ReadonlySet<string> = new Set([
  '/v1/reference/states',
  '/v1/reference/lgas',
  '/v1/reference/districts',
  '/v1/reference/areas',
  '/v1/lookup',
  '/v1/search/autocomplete',
  '/v1/search/reverse',
  '/v1/search/nearby',
  '/v1/assembly/disassemble',
  '/v1/assembly/assemble',
]);

/** True when the path (without query) may be forwarded upstream. */
export function isAllowedNipostPath(pathname: string): boolean {
  return ALLOWED_PATHS.has(pathname);
}

/**
 * Removes the proxy prefix so the same handler serves both mounts: the dev
 * middleware strips `/api/nipost` before the handler sees it, while the Vercel
 * Function receives the full path.
 */
export function resolveUpstreamPath(pathname: string): string {
  return pathname.startsWith(PROXY_PREFIX)
    ? pathname.slice(PROXY_PREFIX.length)
    : pathname;
}

/**
 * Resolves the NDAPS path and query for one proxy request.
 *
 * The dev middleware strips `/api/nipost`, so the NDAPS path is the request
 * pathname. On Vercel the function is reached through the literal catch-all
 * route `/api/nipost/[...path]`, and the `vercel.json` rewrite carries the NDAPS
 * path in a `path` query parameter, so it is read from there instead.
 */
export function resolveUpstreamTarget(url: URL): { pathname: string; search: string } {
  const carried = url.searchParams.get('path');

  if (carried) {
    const params = new URLSearchParams(url.searchParams);
    params.delete('path');
    const search = params.toString();
    return { pathname: carried, search: search ? `?${search}` : '' };
  }

  return { pathname: resolveUpstreamPath(url.pathname), search: url.search };
}

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Forwards one request to the NIPOST gateway with the server-held key and
 * returns the upstream body unchanged, so the client keeps its existing
 * envelope unwrapping and error handling.
 */
export async function handleNipostProxy(
  request: Request,
  env: NipostServerEnv
): Promise<Response> {
  const url = new URL(request.url);
  const { pathname, search } = resolveUpstreamTarget(url);

  if (!isAllowedNipostPath(pathname)) {
    return errorResponse(
      404,
      'unknown_path',
      'This proxy forwards only the NIPOST NDAPS paths the app uses.'
    );
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'Only GET and POST are proxied.');
  }

  const key = readNipostApiKey(env);
  if (!key) {
    return errorResponse(
      500,
      'not_configured',
      'NIPOST_PUBLISHABLE_KEY is not set on the server.'
    );
  }

  const base = resolveNipostBaseUrl(env);
  const headers: Record<string, string> = { 'X-API-Key': key };
  let body: string | undefined;
  if (request.method === 'POST') {
    body = await request.text();
    headers['content-type'] = request.headers.get('content-type') ?? 'application/json';
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${base}${pathname}${search}`, {
      method: request.method,
      headers,
      body,
    });
  } catch {
    return errorResponse(
      502,
      'upstream_unreachable',
      'The NIPOST gateway could not be reached.'
    );
  }

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  });
}
