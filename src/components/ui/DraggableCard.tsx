import React from 'react';
import { motion, useDragControls } from 'motion/react';
import { GripHorizontal } from 'lucide-react';

interface DraggableCardProps {
  children: React.ReactNode;
  className?: string;
  dragHandleText?: string;
  initialX?: number;
  initialY?: number;
}

export const DraggableCard: React.FC<DraggableCardProps> = ({
  children,
  className = '',
  dragHandleText = 'Drag panel',
  initialX = 0,
  initialY = 0,
}) => {
  // Drag starts only from the handle bar (root drag listener is off), so the
  // card's content stays selectable and copyable.
  const dragControls = useDragControls();

  return (
    <motion.div
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0.08}
      initial={{ x: initialX, y: initialY }}
      whileDrag={{ scale: 1.01, cursor: 'grabbing', zIndex: 60 }}
      // select-text overrides the app root's inherited select-none so card
      // content is copyable; the handle bar keeps its own select-none.
      className={`relative cursor-default select-text shadow-md rounded-lg overflow-hidden border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#111827] ${className}`}
    >
      {/* High-Contrast, Clearly Visible Drag Header Handle */}
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

      {children}
    </motion.div>
  );
};
