import { describe, expect, it } from 'vitest';
import { isFollowUp, isSpatialQuestion } from './followup';

describe('isFollowUp', () => {
  it('detects pronoun and possessive follow-ups', () => {
    expect(isFollowUp('what are its LGAs?')).toBe(true);
    expect(isFollowUp('and their postcodes?')).toBe(true);
    expect(isFollowUp('what about that one')).toBe(true);
  });

  it('treats a self-contained question as new, not a follow-up', () => {
    expect(isFollowUp('postcode for Ikeja, Lagos')).toBe(false);
    expect(isFollowUp('list the LGAs in Kano')).toBe(false);
  });
});

describe('isSpatialQuestion', () => {
  it('detects a message that points at what the map shows', () => {
    expect(isSpatialQuestion('what is shown here')).toBe(true);
    expect(isSpatialQuestion('postcode near me')).toBe(true);
    expect(isSpatialQuestion('any postcode units nearby')).toBe(true);
    expect(isSpatialQuestion('look around here')).toBe(true);
    expect(isSpatialQuestion('what district is this area')).toBe(true);
    expect(isSpatialQuestion('my current location')).toBe(true);
  });

  it('ignores a message that names its own place or asks to move the map', () => {
    expect(isSpatialQuestion('show me Lagos state on the map')).toBe(false);
    expect(isSpatialQuestion('list the LGAs in Kano')).toBe(false);
    expect(isSpatialQuestion('postcode for Ikeja')).toBe(false);
    expect(isSpatialQuestion('where is the Infrastructure Bank')).toBe(false);
  });

  it('does not match "here" inside another word', () => {
    expect(isSpatialQuestion('where can I find a code')).toBe(false);
    expect(isSpatialQuestion('the weather there')).toBe(false);
  });
});
