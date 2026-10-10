/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Refusal detection (N-ATLAS reliability).
 *
 * N-ATLAS sometimes answers an in-scope question with a bare refusal instead of
 * calling a tool. Refusals must never be cached: a single stochastic refusal
 * served from cache would make a working question look broken for the whole
 * TTL. They are also the trigger for one extra sampling attempt.
 */
const REFUSAL_PATTERN =
  /\b(?:can'?t|cannot|can not|unable to|not able to|could ?n'?t|could not|failed to)\s+(?:help|assist|answer|find|locate|provide)\b/i;

/** True for an empty reply or a refusal to help. */
export function isRefusalText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length === 0 || REFUSAL_PATTERN.test(trimmed);
}
