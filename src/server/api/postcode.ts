/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Postcode normalization and the public record shape for the developer API
 * (feature 21a).
 *
 * The browser client maps NDAPS lookup bodies in `src/lib/api/postcodeClient.ts`.
 * That module is browser-only, so the public API gets its own pure mapping here,
 * reusing the shared codec so the two never drift.
 */

import { POSTCODE_PATTERN, toDashedCode } from '../../lib/atlas/postcodeCode';

/** The five dashed segments of a well-formed postcode. */
export interface AtlasPostcodeSegments {
  state: string;
  lga: string;
  district: string;
  area: string;
  unit: string;
}

export interface AtlasCoordinate {
  lat: number;
  lng: number;
}

/**
 * The public postcode record. Load-bearing for features 21b, 21c, and 22 - keep
 * the field names and meanings stable.
 */
export interface AtlasPostcodeRecord {
  /** Canonical dashed code, for example `LA-11-A12-AK-08`. */
  code: string;
  /** Dashes replaced by spaces. */
  display: string;
  /** The 11-character compact form. */
  compact: string;
  segments: AtlasPostcodeSegments;
  coordinates?: AtlasCoordinate;
  address?: string;
  locality?: string;
  buildingUse?: string;
  status?: string;
  valid: boolean;
  verified: boolean;
  /** Provenance: this record came from the NIPOST NDAPS gateway. */
  source: 'nipost-ndaps';
}

/** Canonicalize a dashed, spaced, or compact code, or `null` when malformed. */
export function normalizePostcodeCode(input: string): string | null {
  const dashed = toDashedCode(input);
  return POSTCODE_PATTERN.test(dashed) ? dashed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Read `raw.outer.inner` when it is a non-empty string. */
function readNestedString(
  raw: Record<string, unknown>,
  outer: string,
  inner: string
): string | undefined {
  const container = raw[outer];
  if (!isRecord(container)) return undefined;
  const value = container[inner];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** NDAPS stores point geometry as GeoJSON `[lng, lat]`; expose it as `{ lat, lng }`. */
function readCoordinates(raw: Record<string, unknown>): AtlasCoordinate | undefined {
  const geometry = raw.point_geometry;
  if (!isRecord(geometry)) return undefined;
  const coordinates = geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return undefined;
  const [lng, lat] = coordinates;
  return isFiniteNumber(lat) && isFiniteNumber(lng) ? { lat, lng } : undefined;
}

/**
 * Map an NDAPS lookup body into the public record for a canonical `code`.
 *
 * `valid` defaults to `true` and `verified` to `false`, matching the browser
 * client, so a partially-populated upstream body still yields a usable record.
 */
export function toPostcodeRecord(code: string, raw: unknown): AtlasPostcodeRecord {
  const source = isRecord(raw) ? raw : {};
  const [state, lga, district, area, unit] = code.split('-');

  const record: AtlasPostcodeRecord = {
    code,
    display: code.replace(/-/g, ' '),
    compact: code.replace(/-/g, ''),
    segments: { state, lga, district, area, unit },
    valid: source.valid !== false,
    verified: source.verified === true,
    source: 'nipost-ndaps',
  };

  const coordinates = readCoordinates(source);
  if (coordinates) record.coordinates = coordinates;

  const address = readNestedString(source, 'recent_house_address', 'recent');
  if (address) record.address = address;

  const locality = readNestedString(source, 'administrative_address', 'locality_name');
  if (locality) record.locality = locality;

  if (typeof source.building_use_status === 'string') {
    record.buildingUse = source.building_use_status;
  }
  if (typeof source.status === 'string') {
    record.status = source.status;
  }

  return record;
}
