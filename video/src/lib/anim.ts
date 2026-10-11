/**
 * Small animation helpers built on Remotion's spring/interpolate primitives.
 */
import { interpolate, spring } from 'remotion';

/** Spring-in from below: returns opacity + translateY for a given start frame. */
export function enter(
  frame: number,
  fps: number,
  start: number,
  { dist = 26, damping = 200, stiffness = 110, mass = 0.7 } = {},
): { opacity: number; transform: string } {
  const p = spring({ frame: frame - start, fps, config: { damping, stiffness, mass } });
  const clamped = Math.max(0, Math.min(1, p));
  return { opacity: clamped, transform: `translateY(${(1 - clamped) * dist}px)` };
}

/** Linear 0→1 ramp over `dur` frames starting at `start`. */
export function ramp(frame: number, start: number, dur: number): number {
  return interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/** Overall scene opacity envelope (fade in, hold, fade out). */
export function sceneEnvelope(frame: number, duration: number, fadeIn = 9, fadeOut = 11): number {
  const inO = ramp(frame, 0, fadeIn);
  const outO = interpolate(frame, [duration - fadeOut, duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return Math.min(inO, outO);
}
