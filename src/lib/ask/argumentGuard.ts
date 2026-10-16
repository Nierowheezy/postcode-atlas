/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Argument grounding for the Ask Atlas tool loop (N-ATLAS reliability).
 *
 * The responder prompt no longer offers a stale place, but the model can still
 * invent one: after a turn about an address, it has called `interpretAddress`
 * with the previous turn's text while answering an unrelated question, and the
 * reply came back about that place. `runTool` validates an argument's shape
 * against its schema, never whether the user actually said it, so the call runs.
 *
 * A tool call is rejected when the message neither leans on earlier state (an
 * anaphoric follow-up or a spatial question) nor contains the argument. Only the
 * two tools whose argument is, by contract, a quote from the message are
 * guarded: `interpretAddress.text` ("a pasted address") and `searchLocation.query`
 * ("a place name"). Every other tool takes a code, a coordinate, or an enum that
 * a legitimate call fills from a prior tool result or the dataset, where a text
 * test would reject a valid call such as `getLgas({"state":"KN"})` for
 * "List the LGAs in Kano".
 */

import { isFollowUp, isSpatialQuestion } from './followup';

/** Tool name to the argument the user's message must contain. */
const GUARDED_TOOL_ARG: Readonly<Record<string, string>> = {
  interpretAddress: 'text',
  searchLocation: 'query',
};

/** Fold case and diacritics so "Ikeja", "ikeja" and a tone-marked spelling agree. */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function words(folded: string): string[] {
  return folded.split(/[^a-z0-9]+/).filter(Boolean);
}

const isNumeric = (token: string): boolean => /^[0-9]+$/.test(token);

/** Two tokens name the same thing: equal, or one is a light misspelling of the other. */
function sameToken(a: string, b: string): boolean {
  if (a === b) return a.length >= 3 || isNumeric(a);
  if (!/^[a-z]+$/.test(a) || !/^[a-z]+$/.test(b)) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return shorter.length >= 4 && longer.startsWith(shorter);
}

/** True when `arg` shares a word (or an address number) with `text`. */
export function isGroundedInText(arg: string, text: string): boolean {
  const inText = words(fold(text));
  for (const token of words(fold(arg))) {
    if (inText.some((candidate) => sameToken(token, candidate))) return true;
  }
  return false;
}

/**
 * The offending argument when `name` is guarded and `args` does not quote it from
 * `text`, otherwise undefined. A follow-up or spatial message is never guarded:
 * it resolves from the referent or the map selection, not from its own words.
 */
export function findUngroundedArg(name: string, args: unknown, text: string): string | undefined {
  const key = GUARDED_TOOL_ARG[name];
  if (!key) return undefined;
  if (isFollowUp(text) || isSpatialQuestion(text)) return undefined;
  const value = typeof args === 'object' && args !== null
    ? (args as Record<string, unknown>)[key]
    : undefined;
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  return isGroundedInText(value, text) ? undefined : value;
}
