/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Editorial explanation content for the developer API (feature 21d).
 *
 * The copy itself is the curated feature 19 content in
 * `src/lib/explain/topics.ts`; this module only shapes it for the public API and
 * labels its provenance. It is editorial Atlas prose, not a NIPOST record, so
 * every payload carries `source: 'editorial'` - the counterpart of the postcode
 * record's `source: 'nipost-ndaps'`.
 */

import { EXPLANATION_CONTENT, getExplanation } from '../../lib/explain/topics';
import { EXPLAIN_TOPICS, type AtlasExplanation, type ExplainTopic } from '../../lib/tools/types';

/**
 * Provenance for editorial Atlas copy. The record routes use
 * `source: 'nipost-ndaps'`; this is the machine-readable "not NIPOST data" label.
 */
export const EDITORIAL_SOURCE = 'editorial';

/**
 * One row of the explanation index. Mirrors the reference-list shape
 * (`{ code, name }`), so an integrator can discover topics before reading one.
 * Load-bearing for feature 22 - keep the field names and meanings stable.
 */
export interface AtlasExplanationSummary {
  topic: ExplainTopic;
  title: string;
  source: typeof EDITORIAL_SOURCE;
}

/**
 * One full explanation: the feature 19 `AtlasExplanation` fields plus
 * provenance. Load-bearing for feature 22 - keep the fields stable.
 */
export interface AtlasExplanationDetail extends AtlasExplanation {
  source: typeof EDITORIAL_SOURCE;
}

/**
 * The topic index: one labelled row per declared topic, in declaration order.
 * `EXPLANATION_CONTENT` is exhaustive over `EXPLAIN_TOPICS`, so every row has a
 * title.
 */
export function listExplanations(): AtlasExplanationSummary[] {
  return EXPLAIN_TOPICS.map((topic) => ({
    topic,
    title: EXPLANATION_CONTENT[topic].title,
    source: EDITORIAL_SOURCE,
  }));
}

/**
 * The full explanation for a topic, or `null` for an unknown or blank one. The
 * topic is trimmed and lowercased, so `Hierarchy` and a padded slug resolve. The
 * result is a copy, including its `points` array, so the shared
 * `EXPLANATION_CONTENT` entry is never mutated.
 */
export function readExplanation(topic: string): AtlasExplanationDetail | null {
  const explanation = getExplanation(topic.trim().toLowerCase());
  if (!explanation) return null;

  return {
    ...explanation,
    points: [...explanation.points],
    source: EDITORIAL_SOURCE,
  };
}
