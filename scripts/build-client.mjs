#!/usr/bin/env node
/**
 * Build the client half into the `window.__ModuleLoader__.load({...})` format.
 *
 * The DSH client module table only guarantees `react`, so React stays external
 * and every other import is bundled. The output is a single classic script with
 * a hand-written wrapper around the IIFE bundle — the wrapper's `id` must equal
 * the package name exactly, or the loader reports
 * `loaded without registering ... via __ModuleLoader__.load`.
 */

import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const entry = join(root, 'src', 'client', 'index.ts')
const outFile = join(root, 'lib', 'client.js')

const result = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome110'],
  jsx: 'transform',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  minify: false,
  legalComments: 'none',
  logLevel: 'warning',
})

const bundled = result.outputFiles[0]?.text ?? ''
if (bundled === '') throw new Error('build-client: esbuild produced no output')

const wrapped = `window.__ModuleLoader__.load({
  id: 'dsh-todos-diy',
  factory(require) {
    const module = { exports: {} }
    const exports = module.exports
    ;(function (module, exports, require) {
${indent(bundled, 6)}
    })(module, exports, require)
    return module.exports.default ?? module.exports
  },
})
`

function indent(text, spaces) {
  const pad = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((line) => (line === '' ? line : pad + line))
    .join('\n')
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, wrapped, 'utf8')
console.log(`build-client: wrote ${String(bundled.length)} bytes to lib/client.js`)
