/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * React binding for the saved-discovery store (feature 20). One store serves the
 * inspector, the reply bubble, and the drawer, so they stay in sync without
 * threading the list through every component. `useSyncExternalStore` subscribes
 * to the store's shared snapshot; the store guarantees that snapshot keeps a
 * stable reference between mutations.
 */

import { useCallback, useSyncExternalStore } from 'react';
import {
  clearSaved,
  getServerSnapshot,
  getSnapshot,
  removeSaved,
  subscribe,
  toggleSaved,
} from '../lib/saved/store';
import type { SavedDiscovery } from '../lib/saved/types';

export interface UseSavedDiscoveries {
  /** Saved discoveries, newest first. */
  saved: SavedDiscovery[];
  /** Whether an id is currently saved, for a toggle's pressed state. */
  isSaved: (id: string) => boolean;
  /** Save it if absent, remove it if present. Returns the resulting state. */
  toggle: (discovery: SavedDiscovery) => boolean;
  remove: (id: string) => void;
  clear: () => void;
}

export function useSavedDiscoveries(): UseSavedDiscoveries {
  const saved = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isSaved = useCallback((id: string) => saved.some((row) => row.id === id), [saved]);
  return {
    saved,
    isSaved,
    toggle: toggleSaved,
    remove: removeSaved,
    clear: clearSaved,
  };
}
