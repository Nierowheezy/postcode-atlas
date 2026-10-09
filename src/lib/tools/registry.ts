/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tool registry and dispatcher for the Atlas tool layer (feature 3b).
 * `runTool` is the single validation boundary: 3c passes raw model arguments
 * here, and this returns a typed `ToolExecutionResult` without ever throwing.
 */

import {
  decodePostcode,
  getAreas,
  getDistricts,
  getLgas,
  getNearby,
  getPostcode,
  getState,
  getStates,
  navigateMap,
  searchLocation,
} from './executors';
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
} from './schemas';
import {
  ToolFault,
  type RegisteredTool,
  type ToolDefinition,
  type ToolExecutionResult,
  type ToolName,
} from './types';

/** Erase the typed authoring shape into the uniform registry shape. */
function register<Args, Data>(definition: ToolDefinition<Args, Data>): RegisteredTool {
  return {
    name: definition.name,
    description: definition.description,
    schema: definition.schema,
    // Safe: runTool validates raw args against `schema` before calling execute.
    execute: (args) => definition.execute(args as Args),
  };
}

export const TOOL_REGISTRY: Record<ToolName, RegisteredTool> = {
  searchLocation: register({
    name: 'searchLocation',
    description: TOOL_DESCRIPTIONS.searchLocation,
    schema: searchLocationSchema,
    execute: searchLocation,
  }),
  getState: register({
    name: 'getState',
    description: TOOL_DESCRIPTIONS.getState,
    schema: getStateSchema,
    execute: getState,
  }),
  getStates: register({
    name: 'getStates',
    description: TOOL_DESCRIPTIONS.getStates,
    schema: getStatesSchema,
    execute: getStates,
  }),
  getLgas: register({
    name: 'getLgas',
    description: TOOL_DESCRIPTIONS.getLgas,
    schema: getLgasSchema,
    execute: getLgas,
  }),
  getDistricts: register({
    name: 'getDistricts',
    description: TOOL_DESCRIPTIONS.getDistricts,
    schema: getDistrictsSchema,
    execute: getDistricts,
  }),
  getAreas: register({
    name: 'getAreas',
    description: TOOL_DESCRIPTIONS.getAreas,
    schema: getAreasSchema,
    execute: getAreas,
  }),
  getPostcode: register({
    name: 'getPostcode',
    description: TOOL_DESCRIPTIONS.getPostcode,
    schema: getPostcodeSchema,
    execute: getPostcode,
  }),
  decodePostcode: register({
    name: 'decodePostcode',
    description: TOOL_DESCRIPTIONS.decodePostcode,
    schema: decodePostcodeSchema,
    execute: decodePostcode,
  }),
  getNearby: register({
    name: 'getNearby',
    description: TOOL_DESCRIPTIONS.getNearby,
    schema: getNearbySchema,
    execute: getNearby,
  }),
  navigateMap: register({
    name: 'navigateMap',
    description: TOOL_DESCRIPTIONS.navigateMap,
    schema: navigateMapSchema,
    execute: navigateMap,
  }),
};

export async function runTool(
  name: string,
  rawArgs: unknown,
): Promise<ToolExecutionResult<unknown>> {
  const tool = (TOOL_REGISTRY as Record<string, RegisteredTool | undefined>)[name];
  if (!tool) {
    return { ok: false, error: { code: 'unknown_tool', message: `Unknown tool "${name}".` } };
  }

  const parsed = tool.schema.safeParse(rawArgs);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'invalid_args',
        message: `Invalid arguments for "${name}".`,
        issues: parsed.error.issues.map(
          (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
        ),
      },
    };
  }

  try {
    const data = await tool.execute(parsed.data);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ToolFault) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    return {
      ok: false,
      error: {
        code: 'internal_error',
        message: error instanceof Error ? error.message : `Tool "${name}" failed.`,
      },
    };
  }
}
