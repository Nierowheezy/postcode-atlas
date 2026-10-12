/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sizing arithmetic for the Ask Atlas panel's resize grip.
 *
 * The panel is anchored to the bottom of the map area, so every pixel the
 * message list grows pushes the panel's top edge one pixel further up. The room
 * the grip may use is therefore measured, not assumed: a flat share of the
 * window leaves the top of the drag as a dead zone, where the grip moves and
 * nothing grows (the old cap was 331px on a 390px-tall screen whose panel had
 * only 222px of room).
 *
 * Two measurements bound the drag, because two things can run out first: the
 * gap between the panel's top edge and the top of the map area, and the panel's
 * own fit cap, which stays a fixed number of pixels wherever the card has been
 * dragged. The map area's top is what matters rather than the window's: the
 * shell header sits above it, and the panel is clipped by it.
 */

/** Smallest list height the user can drag to (px). */
export const MIN_LIST_HEIGHT = 180;

/** Largest list height as a share of the viewport height. */
export const MAX_LIST_HEIGHT_RATIO = 0.85;

/** Gap kept between the panel's top edge and the top of the map area (px). */
export const PANEL_TOP_GAP = 8;

/** Measurements {@link maxListHeight} works from. */
export interface PanelRoom {
  /** Height the message list is rendering at now (px). */
  currentHeight: number;
  /** Height the whole panel is rendering at now, chrome included (px). */
  panelHeight: number;
  /** Viewport coordinate of the panel's top edge (px, from the top). */
  panelTop: number;
  /** Tallest the panel may become under its own fit rule (px). */
  panelMaxHeight: number;
  /** Viewport coordinate of the map area's top edge (px, from the top). */
  containerTop: number;
  /** Visible viewport height (px). */
  viewportHeight: number;
}

/**
 * Keeps a requested list height inside its bounds. A maximum below the minimum
 * wins, so an impossible pair still returns a usable number rather than the
 * floor.
 */
export function clampListHeight(value: number, bounds: { min: number; max: number }): number {
  return Math.min(Math.max(value, bounds.min), bounds.max);
}

/**
 * Largest list height the grip may reach: what the list has now plus how much
 * taller the panel may become, whether that is limited by the top of the map
 * area or by the panel's own fit cap, and never past the viewport ceiling. A
 * panel with no room left keeps the height it has.
 */
export function maxListHeight({
  currentHeight,
  panelHeight,
  panelTop,
  panelMaxHeight,
  containerTop,
  viewportHeight,
}: PanelRoom): number {
  const roomAbovePanel = Math.max(
    0,
    Math.round(panelTop) - Math.round(containerTop) - PANEL_TOP_GAP
  );
  const roomToFitPanel = Math.max(0, Math.round(panelMaxHeight) - Math.round(panelHeight));
  const ceiling = Math.round(viewportHeight * MAX_LIST_HEIGHT_RATIO);
  return Math.min(Math.round(currentHeight) + Math.min(roomAbovePanel, roomToFitPanel), ceiling);
}
