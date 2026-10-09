/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { AskAtlasMessage } from '../../lib/ask/types';
import { AskAtlasResultsList } from './AskAtlasResultsList';
import { AskAtlasDecodedCard } from './AskAtlasDecodedCard';
import { AskAtlasNearbyList } from './AskAtlasNearbyList';
import type { AskAtlasViewLocation } from './AskAtlasPanel';

/**
 * What the grounding footer may claim (feature 9). A reply is only labelled
 * verified when it carries a payload the app itself derived from an executed
 * tool result; "a tool ran somewhere" is a weaker claim.
 */
export function groundingBasis(message: AskAtlasMessage): 'payload' | 'tools' | 'none' {
  // A payload is derived client-side from an executed tool result, so it
  // carries its own proof. The 3c `grounding` flag is only a fallback for a
  // reply that carries no payload: it can disagree with a payload (a cached
  // reply, or a provider that answered from memory after a tool ran).
  if (message.lookup || message.results || message.decoded || message.nearby || message.mapAction) return 'payload';
  return message.grounding === 'atlas' ? 'tools' : 'none';
}

const FOOTER_TEXT: Record<ReturnType<typeof groundingBasis>, string> = {
  payload: 'Verified against NIPOST postcode data',
  tools: 'Answered from NIPOST tool results',
  none: 'Not verified against NIPOST data',
};

/** Props for a single conversation bubble. */
export interface AskAtlasMessageBubbleProps {
  message: AskAtlasMessage;
  /** Moves the map to this reply's location (feature 8). */
  onViewLocation?: (location: AskAtlasViewLocation) => void;
}

/**
 * One conversation entry: user, assistant, or error bubble, plus the
 * grounding footer on assistant replies and the `[View on map]` control when
 * a reply carries a location.
 */
export const AskAtlasMessageBubble: React.FC<AskAtlasMessageBubbleProps> = ({
  message,
  onViewLocation,
}) => (
  <div
    className={`text-xs rounded-lg px-2.5 py-2 max-w-[90%] ${
      message.role === 'user'
        ? 'bg-[#ECFDF5] dark:bg-[#064E3B]/60 text-[#111827] dark:text-[#D1FAE5] ml-auto'
        : message.role === 'error'
          ? 'bg-[#FEF2F2] dark:bg-[#450A0A]/60 text-[#991B1B] dark:text-[#FECACA] border border-[#FECACA] dark:border-[#7F1D1D]'
          : 'bg-[#F3F4F6] dark:bg-[#1F2937] text-[#111827] dark:text-[#E5E7EB]'
    }`}
  >
    <span className="whitespace-pre-wrap break-words block">{message.content}</span>
    {message.role === 'assistant' && message.lookup && (
      <span className="block mt-1.5 pt-1.5 border-t border-[#E5E7EB] dark:border-[#374151]">
        <span className="block font-mono text-sm font-semibold text-[#0F7B4D] dark:text-[#10B981]">
          {message.lookup.postcode}
        </span>
        {message.lookup.label && (
          <span className="block mt-0.5 text-[11px] text-[#111827] dark:text-[#E5E7EB]">
            {message.lookup.label}
          </span>
        )}
        {(message.lookup.stateName || message.lookup.lgaName) && (
          <span className="block text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
            {[message.lookup.stateName, message.lookup.lgaName].filter(Boolean).join(' / ')}
          </span>
        )}
        <span className="inline-block mt-1 text-[9px] font-mono uppercase tracking-wide text-[#0F7B4D] dark:text-[#10B981]">
          Verified postcode
        </span>
      </span>
    )}
    {message.role === 'assistant' && message.results && (
      <AskAtlasResultsList list={message.results} />
    )}
    {message.role === 'assistant' && message.decoded && (
      <AskAtlasDecodedCard decoded={message.decoded} />
    )}
    {message.role === 'assistant' && message.nearby && (
      <AskAtlasNearbyList list={message.nearby} />
    )}
    {message.role === 'assistant' && (
      <span className="block mt-1.5 pt-1.5 border-t border-[#E5E7EB] dark:border-[#374151] text-[10px] font-mono text-[#6B7280] dark:text-[#9CA3AF]">
        {FOOTER_TEXT[groundingBasis(message)]}
      </span>
    )}
    {message.role === 'assistant' && message.engine && (
      <span className="block text-[10px] font-mono text-[#6B7280] dark:text-[#9CA3AF]">
        via {message.engine.model} - attempt {message.engine.attempt}
      </span>
    )}
    {message.role === 'assistant' && message.engine?.provider === 'natlas' && (
      <span className="block mt-1 text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
        Served by N-ATLAS, Nigeria&apos;s open multilingual model by Awarri &amp; NCAIR.{' '}
        <a
          href="https://huggingface.co/NCAIR1/N-ATLaS"
          target="_blank"
          rel="noreferrer"
          className="underline text-[#0F7B4D] dark:text-[#10B981]"
        >
          Model card
        </a>
      </span>
    )}
    {message.role === 'assistant' && message.location && (
      <button
        type="button"
        onClick={() => onViewLocation?.(message.location as AskAtlasViewLocation)}
        disabled={!onViewLocation}
        title={
          onViewLocation
            ? `Show ${message.location.label} on the map`
            : 'Map control is not connected in this view'
        }
        className="mt-1.5 text-[11px] font-medium text-[#0F7B4D] dark:text-[#10B981] enabled:hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
      >
        [View on map]
      </button>
    )}
  </div>
);
