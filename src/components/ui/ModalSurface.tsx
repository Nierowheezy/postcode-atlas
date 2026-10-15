/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useIsPhone } from '../../hooks/useIsPhone';
import {
  PhonePlacement,
  SurfacePlacement,
  resolveSurfaceMode,
} from '../../lib/ui/surfaceMode';

/** The spring the drawers already use, reused for sheet and side panels. */
const DRAWER_SPRING = { type: 'spring', damping: 28, stiffness: 280 } as const;

/** Fade duration for the scrim and for centre panels. */
const FADE = { duration: 0.2 } as const;

const NO_MOTION = { duration: 0 } as const;

/** Props for the shared drawer/modal shell. */
export interface ModalSurfaceProps {
  /** Whether the surface is mounted. */
  open: boolean;
  /** Request a close. Fired by the scrim, the close button, and Escape. */
  onClose: () => void;
  /** Accessible name for the dialog. */
  label: string;
  /** Where the surface sits at `md` and up. */
  placement: SurfacePlacement;
  /** Where the surface sits below `md`. Defaults to a bottom sheet. */
  phonePlacement?: PhonePlacement;
  /** Tailwind size classes applied at `md` and up, such as `md:max-w-lg`. */
  desktopSize?: string;
  /** Tailwind z-index class for the fixed layer. Defaults to `z-50`. */
  layerClassName?: string;
  /** Content of the header row, rendered left of the shell's close button. */
  header?: React.ReactNode;
  /** Optional non-scrolling row under the header. */
  toolbar?: React.ReactNode;
  /** Optional non-scrolling row above the bottom edge. */
  footer?: React.ReactNode;
  /** The single scrolling region. */
  children?: React.ReactNode;
}

/**
 * One presentation for every drawer and modal: a right-side drawer or centred
 * card at `md` and up, and a full-width bottom sheet on a phone.
 *
 * Scroll, close, focus, stacking, and safe-area handling live here so the seven
 * surfaces that use it stay mechanical. It renders through a portal into
 * `document.body`, so a transformed draggable card cannot become the containing
 * block for this fixed layer and clip it.
 */
export const ModalSurface: React.FC<ModalSurfaceProps> = ({
  open,
  onClose,
  label,
  placement,
  phonePlacement = 'sheet',
  desktopSize = '',
  layerClassName = 'z-50',
  header,
  toolbar,
  footer,
  children,
}) => {
  const isPhone = useIsPhone();
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const mode = resolveSurfaceMode(placement, phonePlacement, isPhone);

  // Move focus into the panel on open and back to the trigger on close. There
  // is no focus trap in this slice; a later change can add one.
  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      previousFocus.current?.focus({ preventScroll: true });
    };
  }, [open]);

  const containerClass = [
    'fixed inset-0',
    layerClassName,
    mode === 'sheet'
      ? 'flex flex-col justify-end'
      : mode === 'side'
        ? 'flex justify-end'
        : 'flex items-center justify-center p-4',
  ].join(' ');

  // The sheet and the side drawer carry the safe-area insets for the edges they
  // touch. The framed card keeps them at md and up, where it is a desktop
  // surface; on a phone the container's padding already keeps it off the edges.
  const panelClass = [
    'bg-white dark:bg-[#111827] shadow-2xl flex flex-col font-sans transition-colors',
    mode === 'sheet'
      ? 'w-full max-h-[85vh] supports-[height:100dvh]:max-h-[85dvh] rounded-t-2xl border-t border-[#E5E7EB] dark:border-[#374151] safe-bottom safe-left safe-right'
      : mode === 'side'
        ? `h-full border-l border-[#E5E7EB] dark:border-[#374151] safe-top safe-right safe-bottom ${desktopSize}`
        : `w-full rounded-xl border border-[#E5E7EB] dark:border-[#374151] md:max-h-[85vh] ${desktopSize}${
            isPhone ? '' : ' safe-top safe-right safe-bottom'
          }`,
  ].join(' ');

  const panelVariants = useMemo(
    () =>
      mode === 'sheet'
        ? { hidden: { y: '100%' }, visible: { y: 0 }, exit: { y: '100%' } }
        : mode === 'side'
          ? { hidden: { x: '100%' }, visible: { x: 0 }, exit: { x: '100%' } }
          : { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } },
    [mode],
  );

  const panelTransition = reduceMotion
    ? NO_MOTION
    : mode === 'center'
      ? FADE
      : DRAWER_SPRING;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    // Consume the key so the surface holding focus is the only one that reacts.
    // Without this, a page-level Escape listener (the Ask Atlas panel) also
    // fires and closes the surface underneath this one.
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-surface"
          className={containerClass}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={{ hidden: {}, visible: {}, exit: {} }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            className="absolute inset-0 bg-black/30 pointer-events-none"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }}
            transition={reduceMotion ? NO_MOTION : FADE}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className={`${panelClass} outline-none`}
            variants={panelVariants}
            transition={panelTransition}
          >
            <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#111827]">
              <div className="min-w-0 flex-1">{header}</div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 shrink-0 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded-md transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {toolbar && <div className="shrink-0">{toolbar}</div>}

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>

            {footer && <div className="shrink-0">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
