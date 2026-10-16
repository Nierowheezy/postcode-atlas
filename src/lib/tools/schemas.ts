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
import { EXPLAIN_TOPICS, type ToolName } from './types.js';

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

/**
 * One pasted address. Longer than a search query because an address is a
 * whole line, but still bounded so a runaway paste cannot inflate the loop.
 */
export const interpretAddressSchema = z.object({
  text: z.string().trim().min(1).max(300),
});
export type InterpretAddressArgs = z.infer<typeof interpretAddressSchema>;

/**
 * One curated explanation topic. The enum is the whole argument: the model
 * picks a topic and the executor returns the matching curated copy.
 */
export const explainAtlasSchema = z.object({
  topic: z.enum(EXPLAIN_TOPICS),
});
export type ExplainAtlasArgs = z.infer<typeof explainAtlasSchema>;

export const TOOL_DESCRIPTIONS = {
  searchLocation: 'Find Nigerian states, LGAs, districts, areas, and landmark postcodes by name or code.',
  getState: 'Get one Nigerian state with its capital, geopolitical zone, center, and LGA count.',
  getStates: 'List all Nigerian states with their 2-letter codes.',
  getLgas: 'List the LGAs of a Nigerian state, given the state 2-letter code.',
  getDistricts: 'List the postal districts of a state and LGA. Returns items, total, and truncated: a truncated true means more districts exist than were returned.',
  getAreas: 'List the postal areas of a district. Returns items, total, and truncated: a truncated true means more areas exist than were returned.',
  getPostcode: 'Look up a full Nigerian postcode and return its location detail.',
  decodePostcode: 'Decode a Nigerian postcode into its state, LGA, district, area, and unit segments.',
  getNearby: 'List postcode units within 300 metres of a coordinate.',
  navigateMap:
    'Move the map to a Nigerian place: a state, an LGA, a full postcode, or back to the national view.',
  interpretAddress:
    'Resolve a pasted Nigerian address into its state, LGA, district, area, and postcode where the dataset supports it, and report the parts it could not place. Never states a code the data did not return.',
  explainAtlas:
    "Explain how Nigeria's digital addressing and postcode system works. Topics: hierarchy (the five levels), postcode_parts (what each segment means), single_postcode (why an area has no single postcode), ndaps (what the NDAPS system is).",
} as const satisfies Record<ToolName, string>;
