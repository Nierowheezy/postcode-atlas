/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Search mapping for the developer API (feature 21c).
 *
 * NDAPS serves autocomplete, nearby, and reverse geocode on three query-string
 * paths. The public API validates and normalizes the query parameters, then
 * exposes those bodies with one stable shape. The browser client does the same
 * work in `src/lib/api/postcodeClient.ts`, which is browser-only, so the public
 * API gets its own pure mapping here. The structural decode lives next door in
 * `./postcode`, because it needs no upstream data.
 */

import { normalizePostcodeCode, type AtlasCoordinate } from './postcode.js';

/** Cap on an autocomplete query, so a runaway search cannot flood the gateway. */
const MAX_QUERY_LENGTH = 64;

/** Default and maximum nearby radius in metres, matching the browser client. */
export const NEARBY_DEFAULT_RADIUS_M = 300;
export const NEARBY_MAX_RADIUS_M = 300;

/**
 * One autocomplete suggestion. `label` is absent when NDAPS sends only a code.
 * Load-bearing for feature 22 - keep the field names and meanings stable.
 */
export interface AtlasSuggestion {
  code: string;
  label?: string;
}

/**
 * The segment-aware autocomplete answer. `segment` is NDAPS's own inference of
 * which level `q` names: `state`, `lga`, `district`, or `area`.
 */
export interface AtlasAutocomplete {
  segment: string;
  suggestions: AtlasSuggestion[];
}

/**
 * One nearby or reverse-geocoded unit: a stable subset of the postcode record
 * plus the distance from the queried point. Load-bearing for feature 22 - keep
 * the field names and meanings stable.
 */
export interface AtlasNearbyUnit {
  /** Canonical dashed postcode, for example `LA-11-A12-AK-08`. */
  code: string;
  display: string;
  compact: string;
  state?: string;
  stateName?: string;
  lga?: string;
  lgaName?: string;
  district?: string;
  area?: string;
  unit?: string;
  /** Geographic point, flipped from NDAPS `[lng, lat]` to `{ lat, lng }`. */
  coordinates?: AtlasCoordinate;
  distanceMetres?: number;
  address?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** A non-empty trimmed string, or `undefined`. */
function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** A finite number, or `undefined`. */
function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Read a GeoJSON `[lng, lat]` pair as `{ lat, lng }`, or `undefined`. */
function toCoordinate(value: unknown): AtlasCoordinate | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const [lng, lat] = value;
  return typeof lat === 'number' &&
    Number.isFinite(lat) &&
    typeof lng === 'number' &&
    Number.isFinite(lng)
    ? { lat, lng }
    : undefined;
}

/**
 * Read a unit's point from `point_geometry.coordinates` (`[lng, lat]`), falling
 * back to a plain `coordinates` field. Returns `undefined` when neither parses.
 */
function readUnitCoordinates(unit: Record<string, unknown>): AtlasCoordinate | undefined {
  const geometry = unit.point_geometry;
  if (isRecord(geometry)) {
    const fromGeometry = toCoordinate(geometry.coordinates);
    if (fromGeometry) return fromGeometry;
  }
  return toCoordinate(unit.coordinates);
}

/**
 * Canonicalize an autocomplete query: trim and reject empty or over-long input.
 * Returns the trimmed query, or `null` when malformed.
 */
export function normalizeSearchQuery(raw: string | null): string | null {
  if (raw === null) return null;
  const query = raw.trim();
  if (query === '' || query.length > MAX_QUERY_LENGTH) return null;
  return query;
}

