/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Local-first read API over the Atlas dataset cache (feature 3a).
 * Every deterministic lookup prefers the IndexedDB snapshot and falls back to
 * the NIPOST gateway through `postcodeApi` when the key is missing and the
 * network is up. This surface is the load-bearing contract for the structured
 * tools (3b) and the grounded lookups (features 4-9).
 */

import { postcodeApi } from '../api/postcodeClient';
import type { PostcodeLocation } from '../../types/postcode';
import { APP_VERSION } from '../version';
import {
  fetchAtlasSnapshot,
  type AtlasArea,
  type AtlasCounts,
  type AtlasDistrict,
  type AtlasLga,
  type AtlasState,
  type LocationCandidate,
} from './dataset';
import { readAll, readMeta, readRange, writeSnapshot } from './storage';

const UPPER_BOUND = '\uffff';
const MAX_SEARCH_RESULTS = 12;

/** Strip separators and case from a postcode so formats match. */
function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export interface AtlasDatasetStatus {
  /** True when the stored dataset matches the current release. */
  hydrated: boolean;
  version: string | null;
  counts: AtlasCounts | null;
}

export function getStatus(): Promise<AtlasDatasetStatus> {
  return readMeta().then((meta) => ({
    hydrated: meta !== null && meta.version === APP_VERSION,
    version: meta?.version ?? null,
    counts: meta?.counts ?? null,
  }));
}

let hydration: Promise<void> | null = null;

/**
 * Make sure the local dataset matches this release. Non-blocking, idempotent,
 * single-flight: concurrent callers share one hydration. A failed fetch keeps
 * whatever dataset is already stored.
 */
export function ensureHydrated(): Promise<void> {
  if (!hydration) {
    hydration = hydrateOnce().finally(() => {
      hydration = null;
    });
  }
  return hydration;
}

async function hydrateOnce(): Promise<void> {
  const meta = await readMeta();
  if (meta !== null && meta.version === APP_VERSION) return;
  const snapshot = await fetchAtlasSnapshot();
  if (!snapshot) return;
  try {
    await writeSnapshot(snapshot);
  } catch {
    // A failed write keeps the previous dataset; the stale version is retried
    // on the next load rather than leaving the app mid-hydration.
  }
}

export async function getStates(): Promise<AtlasState[]> {
  const local = await readAll<AtlasState>('states');
  if (local.length > 0) return local;
  const fallback = await postcodeApi.fetchStates();
  return fallback.map((s) => ({ code: s.code, name: s.name ?? '' }));
}

export async function getLgas(state: string): Promise<AtlasLga[]> {
  const code = state.toUpperCase();
  const local = await readRange<AtlasLga>('lgas', [code]);
  if (local.length > 0) return local;
  const fallback = await postcodeApi.fetchLGAs(code);
  return fallback.map((l) => ({ state: code, code: l.code, name: l.name ?? '' }));
}

export async function getDistricts(state: string, lga: string): Promise<AtlasDistrict[]> {
  const local = await readRange<AtlasDistrict>('districts', [state.toUpperCase(), lga]);
  if (local.length > 0) return local;
  const fallback = await postcodeApi.fetchDistricts(state.toUpperCase(), lga);
  return fallback.map((d) => ({ state: state.toUpperCase(), lga, code: d.code }));
}

export async function getAreas(state: string, lga: string, district: string): Promise<AtlasArea[]> {
  const local = await readRange<AtlasArea>('areas', [state.toUpperCase(), lga, district]);
  if (local.length > 0) return local;
  const fallback = await postcodeApi.fetchAreas(state.toUpperCase(), lga, district);
  return fallback.map((a) => ({ state: state.toUpperCase(), lga, district, code: a.code }));
}

/** Verified landmarks stay bundled with the app, so they work offline. */
export function getDiscoveryPoints(): Promise<PostcodeLocation[]> {
  return postcodeApi.getDiscoveryPoints();
}

/**
 * Find the stored postcode: discovery landmarks first, then the gateway.
 * Returns the richer `PostcodeLocation` so callers can render location data.
 */
export async function getPostcode(code: string): Promise<PostcodeLocation | null> {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const landmarks = await getDiscoveryPoints();
  const landmark = landmarks.find((p) => normalizeCode(p.postcode) === normalized);
  if (landmark) return landmark;
  return postcodeApi.lookupPostcode(normalized);
}

/**
 * Local name/code search over the snapshot: prefix matches first, then
 * contains matches when nothing prefix-matched, capped at MAX_SEARCH_RESULTS.
 * Before hydration the store is empty, so it falls back to the gateway's
 * segment-aware autocomplete.
 */
