import { describe, expect, it } from 'vitest';
import { isSmallTalk } from './smalltalk';

describe('isSmallTalk', () => {
  it('accepts greetings regardless of case and punctuation', () => {
    expect(isSmallTalk('Hello!')).toBe(true);
    expect(isSmallTalk('  hey,  ')).toBe(true);
    expect(isSmallTalk('Good morning')).toBe(true);
    expect(isSmallTalk('how you dey')).toBe(true);
  });

  it('folds diacritics so a Yoruba greeting matches with or without tone marks', () => {
    expect(isSmallTalk('Ẹ ku àárọ̀')).toBe(true);
    expect(isSmallTalk('E ku aaro')).toBe(true);
    expect(isSmallTalk('Báwo ni')).toBe(true);
  });

  it('accepts greetings in Yoruba, Hausa, Igbo, and Pidgin', () => {
    expect(isSmallTalk('Ẹ ku aaro')).toBe(true);
    expect(isSmallTalk('Sannu da zuwa')).toBe(true);
    expect(isSmallTalk('Ina kwana')).toBe(true);
    expect(isSmallTalk('Ndewo')).toBe(true);
    expect(isSmallTalk('Kedu')).toBe(true);
    expect(isSmallTalk('How far')).toBe(true);
    expect(isSmallTalk('No wahala')).toBe(true);
  });

  it('rejects a message that also names a place or asks for something', () => {
    expect(isSmallTalk('hello, postcode for Ikeja')).toBe(false);
    expect(isSmallTalk('show me Lagos on the map')).toBe(false);
    expect(isSmallTalk('abeg show me Lagos')).toBe(false);
  });

  it('rejects an unknown phrase', () => {
    expect(isSmallTalk('banana')).toBe(false);
  });
});
