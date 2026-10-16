/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Curated explanations of Nigeria's digital addressing system (feature 19).
 *
 * These are editorial copy, not NIPOST records, so they live in code and never
 * come from the model's memory. The wording mirrors the authoritative NDAPS
 * reference already shipped in `src/components/story/DatasetStoryModal.tsx`;
 * if that modal is edited, update these to match.
 */

import type { AtlasExplanation, ExplainTopic } from '../tools/types.js';

export const EXPLANATION_CONTENT: Record<ExplainTopic, AtlasExplanation> = {
  hierarchy: {
    topic: 'hierarchy',
    title: "How Nigeria's digital addressing hierarchy works",
    summary:
      'A Nigerian digital address is built from the map down: state, then LGA, then district, then area, then the individual building or unit.',
    points: [
      'State is the top level, written as a 2-letter code such as LA for Lagos.',
      'LGA (Local Government Area) is the next level, written as a 2-digit code.',
      'District and area narrow the LGA into smaller postal zones.',
      'Unit marks one addressable building or point, so the full code names a single place.',
      'The five levels join into an 11-character postcode such as LA-11-A12-AK-08.',
    ],
  },
  postcode_parts: {
    topic: 'postcode_parts',
    title: 'What each part of a postcode means',
    summary:
      'NDAPS writes a postcode as five dashed groups, from the broadest zone down to the single building. The template is AA-99-H77-BB-55.',
    points: [
      'State: 2 letters, for example LA for Lagos.',
      'LGA: 2 digits.',
      'District: 3 characters, a letter and 2 digits, for example A12.',
      'Area: 2 letters.',
      'Unit: 2 digits, identifying one addressable building or point.',
      'The same code can be written compact, as 11 characters with the dashes removed.',
    ],
    // The NDAPS anatomy example from the authoritative modal, so the card and
    // the reference agree on the worked code.
    example: 'LA-11-A12-AK-08',
  },
  single_postcode: {
    topic: 'single_postcode',
    title: 'Why a state or LGA has no single postcode',
    summary:
      'Postcodes are assigned to individual buildings and points, so an administrative area is described by many postcodes, not one.',
    points: [
      'A state, LGA, district, or area covers thousands of buildings, and each building has its own unit code.',
      'The short code you see for an LGA, such as 11, is a level in the hierarchy, not a postcode.',
      'To get a real postcode, name a specific area, street, or landmark.',
      'A landmark search returns the verified reference postcode for that landmark.',
    ],
  },
  ndaps: {
    topic: 'ndaps',
    title: 'What NDAPS is',
    summary:
      "NDAPS is the National Digital Alphanumeric Postcode System, NIPOST's national addressing standard for Nigeria.",
    points: [
      'It assigns an 11-character alphanumeric digital address to every addressable building in the country.',
      'It is GIS-located: each building is tied to precise coordinates for address identity and postal routing.',
      'NIPOST documents NDAPS as an authoritative identity layer for addresses, leaving turn-by-turn navigation to mapping platforms.',
      'This Atlas reads live NIPOST NDAPS data, so the postcodes you see here come from that registry.',
    ],
  },
};

/**
 * The curated explanation for a topic, or undefined for an unknown one. The
 * executor only passes schema-validated values, so the undefined branch exists
 * for direct callers and tests rather than the model.
 */
export function getExplanation(topic: string): AtlasExplanation | undefined {
  return (EXPLANATION_CONTENT as Record<string, AtlasExplanation | undefined>)[topic];
}
