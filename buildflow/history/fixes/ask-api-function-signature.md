# Fix: /api/ask function signature (named POST, web-style)

**Type:** Fix
**Status:** verified - `/implement` updates this durable workflow state as
work and verification progress.

## The problem

The live proof in `buildflow/history/fixes/ask-api-runtime-request.md` failed.
The runtime adapter is sound, but Vercel's Node runtime treats a **default
export as `(req, res) => void`**: it ignored the returned `Response` and the
request hung until client timeout. The Vercel log states:

```
WARN: default export returned a `Response` ... The default-export signature is
`(req, res) => void` - returns are ignored. You likely meant the Web
`fetch`-style API.
Fix: export a `fetch` function or a named HTTP method:
        export function GET(request) { return new Response('ok') }
```

## The fix

In `api/ask.ts`, replace the default export with a named web-style
`export async function POST(request)` that returns `handleAsk(...)`. Named HTTP
methods receive a real Web `Request` whose returned `Response` is honored on
the Node runtime. Keep the adapter for defense: pass through when
`headers.get` is a function (a Web `Request`), otherwise convert the Node-style
message with the existing `toWebRequest`. Keep `maxDuration` and
`config.runtime: 'nodejs'`.

## Build steps

- [x] **Switch to a named `POST` export** in `api/ask.ts` with the `headers.get`
   discriminator for the pass-through. *Done when:* `npm run lint` and
   `npm run build` pass; the built lambda boots; a probe proves both the
   pass-through (real `Request`) and the adapter (fake Node message) paths.
   *Evidence (2026-10-10):* lint + build green; `vercel build` ok; probe on the
   built lambda printed `WEB-REQUEST path -> status: 200` and
   `NODE-MESSAGE path -> status: 200` via the real provider chain (openrouter
   401 on quota, next provider answered).
2. **Live proof** - after merge and redeploy, `POST
   https://postcode-atlas.vercel.app/api/ask` returns a real answer (not a
   hang, 500, or 503). Requires the user's deploy approval in this chat.

## Verify

Local: lint, build, lambda boot plus both-path probe (real Request and fake
Node message). The `headers.get` discriminator comes straight from the
original live error (`TypeError: request.headers.get is not a function`), so
it is precise. Live: redeploy, POST, expect ~seconds to an answer.