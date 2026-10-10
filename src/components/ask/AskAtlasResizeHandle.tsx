/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';

/** Props for the vertical resize strip under the Ask Atlas message list. */
export interface AskAtlasResizeHandleProps {
  /** Called with the new message-list height (px) while dragging. */
  onResize: (heightPx: number) => void;
  /** Height to start the drag from: the list's current rendered height. */
  getCurrentHeight: () => number;
}

/** Smallest list height the user can drag to (px). */
const MIN_LIST_HEIGHT = 180;

/** Largest list height as a share of the viewport (px). */
const MAX_LIST_HEIGHT_RATIO = 0.85;

/**
 * A thin horizontal grip below the message list. Drag it upward to grow the
 * conversation and downward to shrink it, matching the panel's bottom anchor:
 * pulling the grip up reveals more of the conversation, which is what the
 * gesture is expected to do.
 */
export const AskAtlasResizeHandle: React.FC<AskAtlasResizeHandleProps> = ({ onResize, getCurrentHeight }) => {
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
    const maxHeight = Math.round(window.innerHeight * MAX_LIST_HEIGHT_RATIO);
    // Upward drag (negative delta) grows the list because the panel is anchored
    // at the bottom; downward shrinks it.
    const next = Math.min(Math.max(drag.startHeight - (e.clientY - drag.startY), MIN_LIST_HEIGHT), maxHeight);
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
      className="group flex h-3 cursor-ns-resize touch-none select-none items-center justify-center border-t border-[#F3F4F6] dark:border-[#1F2937]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      <div className="h-1 w-9 rounded-full bg-[#9CA3AF]/40 transition-colors group-hover:bg-[#0F7B4D]/60 dark:group-hover:bg-[#10B981]/60" />
    </div>
  );
};
