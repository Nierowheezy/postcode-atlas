# Fix: Map tiles and marker smoothness

**Type:** Fix
**Status:** verified
**Branch:** `fix/map-tiles-and-marker-smoothness`
**Completed:** 2026-10-12

## The problem

Five defects behind four reports from the same session: the map goes white at deep
zoom, some styles draw nothing, panning is not smooth on a phone, markers slide
while panning, and the state label stays pinned after a tap. All live in
`src/components/map/AtlasMap.tsx` and the map rules in `src/index.css`.

Measured against the running build:

1. **Two styles draw zero tiles past zoom 16.** The camera allows zoom 19, but
   Light Canvas (voyager) and Dark Canvas (dark theme) have real tiles only to
   16. That cap is passed as the tile layer's `maxZoom`, which Leaflet reads as
   "this layer is invalid at and above this zoom", so it draws nothing at all.
   Probe at zoom 19: light 24 tiles loaded, voyager 0 tiles. Esri also answers 200
   with a flat 2521-byte placeholder above its data (sampled mean 205,205,205,
   stddev 5), so the tile behind it is empty too, not merely hidden.
2. **A missing tile is a transparent hole, and nothing sits behind it.** The
   wrapper's `#f8f8f7` is the only thing under the tile pane, so any tile that
   fails to arrive or carries no data reads as a white page. OSM serves a flat
   `#f2efe9` tile (103 bytes, stddev 0) wherever it has no mapped detail, and it
   answers 200, so it is not even an error the app can see.
3. **Every pointer move rebuilds all 37 marker icons.** `mousemove` calls
   `setCursorCoords`, which is state inside `AtlasMap`, so `AtlasMap` re-renders
   and every `<Marker icon={createStateIcon(...)}>` receives a brand-new
   `L.divIcon`. react-leaflet then calls `setIcon()` and Leaflet tears the marker
   node down and builds a new one. Probe: 40 desktop pointer moves produced 8663
   DOM mutations (4329 node inserts, 7216 attribute writes); a 30-step touch drag
   produced 224 mutation records with 111 inserts and 111 removals. The icon is
   destroyed mid-gesture, which is the "markers slide while panning" and "not
   smooth on mobile" report.
4. **The state label pins on touch.** The markers carry Leaflet's default hover
   tooltip. Desktop hover closes on mouse-out (verified), but a touch tap opens
   the tooltip and nothing closes it until an unrelated tap, so labels stack up
   over the map. That is the "clustered on mobile" part of the report.
5. **The coarse-pointer marker rule misplaces every marker.** `@media (pointer:
   coarse)` forces `min-width/min-height: 44px` on elements Leaflet sizes at 40px
   and offsets by `-20px`. The element renders 44x44 around a 40x40 icon box, so
   each state marker sits 2px off its true position and its element covers 4px
   more map than it should. Measured element: 44x44.

