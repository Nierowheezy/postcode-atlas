import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Regression guard for the production routing bug: the NIPOST proxy must be
 * rewritten to its function before the SPA fallback, or every multi-segment
 * `/api/nipost/v1/...` request is served the app shell instead of JSON.
 */

interface Rewrite {
  source: string;
  destination: string;
}

const configPath = fileURLToPath(new URL('../../../vercel.json', import.meta.url));
const { rewrites } = JSON.parse(readFileSync(configPath, 'utf-8')) as {
  rewrites: Rewrite[];
};

const nipostRewrite = rewrites.find((rewrite) => rewrite.source.startsWith('/api/nipost/'));
const spaFallbackIndex = rewrites.findIndex(
  (rewrite) => rewrite.source === '/(.*)' && rewrite.destination === '/index.html'
);

describe('vercel.json NIPOST routing', () => {
  it('rewrites multi-segment /api/nipost paths to the function', () => {
    expect(nipostRewrite, 'missing /api/nipost rewrite').toBeDefined();
    expect(nipostRewrite?.destination).toContain('/api/nipost/[...path]?path=/:path*');
  });

  it('places the NIPOST rewrite before the SPA fallback', () => {
    const nipostIndex = rewrites.indexOf(nipostRewrite as Rewrite);

    expect(spaFallbackIndex, 'missing SPA fallback').toBeGreaterThanOrEqual(0);
    expect(nipostIndex).toBeGreaterThanOrEqual(0);
    expect(nipostIndex).toBeLessThan(spaFallbackIndex);
  });
});
