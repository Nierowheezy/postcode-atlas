/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Load-bearing contracts for the Ask Atlas conversational layer.
 * Feature 2 (N-ATLAS) implements AskAtlasResponder behind this same
 * interface; the UI must not know which implementation it is talking to.
 */

export interface AtlasContextSnapshot {
  selectedState?: { code: string; name: string };
  selectedLga?: { code: string; name: string };
  selectedDistrict?: string;
  selectedArea?: string;
  selectedPostcode?: string;
  mapCenter: [number, number];
  mapZoom: number;
}

export type ResponseGrounding = 'atlas' | 'unverified';

/** Reply languages offered by the chip (N-ATLAS differentiator). */
export type AskLanguage = 'en' | 'yo' | 'ha' | 'ig';

export type AskEngineProvider = 'gemini' | 'openrouter' | 'nvidia' | 'natlas';

/** Which provider/model produced a reply, and which failover attempt succeeded. */
export interface AskEngineInfo {
  provider: AskEngineProvider;
  model: string;
  attempt: number;
}

export interface AskAtlasResponse {
  text: string;
  grounding: ResponseGrounding;
  /** Present on real API replies; absent on stub replies. */
  engine?: AskEngineInfo;
  /** Slot only; acting on it (map navigation) is feature 8. */
  location?: { lat: number; lng: number; label: string };
}

export type AskAtlasMessageRole = 'user' | 'assistant' | 'error';

export interface AskAtlasMessage {
  id: string;
  role: AskAtlasMessageRole;
  content: string;
  grounding?: ResponseGrounding;
  /** Which provider/model answered (present on real API replies). */
  engine?: AskEngineInfo;
  context?: AtlasContextSnapshot;
  /** Slot only; acting on it (map navigation) is feature 8. */
  location?: { lat: number; lng: number; label: string };
  timestamp: number;
}

/**
 * Single request object so context, history, and language travel together.
 * Replaces the feature 1 positional `respond(text, ctx)` signature; this is a
 * load-bearing change (features 3+ build on it).
 */
export interface AskAtlasRequest {
  text: string;
  context: AtlasContextSnapshot;
  /** Recent turns; the panel sends them, the server caps them (last 10). */
  history?: AskAtlasMessage[];
  /** Desired reply language; absent means English. */
  language?: AskLanguage;
}

export interface AskAtlasResponder {
  respond(request: AskAtlasRequest): Promise<AskAtlasResponse>;
}
