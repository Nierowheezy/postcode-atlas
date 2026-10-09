/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AskAtlasRequest,
  AskAtlasResponder,
  AskAtlasResponse,
  AskToolCall,
  AskToolResult,
  AskToolTurn,
  AtlasResultItem,
  AtlasResultList,
  NearbyResultItem,
  NearbyResultList,
  VerifiedLookup,
} from './types';
import { ASK_API_ENDPOINT, AskApiErrorResponse } from './api-types';
import { AskApiError } from './errors';
import { runTool } from '../tools/registry';
import { atlasStore } from '../atlas/store';
import type { PostcodeLocation } from '../../types/postcode';
import type { DecodedPostcode, MapAction, NearbyUnit } from '../tools/types';
import type { AtlasArea, AtlasDistrict, AtlasLga, AtlasState, LocationCandidate } from '../atlas/dataset';

const RESPONSE_DELAY_MS = 400;

/** Most bundled verified units to attach to one exploration list (feature 5). */
const MAX_RESULT_UNITS = 8;

/** Default nearby radius, matching the 3b executor's own cap (feature 7). */
const DEFAULT_NEARBY_RADIUS_M = 300;

interface StubRule {
  pattern: RegExp;
  reply: () => AskAtlasResponse;
}

const RULES: StubRule[] = [
  {
    pattern: /\b(ikeja|yaba|surulere|lekki|ikoyi|victoria island)\b/i,
    reply: () => ({
      text: 'That is a real Lagos place, but the placeholder responder cannot look up verified postcodes. Start the app with the answer service connected (API mode, the default) to ask for real lookups.',
      grounding: 'unverified',
    }),
  },
  {
    pattern: /\blagos\b/i,
    reply: () => ({
      text: 'Lagos State has 20 Local Government Areas. Ask me for a specific LGA, district, or postcode to narrow it down.',
      grounding: 'unverified',
    }),
  },
  {
    pattern: /\b(decode|structure|explain)\b.*\bpostcode\b|\bpostcode\b.*\b(decode|structure|explain)\b/i,
    reply: () => ({
      text: 'An NDAPS postcode has five segments: state (LA), LGA (11), district (A12), area (AK), and unit (08).\n\nExample: LA-11-A12-AK-08',
      grounding: 'unverified',
    }),
  },
  {
    pattern: /\b(postcode|postal code|zip)\b/i,
    reply: () => ({
      text: 'The placeholder responder cannot verify postcodes. Start the app with the answer service connected (API mode, the default) and I can look up real postcodes for places, landmarks, and codes.',
      grounding: 'unverified',
    }),
  },
];

const FALLBACK: AskAtlasResponse = {
  text: 'Ask Atlas is running with its placeholder responder. Start the app in API mode (the default) for live answers; stub mode replies are canned.',
  grounding: 'unverified',
};

function pickReply(text: string): AskAtlasResponse {
  const rule = RULES.find((r) => r.pattern.test(text));
  return rule ? rule.reply() : FALLBACK;
}

/** Dev stub: canned replies, artificial latency, rejects for "!fail". */
export function createStubResponder(): AskAtlasResponder {
  return {
    respond({ text }: AskAtlasRequest): Promise<AskAtlasResponse> {
      const trimmed = text.trim();
      if (trimmed.startsWith('!fail')) {
        return new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Stub responder failure (requested via !fail)')), RESPONSE_DELAY_MS),
        );
      }
      return new Promise((resolve) =>
        setTimeout(() => resolve(pickReply(trimmed)), RESPONSE_DELAY_MS),
      );
    },
  };
}

const SERVICE_UNAVAILABLE_COPY =
  'Ask Atlas cannot reach its answer service right now.\n\nTry again in a moment.';
const ALL_ENGINES_DOWN_COPY =
  'Ask Atlas is having trouble answering right now.\n\nTry again in a few minutes.';
const GENERIC_ERROR_COPY =
  'Ask Atlas could not process that request.\n\nTry rephrasing or ask again in a moment.';
const TOOL_LOOP_EXHAUSTED_COPY =
  'I could not finish verifying that with the available tools in time. Please try again or rephrase.';

/** Max completed tool rounds per ask (the server allows one more, so we stay under it). */
const MAX_TOOL_ROUNDS = 3;

/** Error fed back when a tool call's `arguments` is not valid JSON. */
function invalidArgsError(): AskToolResult['error'] {
  return { code: 'invalid_args', message: 'Tool arguments were not valid JSON.' };
}

