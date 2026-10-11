# Postcode Atlas - Work Summary

_Last updated: 2026-10-11_

A running summary of the Ask Atlas work: what was built, what is verified
working, and what is still limited. Written so it can double as source material
for a LinkedIn update (a ready-to-post draft is at the end).

## What this is

**Postcode Atlas** is a Nigerian postcode explorer with an in-app assistant,
**Ask Atlas**. Ask Atlas answers questions about Nigerian states, LGAs,
districts, areas, landmarks and postcodes, and it can move the map. It is
powered **only** by **N-ATLAS** (NCAIR / Awarri's Llama-3-8B multilingual,
tool-calling model). Every other provider is switched off.

- Live: https://nigerian-postalcode-atlas.vercel.app
- Mirror: https://postcode-atlas.vercel.app

## The setup

- **Model:** N-ATLAS Q5_K_M (8B), served locally with `llama.cpp`'s
  `llama-server` on an Apple M1 Max (32 GB, arm64).
- **Public path:** a fixed free ngrok tunnel exposes the local model, so the
  deployed site can reach it.
- **Uptime:** macOS `launchd` jobs keep the model server, the tunnel and
  `caffeinate` running so the Mac stays awake.
- **App:** React + TypeScript + Vite, Leaflet map, deployed on Vercel with a
  serverless function for `/api/ask`. Provider keys never reach the browser.
- **Data:** NIPOST postcode data, bundled offline with a read-through gateway.

## The problem I had to solve

A small 8B model is not a cloud frontier model. Early on, Ask Atlas looked
broken in specific, reproducible ways:

