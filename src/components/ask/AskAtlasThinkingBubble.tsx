/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Shown while a reply is in flight. The status lines cycle on a timer as a
 * decorative approximation of the client tool loop; they are deliberately not
 * wired to real provider phases (zero transport change).
 */
const STATUS_LINES = [
  'Contacting Ask Atlas...',
  'Searching the atlas...',
  'Verifying the postcode...',
  'Wrapping up...',
];

/** How long each status line stays on screen. */
const LINE_INTERVAL_MS = 2400;

/** Animated pending bubble: spinner, cycling status text, bouncing dots. */
export const AskAtlasThinkingBubble: React.FC = () => {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLineIndex((prev) => (prev + 1) % STATUS_LINES.length);
    }, LINE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      className="text-xs rounded-lg px-2.5 py-2 max-w-[90%] bg-[#F3F4F6] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-2"
    >
      <Loader2
        className="w-3.5 h-3.5 shrink-0 animate-spin text-[#0F7B4D] dark:text-[#10B981]"
        aria-hidden="true"
      />
      {/* One stable phrase for screen readers; the cycling line is decorative. */}
      <span className="sr-only">Generating a reply...</span>
      <span className="min-w-0 truncate" aria-hidden="true">
        {STATUS_LINES[lineIndex]}
      </span>
      <span className="flex items-end gap-0.5 shrink-0" aria-hidden="true">
        <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
        <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
        <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
      </span>
    </div>
  );
};
