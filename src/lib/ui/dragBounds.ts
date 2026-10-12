/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Axis-aligned box in viewport coordinates: the parts of a DOMRect we need. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Drag translation currently applied to the card, in pixels. */
export interface DragOffset {
  x: number;
  y: number;
}

/** How far the card may move in each direction from where it rests. */
export interface DragBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Relative drag bounds that keep `card` inside `container`.
 *
 * Motion can take a container element as `dragConstraints` and measure this
 * itself, but with a ref it also watches the dragged element for size changes
 * and re-projects it inside the container on every resize. A card whose own
 * content grows mid-drag then drifts: dragging the Ask Atlas grip moved the
 * whole panel down by up to the anchor gap, because motion preserved the
 * element's position relative to the constraint box across the resize. Plain
 * object bounds are resolved once when the drag starts and never re-projected,
 * so measuring them here removes that movement.
 *
 * The returned values are the distances motion's relative `dragConstraints`
 * expects: `top`/`left` are usually negative (room above and left of the
 * resting position) and `right`/`bottom` are the room below and right of it.
 */
export function dragBounds(card: Rect, container: Rect, offset: DragOffset): DragBounds {
  // getBoundingClientRect() includes the drag transform, so the resting box is
  // the measured one with the current translation taken back out. Width and
  // height are unaffected by a translation.
  const restingLeft = card.left - offset.x;
  const restingTop = card.top - offset.y;
  const width = card.right - card.left;
  const height = card.bottom - card.top;
  return {
    left: Math.round(container.left - restingLeft),
    top: Math.round(container.top - restingTop),
    right: Math.round(container.right - (restingLeft + width)),
    bottom: Math.round(container.bottom - (restingTop + height)),
  };
}
