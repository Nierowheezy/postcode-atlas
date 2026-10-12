/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Language detection for Ask Atlas (feature 18).
 *
 * N-ATLAS answers in the language the user wrote, but the model has no reliable
 * detection step of its own, and a non-English question sent down an
 * English-shaped pipeline makes it invent postcodes and misroute greetings. This
 * picks a reply language from the text alone: deterministic, offline, and free of
 * any provider call.
 *
 * It is deliberately conservative. Guessing wrong answers in the wrong language,
 * which is worse than English, so English is the fallback whenever the evidence
 * is thin or tied.
 */

import type { AskLanguage, DetectedLanguage } from './types';

/** The non-English languages the detector can choose. */
type DetectableLanguage = Exclude<DetectedLanguage, 'en'>;

export interface LanguageDetection {
  /** The chip-style reply language; Pidgin maps to English. */
  replyLanguage: AskLanguage;
  /** What the text actually looks like, including Pidgin. */
  detected: DetectedLanguage;
  /** 0..1. English scores 1 when nothing matched, 0.5 when the evidence was weak or tied. */
  confidence: number;
}

const DETECTABLE: readonly DetectableLanguage[] = ['yo', 'ha', 'ig', 'pcm'];

/** Letters that only (or almost only) one language uses, scored per hit. */
const MARKED_LETTERS: Partial<Record<DetectableLanguage, RegExp>> = {
  yo: /[ẹṣ]/gu,
  ha: /[ɓɗƙ]/gu,
  ig: /[ịụṅ]/gu,
};

const MARKED_WEIGHT = 2;

/** The underdot o is shared by Yoruba and Igbo, so it only nudges both. */
const SHARED_LETTER = /ọ/gu;
const SHARED_WEIGHT = 1;

/** A language must reach this score before it beats English. */
const MIN_SCORE = 2;

/**
 * Folded (accent-free) cue words: `[word, weight]`. Weight 2 is distinctive to
 * the language; weight 1 is a weak or shared cue that only helps alongside a
 * stronger one. Entries are letters and spaces only, so they need no escaping.
 */
const LEXICON: Record<DetectableLanguage, readonly (readonly [string, number])[]> = {
  yo: [
    ['koodu', 2], ['ipin', 2], ['ipinle', 2], ['awon', 2], ['bawo', 2], ['jowo', 2],
    ['odabo', 2], ['kaaro', 2], ['irole', 2], ['ki ni', 2], ['e ku', 2],
    ['ilu', 1], ['ese', 1], ['ni', 1], ['ti', 1], ['ati', 1], ['mo', 1], ['o', 1],
  ],
  ha: [
    ['menene', 2], ['mene', 2], ['lambar', 2], ['lamba', 2], ['gidan', 2], ['gida', 2],
    ['waya', 2], ['kwana', 2], ['wuni', 2], ['sannu', 2], ['wanene', 2], ['nawa', 2],
    ['gode', 2], ['barka', 2], ['madalla', 2], ['lafiya', 2], ['ranka', 2], ['jima', 2],
    ['na', 1], ['ta', 1], ['da', 1], ['ka', 1], ['ki', 1], ['ke', 1], ['ne', 1],
    ['ce', 1], ['ba', 1], ['don', 1], ['yaya', 1], ['ina', 1],
  ],
  ig: [
    ['gini', 2], ['ozi', 2], ['nke', 2], ['ndewo', 2], ['kedu', 2], ['nno', 2],
    ['daalu', 2], ['biko', 2], ['ihe', 2], ['mmadu', 2], ['koodu', 1],
    ['bu', 1], ['na', 1], ['ka', 1], ['ya', 1], ['m', 1], ['gi', 1], ['anyi', 1],
    ['ha', 1], ['o', 1], ['ebe', 1], ['aha', 1], ['maka', 1],
  ],
  pcm: [
    ['wetin', 2], ['dey', 2], ['abeg', 2], ['wahala', 2], ['sabi', 2], ['yawa', 2],
    ['waka', 2], ['na wa', 2], ['no wahala', 2], ['na so', 2],
    ['una', 1], ['wey', 1], ['sha', 1], ['sef', 1], ['shey', 1], ['na', 1], ['oga', 1],
  ],
};

function compile(entries: readonly (readonly [string, number])[]): { re: RegExp; weight: number }[] {
  return entries.map(([word, weight]) => ({ re: new RegExp(`\\b${word}\\b`, 'u'), weight }));
}

/** Compiled once, so detection stays allocation-light on every send. */
const WORD_PATTERNS: Record<DetectableLanguage, ReturnType<typeof compile>> = {
  yo: compile(LEXICON.yo),
  ha: compile(LEXICON.ha),
  ig: compile(LEXICON.ig),
  pcm: compile(LEXICON.pcm),
};

function normalize(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip tone marks and underdots so `kòòdù` matches the entry `koodu`. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function scoreLetters(lowered: string): Partial<Record<DetectableLanguage, number>> {
  const scores: Partial<Record<DetectableLanguage, number>> = {};
  for (const language of DETECTABLE) {
    const pattern = MARKED_LETTERS[language];
    if (!pattern) continue;
    const hits = lowered.match(pattern)?.length ?? 0;
    if (hits > 0) scores[language] = hits * MARKED_WEIGHT;
  }
  const shared = lowered.match(SHARED_LETTER)?.length ?? 0;
  if (shared > 0) {
    scores.yo = (scores.yo ?? 0) + shared * SHARED_WEIGHT;
    scores.ig = (scores.ig ?? 0) + shared * SHARED_WEIGHT;
  }
  return scores;
}

function scoreWords(folded: string): Partial<Record<DetectableLanguage, number>> {
  const scores: Partial<Record<DetectableLanguage, number>> = {};
  for (const language of DETECTABLE) {
    let total = 0;
    for (const { re, weight } of WORD_PATTERNS[language]) {
      if (re.test(folded)) total += weight;
    }
    if (total > 0) scores[language] = total;
  }
  return scores;
}

/**
 * Pick the reply language for one question. Never throws: an empty, foreign, or
 * ambiguous string resolves to English with low or full confidence.
 */
export function detectLanguage(text: string): LanguageDetection {
  const normalized = normalize(text);
  const letters = scoreLetters(normalized);
  const words = scoreWords(fold(normalized));

  let best: DetectableLanguage | null = null;
  let bestScore = 0;
  let runnerUp = 0;
  for (const language of DETECTABLE) {
    const score = (letters[language] ?? 0) + (words[language] ?? 0);
    if (score > bestScore) {
      runnerUp = bestScore;
      bestScore = score;
      best = language;
    } else if (score > runnerUp) {
      runnerUp = score;
    }
  }

  if (best === null || bestScore < MIN_SCORE || bestScore === runnerUp) {
    return { replyLanguage: 'en', detected: 'en', confidence: bestScore === 0 ? 1 : 0.5 };
  }

  return {
    replyLanguage: best === 'pcm' ? 'en' : best,
    detected: best,
    confidence: Math.min(1, bestScore / (bestScore + runnerUp)),
  };
}
