/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import {
  MAX_LIST_HEIGHT_RATIO,
  MIN_LIST_HEIGHT,
  clampListHeight,
} from '../../lib/ask/panelLayout';

/** Props for the vertical resize strip under the Ask Atlas message list. */
export interface AskAtlasResizeHandleProps {
  /** Called with the new message-list height (px) while dragging. */
  onResize: (heightPx: number) => void;
  /** Height to start the drag from: the list's current rendered height. */
  getCurrentHeight: () => number;
  /**
   * Largest height the drag may reach, measured at the moment it is asked for.
   * Defaults to the flat share of the viewport, which is what a panel with no
   * measured room left to grow into can offer.
   */
  getMaxHeight?: () => number;
}

/** Cap offered when the caller supplies no measurement of the panel. */
function viewportCap(): number {
  return Math.round(window.innerHeight * MAX_LIST_HEIGHT_RATIO);
}

/**
 * A thin horizontal grip below the message list. Drag it upward to grow the
 * conversation and downward to shrink it, matching the panel's bottom anchor:
 * pulling the grip up reveals more of the conversation, which is what the
 * gesture is expected to do.
 */
export const AskAtlasResizeHandle: React.FC<AskAtlasResizeHandleProps> = ({
  onResize,
  getCurrentHeight,
  getMaxHeight,
}) => {
  // Drag session: the pointer's start Y and the list height it maps to.
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Let the handle resize without moving the draggable card.
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startY: e.clientY, startHeight: getCurrentHeight() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // Upward drag (negative delta) grows the list because the panel is anchored
    // at the bottom; downward shrinks it. The cap is re-read each move so it
    // follows a card the user has dragged down the screen, and it stays put
    // while the list grows, because growing the list lifts the panel top by the
    // same amount.
    const maxHeight = getMaxHeight ? getMaxHeight() : viewportCap();
    const next = clampListHeight(drag.startHeight - (e.clientY - drag.startY), {
      min: MIN_LIST_HEIGHT,
      max: maxHeight,
    });
    onResize(next);
  };

  const stopDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize the conversation"
      title="Drag up to enlarge, down to shrink"
      className="group flex h-3 shrink-0 cursor-ns-resize touch-none select-none items-center justify-center border-t border-[#F3F4F6] dark:border-[#1F2937]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      <div className="h-1 w-9 rounded-full bg-[#9CA3AF]/40 transition-colors group-hover:bg-[#0F7B4D]/60 dark:group-hover:bg-[#10B981]/60" />
    </div>
  );
};
