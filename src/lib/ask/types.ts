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

export interface AskAtlasResponse {
  text: string;
  grounding: ResponseGrounding;
  /** Slot only; acting on it (map navigation) is feature 8. */
  location?: { lat: number; lng: number; label: string };
}

export type AskAtlasMessageRole = 'user' | 'assistant' | 'error';

export interface AskAtlasMessage {
  id: string;
  role: AskAtlasMessageRole;
  content: string;
  grounding?: ResponseGrounding;
  context?: AtlasContextSnapshot;
  /** Slot only; acting on it (map navigation) is feature 8. */
  location?: { lat: number; lng: number; label: string };
  timestamp: number;
}

export interface AskAtlasResponder {
  respond(text: string, ctx: AtlasContextSnapshot): Promise<AskAtlasResponse>;
}
