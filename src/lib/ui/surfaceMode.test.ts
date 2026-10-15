import { describe, expect, it } from 'vitest';
import { resolveSurfaceMode } from './surfaceMode';

describe('resolveSurfaceMode', () => {
  it('turns a phone into a bottom sheet for both desktop placements', () => {
    expect(resolveSurfaceMode('side', 'sheet', true)).toBe('sheet');
    expect(resolveSurfaceMode('center', 'sheet', true)).toBe('sheet');
  });

  it('honours a surface that stays centred on a phone', () => {
    expect(resolveSurfaceMode('center', 'center', true)).toBe('center');
    expect(resolveSurfaceMode('side', 'center', true)).toBe('center');
  });

  it('uses the desktop placement and ignores the phone placement on a desktop', () => {
    expect(resolveSurfaceMode('side', 'sheet', false)).toBe('side');
    expect(resolveSurfaceMode('side', 'center', false)).toBe('side');
    expect(resolveSurfaceMode('center', 'sheet', false)).toBe('center');
    expect(resolveSurfaceMode('center', 'center', false)).toBe('center');
  });
});
