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
import { createAtlasAddressLookup } from '../address/lookup';
import { parseAddressText } from '../address/parse';
import { resolveAddress } from '../address/resolve';
import type { InterpretedAddress } from '../address/types';
import { postcodeApi } from '../api/postcodeClient';
import { atlasStore } from '../atlas/store';
import type { AtlasArea, AtlasDistrict, AtlasLga, AtlasState, LocationCandidate } from '../atlas/dataset';
import { matchLgaName, matchStateName } from '../atlas/names';
import { POSTCODE_PATTERN, toDashedCode } from '../atlas/postcodeCode';
import { NIGERIA_CENTER, NIGERIA_DEFAULT_ZOOM, NIGERIA_STATES } from '../geo/nigeriaData';
import { getExplanation } from '../explain/topics';
import type {
  DecodePostcodeArgs,
  ExplainAtlasArgs,
  GetAreasArgs,
  GetDistrictsArgs,
  GetLgasArgs,
  GetNearbyArgs,
  GetPostcodeArgs,
  GetStateArgs,
  InterpretAddressArgs,
  NavigateMapArgs,
  SearchLocationArgs,
} from './schemas';
import { ToolFault, type AtlasExplanation, type DecodedPostcode, type HierarchyPage, type MapAction, type NearbyUnit, type StateSummary } from './types';

const NEARBY_RADIUS_CAP = 300;

/**
 * Most hierarchy rows handed to the model at once (feature 9). Districts and
 * areas run into the hundreds per parent, so a bare array would hand the
 * model a dump and get cut mid-JSON by the request size guard.
 */
const MAX_HIERARCHY_ROWS = 50;

/** Zoom used when the map frames an LGA, matching the explorer's own view. */
const LGA_VIEW_ZOOM = 12;
const MAX_NEARBY_UNITS = 50;

export function searchLocation(args: SearchLocationArgs): Promise<LocationCandidate[]> {
  return atlasStore.searchLocations(args.query);
}

/**
 * Resolve a state name or 2-letter code to its canonical snapshot record.
 * Tolerates the "Lagos State" form and the common Abuja → FCT alias, so the
 * model's natural phrasing still lands on a real record. Reads the bundled
 * catalogue, so it works offline once the store hydrates.
 */
async function resolveState(wanted: string): Promise<AtlasState> {
  const match = matchStateName(await atlasStore.getStates(), wanted);
  if (!match) {
    throw new ToolFault('not_found', `No Nigerian state matches "${wanted}".`);
  }
  return match;
}

/** Resolve an LGA name or code within a resolved state to its canonical code. */
async function resolveLgaCode(stateCode: string, wanted: string): Promise<string> {
  const match = matchLgaName(await atlasStore.getLgas(stateCode), wanted);
  if (!match) {
    throw new ToolFault('not_found', `No LGA matches "${wanted}" in state ${stateCode}.`);
  }
  return match.code;
}

/**
 * Find an LGA by the name a user (or the model) gave, across all states. Used
 * when a request names an LGA but labels it a state ("show me Ikeja on the
 * map", "what districts are in Ikeja?") so the request still resolves.
 */
async function findLgaByName(
  wanted: string,
): Promise<{ stateCode: string; stateName: string; code: string; name: string } | null> {
  const candidates = await atlasStore.searchLocations(wanted.trim());
  const hit = candidates.find((candidate) => candidate.type === 'lga' && candidate.state);
  if (!hit || !hit.state) return null;
  const state = await resolveState(hit.state);
  return { stateCode: state.code, stateName: state.name, code: hit.code, name: hit.name ?? hit.code };
}

/**
 * Resolve a `(state, LGA)` pair for a hierarchy query. The model sometimes
 * treats the LGA as the state ("what districts are in Ikeja?"), so when the
 * state does not resolve, look the name up as a place and use its parent.
 */
async function resolveStateAndLga(
  stateArg: string,
  lgaArg: string,
): Promise<{ stateCode: string; lgaCode: string }> {
  try {
    const state = await resolveState(stateArg);
    return { stateCode: state.code, lgaCode: await resolveLgaCode(state.code, lgaArg) };
  } catch (error) {
    const hit = (await findLgaByName(stateArg)) ?? (await findLgaByName(lgaArg));
    if (hit) return { stateCode: hit.stateCode, lgaCode: hit.code };
    throw error;
  }
}

/** List every state in the catalogue. */
export function getStates(): Promise<AtlasState[]> {
  return atlasStore.getStates();
}

