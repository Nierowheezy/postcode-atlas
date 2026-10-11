# Postcode Atlas — demo video (Remotion)

A ~45 second, 16:9 promo/demo video for **Nigerian Postcode Atlas** and its
Ask Atlas (N-ATLAS) feature, built with [Remotion](https://remotion.dev).

- Composition: `PostcodeAtlasDemo`
- 1920 x 1080, 30 fps, 1350 frames (45s)
- Silent by default, with a ready music slot (see below)
- Uses **real screenshots of the deployed app** as its product shots

## Quick start

```bash
cd video
npm install

# Preview / tweak in the Remotion Studio
npm run dev

# Render the MP4
npm run render          # -> out/postcode-atlas-demo.mp4

# Render a single poster frame
npm run poster          # -> out/poster.png (frame 430)
```

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

## Music slot

The video renders silent. To add a track:

1. Drop an MP3 at `public/music.mp3`.
2. In `src/Demo.tsx`, import `Audio`/`staticFile` from `remotion` and uncomment:

   ```tsx
   <Audio src={staticFile('music.mp3')} volume={0.6} />
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
