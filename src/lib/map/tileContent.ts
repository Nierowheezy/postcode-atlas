/**
 * Deciding whether the basemap has drawn anything at all.
 *
 * Some providers answer 200 with a completely flat tile where they hold no
 * data, so a blank viewport is not an error the app can see in a status code.
 * Sampling the drawn pixels is the only way to tell "nothing mapped here" from
 * "the map failed", and only when the tiles allowed a cross-origin read.
 */

/** Side of the sample grid a tile is reduced to. */
export const TILE_SAMPLE_SIZE = 8;

/**
 * Widest channel range, in 0-255 levels, that still counts as featureless.
 * Measured: an empty OpenStreetMap tile scores 0, a rural tile with a drawn
 * road scores 14, a city tile 47, and the lowest Esri canvas tile with real
 * content scores 8. Four keeps clear of both sides.
 */
export const FEATURELESS_SPREAD = 4;

/** Tiles measured before an empty viewport can be claimed. */
export const MIN_SAMPLED_TILES = 6;

/** Share of measured tiles that must be featureless. */
export const FEATURELESS_SHARE = 0.9;

/**
 * Samples kept. A true sliding window, so once it is full each new tile pushes
 * the oldest out and the verdict follows what is currently on screen rather than
 * everything ever seen.
 */
export const SAMPLE_WINDOW = 30;

export interface TileSampleStats {
  /** Tile zoom the samples belong to, or null before anything has loaded. */
  level: number | null;
  /** Most recent measurements, oldest first, at most SAMPLE_WINDOW long. */
  recent: boolean[];
}

export const EMPTY_TILE_STATS: TileSampleStats = { level: null, recent: [] };

/**
 * Widest per-channel range across the sampled RGBA pixels.
 *
 * Per channel, not across channels: a flat tile of any colour, such as the
 * pale ground an empty OpenStreetMap tile is filled with, must score zero.
 */
export function spreadOf(pixels: Uint8ClampedArray): number {
  const min = [255, 255, 255];
  const max = [0, 0, 0];
  let seen = false;

  for (let i = 0; i + 2 < pixels.length; i += 4) {
    seen = true;
    for (let channel = 0; channel < 3; channel += 1) {
      const value = pixels[i + channel];
      if (value < min[channel]) min[channel] = value;
      if (value > max[channel]) max[channel] = value;
    }
  }

  if (!seen) return 0;
  return Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
}

export function isFeatureless(spread: number): boolean {
  return spread <= FEATURELESS_SPREAD;
}

/**
 * Fold one measured tile into the window. The window restarts when the zoom
 * level changes, since tiles from a different level say nothing about this one.
 */
export function nextTileSample(
  stats: TileSampleStats,
  level: number | null,
  featureless: boolean
): TileSampleStats {
  const recent = stats.level === level ? [...stats.recent, featureless] : [featureless];
  if (recent.length > SAMPLE_WINDOW) recent.splice(0, recent.length - SAMPLE_WINDOW);
  return { level, recent };
}

/** True when enough tiles agree that the basemap drew nothing here. */
export function viewportLooksEmpty(stats: TileSampleStats): boolean {
  if (stats.recent.length < MIN_SAMPLED_TILES) return false;
  const featureless = stats.recent.filter(Boolean).length;
  return featureless / stats.recent.length >= FEATURELESS_SHARE;
}
