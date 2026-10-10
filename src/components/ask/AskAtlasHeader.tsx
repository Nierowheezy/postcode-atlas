/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ChevronDown, MessageSquare, Trash2, X } from 'lucide-react';
import type { AskLanguage } from '../../lib/ask/types';

/** Reply languages offered by the chip; order matches LANGUAGE_NAMES in prompt.ts. */
const LANGUAGES: { value: AskLanguage; label: string; title: string }[] = [
  { value: 'en', label: 'EN', title: 'English' },
  { value: 'yo', label: 'YO', title: 'Yoruba' },
  { value: 'ha', label: 'HA', title: 'Hausa' },
  { value: 'ig', label: 'IG', title: 'Igbo' },
];

/** Props for the Ask Atlas panel header. */
export interface AskAtlasHeaderProps {
  /** Show the clear-conversation button only when there is a conversation. */
  hasMessages: boolean;
  /** Desired reply language, driven by the chip. */
  language: AskLanguage;
  onLanguageChange: (language: AskLanguage) => void;
  /** Opens the typed confirmation for deleting the conversation. */
  onClear: () => void;
  onClose: () => void;
  /** Starts dragging the panel; the header doubles as the drag handle. */
  onDragStart?: (event: React.PointerEvent) => void;
}

/**
 * Panel title bar: identity on the left, reply-language chip and controls on
 * the right. It is also the drag handle for the floating card, so the panel
 * has a single, clean header instead of a separate "hold & drag" bar.
 */
export const AskAtlasHeader: React.FC<AskAtlasHeaderProps> = ({
  hasMessages,
  language,
  onLanguageChange,
  onClear,
  onClose,
  onDragStart,
}) => (
  <div
    onPointerDown={onDragStart}
    className={`flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[#E5E7EB] dark:border-[#1F2937] bg-white/95 dark:bg-[#111827]/95 backdrop-blur ${
      onDragStart ? 'cursor-grab active:cursor-grabbing touch-none' : ''
    }`}
  >
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#008751] to-[#0F7B4D] text-white shadow-sm">
        <MessageSquare className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold leading-tight text-[#111827] dark:text-white">
          Ask Atlas
        </span>
        <span className="block truncate text-[10px] leading-tight text-[#6B7280] dark:text-[#9CA3AF]">
          N-ATLAS · Nigerian postcodes
        </span>
      </span>
    </div>

    {/* Controls must not start a panel drag when clicked. */}
    <div className="flex items-center gap-1" onPointerDown={(event) => event.stopPropagation()}>
      {/* appearance-none + fixed chevron keeps the arrow clear of the value */}
      <div className="relative inline-flex">
        <select
          value={language}
          onChange={(event) => onLanguageChange(event.target.value as AskLanguage)}
          aria-label="Reply language"
          title="Reply language"
          className="appearance-none cursor-pointer rounded-full border border-[#E5E7EB] dark:border-[#374151] bg-transparent py-0.5 pl-2 pr-5 text-[10px] font-semibold text-[#6B7280] dark:text-[#9CA3AF] outline-none focus:border-[#0F7B4D] dark:focus:border-[#10B981]"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value} title={lang.title}>
              {lang.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-[#6B7280] dark:text-[#9CA3AF]"
        />
      </div>
      {hasMessages && (
        <button
          onClick={onClear}
          className="rounded-full p-1.5 text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600 dark:text-[#9CA3AF] dark:hover:bg-red-500/10 dark:hover:text-red-400"
          aria-label="Clear conversation"
          title="Clear conversation"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={onClose}
        className="rounded-full p-1.5 text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827] dark:text-[#9CA3AF] dark:hover:bg-[#1F2937] dark:hover:text-white"
        aria-label="Close Ask Atlas"
        title="Close"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);