/**
 * Run one tool call locally through the 3b dispatcher. `runTool` never throws
 * and safe-parses arguments again, so malformed arguments surface as a failed
 * result (`ok: false`, `invalid_args`) that feeds back - never a rejection.
 */
async function executeToolCalls(calls: AskToolCall[]): Promise<AskToolResult[]> {
  const results: AskToolResult[] = [];
  for (const call of calls) {
    let args: unknown;
    try {
      args = JSON.parse(call.arguments);
    } catch {
      results.push({ tool_call_id: call.id, name: call.name, ok: false, error: invalidArgsError() });
      continue;
    }
    const outcome = await runTool(call.name, args);
    results.push({
      tool_call_id: call.id,
      name: call.name,
      ok: outcome.ok,
      ...(outcome.ok ? { data: outcome.data } : { error: outcome.error }),
    });
  }
  return results;
}

/**
 * Narrow an executed `getPostcode` result's data to a location record.
 * A `null` (unmapped code) or shape-mismatched payload yields undefined.
 */
function asPostcodeLocation(value: unknown): PostcodeLocation | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  return typeof (value as Record<string, unknown>).postcode === 'string'
    ? (value as PostcodeLocation)
    : undefined;
}

/** Narrow executed search data to candidate records (unknowns are dropped). */
function asLocationCandidates(value: unknown): LocationCandidate[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is LocationCandidate =>
      typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).code === 'string',
  );
}

/** A landmark candidate is always backed by the bundled verified dataset. */
function landmarkToLookup(candidate: LocationCandidate): VerifiedLookup {
  return {
    postcode: candidate.code,
    label: candidate.name,
    coordinates: candidate.coordinates,
    verified: true,
  };
}

function locationToLookup(location: PostcodeLocation): VerifiedLookup {
  return {
    postcode: location.postcode,
    label: location.name,
    stateName: location.stateName,
    lgaName: location.lgaName,
    coordinates:
      location.lat !== undefined && location.lng !== undefined ? [location.lat, location.lng] : undefined,
    // A lookup is built only from an executed Atlas tool result; discovery and
    // gateway records are NIPOST data, so it is verified by construction even
    // when the record omits a `verified` flag (the bundled discovery list does).
    verified: true,
  };
}

/**
 * Derive the verified postcode payload (feature 4) from the tool results the
 * client already executed. Deterministic and side-effect free: a later result
 * replaces the payload only when it itself yields one - the last successful
 * `getPostcode` record, else the last `searchLocation` holding exactly one
 * landmark candidate. Zero or multiple landmark postcodes, a failed result, or
 * an unmapped `getPostcode` is ambiguous for this contract and leaves the
 * payload as it was; an empty turn list yields undefined.
 */
export function deriveLookup(toolTurns: AskToolTurn[]): VerifiedLookup | undefined {
  let lookup: VerifiedLookup | undefined;

  for (const turn of toolTurns) {
    for (const result of turn.toolResults) {
      if (!result.ok) continue;

      if (result.name === 'getPostcode') {
        const location = asPostcodeLocation(result.data);
        if (location) lookup = locationToLookup(location);
        continue;
      }
      if (result.name === 'searchLocation') {
        const landmarks = asLocationCandidates(result.data).filter((c) => c.type === 'landmark');
        if (landmarks.length === 1) lookup = landmarkToLookup(landmarks[0]);
      }
    }
  }

  return lookup;
}

/**
 * Attach the derived lookup to a final reply, plus the feature 8 location
 * slot when the lookup carries coordinates. Returns the reply unchanged when
 * no unambiguous postcode-bearing result backs it.
 */
function withLookup(response: AskAtlasResponse, toolTurns: AskToolTurn[]): AskAtlasResponse {
  const lookup = deriveLookup(toolTurns);
  if (!lookup) return response;

  return {
    ...response,
    lookup,
    ...(lookup.coordinates
      ? {
          location: {
            lat: lookup.coordinates[0],
            lng: lookup.coordinates[1],
            label: lookup.label ?? lookup.postcode,
          },
        }
      : {}),
  };
}

/** Narrow executed data to records that carry a string `code`. */
function asCodeRecords<T extends { code: string }>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is T =>
      typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).code === 'string',
  );
}

