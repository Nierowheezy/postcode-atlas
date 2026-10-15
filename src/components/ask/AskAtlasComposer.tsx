/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Check, Mic, SendHorizonal, X } from 'lucide-react';

import { useIsCoarsePointer } from '@/src/hooks/useMediaQuery';

/** Props for the Ask Atlas message composer. */
export interface AskAtlasComposerProps {
  value: string;
  onChange: (next: string) => void;
  /** Called with the trimmed input when the form is submitted. */
  onSubmit: () => void;
  /** False while empty, while dictating, or while a reply is in flight. */
  canSend: boolean;
  /** Lets the panel focus the composer on open and after clearing. */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** Voice input support. */
  micSupported?: boolean;
  listening?: boolean;
  onStartMic?: () => void;
  /** Ends dictation and keeps the transcript. */
  onCommitMic?: () => void;
  /** Ends dictation and discards the transcript. */
  onCancelMic?: () => void;
  micError?: string | null;
  /** Disable composer actions while a reply is in flight. */
  busy?: boolean;
  /** Dictation owns the field while it runs. */
  readOnly?: boolean;
}

/** Composer grows to about five lines, then scrolls internally. */
const MAX_COMPOSER_HEIGHT = 128;

/**
 * Input row at the bottom of the panel. Purely controlled: the panel owns the
 * value, reply state, dictation session, and send logic. The field is a
 * textarea so a long dictated question wraps upward instead of scrolling out of
 * view to the right.
 */
export const AskAtlasComposer: React.FC<AskAtlasComposerProps> = ({
  value,
  onChange,
  onSubmit,
  canSend,
  inputRef,
  micSupported,
  listening,
  onStartMic,
  onCommitMic,
  onCancelMic,
  micError,
  busy,
  readOnly,
}) => {
  const isListening = Boolean(listening);
  const coarsePointer = useIsCoarsePointer();

  useEffect(() => {
    const field = inputRef?.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
    field.style.overflowY = field.scrollHeight > MAX_COMPOSER_HEIGHT ? 'auto' : 'hidden';
  }, [value, inputRef]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    // A touch keypad keeps Enter as a newline and uses the Send button; a
    // physical keyboard sends, as in ChatGPT and Slack.
    if (coarsePointer || isListening) return;
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      className="shrink-0 flex items-end gap-2 border-t border-[#E5E7EB] bg-white px-3 py-2.5 dark:border-[#1F2937] dark:bg-[#111827]"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <textarea
        ref={inputRef}
        rows={1}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about a place or postcode..."
        aria-label="Ask Atlas message"
        aria-describedby={micError ? 'ask-atlas-mic-error' : undefined}
        enterKeyHint={coarsePointer ? 'enter' : 'send'}
        className="min-w-0 flex-1 max-h-32 resize-none rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2 text-[13px] leading-5 text-[#111827] placeholder:text-[#9CA3AF] outline-none transition-shadow focus:border-[#0F7B4D]/50 focus:ring-2 focus:ring-[#0F7B4D]/15 read-only:text-[#6B7280] dark:border-[#374151] dark:bg-[#1F2937] dark:text-white dark:read-only:text-[#9CA3AF] dark:focus:border-[#10B981]/50 dark:focus:ring-[#10B981]/20"
      />
      {micSupported &&
        (isListening ? (
          <>
            <span
              aria-hidden="true"
              className="flex h-9 shrink-0 items-center gap-0.5 rounded-full bg-[#FEE2E2] px-2.5 dark:bg-[#7F1D1D]/40"
            >
              {[0, 1, 2].map((bar) => (
                <span
                  key={bar}
                  className="atlas-voice-bar block w-0.5 rounded-full bg-[#EF4444] dark:bg-[#F87171]"
                  style={{ animationDelay: `${bar * 160}ms` }}
                />
              ))}
            </span>
            <button
              type="button"
              onClick={onCancelMic}
              aria-label="Cancel voice input"
              className="flex h-9 w-9 shrink-0 touch-target items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111827] transition-colors hover:bg-[#F9FAFB] dark:border-[#374151] dark:bg-[#1F2937] dark:text-white dark:hover:bg-[#111827]"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onCommitMic}
              aria-label="Confirm voice input"
              className="flex h-9 w-9 shrink-0 touch-target items-center justify-center rounded-full bg-[#008751] text-white transition-colors hover:bg-[#0F7B4D]"
            >
              <Check className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onStartMic}
            disabled={busy}
            aria-label="Start voice input"
            className="flex h-9 w-9 shrink-0 touch-target items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111827] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#374151] dark:bg-[#1F2937] dark:text-white dark:hover:bg-[#111827]"
          >
            <Mic className="h-4 w-4" />
          </button>
        ))}
      {!isListening && (
        <button
          type="submit"
          disabled={!canSend || busy}
          aria-label="Send message"
          className="flex h-9 w-9 shrink-0 touch-target items-center justify-center rounded-full bg-[#008751] text-white transition-colors enabled:hover:bg-[#0F7B4D] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendHorizonal className="h-4 w-4" />
        </button>
      )}
      {micError && (
        <div id="ask-atlas-mic-error" aria-live="polite" className="sr-only">
          {micError}
        </div>
      )}
    </form>
  );
};
