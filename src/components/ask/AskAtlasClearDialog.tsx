/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/** Word the user must type to arm the destructive confirm, GitHub-style. */
const CONFIRM_WORD = 'delete';

/** Props for the clear-conversation confirmation dialog. */
export interface AskAtlasClearDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Type-to-confirm delete dialog for the conversation. The destructive button
 * stays disabled until the user types the confirm word, so an accidental click
 * cannot wipe a chat they still want.
 */
export const AskAtlasClearDialog: React.FC<AskAtlasClearDialogProps> = ({ open, onCancel, onConfirm }) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the typed word and focus the field each time the dialog opens.
  useEffect(() => {
    if (!open) return undefined;
    setValue('');
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  const armed = value.trim().toLowerCase() === CONFIRM_WORD;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ask-atlas-clear-title"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#111827] shadow-2xl p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 id="ask-atlas-clear-title" className="text-sm font-semibold text-[#111827] dark:text-white">
              Delete this conversation?
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#6B7280] dark:text-[#9CA3AF]">
              This permanently removes every message from this browser. It cannot be undone.
            </p>
          </div>
        </div>

        <label className="mt-4 block text-xs text-[#6B7280] dark:text-[#9CA3AF]">
          Type{' '}
          <span className="font-mono font-semibold text-[#111827] dark:text-white">{CONFIRM_WORD}</span> to
          confirm
        </label>
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              onCancel();
            }
            if (event.key === 'Enter' && armed) {
              event.preventDefault();
              onConfirm();
            }
          }}
          autoComplete="off"
          spellCheck={false}
          className="mt-1.5 w-full rounded-lg border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#1F2937] px-3 py-2 text-sm text-[#111827] dark:text-white placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/50"
          placeholder={CONFIRM_WORD}
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-xs font-medium text-[#374151] dark:text-[#D1D5DB] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!armed}
            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white enabled:hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Delete conversation
          </button>
        </div>
      </div>
    </div>
  );
};
