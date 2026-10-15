/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { DraggableCard } from '../ui/DraggableCard';
import { LanguageMode, AskAtlasMessage, AskAtlasResponder, AtlasContextSnapshot, AtlasReferent } from '../../lib/ask/types';
import { detectLanguage } from '../../lib/ask/language';
import type { MapAction } from '../../lib/tools/types';
import type { SavedDiscovery } from '../../lib/saved/types';
import { useAskAtlas } from '../../lib/ask/useAskAtlas';
import { clearConversation, loadConversation, saveConversation } from '../../lib/ask/persistence';
import { AskAtlasHeader } from './AskAtlasHeader';
import { AskAtlasMessageBubble } from './AskAtlasMessageBubble';
import { AskAtlasThinkingBubble } from './AskAtlasThinkingBubble';
import { AskAtlasComposer } from './AskAtlasComposer';
import { AskAtlasResizeHandle } from './AskAtlasResizeHandle';
import { AskAtlasClearDialog } from './AskAtlasClearDialog';
import { maxListHeight } from '../../lib/ask/panelLayout';
import { composeDictation } from '../../lib/ask/speech';
import { useSpeechRecognition, type SpeechError } from '@/src/hooks/useSpeechRecognition';

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
  /**
   * Element the card is dragged within and the area the grip may grow into, so
   * the panel cannot be pulled off screen or pushed out of the map area. Passed
   * in by the shell; omitting it keeps the free drag and a window-based ceiling.
   */
  dragConstraintsRef?: React.RefObject<HTMLElement | null>;
  /** Whether a reply's savable finding is already saved (feature 20). */
  isMessageSaved?: (message: AskAtlasMessage) => boolean;
  /** Save or remove a reply's finding (feature 20). */
  onToggleSaveDiscovery?: (discovery: SavedDiscovery) => void;
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
function readPersistedConversation(): { messages: AskAtlasMessage[]; language: LanguageMode } {
  const saved = loadConversation();
  if (!saved) return { messages: [], language: 'auto' };
  for (const message of saved.messages) {
    const parsed = Number.parseInt(message.id.replace(/^msg-/, ''), 10);
    if (Number.isFinite(parsed) && parsed > messageSeq) messageSeq = parsed;
  }
  return { messages: saved.messages, language: saved.language };
}

function getSpeechErrorCopy(error: SpeechError | null): string | null {
  if (error === 'permission') {
    return 'Microphone access was blocked. Allow microphone access to use voice input.';
  }
  if (error === 'no-speech') {
    return 'No speech heard. Try speaking again.';
  }
  if (error === 'network') {
    return 'Voice input is unavailable right now. Check your connection and try again.';
  }
  if (error === 'other') {
    return 'Voice input is unavailable right now.';
  }
  return null;
}

