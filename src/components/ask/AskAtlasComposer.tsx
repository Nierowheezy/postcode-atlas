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
    className="flex items-center gap-2 border-t border-[#E5E7EB] bg-white px-3 py-2.5 dark:border-[#1F2937] dark:bg-[#111827]"
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
      className="min-w-0 flex-1 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-shadow focus:border-[#0F7B4D]/50 focus:ring-2 focus:ring-[#0F7B4D]/15 dark:border-[#374151] dark:bg-[#1F2937] dark:text-white dark:focus:border-[#10B981]/50 dark:focus:ring-[#10B981]/20"
    />
    <button
      type="submit"
      disabled={!canSend}
      aria-label="Send message"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#008751] text-white transition-colors enabled:hover:bg-[#0F7B4D] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <SendHorizonal className="h-4 w-4" />
    </button>
  </form>
);
