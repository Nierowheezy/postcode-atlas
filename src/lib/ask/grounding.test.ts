/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { groundingBasis, GROUNDING_FOOTER } from './grounding';
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
    expect(
      groundingBasis(
        assistant({
          nearby: { items: [{ postcode: 'FC-02-D43-LG-01', distance_m: 280 }], total: 1 },
        }),
      ),
    ).toBe('payload');
    expect(
      groundingBasis(
        assistant({
          address: {
            input: '12 Allen Avenue, Ikeja, Lagos',
            state: { code: 'LA', name: 'Lagos' },
            lga: { code: 'LA-05', name: 'Ikeja' },
            unresolved: ['12 Allen Avenue'],
            resolvedTo: 'lga',
          },
        }),
      ),
    ).toBe('payload');
  });

  it('does not label an address that placed nothing as a verified payload', () => {
    // The tool ran but the address matched no state, LGA, or postcode: it
    // verified nothing, so the reply falls back to the tool-results or
    // unverified line rather than claiming a data payload.
    expect(
      groundingBasis(
        assistant({
          address: { input: 'Nowhereville', unresolved: ['Nowhereville'], resolvedTo: 'none' },
          grounding: 'atlas',
        }),
      ),
    ).toBe('tools');
  });

  it('does not label an empty nearby search as a verified payload', () => {
    // The tool ran but returned zero units: it verified nothing. A grounded
    // reply is "answered from tool results"; an ungrounded one is unverified.
    expect(groundingBasis(assistant({ nearby: { items: [], total: 0 }, grounding: 'atlas' }))).toBe('tools');
    expect(groundingBasis(assistant({ nearby: { items: [], total: 0 }, grounding: 'unverified' }))).toBe('none');
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

  it('labels a curated explanation as an explanation, not verified data', () => {
    expect(
      groundingBasis(
        assistant({
          explanation: {
            topic: 'hierarchy',
            title: 'How the hierarchy works',
            summary: 'Five levels.',
            points: ['State, LGA, district, area, unit.'],
          },
          grounding: 'atlas',
        }),
      ),
    ).toBe('explanation');
    expect(GROUNDING_FOOTER.explanation).toBe('Atlas explanation, not NIPOST data');
  });

  it('prefers the verified payload label when an explanation also carries data', () => {
    // One reply can decode a code and explain the system in the same turn. The
    // decoded record is verified, so it wins the single footer line.
    expect(
      groundingBasis(
        assistant({
          decoded: {
            postcode: 'FC-02-D43-LG-01',
            compact: 'FC02D43LG01',
            display: 'FC 02 D43 LG 01',
            valid: true,
            segments: { state: 'FC', lga: '02', district: 'D43', area: 'LG', unit: '01' },
          },
          explanation: { topic: 'ndaps', title: 'What NDAPS is', summary: 'x', points: ['y'] },
        }),
      ),
    ).toBe('payload');
  });
});