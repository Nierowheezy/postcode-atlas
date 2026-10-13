import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkRateLimit,
  extractApiKey,
  MAX_TRACKED_IDENTITIES,
  matchesApiKey,
  RATE_WINDOW_MS,
  rateLimitIdentity,
  resetRateLimits,
  resolveApiKeys,
  resolveRateLimit,
} from './access';

function request(headers: Record<string, string> = {}): Request {
  return new Request('https://atlas.test/api/v1', { headers });
}

describe('resolveApiKeys', () => {
  it('splits a comma-separated list, trimming edges and dropping blanks', () => {
    expect(resolveApiKeys({ ATLAS_API_KEYS: ' a , b ,, ' })).toEqual(['a', 'b']);
  });

  it('reads a single key', () => {
    expect(resolveApiKeys({ ATLAS_API_KEYS: 'secret' })).toEqual(['secret']);
  });

  it('is empty when unset, blank, or whitespace only', () => {
    expect(resolveApiKeys({})).toEqual([]);
    expect(resolveApiKeys({ ATLAS_API_KEYS: '' })).toEqual([]);
    expect(resolveApiKeys({ ATLAS_API_KEYS: '   ' })).toEqual([]);
  });
});

describe('extractApiKey', () => {
  it('reads a Bearer token in any scheme casing, trimmed', () => {
    expect(extractApiKey(request({ authorization: 'Bearer abc123' }))).toBe('abc123');
    expect(extractApiKey(request({ authorization: 'bEaReR   abc123  ' }))).toBe('abc123');
  });

  it('reads an X-API-Key header', () => {
    expect(extractApiKey(request({ 'x-api-key': 'abc123' }))).toBe('abc123');
  });

  it('prefers Authorization when both headers are present', () => {
    expect(
      extractApiKey(request({ authorization: 'Bearer abc123', 'x-api-key': 'other' }))
    ).toBe('abc123');
  });

  it('ignores a non-Bearer scheme so X-API-Key is still read', () => {
    expect(
      extractApiKey(request({ authorization: 'Basic abc123', 'x-api-key': 'other' }))
    ).toBe('other');
  });

  it('is undefined with no header or a blank token', () => {
    expect(extractApiKey(request())).toBeUndefined();
    expect(extractApiKey(request({ authorization: 'Bearer' }))).toBeUndefined();
    expect(extractApiKey(request({ authorization: 'Bearer    ' }))).toBeUndefined();
    expect(extractApiKey(request({ 'x-api-key': '   ' }))).toBeUndefined();
  });
});

describe('matchesApiKey', () => {
  it('matches an exact member of the list', () => {
    expect(matchesApiKey('b', ['a', 'b'])).toBe(true);
  });

  it('is case-sensitive and never matches a prefix', () => {
    expect(matchesApiKey('B', ['a', 'b'])).toBe(false);
    expect(matchesApiKey('abc', ['abcd'])).toBe(false);
  });

  it('is false with no configured keys or a wrong key', () => {
    expect(matchesApiKey('a', [])).toBe(false);
    expect(matchesApiKey('z', ['a', 'b'])).toBe(false);
  });
});

describe('rateLimitIdentity', () => {
  it('uses the key once the caller is authenticated', () => {
    expect(rateLimitIdentity(request({ 'x-forwarded-for': '1.2.3.4' }), 'abc')).toBe('key:abc');
  });

  it('uses the first x-forwarded-for hop otherwise', () => {
    expect(rateLimitIdentity(request({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe(
      'ip:1.2.3.4'
    );
  });

  it('falls back to x-real-ip, then to unknown', () => {
    expect(rateLimitIdentity(request({ 'x-real-ip': '9.9.9.9' }))).toBe('ip:9.9.9.9');
    expect(rateLimitIdentity(request())).toBe('ip:unknown');
  });

  it('does not let a key that reads like an IP collide with that IP', () => {
    const headers = { 'x-forwarded-for': '1.2.3.4' };
    expect(rateLimitIdentity(request(headers), '1.2.3.4')).toBe('key:1.2.3.4');
    expect(rateLimitIdentity(request(headers))).toBe('ip:1.2.3.4');
  });
});

describe('resolveRateLimit', () => {
  it('defaults when unset, blank, non-numeric, zero, negative, or fractional', () => {
    expect(resolveRateLimit({})).toBe(60);
    expect(resolveRateLimit({ ATLAS_API_RATE_LIMIT: '' })).toBe(60);
    expect(resolveRateLimit({ ATLAS_API_RATE_LIMIT: 'soon' })).toBe(60);
    expect(resolveRateLimit({ ATLAS_API_RATE_LIMIT: '0' })).toBe(60);
    expect(resolveRateLimit({ ATLAS_API_RATE_LIMIT: '-5' })).toBe(60);
    expect(resolveRateLimit({ ATLAS_API_RATE_LIMIT: '1.5' })).toBe(60);
  });

  it('reads a positive integer, trimming edges', () => {
    expect(resolveRateLimit({ ATLAS_API_RATE_LIMIT: ' 30 ' })).toBe(30);
  });
});

describe('checkRateLimit', () => {
  const start = 1_000_000;

  beforeEach(resetRateLimits);

  it('allows exactly limit calls in a window and blocks the next', () => {
    expect(checkRateLimit(2, 'a', start).allowed).toBe(true);
    expect(checkRateLimit(2, 'a', start + 10).allowed).toBe(true);
    expect(checkRateLimit(2, 'a', start + 20)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
  });

  it('reports a whole-second retry that shrinks and is at least 1', () => {
    checkRateLimit(1, 'a', start);
    expect(checkRateLimit(1, 'a', start + 1)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect(checkRateLimit(1, 'a', start + 30_000)).toEqual({
      allowed: false,
      retryAfterSeconds: 30,
    });
    expect(checkRateLimit(1, 'a', start + RATE_WINDOW_MS - 1)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
  });

  it('allows again with a fresh count once the window ends', () => {
    expect(checkRateLimit(1, 'a', start).allowed).toBe(true);
    expect(checkRateLimit(1, 'a', start + 1).allowed).toBe(false);
    expect(checkRateLimit(1, 'a', start + RATE_WINDOW_MS).allowed).toBe(true);
  });

  it('keeps each identity in its own window', () => {
    expect(checkRateLimit(1, 'a', start).allowed).toBe(true);
    expect(checkRateLimit(1, 'b', start).allowed).toBe(true);
    expect(checkRateLimit(1, 'a', start + 1).allowed).toBe(false);
    expect(checkRateLimit(1, 'b', start + 1).allowed).toBe(false);
  });

  it('evicts the oldest identity once the table passes its cap', () => {
    expect(checkRateLimit(1, 'first', start).allowed).toBe(true);
    expect(checkRateLimit(1, 'first', start + 1).allowed).toBe(false);

    for (let index = 0; index < MAX_TRACKED_IDENTITIES; index += 1) {
      checkRateLimit(1, `filler-${index}`, start);
    }

    // `first` was the oldest window, so it was evicted and starts fresh.
    expect(checkRateLimit(1, 'first', start + 1).allowed).toBe(true);
  });

  it('empties the table on reset', () => {
    expect(checkRateLimit(1, 'a', start).allowed).toBe(true);
    expect(checkRateLimit(1, 'a', start + 1).allowed).toBe(false);
    resetRateLimits();
    expect(checkRateLimit(1, 'a', start + 1).allowed).toBe(true);
  });
});
