#!/usr/bin/env node
/**
 * Build both halves:
 *  - host: `tsc` compiles `src/host/**` to `lib/` (strict TypeScript);
 *  - client: esbuild bundles `src/client/index.ts` into the
 *    `window.__ModuleLoader__.load({...})` format at `lib/client.js`, with React
 *    external because the DSH client module table only guarantees it.
 */

import { spawnSync } from 'node:child_process'

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const lib = join(root, 'lib')

const tsc = spawnSync(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json'], {
  cwd: root,
  stdio: 'inherit',
})
if (tsc.status !== 0) {
  console.error('build: tsc failed')
  process.exit(tsc.status ?? 1)
}

// Now build the client bundle from src/client into the ModuleLoader format.
const clientBuild = spawnSync(process.execPath, [join(root, 'scripts', 'build-client.mjs')], {
  cwd: root,
  stdio: 'inherit',
})
if (clientBuild.status !== 0) {
  console.error('build: client build failed')
  process.exit(clientBuild.status ?? 1)
}

console.log('build: host compiled to lib/, client bundled')
