/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Follow-up detection (feature 10, N-ATLAS reliability).
 *
 * The conversation `referent` is injected into the system prompt so a message
 * like "what are its LGAs?" can resolve without the user naming the place. But
 * the referent must only be offered when the message actually leans on it: a
 * self-contained question that names its own place ("postcode for Ikeja") must
 * not see a stale referent, or N-ATLAS folds the old place or postcode into the
 * new answer (it has answered "postcode for Ikeja" with the previous turn's
 * postcode). Detection is a conservative pronoun/ellipsis match, so a named
 * place always wins.
 */
const FOLLOW_UP =
  /\b(it|its|it's|itself|they|them|their|theirs|those|these|this|that|the same|what about|how about)\b/i;

/** True when the message likely refers to a place named in an earlier turn. */
export function isFollowUp(text: string): boolean {
  return FOLLOW_UP.test(text);
}
