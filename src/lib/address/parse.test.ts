import { describe, expect, it } from 'vitest';
import { parseAddressText } from './parse';

/** The kinds in order, for compact assertions. */
const kinds = (raw: string) => parseAddressText(raw).segments.map((segment) => segment.kind);

/** The texts in order, for compact assertions. */
const texts = (raw: string) => parseAddressText(raw).segments.map((segment) => segment.text);

describe('parseAddressText', () => {
  it('splits on commas, semicolons, and newlines', () => {
    expect(texts('Ikeja, Lagos; Nigeria\nNG')).toEqual(['Ikeja', 'Lagos', 'Nigeria', 'NG']);
  });

  it('collapses whitespace and drops empty parts', () => {
    expect(texts('  12   Allen\tAvenue ,, Ikeja;  ; Lagos ')).toEqual([
      '12 Allen Avenue',
      'Ikeja',
      'Lagos',
    ]);
  });

  it('keeps a dashed postcode in its own segment and the top level', () => {
    const parsed = parseAddressText('12 Allen Avenue, Ikeja, Lagos LA-04-A45-BB-05');
    expect(parsed.postcode).toBe('LA-04-A45-BB-05');
    expect(parsed.segments).toEqual([
      { text: '12 Allen Avenue', kind: 'street' },
      { text: 'Ikeja', kind: 'place' },
      { text: 'Lagos', kind: 'place' },
      { text: 'LA-04-A45-BB-05', kind: 'postcode' },
    ]);
  });

  it('normalizes a compact postcode to dashed', () => {
    const parsed = parseAddressText('Allen Avenue, Ikeja LA04A45BB05');
    expect(parsed.postcode).toBe('LA-04-A45-BB-05');
    expect(texts('Ikeja, LA04A45BB05')).toEqual(['Ikeja', 'LA-04-A45-BB-05']);
  });

  it('does not read an 11-letter word as a compact postcode', () => {
    // ALLENAVENUE is 11 characters but cannot be folded into five valid groups.
    expect(parseAddressText('ALLENAVENUE').postcode).toBeUndefined();
    expect(kinds('Ikeja ALLENAVENUE')).toEqual(['place']);
  });

  it('splits a leading line number from the street that follows it', () => {
    expect(parseAddressText('12 Allen Avenue, Ikeja').segments[0]).toEqual({
      text: '12 Allen Avenue',
      kind: 'street',
    });
    expect(kinds('Flat 3B, Yaba, Lagos')).toEqual(['street', 'place', 'place']);
    expect(kinds('No. 5 Adeola Odeku Street, Victoria Island, Lagos')).toEqual([
      'street',
      'place',
      'place',
    ]);
  });

  it('reads a street-type word as a street and everything else as a place', () => {
    expect(kinds('Allen Avenue, Ikeja')).toEqual(['street', 'place']);
    expect(kinds('Ahmadu Bello Way, Kano')).toEqual(['street', 'place']);
    expect(kinds('Ikeja, Lagos')).toEqual(['place', 'place']);
  });

  it('treats a bare word and a non-address string as places, not a crash', () => {
    expect(kinds('garbage')).toEqual(['place']);
    expect(kinds('???')).toEqual(['place']);
  });

  it('returns no segments for empty or whitespace-only input', () => {
    expect(parseAddressText('')).toEqual({ raw: '', segments: [] });
    expect(parseAddressText('   ,  ; \n ')).toEqual({ raw: '   ,  ; \n ', segments: [] });
  });

  it('preserves address order around a postcode, including a leading one', () => {
    expect(texts('LA-04-A45-BB-05 Lagos')).toEqual(['LA-04-A45-BB-05', 'Lagos']);
    expect(texts('12 Allen Avenue, Ikeja, Lagos LA-04-A45-BB-05')).toEqual([
      '12 Allen Avenue',
      'Ikeja',
      'Lagos',
      'LA-04-A45-BB-05',
    ]);
  });

  it('records only the first postcode as the top-level value', () => {
    const parsed = parseAddressText('Lagos LA-04-A45-BB-05, Ikeja FC-02-D43-LG-01');
    expect(parsed.postcode).toBe('LA-04-A45-BB-05');
    expect(kinds('Lagos LA-04-A45-BB-05, Ikeja FC-02-D43-LG-01')).toEqual([
      'place',
      'postcode',
      'place',
      'postcode',
    ]);
  });
});
