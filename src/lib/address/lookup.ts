/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The live `AddressLookup` for the address resolver (feature 17): the NDAPS
 * catalogue and the verified landmark set, read through the same store the
 * other Atlas tools use. Kept apart from the resolver so that module stays
 * data-free and unit-testable.
 */

import { atlasStore } from '../atlas/store';
import type { AddressLookup } from './types';

/** One-shot adapter over the hydrated Atlas store. */
export function createAtlasAddressLookup(): AddressLookup {
  return {
    states: () => atlasStore.getStates(),
    lgas: (state) => atlasStore.getLgas(state),
    discoveryPoints: () => atlasStore.getDiscoveryPoints(),
    search: (query) => atlasStore.searchLocations(query),
    lookupPostcode: (code) => atlasStore.getPostcode(code),
  };
}
