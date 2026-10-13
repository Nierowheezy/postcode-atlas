/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { EXPLANATION_CONTENT, getExplanation } from '../../lib/explain/topics';
import { EXPLAIN_TOPICS } from '../../lib/tools/types';
import { listExplanations, readExplanation } from './explain';

describe('listExplanations', () => {
  it('lists every declared topic with its title and the editorial source', () => {
    const rows = listExplanations();

    expect(rows.map((row) => row.topic)).toEqual([...EXPLAIN_TOPICS]);
    for (const row of rows) {
      expect(row.source).toBe('editorial');
      expect(row.title).toBe(EXPLANATION_CONTENT[row.topic].title);
      expect(row.title.length).toBeGreaterThan(0);
    }
  });
});

describe('readExplanation', () => {
  it('returns the full content for a topic, labelled editorial', () => {
    expect(readExplanation('hierarchy')).toEqual({
      ...getExplanation('hierarchy'),
      source: 'editorial',
    });
  });

  it('reads every declared topic', () => {
    for (const topic of EXPLAIN_TOPICS) {
      expect(readExplanation(topic)?.topic).toBe(topic);
    }
  });

  it('carries the example only for postcode_parts', () => {
    expect(readExplanation('postcode_parts')?.example).toBe('LA-11-A12-AK-08');
    expect(readExplanation('hierarchy')?.example).toBeUndefined();
  });

  it('trims surrounding whitespace and ignores case', () => {
    expect(readExplanation('  Hierarchy ')?.topic).toBe('hierarchy');
    expect(readExplanation('NDAPS')?.topic).toBe('ndaps');
  });

  it('returns null for an unknown or blank topic', () => {
    expect(readExplanation('not_a_topic')).toBeNull();
    expect(readExplanation('')).toBeNull();
    expect(readExplanation('   ')).toBeNull();
  });

  it('returns a copy, leaving the shared content unchanged', () => {
    const explanation = readExplanation('hierarchy');

    expect(explanation).not.toBe(EXPLANATION_CONTENT.hierarchy);
    explanation?.points.push('mutated');
    expect(EXPLANATION_CONTENT.hierarchy.points).not.toContain('mutated');
    expect(EXPLANATION_CONTENT.hierarchy.points.length).toBe(
      getExplanation('hierarchy')?.points.length
    );
  });
});
