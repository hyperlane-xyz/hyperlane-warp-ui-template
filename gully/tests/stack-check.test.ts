// Gully stack check (gully-ops stack/, owner rule 2026-11-25 "Whole-stack sync"): this repo's chains, vendored kits and versions
// must match the stack registry snapshot in .stack/. Never edit .stack/snapshot.json or .stack/stack-check.mjs here: change the
// registry in gully-ops and run stack/tools/propagate.mjs. .stack/checks.json is this repo's own list of what it promises.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('stack check: this repo matches the Gully stack registry', () => {
  let out: string;
  try {
    out = execFileSync(process.execPath, [path.join(root, '.stack/stack-check.mjs'), '--root', root], { encoding: 'utf8' });
  } catch (e) {
    throw new Error(String((e as { stdout?: string }).stdout || e));
  }
  expect(out).toMatch(/: PASS/);
});
