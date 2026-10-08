/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { SendHorizonal } from 'lucide-react';

/** Props for the Ask Atlas message composer. */
export interface AskAtlasComposerProps {
  value: string;
  onChange: (next: string) => void;
  /** Called with the trimmed input when the form is submitted. */
  onSubmit: () => void;
  /** False while empty or while a reply is in flight. */
  canSend: boolean;
  /** Lets the panel focus the input on open and after clearing. */
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * Input row at the bottom of the panel. Purely controlled: the panel owns
 * the input value, reply state, and send logic.
 */
export const AskAtlasComposer: React.FC<AskAtlasComposerProps> = ({
  value,
  onChange,
  onSubmit,
  canSend,
  inputRef,
}) => (
  <form
    className="flex items-center gap-2 px-3 py-2 border-t border-[#E5E7EB] dark:border-[#374151]"
    onSubmit={(e) => {
      e.preventDefault();
      onSubmit();
    }}
  >
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Ask about a place or postcode..."
      aria-label="Ask Atlas message"
      className="flex-1 min-w-0 text-xs px-2.5 py-2 rounded-md border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-[#111827] dark:text-white placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#10B981]/50"
    />
    <button
      type="submit"
      disabled={!canSend}
      aria-label="Send message"
      className="p-2 rounded-md bg-[#008751] text-white enabled:hover:bg-[#0F7B4D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <SendHorizonal className="w-4 h-4" />
    </button>
  </form>
);
