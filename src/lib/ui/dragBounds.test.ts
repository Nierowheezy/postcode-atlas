import { describe, expect, it } from 'vitest';
import { dragBounds } from './dragBounds';

/** A 1280x900 map area with a 420x624 card anchored 24px off its bottom right. */
const container = { left: 0, top: 0, right: 1280, bottom: 900 };
const resting = { left: 844, top: 252, right: 1264, bottom: 876 };

describe('dragBounds', () => {
  it('measures the room around a card resting at the bottom right', () => {
    expect(dragBounds(resting, container, { x: 0, y: 0 })).toEqual({
      left: -844,
      top: -252,
      right: 16,
      bottom: 24,
    });
  });

  it('takes the drag translation back out of the measurement', () => {
    // The same card while the user has dragged it 300px up and 60px right.
    const dragged = { left: 904, top: -48, right: 1324, bottom: 576 };
    expect(dragBounds(dragged, container, { x: 60, y: -300 })).toEqual({
      left: -844,
      top: -252,
      right: 16,
      bottom: 24,
    });
  });

  it('reports the same bounds however far the card has already been dragged', () => {
    // A card pulled hard against the top edge: the room above is spent but the
    // bounds themselves must not shrink, or a live drag would ratchet.
    const pulledUp = { left: 844, top: 0, right: 1264, bottom: 624 };
    const bounds = dragBounds(pulledUp, container, { x: 0, y: -252 });
    expect(dragBounds(resting, container, { x: 0, y: 0 })).toEqual(bounds);
  });

  it('keeps a taller card inside the same container', () => {
    // After the Ask Atlas grip has grown the list by 244px, the resting box
    // starts at the container's top edge, so it has no room left above it.
    const grown = { left: 844, top: 8, right: 1264, bottom: 876 };
    expect(dragBounds(grown, container, { x: 0, y: 0 })).toEqual({
      left: -844,
      top: -8,
      right: 16,
      bottom: 24,
    });
  });

  it('allows room above a card on a short landscape viewport', () => {
    const landscape = { left: 424, top: 0, right: 844, bottom: 366 };
    const short = { left: 0, top: 0, right: 844, bottom: 390 };
    expect(dragBounds(landscape, short, { x: 0, y: 0 })).toEqual({
      left: -424,
      top: 0,
      right: 0,
      bottom: 24,
    });
  });

  it('rounds fractional layout measurements to whole pixels', () => {
    const fractional = { left: 843.6, top: 251.6, right: 1263.4, bottom: 875.5 };
    expect(dragBounds(fractional, container, { x: 0, y: 0 })).toEqual({
      left: -844,
      top: -252,
      right: 17,
      bottom: 25,
    });
  });
});