/** Join non-empty labels into one scope or parent line. */
function joinLabels(parts: Array<string | undefined>): string | undefined {
  const kept = parts.filter((part): part is string => Boolean(part));
  return kept.length > 0 ? kept.join(', ') : undefined;
}

/** Resolve a state code to its name from the local snapshot; undefined if unknown. */
async function stateNameOf(code: string | undefined): Promise<string | undefined> {
  if (!code) return undefined;
  const states = await atlasStore.getStates();
  return states.find((state) => state.code.toUpperCase() === code.toUpperCase())?.name;
}

/** Resolve an LGA code within a state to its name; undefined if unknown. */
async function lgaNameOf(state: string | undefined, code: string | undefined): Promise<string | undefined> {
  if (!state || !code) return undefined;
  const lgas = await atlasStore.getLgas(state);
  return lgas.find((lga) => lga.code === code)?.name;
}

function resultFromStates(value: unknown): AtlasResultList | undefined {
  const states = asCodeRecords<AtlasState>(value);
  if (states.length === 0) return undefined;
  const items = states.map(
    (state): AtlasResultItem => ({ type: 'state', code: state.code, name: state.name }),
  );
  return { level: 'state', items, total: items.length };
}

async function resultFromLgas(value: unknown): Promise<AtlasResultList | undefined> {
  const lgas = asCodeRecords<AtlasLga>(value);
  if (lgas.length === 0) return undefined;
  const state = lgas[0].state;
  const stateName = await stateNameOf(state);
  const items = lgas.map((lga): AtlasResultItem => ({ type: 'lga', code: lga.code, name: lga.name }));
  return { level: 'lga', scope: stateName, scopePath: { state }, items, total: items.length };
}

async function resultFromDistricts(value: unknown): Promise<AtlasResultList | undefined> {
  const districts = asCodeRecords<AtlasDistrict>(value);
  if (districts.length === 0) return undefined;
  const { state, lga } = districts[0];
  const [stateName, lgaName] = await Promise.all([stateNameOf(state), lgaNameOf(state, lga)]);
  const items = districts.map(
    (district): AtlasResultItem => ({ type: 'district', code: district.code, name: district.name }),
  );
  return {
    level: 'district',
    scope: joinLabels([lgaName ?? lga, stateName]),
    scopePath: { state, lga },
    items,
    total: items.length,
  };
}

async function resultFromAreas(value: unknown): Promise<AtlasResultList | undefined> {
  const areas = asCodeRecords<AtlasArea>(value);
  if (areas.length === 0) return undefined;
  const { state, lga, district } = areas[0];
  const [stateName, lgaName] = await Promise.all([stateNameOf(state), lgaNameOf(state, lga)]);
  const items = areas.map((area): AtlasResultItem => ({ type: 'area', code: area.code, name: area.name }));
  return {
    level: 'area',
    scope: joinLabels([district, lgaName ?? lga, stateName]),
    scopePath: { state, lga, district },
    items,
    total: items.length,
  };
}

function resultFromSearch(value: unknown): AtlasResultList | undefined {
  const candidates = asLocationCandidates(value);
  if (candidates.length === 0) return undefined;
  const items = candidates.map(
    (candidate): AtlasResultItem => ({
      type: candidate.type === 'landmark' ? 'unit' : candidate.type,
      code: candidate.code,
      name: candidate.name,
    }),
  );
  // Mixed search replies take the first row's type as the list level.
  return { level: items[0].type, items, total: items.length };
}

/** Match a bundled landmark postcode against a scope path by dashed prefix. */
function unitInScope(postcode: string, path: { state?: string; lga?: string; district?: string }): boolean {
  const prefix = [path.state, path.lga, path.district]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.toUpperCase())
    .join('-');
  return prefix.length > 0 && postcode.trim().toUpperCase().startsWith(`${prefix}-`);
}

/**
 * Select the bundled verified units inside a scope, deduped and capped for
 * display. Pure so the cap and prefix matching are testable; returns undefined
 * when nothing matches.
 */
