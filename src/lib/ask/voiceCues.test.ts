/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import { cueNotes } from './voiceCues';

describe('cueNotes', () => {
  it('starts on a rising two-note cue', () => {
    const notes = cueNotes('start');
    expect(notes).toHaveLength(2);
    expect(notes[0].frequency).toBeLessThan(notes[1].frequency);
    expect(notes[1].at).toBeGreaterThan(notes[0].at);
  });

  it('stops on a single lower note', () => {
    const start = cueNotes('start');
    const stop = cueNotes('stop');
    expect(stop).toHaveLength(1);
    expect(stop[0].frequency).toBeLessThan(start[0].frequency);
  });

  it('gives every note a positive duration', () => {
    for (const cue of ['start', 'stop'] as const) {
      for (const note of cueNotes(cue)) {
        expect(note.duration).toBeGreaterThan(0);
        expect(note.frequency).toBeGreaterThan(0);
      }
    }
  });
});
