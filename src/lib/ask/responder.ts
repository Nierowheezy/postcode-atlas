/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AskAtlasResponder, AskAtlasResponse } from './types';

const RESPONSE_DELAY_MS = 400;

interface StubRule {
  pattern: RegExp;
  reply: () => AskAtlasResponse;
}

const RULES: StubRule[] = [
  {
    pattern: /\b(ikeja|yaba|surulere|lekki|ikoyi|victoria island)\b/i,
    reply: () => ({
      text: 'I found Ikeja, Lagos.\n\nPostcode: 100001\n\nLagos\n  Ikeja\n    A12\n      100001',
      grounding: 'unverified',
      location: { lat: 6.6018, lng: 3.3515, label: 'Ikeja, Lagos' },
    }),
  },
  {
    pattern: /\blagos\b/i,
    reply: () => ({
      text: 'Lagos State has 20 Local Government Areas. Ask me for a specific LGA, district, or postcode to narrow it down.',
      grounding: 'unverified',
    }),
  },
  {
    pattern: /\b(decode|structure|explain)\b.*\bpostcode\b|\bpostcode\b.*\b(decode|structure|explain)\b/i,
    reply: () => ({
      text: 'An NDAPS postcode has five segments: state (LA), LGA (11), district (A12), area (AK), and unit (08).\n\nExample: LA-11-A12-AK-08',
      grounding: 'unverified',
    }),
  },
  {
    pattern: /\b(postcode|postal code|zip)\b/i,
    reply: () => ({
      text: 'Tell me a place name (for example "postcode for Ikeja") and I will look it up once N-ATLAS is connected.',
      grounding: 'unverified',
    }),
  },
];

const FALLBACK: AskAtlasResponse = {
  text: 'Ask Atlas is running with a placeholder responder. N-ATLAS integration arrives in feature 2, so replies are canned for now.',
  grounding: 'unverified',
};

function pickReply(text: string): AskAtlasResponse {
  const rule = RULES.find((r) => r.pattern.test(text));
  return rule ? rule.reply() : FALLBACK;
}

/** Dev stub: canned replies, artificial latency, rejects for "!fail". */
export function createStubResponder(): AskAtlasResponder {
  return {
    respond(text: string): Promise<AskAtlasResponse> {
      const trimmed = text.trim();
      if (trimmed.startsWith('!fail')) {
        return new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Stub responder failure (requested via !fail)')), RESPONSE_DELAY_MS),
        );
      }
      return new Promise((resolve) =>
        setTimeout(() => resolve(pickReply(trimmed)), RESPONSE_DELAY_MS),
      );
    },
  };
}