export function selectScopeUnits(
  landmarks: PostcodeLocation[],
  path: { state?: string; lga?: string; district?: string },
): { units: AtlasResultItem[]; unitsTotal: number } | undefined {
  const seen = new Set<string>();
  const all: AtlasResultItem[] = [];
  for (const landmark of landmarks) {
    if (!landmark.postcode || !unitInScope(landmark.postcode, path) || seen.has(landmark.postcode)) continue;
    seen.add(landmark.postcode);
    all.push({
      type: 'unit',
      code: landmark.postcode,
      name: landmark.name,
      parent: joinLabels([landmark.lgaName, landmark.stateName]),
    });
  }
  return all.length > 0 ? { units: all.slice(0, MAX_RESULT_UNITS), unitsTotal: all.length } : undefined;
}

/**
 * Attach the bundled verified postcode units inside an LGA, district, or area
 * scope (feature 5). Discovery landmarks stay offline, so this never touches
 * the gateway.
 */
async function withUnits(list: AtlasResultList): Promise<AtlasResultList> {
  const path = list.scopePath;
  const enrichable = list.level === 'lga' || list.level === 'district' || list.level === 'area';
  if (!path || !enrichable) return list;

  const selected = selectScopeUnits(await atlasStore.getDiscoveryPoints(), path);
  return selected ? { ...list, ...selected } : list;
}

/** Map one successful tool result to a result list, or undefined if it has none. */
async function deriveOne(result: AskToolResult): Promise<AtlasResultList | undefined> {
  switch (result.name) {
    case 'getStates':
      return resultFromStates(result.data);
    case 'getLgas':
      return resultFromLgas(result.data);
    case 'getDistricts':
      return resultFromDistricts(result.data);
    case 'getAreas':
      return resultFromAreas(result.data);
    case 'searchLocation':
      return resultFromSearch(result.data);
    default:
      return undefined;
  }
}

/**
 * Derive the exploration result list (feature 5) from the executed tool
 * results. Deterministic: the last list-producing result wins. A failed
 * result or an empty array leaves the list as it was, and a reply with no
 * list-producing result does no store reads. The final list gains the bundled
 * verified units for its scope.
 */
export async function deriveResults(toolTurns: AskToolTurn[]): Promise<AtlasResultList | undefined> {
  let list: AtlasResultList | undefined;

  for (const turn of toolTurns) {
    for (const result of turn.toolResults) {
      if (!result.ok) continue;
      const next = await deriveOne(result);
      if (next) list = next;
    }
  }

  return list ? withUnits(list) : undefined;
}

/** Narrow executed data to a decoded postcode payload; a bad shape yields undefined. */
function asDecodedPostcode(value: unknown): DecodedPostcode | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const decoded = value as Record<string, unknown>;
  const segments = decoded.segments;
  return typeof decoded.postcode === 'string' && typeof segments === 'object' && segments !== null
    ? (value as DecodedPostcode)
    : undefined;
}

/**
 * Derive the decoded postcode breakdown (feature 6) from the executed tool
 * results. Deterministic: the last successful `decodePostcode` result wins,
 * including an invalid-structure payload so the card can explain it. A failed
 * result or a reply with no decode leaves it unset.
 */
export function deriveDecoded(toolTurns: AskToolTurn[]): DecodedPostcode | undefined {
  let decoded: DecodedPostcode | undefined;

  for (const turn of toolTurns) {
    for (const result of turn.toolResults) {
      if (!result.ok || result.name !== 'decodePostcode') continue;
      const payload = asDecodedPostcode(result.data);
      if (payload) decoded = payload;
    }
  }

  return decoded;
}

/** Narrow executed data to nearby unit records. */
function asNearbyUnits(value: unknown): NearbyUnit[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is NearbyUnit =>
      typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).postcode === 'string',
  );
}

/** Map one nearby unit to a display row: address label, distance, and parent. */
function toNearbyItem(unit: NearbyUnit): NearbyResultItem {
  const parent = [unit.lgaName, unit.stateName].filter((part): part is string => Boolean(part)).join(', ');
  return {
    postcode: unit.postcode,
    label: unit.address || undefined,
    distance_m: typeof unit.distance_m === 'number' ? unit.distance_m : undefined,
    parent: parent || undefined,
  };
}

/** A finite lat/lng within the schema ranges, or undefined for anything else. */
function asCoordinatePair(value: unknown): { lat: number; lng: number } | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const [lat, lng] = value;
  if (typeof lat !== 'number' || typeof lng !== 'number') return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { lat, lng };
}

/**
 * The origin and radius a `getNearby` call actually used, read from the
 * call's own arguments rather than the prose. Malformed JSON or an
 * out-of-range coordinate drops the origin but keeps the rows.
 */