Ruled out by measurement, so they are not touched: the container's `touch-action`
computes to `none` at runtime (Leaflet's two-class rule already outranks the app's
coarse-pointer override, making that rule dead), and the marker icons' `transition:
transform` sits on the inner div while Leaflet transforms the outer element, so
the two never fight. There is also no CSP anywhere in the project or in the live
response headers, so tile hosts are not being blocked by policy.

## In scope

- one tested module owning the provider table, so a provider's real depth can
  never again be handed to a layer as its `maxZoom`
- tiles that render at every zoom the camera can reach, on every style
- a map surface that stays legible when a tile is missing or empty
- a plain note when every drawn tile is empty, so a provider's data gap reads as
  a data gap instead of a broken map
- marker icons built once and reused across cursor-driven re-renders
- a cursor readout that does not re-render the map once per pointer event
- the state tooltip only where hovering actually exists
- a coarse-pointer marker hit box that does not shift or bloat the icon
- deleting the two dead map rules in `src/index.css`

## Out of scope

- **Clustering, or any change to how 37 state markers are laid out at country
  zoom.** After this fix the labels no longer stack, but 37 circles on a 390px
  screen still overlap. That is a layout decision (cluster, or show state markers
  only above a zoom threshold), so it is proposed as its own item instead.
- **The OSM data gap itself.** A rural area with no mapped detail cannot be
  invented by a client. This fix makes it legible (the grid surface plus a note
  saying nothing is mapped there) and stops the camera from walking into a void
  where a provider's data ends, which is what can actually be controlled.
- Any change to the Esri/OSM provider list, attribution, or default style.

## Data / contracts

`src/lib/map/tileProviders.ts` (new) is the single source of provider truth:

- `MIN_MAP_ZOOM = 5`, `MAX_MAP_ZOOM = 19` - the camera range the app allows.
- `TileStyle = 'light' | 'voyager' | 'satellite'`, re-exported from `AtlasMap`
  so `CustomZoomControl` keeps importing it from where it does today.
- `TileProvider` with `name`, `url`, `attribution`, `subdomains?`,
  **`nativeMax`**: the deepest zoom with real tiles for that provider, which is
  the opposite of a Leaflet layer's `maxZoom`, and **`cors`**: whether the host
  allows a cross-origin read of a tile, which decides whether the app is allowed
  to look at what was drawn. Values: light 19, voyager 16, satellite 19, dark
  canvas 16; all four hosts send `Access-Control-Allow-Origin: *` (checked).
- `resolveTileProvider(style, isDark)` returning the provider for a style and
  theme. Order matters and is preserved: satellite wins outright, a dark theme
  with the light style maps to Dark Canvas, and everything else is itself.
- `TRANSPARENT_TILE`, a 1x1 transparent PNG data URI, so a failed tile reveals
  the map surface rather than a browser's broken-image box.
- Every provider states `cors` explicitly rather than defaulting it, because the
  empty-tile readback depends on it and a silent default would hide the reason it
  stopped working.

`src/lib/map/tileProviders.test.ts` locks the invariants: every style resolves,
the dark-theme light style resolves to Dark Canvas, every `nativeMax` sits inside
`[MIN_MAP_ZOOM, MAX_MAP_ZOOM]`, every URL carries `{z}`, `{x}`, and `{y}`, every
provider declares `cors`, and the canvas providers stay pinned at 16 - the
regression that produced the white map.

`src/lib/map/tileContent.ts` (new) decides whether the basemap has drawn
anything, with no DOM in it:

- `TILE_SAMPLE_SIZE = 8`, `FEATURELESS_SPREAD = 4`, `MIN_SAMPLED_TILES = 6`,
  `FEATURELESS_SHARE = 0.9`, `SAMPLE_WINDOW = 30`.
- `spreadOf(pixels)` - the widest **per-channel** range across an RGBA sample.
  Per channel, not across channels: a flat tile of any colour, such as the pale
  ground an empty OSM tile is filled with (`242, 239, 233`), must score 0.
  Measuring across channels scored it 9 and hid every empty tile.
- `isFeatureless(spread)`, `nextTileSample(stats, level, featureless)` keeping a
  sliding window of the most recent samples at one tile level, and
  `viewportLooksEmpty(stats)` requiring at least 6 samples of which 90% are flat.
- Threshold 4 sits between measured empties (0) and the lowest real content seen
  on these providers (Esri canvas 8, rural OSM with a road 14, city OSM 47).

`src/lib/map/tileContent.test.ts` covers the flat-colour case that the first
implementation got wrong, the per-channel range, the sample window holding its
size and letting recent tiles win, the note clearing after mapped detail returns,
and the minimum-sample guard.

## Build steps

- [x] **Step 1 - Never fall through to a blank canvas** - move the provider table
  into `src/lib/map/tileProviders.ts` behind `resolveTileProvider`, then have
  `AtlasMap` give the tile layer `maxZoom={MAX_MAP_ZOOM}` with
  `maxNativeZoom={activeProvider.nativeMax}` instead of `maxZoom` set to the
  provider's depth. `maxNativeZoom` is the Leaflet option that means "request no
  deeper than this, and scale the last real level up", so a z16 tile fills a z19
  viewport instead of the layer switching itself off. Add `errorTileUrl`
  (the transparent tile) so a request that fails shows the surface underneath.
  Add `updateWhenIdle={false}` and `keepBuffer={4}`: Leaflet defaults
  `updateWhenIdle` to `Browser.mobile`, which on a phone means no new tiles are
  requested until the drag ends, so the screen fills with gaps mid-pan. Give
  `MapController` a `maxZoom` prop and an effect calling `map.setMaxZoom(maxZoom)`,
  which Leaflet uses to clamp the live zoom, so the camera cannot enter a band
  the active provider has no tiles for. Replace the container's flat
  `background-color: #f6f6f5 !important` in `src/index.css` with a faint survey
  grid on `.leaflet-container` (light `#f1f1ef`, and the darker half under
  `.dark`), so the area under the tile pane is a legible surface rather than
  white. *Done when:* at each style and each of zoom 16 to 19 the tile pane holds
  loaded tiles, switching to voyager keeps the camera at or below 16 while the map
  still shows tiles, a screenshot of the map region is never a flat near-white
  field (measured mean and standard deviation), and `tileProviders.test.ts` covers
  the provider table.

