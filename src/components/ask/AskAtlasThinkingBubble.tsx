/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { AskPhase } from '../../lib/ask/types';

/**
 * Human copy for each real reply phase, reported by the responder. The phases
 * track actual work (contacting N-ATLAS, running the client tool loop, writing
 * the answer), so the status line is honest rather than decorative.
 */
const PHASE_LINES: Record<AskPhase, string> = {
  connecting: 'Connecting to N-ATLAS...',
  thinking: 'Thinking...',
  searching: 'Searching the atlas...',
  verifying: 'Verifying against NIPOST data...',
  composing: 'Composing the answer...',
};

/** Fallback cycle for a responder that reports no phases. */
const FALLBACK_LINES = [
  'Connecting to N-ATLAS...',
  'Thinking...',
  'Searching the atlas...',
  'Wrapping up...',
];

/** How long each fallback line stays on screen. */
const LINE_INTERVAL_MS = 2200;

/** Props for the pending-reply indicator. */
export interface AskAtlasThinkingBubbleProps {
  /** The current real phase, when the responder reports one. */
  phase?: AskPhase | null;
}

/**
 * Shown while a reply is in flight: the assistant avatar with a spinner, the
 * current phase line, and a small progress shimmer.
 */
export const AskAtlasThinkingBubble: React.FC<AskAtlasThinkingBubbleProps> = ({ phase }) => {
  const [fallbackIndex, setFallbackIndex] = useState(0);

  useEffect(() => {
    if (phase) return undefined;
    const id = window.setInterval(
      () => setFallbackIndex((index) => (index + 1) % FALLBACK_LINES.length),
      LINE_INTERVAL_MS,
    );
    return () => window.clearInterval(id);
  }, [phase]);

  const label = phase ? PHASE_LINES[phase] : FALLBACK_LINES[fallbackIndex];

  return (
    <div role="status" className="flex gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#008751] to-[#0F7B4D] text-white shadow-sm">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        {/* One stable phrase for screen readers; the visible line is decorative. */}
        <span className="sr-only">Generating a reply...</span>
        <span
          aria-hidden="true"
          className="flex items-center gap-1.5 text-[13px] text-[#6B7280] dark:text-[#9CA3AF]"
        >
          <span className="truncate">{label}</span>
          <span className="flex shrink-0 items-end gap-0.5">
            <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
          </span>
        </span>
        <span className="mt-1.5 block h-1 w-32 max-w-[60%] overflow-hidden rounded-full bg-[#F3F4F6] dark:bg-[#1F2937]">
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-transparent via-[#0F7B4D]/50 to-transparent dark:via-[#10B981]/50" />
        </span>
      </div>
    </div>
  );
};
