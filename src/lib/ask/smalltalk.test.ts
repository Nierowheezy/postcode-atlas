import { describe, expect, it } from 'vitest';
import { isSmallTalk } from './smalltalk';

describe('isSmallTalk', () => {
  it('accepts greetings regardless of case and punctuation', () => {
    expect(isSmallTalk('Hello!')).toBe(true);
    expect(isSmallTalk('  hey,  ')).toBe(true);
    expect(isSmallTalk('Good morning')).toBe(true);
    expect(isSmallTalk('how you dey')).toBe(true);
  });

  it('rejects a message that also names a place or asks for something', () => {
    expect(isSmallTalk('hello, postcode for Ikeja')).toBe(false);
    expect(isSmallTalk('show me Lagos on the map')).toBe(false);
  });

  it('rejects an unknown phrase', () => {
    expect(isSmallTalk('banana')).toBe(false);
  });
});
