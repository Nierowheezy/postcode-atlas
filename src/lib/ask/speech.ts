/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Speech helper utilities for the Ask Atlas voice input feature. All helpers
 * are pure and side-effect free.
 */

import type { LanguageMode } from './types';

/**
 * Convert the Ask Atlas language mode to a BCP-47 tag for the Web Speech API.
 */
export function speechLanguageTag(mode: LanguageMode): string {
  switch (mode) {
    case 'yo':
      return 'yo-NG';
    case 'ha':
      return 'ha-NG';
    case 'ig':
      return 'ig-NG';
    case 'en':
    case 'auto':
      return 'en-NG';
    default:
      return 'en-NG';
  }
}

/**
 * Feature-detect whether the Web Speech API is available. Supports both the
 * standard and WebKit-prefixed constructors.
 */
export function hasSpeechRecognition(
  win: Pick<Window, 'SpeechRecognition'> & { webkitSpeechRecognition?: unknown }
): boolean {
  if (typeof win.SpeechRecognition === 'function') {
    return true;
  }
  if (typeof win.webkitSpeechRecognition === 'function') {
    return true;
  }
  return false;
}

/**
 * Join the text the composer held when dictation started with the recognition
 * output. Used for both the live preview and the confirm commit, so the two
 * cannot disagree. A single separating space is added only where the base does
 * not already end in whitespace, so a base of "What is " reads naturally as
 * "What is Ikeja" rather than collapsing or doubling the space.
 */
export function composeDictation(base: string, transcript: string, interim: string): string {
  const dictation = `${transcript}${interim}`.trim();
  if (!dictation) {
    return base;
  }
  if (!base) {
    return dictation;
  }
  return /\s$/.test(base) ? `${base}${dictation}` : `${base} ${dictation}`;
}