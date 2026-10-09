/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Client-side executors for the Atlas tool layer. Every executor is read-only,
 * runs in the browser, and answers from the local dataset cache (feature 3a)
 * with the NIPOST gateway as read-through fallback. They never call an LLM
 * provider.
 */

import type { PostcodeLocation, PostcodeSegments } from '../../types/postcode';
import { postcodeApi } from '../api/postcodeClient';
import { atlasStore } from '../atlas/store';
import type { AtlasArea, AtlasDistrict, AtlasLga, AtlasState, LocationCandidate } from '../atlas/dataset';
import { NIGERIA_STATES } from '../geo/nigeriaData';
import type {
  DecodePostcodeArgs,
  GetAreasArgs,
  GetDistrictsArgs,
  GetLgasArgs,
  GetNearbyArgs,
  GetPostcodeArgs,
  GetStateArgs,
  SearchLocationArgs,
} from './schemas';
import { ToolFault, type DecodedPostcode, type NearbyUnit, type StateSummary } from './types';

const NEARBY_RADIUS_CAP = 300;
const MAX_NEARBY_UNITS = 50;
const POSTCODE_PATTERN = /^([A-Z]{2})-(\d{2})-([A-Z0-9]{3})-([A-Z]{2})-(\d{2})$/;
const COMPACT_POSTCODE_LENGTH = 11;

export function searchLocation(args: SearchLocationArgs): Promise<LocationCandidate[]> {
  return atlasStore.searchLocations(args.query);
}

/**
 * Resolve a state name or 2-letter code to its canonical snapshot record.
 * Reads the bundled catalogue, so it works offline once the store hydrates.
 */
async function resolveState(wanted: string): Promise<AtlasState> {
  const states = await atlasStore.getStates();
  const match = states.find(
    (state) =>
      state.code.toUpperCase() === wanted.toUpperCase() ||
      state.name.toLowerCase() === wanted.toLowerCase(),
  );
  if (!match) {
    throw new ToolFault('not_found', `No Nigerian state matches "${wanted}".`);
  }
  return match;
}

/** Resolve an LGA name or code within a resolved state to its canonical code. */
async function resolveLgaCode(stateCode: string, wanted: string): Promise<string> {
  const lgas = await atlasStore.getLgas(stateCode);
  const match = lgas.find(
    (lga) =>
      lga.code.toUpperCase() === wanted.toUpperCase() ||
      lga.name.toLowerCase() === wanted.toLowerCase(),
  );
  if (!match) {
    throw new ToolFault('not_found', `No LGA matches "${wanted}" in state ${stateCode}.`);
  }
  return match.code;
}

/** List every state in the catalogue. */
export function getStates(): Promise<AtlasState[]> {
  return atlasStore.getStates();
}

export async function getState(args: GetStateArgs): Promise<StateSummary> {
  const match = await resolveState(args.state.trim());

  const geo = NIGERIA_STATES[match.code.toUpperCase()];
  if (!geo) return { code: match.code, name: match.name };

  return {
    code: match.code,
    name: match.name,
    capital: geo.capital,
    zone: geo.zone,
    center: geo.center,
    zoom: geo.zoom,
    lgaCount: geo.lgaCount,
  };
}

export async function getLgas(args: GetLgasArgs): Promise<AtlasLga[]> {
  const state = await resolveState(args.state.trim());
  return atlasStore.getLgas(state.code);
}

export async function getDistricts(args: GetDistrictsArgs): Promise<AtlasDistrict[]> {
  const state = await resolveState(args.state.trim());
  const lga = await resolveLgaCode(state.code, args.lga.trim());
  return atlasStore.getDistricts(state.code, lga);
}

export async function getAreas(args: GetAreasArgs): Promise<AtlasArea[]> {
  const state = await resolveState(args.state.trim());
  const lga = await resolveLgaCode(state.code, args.lga.trim());
  return atlasStore.getAreas(state.code, lga, args.district.trim());
}

export function getPostcode(args: GetPostcodeArgs): Promise<PostcodeLocation | null> {
  return atlasStore.getPostcode(args.code);
}

