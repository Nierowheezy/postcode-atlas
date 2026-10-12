import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearConversation, loadConversation, saveConversation } from './persistence';
import type { AskAtlasMessage } from './types';

const STORAGE_KEY = 'ask-atlas:conversation:v1';

/** Minimal localStorage so the node test environment can exercise persistence. */
function fakeWindow() {
  const store = new Map<string, string>();
  return {
    store,
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  };
}

const messages: AskAtlasMessage[] = [
  { id: 'msg-1', role: 'user', content: 'Kí ni kòòdù Ikeja?', timestamp: 1 },
];

describe('conversation persistence', () => {
  let win: ReturnType<typeof fakeWindow>;

  beforeEach(() => {
    win = fakeWindow();
    vi.stubGlobal('window', win);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips the Auto mode', () => {
    saveConversation('auto', messages);
    expect(loadConversation()).toMatchObject({ version: 2, language: 'auto' });
  });

  it('round-trips a manual language', () => {
    saveConversation('ha', messages);
    expect(loadConversation()?.language).toBe('ha');
  });

  it('migrates a version 1 English conversation to Auto', () => {
    win.store.set(STORAGE_KEY, JSON.stringify({ version: 1, language: 'en', messages }));
    expect(loadConversation()).toMatchObject({ version: 2, language: 'auto' });
  });

  it('preserves a deliberate version 1 non-English choice', () => {
    win.store.set(STORAGE_KEY, JSON.stringify({ version: 1, language: 'yo', messages }));
    expect(loadConversation()?.language).toBe('yo');
  });

  it('ignores a stored value with no usable messages', () => {
    win.store.set(STORAGE_KEY, JSON.stringify({ version: 2, language: 'auto', messages: [] }));
    expect(loadConversation()).toBeNull();
  });

  it('clears the stored conversation', () => {
    saveConversation('auto', messages);
    clearConversation();
    expect(loadConversation()).toBeNull();
  });
});
