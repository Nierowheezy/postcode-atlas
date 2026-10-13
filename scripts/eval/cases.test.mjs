import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { cases } from './cases.mjs';

/**
 * The tool names live in TypeScript (`src/lib/tools/types.ts`), which this Node
 * ESM test cannot import. Reading the literal out of the source keeps a typo in
 * `expectTool` from silently passing. It is a regex over one known array, not a
 * TypeScript parser.
 */
const typesSrc = readFileSync(new URL('../../src/lib/tools/types.ts', import.meta.url), 'utf8');
const toolNamesLiteral = typesSrc.match(/export const TOOL_NAMES = \[([\s\S]*?)\]/);
const TOOL_NAMES = toolNamesLiteral
  ? [...toolNamesLiteral[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1])
  : [];

const GROUPS = ['core', 'languages', 'regional-terms', 'ambiguity', 'tool-accuracy'];

describe('case table', () => {
  it('reads the tool names it validates against', () => {
    expect(TOOL_NAMES.length).toBe(12);
    expect(TOOL_NAMES).toContain('getPostcode');
  });

  it('has a case to run', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it('numbers every case uniquely', () => {
    const numbers = cases.map((c) => c.n);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('describes every case in words, in a known group, with a runnable check', () => {
    for (const c of cases) {
      expect(typeof c.n, `case ${c.n} number`).toBe('number');
      expect(typeof c.name, `case ${c.n} name`).toBe('string');
      expect(c.name.length, `case ${c.n} name is empty`).toBeGreaterThan(0);
      expect(GROUPS, `case ${c.n} group`).toContain(c.group);
      expect(typeof c.expect, `case ${c.n} expect`).toBe('string');
      expect(c.expect.length, `case ${c.n} expect is empty`).toBeGreaterThan(0);
      expect(c.text || (c.turns && c.turns.length), `case ${c.n} has no text or turns`).toBeTruthy();
      const checks = [c.check, c.check2, c.check3].filter(Boolean);
      expect(checks.length, `case ${c.n} has no check`).toBeGreaterThan(0);
      for (const fn of checks) expect(typeof fn, `case ${c.n} check`).toBe('function');
    }
  });

  it('names a real Atlas tool, or none, for every case', () => {
    for (const c of cases) {
      expect(c.expectTool, `case ${c.n} expectTool`).toBeTruthy();
      if (c.expectTool !== 'none') {
        expect(TOOL_NAMES, `case ${c.n} expects ${c.expectTool}`).toContain(c.expectTool);
      }
    }
  });
});
