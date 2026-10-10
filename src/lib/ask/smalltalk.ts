/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Small-talk detection (N-ATLAS reliability).
 *
 * N-ATLAS maps a bare greeting to the only no-argument tool it has
 * (`navigateMap` with target `reset`), which resets the map and marks the reply
 * as grounded. The handler sends small talk to the model WITHOUT the tools
 * payload, so it can only chat. Detection is an exact match after
 * normalization, so any message that also names a place, a postcode, or a map
 * action still reaches the tools.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[!?.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PHRASES = new Set([
  'hi', 'hii', 'hiii', 'hey', 'heyy', 'hello', 'helloo', 'hi there', 'hello there', 'hey there',
  'good morning', 'good afternoon', 'good evening', 'good day', 'morning', 'afternoon', 'evening',
  'thanks', 'thank you', 'thankyou', 'thank you very much', 'thanks a lot', 'cheers', 'cheerio',
  'bye', 'goodbye', 'see you', 'see ya', 'later', 'how are you', 'how are you doing',
  'how is it going', "how's it going", 'hows it going', "what's up", 'whats up', 'sup', 'yo',
  'ok', 'okay', 'alright', 'greetings', 'how far', 'how you dey', 'how body', 'wetin dey',
  'hi how are you', 'hello how are you', 'hey how are you',
]);

/** True when the whole message is a greeting, thanks, or other small talk. */
export function isSmallTalk(text: string): boolean {
  return PHRASES.has(normalize(text));
}
