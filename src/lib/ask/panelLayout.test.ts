import { describe, expect, it } from 'vitest';
import {
  MAX_LIST_HEIGHT_RATIO,
  MIN_LIST_HEIGHT,
  PANEL_TOP_GAP,
  clampListHeight,
  maxListHeight,
} from './panelLayout';
import type { PanelRoom } from './panelLayout';

/** The panel fit rule the stylesheet applies: the visible viewport less the gap. */
const fitCap = (viewportHeight: number) => viewportHeight - 24;

describe('clampListHeight', () => {
  it('returns the floor for anything below it', () => {
    expect(clampListHeight(120, { min: 180, max: 765 })).toBe(MIN_LIST_HEIGHT);
    expect(clampListHeight(MIN_LIST_HEIGHT, { min: 180, max: 765 })).toBe(MIN_LIST_HEIGHT);
  });

  it('returns the cap for anything above it', () => {
    expect(clampListHeight(900, { min: 180, max: 765 })).toBe(765);
    expect(clampListHeight(765, { min: 180, max: 765 })).toBe(765);
  });

  it('returns values already inside the bounds untouched', () => {
    expect(clampListHeight(400, { min: 180, max: 765 })).toBe(400);
  });

  it('lets a maximum below the floor win', () => {
    // An extremely short viewport can leave less room than the floor. The cap
    // still wins, so the panel is never asked to be taller than it can be.
    expect(clampListHeight(400, { min: 180, max: 140 })).toBe(140);
  });
});

describe('maxListHeight', () => {
  // Real measured geometry at 1280x900: a 480px list, 122px of chrome, the
  // panel anchored 24px off the bottom of an 852px map area that starts 48px
  // down the window for the shell header.
  const room = (over: Partial<PanelRoom> = {}): PanelRoom => ({
    currentHeight: 480,
    panelHeight: 602,
    panelTop: 274,
    panelMaxHeight: fitCap(900),
    containerTop: 48,
    viewportHeight: 900,
    ...over,
  });

  it('reports the room above the panel at the desktop default', () => {
    // The panel top sits at 274 and the map area starts at 48, so the grip may
    // spend 274 - 48 - 8 before the panel reaches the gap under the header.
    expect(maxListHeight(room())).toBe(698);
  });

  it('is unchanged by how far the panel has already been grown', () => {
    // Growing the list lifts the top edge by the same amount, so a panel that
    // has not been dragged reports the same cap: it cannot ratchet upwards
    // while the user holds the grip.
    const anchored = maxListHeight(room());
    const grown = maxListHeight(room({ currentHeight: 600, panelHeight: 722, panelTop: 154 }));
    expect(grown).toBe(anchored);
  });

  it('stops at the map area, not at the window', () => {
    // 876px of fit cap would let the top reach 0, under the shell header and
    // into the map's overflow clip. The map area's top wins.
    expect(maxListHeight(room({ panelMaxHeight: fitCap(900) }))).toBe(698);
    expect(maxListHeight(room({ panelMaxHeight: 2000 }))).toBe(698);
  });

  it('keeps the height a panel already taller than its room has', () => {
    // 844x390 landscape: the 366px panel already overhangs the top of its map
    // area, so the grip has nothing to give. The old flat cap of 331px was
    // 109px of dead zone.
    const landscape = room({
      currentHeight: 222,
      panelHeight: 366,
      panelTop: 0,
      panelMaxHeight: fitCap(390),
      containerTop: 51,
      viewportHeight: 390,
    });
    expect(maxListHeight(landscape)).toBe(222);
  });

  it('still reports no growth after the card is dragged down', () => {
    // Dragging the card down opens a gap above it, but the panel cannot grow
    // past its own fit cap, so the grip stays honest instead of swallowing the
    // drag.
    expect(
      maxListHeight(
        room({
          currentHeight: 222,
          panelHeight: fitCap(390),
          panelTop: 24,
          panelMaxHeight: fitCap(390),
          containerTop: 51,
          viewportHeight: 390,
        })
      )
    ).toBe(222);
  });

  it('grows a portrait phone panel up to the gap under the header', () => {
    // 390x844: list 480, panel 624, map area from 51 to 844. The top edge sits
    // at 196, so the room is 196 - 51 - 8; the fit cap's 196px does not bind.
    expect(
      maxListHeight(
        room({ panelTop: 196, panelMaxHeight: fitCap(844), containerTop: 51, viewportHeight: 844 })
      )
    ).toBe(617);
  });

  it('honours the viewport ceiling on a tall window', () => {
    const viewportHeight = 1400;
    expect(
      maxListHeight(
        room({ panelTop: 774, panelMaxHeight: fitCap(viewportHeight), viewportHeight })
      )
    ).toBe(Math.round(viewportHeight * MAX_LIST_HEIGHT_RATIO));
  });

  it('keeps the height a panel already pushed above its area has', () => {
    expect(maxListHeight(room({ panelTop: -40 }))).toBe(480);
  });

  it('uses the configured top gap', () => {
    expect(maxListHeight(room({ currentHeight: 300, panelHeight: 422, panelTop: 100 }))).toBe(
      300 + (100 - 48 - PANEL_TOP_GAP)
    );
  });
});
