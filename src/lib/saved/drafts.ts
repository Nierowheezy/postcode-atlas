/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pure converters from what the Atlas already holds into a `SavedDiscovery`
 * (feature 20). Keeping them pure keeps the save decision testable and out of
 * the components: a component asks "is this savable?" and hands the result to
 * the store, rather than reasoning about payload shapes itself.
 */

import type { AskAtlasMessage } from '../ask/types';
import type { NamedCode, PostcodeLocation, StateGeoInfo } from '../../types/postcode';
import type { SavedDiscovery } from './types';

/** Dedupe key for a postcode or landmark. */
export function postcodeSavedId(postcode: string): string {
  return `postcode:${postcode.trim().toUpperCase()}`;
}

/** Dedupe key for a place, from the first stable key it has. */
export function placeSavedId(key: string): string {
  return `place:${key}`;
}

function round4(value: number): string {
  return value.toFixed(4);
}

/** Best display text for a postcode source: landmark, address, area, or code. */
function postcodeLabel(loc: PostcodeLocation, code: string): string {
  return (
    loc.name ||
    loc.address ||
    [loc.lgaName, loc.stateName].filter(Boolean).join(', ') ||
    code
  );
}

/**
 * A verified postcode result or a discovery landmark. `kind` is `postcode` for
 * both, because the reopen path is the same lookup; the landmark keeps its name
 * in `label` and its classification in `category`.
 */
export function savedFromLocation(loc: PostcodeLocation): SavedDiscovery | null {
  const code = loc.postcode?.trim();
  if (!code) return null;
  const normalized = code.toUpperCase();
  return {
    id: postcodeSavedId(normalized),
    kind: 'postcode',
    label: postcodeLabel(loc, normalized),
    postcode: normalized,
    stateCode: loc.state || undefined,
    stateName: loc.stateName,
    lgaCode: loc.lga || undefined,
    lgaName: loc.lgaName,
    lat: loc.lat,
    lng: loc.lng,
    category: loc.category,
    savedAt: 0,
  };
}

/** A state selection, which has no postcode of its own. */
export function savedFromState(state: StateGeoInfo): SavedDiscovery {
  return {
    id: placeSavedId(state.code),
    kind: 'place',
    label: state.name,
    stateCode: state.code,
    stateName: state.name,
    lat: state.center[0],
    lng: state.center[1],
    savedAt: 0,
  };
}

/** An LGA selection. The state still supplies the coordinates and the link. */
export function savedFromLga(state: StateGeoInfo, lga: NamedCode): SavedDiscovery {
  const lgaName = lga.name || lga.code;
  return {
    id: placeSavedId(`${state.code}-${lga.code}`),
    kind: 'place',
    label: lgaName,
    stateCode: state.code,
    stateName: state.name,
    lgaCode: lga.code,
    lgaName,
    lat: state.center[0],
    lng: state.center[1],
    savedAt: 0,
  };
}

/**
 * Pick the one finding an Ask Atlas reply is worth saving, by precedence:
 * a verified lookup, then a valid decode, then a map location. Lists, nearby
 * results, addresses, and explanations have no single reopen target yet, so they
 * return null and the bubble shows no save action.
 */
export function savedFromMessage(message: AskAtlasMessage): SavedDiscovery | null {
  if (message.lookup) {
    return {
      id: postcodeSavedId(message.lookup.postcode),
      kind: 'postcode',
      label: message.lookup.label || message.lookup.postcode,
      postcode: message.lookup.postcode.toUpperCase(),
      stateName: message.lookup.stateName,
      lgaName: message.lookup.lgaName,
      lat: message.lookup.coordinates?.[0],
      lng: message.lookup.coordinates?.[1],
      savedAt: 0,
    };
  }

  if (message.decoded && message.decoded.valid) {
    const { decoded } = message;
    const placed = [decoded.lgaName, decoded.stateName].filter(Boolean).join(', ');
    return {
      id: postcodeSavedId(decoded.postcode),
      kind: 'postcode',
      label: placed || decoded.postcode,
      postcode: decoded.postcode.toUpperCase(),
      stateName: decoded.stateName,
      lgaName: decoded.lgaName,
      lat: decoded.coordinates?.[0],
      lng: decoded.coordinates?.[1],
      savedAt: 0,
    };
  }

  if (message.location) {
    const { location } = message;
    return {
      id: placeSavedId(`${round4(location.lat)},${round4(location.lng)}`),
      kind: 'place',
      label: location.label,
      lat: location.lat,
      lng: location.lng,
      savedAt: 0,
    };
  }

  return null;
}
