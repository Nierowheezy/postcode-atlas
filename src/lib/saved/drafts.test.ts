/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  placeSavedId,
  postcodeSavedId,
  savedFromLga,
  savedFromLocation,
  savedFromMessage,
  savedFromState,
} from './drafts';
import type { AskAtlasMessage } from '../ask/types';
import type { PostcodeLocation, StateGeoInfo } from '../../types/postcode';

const lagos: StateGeoInfo = {
  code: 'LA',
  name: 'Lagos',
  capital: 'Ikeja',
  zone: 'South West',
  center: [6.5244, 3.3792],
  zoom: 9,
  lgaCount: 20,
};

const landmark: PostcodeLocation = {
  postcode: 'la-11-a12-ak-08',
  state: 'LA',
  stateName: 'Lagos',
  lga: '11',
  lgaName: 'Ikeja',
  lat: 6.6,
  lng: 3.35,
  name: 'Ikeja City Mall',
  category: 'Shopping',
};

describe('saved ids', () => {
  it('normalizes a postcode id and namespaces a place id', () => {
    expect(postcodeSavedId(' la-11-a12-ak-08 ')).toBe('postcode:LA-11-A12-AK-08');
    expect(placeSavedId('LA-11')).toBe('place:LA-11');
  });
});

describe('savedFromLocation', () => {
  it('saves a verified postcode or landmark as a postcode', () => {
    expect(savedFromLocation(landmark)).toMatchObject({
      id: 'postcode:LA-11-A12-AK-08',
      kind: 'postcode',
      label: 'Ikeja City Mall',
      postcode: 'LA-11-A12-AK-08',
      stateCode: 'LA',
      stateName: 'Lagos',
      lgaCode: '11',
      lgaName: 'Ikeja',
      lat: 6.6,
      lng: 3.35,
      category: 'Shopping',
      savedAt: 0,
    });
  });

  it('falls back from landmark to address to locality to code for the label', () => {
    expect(
      savedFromLocation({ ...landmark, name: undefined, address: '12 Allen Ave' })?.label,
    ).toBe('12 Allen Ave');
    expect(
      savedFromLocation({ ...landmark, name: undefined, address: undefined })?.label,
    ).toBe('Ikeja, Lagos');
    expect(
      savedFromLocation({
        ...landmark,
        name: undefined,
        address: undefined,
        lgaName: undefined,
        stateName: undefined,
      })?.label,
    ).toBe('LA-11-A12-AK-08');
  });

  it('refuses a location with no postcode', () => {
    expect(savedFromLocation({ ...landmark, postcode: '   ' })).toBeNull();
  });
});

describe('savedFromState and savedFromLga', () => {
  it('saves a state as a place with its center', () => {
    expect(savedFromState(lagos)).toMatchObject({
      id: 'place:LA',
      kind: 'place',
      label: 'Lagos',
      stateCode: 'LA',
      stateName: 'Lagos',
      lat: 6.5244,
      lng: 3.3792,
      savedAt: 0,
    });
    expect(savedFromState(lagos).postcode).toBeUndefined();
  });

  it('saves an LGA as a place under its state', () => {
    expect(savedFromLga(lagos, { code: '05', name: 'Amuwo-Odofin' })).toMatchObject({
      id: 'place:LA-05',
      kind: 'place',
      label: 'Amuwo-Odofin',
      lgaCode: '05',
      lgaName: 'Amuwo-Odofin',
      lat: 6.5244,
      lng: 3.3792,
    });
    expect(savedFromLga(lagos, { code: '05' }).label).toBe('05');
  });
});

describe('savedFromMessage', () => {
  const lookupMessage: AskAtlasMessage = {
    id: 'm1',
    role: 'assistant',
    content: 'Here it is.',
    timestamp: 1,
    lookup: {
      postcode: 'la-11-a12-ak-08',
      label: 'Ikeja City Mall',
      stateName: 'Lagos',
      lgaName: 'Ikeja',
      coordinates: [6.6, 3.35],
      verified: true,
    },
  };

  const decodedMessage: AskAtlasMessage = {
    id: 'm2',
    role: 'assistant',
    content: 'Decoded.',
    timestamp: 2,
    decoded: {
      postcode: 'LA-11-A12-AK-08',
      compact: 'LA11A12AK08',
      display: 'LA-11-A12-AK-08',
      valid: true,
      segments: { state: 'LA', lga: '11', district: 'A12', area: 'AK', unit: '08' },
      stateName: 'Lagos',
      lgaName: 'Ikeja',
      coordinates: [6.6, 3.35],
    },
  };

  const locationMessage: AskAtlasMessage = {
    id: 'm3',
    role: 'assistant',
    content: 'On the map.',
    timestamp: 3,
    location: { lat: 6.6, lng: 3.35, label: 'Ikeja' },
  };

  it('saves a lookup as a postcode', () => {
    expect(savedFromMessage(lookupMessage)).toMatchObject({
      id: 'postcode:LA-11-A12-AK-08',
      kind: 'postcode',
      label: 'Ikeja City Mall',
      stateName: 'Lagos',
      lgaName: 'Ikeja',
      lat: 6.6,
      lng: 3.35,
    });
  });

  it('saves a valid decode as a postcode', () => {
    expect(savedFromMessage(decodedMessage)).toMatchObject({
      id: 'postcode:LA-11-A12-AK-08',
      kind: 'postcode',
      label: 'Ikeja, Lagos',
    });
  });

  it('refuses an invalid decode with nothing else to save', () => {
    const invalid: AskAtlasMessage = {
      ...decodedMessage,
      decoded: { ...decodedMessage.decoded!, valid: false },
    };
    expect(savedFromMessage(invalid)).toBeNull();
  });

  it('saves a bare location as a place keyed by coordinates', () => {
    expect(savedFromMessage(locationMessage)).toMatchObject({
      id: 'place:6.6000,3.3500',
      kind: 'place',
      label: 'Ikeja',
      lat: 6.6,
      lng: 3.35,
    });
  });

  it('prefers lookup, then a valid decode, then the location', () => {
    expect(savedFromMessage({ ...lookupMessage, decoded: decodedMessage.decoded, location: locationMessage.location }))
      .toMatchObject({ id: 'postcode:LA-11-A12-AK-08', kind: 'postcode' });
    expect(savedFromMessage({ ...decodedMessage, location: locationMessage.location })).toMatchObject({
      id: 'postcode:LA-11-A12-AK-08',
    });
  });

  it('returns null for a reply with nothing savable', () => {
    expect(
      savedFromMessage({ id: 'm4', role: 'assistant', content: 'Hello.', timestamp: 4 }),
    ).toBeNull();
  });

  it('derives a stable id across calls', () => {
    expect(savedFromLocation(landmark)!.id).toBe(savedFromLocation(landmark)!.id);
    expect(savedFromMessage(lookupMessage)!.id).toBe(savedFromMessage(lookupMessage)!.id);
  });
});
