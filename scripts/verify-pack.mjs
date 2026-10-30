#!/usr/bin/env node
/**
 * Packaging gate (NF11 / §10.4).
 *
 * Verifies, without installing anything, that:
 *  - `package.json` declares the identity fields the loader relies on;
 *  - every path in `exports`/`main` exists in the tarball;
 *  - the client bundle registers the exact package name;
 *  - the host bundle imports no `@deepseek-ai/*` package;
 *  - the tarball contains the documented file set.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const problems = []

/** Record a failure. */
function fail(message) {
  problems.push(message)
}

// 1) identity
if (manifest.name !== 'dsh-todos-diy') fail(`package name is ${String(manifest.name)}, expected dsh-todos-diy`)
if (manifest.type !== 'module') fail('package must be type: module')
if (manifest.main !== './lib/index.js') fail(`main is ${String(manifest.main)}`)
if (manifest.dependencies !== undefined && Object.keys(manifest.dependencies).length > 0) {
  fail('package must have zero runtime dependencies')
}
if (manifest.peerDependencies !== undefined) fail('package must not declare peerDependencies')
if (manifest.engines?.node !== '>=22.19.0') fail(`engines.node is ${String(manifest.engines?.node)}`)
if (manifest.engines?.dsh !== '^0.2.1-rc.3') fail(`engines.dsh is ${String(manifest.engines?.dsh)}`)
if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') fail('dsh.bundle.patch must point at cordis.patch.yml')
if (manifest.dsh?.client?.platform !== 'web') fail('dsh.client.platform must be "web"')

// 2) exports exist
for (const [key, value] of Object.entries(manifest.exports ?? {})) {
  if (typeof value !== 'string' || value.includes('*')) continue
  if (!existsSync(join(root, value))) fail(`exports[${JSON.stringify(key)}] -> ${value} does not exist`)
}

// 3) client bundle identity
const clientPath = join(root, 'lib', 'client.js')
if (!existsSync(clientPath)) {
  fail('lib/client.js is missing (run pnpm build)')
} else {
  const client = readFileSync(clientPath, 'utf8')
  if (!client.includes("id: 'dsh-todos-diy'")) fail("lib/client.js does not register id 'dsh-todos-diy'")
  if (!client.includes('__ModuleLoader__.load')) fail('lib/client.js does not call __ModuleLoader__.load')
  const foreign = [...client.matchAll(/require\("([^"]+)"\)/g)]
    .map((match) => match[1])
    .filter((name) => name !== 'react' && name !== 'react-dom' && name !== 'react/jsx-runtime')
  if (foreign.length > 0) fail(`lib/client.js requires non-platform modules: ${foreign.join(', ')}`)
}

// 4) host bundle must not import official packages
const hostPath = join(root, 'lib', 'index.js')
if (!existsSync(hostPath)) {
  fail('lib/index.js is missing (run pnpm build)')
} else {
  const host = readFileSync(hostPath, 'utf8')
  const imports = [...host.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1])
  const official = imports.filter((name) => name.startsWith('@deepseek-ai/'))
  if (official.length > 0) fail(`lib/index.js imports official packages: ${official.join(', ')}`)
}

// 5) tarball contents
const packDir = mkdtempSync(join(tmpdir(), 'dsh-todos-pack-'))
try {
  execFileSync('npm', ['pack', '--pack-destination', packDir], { cwd: root, stdio: 'pipe' })
  const tarball = execFileSync('bash', ['-lc', `ls ${JSON.stringify(packDir)}/*.tgz`], { encoding: 'utf8' }).trim()
  const listing = execFileSync('tar', ['tzf', tarball], { encoding: 'utf8' }).split('\n').filter(Boolean)
  const required = [
    'package/package.json',
    'package/lib/index.js',
    'package/lib/client.js',
    'package/cordis.patch.yml',
    'package/README.md',
    'package/locale/zh.json',
    'package/locale/en.json',
    'package/assets/holidays-cn-2024-2027.json',
  ]
  for (const entry of required) {
    if (!listing.includes(entry)) fail(`tarball is missing ${entry}`)
  }
} catch (error) {
  fail(`npm pack failed: ${String(error)}`)
} finally {
  rmSync(packDir, { recursive: true, force: true })
}

if (problems.length > 0) {
  console.error('verify-pack: FAILED')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log('verify-pack: OK')