/** Cap one hierarchy list, keeping order and reporting the real total. */
function toHierarchyPage<T>(rows: T[]): HierarchyPage<T> {
  return {
    items: rows.slice(0, MAX_HIERARCHY_ROWS),
    total: rows.length,
    truncated: rows.length > MAX_HIERARCHY_ROWS,
  };
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

export async function getDistricts(args: GetDistrictsArgs): Promise<HierarchyPage<AtlasDistrict>> {
  const { stateCode, lgaCode } = await resolveStateAndLga(args.state, args.lga);
  return toHierarchyPage(await atlasStore.getDistricts(stateCode, lgaCode));
}

export async function getAreas(args: GetAreasArgs): Promise<HierarchyPage<AtlasArea>> {
  const { stateCode, lgaCode } = await resolveStateAndLga(args.state, args.lga);
  return toHierarchyPage(await atlasStore.getAreas(stateCode, lgaCode, args.district.trim()));
}

/**
 * Look up one exact postcode. The code must be well formed
 * (STATE-LGA-DISTRICT-AREA-UNIT, or the 11-character compact form) before we
 * reach the store: a model that misreads a place question for a code hands us a
 * made-up value, and letting it through answers it as if it were real. A
 * well-formed code with no record still resolves to null.
 */
export async function getPostcode(args: GetPostcodeArgs): Promise<PostcodeLocation | null> {
  const code = toDashedCode(args.code);
  if (!POSTCODE_PATTERN.test(code)) {
    throw new ToolFault(
      'invalid_args',
      `"${args.code}" is not a postcode. A postcode looks like FC-02-D43-LG-01, and a state, city, or LGA name has no single postcode of its own.`,
    );
  }
  return atlasStore.getPostcode(code);
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

/**
 * Return curated Atlas copy for a topic (feature 19). No I/O and no model: the
 * content is fixed, so the same topic always explains the same way. A topic the
 * schema allows but the content module lacks is a real fault, not a data gap.
 */
export function explainAtlas(args: ExplainAtlasArgs): Promise<AtlasExplanation> {
  const explanation = getExplanation(args.topic);
  if (!explanation) {
    throw new ToolFault('not_found', `No Atlas explanation is registered for "${args.topic}".`);
  }
  return Promise.resolve(explanation);
}

/**
 * Resolve a map request to a real target (feature 8). Read-only: it returns
 * the action the app should perform and never touches map state itself, so a
 * conversational request and a sidebar click run the same code path.
 */
export async function navigateMap(args: NavigateMapArgs): Promise<MapAction> {
  if (args.target === 'reset') {
    return { target: 'reset', center: NIGERIA_CENTER, zoom: NIGERIA_DEFAULT_ZOOM };
  }

  if (args.target === 'postcode') {
    const location = await atlasStore.getPostcode(args.code);
    if (!location) {
      throw new ToolFault('not_found', `No mapped postcode matches "${args.code}".`);
    }
    if (location.lat === undefined || location.lng === undefined) {
      throw new ToolFault('not_found', `"${location.postcode}" has no coordinates to show on the map.`);
    }
    return { target: 'postcode', postcode: location.postcode, location };
  }

  let state: AtlasState;
  try {
    state = await resolveState(args.state.trim());
  } catch (error) {
    // The named "state" may really be an LGA ("show me Ikeja on the map"): look
    // it up as a place and frame its LGA instead of failing.
    const hit = await findLgaByName(args.state);
    const lgaGeo = hit ? NIGERIA_STATES[hit.stateCode.toUpperCase()] : undefined;
    if (hit && lgaGeo) {
      return {
        target: 'lga',
        state: { code: hit.stateCode, name: hit.stateName },
        lga: { code: hit.code, name: hit.name },
        center: lgaGeo.center,
        zoom: LGA_VIEW_ZOOM,
      };
    }
    throw error;
  }
  const geo = NIGERIA_STATES[state.code.toUpperCase()];
  if (!geo) {
    throw new ToolFault('not_found', `No map view is available for "${state.name}".`);
  }
  const stateRef = { code: state.code, name: state.name };

  if (args.target === 'state') {
    return { target: 'state', state: stateRef, center: geo.center, zoom: geo.zoom };
  }

  const lgaCode = await resolveLgaCode(state.code, args.lga.trim());
  const lgas = await atlasStore.getLgas(state.code);
  const lgaName = lgas.find((lga) => lga.code === lgaCode)?.name ?? lgaCode;
  return {
    target: 'lga',
    state: stateRef,
    lga: { code: lgaCode, name: lgaName },
    center: geo.center,
    zoom: LGA_VIEW_ZOOM,
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

/**
 * Read a pasted address against the Atlas data (feature 17): the state, LGA,
 * and postcode it can place, and the parts it cannot. A code appears only when
 * the address carried one or a verified landmark matched, so a street never
 * comes back with an invented postcode.
 */
export async function interpretAddress(args: InterpretAddressArgs): Promise<InterpretedAddress> {
  return resolveAddress(parseAddressText(args.text), createAtlasAddressLookup());
}

