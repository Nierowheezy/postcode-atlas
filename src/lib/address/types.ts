/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Contracts for address interpretation (feature 17). The parser shapes a
 * pasted address; the resolver places its parts in the Atlas hierarchy through
 * `AddressLookup`. Both are pure and take their data as arguments, so they unit
 * test without IndexedDB or the network.
 */

import type { AtlasLga, AtlasState, LocationCandidate } from '../atlas/dataset';
import type { PostcodeLocation } from '../../types/postcode';

/** One comma, semicolon, or newline-separated part of an address. */
export interface AddressSegment {
  /** The part as written, whitespace collapsed. */
  text: string;
  /** What the part reads as: a code, a street, or a place name. */
  kind: AddressSegmentKind;
}

export type AddressSegmentKind = 'postcode' | 'street' | 'place';

/** A structural read of an address, before any data lookup. */
export interface ParsedAddress {
  /** The address exactly as the user gave it. */
  raw: string;
  /** Non-empty parts in address order, each classified. */
  segments: AddressSegment[];
  /** The first well-formed postcode found, dashed, if any. */
  postcode?: string;
}

/** The deepest level the resolver could place. */
export type AddressResolvedTo = 'none' | 'state' | 'lga' | 'district' | 'area' | 'postcode';

/**
 * An address mapped onto the Atlas hierarchy. Every field is optional because
 * NDAPS holds what it holds: a street or house number has no record, so it
 * lands in `unresolved` rather than being invented. Load-bearing for the
 * developer API (build-plan feature 21), so keep the shape stable.
 */
export interface InterpretedAddress {
  /** The address the user pasted. */
  input: string;
  state?: { code: string; name: string };
  lga?: { code: string; name: string };
  district?: { code: string; name?: string };
  area?: { code: string; name?: string };
  /** Present only when a code was given or a verified landmark matched. */
  postcode?: { code: string; verified: boolean };
  /** The verified landmark the address named, when one matched. */
  landmark?: { name?: string; postcode: string };
  /** Address parts with no place in the hierarchy. */
  unresolved: string[];
  /** The deepest level that resolved. */
  resolvedTo: AddressResolvedTo;
}

/**
 * The data the resolver reads, injected so resolution is testable and so the
 * same logic works over the live store, a snapshot, or a fake.
 */
export interface AddressLookup {
  states(): Promise<AtlasState[]>;
  lgas(state: string): Promise<AtlasLga[]>;
  discoveryPoints(): Promise<PostcodeLocation[]>;
  search(query: string): Promise<LocationCandidate[]>;
  lookupPostcode(code: string): Promise<PostcodeLocation | null>;
}
