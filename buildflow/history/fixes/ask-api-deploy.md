# Fix: Production /api/ask crashes (ESM extensionless imports) + provider key missing

**Type:** Fix
**Status:** verified - `/implement` updates this durable workflow state as
work and verification progress.

## The problem

`POST /api/ask` returns 500 in production (`https://postcode-atlas.vercel.app`).
Vercel logs:

```
ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/src/server/ask/handler'
imported from /var/task/api/ask.js
```

Root cause: the project ships `"type": "module"`, so Vercel's Node builder
emits the `api/ask` function as ESM and compiles the traced TS files to `.js`
per file without rewriting import specifiers. The runtime relative imports in
the function graph have no `.js` extension, and Node ESM requires exact
specifiers, so the function fails at module load. It has never worked in
production (the deployed demo cannot answer a single Ask Atlas question).

Secondary blocker: Vercel production has only `VITE_NIPOST_PUBLISHABLE_KEY`.
Even after the import fix, `/api/ask` would return
`503 all_providers_unavailable "Ask Atlas is not configured yet"` because
`resolveProviders` finds no key. Local `.env` has `GEMINI_API_KEY`,
`OPENROUTER_API_KEY`, and `NVIDIA_API_KEY` (names verified, values never
printed or committed).

## The fix

Add `.js` extensions to the eight runtime (non-type) relative import
specifiers in the Vercel function graph so the emitted ESM resolves:

- `api/ask.ts`: `../src/server/ask/handler` -> `../src/server/ask/handler.js`
- `src/server/ask/handler.ts`: `../../lib/tools/provider`,
  `./prompt`, `./providers`, `./chain` -> `+ .js`
- `src/server/ask/chain.ts`: `./providers` -> `./providers.js`
- `src/lib/tools/provider.ts`: `./schemas`, `./types` -> `+ .js`

Type-only imports and client-side files are untouched (erased at compile time
or resolved by the Vite bundler, which accepts `.js` -> `.ts`). `tsc`
(`moduleResolution: bundler`) and Vite both accept `.js` specifiers pointing at
`.ts` sources; the Vercel per-file esbuild compile leaves the specifier
unchanged, so at runtime it resolves to the emitted `.js` next to it.

Ops part (needs separate explicit approval, not part of the code diff): add
`GEMINI_API_KEY` and the failover keys to Vercel production env, redeploy, and
verify live.

## Build steps

1. **Add `.js` extensions to the eight runtime relative imports** in the
   function graph listed above. *Done when:* `npm run lint` (tsc) and
   `npm run build` (vite) pass, and `npx vercel build` reproduces a func whose
   `ask.js` and dependents all import extensioned specifiers.
   *Evidence (2026-10-10):* `npm run lint` and `npm run build` both green;
   `npx vercel build` emitted a func whose eight runtime relative specifiers
   all end in `.js`.
2. **Prove the emitted lambda boots.** Import the built func locally
   (`node -e "import(...)"` against `.vercel/output/functions/api/ask.func`)
   and confirm the module graph loads; every dependency resolves. *Done when:*
   no `ERR_MODULE_NOT_FOUND`, and the handler module exports `default` and
   `maxDuration`.
   *Evidence (2026-10-10):* `node -e "import('./api/ask.js')..."` printed
   `BOOT OK - default fn: function | maxDuration: 60` from the built func;
   the prior 500 failure was `ERR_MODULE_NOT_FOUND`, which no longer occurs.

## Verify

After merge, the live proof is: `POST https://postcode-atlas.vercel.app/api/ask`
returns a real answer (not 500/503). That requires setting the provider key in
Vercel production and redeploying - both remote actions, done only with the
user's explicit yes. Local proof in this spec: `npm run dev` then
`POST localhost:3001/api/ask` answers (Gemini tool call observed 2026-10-10
before the fix), plus the built-lambda import probe in step 2.