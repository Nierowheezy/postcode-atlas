/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Guards the Vercel deployment failure this project had once: Vercel
 * transpiles each `api/` function per file to plain `.js` and runs it in
 * Node ESM, which rejects extensionless relative imports
 * (`from './types'` -> ERR_MODULE_NOT_FOUND at runtime). Vite, vitest, and
 * `tsc` all tolerate the bare form, so nothing local caught it and every
 * API route 500'd in production while `npm run dev` worked.
 *
 * The walk below mirrors the module graph Node actually loads from the
 * three function entries, so a bare specifier anywhere in that graph fails
 * the suite before it can reach a deploy.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** The three Vercel function entries under `api/`. */
const ENTRIES = ['api/ask.ts', 'api/nipost/[...path].ts', 'api/v1/[...path].ts'];

/** Matches `from '...'`, `import('...')`, and bare `import '...'` specifiers. */
const SPECIFIER = /(?:from\s+|import\s*\(\s*|import\s+)(['"])(\.{1,2}\/[^'"]+)\1/g;

/** Resolves a relative specifier the way a bundler would, trying `.js` -> `.ts`. */
function resolveSpecifier(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec);
  const stem = base.replace(/\.js$/, '');
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${stem}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Walks the import graph from `entries`, returning every reachable project file. */
function walkGraph(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = entries.map((entry) => resolve(ROOT, entry));
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(SPECIFIER)) {
      const target = resolveSpecifier(file, match[2]);
      if (target) queue.push(target);
    }
  }
  return seen;
}

describe('server import graph (Vercel / Node ESM)', () => {
  const graph = walkGraph(ENTRIES);

  it('reaches every api entry', () => {
    for (const entry of ENTRIES) {
      expect(graph.has(resolve(ROOT, entry))).toBe(true);
    }
    expect(graph.size).toBeGreaterThan(10);
  });

  it('uses explicit extensions on every relative import Node will load', () => {
    const bare: string[] = [];
    for (const file of graph) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(SPECIFIER)) {
        if (!/\.[a-z]+$/.test(match[2])) {
          bare.push(`${file.replace(`${ROOT}/`, '')}: ${match[2]}`);
        }
      }
    }
    expect(bare).toEqual([]);
  });
});
