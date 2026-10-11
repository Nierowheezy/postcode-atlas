/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { groundingBasis } from './grounding';
import type { AskAtlasMessage } from './types';

function assistant(overrides: Partial<AskAtlasMessage> = {}): AskAtlasMessage {
  return { id: 'msg-1', role: 'assistant', content: 'reply', timestamp: 1, ...overrides };
}

describe('groundingBasis', () => {
  it('labels replies with a verified data payload', () => {
    expect(
      groundingBasis(
        assistant({
          lookup: { postcode: 'FC-02-D43-LG-01', verified: true },
        }),
      ),
    ).toBe('payload');
    expect(groundingBasis(assistant({ results: { level: 'lga', items: [], total: 0 } }))).toBe('payload');
    expect(
      groundingBasis(
        assistant({
          decoded: {
            postcode: 'FC-02-D43-LG-01',
            compact: 'FC-02-D43-LG-01',
            display: 'FC-02-D43-LG-01',
            valid: true,
            segments: { state: 'FC', lga: '02', district: 'D43', area: 'LG', unit: '01' },
          },
        }),
      ),
    ).toBe('payload');
    expect(groundingBasis(assistant({ nearby: { items: [], total: 0 } }))).toBe('payload');
  });

  it('labels a map move as a map move, even with a question attached', () => {
    expect(
      groundingBasis(
        assistant({
          mapAction: { target: 'state', state: { code: 'KN', name: 'Kano' }, center: [11.5, 8.5], zoom: 7 },
          question: 'show Kano on the map',
        }),
      ),
    ).toBe('map');
  });

  it('treats an exact small-talk turn as chat, not a data claim', () => {
    expect(groundingBasis(assistant({ question: 'hello', grounding: 'unverified' }))).toBe('chat');
    expect(groundingBasis(assistant({ question: 'how you dey', grounding: 'unverified' }))).toBe('chat');
  });

  it('keeps chat honest for a greeting even if grounding claims tools ran', () => {
    // Tools are withheld for small talk, so this should not happen; if it ever
    // does, 'chat' is still the honest label - a greeting is not tool results.
    expect(groundingBasis(assistant({ question: 'hi', grounding: 'atlas' }))).toBe('chat');
  });

  it('falls back to the unverified line for a question that is not small talk', () => {
    expect(
      groundingBasis(assistant({ question: 'what is the weather in Lagos', grounding: 'unverified' })),
    ).toBe('none');
  });

  it('labels a grounded reply with no payload as answered from tools', () => {
    expect(groundingBasis(assistant({ question: 'What is the postcode for Ikeja?', grounding: 'atlas' }))).toBe(
      'tools',
    );
  });

  it('treats a message without a stored question as a data claim, not chat', () => {
    // Persisted conversations from before the `question` field have no marker;
    // the unverified line is the honest fallback for those replies.
    expect(groundingBasis(assistant({ grounding: 'unverified' }))).toBe('none');
  });
});