/** Parse one coordinate query parameter as a finite number, or `null`. */
function parseCoordinate(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Validate a `lat`/`lng` pair as a real geographic point. `lat` must be in
 * `[-90, 90]` and `lng` in `[-180, 180]`; anything else, including a missing or
 * empty value, is `null`.
 */
export function normalizeCoordinate(
  rawLat: string | null,
  rawLng: string | null
): AtlasCoordinate | null {
  const lat = parseCoordinate(rawLat);
  const lng = parseCoordinate(rawLng);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Validate the optional nearby `radius`: absent or empty means
 * `NEARBY_DEFAULT_RADIUS_M`, and a present value must be an integer in
 * `[1, NEARBY_MAX_RADIUS_M]`. Anything else is `null`.
 */
export function normalizeRadius(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return NEARBY_DEFAULT_RADIUS_M;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > NEARBY_MAX_RADIUS_M) return null;
  return value;
}

/** Map one NDAPS suggestion into the public shape, or `null` without a code. */
function toSuggestion(value: unknown): AtlasSuggestion | null {
  if (!isRecord(value)) return null;
  const code = asString(value.code);
  if (!code) return null;
  const label = asString(value.label);
  return label ? { code, label } : { code };
}

/**
 * Map an NDAPS autocomplete body into the public answer. A missing segment
 * defaults to `state` and a missing or non-array suggestion list to `[]`, so a
 * malformed upstream body degrades to an empty answer rather than throwing.
 */
export function toAutocomplete(raw: unknown): AtlasAutocomplete {
  const source = isRecord(raw) ? raw : {};
  const segment = asString(source.segment) ?? 'state';
  const list = Array.isArray(source.suggestions) ? source.suggestions : [];

  const suggestions: AtlasSuggestion[] = [];
  for (const entry of list) {
    const suggestion = toSuggestion(entry);
    if (suggestion) suggestions.push(suggestion);
  }
  return { segment, suggestions };
}

/**
 * Map one NDAPS nearby unit into the public shape, or `null` when it carries no
 * postcode. `code` is canonicalized when possible and otherwise kept as sent.
 */
export function toNearbyUnit(value: unknown): AtlasNearbyUnit | null {
  if (!isRecord(value)) return null;
  const rawCode = asString(value.postcode) ?? asString(value.code);
  if (!rawCode) return null;
  const code = normalizePostcodeCode(rawCode) ?? rawCode;

  const unit: AtlasNearbyUnit = {
    code,
    display: asString(value.display) ?? code.replace(/-/g, ' '),
    compact: asString(value.compact) ?? code.replace(/-/g, ''),
  };

  const state = asString(value.state);
  if (state) unit.state = state;
  const stateName = asString(value.state_name) ?? asString(value.stateName);
  if (stateName) unit.stateName = stateName;
  const lga = asString(value.lga);
  if (lga) unit.lga = lga;
  const lgaName = asString(value.lga_name) ?? asString(value.lgaName);
  if (lgaName) unit.lgaName = lgaName;
  const district = asString(value.district);
  if (district) unit.district = district;
  const area = asString(value.area);
  if (area) unit.area = area;
  const unitCode = asString(value.unit);
  if (unitCode) unit.unit = unitCode;
  const address = asString(value.address);
  if (address) unit.address = address;

  const coordinates = readUnitCoordinates(value);
  if (coordinates) unit.coordinates = coordinates;

  const distance = asNumber(value.distance_m);
  if (distance !== undefined) unit.distanceMetres = distance;

  return unit;
}

/** Map an NDAPS nearby body (an array) into the public list, dropping junk. */
export function toNearbyUnits(raw: unknown): AtlasNearbyUnit[] {
  if (!Array.isArray(raw)) return [];
  const units: AtlasNearbyUnit[] = [];
  for (const entry of raw) {
    const unit = toNearbyUnit(entry);
    if (unit) units.push(unit);
  }
  return units;
}

/**
 * Map an NDAPS reverse-geocode body into one public unit, or `null` when the
 * upstream found nothing (`found` is not `true`) or sent no usable postcode.
 *
 * The returned unit's `coordinates` echo the requested `point`, matching the
 * browser client, rather than the unit's own geometry.
 */
export function toReverseUnit(value: unknown, point: AtlasCoordinate): AtlasNearbyUnit | null {
  if (!isRecord(value) || value.found !== true) return null;
  const unit = isRecord(value.unit) ? value.unit : {};

  const rawCode = asString(unit.postcode) ?? asString(unit.code) ?? asString(value.area);
  if (!rawCode) return null;
  const code = normalizePostcodeCode(rawCode) ?? rawCode;

  const result: AtlasNearbyUnit = {
    code,
    display: asString(unit.display) ?? code.replace(/-/g, ' '),
    compact: asString(unit.compact) ?? code.replace(/-/g, ''),
    coordinates: point,
  };

  const state = asString(value.state) ?? asString(unit.state);
  if (state) result.state = state;
  const stateName = asString(value.state_name) ?? asString(unit.state_name) ?? asString(unit.stateName);
  if (stateName) result.stateName = stateName;
  const lga = asString(value.lga) ?? asString(unit.lga);
  if (lga) result.lga = lga;
  const lgaName = asString(value.lga_name) ?? asString(unit.lga_name) ?? asString(unit.lgaName);
  if (lgaName) result.lgaName = lgaName;
  const district = asString(value.district) ?? asString(unit.district);
  if (district) result.district = district;
  const area = asString(value.area) ?? asString(unit.area);
  if (area) result.area = area;
  const unitCode = asString(unit.unit);
  if (unitCode) result.unit = unitCode;
  const address = asString(unit.address);
  if (address) result.address = address;

  const distance = asNumber(unit.distance_m);
  if (distance !== undefined) result.distanceMetres = distance;

  return result;
}
