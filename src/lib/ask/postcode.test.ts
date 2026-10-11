import { describe, expect, it } from 'vitest';
import { hasUnbackedPostcode, postcodesIn, stripUnbackedPostcodes } from './postcode';

describe('postcodesIn', () => {
  it('finds dashed five-segment codes and uppercases them', () => {
    expect([...postcodesIn('try fc-02-11-01-01 now')]).toEqual(['FC-02-11-01-01']);
  });

  it('returns nothing when there is no postcode', () => {
    expect(postcodesIn('Ikeja is a Local Government Area').size).toBe(0);
  });

  it('does not treat a bare state code as a postcode', () => {
    expect(postcodesIn('Lagos (LA) has no single postcode').size).toBe(0);
  });
});

describe('hasUnbackedPostcode', () => {
  it('is false when every code is backed by a tool result', () => {
    expect(hasUnbackedPostcode('See FC-02-D43-LG-01.', new Set(['FC-02-D43-LG-01']))).toBe(false);
  });

  it('is true when a quoted code is not backed', () => {
    expect(hasUnbackedPostcode('Try FC-02-11-01-01.', new Set(['FC-02-D43-LG-01']))).toBe(true);
  });
});

describe('stripUnbackedPostcodes', () => {
  it('returns the text unchanged when every code is backed', () => {
    const text = 'The postcode is FC-02-D43-LG-01.';
    expect(stripUnbackedPostcodes(text, new Set(['FC-02-D43-LG-01']), 'fallback')).toBe(text);
  });

  it('drops only the sentence carrying the invented code', () => {
    const text = 'Ikeja is an LGA. Its postcode is FC-02-11-01-01. Ask for a street.';
    expect(stripUnbackedPostcodes(text, new Set(), 'fallback')).toBe('Ikeja is an LGA. Ask for a street.');
  });

  it('returns the fallback when nothing survives', () => {
    expect(stripUnbackedPostcodes('FC-02-11-01-01', new Set(), 'No verified postcode.')).toBe(
      'No verified postcode.',
    );
  });
});
