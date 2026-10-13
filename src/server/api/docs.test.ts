/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drift guard for the developer documentation (feature 22).
 *
 * `docs/api-reference.md` is a hand-written contract, so it can fall behind the
 * code in two silent ways: an error code could be renamed or added without the
 * table following, and a documented route could stop resolving. Both are read
 * straight out of the markdown and checked against the handler, so the doc is
 * the thing under test rather than a copy of it.
 *
 * It does not enumerate the router: a route the doc forgets to mention is not
 * caught here.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { API_ERROR_STATUS, handleApi } from './handler';

const reference = readFileSync(
  new URL('../../../docs/api-reference.md', import.meta.url),
  'utf8'
);

/** The body of one `## ` section, up to the next `## `. */
function section(title: string): string {
  const start = reference.indexOf(`## ${title}`);
  if (start === -1) return '';

  const rest = reference.slice(start);
  const next = rest.indexOf('\n## ', 1);
  return next === -1 ? rest : rest.slice(0, next);
}

/** The `status | code` rows of the Errors table, in document order. */
function documentedErrors(): { status: number; code: string }[] {
  const rows = /^\|\s*`(\d{3})`\s*\|\s*`([a-z_]+)`\s*\|/gm;
  return [...section('Errors').matchAll(rows)].map((match) => ({
    status: Number(match[1]),
    code: match[2],
  }));
}

/** The `GET <path>` rows of the endpoint table, in document order. */
function documentedRoutes(): string[] {
  const rows = /^\|\s*`GET ([^`]+)`\s*\|/gm;
  return [...section('Endpoints').matchAll(rows)].map((match) => match[1]);
}

/** A concrete value for each path parameter the docs use. */
const SAMPLE_PARAM: Record<string, string> = {
  code: 'LA-11-A12-AK-08',
  state: 'LA',
  lga: '11',
  district: 'A12',
  topic: 'hierarchy',
};

/** A valid query string for each parameterized search route. */
const SAMPLE_QUERY: Record<string, string> = {
  '/search/autocomplete': '?q=lag',
  '/search/nearby': '?lat=6.6018&lng=3.349&radius=300',
  '/search/reverse': '?lat=6.6018&lng=3.349',
};

/** Replace the doc's placeholders, then add a real query string if needed. */
function sampleRequest(route: string): Request {
  const [rawPath] = route.split('?');
  const path = rawPath.replace(
    /\{([a-z]+)\}/g,
    (_, name: string) => SAMPLE_PARAM[name] ?? name
  );
  const query = SAMPLE_QUERY[path] ?? '';
  return new Request(`https://atlas.test/api/v1${path}${query}`);
}

describe('api-reference.md', () => {
  it('documents every error code and status, in both directions', () => {
    const documented = documentedErrors();
    expect(documented.length).toBeGreaterThan(0);

    const inDoc = documented.map((row) => `${row.status} ${row.code}`);
    const inCode = Object.entries(API_ERROR_STATUS).map(
      ([code, status]) => `${status} ${code}`
    );

    // Both directions: a stale doc row and a missing doc row both fail.
    expect([...inDoc].sort()).toEqual([...inCode].sort());
  });

  it('answers every route it documents, rather than unknown_route', async () => {
    const routes = documentedRoutes();
    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
      // No NDAPS key is configured, so routes that need one stop short of the
      // network with `not_configured`. That still proves routing reached them.
      const response = await handleApi(sampleRequest(route), {});
      const body = (await response.json()) as { error?: { code?: string } };

      expect(body.error?.code, route).not.toBe('unknown_route');
    }
  });
});
