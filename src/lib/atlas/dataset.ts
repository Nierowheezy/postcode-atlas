/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Types and fetcher for the Atlas dataset snapshot (feature 3a).
 * The snapshot is a build-time copy of the NDAPS reference hierarchy, served
 * statically like version.json and hydrated into IndexedDB by the atlas store.
 */

/** NDAPS reference entities, flat with parent codes. Districts and areas are
 *  code-only in NDAPS, so `name` is optional. */
export interface AtlasState {
  code: string;
  name: string;
}

export interface AtlasLga {
  state: string;
  code: string;
  name: string;
}

export interface AtlasDistrict {
  state: string;
  lga: string;
  code: string;
  name?: string;
}

export interface AtlasArea {
  state: string;
  lga: string;
  district: string;
  code: string;
  name?: string;
}

export interface AtlasCounts {
  states: number;
  lgas: number;
  districts: number;
  areas: number;
}

export interface AtlasDatasetMeta {
  version: string;
  generatedAt: string;
  counts: AtlasCounts;
}

/** The full snapshot served from `/atlas-data.json`. */
export interface AtlasSnapshot extends AtlasDatasetMeta {
  states: AtlasState[];
  lgas: AtlasLga[];
  districts: AtlasDistrict[];
  areas: AtlasArea[];
}

/** A search result candidate from `atlasStore.searchLocations`. */
export interface LocationCandidate {
  type: 'state' | 'lga' | 'district' | 'area' | 'landmark';
  code: string;
  name?: string;
  state?: string;
  lga?: string;
  coordinates?: [number, number];
}

export const ATLAS_DATASET_URL = '/atlas-data.json';

/** A rough shape guard so a malformed deploy never gets written to the store. */
function isSnapshot(value: unknown): value is AtlasSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.version === 'string' &&
    Array.isArray(s.states) &&
    Array.isArray(s.lgas) &&
    Array.isArray(s.districts) &&
    Array.isArray(s.areas) &&
    typeof s.counts === 'object' &&
    s.counts !== null
  );
}

/**
 * Fetch the deployed snapshot once per release, bypassing any cache so a
 * stale edge copy never freezes the dataset. Returns null on any failure;
 * callers keep whatever data they already hold.
 */
export async function fetchAtlasSnapshot(): Promise<AtlasSnapshot | null> {
  try {
    const res = await fetch(`${ATLAS_DATASET_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    const snapshot: unknown = await res.json();
    return isSnapshot(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}