import { NamedCode, PostcodeLocation, PostcodeSegments } from '../../types/postcode';
import { NIGERIA_DISCOVERY_POINTS } from '../geo/discoveryPoints';

/**
 * Reads the publishable NIPOST key that Vite inlines at build time.
 *
 * This key uses the `nipost_pk_` (publishable) tier, which NIPOST issues for
 * exactly this purpose: calling the gateway directly from a browser. A secret
 * key (`sk_`) must never be placed here, because anything in a `VITE_` variable
 * is readable in the shipped JavaScript bundle.
 */
const API_BASE = (import.meta.env.VITE_NIPOST_API_BASE_URL as string) || 'https://api.postcode.gov.ng';
const API_KEY = (import.meta.env.VITE_NIPOST_PUBLISHABLE_KEY as string) || '';

export function isConfigured(): boolean {
  return Boolean(API_KEY);
}

interface GatewayOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
}

class PostcodeApiClient {
  private cache = new Map<string, { data: unknown; expires: number }>();

  private getCached<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (item && item.expires > Date.now()) {
      return item.data as T;
    }
    return null;
  }

  private setCached(key: string, data: unknown, ttl = 300000) {
    this.cache.set(key, { data, expires: Date.now() + ttl });
  }

  /**
   * Single entry point to the NIPOST NDAPS gateway.
   * Adds the X-API-Key header, unwraps the `data` envelope, and throws on
   * non-2xx responses so callers can handle failures in one place.
   */
  private async gateway<T>(path: string, options: GatewayOptions = {}): Promise<T> {
    const { method = 'GET', body, signal } = options;

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      headers: {
        'X-API-Key': API_KEY,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      throw new Error(`NIPOST gateway ${method} ${path} failed: HTTP ${res.status}`);
    }

    const json = await res.json();
    return (json?.data ?? json) as T;
  }

  /**
   * GET /v1/reference/states
   * All 37 states with their 2-letter SSLL code and full name.
   */
  async fetchStates(): Promise<NamedCode[]> {
    const cacheKey = 'ref:states';
    const hit = this.getCached<NamedCode[]>(cacheKey);
    if (hit) return hit;

    try {
      const data = await this.gateway<{ states?: NamedCode[] }>('/v1/reference/states');
      const states = data?.states || [];
      this.setCached(cacheKey, states, 3600000);
      return states;
    } catch (err) {
      console.error('Error fetching states:', err);
      return [];
    }
  }

  /**
   * GET /v1/reference/lgas?state={state}
   * The LGAs of a state (2-digit code + full name).
   */
  async fetchLGAs(stateCode: string): Promise<NamedCode[]> {
    const code = stateCode.toUpperCase();
    const cacheKey = `ref:lgas:${code}`;
    const hit = this.getCached<NamedCode[]>(cacheKey);
    if (hit) return hit;

    try {
      const data = await this.gateway<{ lgas?: NamedCode[] }>(
        `/v1/reference/lgas?state=${encodeURIComponent(code)}`
      );
      const lgas = data?.lgas || [];
      this.setCached(cacheKey, lgas, 3600000);
      return lgas;
    } catch (err) {
      console.error(`Error fetching LGAs for ${stateCode}:`, err);
      return [];
    }
  }

  /**
   * GET /v1/reference/districts?state={state}&lga={lga}
   * District (PD) codes under a state+LGA. Code-only.
   */
  async fetchDistricts(stateCode: string, lgaCode: string): Promise<NamedCode[]> {
    const sCode = stateCode.toUpperCase();
    const cacheKey = `ref:districts:${sCode}:${lgaCode}`;
    const hit = this.getCached<NamedCode[]>(cacheKey);
    if (hit) return hit;

    try {
      const data = await this.gateway<{ districts?: NamedCode[] }>(
        `/v1/reference/districts?state=${encodeURIComponent(sCode)}&lga=${encodeURIComponent(lgaCode)}`
      );
      const districts = data?.districts || [];
      this.setCached(cacheKey, districts, 3600000);
      return districts;
    } catch (err) {
      console.error(`Error fetching districts for ${lgaCode}:`, err);
      return [];
    }
  }

  /**
   * GET /v1/reference/areas?state={state}&lga={lga}&district={district}
   * Area (PCA) codes under a state+LGA+district. Code-only.
   */
  async fetchAreas(stateCode: string, lgaCode: string, districtCode: string): Promise<NamedCode[]> {
    const sCode = stateCode.toUpperCase();
    const cacheKey = `ref:areas:${sCode}:${lgaCode}:${districtCode}`;
    const hit = this.getCached<NamedCode[]>(cacheKey);
    if (hit) return hit;

    try {
      const data = await this.gateway<{ areas?: NamedCode[] }>(
        `/v1/reference/areas?state=${encodeURIComponent(sCode)}&lga=${encodeURIComponent(
          lgaCode
        )}&district=${encodeURIComponent(districtCode)}`
      );
      const areas = data?.areas || [];
      this.setCached(cacheKey, areas, 3600000);
      return areas;
    } catch (err) {
      console.error(`Error fetching areas for ${districtCode}:`, err);
      return [];
    }
  }

  /**
   * GET /v1/lookup?code={code}&level={level}
   * Graded postcode lookup.
   */
  async lookupPostcode(code: string, level = 1): Promise<PostcodeLocation | null> {
    const clean = code.trim().toUpperCase();
    const cacheKey = `lookup:${clean}:${level}`;
    const hit = this.getCached<PostcodeLocation>(cacheKey);
    if (hit) return hit;

    try {
      const data = await this.gateway<Record<string, any>>(
        `/v1/lookup?code=${encodeURIComponent(clean)}&level=${level}`
      );
      if (!data) return null;

      const parts = clean.split('-');
      const loc: PostcodeLocation = {
        postcode: data.postcode || clean,
        display: clean.replace(/-/g, ' '),
        compact: clean.replace(/-/g, ''),
        state: parts[0] || '',
        lga: parts[1] || '',
        district: parts[2] || '',
        area: parts[3] || '',
        unit: parts[4] || '',
        valid: data.valid ?? true,
        verified: data.verified ?? false,
        status: data.status,
        address: data.recent_house_address?.recent || '',
        buildingUse: data.building_use_status,
        locality: data.administrative_address?.locality_name,
        lat: data.point_geometry?.coordinates ? data.point_geometry.coordinates[1] : undefined,
        lng: data.point_geometry?.coordinates ? data.point_geometry.coordinates[0] : undefined,
      };

      this.setCached(cacheKey, loc, 600000);
      return loc;
    } catch (err) {
      console.warn('Lookup request error:', err);
      return null;
    }
  }

  /**
   * GET /v1/search/reverse?lat={lat}&lng={lng}
   * Reverse geocode a coordinate to the nearest active unit.
   */
  async reverseGeocode(lat: number, lng: number): Promise<Partial<PostcodeLocation> | null> {
    const cacheKey = `rev:${lat.toFixed(5)}:${lng.toFixed(5)}`;
    const hit = this.getCached<Partial<PostcodeLocation>>(cacheKey);
    if (hit) return hit;

    try {
      const data = await this.gateway<Record<string, any>>(
        `/v1/search/reverse?lat=${lat}&lng=${lng}&max_distance_m=250`
      );
      if (!data?.found) return null;

      const result: Partial<PostcodeLocation> = {
        postcode: data.unit?.postcode || data.area,
        display: data.unit?.display,
        state: data.state,
        stateName: data.state_name || data.unit?.state_name,
        lgaName: data.lga_name || data.unit?.lga_name,
        district: data.district,
        area: data.area,
        lat,
        lng,
        address: data.unit?.address,
        distance_m: data.unit?.distance_m,
      };
      this.setCached(cacheKey, result, 300000);
      return result;
    } catch (err) {
      console.warn('Reverse geocode error:', err);
      return null;
    }
  }

  /**
   * GET /v1/search/autocomplete?q={q}
   * Segment-aware autocomplete.
   */
  async autocomplete(q: string): Promise<{ segment: string; suggestions: { code: string; label?: string }[] }> {
    try {
      const data = await this.gateway<{ segment: string; suggestions: { code: string; label?: string }[] }>(
        `/v1/search/autocomplete?q=${encodeURIComponent(q)}`
      );
      return data || { segment: 'state', suggestions: [] };
    } catch {
      return { segment: 'state', suggestions: [] };
    }
  }

  /**
   * GET /v1/assembly/disassemble?code={code}
   * Disassembles an 11-character postcode into its 5 segments.
   */
  async disassemble(code: string): Promise<PostcodeSegments | null> {
    try {
      return await this.gateway<PostcodeSegments>(
        `/v1/assembly/disassemble?code=${encodeURIComponent(code)}`
      );
    } catch {
      return null;
    }
  }

  /**
   * POST /v1/assembly/assemble
   * Assembles segments into a canonical postcode.
   */
  async assemble(
    segments: PostcodeSegments
  ): Promise<{ postcode: string; display: string; compact: string } | null> {
    try {
      return await this.gateway<{ postcode: string; display: string; compact: string }>(
        '/v1/assembly/assemble',
        { method: 'POST', body: segments }
      );
    } catch {
      return null;
    }
  }

  /**
   * Nearby digital postcode units with point geometry.
   */
  async fetchNearby(lat: number, lng: number, radius = 300): Promise<unknown[]> {
    const cacheKey = `nearby:${lat.toFixed(4)}:${lng.toFixed(4)}:${radius}`;
    const hit = this.getCached<unknown[]>(cacheKey);
    if (hit) return hit;

    try {
      const data = await this.gateway<unknown[]>(
        `/v1/search/nearby?lat=${lat}&lng=${lng}&radius=${Math.min(radius, 300)}`
      );
      const results = Array.isArray(data) ? data : [];
      this.setCached(cacheKey, results, 180000);
      return results;
    } catch (err) {
      console.warn('Nearby search error:', err);
      return [];
    }
  }

  /**
   * Discovery landmarks verified against the official NDAPS system.
   * Served from the local bundle, so it works without any network call.
   */
  async getDiscoveryPoints(): Promise<PostcodeLocation[]> {
    return NIGERIA_DISCOVERY_POINTS;
  }

  /**
   * A random verified discovery landmark, for the "Surprise me" action.
   */
  async getRandomDiscoveryPoint(): Promise<PostcodeLocation | null> {
    if (NIGERIA_DISCOVERY_POINTS.length === 0) return null;
    const index = Math.floor(Math.random() * NIGERIA_DISCOVERY_POINTS.length);
    return NIGERIA_DISCOVERY_POINTS[index];
  }
}

export const postcodeApi = new PostcodeApiClient();