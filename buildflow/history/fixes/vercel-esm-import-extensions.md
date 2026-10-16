# Fix: Ship Vercel serverless functions with Node-resolvable import extensions

**Type:** Fix
**Status:** verified
**Branch:** `fix/vercel-esm-import-extensions`
**Completed:** 2026-10-16

## Problem

Every API route on the deployed app returned HTTP 500 (`FUNCTION_INVOCATION_FAILED`):

- `https://nigerian-postalcode-atlas.vercel.app/api/ask` (Ask Atlas)
- `/api/v1/*` (developer API)
- `/api/nipost/*` (NDAPS proxy)

Static assets and local dev were fine. Vercel runtime logs showed:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/src/lib/tools/types'
  imported from '/var/task/src/lib/tools/schemas.js'
```

## Root cause

Vercel compiles each `api/` function **per file** to plain `.js` (TypeScript
transpile, no bundling) and runs it in Node ESM. Confirmed locally with
`vercel build`: `.vercel/output/functions/api/ask.func/` shipped `src/**/*.js`
with import specifiers kept verbatim, no `.ts` files, and
`.vc-config.json` pointing at `handler: api/ask.js`.

The codebase used **extensionless relative imports** (`from './types'`). Vite
(dev, build), vitest, and `tsc --noEmit` all resolve those, but Node ESM rejects
them. So the same handler worked in Vite middleware locally and crashed in the
Node runtime on Vercel.

This was pre-existing on `main`, not caused by the recent feature commits: the
first failing specifier (`schemas.ts -> ./types`) has been present since feature
3b, and all three unrelated function entries failed identically.

## Fix

Give every relative import in the server graph an explicit `.js` extension,
matching the style already used in half the server files
(`from './providers.js'`).

- 29 specifiers across 15 files reachable from the three `api/` entries:
  `src/server/ask/*`, `src/server/api/*`, `src/server/nipost/handler.ts`,
  `src/lib/tools/{schemas,types}.ts`, `src/lib/ask/types.ts`,
  `src/lib/explain/topics.ts`, `src/lib/address/types.ts`.
- `.js` (not `.ts`) because that is what Node sees after transpilation and what
  the existing server files already use.
- Client code and unrelated modules were left untouched; only the server graph
  is loaded directly by Node.
- `src/server/importExtensions.test.ts` (new, 2 tests) walks the import graph
  from the three `api/` entries and fails on any extensionless relative
  specifier, so nothing local can let this regress.

## Verify

- `npm run test && npm run lint && npm run build` -> 486 tests passed (was 484,
  +2). `tsc --noEmit` clean. Build succeeded.
- `vercel build` succeeded; a grep of the shipped `.func` output found **0**
  extensionless relative specifiers.
- Plain-Node import of all three built entries (`api/ask.js`,
  `api/v1/[...path].js`, `api/nipost/[...path].js`) succeeded, the exact
  operation that previously raised `ERR_MODULE_NOT_FOUND`.
- Invoking the built Ask handler returned a real response
  (`400 {"error":{"code":"bad_request",...}}`) instead of a module crash.

## Known limits

- Only the server graph was converted. Client modules keep extensionless
  imports because Vite bundles them and Node never loads them directly.
- The fix removes the import-resolution failure; it does not change Ask Atlas
  answer behavior. The earlier guard limits (stale code arguments,
  `explainAtlas` drift) still apply.
