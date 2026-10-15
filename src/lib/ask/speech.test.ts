/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import { hasSpeechRecognition, speechLanguageTag, composeDictation } from './speech';

describe('speechLanguageTag', () => {
  it('maps modes to BCP-47 tags', () => {
    expect(speechLanguageTag('auto')).toBe('en-NG');
    expect(speechLanguageTag('en')).toBe('en-NG');
    expect(speechLanguageTag('yo')).toBe('yo-NG');
    expect(speechLanguageTag('ha')).toBe('ha-NG');
    expect(speechLanguageTag('ig')).toBe('ig-NG');
  });
});

describe('hasSpeechRecognition', () => {
  it('returns true when SpeechRecognition is present', () => {
    const win = {
      SpeechRecognition: function SpeechRecognition() {} as unknown as typeof SpeechRecognition,
    };
    expect(hasSpeechRecognition(win)).toBe(true);
  });

  it('returns true when webkitSpeechRecognition is present', () => {
    const win = {
      webkitSpeechRecognition: function webkitSpeechRecognition() {} as unknown as typeof SpeechRecognition,
    };
    expect(hasSpeechRecognition(win)).toBe(true);
  });

  it('returns false when neither is present', () => {
    const win = {} as unknown as Window;
    expect(hasSpeechRecognition(win)).toBe(false);
  });
});

describe('composeDictation', () => {
  it('returns the base when there is no dictation yet', () => {
    expect(composeDictation('What is ', '', '')).toBe('What is ');
  });

  it('returns the dictation when the base is empty', () => {
    expect(composeDictation('', 'postcode for Ikeja', '')).toBe('postcode for Ikeja');
  });

  it('keeps a base that already ends in whitespace without doubling it', () => {
    expect(composeDictation('What is ', 'postcode for Ikeja', '')).toBe('What is postcode for Ikeja');
  });

  it('inserts one separating space when the base has none', () => {
    expect(composeDictation('What is', 'postcode for Ikeja', '')).toBe('What is postcode for Ikeja');
  });

  it('appends the interim text after the committed transcript', () => {
    expect(composeDictation('', 'postcode for ', 'Ikeja')).toBe('postcode for Ikeja');
  });

  it('ignores whitespace-only dictation', () => {
    expect(composeDictation('Ikeja', '   ', '  ')).toBe('Ikeja');
  });
});