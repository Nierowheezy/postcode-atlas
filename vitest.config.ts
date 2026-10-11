/**
 * Unit test config. Kept separate from `vite.config.ts` so tests do not load
 * the dev-server middleware, Tailwind, or the React plugin. Testing covers pure
 * logic only (parsers, guards, derivations), never components or the browser.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  resolve: {
    alias: { '@': root },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