function originFromCall(call: AskToolCall | undefined): { origin?: NearbyResultList['origin']; radius_m: number } {
  if (!call) return { radius_m: DEFAULT_NEARBY_RADIUS_M };

  let args: unknown;
  try {
    args = JSON.parse(call.arguments);
  } catch {
    return { radius_m: DEFAULT_NEARBY_RADIUS_M };
  }

  const raw = (typeof args === 'object' && args !== null ? args : {}) as Record<string, unknown>;
  const origin = asCoordinatePair([raw.lat, raw.lng]);
  const radius = raw.radius;
  const radius_m =
    typeof radius === 'number' && Number.isFinite(radius) && radius > 0 ? radius : DEFAULT_NEARBY_RADIUS_M;

  return { origin, radius_m };
}

/**
 * Derive the nearby unit list (feature 7) from the executed tool results.
 * Deterministic: the last successful `getNearby` result wins. An empty array
 * is a real "nothing nearby" answer, so it still yields a payload; a failed
 * result or a reply with no `getNearby` leaves it unset.
 */
export function deriveNearby(toolTurns: AskToolTurn[]): NearbyResultList | undefined {
  let nearby: NearbyResultList | undefined;

  for (const turn of toolTurns) {
    turn.toolResults.forEach((result, index) => {
      if (!result.ok || result.name !== 'getNearby' || !Array.isArray(result.data)) return;

      const { origin, radius_m } = originFromCall(turn.assistantToolCalls[index]);
      const items = asNearbyUnits(result.data).map(toNearbyItem);
      nearby = { ...(origin ? { origin } : {}), items, total: items.length, radius_m };
    });
  }

  return nearby;
}

/** A finite coordinate pair, or undefined for anything malformed. */
function asMapCenter(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const [lat, lng] = value;
  if (typeof lat !== 'number' || typeof lng !== 'number') return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return [lat, lng];
}

function asNamedCode(value: unknown): { code: string; name: string } | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const named = value as Record<string, unknown>;
  return typeof named.code === 'string' && typeof named.name === 'string'
    ? { code: named.code, name: named.name }
    : undefined;
}

/** Narrow executed data to one of the four map actions, or undefined. */
function asMapAction(value: unknown): MapAction | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const action = value as Record<string, unknown>;
  const zoom = typeof action.zoom === 'number' && Number.isFinite(action.zoom) ? action.zoom : undefined;

  if (action.target === 'reset') {
    return { target: 'reset', center: asMapCenter(action.center) ?? [0, 0], zoom: zoom ?? 0 };
  }
  if (action.target === 'postcode') {
    return typeof action.postcode === 'string' && typeof action.location === 'object' && action.location !== null
      ? (value as MapAction)
      : undefined;
  }

  const state = asNamedCode(action.state);
  const center = asMapCenter(action.center);
  if (!state || !center || zoom === undefined) return undefined;

  if (action.target === 'state') return { target: 'state', state, center, zoom };
  if (action.target === 'lga') {
    const lga = asNamedCode(action.lga);
    return lga ? { target: 'lga', state, lga, center, zoom } : undefined;
  }
  return undefined;
}

/**
 * Derive the validated map action (feature 8) from the executed tool results.
 * Deterministic: the last successful `navigateMap` result wins. A failed
 * result or a reply with no `navigateMap` leaves it unset, so the map only
 * moves for an action the tool itself resolved.
 */
export function deriveMapAction(toolTurns: AskToolTurn[]): MapAction | undefined {
  let action: MapAction | undefined;

  for (const turn of toolTurns) {
    for (const result of turn.toolResults) {
      if (!result.ok || result.name !== 'navigateMap') continue;
      const next = asMapAction(result.data);
      if (next) action = next;
    }
  }

  return action;
}

/** Attach the feature 4 lookup, feature 5 list, feature 6 decode, feature 7 nearby list, and feature 8 map action to a final reply. */
async function attachDerived(response: AskAtlasResponse, toolTurns: AskToolTurn[]): Promise<AskAtlasResponse> {
  const withLookupResponse = withLookup(response, toolTurns);
  const results = await deriveResults(toolTurns);
  let next = results ? { ...withLookupResponse, results } : withLookupResponse;

  const decoded = deriveDecoded(toolTurns);
  if (decoded) {
    next = { ...next, decoded };
    if (decoded.coordinates && !next.location) {
      next = {
        ...next,
        location: {
          lat: decoded.coordinates[0],
          lng: decoded.coordinates[1],
          label: decoded.postcode,
        },
      };
    }
  }

  const nearby = deriveNearby(toolTurns);
  if (nearby) next = { ...next, nearby };

  const mapAction = deriveMapAction(toolTurns);
  if (mapAction) next = { ...next, mapAction };

  return next;
}

