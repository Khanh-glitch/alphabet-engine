/**
 * Bundles the TypeScript domain tests and runs them with the Node test runner.
 *
 * esbuild does the transpile so the tests can import `src/**` directly; node
 * builtins stay external.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'tools/.build/tests.mjs');

mkdirSync(dirname(out), { recursive: true });

await build({
  entryPoints: [join(here, 'tests.ts')],
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  logLevel: 'warning',
});

const args = process.argv.slice(2);
const result = spawnSync(process.execPath, ['--test', out, ...args], {
  cwd: root,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
