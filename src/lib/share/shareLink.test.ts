/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  discoveryShareUrl,
  postcodeShareUrl,
  shareOrCopy,
  stateShareUrl,
} from './shareLink';
import type { SavedDiscovery } from '../saved/types';

const discovery = (over: Partial<SavedDiscovery> = {}): SavedDiscovery => ({
  id: 'postcode:LA-11-A12-AK-08',
  kind: 'postcode',
  label: 'Ikeja City Mall',
  postcode: 'LA-11-A12-AK-08',
  savedAt: 0,
  ...over,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('share links', () => {
  it('builds a code link and encodes the code', () => {
    expect(postcodeShareUrl('LA-11-A12-AK-08', 'https://atlas.test')).toBe(
      'https://atlas.test/?code=LA-11-A12-AK-08',
    );
    expect(postcodeShareUrl('A B&C', 'https://atlas.test')).toBe(
      'https://atlas.test/?code=A%20B%26C',
    );
  });

  it('builds an uppercased state link', () => {
    expect(stateShareUrl('la', 'https://atlas.test')).toBe('https://atlas.test/?state=LA');
  });

  it('uses the app origin by default and falls back to a relative root', () => {
    vi.stubGlobal('window', { location: { origin: 'https://atlas.test' } });
    expect(postcodeShareUrl('LA-1')).toBe('https://atlas.test/?code=LA-1');

    vi.unstubAllGlobals();
    expect(postcodeShareUrl('LA-1')).toBe('/?code=LA-1');
  });

  it('links a postcode discovery by code and a place by state', () => {
    expect(discoveryShareUrl(discovery(), 'https://x.test')).toBe(
      'https://x.test/?code=LA-11-A12-AK-08',
    );
    expect(
      discoveryShareUrl(discovery({ id: 'place:LA', kind: 'place', postcode: undefined, stateCode: 'LA' }), 'https://x.test'),
    ).toBe('https://x.test/?state=LA');
  });

  it('has no link for a discovery with neither a postcode nor a state', () => {
    expect(
      discoveryShareUrl(discovery({ id: 'place:6.6,3.35', kind: 'place', postcode: undefined }), 'https://x.test'),
    ).toBeUndefined();
  });
});

describe('shareOrCopy', () => {
  const payload = { title: 'Postcode Atlas', url: 'https://x.test/?code=LA-1' };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the native sheet when it resolves', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      share,
      clipboard: { writeText: vi.fn() },
    });
    await expect(shareOrCopy(payload)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({
      title: payload.title,
      text: undefined,
      url: payload.url,
    });
  });

  it('reports a cancelled sheet without copying', async () => {
    const abort = Object.assign(new Error('dismissed'), { name: 'AbortError' });
    const clipboard = { writeText: vi.fn() };
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(abort), clipboard });
    expect(await shareOrCopy({ title: 't', url: 'https://x.test/?code=LA-1' })).toBe('cancelled');
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it('copies when the native sheet fails for another reason', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
      clipboard: { writeText },
    });
    expect(await shareOrCopy({ title: 't', url: 'u' })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('u');
  });

  it('copies when there is no native sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await shareOrCopy({ title: 't', url: 'u' })).toBe('copied');
  });

  it('reports a failure when neither path works', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } });
    vi.stubGlobal('document', undefined);
    expect(await shareOrCopy({ title: 't', url: 'u' })).toBe('failed');
  });
});
