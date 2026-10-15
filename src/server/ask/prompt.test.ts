import { describe, expect, it } from 'vitest';

import type { AtlasContextSnapshot } from '../../lib/ask/types';
import { buildSystemPrompt } from './prompt';

/**
 * The prompt must offer a place only when the message leans on one. Offering the
 * current selection on every request is what let an 8B model answer an unrelated
 * question with the last place it saw.
 *
 * The assertion names (Kano, Nassarawa, Oyo, Agege) are chosen because they do
 * not appear anywhere in the fixed instruction text: the prompt already uses
 * Ikeja, Lagos, and Wuse 2 as examples, so those could not prove absence.
 */
function context(overrides: Partial<AtlasContextSnapshot> = {}): AtlasContextSnapshot {
  return {
    selectedState: { code: 'KN', name: 'Kano' },
    selectedLga: { code: '44', name: 'Nassarawa' },
    mapCenter: [9.082, 8.6753],
    mapZoom: 6,
    ...overrides,
  };
}

describe('buildSystemPrompt', () => {
  it('names no place for a self-contained question, even with a full map selection', () => {
    const prompt = buildSystemPrompt(context(), 'en', {});

    expect(prompt).not.toContain('Nassarawa');
    expect(prompt).not.toContain('Kano');
    expect(prompt).not.toContain('The conversation is currently about');
    expect(prompt).not.toContain('Current map scope:');
  });

  it('always carries the map center so a "near me" question has an origin', () => {
    const prompt = buildSystemPrompt(context(), 'en', {});

    expect(prompt).toContain('Current map center: 9.082, 8.6753.');
  });

  it('offers the referent for an anaphoric follow-up', () => {
    const prompt = buildSystemPrompt(
      context({ referent: { kind: 'lga', code: '03', name: 'Agege', state: 'LA' } }),
      'en',
      { followUp: true },
    );

    expect(prompt).toContain('Agege');
    expect(prompt).not.toContain('Nassarawa');
  });

  it('offers the map selection for a follow-up when no referent was stored', () => {
    const prompt = buildSystemPrompt(context(), 'en', { followUp: true });

    expect(prompt).toContain('Nassarawa');
    expect(prompt).toContain('Kano');
  });

  it('offers the map selection for a spatial question', () => {
    const prompt = buildSystemPrompt(context(), 'en', { spatial: true });

    expect(prompt).toContain('Nassarawa');
    expect(prompt).toContain('Kano');
  });

  it('spatial questions resolve to what is on screen, not to an older referent', () => {
    const prompt = buildSystemPrompt(
      context({ referent: { kind: 'state', code: 'OY', name: 'Oyo' } }),
      'en',
      { spatial: true },
    );

    expect(prompt).toContain('Nassarawa');
    expect(prompt).not.toContain('Oyo');
  });

  it('a follow-up that has neither referent nor selection offers no place', () => {
    const prompt = buildSystemPrompt(
      { mapCenter: [9.082, 8.6753], mapZoom: 6 },
      'en',
      { followUp: true },
    );

    expect(prompt).not.toContain('The conversation is currently about');
    expect(prompt).toContain('Current map center: 9.082, 8.6753.');
  });

  it('leads the anchored block with the condition instead of declaring a topic', () => {
    const prompt = buildSystemPrompt(context(), 'en', { followUp: true });

    expect(prompt).toContain('If the user refers to a place without naming it');
    expect(prompt).toContain('that new place wins');
    expect(prompt).not.toContain('The conversation is currently about');
  });
});
