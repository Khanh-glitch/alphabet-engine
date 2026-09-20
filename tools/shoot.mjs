/**
 * Screenshot / simulation runner.
 *
 * Bundles tools/harness.ts with esbuild (so the game's TypeScript and dynamic
 * imports resolve exactly as they do in the browser) and runs it on Node with a
 * real canvas. Nothing here ships in the game build.
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = resolve(root, 'tools/.build');
mkdirSync(outDir, { recursive: true });
const outfile = resolve(outDir, 'harness.mjs');

await build({
  entryPoints: [resolve(here, 'harness.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile,
  external: ['@napi-rs/canvas'],
  logLevel: 'warning',
});

const result = spawnSync(process.execPath, [outfile, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: root,
});
process.exit(result.status ?? 0);