/** One POST to `/api/ask`. Transport + error mapping only; no loop logic. */
async function postAsk(request: AskAtlasRequest): Promise<AskAtlasResponse> {
  let raw: Response;
  try {
    raw = await fetch(ASK_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: request.text,
        context: request.context,
        history: request.history,
        language: request.language,
        ...(request.toolTurns && request.toolTurns.length > 0 ? { toolTurns: request.toolTurns } : {}),
      }),
    });
  } catch {
    // fetch() itself failed: offline, DNS, connection reset.
    throw new AskApiError('network', SERVICE_UNAVAILABLE_COPY, { retryable: true });
  }

  // Vite's SPA fallback and Vercel's catch-all rewrite answer unknown
  // routes with index.html, so trust only real JSON responses.
  const contentType = raw.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new AskApiError(
      // A 5xx HTML page is likely a transient gateway failure (retriable);
      // a 200/404 HTML page means the endpoint is simply not deployed yet.
      raw.status >= 500 ? 'network' : 'service-unavailable',
      SERVICE_UNAVAILABLE_COPY,
      { retryable: raw.status >= 500 },
    );
  }

  let body: unknown;
  try {
    body = await raw.json();
  } catch {
    throw new AskApiError('unexpected', GENERIC_ERROR_COPY, { retryable: false });
  }

  if (!raw.ok) {
    const error = (body as Partial<AskApiErrorResponse>)?.error;
    // Server said quota is gone for every provider: back off hard.
    if (error?.code === 'all_providers_unavailable') {
      throw new AskApiError('all-providers-unavailable', ALL_ENGINES_DOWN_COPY, {
        retryable: false,
        retryAfterSeconds: error.retryAfterSeconds,
      });
    }
    // Bad request will fail identically on every retry.
    if (error?.code === 'bad_request') {
      throw new AskApiError('bad-request', error.message || GENERIC_ERROR_COPY, { retryable: false });
    }
    // Other 5xx JSON errors are worth one more attempt later.
    throw new AskApiError(
      raw.status >= 500 ? 'network' : 'unexpected',
      error?.message || GENERIC_ERROR_COPY,
      { retryable: raw.status >= 500 },
    );
  }

  return body as AskAtlasResponse;
}

/**
 * Production responder: POSTs to the server-side `/api/ask` endpoint, so
 * provider keys never reach the browser, and runs the 3c multi-round tool
 * loop: while the server answers with `toolCalls`, execute each call locally
 * via `runTool` and feed the results back. Capped at `MAX_TOOL_ROUNDS`;
 * a final reply is grounded `'atlas'` iff at least one executed tool result
 * succeeded.
 */
export function createApiResponder(): AskAtlasResponder {
  return {
    async respond(request: AskAtlasRequest): Promise<AskAtlasResponse> {
      let toolTurns: AskToolTurn[] = [];
      let grounded = false;

      // Round 0 posts without tool turns; each later round appends one more.
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
        const response = await postAsk({ ...request, toolTurns });

        if (!response.toolCalls || response.toolCalls.length === 0) {
          // Final answer. Upgrade its grounding only when tools really ran,
          // then attach the derived lookup (feature 4) and list (feature 5).
          return attachDerived(grounded ? { ...response, grounding: 'atlas' } : response, toolTurns);
        }

        if (round === MAX_TOOL_ROUNDS) {
          // Cap reached and the model still wants tools: honest text reply.
          return attachDerived(
            {
              text: TOOL_LOOP_EXHAUSTED_COPY,
              grounding: grounded ? 'atlas' : 'unverified',
              engine: response.engine,
            },
            toolTurns,
          );
        }

        const toolResults = await executeToolCalls(response.toolCalls);
        grounded = grounded || toolResults.some((result) => result.ok);
        toolTurns = [...toolTurns, { assistantToolCalls: response.toolCalls, toolResults }];
      }

      // The loop always returns inside; this keeps the type checker honest.
      throw new Error('unreachable: ask loop over-ran its bounds');
    },
  };
}