- It **invented postcodes** (for example it answered "Postcode for Ikeja,
  Lagos" with a made-up code built from the prompt's own example).
- It **refused** in-scope questions, or called the **wrong tool**.
- It **degraded whenever any earlier turn was in context**, echoing a previous
  answer or folding an old place into a new question.
- After a tool returned a result it kept **calling tools again** with malformed
  arguments, which triggered `llama.cpp` grammar errors and 500/503 responses.
- **Map requests confused name and type**: "show me Ikeja on the map" and
  "show me Abuja on the map" failed because the model labelled an LGA/city as a
  state.

## What was done (the fix set)

Across **13 files** (9 changed, 4 new helpers):

1. **Concise system prompt** rewritten and ordered by priority.
2. **Greetings** answered as chat, with tools withheld.
3. **Raw conversation history dropped** server-side; follow-up state travels as
   a structured `referent` instead.
4. **Cache hygiene**: refusals are never cached, so a working question can never
   be served a broken answer.
5. **Tools withheld once a tool result exists**, so the model composes instead
   of digging with bogus calls.
6. **Referent block gated** on real follow-up detection, so a self-contained
   question can never inherit a stale place.
7. **Comma-tolerant search** ("Ikeja, Lagos" resolves correctly).
8. **Broadened retry** on stochastic refusals.
9. **Map name resolution hardened**: tolerates "X State" / "X LGA", aliases
   Abuja/FCT, and resolves an LGA that the model placed in the state slot.
10. **Deterministic map-only replies** ("Showing Ikeja LGA, Lagos, on the map.")
    with an accurate footer, instead of the model rambling from memory.
11. **Postcode-invention guard**: a shared helper strips any postcode sentence
    the tools never returned and the user did not type.
12. **Deterministic answer** when a postcode request only resolves to a
    state/LGA: "Ikeja is a Local Government Area, so it has no single postcode..."
13. **No caching of direct answers** that quote an unbacked postcode.

## What is verified working

Confirmed in a real browser against **production** (Vercel -> tunnel -> local
N-ATLAS), each in a fresh session, with the model provider reporting `natlas`:

- **Postcode for Ikeja, Lagos** - correct, honest LGA answer, no invented code.
- **List the LGAs in Kano** - 44 LGAs plus verified units.
- **Decode FC-02-D43-LG-01** - correct five-part breakdown.
- **Landmark lookup** ("The Infrastructure Bank PLC") - correct postcode.
- **Map navigation** - states, Abuja (FCT) and Ikeja all frame correctly.
- **Follow-up context** - "what are its LGAs?" resolves against the last place.
- **Greetings** - warm reply, no map reset.
- **Out-of-scope** ("weather in Lagos") - graceful refusal, no invented data.
- **UI** - persisted chat, type-"delete" confirm, resizable panel, light/dark map.

Gates: `npm run test` (30 unit tests), `tsc --noEmit` clean, production
`vite build` clean. Both domains return HTTP 200 and answer with
`provider: natlas`.

## Evaluation benchmark (feature 13)

`npm run eval` (`scripts/eval-atlas.mjs`) drives the real chat UI in a headless
browser through **16 representative queries** and asserts the invariants that
matter for the challenge:

- **Only N-ATLAS answers** - every reply reports `provider: natlas`.
- **No postcode is ever invented** - a dashed postcode must be backed by a
  "Verified against NIPOST postcode data" footer.
- **The right family of answer** - lookup, LGA list, decode, map move, refusal,
  or small-talk.
- **Ambiguity is handled** - "Lagos", "Port Harcourt", "Wuse", "Delta", and bare
  "Ikeja" never fabricate a code; they resolve or ask.
- **Follow-ups resolve** - "what are its districts?" stays on the previous place.

It reads the grounding meter, the verified-postcode guard, the top-bar
breadcrumb, and the map zoom, then writes a pass/fail matrix to
`scripts/eval-report.md` (and `.json`).

Result: **16/16 passed** against the local N-ATLAS server, and **16/16 against
production** (`ATLAS_URL=https://nigerian-postalcode-atlas.vercel.app/ npm run
eval`), so the same battery passes over the live Vercel -> tunnel -> local
N-ATLAS path.

## What is NOT working (honest limitations)

- **District and area lists are empty and cannot be bundled.** NDAPS does expose
  districts and areas, but two things block a client-side list. They are
  **code-only** (`{"code":"A01"}`, no names), and the publishable key is refused
  from browser origins (`403 origin_not_allowed`), so the client's gateway
  read-through never returns. Bundling them is not a fix either: NDAPS has about
  222,277 districts and about 5M areas, a roughly 290 MB snapshot that would add
  no names. The postcode structure still decodes district and area segments
  locally (for example `D43`, `LG`). Ask Atlas now answers this honestly: an
  empty district or area scope returns "I can't list districts or areas..." with
  the reason, instead of claiming none exist.
- **"Near me" is effectively empty.** The NIPOST nearby gateway returns no units
  and the browser origin is blocked, so the honest answer is "no postcodes
  within 300 m".
- **Map precision is ~4/5.** Occasionally a request for an LGA frames its parent
  state instead. It is grounded and honest, just less precise.
- **Stochastic 8B mistakes remain.** Rarely the model still picks the wrong tool
  (for example `getPostcode` for a map request). The response guard keeps any
  bad output from being presented as verified fact, but it can still surface a
  refusal.
- **Production depends on the Mac.** If the Mac sleeps or loses internet, Ask
  Atlas returns 503. It is a free-tier, laptop-hosted demo by design.
- **Unit tests cover logic only.** 30 Vitest tests cover the postcode guards,
  follow-up and small-talk detection, and the referent and map derivations.
  Component and end-to-end behavior is still verified by the `npm run eval`
  browser benchmark and manual browser evidence.
- **Security follow-up:** the ngrok authtoken was echoed in an earlier log and
  should be rotated.

## Next steps

- Districts/areas: the honest "not available offline" reply is shipped. The
  remaining option is a same-origin server proxy that reads NDAPS with a
  server-side key and returns the code-only lists.
- Explore a hosted model fallback so the demo is not laptop-bound.

## LinkedIn draft (edit before posting)

> Most "AI search" demos are one API call away from looking great. Teaching a
> small open model to answer Nigerian postcode questions _honestly_ is a very
> different problem.
>
> I've been building **Ask Atlas** for **Postcode Atlas**: an assistant that
> answers from a real Nigerian postcode dataset, powered entirely by
> **N-ATLAS**, NCAIR / Awarri's Llama-3-8B multilingual tool-calling model,
> running on my own laptop and served through a tunnel.
>
> The hard part was not the model, it was trust. Early on it invented postcodes,
> refused in-scope questions, and changed the map to the wrong place. So I built
> it the honest way:
>
> - 10 read-only tools (states, LGAs, districts, areas, postcodes, decode,
>   landmarks, nearby, map navigation)
> - a guard that strips any postcode a tool never returned
> - deterministic, factual answers for pure map moves and for LGA/state
>   postcode questions
> - no conversation history leaking stale places into a new question
> - verified footers, so you can see when an answer is backed by real data
> - a 16-case browser benchmark that fails loudly if the model ever invents a
>   postcode or drops the wrong tool
>
> What works today: postcode lookups, decoding, LGA lists, landmark postcodes,
> map navigation, follow-ups, greetings and graceful "out of scope" replies.
> What doesn't: districts/areas lists (dataset gap), "near me" (upstream gateway
> is empty), and it only runs while my laptop is awake.
>
> A small model, real data, and no invented answers. Sometimes "it works" and
> "you can trust it" are two different engineering problems.
>
> #AI #LLM #OpenSource #Nigeria #Geospatial #Postcodes #Awarri #NCAIR
