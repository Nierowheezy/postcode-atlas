/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Deep-link building and share-or-copy for saved discoveries (feature 20). The
 * app already resolves `?code=` and `?state=` on mount, so a share link is just
 * one of those URLs. Keeping the construction here gives the postcode inspector
 * and the saved drawer one implementation instead of two.
 */

import type { SavedDiscovery } from '../saved/types';

/** App origin, or a relative root where there is no window (tests, server). */
function appOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

/** Deep link that reopens a postcode through the mount handler. */
export function postcodeShareUrl(code: string, origin: string = appOrigin()): string {
  return `${origin}/?code=${encodeURIComponent(code)}`;
}

/** Deep link that reopens a state through the mount handler. */
export function stateShareUrl(code: string, origin: string = appOrigin()): string {
  return `${origin}/?state=${encodeURIComponent(code.toUpperCase())}`;
}

/**
 * A deep link for a saved discovery, or `undefined` when it has no target. An
 * LGA place links to its state, because the deep-link contract is state-level.
 */
export function discoveryShareUrl(
  item: SavedDiscovery,
  origin: string = appOrigin(),
): string | undefined {
  if (item.postcode) return postcodeShareUrl(item.postcode, origin);
  if (item.stateCode) return stateShareUrl(item.stateCode, origin);
  return undefined;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Clipboard with a legacy fallback, returning whether the copy landed. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export interface SharePayload {
  title: string;
  text?: string;
  url: string;
}

/**
 * Share through the native sheet when the browser has one, else copy the link.
 * A user cancel is reported as `cancelled` so the caller stays silent, matching
 * the inspector's existing cancel path; only a real failure is `failed`.
 */
export async function shareOrCopy(payload: SharePayload): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'cancelled';
      // Any other failure (for example NotAllowedError) falls back to copying.
    }
  }
  return (await copyText(payload.url)) ? 'copied' : 'failed';
}
