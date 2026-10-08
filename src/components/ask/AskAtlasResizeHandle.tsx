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
const MIN_LIST_HEIGHT = 140;

/** Largest list height as a share of the viewport (px). */
const MAX_LIST_HEIGHT_RATIO = 0.85;

/**
 * A thin horizontal strip below the message list. Drag it to grow or shrink
 * the conversation area; the auto-grow default (70vh cap) still applies
 * until the user drags, after which their height is honored.
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
    const next = Math.min(Math.max(drag.startHeight + (e.clientY - drag.startY), MIN_LIST_HEIGHT), maxHeight);
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
      title="Drag to resize the conversation"
      className="h-2.5 flex items-center justify-center cursor-ns-resize touch-none select-none group"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      <div className="w-8 h-1 rounded-full bg-[#9CA3AF]/40 group-hover:bg-[#008751]/60 transition-colors" />
    </div>
  );
};