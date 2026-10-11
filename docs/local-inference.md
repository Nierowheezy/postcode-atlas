# Local inference — serving N-ATLAS on a Mac

Ask Atlas is required to answer **only** through **N-ATLAS** (NCAIR / Awarri's
Llama-3-8B multilingual tool-calling model). N-ATLAS has no managed public API, so
the reference deployment serves it from a Mac over an OpenAI-compatible endpoint,
exposes that endpoint through a fixed tunnel, and lets the deployed app's
`/api/ask` function reach it.

This document describes that setup as it actually runs. **None of it is required
to develop or run Postcode Atlas** — see [Deployment to
Vercel](../README.md#deployment-to-vercel) for the hosted-provider path. It is
included because "an 8B model on my laptop" is an ops story, and the ops is the
interesting part.

## Provenance and licence

| Piece | Where | Notes |
| --- | --- | --- |
| Base model | `https://huggingface.co/NCAIR1/N-ATLaS` | Awarri & NCAIR. **Gated** — you accept the licence before download. Full precision, `safetensors` in four shards, ~16 GB. Ships no GGUF. |
| Served artifact | `https://huggingface.co/QuantFactory/N-ATLaS-GGUF` | Community **Q5_K_M** quantization used here (`N-ATLaS.Q5_K_M.gguf`, ~5.7 GB). |

N-ATLAS is the work of **Awarri** and **NCAIR**; the NDAPS data belongs to
**NIPOST**. Check the model card and the quantizer's repository for their licence
terms before redistributing weights. The app itself is Apache-2.0.

Because the base repo is *gated*, you have to accept its conditions before any
download; the community GGUF is the practical way to run the model without
converting ~16 GB of safetensors yourself.

## Why run it locally

- The competition requires N-ATLAS to be the answer engine — not a substitute.
- **Cost:** zero paid inference.
- **Sovereignty:** the weights never leave the machine.
- **No third-party rate limits** on the demo path.

The trade-off is operational: the model is only as available as the laptop.

## Components

| Piece | What | Where (reference machine) |
| --- | --- | --- |
| Model | `N-ATLaS.Q5_K_M.gguf` (~5.7 GB) | `~/.ollama/natlas/N-ATLaS.Q5_K_M.gguf` |
| Server | `llama.cpp` build `b11541` `llama-server` | `~/.ollama/natlas/llama/llama-b11541/llama-server` |
| Tunnel | `ngrok`, fixed dev domain | `/opt/homebrew/bin/ngrok` |
| Keep-awake | `caffeinate -s` | `/usr/bin/caffeinate` |

`llama-server` listens on **`127.0.0.1:8081`**; the app never talks to the model
directly — it calls the Vercel function, which calls the tunnel.

## Serving the model

`llama-server` exposes an OpenAI-compatible API (`/v1/models`,
`/v1/chat/completions`), so the app posts to it exactly as it would to OpenAI:

```sh
~/.ollama/natlas/llama/llama-b11541/llama-server \
  -m ~/.ollama/natlas/N-ATLaS.Q5_K_M.gguf \
  -a natlas,NCAIR1/N-ATLaS \
  -c 8192 \
  --host 127.0.0.1 --port 8081
```

- `-a natlas,NCAIR1/N-ATLaS` sets the model alias the API reports.
- `-c 8192` is the context size; the chat template and tool-call support are
  embedded in the GGUF metadata.

## Exposing it to the deployed app

The Vercel function runs in a datacentre; the model is behind a router. A free
**ngrok** tunnel with a **fixed** domain bridges them, so the deployment never has
to re-point when the tunnel restarts:

```sh
ngrok http 8081 --url=https://<your-fixed-domain>.ngrok-free.dev
```

## Keeping it up

Three macOS `launchd` LaunchAgents start on login and restart on failure, so the
demo survives a reboot and does not need a terminal left open:

| Label | Job |
| --- | --- |
| `com.natlas.llama-server` | Serves the model on `127.0.0.1:8081` |
| `com.natlas.ngrok` | Maintains the fixed public tunnel |
| `com.natlas.caffeinate` | Runs `caffeinate -s` so the Mac never idle-sleeps |

```sh
launchctl list | grep com.natlas

launchctl kickstart -k gui/$(id -u)/com.natlas.llama-server
launchctl kickstart -k gui/$(id -u)/com.natlas.ngrok
launchctl kickstart -k gui/$(id -u)/com.natlas.caffeinate

# Reload one after editing its plist in ~/Library/LaunchAgents/
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.natlas.ngrok.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.natlas.ngrok.plist
```

## How the app reaches it

The deployed app talks to the tunnel through the same serverless function it uses
for every provider:

- **`NATLAS_BASE_URL`** — when set, N-ATLAS is prepended to the provider chain
  (`src/server/ask/chain.ts`, `providers.ts`). Point it at the tunnel root, e.g.
  `https://<domain>.ngrok-free.dev/v1`.
- **`ASK_AI_ORDER=natlas`** — makes N-ATLAS the *only* provider, so the assistant
  cannot silently fall back to another model. If the model is unreachable the API
  returns **`503`** rather than answering from elsewhere.
- **Resilience** — `llama.cpp` occasionally returns HTTP 500 on a malformed
  tool-call sample; the chain retries once and, on a second failure, puts the
  provider in a 30-second cooldown.
- **Tool loop** — the browser drives the read-only Atlas tools; the server only
  brokers model calls. See `src/lib/ask/` and `src/server/ask/`.

Because N-ATLAS is the only engine once `ASK_AI_ORDER=natlas` is set, a sleeping
Mac shows up as an honest outage, not a fabricated answer. That is deliberate.

## Production domains

Both of these are attached to the Vercel project and follow the latest deployment:

- `https://nigerian-postalcode-atlas.vercel.app`
- `https://postcode-atlas.vercel.app`

`postalcode-atlas.vercel.app` (extra "al") does **not** exist — it returns 404.

## Health checks

```sh
# local model
curl -s http://127.0.0.1:8081/v1/models

# tunnel (ngrok's local API lists the public URL)
curl -s http://127.0.0.1:4040/api/tunnels
curl -s https://<domain>.ngrok-free.dev/v1/models

# end to end through the deployed function
curl -s https://nigerian-postalcode-atlas.vercel.app/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"text":"Tell me about Ikeja"}'
```

The last call should come back with `"engine":{"provider":"natlas",...}` and, for
data questions, a `toolCalls` array (executed in the browser).

The local day-of-demo walkthrough lives in
[`buildflow/DEMO-DRY-RUN.md`](../buildflow/DEMO-DRY-RUN.md).

## Caveats

- **The Mac must be awake and online.** `caffeinate -s` stops idle sleep on AC
  power; a closed lid with no external display still sleeps — keep it open, or in
  clamshell with a display, on power.
- **`503` is expected when the Mac is offline.** With `ASK_AI_ORDER=natlas`
  there is no fallback, so an unreachable model is surfaced rather than masked.
- **Occasional `llama.cpp` 500s** on malformed tool calls are absorbed by the
  retry-once + cooldown path.
- **Off-topic prompts are refused by design.** Greetings and non-geography
  questions answer "I cannot help with that." — the system prompt hard-scopes Ask
  Atlas to Nigerian postcode and geography.

## Reproducing it elsewhere

1. Accept the licence on the gated
   [NCAIR1/N-ATLaS](https://huggingface.co/NCAIR1/N-ATLaS) model card (or use the
   community [QuantFactory/N-ATLaS-GGUF](https://huggingface.co/QuantFactory/N-ATLaS-GGUF)
   Q5_K_M quantization directly).
2. Build or install `llama.cpp` and run `llama-server` against the GGUF (above).
3. Expose `127.0.0.1:8081` with a tunnel — a static ngrok domain keeps the URL
   stable.
4. Set `NATLAS_BASE_URL` to the tunnel's `/v1` root on the deployment, and
   `ASK_AI_ORDER=natlas` to pin the engine.
5. Confirm with the health checks above.
