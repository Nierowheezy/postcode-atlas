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
  onClear: () => void;
  onClose: () => void;
}

/**
 * Panel title bar: identity on the left, reply-language chip and clear/close
 * actions on the right. The chip sends its value along with every request so
 * replies come back in the chosen language (N-ATLAS's differentiator).
 */
export const AskAtlasHeader: React.FC<AskAtlasHeaderProps> = ({
  hasMessages,
  language,
  onLanguageChange,
  onClear,
  onClose,
}) => (
  <div className="flex items-center justify-between px-3 pt-2 pb-1">
    <div className="flex items-center gap-1.5 text-[#0F7B4D] dark:text-[#10B981]">
      <MessageSquare className="w-4 h-4" />
      <span className="text-xs font-semibold">Ask Atlas</span>
    </div>
    <div className="flex items-center gap-1">
      {/* appearance-none + fixed chevron keeps the arrow clear of the value */}
      <div className="relative inline-flex">
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value as AskLanguage)}
          aria-label="Reply language"
          title="Reply language"
          className="appearance-none cursor-pointer text-[10px] font-semibold rounded border border-[#E5E7EB] dark:border-[#374151] bg-transparent text-[#6B7280] dark:text-[#9CA3AF] pl-1.5 pr-5 py-0.5 outline-none focus:border-[#0F7B4D] dark:focus:border-[#10B981]"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value} title={lang.title}>
              {lang.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-[#6B7280] dark:text-[#9CA3AF]"
        />
      </div>
      {hasMessages && (
        <button
          onClick={onClear}
          className="p-1 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white rounded transition-colors"
          aria-label="Clear conversation"
          title="Clear conversation"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        onClick={onClose}
        className="p-1 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white rounded transition-colors"
        aria-label="Close Ask Atlas"
        title="Close"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);