export async function searchLocations(query: string): Promise<LocationCandidate[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const [states, lgas, districts, areas, discovery] = await Promise.all([
    readAll<AtlasState>('states'),
    readAll<AtlasLga>('lgas'),
    readAll<AtlasDistrict>('districts'),
    readAll<AtlasArea>('areas'),
    getDiscoveryPoints(),
  ]);

  // Name-first ordering so a search box shows "Ikeja" before "Ikere" for
  // "ike" (the store returns (state, code) key order otherwise). The discovery
  // list is the shared bundled array, so copy before sorting it.
  const byName = (a: { name?: string }, b: { name?: string }) =>
    (a.name ?? '').localeCompare(b.name ?? '');
  states.sort(byName);
  lgas.sort(byName);
  const landmarks = [...discovery];
  landmarks.sort((a, b) => (a.name ?? a.postcode).localeCompare(b.name ?? b.postcode));

  const lists = { states, lgas, districts, areas, landmarks };

  let matches = collectMatches(q, lists);
  // A comma-joined name like "Ikeja, Lagos" still resolves on its leading
  // segment, which is the specific place the user actually named.
  if (matches.length === 0 && q.includes(',')) {
    const head = q.split(',')[0].trim();
    if (head && head !== q) matches = collectMatches(head, lists);
  }

  if (matches.length === 0) {
    const auto = await postcodeApi.autocomplete(q);
    return auto.suggestions.slice(0, MAX_SEARCH_RESULTS).map((s) => ({
      type: typeForSegment(auto.segment),
      code: s.code,
      name: s.label,
    }));
  }

  return matches;
}

/** Prefix matches first, then a contains pass; capped at MAX_SEARCH_RESULTS. */
function collectMatches(
  q: string,
  lists: {
    states: AtlasState[];
    lgas: AtlasLga[];
    districts: AtlasDistrict[];
    areas: AtlasArea[];
    landmarks: PostcodeLocation[];
  },
): LocationCandidate[] {
  const { states, lgas, districts, areas, landmarks } = lists;
  const matches: LocationCandidate[] = [];
  const push = (candidate: LocationCandidate) => {
    if (matches.length < MAX_SEARCH_RESULTS) matches.push(candidate);
  };
  const landmarkLabel = (p: PostcodeLocation) => (p.name ?? p.postcode).toLowerCase();

  for (const state of states) {
    if (state.code.toLowerCase().startsWith(q) || state.name.toLowerCase().startsWith(q)) {
      push({ type: 'state', code: state.code, name: state.name });
    }
  }
  for (const lga of lgas) {
    if (lga.name.toLowerCase().startsWith(q)) {
      push({ type: 'lga', code: lga.code, name: lga.name, state: lga.state });
    }
  }
  for (const landmark of landmarks) {
    if (landmarkLabel(landmark).startsWith(q) || normalizeCode(landmark.postcode).toLowerCase().startsWith(q)) {
      push(landmarkCandidate(landmark));
    }
  }
  for (const district of districts) {
    if (district.code.toLowerCase().startsWith(q)) {
      push({ type: 'district', code: district.code, state: district.state, lga: district.lga });
    }
  }
  for (const area of areas) {
    if (area.code.toLowerCase().startsWith(q)) {
      push({ type: 'area', code: area.code, state: area.state, lga: area.lga });
    }
  }

  if (matches.length === 0 && isHydrated(states, lgas)) {
    for (const state of states) {
      if (state.name.toLowerCase().includes(q)) push({ type: 'state', code: state.code, name: state.name });
    }
    for (const lga of lgas) {
      if (lga.name.toLowerCase().includes(q)) push({ type: 'lga', code: lga.code, name: lga.name, state: lga.state });
    }
    for (const district of districts) {
      if (district.code.toLowerCase().includes(q)) {
        push({ type: 'district', code: district.code, state: district.state, lga: district.lga });
      }
    }
    for (const area of areas) {
      if (area.code.toLowerCase().includes(q)) {
        push({ type: 'area', code: area.code, state: area.state, lga: area.lga });
      }
    }
  }

  return matches;
}

function landmarkCandidate(p: PostcodeLocation): LocationCandidate {
  return {
    type: 'landmark',
    code: p.postcode,
    name: p.name,
    coordinates: p.lat !== undefined && p.lng !== undefined ? [p.lat, p.lng] : undefined,
  };
}

/** Only search names/codes locally when the snapshot is actually present. */
function isHydrated(states: AtlasState[], lgas: AtlasLga[]): boolean {
  return states.length > 0 || lgas.length > 0;
}

function typeForSegment(segment: string): LocationCandidate['type'] {
  switch (segment) {
    case 'state':
      return 'state';
    case 'lga':
      return 'lga';
    case 'district':
      return 'district';
    default:
      return 'area';
  }
}

export const atlasStore = {
  ensureHydrated,
  getStatus,
  getStates,
  getLgas,
  getDistricts,
  getAreas,
  searchLocations,
  getPostcode,
  getDiscoveryPoints,
};