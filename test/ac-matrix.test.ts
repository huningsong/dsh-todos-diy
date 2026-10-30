/**
 * Guards the AC coverage matrix (v1.3 / 0.2.0).
 *
 * The matrix is documentation, but it must stay complete: a missing row means an
 * acceptance criterion nobody claims to cover.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const matrix = readFileSync(join(here, '../../docs/testing/AC-覆盖矩阵.md'), 'utf8')

describe('AC coverage matrix', () => {
  it('lists every acceptance criterion AC-01…AC-45 exactly once', () => {
    for (let index = 1; index <= 45; index += 1) {
      const id = `AC-${String(index).padStart(2, '0')}`
      const occurrences = matrix.split('\n').filter((line) => line.startsWith(`| ${id} |`)).length
      assert.equal(occurrences, 1, `${id} must appear exactly once in the matrix`)
    }
  })

  it('marks each row as automated, scripted or manual', () => {
    for (const line of matrix.split('\n')) {
      if (!line.startsWith('| AC-')) continue
      assert.match(line, /\| (自动|脚本|手工) \|$/, `row must declare a status: ${line}`)
    }
  })
})
