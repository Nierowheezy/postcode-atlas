/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Load-bearing contracts for the Atlas tool layer (feature 3b).
 * The chat loop (3c) and the grounded lookups (features 4-9) build on these
 * names and result shapes; keep them stable.
 */

import type { ZodType } from 'zod';
import type { PostcodeLocation, PostcodeSegments, StateGeoInfo } from '../../types/postcode';
import type { AtlasArea, AtlasDistrict, AtlasLga, AtlasState, LocationCandidate } from '../atlas/dataset';

export const TOOL_NAMES = [
  'searchLocation',
  'getState',
  'getStates',
  'getLgas',
  'getDistricts',
  'getAreas',
  'getPostcode',
  'decodePostcode',
  'getNearby',
  'navigateMap',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type ToolErrorCode = 'invalid_args' | 'unknown_tool' | 'not_found' | 'internal_error';

export interface ToolError {
  code: ToolErrorCode;
  message: string;
  issues?: string[];
}

export type ToolExecutionResult<Data> =
  | { ok: true; data: Data }
  | { ok: false; error: ToolError };

/** Typed authoring shape: one schema, one executor, one description per tool. */
export interface ToolDefinition<Args, Data> {
  name: ToolName;
  description: string;
  schema: ZodType<Args>;
  execute: (args: Args) => Promise<Data>;
}

/** Erased shape the registry stores; `runTool` validates args before execute. */
export interface RegisteredTool {
  name: ToolName;
  description: string;
  schema: ZodType;
  execute: (args: unknown) => Promise<unknown>;
}

/** Thrown by an executor to return a specific ToolError instead of a fault. */
export class ToolFault extends Error {
  constructor(
    readonly code: ToolErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ToolFault';
  }
}

/** `{ code, name }` plus the geo fields `StateGeoInfo` adds, without duplicating them. */
export type StateSummary = Pick<StateGeoInfo, 'code' | 'name'> &
  Partial<Omit<StateGeoInfo, 'code' | 'name'>>;

export interface DecodedPostcode {
  postcode: string;
  compact: string;
  display: string;
  valid: boolean;
  reason?: string;
  segments: PostcodeSegments;
  stateName?: string;
  lgaName?: string;
  coordinates?: [number, number];
  verified?: boolean;
}

/**
 * A validated request to move the map (feature 8). The tool resolves and
 * returns this; it never acts on it, so React stays the only place that
 * mutates map state.
 */
export type MapAction =
  | {
      target: 'state';
      state: { code: string; name: string };
      center: [number, number];
      zoom: number;
    }
  | {
      target: 'lga';
      state: { code: string; name: string };
      lga: { code: string; name: string };
      center: [number, number];
      zoom: number;
    }
  | { target: 'postcode'; postcode: string; location: PostcodeLocation }
  | { target: 'reset'; center: [number, number]; zoom: number };

/**
 * A capped hierarchy list handed to the model (feature 9). `total` is the row
 * count before capping, so the model can say how many exist instead of
 * implying the page is the whole list.
 */
export interface HierarchyPage<T> {
  items: T[];
  total: number;
  truncated: boolean;
}

export interface NearbyUnit {
  postcode: string;
  compact?: string;
  display?: string;
  state?: string;
  stateName?: string;
  lga?: string;
  lgaName?: string;
  district?: string;
  area?: string;
  unit?: string;
  coordinates?: [number, number];
  distance_m?: number;
  address?: string;
}

/** The data payload each tool returns, keyed by tool name. */
export interface ToolResultMap {
  searchLocation: LocationCandidate[];
  getState: StateSummary;
  getStates: AtlasState[];
  getLgas: AtlasLga[];
  getDistricts: HierarchyPage<AtlasDistrict>;
  getAreas: HierarchyPage<AtlasArea>;
  getPostcode: PostcodeLocation | null;
  decodePostcode: DecodedPostcode;
  getNearby: NearbyUnit[];
  navigateMap: MapAction;
}
