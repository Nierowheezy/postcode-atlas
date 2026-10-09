/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { DraggableCard } from '../ui/DraggableCard';
import { AskLanguage, AskAtlasMessage, AskAtlasResponder, AtlasContextSnapshot } from '../../lib/ask/types';
import { useAskAtlas } from '../../lib/ask/useAskAtlas';
import { AskAtlasHeader } from './AskAtlasHeader';
import { AskAtlasMessageBubble } from './AskAtlasMessageBubble';
import { AskAtlasThinkingBubble } from './AskAtlasThinkingBubble';
import { AskAtlasComposer } from './AskAtlasComposer';
import { AskAtlasResizeHandle } from './AskAtlasResizeHandle';

interface AskAtlasPanelProps {
  responder: AskAtlasResponder;
  getContext: () => AtlasContextSnapshot;
  onClose: () => void;
}

let messageSeq = 0;

/** Factory for one conversation entry with a stable React key. */
function makeMessage(role: AskAtlasMessage['role'], content: string): AskAtlasMessage {
  messageSeq += 1;
  return { id: `msg-${messageSeq}`, role, content, timestamp: Date.now() };
}

/** Fallback when an error arrives without a usable message. */
const GENERIC_ERROR_COPY = 'I could not process that request.\n\nTry: "postcode for Ikeja, Lagos"';

/**
 * Ask Atlas panel: owns conversation state and delegates the actual send
 * (cache, retries, pending state) to the `useAskAtlas` hook. Rendering is
 * split into header / bubble / composer components.
 */
export const AskAtlasPanel: React.FC<AskAtlasPanelProps> = ({ responder, getContext, onClose }) => {
  const [messages, setMessages] = useState<AskAtlasMessage[]>([]);
  const [input, setInput] = useState('');
  // Reply language for the whole conversation; sent on every request.
  const [language, setLanguage] = useState<AskLanguage>('en');
  // Conversation area height: null = auto-grow with content (70vh cap);
  // a number = the px height set by dragging the resize handle.
  const [listHeight, setListHeight] = useState<number | null>(null);

  // Chat transport: reply cache + transport-aware retry, shared app-wide.
  const { send, isReplying } = useAskAtlas(responder);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the composer when the panel opens.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape closes the panel.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Keep the newest message in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const canSend = input.trim().length > 0 && !isReplying;

  /** Append the user turn, send it through the hook, append the outcome. */
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isReplying) return;

    const context = getContext();
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
      };
      setMessages((prev) => [...prev, reply]);
    } catch (err) {
      // AskApiError messages are already user-facing copy; fall back to
      // a generic line for anything unexpected.
      const detail = err instanceof Error ? err.message : '';
      setMessages((prev) => [...prev, makeMessage('error', detail || GENERIC_ERROR_COPY)]);
    }
  };

  /** Clear the conversation and return focus to the composer. */
  const handleClear = () => {
    setMessages([]);
    inputRef.current?.focus();
  };

  return (
    <DraggableCard dragHandleText="Ask Atlas" className="w-[min(92vw,380px)]">
      <AskAtlasHeader
        hasMessages={messages.length > 0}
        language={language}
        onLanguageChange={setLanguage}
        onClear={handleClear}
        onClose={onClose}
      />

      <div
        ref={listRef}
        className="px-3 py-2 space-y-2 min-h-[96px] overflow-y-auto border-t border-[#E5E7EB] dark:border-[#374151]"
        style={{
          maxHeight: listHeight === null ? '70vh' : undefined,
          height: listHeight === null ? undefined : `${listHeight}px`,
        }}
        aria-live="polite"
      >
        {messages.length === 0 && (
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed py-3 text-center">
            Ask a question in plain language, for example{' '}
            <span className="font-mono text-[#0F7B4D] dark:text-[#10B981]">
              &quot;What&apos;s the postcode for Ikeja?&quot;
            </span>
          </p>
        )}
        {messages.map((m) => (
          <AskAtlasMessageBubble key={m.id} message={m} />
        ))}
        {isReplying && <AskAtlasThinkingBubble />}
      </div>

      <AskAtlasResizeHandle
        onResize={setListHeight}
        getCurrentHeight={() => listHeight ?? listRef.current?.getBoundingClientRect().height ?? 0}
      />

      <AskAtlasComposer
        value={input}
        onChange={setInput}
        onSubmit={handleSend}
        canSend={canSend}
        inputRef={inputRef}
      />
    </DraggableCard>
  );
};
