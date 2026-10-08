/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, SendHorizonal, Trash2, X } from 'lucide-react';
import { DraggableCard } from '../ui/DraggableCard';
import { AskAtlasMessage, AskAtlasResponder, AtlasContextSnapshot } from '../../lib/ask/types';

interface AskAtlasPanelProps {
  responder: AskAtlasResponder;
  getContext: () => AtlasContextSnapshot;
  onClose: () => void;
}

let messageSeq = 0;

function makeMessage(role: AskAtlasMessage['role'], content: string): AskAtlasMessage {
  messageSeq += 1;
  return { id: `msg-${messageSeq}`, role, content, timestamp: Date.now() };
}

export const AskAtlasPanel: React.FC<AskAtlasPanelProps> = ({ responder, getContext, onClose }) => {
  const [messages, setMessages] = useState<AskAtlasMessage[]>([]);
  const [input, setInput] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const canSend = input.trim().length > 0 && !isReplying;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isReplying) return;

    const ctx = getContext();
    setMessages((prev) => [...prev, { ...makeMessage('user', text), context: ctx }]);
    setInput('');
    setIsReplying(true);

    try {
      const res = await responder.respond(text, ctx);
      setMessages((prev) => [
        ...prev,
        { ...makeMessage('assistant', res.text), grounding: res.grounding, context: ctx, location: res.location },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        makeMessage('error', 'I could not process that request.\n\nTry: "postcode for Ikeja, Lagos"'),
      ]);
    } finally {
      setIsReplying(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    inputRef.current?.focus();
  };

  return (
    <DraggableCard dragHandleText="Ask Atlas" className="w-[min(92vw,380px)]">
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <div className="flex items-center gap-1.5 text-[#0F7B4D] dark:text-[#10B981]">
          <MessageSquare className="w-4 h-4" />
          <span className="text-xs font-semibold">Ask Atlas</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
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
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={listRef}
        className="px-3 py-2 space-y-2 max-h-[45vh] min-h-[96px] overflow-y-auto border-t border-[#E5E7EB] dark:border-[#374151]"
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
          <div
            key={m.id}
            className={`text-xs rounded-lg px-2.5 py-2 max-w-[90%] ${
              m.role === 'user'
                ? 'bg-[#ECFDF5] dark:bg-[#064E3B]/60 text-[#111827] dark:text-[#D1FAE5] ml-auto'
                : m.role === 'error'
                  ? 'bg-[#FEF2F2] dark:bg-[#450A0A]/60 text-[#991B1B] dark:text-[#FECACA] border border-[#FECACA] dark:border-[#7F1D1D]'
                  : 'bg-[#F3F4F6] dark:bg-[#1F2937] text-[#111827] dark:text-[#E5E7EB]'
            }`}
          >
            <span className="whitespace-pre-wrap break-words block">{m.content}</span>
            {m.role === 'assistant' && (
              <span className="block mt-1.5 pt-1.5 border-t border-[#E5E7EB] dark:border-[#374151] text-[10px] font-mono text-[#6B7280] dark:text-[#9CA3AF]">
                {m.grounding === 'atlas'
                  ? 'Verified against NIPOST postcode data'
                  : 'Not verified - placeholder responder'}
              </span>
            )}
            {m.role === 'assistant' && m.location && (
              <button
                type="button"
                disabled
                title="Map navigation arrives in feature 8"
                className="mt-1.5 text-[11px] font-medium text-[#0F7B4D] dark:text-[#10B981] opacity-60 cursor-not-allowed"
              >
                [View on map]
              </button>
            )}
          </div>
        ))}
        {isReplying && (
          <div className="text-xs rounded-lg px-2.5 py-2 max-w-[90%] bg-[#F3F4F6] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF] animate-pulse">
            Understanding your request...
          </div>
        )}
      </div>

      <form
        className="flex items-center gap-2 px-3 py-2 border-t border-[#E5E7EB] dark:border-[#374151]"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
    </DraggableCard>
  );
};
