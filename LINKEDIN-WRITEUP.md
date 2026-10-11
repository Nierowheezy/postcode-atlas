# Postcode Atlas × Ask Atlas — LinkedIn package

Everything you need to post the project with the demo video. Copy the sections you
want. Placeholders in `[square brackets]` need your input.

- **Part 1** — the post itself (paste-ready, under LinkedIn's 3,000-character limit)
- **Part 2** — a short alternative hook
- **Part 3** — the long-form article ("the full codebase, working code, everything")
- **Part 4** — a 6-slide carousel script
- **Part 5** — hashtags, tags, and a video caption
- **Part 6** — a fact sheet, so every number you quote is real

---

## Part 1 — The LinkedIn post (paste-ready)

> I built an AI assistant that refuses to make things up about Nigerian postcodes.
>
> Nigeria's postal service (NIPOST) runs **NDAPS** — an 11-character digital address for every location in the country. It looks like this:
>
> `LA-11-A12-AK-08`
>
> State • LGA • District • Area • Unit.
>
> One address, five levels of hierarchy, eleven characters. Powerful — and hard to explore.
>
> So I built **Postcode Atlas**: an interactive map of the entire national addressing system. Browse all 37 states, drill into LGAs, decode any code into its five segments, reverse-geocode your GPS to the nearest unit, or play a postcode-hunting game.
>
> Then I added **Ask Atlas**. Ask in plain language — English, Yorùbá, Hausa, or Igbo — and get grounded answers:
>
> • "List the LGAs in Kano."
> • "What is the postcode for The Infrastructure Bank PLC?"
> • "Show me Kano on the map."
>
> Here's the part I'm proudest of: **it's honest by construction.**
>
> The model under the hood is **N-ATLAS**, an 8-billion-parameter model from Awarri & NCAIR. Small models hallucinate — and for a postal utility, a made-up postcode isn't a bug, it's a wrong building.
>
> So I built guard rails:
>
> → **Only tool data is shown.** Any postcode-shaped string the tools never returned is stripped before the user sees it.
> → **Every reply is labelled by what actually backs it** — "Verified against NIPOST postcode data", "Answered from NIPOST tool results", or an honest "Not verified".
> → **Out-of-scope questions** (like "what's the weather?") get a graceful refusal, not a guess.
> → **A bare "hi" gets no data footer at all** — because it made no data claim.
>
> Under the hood: React 19 + TypeScript + Vite, a Leaflet map, and all NIPOST data over a publishable-key gateway. Ask Atlas is a single server function with a provider chain (N-ATLAS first, free tiers as failover) and a browser-driven tool loop over 10 read-only tools. I also run N-ATLAS myself — the ~6 GB Q5_K_M GGUF, served with llama.cpp on my Mac and exposed through a fixed tunnel — so the whole demo runs on zero paid infrastructure. **38 unit tests** and a **16-case browser benchmark** that drives the real UI — 16/16 passing.
>
> It's free and open source (Apache-2.0).
>
> 🔗 Live: https://nigerian-postalcode-atlas.vercel.app
> 💻 Code: https://github.com/Nierowheezy/postcode-atlas
>
> 45-second demo attached. 👇
>
> Built for [the competition/hackathon]. Big thanks to [@Awarri] and [@NCAIR], and to NIPOST for opening up the NDAPS data.
>
> #Nigeria #AI #React #TypeScript #OpenSource #NIPOST #NDAPS #BuildInPublic #Geospatial

---

## Part 2 — Short hook (if you want a punchier opening)

> Most AI assistants try to answer everything.
>
> I built one that tries to **know when it doesn't know**.
>
> It answers questions about Nigerian postcodes — and if it can't ground an answer in real NIPOST data, it says so instead of inventing one.
>
> That design choice is the whole product. 🧵👇

Then paste the "Here's how it works" body from Part 1, or point people to the article.

---

## Part 3 — Long-form article (LinkedIn "Article" / blog / GitHub)

> Suggested title: **Building an honest AI over Nigeria's national postcode system**

### The problem

Every location in Nigeria has an 11-character digital address under NDAPS, the
National Digital Addressing System run by NIPOST. The code encodes a full
administrative hierarchy:

```
LA - 11 - A12 - AK - 08
│    │    │     │    └── Unit     (street-level delivery unit)
│    │    │     └─────── Area     (Postal Code Area)
│    │    └───────────── District (Postal District)
│    └────────────────── LGA      (Local Government Area)
└─────────────────────── State    (2-letter code; LA = Lagos, FC = Abuja)
```

That structure is genuinely useful — but a raw string like `LA-11-A12-AK-08`
tells a person nothing. I wanted to make the hierarchy *visible and explorable*,
and I wanted a natural-language assistant that could answer questions about it
**without ever inventing data**.

This is the story of how Postcode Atlas and its assistant, Ask Atlas, were built,
and the honesty architecture at the centre of it.

### What the app is

Postcode Atlas is a static React app backed by one small serverless function.
It has four modes of use:

- **Explore** — a full-screen Leaflet map of all 37 states plus the FCT. Select a
  state, fly to its centroid, see its LGA count and geopolitical zone, drill down.
- **Decode** — enter any 11-character postcode and it resolves against the NDAPS
  gateway and breaks into its five segments. There's an assembly tool for the
  reverse direction.
- **Locate** — reverse-geocode your GPS position to the nearest NDAPS unit, or
  search nearby units around any point you tap (300 m cap).
- **Play** — "Postcode Hunt", a scored challenge mode.
- **Ask** — the assistant.

Everything is TypeScript, Tailwind, and React 19. There is no backend except
`/api/ask`, and that exists for exactly one reason: LLM provider keys must never
ship to the browser.

### Why the assistant needed a different design

The competition this was built for requires the **N-ATLAS** model — an
8-billion-parameter model by Awarri & NCAIR — to be the answer engine. An 8B
model is capable but not infallible. In practice it does three things that break
a data utility:

1. It **manufactures postcodes** that look right but were never returned by a
   tool (for example `FC-02-11-01-01`, built from a code pattern and an LGA code).
2. It maps a bare **greeting** to the only no-argument tool it has, resetting the
   map and falsely marking the chat reply as "grounded".
3. It **refuses** in-scope questions, or **echoes** a previous answer, once raw
   conversation history is in context.

Each of those is a different failure with a different fix. The rest of this
article is those fixes.

### Architecture at a glance

```
┌──────────────────────────── Browser (static bundle) ───────────────────────────┐
│                                                                                │
│  React 19 UI ── Ask Atlas panel ── responder.ts  ──┐                            │
│                                                    │  drives up to 3 tool rounds│
│  lib/tools/registry.ts ── runTool()  (validation boundary)                      │
│      └── 10 read-only executors                                                 │
│            ├── lib/atlas/store.ts   (IndexedDB snapshot)                        │
│            └── lib/api/postcodeClient.ts  (NIPOST gateway, publishable key)     │
│                                                                                │
└───────────────────────────────┬────────────────────────────────────────────────┘
                                │  POST /api/ask  (plain HTTP, tool loop over the wire)
┌───────────────────────────────▼──────────────── Vercel Function ───────────────┐
│  server/ask/handler.ts                                                          │
│    ├── sanitize + validate request        ├── reply cache (10 min, per instance)│
│    ├── buildSystemPrompt()                └── provider chain with cooldowns     │
│    └── providers.ts → [N-ATLAS, Gemini, OpenRouter, NVIDIA]  (fall over on 429) │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Two design decisions stand out:

- **Tools run in the browser, not the model server.** The Atlas data is already
  client-side (cached) or one fetch away. Keeping execution in the browser means
  the server never needs database access, and the exact tool results the user's
  screen shows are the ones the model reasons over.
- **The provider chain is server-side.** Keys stay in `process.env`. The client
  only ever sees an OpenAI-compatible JSON response.

### The honesty architecture

This is the interesting part. "Don't hallucinate" isn't a prompt; it's a set of
independent, testable mechanisms.

#### 1. Strip postcodes the tools never returned

A reply is only allowed to show a postcode-like string if a tool returned it or
the user typed it. `src/lib/ask/postcode.ts` is the guard:

```ts
const POSTCODE_LIKE =
  /\b[A-Z]{2}-\d{2}-[A-Z0-9]{1,4}-[A-Z0-9]{1,4}-\d{1,3}\b/g;

export function postcodesIn(value: string): Set<string> { /* ... */ }

export function stripUnbackedPostcodes(text: string, backed: Set<string>): string {
  return text.replace(POSTCODE_LIKE, (token) =>
    backed.has(token.toUpperCase()) ? token : ''
  );
}
```

The regex is deliberately *loose* on the last three segments: a hallucinated
`FC-02-11-01-01` has the strong `XX-99` state/LGA signal, so it's caught even
though it isn't a well-formed NDAPS code. The guard runs on both the client and
the server, so a code can't slip through either path.

#### 2. Label every reply by what actually backs it

Footers are not decoration — they're a precise claim. `grounding.ts` is pure and
unit-tested:

```ts
export function groundingBasis(message: AskAtlasMessage): GroundingBasis {
  if (message.lookup || message.results || message.decoded ||
      (message.nearby && message.nearby.items.length > 0)) return 'payload';
  if (message.mapAction) return 'map';
  if (message.question && isSmallTalk(message.question)) return 'chat';
  return message.grounding === 'atlas' ? 'tools' : 'none';
}

export const GROUNDING_FOOTER = {
  payload: 'Verified against NIPOST postcode data',
  map: 'Map moved using NIPOST location data',
  tools: 'Answered from NIPOST tool results',
  none: 'Not verified against NIPOST data',
} as const;   // 'chat' renders no data footer at all
```

Two subtleties that took real thought:

- **"A tool ran somewhere" is a weaker claim than "here is derived data".** So a
  payload-less reply gets "Answered from NIPOST tool results", not "Verified".
- **An empty nearby search verifies nothing.** The tool ran and found zero units,
  so it must *not* claim a verified payload — it falls through to the honest
  label. (This was a real bug we found and fixed.)

#### 3. Send small talk with the tools switched off

N-ATLAS maps "hi" to `navigateMap(reset)`, which resets the map and marks the
reply as grounded. The fix is structural, in `handler.ts`:

```ts
const smallTalk = isSmallTalk(text);
// Once a tool result is in context, withhold tools again: N-ATLAS otherwise
// keeps digging with fresh (often malformed) calls instead of composing the answer.
const tools =
  smallTalk || toolTurns.turns.length > 0 ? undefined : ATLAS_PROVIDER_TOOLS;
```

`isSmallTalk` is an exact match after normalisation, so any message that also
names a place, a postcode, or a map action still reaches the tools. And a reply
that was exactly small talk gets **no data footer at all** — because it never
claimed to be data.

#### 4. Retry a stochastic refusal once

An 8B model sometimes refuses an in-scope question instead of calling a tool:

```ts
if (!smallTalk && result.toolCalls.length === 0 && isRefusalText(result.text)) {
  try {
    result = await runChain(env, messages, tools);   // one extra sample
  } catch { /* keep the first, honest reply */ }
}
```

Refusals are also **never cached** — a single bad sample served from cache would
make a working question look broken for the whole TTL.

#### 5. Keep history out of the prompt, carry a structured referent instead

Raw multi-turn history makes N-ATLAS echo previous answers. So prior turns are
*not* forwarded. Instead, a follow-up like "what are its LGAs?" resolves against a
small structured `referent` (kind + code + name) derived from the previous turn's
tool result. The referent is sanitized at the server boundary — only a known kind
survives, anything malformed drops the whole field.

#### 6. Bound everything

An LLM loop against a small model needs hard limits. Oversized tool results are
never sliced mid-token — they're re-sent as valid JSON that names itself as
partial, so the model can see it's incomplete:

```ts
return JSON.stringify({
  ok: true,
  data: narrowOversizedData(result.data),
  truncated: true,
  note: 'This result was too large to send in full, so it is PARTIAL. Treat it as \
incomplete: say how many rows you actually received rather than presenting them \
as the whole list, and ask for a narrower scope to see the rest.',
});
```

The client drives at most 3 tool rounds; the server accepts at most 4. Request
bodies are capped at 64 kB, text at 500 chars, each tool message at 8 entries.

### The tool layer

Ten tools, all read-only, defined once with Zod and emitted as OpenAI-compatible
JSON Schema:

`searchLocation`, `getState`, `getStates`, `getLgas`, `getDistricts`, `getAreas`,
`getPostcode`, `decodePostcode`, `getNearby`, `navigateMap`.

`runTool()` is the single validation boundary — model-supplied JSON goes in, a
typed result comes out, and it **never throws**:

```ts
export type ToolExecutionResult<Data> =
  | { ok: true; data: Data }
  | { ok: false; error: ToolError };
```

The executors are defensive about the messy realities of a real API: they accept
`Lagos State` as well as `LA`, map `Abuja` → `FC`, find an LGA when the model
calls it a state ("show me Ikeja on the map" works), and normalise the gateway's
`[lng, lat]` geometry to Leaflet's `[lat, lng]`.

### The provider chain

`/api/ask` tries providers in order and falls over on failure, with cooldowns so
a rate-limited provider isn't hammered:

- **N-ATLAS** (prepended when `NATLAS_BASE_URL` is set) — the required engine
- **Gemini → OpenRouter → NVIDIA** free tiers as failover

Cooldown policy: `429` → 10 min, quota `401/403` → 15 min, transient `5xx` → 8 s.
If a provider rejects the tools payload with a 400, it's retried once *without*
tools so the chat still degrades to an honest text-only answer. When every
provider is down, the client gets a clean `503` with a retry hint — never a
provider error.

### The data pipeline

`npm run dataset` walks the NDAPS reference API and writes
`public/atlas-data.json`: a versioned, atomic snapshot (write temp → rename) of
**37 states and 774 LGAs** in about 35 KB. Districts and areas are deliberately
*not* snapshotted — there are hundreds per parent and the full set would be
enormous — so those reads fall through to the gateway at runtime.

The client store is local-first: read the snapshot from IndexedDB, and only fall
back to the network when a key is missing. That keeps the app fast, works
offline once hydrated, and respects the gateway's rate limits.

### Testing and evaluation

Two layers:

- **38 unit tests** (Vitest) over the honesty-critical pure logic: grounding,
  postcode guards, small talk, follow-up, and the responder's derivations.
- **A 16-case browser benchmark** (`npm run eval`) that drives the *real UI* with
  Playwright. It doesn't test functions — it types into the actual input box,
  clicks send, and asserts on the rendered reply. Cases cover the hard parts:

  - provider must be N-ATLAS (`natlas · try N`)
  - **no invented postcodes** — every case asserts a quoted code is either
    tool-backed or typed by the user
  - map requests actually move the map (breadcrumb + zoom change)
  - out-of-scope questions refuse gracefully
  - ambiguous inputs ("Lagos", "Wuse", "Ikeja") never produce a fake code
  - follow-ups resolve "its" to the right place

Current result: **16/16 passing**, with the report committed to the repo.

### Deployment and runtime

The app is a fully static Vite build on Vercel. `/api/ask` is the only server
code, and it exists for exactly one reason: provider keys must never reach the
browser. The build also ships a service worker, so the map and the bundled
dataset work offline once loaded.

### Running an 8B model on my own machine

The competition requires **N-ATLAS** to be the answer engine, so instead of
calling a hosted API the assistant talks to a model running on the Mac on my
desk. Getting that to work reliably, for free, from a serverless function turned
out to be the most interesting engineering problem in the project.

**The model is gated, and it's big.** N-ATLAS is published on Hugging Face by
Awarri and NCAIR at `NCAIR1/N-ATLaS`. It's a *gated* repo: you accept the licence
before you can download anything. Inside is the full-precision model as
`safetensors` in four shards, about 16 GB — far too heavy to serve from a laptop,
and the repo itself ships no GGUF.

**Quantization is what makes it a laptop model.** Running it means reaching for a
GGUF build, and the community has already done the work: I use the **Q5_K_M**
quantization from
[`QuantFactory/N-ATLaS-GGUF`](https://huggingface.co/QuantFactory/N-ATLaS-GGUF),
which takes those ~16 GB down to roughly 6 GB — small enough to sit in memory and
answer at conversational speed on Apple silicon, with no meaningful loss on the
tasks it has to do. Most of the "senior" work in local inference is knowing which
artifact to trust and how to serve it, not hand-reimplementing a quantizer.

**Serving it as an API.** `llama.cpp`'s `llama-server` hosts the GGUF behind an
OpenAI-compatible endpoint on `127.0.0.1:8081` (8k context, tool-calling on).
That one choice is why the app is portable: the code posts to the local model
exactly the way it would post to OpenAI, so the engine is a single environment
variable (`NATLAS_BASE_URL`) and nothing else changes.

**Bridging a datacentre to a desk.** The Vercel function runs in a datacentre;
the model is behind my router. A free **ngrok** tunnel with a fixed domain
(`ngrok http 8081 --url=…`) gives the function a stable public URL to POST to, so
the serverless code never knows the model isn't remote.

**Keeping it up without me.** Three macOS `launchd` agents start on login and
restart on failure: one for `llama-server`, one for the tunnel, and one running
`caffeinate -s` so the machine never sleeps mid-demo. "It's running on my laptop"
is a fine demo story; "it went to sleep and returned 503" is not — and the gap
between them is entirely ops.

**The honest trade-off.** A laptop is not a datacentre. If the Mac is asleep or
offline, the assistant returns a clean `503` instead of pretending to work. I
documented that rather than hid it, and because the engine sits behind one env
var, the same app runs against any hosted OpenAI-compatible model the day the
demo stops needing to fit on my desk.

**What local tool-calling taught me.** `llama-server` validates tool calls
against a grammar, so a malformed call from a small model surfaces as a *server*
error rather than a bad answer. That pushed two fixes into the app: withhold the
tools once a tool result is already in context (so the model composes instead of
digging with bogus calls), and treat every tool call as untrusted input through a
single validation boundary.

### The demo video

The 45-second promo is built with **Remotion** — React components rendered to
video, no timeline editor. One codebase exports two cuts: 16:9 (1920×1080) for
the LinkedIn feed and YouTube, and 9:16 (1080×1920) reframed for Reels and
Shorts. Both run 30 fps across six scenes: hook → the problem → the assistant →
"grounded by design" → map + decode → sovereign/multilingual outro.

Every product shot is a **real screenshot of the deployed app** — not a mockup.
`scripts/capture-stills.mjs` drives the live site with Playwright, injects
faithful conversations into `localStorage`, and screenshots the result, so the
video shows the actual UI with zero model calls and renders deterministically.

It's scored with "Inspired" by Kevin MacLeod (CC BY 4.0, credited on screen), and
the same Remotion project renders the 1200×630 link-preview card the app serves
as `og.jpg`.

### What I learned

- **Honesty is architecture, not prompt wording.** Every "don't hallucinate"
  instruction in a system prompt is a hope. A regex that strips an unbacked code
  is a guarantee.
- **Small models need scaffolding.** Withholding tools for small talk, retrying
  a refusal, carrying a structured referent instead of raw history — none of
  those are glamorous, and all of them mattered more than any prompt tweak.
- **Label the strength of your claims.** "Verified", "from tool results", and
  "not verified" are three different truths. Saying which one applies is more
  trustworthy than a single confident badge.
- **Model serving is an ops problem.** A good answer is the easy half. Choosing
  a quantization that fits, standing up an OpenAI-compatible server, tunnelling
  it out, and keeping three `launchd` agents alive is what makes "it runs on my
  laptop" survive a live demo.
- **Test the behaviour, not the function.** The 16-case browser benchmark
  catches the failures that unit tests never see.

### Links

- Live: https://nigerian-postalcode-atlas.vercel.app
- Source (Apache-2.0): https://github.com/Nierowheezy/postcode-atlas
- Model: N-ATLAS by Awarri & NCAIR — https://huggingface.co/NCAIR1/N-ATLaS (gated)
- Quantization used: https://huggingface.co/QuantFactory/N-ATLaS-GGUF
- Data: NIPOST NDAPS

---

## Part 4 — Carousel script (7 slides)

1. **Title** — Ask Atlas: an AI assistant that says "I don't know."
   *(subtitle: grounded answers over Nigeria's national postcode system)*
2. **The problem** — Every Nigerian address is an 11-char code: `LA-11-A12-AK-08`.
   One address. Five levels. Hard to navigate.
3. **The build** — React 19 + TypeScript + Vite + Leaflet. Ask Atlas = one server
   function, 10 read-only tools, N-ATLAS first with free-tier failover.
4. **Honest by construction** — Unbacked postcodes are stripped. Every reply is
   labelled by what actually backs it.
5. **The proof** — 38 unit tests. A 16-case browser benchmark that drives the
   real UI. 16/16.
6. **Under the hood** — N-ATLAS (8B) quantized to ~6 GB, served with `llama.cpp`
   on a laptop behind a fixed tunnel, spoken to over an OpenAI-compatible API.
7. **Stack + CTA** — Apache-2.0. Free. English + Yorùbá + Hausa + Igbo. React,
   TypeScript, Leaflet, Vitest, Playwright, Remotion. Live demo and source in the
   comments. Video below. 🔗

---

## Part 5 — Hashtags, tags, and video caption

**Primary hashtags** (use 5–8, not all):

```
#Nigeria #AI #React #TypeScript #OpenSource #NIPOST #NDAPS #BuildInPublic
#Geospatial #MachineLearning
```

**People/orgs to tag** (use the real handles): Awarri, NCAIR, NIPOST.

**Which cut to post here:** the 16:9 cut for the feed and the article; keep the
9:16 cut for Reels / Shorts / Stories.

**Video caption:**

> Ask Atlas — grounded answers over Nigeria's national postcode system. Built on
> N-ATLAS. It never invents a postcode. 45s. 🔊 sound on (or on mute — the story
> is on screen).

---

## Part 6 — Fact sheet (every number you can safely quote)

| Fact | Value |
| --- | --- |
| NDAPS code format | `AA-99-H77-BB-55` (5 segments, 11 chars) |
| Coverage | 37 states + FCT |
| Snapshot | 774 LGAs, ~35 KB, versioned + atomic |
| Districts/areas | live gateway fallback (not snapshotted) |
| Assistant tools | 10, all read-only |
| Reply languages | English, Yorùbá, Hausa, Igbo |
| Providers | N-ATLAS (local, first) + Gemini/OpenRouter/NVIDIA failover |
| Unit tests | 38 passing |
| Browser benchmark | 16 cases, 16/16 passing |
| Client tool rounds | max 3 (server accepts 4) |
| Request caps | 64 kB body, 500-char text |
| Grounding labels | Verified / Tool results / Map moved / Not verified / (none for chat) |
| Stack | React 19, TypeScript, Vite 8, Tailwind 4, Leaflet, Zod 4, Vitest, Playwright, Remotion |
| License | Apache-2.0 |
| Source | github.com/Nierowheezy/postcode-atlas |
| Live | nigerian-postalcode-atlas.vercel.app |
| Video | 45 s, two cuts — 16:9 (1920×1080) and 9:16 (1080×1920) — 30 fps, 6 scenes, built with Remotion; soundtrack "Inspired" by Kevin MacLeod (CC BY 4.0) |
| Share card | `og.jpg`, 1200×630, ~70 KB (under WhatsApp's limit), rendered by Remotion |
| Model | N-ATLAS by Awarri & NCAIR (Hugging Face `NCAIR1/N-ATLaS`, gated) |
| Model weights | full-precision `safetensors`, ~16 GB → community Q5_K_M GGUF (`QuantFactory/N-ATLaS-GGUF`), ~6 GB |
| Local engine | `llama.cpp` `llama-server`, OpenAI-compatible API on `127.0.0.1:8081`, 8k context |
| Hardware | Apple M1 Max, 32 GB (arm64) |
| Public path | free fixed-domain ngrok tunnel → Vercel `/api/ask` function |
| Uptime | 3 macOS `launchd` agents (`llama-server`, `ngrok`, `caffeinate -s`) |
| Data | NIPOST NDAPS |

### Before you post — checklist

- [x] Live URL is fixed and used everywhere: `nigerian-postalcode-atlas.vercel.app`.
- [ ] Replace `[@Awarri]`, `[@NCAIR]`, `[@NIPOST]` and `[the competition/hackathon]`.
- [x] Video narration now says **five levels** (was "six"), matching the app, the
      decode card and the five rendered chips. Both cuts were re-rendered.
- [ ] Attach `video/out/postcode-atlas-demo.mp4` (the 16:9 cut — LinkedIn native
      video beats a link). Keep the 9:16 cut for Reels / Shorts.
- [ ] **Refresh the link preview after deploying.** LinkedIn caches aggressively:
      paste the URL into the LinkedIn Post Inspector and re-scrape so the new
      `og.jpg` card shows. (Facebook's Sharing Debugger refreshes WhatsApp too.)
- [ ] **Credit the music** (the CC BY license requires it — it is also on screen in
      the outro): add this line to the post description —
      `Music: "Inspired" by Kevin MacLeod (incompetech.com), CC BY 4.0`.
- [ ] Rotate the ngrok authtoken and keep the Mac awake before the demo window.
- [x] Model facts confirmed: base weights from `NCAIR1/N-ATLaS` (gated), served from
      the community `QuantFactory/N-ATLaS-GGUF` **Q5_K_M** quantization.
