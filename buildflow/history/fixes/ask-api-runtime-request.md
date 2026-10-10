# Fix: /api/ask runtime adapter (Node message -> Web Request)

**Type:** Fix
**Status:** verified - `/implement` updates this durable workflow state as
work and verification progress.

## The problem

Live verification of the previous deploy fix (`buildflow/history/fixes/ask-api-deploy.md`)
resolved the ESM module-resolution crash, but `POST /api/ask` still returns 500.
Fresh Vercel log:

```
TypeError: request.headers.get is not a function
    at handleAsk (handler.ts:322)  at ask (api/ask.ts:23)
```

Vercel's Node runtime invokes the default export with a Node-style
`IncomingMessage` (`.headers` is a plain object, `.method`/`.url` present, body
is a readable stream), while `handleAsk` expects the Web `Request` API
(`request.method`, `request.headers.get`, `request.json`). The proven pattern
is already in the repo: the dev middleware in `vite.config.ts` drains `req`,
copies headers, and builds a `new Request(...)` before calling `handleAsk`.

## The fix

In `api/ask.ts`, pass a real Web `Request` through unchanged
(`instanceof Request`); otherwise convert the Node-style message to a Web
`Request` by mirroring the dev middleware: drain the stream into chunks
(`for await`), copy headers into a `Headers`, and build the `Request` with the
utf-8 body. Nothing else changes; `handleAsk` stays the single source of
truth.

## Build steps

- [x] **Add the request adapter in `api/ask.ts`** - `toWebRequest(value)` plus a
   pass-through for real `Request` instances, wired into the default export.
   *Done when:* `npm run lint` and `npm run build` pass, and the built lambda
   still boots (`node` import probe prints `BOOT OK`).
   *Evidence (2026-10-10):* `npm run lint` and `npm run build` green; lambda
   probe `BOOT OK`; a simulated Node-style message through the built default
   export returned a real 200 scope-guard answer (provider chain ran:
   openrouter 401 quota, next provider answered) - no TypeError.
- [ ] **Live proof** - after merge and redeploy, `POST
   https://postcode-atlas.vercel.app/api/ask` returns a real answer (a Gemini
   tool-calling turn), not 500 or 503. Requires the user's explicit deploy
   approval; local dev already proves the handler path works end to end
   (observed 2026-10-10).

## Verify

Local: `npm run lint` (tsc) and `npm run build`; the `node` import probe on
`.vercel/output/functions/api/ask.func` (BOOT OK); the adapter behavior is
identical to the dev middleware that already produced a live Gemini tool call
earlier today. Live: redeploy, then `POST /api/ask` must answer.