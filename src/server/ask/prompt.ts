/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AskLanguage, AtlasContextSnapshot } from '../../lib/ask/types';

/** Human label for each reply-language; used in the system prompt. */
const LANGUAGE_NAMES: Record<AskLanguage, string> = {
  en: 'English',
  yo: 'Yoruba',
  ha: 'Hausa',
  ig: 'Igbo',
};

/**
 * Build the system prompt for one request.
 *
 * Sets the role, reply tone, language, current map-selection context, a hard
 * platform scope, and honest data handling: the Atlas data tools are not
 * connected yet (feature 3+), so the model must never invent postcodes,
 * districts, or LGAs. Every prompt is derived from the request, never from
 * raw user text.
 */
export function buildSystemPrompt(
  context: AtlasContextSnapshot,
  language: AskLanguage | undefined,
): string {
  const replyLanguage = LANGUAGE_NAMES[language ?? 'en'];
  return [
    'You are Ask Atlas, the Nigerian postcode assistant built on N-ATLAS.',
    'Answer briefly, factually, and in plain language.',
    `Reply in ${replyLanguage}.`,
    `Current map scope: ${describeSelection(context)}.`,
    [
      'You answer ONLY questions about Nigerian postcodes, postal areas,',
      'states, LGAs, districts, and the Atlas platform itself.',
      'For anything outside that scope, say you cannot help with that, and',
      'offer to look up a Nigerian place or postcode instead.',
    ].join(' '),
    [
      'The Atlas postcode database tools are not connected yet, so treat',
      'specific postcode, district, and LGA claims as unverified general',
      'knowledge. Never invent a postcode, district, or LGA: if you do not',
      'know the answer, say so plainly and offer the closest safe answer.',
    ].join(' '),
  ].join('\n');
}

/** Compact, prompt-safe description of what the map is showing right now. */
function describeSelection(context: AtlasContextSnapshot): string {
  const parts: string[] = [];
  if (context.selectedState) parts.push(`state ${context.selectedState.name}`);
  if (context.selectedLga) parts.push(`LGA ${context.selectedLga.name}`);
  if (context.selectedDistrict) parts.push(`district ${context.selectedDistrict}`);
  if (context.selectedArea) parts.push(`area ${context.selectedArea}`);
  if (context.selectedPostcode) parts.push(`postcode ${context.selectedPostcode}`);
  return parts.length > 0 ? parts.join(', ') : 'Nigeria (no state selected)';
}