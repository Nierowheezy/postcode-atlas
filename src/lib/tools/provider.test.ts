/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import { ATLAS_PROVIDER_TOOLS, toProviderTools } from './provider';
import { TOOL_REGISTRY } from './registry';
import { TOOL_DESCRIPTIONS } from './schemas';
import { TOOL_NAMES } from './types';

/**
 * The provider surface is what the model is allowed to call, so three lists
 * have to name the same tools: `TOOL_NAMES` (the contract), `TOOL_REGISTRY`
 * (what actually runs), and `ATLAS_PROVIDER_TOOLS` (what the model sees). A
 * tool added to one list and forgotten in another is a silent gap: the model
 * cannot call it, or the call fails as `unknown_tool`. These assertions are
 * that no-drift check.
 */
const REQUIRED_ARGS: Record<string, string[]> = {
  searchLocation: ['query'],
  getState: ['state'],
  getLgas: ['state'],
  getDistricts: ['state', 'lga'],
  getAreas: ['state', 'lga', 'district'],
  getPostcode: ['code'],
  decodePostcode: ['code'],
  getNearby: ['lat', 'lng'],
  interpretAddress: ['text'],
  explainAtlas: ['topic'],
};

const providerNames = ATLAS_PROVIDER_TOOLS.map((tool) => tool.function.name);

describe('provider tool surface', () => {
  it('lists the twelve tools once each', () => {
    expect(TOOL_NAMES.length).toBe(12);
    expect(providerNames.length).toBe(12);
    expect(new Set(providerNames).size).toBe(12);
  });

  it('names the same tools as TOOL_NAMES and the registry', () => {
    expect([...providerNames].sort()).toEqual([...TOOL_NAMES].sort());
    expect(Object.keys(TOOL_REGISTRY).sort()).toEqual([...TOOL_NAMES].sort());
  });

  it('describes every tool and serializes every schema', () => {
    for (const tool of ATLAS_PROVIDER_TOOLS) {
      expect(tool.type).toBe('function');
      expect(tool.function.description).toBe(TOOL_DESCRIPTIONS[tool.function.name]);
      expect(tool.function.description.trim().length).toBeGreaterThan(0);
      expect(typeof tool.function.parameters).toBe('object');
      expect(() => JSON.stringify(tool.function.parameters)).not.toThrow();
    }
  });

  it('exposes the required argument for every tool that has one', () => {
    for (const [name, keys] of Object.entries(REQUIRED_ARGS)) {
      const tool = ATLAS_PROVIDER_TOOLS.find((candidate) => candidate.function.name === name);
      expect(tool, `${name} should be offered to the model`).toBeDefined();
      const parameters = tool?.function.parameters as { required?: string[] };
      expect(parameters.required, `${name} required`).toEqual(expect.arrayContaining(keys));
    }
  });

  it('asks for no arguments for getStates', () => {
    const tool = ATLAS_PROVIDER_TOOLS.find((candidate) => candidate.function.name === 'getStates');
    const parameters = tool?.function.parameters as { required?: string[]; type?: string };
    expect(parameters.type).toBe('object');
    expect(parameters.required).toBeUndefined();
  });

  it('keeps navigateMap a four-variant union', () => {
    const tool = ATLAS_PROVIDER_TOOLS.find((candidate) => candidate.function.name === 'navigateMap');
    const parameters = tool?.function.parameters as {
      oneOf?: Array<{ required: string[]; properties: { target: { const: string } } }>;
    };
    expect(parameters.oneOf).toHaveLength(4);
    expect(parameters.oneOf?.map((variant) => variant.properties.target.const).sort()).toEqual([
      'lga',
      'postcode',
      'reset',
      'state',
    ]);
    for (const variant of parameters.oneOf ?? []) {
      expect(variant.required).toContain('target');
    }
  });

  it('rebuilds a fresh, equivalent list on demand', () => {
    const fresh = toProviderTools();
    expect(fresh).not.toBe(ATLAS_PROVIDER_TOOLS);
    expect(fresh.map((tool) => tool.function.name)).toEqual(providerNames);
  });
});