- [x] **Step 2 - Build each icon once and reuse it** - memoize the state icons
  keyed on selected state, theme, style, and pointer kind, and the four building
  icon variants, so a re-render reuses the same `L.divIcon` objects and
  react-leaflet stops calling `setIcon()`. Memoize the two marker element lists on
  the same inputs plus the select callbacks, so React bails out of re-rendering
  them entirely when only the cursor changed. Hoist `Object.values(NIGERIA_STATES)`
  to a module constant so the list stops being rebuilt per render. Coalesce
  `mousemove` to one update per animation frame before it reaches
  `setCursorCoords`. *Done when:* 40 desktop pointer moves and a 30-step touch
  drag produce no marker node insertions or removals (from 4329 and 111, measured
  the same way), the readout still tracks the pointer, and panning still works.

- [x] **Step 3 - Only hover where hovering exists** - add
  `src/hooks/useMediaQuery.ts` with `useMediaQuery`, `useCanHover`
  (`(hover: hover) and (pointer: fine)`), and `useIsCoarsePointer`
  (`(pointer: coarse)`). Render the state `<Tooltip>` only when `useCanHover()` is
  true, so a tap selects the state without pinning a label, while desktop hover
  keeps showing and hiding it. *Done when:* on touch emulation a tap on a state
  leaves no tooltip open (down from one that persists), the tap still selects the
  state, and at desktop a hover shows the label and moving away removes it.

- [x] **Step 4 - Give touch the bigger hit box without moving the icon** - pass
  the coarse-pointer flag into `createStateIcon` and wrap the 40px circle in a
  44x44 transparent flex box for coarse pointers only, with `iconSize` and
  `iconAnchor` derived from that box, so the touch target is a true 44px and the
  circle stays centred on its coordinate. Delete `min-width`/`min-height` from the
  coarse-pointer marker rule in `src/index.css`, which is what caused the 2px
  shift, and delete the coarse-pointer `.leaflet-container { touch-action: ... }`
  rule that measurement showed is dead because Leaflet's own rule wins. *Done
  when:* on a coarse pointer the marker element measures 44x44 with the circle
  centred to within a pixel and the element's centre matches the marker's
  latitude and longitude, on a fine pointer the element is still 40x40, and the
  light-theme map above zoom 16 is pixel-identical to before this fix.

- [x] **Step 5 - Say so when the basemap has drawn nothing** - add
  `src/lib/map/tileContent.ts` and its test (see Data / contracts), then have
  `AtlasMap` attach a `tileload` handler to the tile layer that draws each loaded
  tile into an 8x8 canvas and samples it. Add `crossOrigin` from the provider's
  `cors` flag so that read is allowed; if it ever is not, the `getImageData` call
  throws, the handler returns, and nothing changes - the note simply never
  appears. Hold the samples in a sliding window per tile level, and render a
  short note over the map when at least 6 samples are at least 90% flat. *Done
  when:* the note appears at maximum zoom over the default centre on the light
  style (the flat `#f2efe9` case), clears when mapped detail returns (satellite
  over the same point), clears on zooming out to the country view, and never
  appears at the country view or in a mapped city.

## Files / areas

- `src/lib/map/tileProviders.ts`, `src/lib/map/tileProviders.test.ts` (new)
- `src/lib/map/tileContent.ts`, `src/lib/map/tileContent.test.ts` (new)
- `src/hooks/useMediaQuery.ts` (new)
- `src/components/map/AtlasMap.tsx` - providers, tile layer, `MapController`,
  icon factories, marker lists, tooltip, empty-tile note