export const AskAtlasPanel: React.FC<AskAtlasPanelProps> = ({
  responder,
  getContext,
  onClose,
  onMapAction,
  onViewLocation,
  dragConstraintsRef,
  isMessageSaved,
  onToggleSaveDiscovery,
}) => {
  const [initial] = useState(readPersistedConversation);
  const [messages, setMessages] = useState<AskAtlasMessage[]>(initial.messages);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState<LanguageMode>(initial.language);
  const [listHeight, setListHeight] = useState<number>(defaultListHeight);
  const [clearOpen, setClearOpen] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const dictationBaseRef = useRef('');

  const { send, isReplying, phase } = useAskAtlas(responder);
  const speech = useSpeechRecognition(language);
  const micBusy = isReplying;

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !clearOpen) {
        speech.stop();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, clearOpen, speech]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, isReplying]);
  useEffect(() => {
    if (messages.length === 0) {
      clearConversation();
      return;
    }
    saveConversation(language, messages);
  }, [messages, language]);
  useEffect(() => {
    const copy = getSpeechErrorCopy(speech.error);
    setMicError(copy);
  }, [speech.error]);
  useEffect(() => {
    if (!speech.listening) {
      return;
    }
    setMicError(null);
  }, [speech.listening]);

  // While dictating, the composer shows a read-only preview built from the text
  // captured at start plus the recognition output. `input` is not touched until
  // confirm, so cancel can restore it exactly.
  const dictationPreview = composeDictation(dictationBaseRef.current, speech.transcript, speech.interim);
  const composerValue = speech.listening ? dictationPreview : input;

  const canSend = input.trim().length > 0 && !isReplying && !speech.listening;

  const startDictation = () => {
    if (micBusy || speech.listening) return;
    setMicError(null);
    // Captured before start() so the live preview composes from the text
    // already in the field rather than a stale base from a prior session.
    dictationBaseRef.current = input;
    speech.start();
  };

  const commitDictation = () => {
    const next = composeDictation(dictationBaseRef.current, speech.transcript, '');
    speech.stop();
    setInput(next);
    inputRef.current?.focus();
  };

  const cancelDictation = () => {
    speech.stop();
    inputRef.current?.focus();
  };

  const updateInput = (next: string) => setInput(next);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isReplying) return;
    speech.stop();
    const auto = language === 'auto';
    const replyLanguage = auto ? detectLanguage(text).replyLanguage : language;
    const context = { ...getContext(), referent: latestReferent(messages) };
    setMessages((prev) => [...prev, { ...makeMessage('user', text), context }]);
    setInput('');
    try {
      const res = await send({ text, context, language: replyLanguage });
      const reply: AskAtlasMessage = {
        ...makeMessage('assistant', res.text),
        question: text,
        grounding: res.grounding,
        engine: res.engine,
        context,
        location: res.location,
        lookup: res.lookup,
        results: res.results,
        decoded: res.decoded,
        nearby: res.nearby,
        mapAction: res.mapAction,
        address: res.address,
        explanation: res.explanation,
        referent: res.referent,
        replyLanguage,
        autoDetected: auto,
      };
      setMessages((prev) => [...prev, reply]);
      if (res.mapAction) onMapAction?.(res.mapAction);
    } catch (err) {
      const detail = err instanceof Error ? err.message : '';
      setMessages((prev) => [...prev, makeMessage('error', detail || GENERIC_ERROR_COPY)]);
    }
  };

  const requestClear = () => setClearOpen(true);
  const confirmClear = () => {
    speech.stop();
    setMessages([]);
    clearConversation();
    setClearOpen(false);
    inputRef.current?.focus();
  };

  const handleClose = () => {
    speech.stop();
    onClose();
  };

  const handleLanguageChange = (next: LanguageMode) => {
    if (speech.listening) {
      speech.stop();
    }
    setLanguage(next);
  };

  return (
    <DraggableCard
      className="w-[min(94vw,420px)] pointer-events-auto flex flex-col ask-atlas-panel-fit"
      dragConstraintsRef={dragConstraintsRef}
      renderHandle={(startDrag) => (
        <AskAtlasHeader
          hasMessages={messages.length > 0}
          language={language}
          onLanguageChange={handleLanguageChange}
          onClear={requestClear}
          onClose={handleClose}
          onDragStart={startDrag}
        />
      )}
    >
      <div
        ref={listRef}
        className="space-y-4 overflow-y-auto px-3.5 py-3 min-h-0"
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
          <AskAtlasMessageBubble
            key={m.id}
            message={m}
            onViewLocation={onViewLocation}
            onMapAction={onMapAction}
            isSaved={isMessageSaved?.(m)}
            onToggleSave={onToggleSaveDiscovery}
          />
        ))}
        {isReplying && <AskAtlasThinkingBubble phase={phase} />}
        <div aria-live="polite" className="sr-only">
          {speech.listening ? 'Listening for voice input' : ''}
          {micError || ''}
        </div>
      </div>

      <AskAtlasResizeHandle
        onResize={setListHeight}
        getCurrentHeight={() => listRef.current?.getBoundingClientRect().height ?? listHeight}
        getMaxHeight={() => {
          const panel = listRef.current?.closest<HTMLElement>('.ask-atlas-panel-fit');
          const host = panel?.parentElement;
          if (!panel || !host || !listRef.current) return listHeight;
          const panelRect = panel.getBoundingClientRect();
          const hostStyle = window.getComputedStyle(host);
          const fitCap =
            host.clientHeight -
            Number.parseFloat(hostStyle.paddingTop || '0') -
            Number.parseFloat(hostStyle.paddingBottom || '0');
          return maxListHeight({
            currentHeight: listRef.current.getBoundingClientRect().height,
            panelHeight: panelRect.height,
            panelTop: panelRect.top,
            panelMaxHeight: fitCap,
            containerTop: dragConstraintsRef?.current?.getBoundingClientRect().top ?? 0,
            viewportHeight: window.innerHeight,
          });
        }}
      />

      <AskAtlasComposer
        value={composerValue}
        onChange={updateInput}
        onSubmit={handleSend}
        canSend={canSend}
        inputRef={inputRef}
        micSupported={speech.supported}
        listening={speech.listening}
        onStartMic={startDictation}
        onCommitMic={commitDictation}
        onCancelMic={cancelDictation}
        micError={micError}
        busy={micBusy}
        readOnly={speech.listening}
      />

      <AskAtlasClearDialog open={clearOpen} onCancel={() => setClearOpen(false)} onConfirm={confirmClear} />
    </DraggableCard>
  );
};