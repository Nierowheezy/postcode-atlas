/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MessageSquare } from 'lucide-react';
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
export function groundingBasis(message: AskAtlasMessage): 'payload' | 'map' | 'tools' | 'none' {
  // A payload is derived client-side from an executed tool result, so it
  // carries its own proof. The 3c `grounding` flag is only a fallback for a
  // reply that carries no payload: it can disagree with a payload (a cached
  // reply, or a provider that answered from memory after a tool ran).
  if (message.lookup || message.results || message.decoded || message.nearby) return 'payload';
  // A map move shows no postcode data, so it is labelled for what it is rather
  // than claiming postcode verification.
  if (message.mapAction) return 'map';
  return message.grounding === 'atlas' ? 'tools' : 'none';
}

const FOOTER_TEXT: Record<ReturnType<typeof groundingBasis>, string> = {
  payload: 'Verified against NIPOST postcode data',
  map: 'Map moved using NIPOST location data',
  tools: 'Answered from NIPOST tool results',
  none: 'Not verified against NIPOST data',
};

/** Props for a single conversation turn. */
export interface AskAtlasMessageBubbleProps {
  message: AskAtlasMessage;
  /** Moves the map to this reply's location (feature 8). */
  onViewLocation?: (location: AskAtlasViewLocation) => void;
}

/** Small round mark that heads every assistant turn. */
const AssistantAvatar: React.FC = () => (
  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#008751] to-[#0F7B4D] text-white shadow-sm">
    <MessageSquare className="h-3 w-3" />
  </span>
);

/**
 * One conversation turn. User questions sit in a right-aligned bubble; the
 * assistant answers as plain, full-width prose under its avatar, Grok-style.
 * Structured payloads (lookup, list, decode, nearby) render as cards beneath.
 */
export const AskAtlasMessageBubble: React.FC<AskAtlasMessageBubbleProps> = ({ message, onViewLocation }) => {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[#0F7B4D] px-3.5 py-2 text-[13px] leading-relaxed text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === 'error') {
    return (
      <div className="flex gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-[13px] font-semibold text-red-600 dark:bg-red-500/15 dark:text-red-400">
          !
        </span>
        <div className="min-w-0 flex-1 whitespace-pre-wrap break-words rounded-2xl rounded-tl-md border border-red-200 bg-red-50 px-3.5 py-2 text-[13px] leading-relaxed text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 pt-0.5 text-[13px] leading-relaxed text-[#111827] dark:text-[#E5E7EB]">
        <span className="block whitespace-pre-wrap break-words">{message.content}</span>

        {message.lookup && (
          <span className="mt-2 block rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 dark:border-[#374151] dark:bg-[#1F2937]">
            <span className="block font-mono text-sm font-semibold text-[#0F7B4D] dark:text-[#10B981]">
              {message.lookup.postcode}
            </span>
            {message.lookup.label && (
              <span className="mt-0.5 block text-[11px] text-[#111827] dark:text-[#E5E7EB]">
                {message.lookup.label}
              </span>
            )}
            {(message.lookup.stateName || message.lookup.lgaName) && (
              <span className="block text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                {[message.lookup.stateName, message.lookup.lgaName].filter(Boolean).join(' · ')}
              </span>
            )}
          </span>
        )}

        {message.results && <AskAtlasResultsList list={message.results} />}
        {message.decoded && <AskAtlasDecodedCard decoded={message.decoded} />}
        {message.nearby && <AskAtlasNearbyList list={message.nearby} />}

        {message.location && (
          <button
            type="button"
            onClick={() => onViewLocation?.(message.location as AskAtlasViewLocation)}
            disabled={!onViewLocation}
            title={
              onViewLocation
                ? `Show ${message.location.label} on the map`
                : 'Map control is not connected in this view'
            }
            className="mt-2 block text-[11px] font-medium text-[#0F7B4D] enabled:hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#10B981]"
          >
            [View on map]
          </button>
        )}

        <span className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-[#9CA3AF] dark:text-[#6B7280]">
          <span>{FOOTER_TEXT[groundingBasis(message)]}</span>
          {message.engine && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono">
                {message.engine.provider} · try {message.engine.attempt}
              </span>
            </>
          )}
        </span>

        {message.engine?.provider === 'natlas' && (
          <span className="mt-0.5 block text-[10px] text-[#9CA3AF] dark:text-[#6B7280]">
            Served by N-ATLAS, Nigeria&apos;s open multilingual model by Awarri &amp; NCAIR.{' '}
            <a
              href="https://huggingface.co/NCAIR1/N-ATLaS"
              target="_blank"
              rel="noreferrer"
              className="text-[#0F7B4D] underline dark:text-[#10B981]"
            >
              Model card
            </a>
          </span>
        )}
      </div>
    </div>
  );
};
