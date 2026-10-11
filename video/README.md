# Postcode Atlas — demo video (Remotion)

A ~45 second, 16:9 promo/demo video for **Nigerian Postcode Atlas** and its
Ask Atlas (N-ATLAS) feature, built with [Remotion](https://remotion.dev).

- Compositions: `PostcodeAtlasDemo` (16:9, 1920 x 1080) and
  `PostcodeAtlasDemoVertical` (9:16, 1080 x 1920)
- 30 fps, 1350 frames (45s) on both
- Soundtrack: "Inspired" by Kevin MacLeod (CC BY 4.0), with a fade in/out
- Uses **real screenshots of the deployed app** as its product shots

## Quick start

```bash
cd video
npm install

# Preview / tweak in the Remotion Studio
npm run dev

# Render the MP4 (16:9)
npm run render          # -> out/postcode-atlas-demo.mp4

# Render the vertical cut (9:16)
npm run render:vertical # -> out/postcode-atlas-demo-vertical.mp4

# Render a single poster frame
npm run poster          # -> out/poster.png (frame 430)
```

Rendering downloads a headless browser shell on first run, so the first
`npm run render` takes a little longer.

## The two cuts

| Composition | Size | For |
| --- | --- | --- |
| `PostcodeAtlasDemo` | 1920 x 1080 (16:9) | LinkedIn feed, YouTube, the website |
| `PostcodeAtlasDemoVertical` | 1080 x 1920 (9:16) | Reels, Shorts, TikTok, Stories |

Both are 45s at 30 fps and share the same six scenes, soundtrack and credits. The
vertical cut (`src/Vertical.tsx`) shows the whole 16:9 frame, scaled to the
canvas width and centred, over a blurred, dimmed fill of the same frames so the
extra height reads as an intentional backdrop rather than empty space. The
visuals live in `DemoVisual`; `Music` is composed once per cut so the 9:16
reframe does not double the soundtrack.

Rendering downloads a headless browser shell on first run, so the first
`npm run render` takes a little longer.

## Storyline (6 scenes)

| # | Frames | Scene | Message |
|---|--------|-------|---------|
| 1 | 0–195 | Hook | Every Nigerian address has a postcode — finding yours shouldn't need a manual. |
| 2 | 195–390 | Problem | One address, six levels, eleven characters. Structured data, hard to navigate. |
| 3 | 390–690 | Answer | Ask Atlas: ask in plain language, get grounded answers with a "Verified against NIPOST postcode data" footer. |
| 4 | 690–900 | Grounded | It never invents a postcode — facts come from NIPOST's NDAPS data, and unverifiable replies are labelled honestly. |
| 5 | 900–1140 | More than answers | It moves the map and decodes any code into its five NDAPS segments. |
| 6 | 1140–1350 | Outro | Powered end-to-end by N-ATLAS (EN/YO/HA/IG). Free & open source. postcode-atlas.vercel.app |

## Where the visuals come from

`src/scenes/*` animate around PNGs in `public/captures/`. Those are **not**
mockups — they are screenshots of the live app, captured deterministically by
`scripts/capture-stills.mjs`, which injects faithful Ask Atlas conversations
into `localStorage` so no model call (and no waiting) is needed.

Regenerate them against the deployed site:

```bash
# from the repo root (uses the root project's Playwright + system Chrome)
node video/scripts/capture-stills.mjs

# or point at a local dev server
ATLAS_URL=http://localhost:3001/ node video/scripts/capture-stills.mjs
```

`scripts/check-stills.mjs` re-verifies that map tiles and the injected panel
content actually rendered, so the video never ships blank frames.

## Music

The video ships with a soundtrack already wired in:

- **Track:** "Inspired" by **Kevin MacLeod** ([incompetech.com](https://incompetech.com))
- **License:** [Creative Commons Attribution 4.0 (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
- **File:** `public/music.mp3` — the full track trimmed to the 47-second composition length

Attribution appears on screen in the outro and must stay with the video wherever
it is published. Keep this credit in the post description too.

### Swapping the track

No code change is needed — just replace the file:

1. Drop any MP3 at `public/music.mp3`.
2. Optional: adjust `MUSIC_VOLUME` and the fade lengths at the top of
   `src/Demo.tsx`. The `<Audio>` element and fades are already there.
3. If the new track is not CC BY, update the outro credit in
   `src/scenes/Outro.tsx` and this section.

The bundled track is a lossless trim of the original, produced with the ffmpeg
that ships with Remotion:

```bash
npx remotion ffmpeg -i original.mp3 -t 47 -c copy public/music.mp3
```

## Structure

```
video/
  public/
    captures/        real app stills used as product shots
    app-icon.png     brand mark (from the app's PWA icon)
    logo*.svg        logo variants
  src/
    theme.ts         colors, fonts, scene timings
    fonts.ts         Geist / Geist Mono (Google Fonts)
    lib/anim.ts      spring/interpolate helpers
    components/ui.tsx  Stage, Brand, Kicker, Heading, Chip, Screen, Callout
    scenes/*.tsx     the six scenes
    Demo.tsx         assembles the scenes into one composition
    Root.tsx         registers the composition
  scripts/
    capture-stills.mjs  drive the live app, write captures/
    check-stills.mjs    sanity-check captures/
```

Tuning knobs: scene lengths and colors live in `src/theme.ts`; the story text
lives inside each scene component.
