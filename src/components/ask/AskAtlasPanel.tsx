/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { DraggableCard } from '../ui/DraggableCard';
import { AskLanguage, AskAtlasMessage, AskAtlasResponder, AtlasContextSnapshot, AtlasReferent } from '../../lib/ask/types';
import type { MapAction } from '../../lib/tools/types';
import { useAskAtlas } from '../../lib/ask/useAskAtlas';
import { clearConversation, loadConversation, saveConversation } from '../../lib/ask/persistence';
import { AskAtlasHeader } from './AskAtlasHeader';
import { AskAtlasMessageBubble } from './AskAtlasMessageBubble';
import { AskAtlasThinkingBubble } from './AskAtlasThinkingBubble';
import { AskAtlasComposer } from './AskAtlasComposer';
import { AskAtlasResizeHandle } from './AskAtlasResizeHandle';
import { AskAtlasClearDialog } from './AskAtlasClearDialog';

/**
 * An Ask Atlas panel: owns conversation state and delegates the actual send
 * (cache, retries, pending state) to the `useAskAtlas` hook. Rendering is
 * split into header / bubble / composer components.
 */
export interface AskAtlasViewLocation {
  lat: number;
  lng: number;
  label: string;
}

/** Props for the Ask Atlas panel. */
export interface AskAtlasPanelProps {
  responder: AskAtlasResponder;
  /** Snapshot of the current map selection, sent with every request. */
  getContext: () => AtlasContextSnapshot;
  onClose: () => void;
  /** Applies a validated `navigateMap` action (feature 8). */
  onMapAction?: (action: MapAction) => void;
  /** Moves the map to the coordinates on a reply (feature 8). */
  onViewLocation?: (location: AskAtlasViewLocation) => void;
}

let messageSeq = 0;

/** Factory for one conversation entry with a stable React key. */
function makeMessage(role: AskAtlasMessage['role'], content: string): AskAtlasMessage {
  messageSeq += 1;
  return { id: `msg-${messageSeq}`, role, content, timestamp: Date.now() };
}

/**
 * The place the conversation is about now (feature 10): the most recent
 * assistant reply that resolved one, else the map selection the user made
 * outside the conversation. Never derived from reply prose.
 */
export function latestReferent(messages: AskAtlasMessage[]): AtlasReferent | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === 'assistant' && message.referent) return message.referent;
  }
  return undefined;
}

/** Fallback when an error arrives without a usable message. */
const GENERIC_ERROR_COPY = 'I could not process that request.\n\nTry: "postcode for Ikeja, Lagos"';

/** Comfortable opening height for the conversation area, as a share of the viewport. */
const DEFAULT_LIST_HEIGHT_MIN = 300;
const DEFAULT_LIST_HEIGHT_MAX = 480;

/** A panel that opens at a usable size instead of collapsing to a sliver. */
function defaultListHeight(): number {
  if (typeof window === 'undefined') return 400;
  const preferred = Math.round(window.innerHeight * 0.62);
  return Math.min(DEFAULT_LIST_HEIGHT_MAX, Math.max(DEFAULT_LIST_HEIGHT_MIN, preferred));
}

/** Starter prompts offered on an empty conversation. */
const SUGGESTIONS = [
  'Postcode for Ikeja, Lagos',
  'List the LGAs in Kano',
  'What is near me?',
  'Decode FC-02-D43-LG-01',
];

/**
 * Restore a saved conversation, bumping the id counter past any restored ids so
 * newly created messages never collide with the ones read back from storage.
 */
function readPersistedConversation(): { messages: AskAtlasMessage[]; language: AskLanguage } {
  const saved = loadConversation();
  if (!saved) return { messages: [], language: 'en' };
  for (const message of saved.messages) {
    const parsed = Number.parseInt(message.id.replace(/^msg-/, ''), 10);
    if (Number.isFinite(parsed) && parsed > messageSeq) messageSeq = parsed;
  }
  return { messages: saved.messages, language: saved.language };
}

