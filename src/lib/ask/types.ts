/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Load-bearing contracts for the Ask Atlas conversational layer.
 * Feature 2 (N-ATLAS) implements AskAtlasResponder behind this same
 * interface; the UI must not know which implementation it is talking to.
 */

import type { DecodedPostcode, ToolError } from '../tools/types';

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
  /**
   * Verified postcode payload for the reply (feature 4). Derived on the
   * client from the executed tool results; always absent on stub replies
   * and on intermediate toolCalls responses.
   */
  lookup?: VerifiedLookup;
  /**
   * Hierarchy listing payload for the reply (feature 5). Derived on the
   * client from the executed tool results; always absent on stub replies
   * and on intermediate toolCalls responses.
   */
  results?: AtlasResultList;
  /**
   * Decoded postcode breakdown for the reply (feature 6). Derived on the
   * client from the executed tool results; always absent on stub replies
   * and on intermediate toolCalls responses.
   */
  decoded?: DecodedPostcode;
  /**
   * Present when the model asked for tool calls instead of answering.
   * `text` is empty then; the client executes the calls and feeds the
   * results back via the next request's `toolTurns`.
   */
  toolCalls?: AskToolCall[];
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
  /** Verified postcode payload rendered as the feature 4 chip. */
  lookup?: VerifiedLookup;
  /** Hierarchy listing payload rendered as the feature 5 list. */
  results?: AtlasResultList;
  /** Decoded postcode breakdown rendered as the feature 6 card. */
  decoded?: DecodedPostcode;
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
  /**
   * Completed tool-call rounds from the client (3c multi-round loop).
   * The server appends these to the provider messages after the last user
   * text, in order; absent on the first round.
   */
  toolTurns?: AskToolTurn[];
}

/**
 * A tool call requested by the model, exactly as the provider returned it.
 * `arguments` is the raw JSON string; the client parses it (guarded) and
 * `runTool` safe-parses it again, so malformed arguments always surface as
 * `invalid_args`.
 */
export interface AskToolCall {
  id: string;
  name: string;
  arguments: string;
}

/** The client-executed outcome of one `AskToolCall` (mirrors 3b `ToolExecutionResult`). */
export interface AskToolResult {
  tool_call_id: string;
  name: string;
  ok: boolean;
  data?: unknown;
  error?: ToolError;
}

/** One completed round: the calls the model made and their client results. */
export interface AskToolTurn {
  assistantToolCalls: AskToolCall[];
  toolResults: AskToolResult[];
}

/** One row of an exploration result list (feature 5). */
export interface AtlasResultItem {
  type: 'state' | 'lga' | 'district' | 'area' | 'unit';
  code: string;
  name?: string;
  parent?: string;
}

/**
 * Hierarchy listing derived from the executed tool results (feature 5).
 * Load-bearing for the later grounded lookups (features 6-9); keep the shape
 * stable. Built on the client, never from the reply prose.
 */
export interface AtlasResultList {
  level: 'state' | 'lga' | 'district' | 'area' | 'unit';
  /** Human container label, for example "Lagos". Absent for a global list. */
  scope?: string;
  /** Codes behind the scope, for the bundled unit lookup. */
  scopePath?: { state?: string; lga?: string; district?: string };
  items: AtlasResultItem[];
  /** Number of rows before display capping. */
  total: number;
  /** Bundled verified postcode units inside the scope (feature 5). */
  units?: AtlasResultItem[];
  unitsTotal?: number;
}

/**
 * Deterministic, verified postcode found for the user's lookup (feature 4).
 * Built from the executed tool results, never from the reply prose, so the
 * rendered chip is authoritative even when the model formats the code
 * differently in its text.
 */
export interface VerifiedLookup {
  /** Dashed form, for example FC-02-D43-LG-01. */
  postcode: string;
  /** Landmark/building name from the source record, when it has one. */
  label?: string;
  stateName?: string;
  lgaName?: string;
  coordinates?: [number, number];
  /** True when the source is the bundled verified dataset (landmark). */
  verified: boolean;
}

export interface AskAtlasResponder {
  respond(request: AskAtlasRequest): Promise<AskAtlasResponse>;
}
