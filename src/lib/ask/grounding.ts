/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Reply grounding labels (feature 9) and what each claims in the bubble
 * footer. Moved out of `AskAtlasMessageBubble` so the decision is pure and
 * unit-testable.
 *
 * A reply is only labelled verified when it carries a payload the app itself
 * derived from an executed tool result; "a tool ran somewhere" is a weaker
 * claim and gets its own label. Map moves show no postcode data, so they are
 * labelled for what they are rather than claiming postcode verification.
 *
 * Pure chat turns (greetings, thanks, "ok" - anything `isSmallTalk` matches
 * exactly, which the server sends to the model without tools) get no
 * data-grounding line at all: "Not verified against NIPOST data" reads like a
 * warning on a reply that never claimed to be data. The renderer omits the
 * footer for `'chat'` while keeping the engine and model attribution lines.
 */

import type { AskAtlasMessage } from './types';
import { isSmallTalk } from './smalltalk';

export type GroundingBasis = 'payload' | 'map' | 'tools' | 'chat' | 'none';

/**
 * What the grounding footer may claim. A reply is only labelled verified when
 * it carries a payload the app itself derived from an executed tool result;
 * the 3c `grounding` flag is only a fallback for a payload-less reply (it can
 * disagree with a payload on a cached reply, or a provider that answered from
 * memory after a tool ran).
 */
export function groundingBasis(message: AskAtlasMessage): GroundingBasis {
  // A payload is derived client-side from an executed tool result, so it
  // carries its own proof. An empty nearby search verifies nothing: the tool
  // ran and found zero units, so it falls through to the tool-results label
  // (or the unverified line) instead of claiming a verified payload.
  if (
    message.lookup ||
    message.results ||
    message.decoded ||
    (message.nearby && message.nearby.items.length > 0)
  )
    return 'payload';
  // A map move shows no postcode data, so it is labelled for what it is rather
  // than claiming postcode verification.
  if (message.mapAction) return 'map';
  // A turn that was exactly small talk is chat, not a data claim. The renderer
  // omits the grounding line entirely for it.
  if (message.question && isSmallTalk(message.question)) return 'chat';
  return message.grounding === 'atlas' ? 'tools' : 'none';
}

/** Footer text per basis; `'chat'` renders no data-grounding line at all. */
export const GROUNDING_FOOTER: Record<Exclude<GroundingBasis, 'chat'>, string> = {
  payload: 'Verified against NIPOST postcode data',
  map: 'Map moved using NIPOST location data',
  tools: 'Answered from NIPOST tool results',
  none: 'Not verified against NIPOST data',
};