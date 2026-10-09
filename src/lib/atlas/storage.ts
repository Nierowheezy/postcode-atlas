/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Persistence for the Atlas dataset cache (feature 3a): a versioned IndexedDB
 * copy of the NDAPS snapshot, plus an in-memory fallback for browsers without
 * IndexedDB (private mode). Records use composite out-of-line array keys
 * because an IDB keyPath cannot be an array; a snapshot write is one atomic
 * transaction, so a failure leaves the previous dataset intact.
 */

import type { AtlasDatasetMeta, AtlasSnapshot } from './dataset';

type DataStore = 'states' | 'lgas' | 'districts' | 'areas';
type StoreName = 'meta' | DataStore;

const DB_NAME = 'atlas-dataset';
const DB_VERSION = 1;
const META_KEY = 'dataset';
const UPPER_BOUND = '\uffff';

const DATA_STORES: readonly DataStore[] = ['states', 'lgas', 'districts', 'areas'];

function isSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!isSupported()) {
    return Promise.reject(new Error('IndexedDB is not available'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of ['meta', ...DATA_STORES]) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    });
  }
  return dbPromise;
}

function idbGet<T>(db: IDBDatabase, store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readonly').objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'));
  });
}

function idbGetAll<T>(db: IDBDatabase, store: DataStore, range?: IDBKeyRange): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readonly').objectStore(store).getAll(range);
    request.onsuccess = () => resolve((request.result as T[]) ?? []);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'));
  });
}

interface MemoryEntry {
  key: readonly unknown[];
  value: unknown;
}

const memory = new Map<StoreName, Map<string, MemoryEntry>>();

function memStore(name: StoreName): Map<string, MemoryEntry> {
  let store = memory.get(name);
  if (!store) {
    store = new Map();
    memory.set(name, store);
  }
  return store;
}

function toMem<T>(rows: readonly T[], keyOf: (row: T) => readonly unknown[]): Map<string, MemoryEntry> {
  const map = new Map<string, MemoryEntry>();
  for (const row of rows) {
    const key = keyOf(row);
    map.set(JSON.stringify(key), { key, value: row });
  }
  return map;
}

/** The stored dataset version, or null when nothing has been hydrated. */
export async function readMeta(): Promise<AtlasDatasetMeta | null> {
  try {
    const db = await openDb();
    return (await idbGet<AtlasDatasetMeta>(db, 'meta', META_KEY)) ?? null;
  } catch {
    const entry = memStore('meta').get(META_KEY);
    return entry ? (entry.value as AtlasDatasetMeta) : null;
  }
}

/**
 * Replace the whole dataset in one atomic transaction (or one staged memory
 * swap when IndexedDB is unavailable). On any failure the previous dataset and
 * its version are untouched: a synchronous throw (e.g. an un-cloneable value)
 * aborts the transaction instead of letting it commit partially, and a failed
 * IndexedDB write never silently applies to the in-memory fallback.
 */
export async function writeSnapshot(snapshot: AtlasSnapshot): Promise<void> {
  const meta: AtlasDatasetMeta = {
    version: snapshot.version,
    generatedAt: snapshot.generatedAt,
    counts: snapshot.counts,
  };

  if (!isSupported()) {
    writeMemory(snapshot, meta);
    return;
  }

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['meta', ...DATA_STORES], 'readwrite');
    let failure: unknown = null;
    tx.oncomplete = () => (failure === null ? resolve() : reject(failure));
    tx.onerror = () => reject(tx.error ?? new Error('snapshot write failed'));
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('snapshot write aborted'));
    try {
      for (const name of DATA_STORES) tx.objectStore(name).clear();
      putAll(tx.objectStore('states'), snapshot.states, (s) => [s.code]);
      putAll(tx.objectStore('lgas'), snapshot.lgas, (l) => [l.state, l.code]);
      putAll(tx.objectStore('districts'), snapshot.districts, (d) => [d.state, d.lga, d.code]);
      putAll(tx.objectStore('areas'), snapshot.areas, (a) => [a.state, a.lga, a.district, a.code]);
      tx.objectStore('meta').put(meta, META_KEY);
    } catch (err) {
      failure = err;
      tx.abort(); // never commit a partial snapshot
    }
  });
}

/** In-memory fallback used only when IndexedDB is unavailable (private mode). */
function writeMemory(snapshot: AtlasSnapshot, meta: AtlasDatasetMeta): void {
  const staged = new Map<StoreName, Map<string, MemoryEntry>>([
    ['states', toMem(snapshot.states, (s) => [s.code])],
    ['lgas', toMem(snapshot.lgas, (l) => [l.state, l.code])],
    ['districts', toMem(snapshot.districts, (d) => [d.state, d.lga, d.code])],
    ['areas', toMem(snapshot.areas, (a) => [a.state, a.lga, a.district, a.code])],
    ['meta', new Map([[META_KEY, { key: [META_KEY], value: meta }]])],
  ]);
  memory.clear();
  for (const [name, entries] of staged) memory.set(name, entries);
}

/** Drop the dataset entirely (used when the stored version is stale). */
export async function clearDataset(): Promise<void> {
  if (!isSupported()) {
    memory.clear();
    return;
  }

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['meta', ...DATA_STORES], 'readwrite');
    let failure: unknown = null;
    tx.oncomplete = () => (failure === null ? resolve() : reject(failure));
    tx.onerror = () => reject(tx.error ?? new Error('dataset clear failed'));
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('dataset clear aborted'));
    try {
      for (const name of ['meta', ...DATA_STORES]) tx.objectStore(name).clear();
    } catch (err) {
      failure = err;
      tx.abort();
    }
  });
}

/** Every record in one store, in key order (IDB) or insertion order (memory). */
export async function readAll<T>(store: DataStore): Promise<T[]> {
  try {
    const db = await openDb();
    return await idbGetAll<T>(db, store);
  } catch {
    return [...memStore(store).values()].map((entry) => entry.value as T);
  }
}

/** Records whose composite key starts with `prefix`. */
export async function readRange<T>(store: DataStore, prefix: readonly string[]): Promise<T[]> {
  try {
    const db = await openDb();
    const upper = [...prefix, UPPER_BOUND];
    return await idbGetAll<T>(db, store, IDBKeyRange.bound(prefix, upper));
  } catch {
    return [...memStore(store).values()]
      .filter((entry) => prefix.every((part, i) => i < entry.key.length && entry.key[i] === part))
      .map((entry) => entry.value as T);
  }
}

/** Record count in one store. */
export async function countStore(store: DataStore): Promise<number> {
  try {
    const db = await openDb();
    return await new Promise<number>((resolve, reject) => {
      const request = db.transaction(store, 'readonly').objectStore(store).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB count failed'));
    });
  } catch {
    return memStore(store).size;
  }
}

function putAll<T>(store: IDBObjectStore, rows: readonly T[], keyOf: (row: T) => readonly unknown[]): void {
  for (const row of rows) {
    store.add(row, keyOf(row) as IDBValidKey);
  }
}