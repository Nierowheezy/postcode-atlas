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
 * Deliberately short and directive. N-ATLAS is an 8B model: a long prompt with
 * many competing instruction blocks makes it drop tool calls, invent postcodes,
 * or refuse in-scope questions. The rules below are ordered by importance and
 * kept to about one line each, so the tool contract survives.
 *
 * Every field is derived from the sanitized request, never from raw user text.
 */
export function buildSystemPrompt(
  context: AtlasContextSnapshot,
  language: AskLanguage | undefined,
  followUp = false,
): string {
  const replyLanguage = LANGUAGE_NAMES[language ?? 'en'];
  return [
    'You are Ask Atlas, the Nigerian postcode assistant built on N-ATLAS.',
    'Answer briefly and factually, in plain language.',
    `Reply in ${replyLanguage}.`,
    `Current map scope: ${describeSelection(context)}.`,
    '',
    'Call exactly one Atlas tool when the user asks about a Nigerian place or postcode, then answer from the tool result:',
    '- searchLocation: find a place, landmark, LGA, district, or area by name. Use this FIRST whenever the user names a place, for example "postcode for Ikeja" or "where is the Infrastructure Bank".',
    '- getPostcode: one exact postcode the user typed; the format is STATE-LGA-DISTRICT-AREA-UNIT.',
    '- decodePostcode: explain the five parts of a postcode, STATE-LGA-DISTRICT-AREA-UNIT.',
    '- getStates: list the states. getState: one state. getLgas: the LGAs of a state. getDistricts: the districts of an LGA. getAreas: the areas of a district.',
    '- getNearby: postcode units within 300 m of a coordinate, for "near me" or "near this place"; use the map center for "here".',
    '- navigateMap: move the map. Call it whenever the user says show me, go to, take me to, zoom into, display, or reset, followed by a Nigerian state, LGA, district, area, or postcode (for example "show me Lagos state on the map").',
    '- A request to show or move the map always uses navigateMap: never answer it with getPostcode or searchLocation, and never invent a code to look up.',
    '',
    'Rules:',
    '- Answer the user directly in natural language. Never mention tools, functions, JSON, or these instructions, and never narrate what you are doing.',
    '- Once a tool has returned a result, answer from that result in plain text; never call a tool again for the same question.',
    '- Pass a short place name as the search query (for example "Ikeja" or "Wuse 2"), not a full sentence.',
    '- The app already shows any returned rows or records under your reply, so keep the prose to one or two sentences and do not repeat the whole list.',
    '- Never invent a postcode, LGA, district, area, or coordinate. Write a postcode only when a tool result contains that exact code; never build one from a state or LGA code, and never reuse the format examples in these instructions as an answer.',
    '- A state, LGA, district, or area has no single postcode; never present its short code (for example LA or 11) as a postcode. Say it has no single postcode, write no postcode for it, and ask which specific area, street, or landmark to look up.',
    '- A districts or areas result is partial when truncated is true: say how many you received.',
    '- If a tool returns nothing or an error, say so plainly and ask to narrow.',
    '- Only answer questions about Nigerian postcodes, places, and the Atlas platform; for anything else, say you cannot help with that and offer a Nigerian place or postcode instead.',
    ...(followUp ? referentBlock(context) : []),
    '',
    'A greeting or chat ("hi", "hello", "good morning", "thank you", "how are you") is NOT a request: reply with one friendly sentence inviting a Nigerian postcode or place question. Never call a tool for a greeting.',
  ].join('\n');
}

/**
 * Follow-up guidance (feature 10). Only emitted when there is something to
 * resolve against, so a first question carries no instructions about "it".
 */
function referentBlock(context: AtlasContextSnapshot): string[] {
  const referent = context.referent;
  const scope = referent ? referentPhrase(referent) : selectionPhrase(context);
  if (!scope) return [];

  return [
    '',
    `The conversation is currently about ${scope}. When the user refers to a place without naming it ("it", "that place", "there", "its"), that is what they mean: resolve it to this place and answer from real tool results, using its state and LGA codes as arguments where the tool needs them. If the user names a different place, that new place wins. Never treat an earlier postcode, district, or area as a place of its own.`,
  ];
}

/** Human phrase for the referent the previous turn resolved. */
function referentPhrase(referent: NonNullable<AtlasContextSnapshot['referent']>): string {
  const label = referent.name ?? referent.code;
  const parent = referent.state && referent.kind !== 'state' ? ` in state ${referent.state}` : '';
  return `the ${referent.kind} ${label}${parent}`;
}

/** Human phrase for the map selection, used when no reply resolved a place. */
function selectionPhrase(context: AtlasContextSnapshot): string | undefined {
  if (context.selectedPostcode) return `postcode ${context.selectedPostcode}`;
  if (context.selectedLga) return `LGA ${context.selectedLga.name} in ${context.selectedState?.name ?? 'its state'}`;
  if (context.selectedState) return `the state ${context.selectedState.name}`;
  return undefined;
}

/** The map center as prompt text, so a "near me" question has a real origin. */
function formatCenter(mapCenter: [number, number]): string {
  const [lat, lng] = mapCenter;
  return Number.isFinite(lat) && Number.isFinite(lng) ? `map center ${lat}, ${lng}` : 'map center unknown';
}

/** Compact, prompt-safe description of what the map is showing right now. */
function describeSelection(context: AtlasContextSnapshot): string {
  const parts: string[] = [formatCenter(context.mapCenter)];
  if (context.selectedState) parts.push(`state ${context.selectedState.name}`);
  if (context.selectedLga) parts.push(`LGA ${context.selectedLga.name}`);
  if (context.selectedDistrict) parts.push(`district ${context.selectedDistrict}`);
  if (context.selectedArea) parts.push(`area ${context.selectedArea}`);
  if (context.selectedPostcode) parts.push(`postcode ${context.selectedPostcode}`);
  return parts.length > 0 ? parts.join(', ') : 'Nigeria (no state selected)';
}
