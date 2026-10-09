/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Argument schemas for the Atlas tool layer. These are the single source of
 * truth for both runtime validation and the provider `tools` JSON Schema that
 * 3c sends through `z.toJSONSchema`.
 */

import { z } from 'zod';
import type { ToolName } from './types';

export const searchLocationSchema = z.object({
  query: z.string().trim().min(1).max(120),
});
export type SearchLocationArgs = z.infer<typeof searchLocationSchema>;

export const getStateSchema = z.object({
  state: z.string().trim().min(1).max(60),
});
export type GetStateArgs = z.infer<typeof getStateSchema>;

/** No arguments: lists the full state catalogue. */
export const getStatesSchema = z.object({});
export type GetStatesArgs = z.infer<typeof getStatesSchema>;

export const getLgasSchema = z.object({
  state: z.string().trim().min(1).max(60),
});
export type GetLgasArgs = z.infer<typeof getLgasSchema>;

export const getDistrictsSchema = z.object({
  state: z.string().trim().min(1).max(60),
  lga: z.string().trim().min(1).max(20),
});
export type GetDistrictsArgs = z.infer<typeof getDistrictsSchema>;

export const getAreasSchema = z.object({
  state: z.string().trim().min(1).max(60),
  lga: z.string().trim().min(1).max(20),
  district: z.string().trim().min(1).max(20),
});
export type GetAreasArgs = z.infer<typeof getAreasSchema>;

export const getPostcodeSchema = z.object({
  code: z.string().trim().min(1).max(40),
});
export type GetPostcodeArgs = z.infer<typeof getPostcodeSchema>;

export const decodePostcodeSchema = z.object({
  code: z.string().trim().min(1).max(40),
});
export type DecodePostcodeArgs = z.infer<typeof decodePostcodeSchema>;

export const getNearbySchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  radius: z.number().finite().positive().optional(),
});
export type GetNearbyArgs = z.infer<typeof getNearbySchema>;

/**
 * Exactly one map target per request. The union rejects a partial or
 * conflicting request at validation time, so a malformed call never reaches
 * the executor.
 */
export const navigateMapSchema = z.discriminatedUnion('target', [
  z.strictObject({ target: z.literal('state'), state: z.string().trim().min(1).max(60) }),
  z.strictObject({
    target: z.literal('lga'),
    state: z.string().trim().min(1).max(60),
    lga: z.string().trim().min(1).max(80),
  }),
  z.strictObject({ target: z.literal('postcode'), code: z.string().trim().min(1).max(40) }),
  z.strictObject({ target: z.literal('reset') }),
]);
export type NavigateMapArgs = z.infer<typeof navigateMapSchema>;

export const TOOL_DESCRIPTIONS = {
  searchLocation: 'Find Nigerian states, LGAs, districts, areas, and landmark postcodes by name or code.',
  getState: 'Get one Nigerian state with its capital, geopolitical zone, center, and LGA count.',
  getStates: 'List all Nigerian states with their 2-letter codes.',
  getLgas: 'List the LGAs of a Nigerian state, given the state 2-letter code.',
  getDistricts: 'List the postal districts of a state and LGA.',
  getAreas: 'List the postal areas of a district.',
  getPostcode: 'Look up a full Nigerian postcode and return its location detail.',
  decodePostcode: 'Decode a Nigerian postcode into its state, LGA, district, area, and unit segments.',
  getNearby: 'List postcode units within 300 metres of a coordinate.',
  navigateMap:
    'Move the map to a Nigerian place: a state, an LGA, a full postcode, or back to the national view.',
} as const satisfies Record<ToolName, string>;