export async function decodePostcode(args: DecodePostcodeArgs): Promise<DecodedPostcode> {
  const postcode = toDashedCode(args.code);
  const compact = postcode.replace(/-/g, '');
  const display = postcode.replace(/-/g, ' ');
  const match = POSTCODE_PATTERN.exec(postcode);

  if (!match) {
    return {
      postcode,
      compact,
      display,
      valid: false,
      reason: 'Expected STATE-LGA-DISTRICT-AREA-UNIT, for example FC-02-D43-LG-01.',
      segments: { state: '', lga: '', district: '', area: '', unit: '' },
    };
  }

  const segments: PostcodeSegments = {
    state: match[1],
    lga: match[2],
    district: match[3],
    area: match[4],
    unit: match[5],
  };

  // Structure is local; names resolve from the snapshot and the gateway only enriches.
  const [states, lgas, lookup] = await Promise.all([
    atlasStore.getStates(),
    atlasStore.getLgas(segments.state),
    atlasStore.getPostcode(postcode),
  ]);

  return {
    postcode,
    compact,
    display,
    valid: true,
    segments,
    stateName:
      states.find((state) => state.code.toUpperCase() === segments.state)?.name ?? lookup?.stateName,
    lgaName: lgas.find((lga) => lga.code === segments.lga)?.name ?? lookup?.lgaName,
    coordinates: toCoordinates(lookup?.lat, lookup?.lng),
    // A decode confirms a location only when the full postcode mapped to a
    // record. An explicit gateway `verified: false` is respected; a missing
    // flag (bundled landmarks) counts as confirmed, matching feature 4.
    verified: lookup ? lookup.verified !== false : false,
  };
}

export async function getNearby(args: GetNearbyArgs): Promise<NearbyUnit[]> {
  const radius = Math.min(args.radius ?? NEARBY_RADIUS_CAP, NEARBY_RADIUS_CAP);
  const raw = await postcodeApi.fetchNearby(args.lat, args.lng, radius);
  return raw
    .map(toNearbyUnit)
    .filter((unit): unit is NearbyUnit => unit !== null)
    .slice(0, MAX_NEARBY_UNITS);
}

/** Reinsert dashes so both `FC-02-D43-LG-01` and `FC02D43LG01` decode the same. */
function toDashedCode(input: string): string {
  const compact = input.trim().toUpperCase().replace(/[\s-]+/g, '');
  if (compact.length !== COMPACT_POSTCODE_LENGTH) return compact;

  return [
    compact.slice(0, 2),
    compact.slice(2, 4),
    compact.slice(4, 7),
    compact.slice(7, 9),
    compact.slice(9, 11),
  ].join('-');
}

function toCoordinates(lat?: number, lng?: number): [number, number] | undefined {
  return lat !== undefined && lng !== undefined ? [lat, lng] : undefined;
}

/**
 * Normalize one gateway nearby unit into `NearbyUnit`, dropping unknown fields.
 * The gateway mirrors its lookup geometry: `point_geometry.coordinates` is
 * `[lng, lat]`, so the result is flipped to `[lat, lng]`.
 */
function toNearbyUnit(value: unknown): NearbyUnit | null {
  if (typeof value !== 'object' || value === null) return null;
  const unit = value as Record<string, unknown>;

  const postcode = asString(unit.postcode) ?? asString(unit.code);
  if (!postcode) return null;

  const geometry =
    typeof unit.point_geometry === 'object' && unit.point_geometry !== null
      ? (unit.point_geometry as Record<string, unknown>)
      : undefined;

  return {
    postcode,
    compact: asString(unit.compact) ?? postcode.replace(/-/g, ''),
    display: asString(unit.display) ?? postcode.replace(/-/g, ' '),
    state: asString(unit.state),
    stateName: asString(unit.state_name) ?? asString(unit.stateName),
    lga: asString(unit.lga),
    lgaName: asString(unit.lga_name) ?? asString(unit.lgaName),
    district: asString(unit.district),
    area: asString(unit.area),
    unit: asString(unit.unit),
    coordinates: asCoordinates(geometry?.coordinates) ?? asCoordinates(unit.coordinates),
    distance_m: asNumber(unit.distance_m),
    address: asString(unit.address),
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asCoordinates(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const [lng, lat] = value;
  return typeof lat === 'number' && typeof lng === 'number' ? [lat, lng] : undefined;
}
