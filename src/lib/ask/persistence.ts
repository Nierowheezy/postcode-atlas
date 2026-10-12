/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Browser-local persistence for the Ask Atlas conversation. The panel is a
 * floating card the user opens and closes freely, so without this every close
 * would discard the chat. We keep the conversation and reply language in
 * localStorage until the user explicitly clears it.
 *
 * Everything here is best effort: private mode, a disabled store, or a full
 * quota must never break the panel, so reads and writes swallow their errors
 * and degrade to "no persistence" rather than throwing.
 */

import type { AskAtlasMessage, LanguageMode } from './types';

const STORAGE_KEY = 'ask-atlas:conversation:v1';

/** Most recent turns kept on disk, so a long chat cannot grow without bound. */
const MAX_PERSISTED_MESSAGES = 40;

/**
 * The persisted shape. `version` lets a future change migrate or drop it.
 * Version 2 stores the chip's `LanguageMode`, which can be `auto`; version 1
 * stored a fixed `AskLanguage` whose default was `en`.
 */
export interface PersistedConversation {
  version: 2;
  language: LanguageMode;
  messages: AskAtlasMessage[];
}

const LANGUAGES: readonly LanguageMode[] = ['auto', 'en', 'yo', 'ha', 'ig'];

function isLanguage(value: unknown): value is LanguageMode {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Narrow an unknown value to the fields the panel must render. */
function isMessage(value: unknown): value is AskAtlasMessage {
  if (typeof value !== 'object' || value === null) return false;
  const message = value as Record<string, unknown>;
  return (
    typeof message.id === 'string' &&
    (message.role === 'user' || message.role === 'assistant' || message.role === 'error') &&
    typeof message.content === 'string'
  );
}

/** Load the saved conversation, or null when there is nothing usable. */
export function loadConversation(): PersistedConversation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const messages = Array.isArray(record.messages) ? record.messages.filter(isMessage) : [];
    if (messages.length === 0) return null;
    // Version 1 had no Auto mode and forced `en`, so a saved `en` becomes Auto;
    // a deliberate non-English choice is preserved.
    const language: LanguageMode =
      record.version === 1 && record.language === 'en'
        ? 'auto'
        : isLanguage(record.language)
          ? record.language
          : 'auto';
    return { version: 2, language, messages };
  } catch {
    return null;
  }
}

/** Persist the conversation. Silently no-ops when storage is unavailable. */
export function saveConversation(language: LanguageMode, messages: AskAtlasMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedConversation = {
      version: 2,
      language,
      messages: messages.slice(-MAX_PERSISTED_MESSAGES),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage blocked: keep running without persistence.
  }
}

/** Remove the saved conversation. */
export function clearConversation(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
