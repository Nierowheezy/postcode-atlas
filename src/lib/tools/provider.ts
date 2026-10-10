/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * OpenAI-compatible tool definitions derived from the 3b zod schemas.
 * The server sends these to every provider so the model can request Atlas
 * data; the client executes the calls in the 3c loop. Serialized once at
 * module load: the schemas are static, so the JSON Schema never rebuilds.
 */

import { z } from 'zod';
import {
  TOOL_DESCRIPTIONS,
  decodePostcodeSchema,
  getAreasSchema,
  getDistrictsSchema,
  getLgasSchema,
  getNearbySchema,
  getPostcodeSchema,
  getStateSchema,
  getStatesSchema,
  navigateMapSchema,
  searchLocationSchema,
} from './schemas.js';
import { TOOL_NAMES, type ToolName } from './types.js';

export interface ProviderToolFunction {
  name: ToolName;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ProviderTool {
  type: 'function';
  function: ProviderToolFunction;
}

const SCHEMAS: Record<ToolName, z.ZodType> = {
  searchLocation: searchLocationSchema,
  getState: getStateSchema,
  getStates: getStatesSchema,
  getLgas: getLgasSchema,
  getDistricts: getDistrictsSchema,
  getAreas: getAreasSchema,
  getPostcode: getPostcodeSchema,
  decodePostcode: decodePostcodeSchema,
  getNearby: getNearbySchema,
  navigateMap: navigateMapSchema,
};

function buildProviderTools(): ProviderTool[] {
  return TOOL_NAMES.map((name) => ({
    type: 'function',
    function: {
      name,
      description: TOOL_DESCRIPTIONS[name],
      parameters: z.toJSONSchema(SCHEMAS[name]) as Record<string, unknown>,
    },
  }));
}

export function toProviderTools(): ProviderTool[] {
  return buildProviderTools();
}

/** Memoized once at module load; the schemas never change at runtime. */
export const ATLAS_PROVIDER_TOOLS: ProviderTool[] = toProviderTools();