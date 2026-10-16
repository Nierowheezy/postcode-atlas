import { describe, expect, it } from 'vitest';
import { findUngroundedArg, isGroundedInText } from './argumentGuard';

describe('isGroundedInText', () => {
  it('matches a quoted place name', () => {
    expect(isGroundedInText('Ikeja', 'postcode for Ikeja')).toBe(true);
    expect(isGroundedInText('Wuse 2', 'show me Wuse 2 on the map')).toBe(true);
  });

  it('folds case and diacritics, so a non-English message still grounds the name', () => {
    expect(isGroundedInText('Ikeja', 'Kí ni kòòdù Ikeja?')).toBe(true);
    expect(isGroundedInText('Lagos', 'koodu fun EKO?')).toBe(false);
  });

  it('tolerates a light misspelling', () => {
    expect(isGroundedInText('Ikeja', 'postcode for ikejaa')).toBe(true);
  });

  it('grounds on a shared address number when the words differ', () => {
    expect(isGroundedInText('12 Allen Avenue', 'what is at 12?')).toBe(true);
  });

  it('does not ground on a shared two-letter fragment', () => {
    expect(isGroundedInText('Ikeja', 'can you say it')).toBe(false);
  });
});

describe('findUngroundedArg', () => {
  it('rejects an address the message does not contain', () => {
    expect(
      findUngroundedArg('interpretAddress', { text: '12 Allen Avenue, Ikeja, Lagos' }, 'are you listening to what I am saying'),
    ).toBe('12 Allen Avenue, Ikeja, Lagos');
  });

  it('accepts the same address when the message quotes it', () => {
    expect(
      findUngroundedArg('interpretAddress', { text: '12 Allen Avenue, Ikeja, Lagos' }, '12 Allen Avenue is in Ikeja, Lagos.'),
    ).toBeUndefined();
  });

  it('rejects a stale place name', () => {
    expect(findUngroundedArg('searchLocation', { query: 'Ikeja' }, 'tell me a bit about how you work')).toBe('Ikeja');
  });

  it('never guards a follow-up, which resolves from the referent', () => {
    expect(
      findUngroundedArg('interpretAddress', { text: '12 Allen Avenue, Ikeja, Lagos' }, 'what are its LGAs?'),
    ).toBeUndefined();
    expect(findUngroundedArg('searchLocation', { query: 'Ikeja' }, 'and their postcodes?')).toBeUndefined();
  });

  it('never guards a spatial question, which resolves from the map selection', () => {
    expect(
      findUngroundedArg('interpretAddress', { text: 'Wuse 2' }, 'what is near me?'),
    ).toBeUndefined();
    expect(findUngroundedArg('searchLocation', { query: 'Wuse 2' }, 'what is around here?')).toBeUndefined();
  });

  it('leaves every other tool alone, including code-filled calls', () => {
    expect(findUngroundedArg('getLgas', { state: 'KN' }, 'list the LGAs in Kano')).toBeUndefined();
    expect(findUngroundedArg('navigateMap', { target: 'state', state: 'Lagos' }, 'show me Lagos on the map')).toBeUndefined();
    expect(findUngroundedArg('explainAtlas', { topic: 'hierarchy' }, 'how does it work')).toBeUndefined();
    expect(findUngroundedArg('getPostcode', { code: 'LA-11-A12-AK-08' }, 'decode this')).toBeUndefined();
  });

  it('ignores a missing, empty, or non-string argument', () => {
    expect(findUngroundedArg('interpretAddress', {}, 'anything')).toBeUndefined();
    expect(findUngroundedArg('searchLocation', { query: '   ' }, 'anything')).toBeUndefined();
    expect(findUngroundedArg('searchLocation', { query: 42 }, 'anything')).toBeUndefined();
    expect(findUngroundedArg('searchLocation', null, 'anything')).toBeUndefined();
  });
});
