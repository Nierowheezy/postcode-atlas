/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Short synthesized earcons for the voice input session (feature 25), so
 * starting and stopping dictation is audible without looking at the screen, as
 * it is in Grok. Built on the Web Audio API, so no audio asset ships and
 * nothing is fetched.
 *
 * Everything here is best effort. A browser that blocks audio, or lacks the
 * API, must never affect dictation, so every entry point swallows its errors
 * and returns quietly.
 */

export type VoiceCue = 'start' | 'stop';

export interface CueNote {
  /** Tone in hertz. */
  frequency: number;
  /** Seconds from the cue's start. */
  at: number;
  /** Seconds the tone sounds. */
  duration: number;
}

/**
 * A rising two-note "pom" when the microphone opens, and a single lower note
 * when the session ends, which is enough to tell the two apart by ear and stays
 * quiet enough not to be startling.
 */
const CUES: Record<VoiceCue, CueNote[]> = {
  start: [
    { frequency: 523.25, at: 0, duration: 0.09 },
    { frequency: 783.99, at: 0.07, duration: 0.12 },
  ],
  stop: [{ frequency: 392.0, at: 0, duration: 0.13 }],
};

/** Low enough to sit under speech; the earcon is a cue, not an alert. */
const PEAK_GAIN = 0.05;

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') {
    return null;
  }
  if (!context) {
    try {
      context = new window.AudioContext();
    } catch {
      return null;
    }
  }
  return context;
}

/**
 * Create or resume the audio context inside the user's tap, so a cue played a
 * moment later is not blocked by the browser's autoplay policy.
 */
export function primeVoiceCues(): void {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
  } catch {
    // Best effort.
  }
}

/** Play one cue. Silent when audio is unavailable or blocked. */
export function playVoiceCue(cue: VoiceCue): void {
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    for (const note of CUES[cue]) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = note.frequency;
      const start = now + note.at;
      const end = start + note.duration;
      // A short attack and release keeps the tone from clicking.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(PEAK_GAIN, start + 0.015);
      gain.gain.linearRampToValueAtTime(0, end);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(end);
    }
  } catch {
    // Best effort.
  }
}

/** The note definition for a cue, exposed for the pure test. */
export function cueNotes(cue: VoiceCue): CueNote[] {
  return CUES[cue].map((note) => ({ ...note }));
}
