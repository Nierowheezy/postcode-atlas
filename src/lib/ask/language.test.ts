import { describe, expect, it } from 'vitest';
import { detectLanguage } from './language';

describe('detectLanguage', () => {
  it('detects the measured non-English questions from the API probes', () => {
    expect(detectLanguage('Kí ni kòòdù ìpín-ìpínlẹ̀ tí Ikeja?').detected).toBe('yo');
    expect(detectLanguage('Menene lambar gidan waya na Ikeja?').detected).toBe('ha');
    expect(detectLanguage('Gịnị bụ koodu ozi nke Ikeja?').detected).toBe('ig');
    expect(detectLanguage('How far, wetin dey happen?').detected).toBe('pcm');
  });

  it('maps Pidgin to an English reply and keeps the others as reply languages', () => {
    expect(detectLanguage('Wetin dey happen?').replyLanguage).toBe('en');
    expect(detectLanguage('Bawo ni?').replyLanguage).toBe('yo');
    expect(detectLanguage('Sannu da zuwa').replyLanguage).toBe('ha');
    expect(detectLanguage('Ndewo').replyLanguage).toBe('ig');
  });

  it('detects short greetings with no diacritics', () => {
    expect(detectLanguage('Ẹ ku aaro').detected).toBe('yo');
    expect(detectLanguage('Sannu da zuwa').detected).toBe('ha');
    expect(detectLanguage('Ndewo').detected).toBe('ig');
    expect(detectLanguage('Wetin?').detected).toBe('pcm');
  });

  it('falls back to English for English questions', () => {
    for (const text of [
      'What is the postcode for Ikeja, Lagos?',
      'Show me Lagos on the map',
      'hello',
      'How far is Ikeja from Lagos?',
      'Decode FC-02-D43-LG-01',
      'Where is Wuse 2?',
      'What is the postcode of The Infrastructure Bank PLC?',
      'Ina',
      'Aha',
    ]) {
      expect(detectLanguage(text).detected, text).toBe('en');
    }
  });

  it('keeps a place name neutral inside a non-English question', () => {
    expect(detectLanguage('Kí ni kòòdù Ikeja?').detected).toBe('yo');
    expect(detectLanguage('Wetin be the postcode for Ikeja?').detected).toBe('pcm');
  });

  it('falls back when the evidence is thin or tied', () => {
    expect(detectLanguage('').detected).toBe('en');
    expect(detectLanguage('banana').detected).toBe('en');
    expect(detectLanguage('bawo sannu').detected).toBe('en');
  });

  it('reports a confidence in [0, 1], higher for a decisive language', () => {
    const strong = detectLanguage('Menene lambar gidan waya na Ikeja?');
    expect(strong.confidence).toBeGreaterThan(0.5);
    expect(strong.confidence).toBeLessThanOrEqual(1);

    expect(detectLanguage('Show me Lagos on the map').confidence).toBe(1);
    expect(detectLanguage('Ina').confidence).toBe(0.5);
  });
});