export const AskAtlasPanel: React.FC<AskAtlasPanelProps> = ({
  responder,
  getContext,
  onClose,
  onMapAction,
  onViewLocation,
}) => {
  const [initial] = useState(readPersistedConversation);
  const [messages, setMessages] = useState<AskAtlasMessage[]>(initial.messages);
  const [input, setInput] = useState('');
  // Reply language for the whole conversation; sent on every request.
  const [language, setLanguage] = useState<AskLanguage>(initial.language);
  // Conversation area height in px, set on open and updated by the grip.
  const [listHeight, setListHeight] = useState<number>(defaultListHeight);
  // The delete confirmation is modal, so Escape must not close the panel.
  const [clearOpen, setClearOpen] = useState(false);

  // Chat transport: reply cache + transport-aware retry, shared app-wide.
  const { send, isReplying, phase } = useAskAtlas(responder);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the composer when the panel opens.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape closes the panel, unless the delete dialog is capturing input.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !clearOpen) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, clearOpen]);

  // Keep the newest message (or the pending indicator) in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, isReplying]);

  // Persist to the browser so the chat survives closing and reopening the panel.
  useEffect(() => {
    if (messages.length === 0) {
      clearConversation();
      return;
    }
    saveConversation(language, messages);
  }, [messages, language]);

  const canSend = input.trim().length > 0 && !isReplying;

  /** Append the user turn, send it through the hook, append the outcome. */
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isReplying) return;

    // Feature 10: carry the place the conversation is currently about, so a
    // follow-up like "what are its LGAs?" has something to resolve against.
    const context = { ...getContext(), referent: latestReferent(messages) };
    // History = turns before this one; the current question travels as `text`.
    const history = messages;
    setMessages((prev) => [...prev, { ...makeMessage('user', text), context }]);
    setInput('');

    try {
      const res = await send({ text, context, history, language });
      const reply: AskAtlasMessage = {
        ...makeMessage('assistant', res.text),
        grounding: res.grounding,
        engine: res.engine,
        context,
        location: res.location,
        lookup: res.lookup,
        results: res.results,
        decoded: res.decoded,
        nearby: res.nearby,
        mapAction: res.mapAction,
        referent: res.referent,
      };
      setMessages((prev) => [...prev, reply]);
      // Feature 8: the tool already validated this action, so the map moves
      // for the request the user actually made.
      if (res.mapAction) onMapAction?.(res.mapAction);
    } catch (err) {
      // AskApiError messages are already user-facing copy; fall back to
      // a generic line for anything unexpected.
      const detail = err instanceof Error ? err.message : '';
      setMessages((prev) => [...prev, makeMessage('error', detail || GENERIC_ERROR_COPY)]);
    }
  };

  /** Ask for confirmation before deleting the conversation. */
  const requestClear = () => setClearOpen(true);

  /** Delete the conversation from state and browser storage, then refocus. */
  const confirmClear = () => {
    setMessages([]);
    clearConversation();
    setClearOpen(false);
    inputRef.current?.focus();
  };

  return (
    <DraggableCard
      className="w-[min(94vw,420px)]"
      renderHandle={(startDrag) => (
        <AskAtlasHeader
          hasMessages={messages.length > 0}
          language={language}
          onLanguageChange={setLanguage}
          onClear={requestClear}
          onClose={onClose}
          onDragStart={startDrag}
        />
      )}
    >
      <div
        ref={listRef}
        className="space-y-4 overflow-y-auto px-3.5 py-3"
        style={{ height: `${listHeight}px` }}
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-2 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#008751] to-[#0F7B4D] text-white shadow-sm">
              <MessageSquare className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-[#111827] dark:text-white">Ask about any Nigerian place</p>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              Postcodes, LGAs, districts, areas, or what&apos;s nearby.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1 text-[11px] text-[#374151] transition-colors hover:border-[#0F7B4D]/50 hover:text-[#0F7B4D] dark:border-[#374151] dark:bg-[#1F2937] dark:text-[#D1D5DB] dark:hover:border-[#10B981]/50 dark:hover:text-[#10B981]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <AskAtlasMessageBubble key={m.id} message={m} onViewLocation={onViewLocation} />
        ))}
        {isReplying && <AskAtlasThinkingBubble phase={phase} />}
      </div>

      <AskAtlasResizeHandle
        onResize={setListHeight}
        getCurrentHeight={() => listRef.current?.getBoundingClientRect().height ?? listHeight}
      />

      <AskAtlasComposer
        value={input}
        onChange={setInput}
        onSubmit={handleSend}
        canSend={canSend}
        inputRef={inputRef}
      />

      <AskAtlasClearDialog open={clearOpen} onCancel={() => setClearOpen(false)} onConfirm={confirmClear} />
    </DraggableCard>
  );
};
