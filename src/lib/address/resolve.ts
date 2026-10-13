/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Placing a parsed address in the Atlas hierarchy (feature 17).
 *
 * The grounded sources are the verified landmark set, the NDAPS catalogue
 * (states and LGAs, which carry names), and a postcode's own segments. NDAPS
 * stores districts and areas by code only and has no street index, so a street
 * or a house number simply cannot be placed: it is reported in `unresolved`
 * rather than guessed. Everything here is read-only and takes its data through
 * `AddressLookup`, so it runs the same in the browser and in a test.
 */

import type { LocationCandidate } from '../atlas/dataset';
import { matchLgaName, matchStateName } from '../atlas/names';
import { POSTCODE_PATTERN, toDashedCode } from '../atlas/postcodeCode';
import type { PostcodeLocation } from '../../types/postcode';
import type { AddressLookup, InterpretedAddress, ParsedAddress } from './types';

/** Copy a postcode record's names and codes onto the result. */
function applyRecord(result: InterpretedAddress, record: PostcodeLocation): void {
  const code = toDashedCode(record.postcode);
  if (POSTCODE_PATTERN.test(code)) result.postcode = { code, verified: true };
  if (record.state) {
    result.state = { code: record.state, name: record.stateName ?? record.state };
  }
  if (record.lga) {
    result.lga = { code: record.lga, name: record.lgaName ?? record.lga };
  }
  if (record.district) result.district = { code: record.district };
  if (record.area) result.area = { code: record.area };
  if (record.name) result.landmark = { name: record.name, postcode: code };
}

/**
 * A discovered landmark matches an address part only on a whole name or
 * address. Substring matching would let a part as common as "Lagos" hit
 * every landmark address that mentions it.
 */
function findLandmark(points: PostcodeLocation[], text: string): PostcodeLocation | undefined {
  const needle = text.trim().toLowerCase();
  if (!needle) return undefined;
  return points.find((point) =>
    [point.name, point.display, point.address].some(
      (value) => typeof value === 'string' && value.trim().toLowerCase() === needle,
    ),
  );
}

/**
 * The one place a search names, or nothing when it is ambiguous. Only states
 * and LGAs carry a name in NDAPS, so those are the only levels a place name
 * alone (rather than a code) can fill.
 */
function pickPlace(candidates: LocationCandidate[]): LocationCandidate | undefined {
  const places = candidates.filter((candidate) => candidate.type === 'state' || candidate.type === 'lga');
  const codes = new Set(places.map((candidate) => `${candidate.type}:${candidate.code}`));
  return codes.size === 1 ? places[0] : undefined;
}

/** The deepest level the result actually reached. */
function deepest(result: InterpretedAddress): InterpretedAddress['resolvedTo'] {
  if (result.postcode) return 'postcode';
  if (result.area) return 'area';
  if (result.district) return 'district';
  if (result.lga) return 'lga';
  if (result.state) return 'state';
  return 'none';
}

/**
 * Resolve a parsed address against the Atlas data, placing what the data
 * supports and reporting the rest. A written postcode resolves first (and may
 * carry the levels below it); then a named verified landmark; then a state, an
 * LGA, or a place the catalogue already knows. A part that matches more than
 * one distinct place is left unresolved rather than guessed.
 */
export async function resolveAddress(
  parsed: ParsedAddress,
  lookup: AddressLookup,
): Promise<InterpretedAddress> {
  const result: InterpretedAddress = {
    input: parsed.raw,
    unresolved: [],
    resolvedTo: 'none',
  };
  const { segments } = parsed;
  const placed = new Set<number>();

  if (parsed.postcode) {
    const record = await lookup.lookupPostcode(parsed.postcode);
    result.postcode = { code: parsed.postcode, verified: record !== null };
    if (record) applyRecord(result, record);
    segments.forEach((segment, index) => {
      if (segment.kind === 'postcode') placed.add(index);
    });
  } else {
    const points = await lookup.discoveryPoints();
    const index = segments.findIndex((segment) => findLandmark(points, segment.text) !== undefined);
    if (index >= 0) {
      const point = findLandmark(points, segments[index].text);
      if (point) {
        placed.add(index);
        applyRecord(result, point);
        result.postcode = { code: toDashedCode(point.postcode), verified: true };
      }
    }
  }

  const states = await lookup.states();

  // A state named in the address. A record above may already know the state;
  // this still runs to consume the part so it is not reported as unplaced.
  for (let index = 0; index < segments.length; index += 1) {
    if (placed.has(index) || segments[index].kind === 'postcode') continue;
    const match = matchStateName(states, segments[index].text);
    if (!match) continue;
    placed.add(index);
    result.state ??= { code: match.code, name: match.name };
    break;
  }

  // The LGA named in the address, read only within the resolved state.
  if (result.state) {
    const lgas = await lookup.lgas(result.state.code);
    for (let index = 0; index < segments.length; index += 1) {
      if (placed.has(index) || segments[index].kind === 'postcode') continue;
      const match = matchLgaName(lgas, segments[index].text);
      if (!match) continue;
      placed.add(index);
      result.lga ??= { code: match.code, name: match.name };
      break;
    }
  }

  // A place the catalogue already knows, so an LGA named without its state
  // ("Ikeja") resolves the way the lookup tools already treat it.
  for (let index = 0; index < segments.length; index += 1) {
    if (placed.has(index) || segments[index].kind === 'postcode') continue;
    const hit = pickPlace(await lookup.search(segments[index].text));
    if (!hit) continue;
    placed.add(index);
    if (hit.type === 'state') {
      result.state ??= { code: hit.code, name: hit.name ?? hit.code };
      continue;
    }
    const parentCode = hit.state;
    if (parentCode && !result.state) {
      const parent = states.find((state) => state.code.toUpperCase() === parentCode.toUpperCase());
      result.state = parent ? { code: parent.code, name: parent.name } : { code: parentCode, name: parentCode };
    }
    result.lga ??= { code: hit.code, name: hit.name ?? hit.code };
  }

  result.unresolved = segments
    .filter((_, index) => !placed.has(index))
    .map((segment) => segment.text);
  result.resolvedTo = deepest(result);
  return result;
}
