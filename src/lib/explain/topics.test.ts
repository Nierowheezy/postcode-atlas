/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { EXPLAIN_TOPICS } from '../tools/types';
import { EXPLANATION_CONTENT, getExplanation } from './topics';

describe('explanation topics', () => {
  it('gives every topic non-empty copy', () => {
    for (const topic of EXPLAIN_TOPICS) {
      const explanation = getExplanation(topic);
      expect(explanation).toBeDefined();
      expect(explanation?.topic).toBe(topic);
      expect(explanation?.title.length).toBeGreaterThan(0);
      expect(explanation?.summary.length).toBeGreaterThan(0);
      expect(explanation?.points.length).toBeGreaterThan(0);
      expect(explanation?.points.every((point) => point.length > 0)).toBe(true);
    }
  });

  it('covers every declared topic exactly once', () => {
    expect(Object.keys(EXPLANATION_CONTENT).sort()).toEqual([...EXPLAIN_TOPICS].sort());
  });

  it('returns undefined for an unknown topic', () => {
    expect(getExplanation('not_a_topic')).toBeUndefined();
  });

  it('uses no em dash, en dash, or ellipsis characters', () => {
    expect(JSON.stringify(EXPLANATION_CONTENT)).not.toMatch(/[\u2014\u2013\u2026]/);
  });
});
