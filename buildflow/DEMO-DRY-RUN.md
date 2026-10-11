# Ask Atlas - Demo Dry Run

A read-only, judge-day walkthrough for Ask Atlas. Run it once end to end before
submitting, then keep it open during the demo. Nothing here changes the app.

- Live: https://nigerian-postalcode-atlas.vercel.app
- Local (optional): http://localhost:3001

Everything the demo shows runs on this Mac: `llama-server` (port 8081) ->
`ngrok` fixed tunnel -> Vercel function -> browser. If the Mac sleeps, the site
answers 503.

## 1. Start (once, before the demo)

In a terminal:

```sh
# the three background services should be listed (llama-server, ngrok, caffeinate)
launchctl list | grep com.natlas

# the model and the public tunnel should both answer 200
curl -s http://127.0.0.1:8081/v1/models -o /dev/null -w "llama: %{http_code}\n"
curl -s https://undancing-sena-unautomatic.ngrok-free.dev/v1/models -o /dev/null -w "ngrok: %{http_code}\n"

# the deployed app should answer 200
curl -s https://nigerian-postalcode-atlas.vercel.app/ -o /dev/null -w "prod: %{http_code}\n"
```

You do **not** need the dev server for the deployed demo. Only for a local run:

```sh
npm run dev   # http://localhost:3001
```

If any check is not 200, see Recovery at the end.

## 2. Open

1. Open https://nigerian-postalcode-atlas.vercel.app in Chrome.
2. Click **Open Ask Atlas** (bottom-right button).
3. Confirm the panel header shows the reply-language chip and the map is visible.

## 3. Do (the judge flow)

Ask these one at a time. Wait for the answer to settle before the next.

1. `What is the postcode for Ikeja, Lagos?`
2. `List the LGAs in Kano`
3. `Show me Kano state on the map`
4. `Decode FC-02-D43-LG-01`
5. `What is the postcode of The Infrastructure Bank PLC?`
6. `hello`
7. `What's the weather in Lagos today?`
8. `List the LGAs in Kano`  then  `what are its districts?`
9. `What is the postcode for Lagos state?`
10. Try each bare name: `Lagos`, `Delta`, `Wuse`, `Ikeja`

Also exercise the UI:

- Change the **Reply language** chip (English / Yoruba / Hausa / Igbo) and ask #1 again.
- Drag the **resize handle** at the top of the panel to enlarge and shrink it.
- Click **Clear conversation**, confirm the dialog requires typing `delete`.

## 4. Expect

| # | Ask | Expect |
| --- | --- | --- |
| 1 | postcode for Ikeja | An honest LGA answer ("Ikeja is an LGA, so it has no single postcode..."). **No dashed code appears.** |
| 2 | LGAs in Kano | A list headed like "44 LGAs in Kano", plus a "Known verified postcode units" section. |
| 3 | Show Kano on the map | The top-bar breadcrumb becomes **Nigeria > Kano**, the map zoom changes, footer reads "Map moved using NIPOST location data". |
| 4 | Decode FC-02-D43-LG-01 | A five-part breakdown: state, LGA, district (`D43`), area (`LG`), unit. |
| 5 | Landmark | The real landmark postcode, footer "Verified against NIPOST postcode data". |
| 6 | hello | A short friendly reply. **No data-grounding footer at all** (chat turns never claim NIPOST data), just the `natlas · try 1` meter and the N-ATLAS attribution line. The map does **not** reset. |
| 7 | weather | A graceful "I can only help with Nigerian postcodes" style refusal. No invented data. |
| 8 | follow-up | The second answer stays on Kano and mentions districts. |
| 9 | postcode for Lagos state | States plainly that a state has no single postcode. No code. |
| 10 | bare names | Each resolves to a state/LGA or asks you to narrow down. **Never a fabricated code.** |

Every reply ends with a footer: "Served by N-ATLAS, Nigeria's open multilingual
model by Awarri & NCAIR." and a meter like `natlas / try 1`.

## Judge cheat sheet (the 16 tested questions)

These are the exact cases in `scripts/eval-atlas.mjs`; the committed report at
`scripts/eval-report.md` scores **16/16**. Ask them one at a time and match the
grounding footer, which is the real proof the answer came from NIPOST data and
not from the model's memory.

