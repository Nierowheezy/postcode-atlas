import { describe, expect, it } from 'vitest';
import { isFollowUp } from './followup';

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
