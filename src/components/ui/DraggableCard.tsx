import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion, useDragControls, useMotionValue } from 'motion/react';
import { GripHorizontal } from 'lucide-react';
import { dragBounds } from '../../lib/ui/dragBounds';
import type { DragBounds } from '../../lib/ui/dragBounds';

interface DraggableCardProps {
  children: React.ReactNode;
  className?: string;
  dragHandleText?: string;
  initialX?: number;
  initialY?: number;
  /**
   * When provided, replaces the built-in drag bar. Call the passed handler on
   * pointer down to start dragging, so a card can use its own header as the
   * grab area (Ask Atlas does this to avoid a doubled title bar).
   */
  renderHandle?: (startDrag: (event: React.PointerEvent) => void) => React.ReactNode;
  /**
   * Element the card must stay inside, so the shell can keep a panel on screen.
   * Omitting it keeps the card's free drag.
   */
  dragConstraintsRef?: React.RefObject<HTMLElement | null>;
}

/** Whether a fresh measurement matches the one already in state. */
function sameBounds(a: DragBounds, b: DragBounds): boolean {
  return a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;
}

export const DraggableCard: React.FC<DraggableCardProps> = ({
  children,
  className = '',
  dragHandleText = 'Drag panel',
  initialX = 0,
  initialY = 0,
  renderHandle,
  dragConstraintsRef,
}) => {
  // Drag starts only from the handle bar (root drag listener is off), so the
  // card's content stays selectable and copyable.
  const dragControls = useDragControls();
  const cardRef = useRef<HTMLDivElement>(null);
  // The translation lives in explicit motion values so the card's resting box
  // can still be measured while it is being dragged.
  const x = useMotionValue(initialX);
  const y = useMotionValue(initialY);
  const [bounds, setBounds] = useState<DragBounds | null>(null);

  /**
   * Keep the bounds in step with the card and the element confining it. They
   * are measured here and passed to motion as a plain object rather than as a
   * ref to the container: motion re-projects a ref-constrained element whenever
   * it resizes, which drags the panel down as its own content grows (the Ask
   * Atlas grip resizes the card on every pointer move).
   */
  useLayoutEffect(() => {
    if (!dragConstraintsRef) return;
    const card = cardRef.current;
    const container = dragConstraintsRef.current;
    if (!card || !container) return;
    const measure = () => {
      const next = dragBounds(card.getBoundingClientRect(), container.getBoundingClientRect(), {
        x: x.get(),
        y: y.get(),
      });
      setBounds((prev) => (prev && sameBounds(prev, next) ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    observer.observe(container);
    return () => observer.disconnect();
  }, [dragConstraintsRef, x, y]);

  return (
    <motion.div
      ref={cardRef}
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={dragConstraintsRef ? 0 : 0.08}
      dragConstraints={bounds ?? undefined}
      style={{ x, y }}
      whileDrag={{ scale: 1.01, cursor: 'grabbing', zIndex: 60 }}
      // select-text overrides the app root's inherited select-none so card
      // content is copyable; the handle bar keeps its own select-none.
      className={`relative cursor-default select-text shadow-md rounded-lg overflow-hidden border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#111827] ${className}`}
    >
      {renderHandle ? (
        renderHandle((event) => dragControls.start(event))
      ) : (
        /* High-Contrast, Clearly Visible Drag Header Handle */
        <div
          onPointerDown={(event) => dragControls.start(event)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-50 bg-zinc-100 dark:bg-zinc-800/90 border-b border-zinc-200 dark:border-zinc-700 cursor-grab active:cursor-grabbing hover:bg-zinc-200/80 dark:hover:bg-zinc-700 transition-colors select-none"
          title="Click and drag anywhere on this bar to move this card"
        >
          <div className="flex items-center gap-2 min-w-0">
            <GripHorizontal className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="tracking-tight truncate uppercase text-[11px] font-bold text-zinc-900 dark:text-zinc-100">
              {dragHandleText}
            </span>
          </div>
          <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-zinc-600 dark:text-zinc-300 bg-white/80 dark:bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-200/80 dark:border-zinc-700 shadow-2xs shrink-0">
            Hold & Drag
          </span>
        </div>
      )}

      {children}
    </motion.div>
  );
};
