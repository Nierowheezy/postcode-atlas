/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Server-side NDAPS gateway client for the developer API (feature 21a).
 *
 * `./handler.ts` forwards NDAPS responses untouched so the browser client keeps
 * its existing envelope and error handling. The public API needs normalized JSON
 * instead, so this module owns the shared base-URL and key resolution and
 * exposes a typed fetch helper both the proxy and the API build on.
 */

/** Server-side environment. Matches `process.env` and Vite's `loadEnv` result. */
export type NipostGatewayEnv = Record<string, string | undefined>;

/** Upstream used when `NIPOST_API_BASE_URL` is not set. */
export const DEFAULT_NIPOST_UPSTREAM = 'https://api.postcode.gov.ng';

/** Name of the server-only env var holding the NDAPS publishable key. */
export const NIPOST_API_KEY_ENV = 'NIPOST_PUBLISHABLE_KEY';

/** Resolve the NDAPS base URL, falling back to the public gateway. */
export function resolveNipostBaseUrl(env: NipostGatewayEnv): string {
  return (env.NIPOST_API_BASE_URL || DEFAULT_NIPOST_UPSTREAM).replace(/\/+$/, '');
}

/** Read the NDAPS publishable key, or `undefined` when unset or blank. */
export function readNipostApiKey(env: NipostGatewayEnv): string | undefined {
  const key = env[NIPOST_API_KEY_ENV];
  return key && key.trim().length > 0 ? key : undefined;
}

/** Why a gateway call did not produce a JSON body. */
export type NipostFetchReason =
  | 'not_configured'
  | 'unreachable'
  | 'upstream_status'
  | 'bad_response';

export type NipostFetchResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; reason: NipostFetchReason; status: number };

/**
 * Unwrap the `{ data: ... }` envelope every NDAPS response carries, matching the
 * browser client (`json?.data ?? json`). A missing or null `data` falls back to
 * the whole body so an unexpected shape still reaches the caller.
 */
function unwrapGatewayEnvelope(body: unknown): unknown {
  if (typeof body === 'object' && body !== null && 'data' in body) {
    const data = (body as { data: unknown }).data;
    if (data !== undefined && data !== null) return data;
  }
  return body;
}

/**
 * Call one NDAPS path with the server-held key and parse its JSON body.
 *
 * `pathname` should be one of the paths in `ALLOWED_PATHS` (`./handler.ts`); this
 * helper does not enforce that, so each caller stays explicit about which NDAPS
 * capabilities it exposes. The `{ data: ... }` envelope every NDAPS response
 * carries is unwrapped here, matching the browser client. `upstream_status`
 * carries the upstream HTTP status (for example 404) so callers can map it to
 * their own contract.
 */
export async function fetchNipostJson(
  pathname: string,
  params: Record<string, string>,
  env: NipostGatewayEnv
): Promise<NipostFetchResult> {
  const key = readNipostApiKey(env);
  if (!key) {
    return { ok: false, reason: 'not_configured', status: 500 };
  }

  const search = new URLSearchParams(params).toString();
  const url = `${resolveNipostBaseUrl(env)}${pathname}${search ? `?${search}` : ''}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, { headers: { 'X-API-Key': key } });
  } catch {
    return { ok: false, reason: 'unreachable', status: 502 };
  }

  if (!upstream.ok) {
    return { ok: false, reason: 'upstream_status', status: upstream.status };
  }

  try {
    return { ok: true, status: upstream.status, data: unwrapGatewayEnvelope(await upstream.json()) };
  } catch {
    return { ok: false, reason: 'bad_response', status: 502 };
  }
}
