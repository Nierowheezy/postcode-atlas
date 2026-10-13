/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Browser-local store for saved discoveries (feature 20). A save is a personal
 * bookmark, not shared data, so it lives in localStorage rather than a server:
 * the project has no accounts and no database, and a save must survive a reload
 * while staying clearable. Nothing here is ever sent to the model.
 *
 * Everything is best effort, like `src/lib/ask/persistence.ts`: private mode, a
 * disabled store, or a full quota must never break the UI, so reads and writes
 * swallow their errors and degrade to "no persistence".
 */

import { SAVED_KINDS } from './types';
import type { SavedDiscovery, SavedKind } from './types';

/** Versioned key, so a later shape change migrates or drops instead of corrupting. */
const STORAGE_KEY = 'atlas:saved-discoveries:v1';

/** Most rows kept, so a long-lived store cannot grow without bound. */
export const MAX_SAVED = 100;

/** Shared empty result, so an empty store still has a stable snapshot. */
const EMPTY: SavedDiscovery[] = [];

let cache: SavedDiscovery[] | null = null;
const listeners = new Set<() => void>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Accept only complete, well-typed rows. A partial or foreign entry is dropped
 * rather than rendered, so a hand-edited or older store cannot crash the drawer.
 */
function asSavedDiscovery(value: unknown): SavedDiscovery | null {
  if (!isRecord(value)) return null;
  const id = stringOrUndefined(value.id);
  const label = stringOrUndefined(value.label);
  const savedAt = numberOrUndefined(value.savedAt);
  const kind = stringOrUndefined(value.kind);
  if (!id || !label || savedAt === undefined) return null;
  if (!kind || !SAVED_KINDS.includes(kind as SavedKind)) return null;
  return {
    id,
    kind: kind as SavedKind,
    label,
    savedAt,
    postcode: stringOrUndefined(value.postcode),
    stateCode: stringOrUndefined(value.stateCode),
    stateName: stringOrUndefined(value.stateName),
    lgaCode: stringOrUndefined(value.lgaCode),
    lgaName: stringOrUndefined(value.lgaName),
    lat: numberOrUndefined(value.lat),
    lng: numberOrUndefined(value.lng),
    category: stringOrUndefined(value.category),
  };
}

/** Newest first, capped, and free of rows that no longer parse. */
function normalize(rows: SavedDiscovery[]): SavedDiscovery[] {
  return [...rows].sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_SAVED);
}

/** Read and validate the persisted array. Any failure reads as empty. */
function readFromStorage(): SavedDiscovery[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return EMPTY;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const rows = parsed
      .map(asSavedDiscovery)
      .filter((row): row is SavedDiscovery => row !== null);
    return rows.length === 0 ? EMPTY : normalize(rows);
  } catch {
    // Corrupt JSON, a disabled store, or a blocked read: start empty.
    return EMPTY;
  }
}

function persist(rows: SavedDiscovery[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // A full or disabled store must never break the UI.
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** True when this environment can carry cross-tab `storage` events. */
function supportsStorageEvents(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.addEventListener === 'function' &&
    typeof window.removeEventListener === 'function'
  );
}

/** Another tab wrote the same key: reload the cache and repaint. */
function onStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) return;
  cache = readFromStorage();
  notify();
}

/** The rows to render, newest first. Stable reference between mutations. */
export function getSnapshot(): SavedDiscovery[] {
  if (cache === null) cache = readFromStorage();
  return cache;
}

/** Server render has no store to read, so it always sees empty. */
export function getServerSnapshot(): SavedDiscovery[] {
  return EMPTY;
}

export function listSaved(): SavedDiscovery[] {
  return getSnapshot();
}

export function isSaved(id: string): boolean {
  return getSnapshot().some((row) => row.id === id);
}

/**
 * Subscribe to store changes. Attaches the cross-tab listener on the first
 * subscriber and drops it on the last, so importing the module has no DOM side
 * effect and a missing listener API degrades to no sync rather than throwing.
 */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && supportsStorageEvents()) {
    window.addEventListener('storage', onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && supportsStorageEvents()) {
      window.removeEventListener('storage', onStorage);
    }
  };
}

/**
 * Insert when absent, remove when present. Returns true when the discovery is
 * saved now. The store stamps `savedAt` so insertion order is the source of truth.
 */
export function toggleSaved(draft: SavedDiscovery): boolean {
  const current = getSnapshot();
  const existing = current.some((row) => row.id === draft.id);
  const next = existing
    ? current.filter((row) => row.id !== draft.id)
    : normalize([{ ...draft, savedAt: Date.now() }, ...current]);
  cache = next;
  persist(next);
  notify();
  return !existing;
}

export function removeSaved(id: string): void {
  const current = getSnapshot();
  if (!current.some((row) => row.id === id)) return;
  cache = current.filter((row) => row.id !== id);
  persist(cache);
  notify();
}

export function clearSaved(): void {
  cache = EMPTY;
  persist(EMPTY);
  notify();
}