- `src/index.css` - map surface, coarse-pointer cleanup

## Testing

- `npm run test` - 22 new tests in `src/lib/map` (8 provider invariants, 14 tile
  sampling) with the existing 76, for 98 total.
- `npm run lint`, `npm run build`.
- Scratch browser probes outside the repo, the same ones used for the numbers in
  this spec: tile count and screenshot uniformity per style at zoom 16 to 19, the
  voyager camera ceiling per style, DOM mutation counts during pointer moves and a
  touch drag, tooltip behaviour on touch against desktop, marker hit-box geometry,
  and the empty-tile note appearing, clearing when detail returns, and staying
  quiet at the country view.

## Verification evidence

Measured against the preview build served from `dist` (`vite preview`, Chrome):

- **Tile caps.** Light reaches zoom 19 with 30 tiles loaded. Switching to voyager
  while at 19 clamps the camera to 16 with 24 tiles loaded at scale 1 (step 1);
  satellite still reaches 19 afterwards, so the ceiling follows the style rather
  than ratcheting down. Dark Canvas clamps to 16 with 24 loaded.
- **Blank surface:** the map region of the deep-zoom screenshots reads
  `mean [242, 239, 233] stddev 0.3` (light, the flat OSM ground), and
  `[66, 76, 43] stddev 34.5` (satellite). No style renders a flat near-white
  field; the surface under missing tiles is `rgb(241, 241, 239)` with the grid.
- **Marker churn:** 40 desktop pointer moves now produce 1 mutation record and 0
  node inserts (was 8663 records, 4329 inserts); a 30-step phone touch drag
  produces 2 records, 0 inserts, 0 removals (was 224 records, 111 inserts, 111
  removals). Six building markers at zoom 12: 0 inserts, 0 removals.
- **Tooltip:** after a tap on a state marker there are 0 open tooltips (was 1
  pinned), the tap still selects the state, and desktop hover still shows 1 and
  clears on mouse-out.
- **Touch target:** marker element 44x44 around a 40x40 circle, centre offset
  `[0, 0]`; on a fine pointer the element is 40x40.
- **Empty-tile note:** light at zoom 19 `notice true` with 30/30 tiles loaded;
  voyager at 16 (flat canvas) `notice true`; satellite at 16 (real imagery)
  `notice false`; country view at zoom 6 and back at zoom 5 `notice false`
  (30/30 and 24/24 tiles loaded). Dark Canvas at 16 `notice true`, which is
  accurate: it draws only roads and labels and there are none at that point.
- **Phone (390x844, touch):** loaded tiles rose from 12 to 15 during a 12-step
  touch drag, so tiles keep arriving mid-gesture rather than only after it (the
  `updateWhenIdle={false}` fix). At the ceiling 8/8 tiles were loaded and the note
  was visible at 226x52 centred, 96px above the bottom edge, clear of the
  attribution strip and the zoom controls.
- `npm run test` 98 passed, `npm run lint` clean, `npm run build` clean.

## Notes for the AI

- Keep zoom 16 and below looking exactly as it does today on the light theme.
- Do not add a dependency for clustering in this fix; note it instead.
- The `--` style guide applies: hyphens, never em dashes, en dashes, or ellipses.

## Follow-ups found

- **State-marker clustering at country zoom** - after this fix the hover labels no
  longer stack on touch, but 37 circles still overlap on a 390px screen. That is a
  layout decision (cluster, or show state markers only above a zoom threshold) and
  belongs in its own build-plan item, not this fix. No clustering dependency was
  added here, deliberately.
- **The OSM data gap itself** - a rural area with no mapped detail cannot be
  invented by a client. This fix makes it legible (a survey grid under missing
  tiles plus a note when every drawn tile is empty) and stops the camera entering a
  band a provider has no tiles for. Extending provider depth is out of scope.
- **Voyager and Dark Canvas stop at zoom 16** - correct by data, not a defect: the
  camera now clamps to their real depth instead of drawing nothing. If deeper
  canvas tiles are ever wanted, that is a provider swap.
