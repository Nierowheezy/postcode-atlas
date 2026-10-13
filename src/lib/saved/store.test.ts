/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedDiscovery } from './types';

const STORAGE_KEY = 'atlas:saved-discoveries:v1';

/** Minimal window so the node test environment can exercise the store. */
function fakeWindow(withEvents = true) {
  const store = new Map<string, string>();
  const listeners = new Set<(event: { key: string | null }) => void>();
  return {
    store,
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
    addEventListener: withEvents
      ? (_type: string, cb: (event: { key: string | null }) => void) => void listeners.add(cb)
      : undefined,
    removeEventListener: withEvents
      ? (_type: string, cb: (event: { key: string | null }) => void) => void listeners.delete(cb)
      : undefined,
    emitStorage: (key: string) => {
      for (const cb of listeners) cb({ key });
    },
  };
}

/** Fresh module so the store's in-memory cache starts empty for each test. */
async function loadStore() {
  vi.resetModules();
  return import('./store');
}

const draft = (over: Partial<SavedDiscovery> = {}): SavedDiscovery => ({
  id: 'postcode:FC-02-D43-LG-01',
  kind: 'postcode',
  label: 'Test landmark',
  postcode: 'FC-02-D43-LG-01',
  savedAt: 0,
  ...over,
});

let win: ReturnType<typeof fakeWindow>;

beforeEach(() => {
  win = fakeWindow();
  vi.stubGlobal('window', win);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saved discovery store', () => {
  it('starts empty', async () => {
    const store = await loadStore();
    expect(store.listSaved()).toHaveLength(0);
    expect(store.isSaved('postcode:FC-02-D43-LG-01')).toBe(false);
  });

  it('toggles on, stamps savedAt, and persists', async () => {
    const store = await loadStore();
    expect(store.toggleSaved(draft())).toBe(true);
    const [row] = store.listSaved();
    expect(row.id).toBe('postcode:FC-02-D43-LG-01');
    expect(row.savedAt).toBeGreaterThan(0);
    expect(store.isSaved('postcode:FC-02-D43-LG-01')).toBe(true);
    expect(JSON.parse(win.store.get(STORAGE_KEY) as string)).toHaveLength(1);
  });

  it('toggles the same id off instead of duplicating it', async () => {
    const store = await loadStore();
    store.toggleSaved(draft());
    expect(store.toggleSaved(draft())).toBe(false);
    expect(store.listSaved()).toHaveLength(0);
  });

  it('keeps the newest first', async () => {
    const store = await loadStore();
    store.toggleSaved(draft({ id: 'postcode:AA-01-AAAA-AA-01', label: 'First' }));
    store.toggleSaved(draft({ id: 'postcode:BB-01-BBBB-BB-01', label: 'Second' }));
    expect(store.listSaved().map((row) => row.label)).toEqual(['Second', 'First']);
  });

  it('removes one row and clears all', async () => {
    const store = await loadStore();
    store.toggleSaved(draft({ id: 'postcode:AA-01-AAAA-AA-01' }));
    store.toggleSaved(draft({ id: 'postcode:BB-01-BBBB-BB-01' }));
    store.removeSaved('postcode:AA-01-AAAA-AA-01');
    expect(store.listSaved().map((row) => row.id)).toEqual(['postcode:BB-01-BBBB-BB-01']);
    store.clearSaved();
    expect(store.listSaved()).toHaveLength(0);
  });

  it('caps the list and drops the oldest', async () => {
    const store = await loadStore();
    for (let i = 0; i <= store.MAX_SAVED; i += 1) {
      store.toggleSaved(draft({ id: `postcode:C${i}`, label: `Row ${i}` }));
    }
    const rows = store.listSaved();
    expect(rows).toHaveLength(store.MAX_SAVED);
    expect(rows.some((row) => row.id === 'postcode:C0')).toBe(false);
    expect(rows.some((row) => row.id === `postcode:C${store.MAX_SAVED}`)).toBe(true);
  });

  it('reads persisted rows newest first', async () => {
    win.store.set(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'older', kind: 'place', label: 'Older', savedAt: 1 },
        { id: 'newer', kind: 'place', label: 'Newer', savedAt: 5 },
      ]),
    );
    const store = await loadStore();
    expect(store.listSaved().map((row) => row.id)).toEqual(['newer', 'older']);
  });

  it('ignores corrupt JSON', async () => {
    win.store.set(STORAGE_KEY, '{not json');
    const store = await loadStore();
    expect(store.listSaved()).toHaveLength(0);
  });

  it('drops entries with an unknown shape or kind, keeping valid rows', async () => {
    win.store.set(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'a' },
        42,
        null,
        { id: 'bad-kind', kind: 'nope', label: 'bad', savedAt: 1 },
        { id: 'ok', kind: 'place', label: 'Good', savedAt: 2 },
      ]),
    );
    const store = await loadStore();
    expect(store.listSaved().map((row) => row.id)).toEqual(['ok']);
  });

  it('returns a stable snapshot between reads and a new one after a mutation', async () => {
    const store = await loadStore();
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);
    store.toggleSaved(draft());
    expect(store.getSnapshot()).not.toBe(first);
  });

  it('serves an empty snapshot for a server render', async () => {
    const store = await loadStore();
    store.toggleSaved(draft());
    expect(store.getServerSnapshot()).toHaveLength(0);
  });

  it('reloads from storage when another tab writes the same key', async () => {
    const store = await loadStore();
    const seen: number[] = [];
    const unsubscribe = store.subscribe(() => seen.push(store.getSnapshot().length));
    win.store.set(STORAGE_KEY, JSON.stringify([draft({ id: 'postcode:ZZ-09-ZZZZ-ZZ-09', savedAt: 9 })]));
    win.emitStorage(STORAGE_KEY);
    expect(store.listSaved().map((row) => row.id)).toEqual(['postcode:ZZ-09-ZZZZ-ZZ-09']);
    expect(seen.length).toBeGreaterThan(0);
    unsubscribe();
  });

  it('subscribes without a listener API instead of throwing', async () => {
    win = fakeWindow(false);
    vi.stubGlobal('window', win);
    const store = await loadStore();
    const unsubscribe = store.subscribe(() => undefined);
    expect(() => store.toggleSaved(draft())).not.toThrow();
    expect(store.listSaved()).toHaveLength(1);
    unsubscribe();
  });
});