| # | Ask | Expected result | Grounding footer |
| --- | --- | --- | --- |
| 1 | `What is the postcode for Ikeja, Lagos?` | Says Ikeja is an LGA, so it has no single postcode; asks for a specific area | Verified against NIPOST |
| 2 | `List the LGAs in Kano` | Grounded list of the 44 Kano LGAs | Verified against NIPOST |
| 3 | `Show me Kano state on the map` | Map frames Kano (breadcrumb + zoom change) | Map moved (NIPOST location data) |
| 4 | `Decode FC-02-D43-LG-01` | Five-part breakdown (state, LGA, district, area, unit) | Verified against NIPOST |
| 5 | `Where is Wuse 2?` | Locates Wuse 2 in Abuja/FCT | Answered from NIPOST tool results |
| 6 | `What is the postcode of The Infrastructure Bank PLC?` | Honest: no single postcode; asks for a street | Answered from NIPOST tool results |
| 7 | `Show me Lagos on the map` | Map frames Lagos | Map moved (NIPOST location data) |
| 8 | `hello` | Friendly chat, **no data footer at all** | No data footer |
| 9 | `What's the weather in Lagos today?` | Graceful refusal; no invented data | Not verified |
| 9b | `Lagos` (bare) | Explains a state has no single postcode; asks to narrow | Verified against NIPOST |
| 11 | `Port Harcourt` | Honest city answer (not in the LGA snapshot) | Answered from NIPOST tool results |
| 12 | `Wuse` | Says Wuse is an area in Abuja with no single postcode | Answered from NIPOST tool results |
| 13 | `Ikeja` | Places Ikeja in Lagos State; no invented code | Verified against NIPOST |
| 14 | `Delta` | Treats it as a state and resets the national view | Map moved (NIPOST location data) |
| 15 | `What is the postcode for Lagos state?` | States plainly that a state has no single postcode | Answered from NIPOST tool results |
| 16 | `List the LGAs in Kano` then `what are its districts?` | Follow-up stays on Kano and answers honestly | Answered from NIPOST tool results |

### Footer legend (what each label claims)

| Footer | Means |
| --- | --- |
| `Verified against NIPOST postcode data` | The app holds a payload it derived from an executed tool result |
| `Answered from NIPOST tool results` | A tool ran, but no postcode payload is shown (e.g. an empty nearby search) |
| `Map moved using NIPOST location data` | A map move - no postcode data was shown |
| `Not verified against NIPOST data` | No tool result backs this reply |
| *(no data footer)* | Pure chat, e.g. `hello` - the reply never claimed to be data |

### Reply-language chips

Switch the panel's reply-language chip to **English / Yorùbá / Hausa / Igbo** and
ask #1 again: the answer changes language, the grounding and the tool call do not.

## 5. Watch For

- **503 or "all providers unavailable"** - the Mac is asleep, or the tunnel or
  model is down. Recovery below.
- **A dashed postcode with no "Verified against NIPOST" footer** - this would be
  the one thing that must never happen. Stop and report it.
- **A listed question refuses or picks the wrong tool** - rare stochastic 8B
  behavior. Ask it once more; the eval retries once on a blank reply.
- **Districts / areas** - asking for them now returns the honest line "I can't
  list districts or areas: the offline dataset carries states and LGAs, and
  NIPOST's district and area records are codes without names." That is correct
  behavior, not a failure. NDAPS stores districts and areas code-only and the
  publishable key is refused from browser origins; they cannot be bundled (about
  290 MB, no names). See `buildflow/WORK-SUMMARY.md`.
- **"Near me"** - returns no units (upstream gateway is empty) and the reply
  shows "Answered from NIPOST tool results" - the tool ran and found nothing,
  so it does not claim a verified payload. Known limitation.
- **Local dev only** - after any server-side change, restart `npm run dev`; Vite
  HMR does not reload the `/api/ask` middleware.

## 6. Recovery

Wake / restart the services:

```sh
launchctl kickstart -k gui/$(id -u)/com.natlas.llama-server
launchctl kickstart -k gui/$(id -u)/com.natlas.ngrok
launchctl kickstart -k gui/$(id -u)/com.natlas.caffeinate
```

If the model server is up but the tunnel failed, recreate it:

```sh
ngrok config add-authtoken <token>
launchctl kickstart -k gui/$(id -u)/com.natlas.ngrok
```

If the demo must continue while the Mac is unreachable, say plainly: "The
N-ATLAS model is laptop-hosted for this challenge; it is briefly offline." Do not
switch to another model.

## Best signal

Open the production URL, ask #1 and #2, and confirm the honest LGA answer and the
grounded list with a "Verified against NIPOST" / "Answered from NIPOST tool
results" footer.

## Optional deeper checks

- `npm run eval` (local) or
  `ATLAS_URL=https://nigerian-postalcode-atlas.vercel.app/ npm run eval` (prod)
  -> expect **16/16**, report at `scripts/eval-report.md`.
- `npm run test` (38 unit tests), `npm run lint`, `npm run build`.
- Chrome DevTools > Network: `POST /api/ask` returns 200 with
  `engine.provider: "natlas"`, `attempt: 1`.

## Gaps

- Requires this Mac awake with the three `com.natlas.*` launchd jobs loaded.
- The guide cannot detect NIPOST gateway-side changes.
- The ngrok authtoken should be rotated before public judging.
