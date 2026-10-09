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
 * platform scope, and honest data handling: the Atlas tools are connected
 * (feature 3c), so the model should call them for real data and never invent
 * postcodes, districts, or LGAs. Every prompt is derived from the request,
 * never from raw user text.
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
      'You have the Atlas tools: searchLocation (find a place by name),',
      'getState, getLgas, getDistricts, and getAreas (postal hierarchy),',
      'getPostcode (one full postcode), decodePostcode (explain a postcode),',
      'and getNearby (units near a coordinate). Call the matching tool when',
      'the question asks for a real postcode, place, district, LGA, or area,',
      'and answer from its result. If a place name is ambiguous, call',
      'searchLocation first. Never invent a postcode, district, or LGA: if a',
      'tool returns no match or an error, say plainly what you found and ask',
      'to narrow it down. If you answer without calling a tool, keep it to',
      'clearly general knowledge and say it is unverified.',
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