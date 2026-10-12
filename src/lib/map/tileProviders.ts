/**
 * Basemap providers, and how deep the real data behind each one goes.
 *
 * `nativeMax` is deliberately not a tile layer's `maxZoom`. Leaflet reads a
 * layer's `maxZoom` as "this layer is invalid at and above this zoom" and draws
 * nothing at all, while `maxNativeZoom` means "stop requesting tiles past this
 * and scale the last real level up". Handing a provider's real depth to a layer
 * as its `maxZoom` is what left the map blank past zoom 16 on the canvas styles.
 */
export type TileStyle = 'light' | 'voyager' | 'satellite';

export interface TileProvider {
  /** Label shown in the map HUD. */
  name: string;
  /** Leaflet tile URL template. */
  url: string;
  attribution: string;
  /** Deepest zoom with real tiles. Above it Leaflet scales the last level up. */
  nativeMax: number;
  subdomains?: string;
  /**
   * Whether the host sends `Access-Control-Allow-Origin`, which lets the map
   * measure a loaded tile to tell "no data mapped here" from "tiles failed".
   * Every host in this table was verified to send it. A provider without it
   * still renders, the measurement just stays off for that style.
   */
  cors: boolean;
}

/** Camera floor for the Atlas map. */
export const MIN_MAP_ZOOM = 5;

/** Camera ceiling. No provider is ever asked for tiles past this zoom. */
export const MAX_MAP_ZOOM = 19;

export const TILE_PROVIDERS: Record<TileStyle, TileProvider> = {
  light: {
    name: 'Cartographic Base',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    nativeMax: 19,
    subdomains: 'abc',
    cors: true,
  },
  voyager: {
    name: 'Light Canvas',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &copy; OpenStreetMap contributors',
    nativeMax: 16,
    cors: true,
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    nativeMax: 19,
    cors: true,
  },
};

/** The light-style basemap in dark mode. */
export const DARK_CANVAS_TILE: TileProvider = {
  name: 'Dark Canvas',
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  attribution: '&copy; Esri &copy; OpenStreetMap contributors',
  nativeMax: 16,
  cors: true,
};

/**
 * A 1x1 transparent PNG. Leaflet swaps it in for tiles that fail to load, which
 * lets the map surface below show through instead of a browser's broken-image
 * box or a blank hole.
 */
export const TRANSPARENT_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYGBgAAAABQABeqhXUAAAAABJRU5ErkJggg==';

/**
 * Pick the provider for a style and theme. Satellite is never recoloured, a dark
 * theme replaces the light basemap with the dark canvas, and every other style
 * is itself.
 */
export function resolveTileProvider(style: TileStyle, isDark: boolean): TileProvider {
  if (style === 'satellite') return TILE_PROVIDERS.satellite;
  if (isDark && style === 'light') return DARK_CANVAS_TILE;
  return TILE_PROVIDERS[style];
}
