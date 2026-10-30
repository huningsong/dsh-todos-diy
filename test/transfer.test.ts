/**
 * Import / export tests (F9.4 / AC-25 / F9.6).
 */

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

import { buildExport, mergeTasks, parseImport, settingsExport, backupBeforeImport } from '../src/host/transfer.js'
import { emptyState, defaultSettings } from '../src/host/state.js'
import { makeTask } from './fixtures.js'

const NOW = new Date('2026-10-30T09:00:00+08:00')

/** A state with two tasks. */
function stateWithTasks() {
  const state = emptyState(NOW)
  state.tasks = [
    makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRS', title: 'A' }),
    makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRT', title: 'B' }),
  ]
  return state
}

describe('buildExport', () => {
  it('wraps the document with a kind and timestamp', () => {
    const bundle = buildExport(stateWithTasks(), NOW)
    assert.equal(bundle.kind, 'dsh-todos-diy/export')
    assert.equal(bundle.exportedAt, NOW.toISOString())
    assert.equal(bundle.tasks.length, 2)
    assert.equal(bundle.schemaVersion, 1)
  })

  it('caps the delivery log at the last 1000 rows', () => {
    const state = stateWithTasks()
    state.deliveries = Array.from({ length: 1200 }, (_, index) => ({
      occurrenceKey: `k${String(index)}`,
      channel: 'overlay' as const,
      status: 'ok' as const,
      at: NOW.toISOString(),
      readAt: null,
      ignoredAt: null,
      dismissedAt: null,
      error: null,
    }))
    assert.equal(buildExport(state, NOW).deliveries.length, 1000)
  })
})

describe('parseImport', () => {
  it('accepts an export bundle', () => {
    const candidate = parseImport(buildExport(stateWithTasks(), NOW))
    assert.equal(candidate.tasks.length, 2)
    assert.ok(candidate.settings !== null)
  })

  it('accepts a bare tasks.json document', () => {
    const candidate = parseImport(stateWithTasks())
    assert.equal(candidate.tasks.length, 2)
  })

  it('rejects a non-object payload', () => {
    assert.throws(() => parseImport([]), (error: { code?: string }) => error.code === 'invalid_argument')
    assert.throws(() => parseImport('x'), (error: { code?: string }) => error.code === 'invalid_argument')
  })

  it('rejects a newer schemaVersion with schema_mismatch', () => {
    assert.throws(
      () => parseImport({ schemaVersion: 99, tasks: [] }),
      (error: { code?: string }) => error.code === 'schema_mismatch',
    )
  })

  it('rejects a payload with no tasks array', () => {
    assert.throws(
      () => parseImport({ schemaVersion: 1 }),
      (error: { code?: string }) => error.code === 'schema_mismatch',
    )
  })

  it('skips malformed tasks with a warning instead of failing', () => {
    const candidate = parseImport({
      schemaVersion: 1,
      tasks: [makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRS' }), { id: '' }, null],
    })
    assert.equal(candidate.tasks.length, 1)
    assert.ok(candidate.warnings.length > 0)
  })
})

describe('mergeTasks', () => {
  it('adds only unseen ids', () => {
    const existing = [makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRS', title: 'A' })]
    const incoming = [
      makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRS', title: 'A2' }),
      makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRT', title: 'B' }),
    ]
    const merged = mergeTasks(existing, incoming)
    assert.equal(merged.added, 1)
    assert.equal(merged.tasks.length, 2)
    // The existing row wins: a merge must never overwrite live state.
    assert.equal(merged.tasks[0]?.title, 'A')
  })

  it('reports zero when everything is already present', () => {
    const existing = [makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRS' })]
    assert.equal(mergeTasks(existing, existing).added, 0)
  })
})

describe('settingsExport (F9.6)', () => {
  it('writes a settings-only document', () => {
    const text = settingsExport(defaultSettings(), NOW)
    const parsed = JSON.parse(text)
    assert.equal(parsed.kind, 'dsh-todos-diy/settings')
    assert.equal(parsed.settings.timeZone, 'Asia/Shanghai')
    assert.equal(parsed.tasks, undefined)
  })
})

describe('backupBeforeImport', () => {
  let dir = ''
  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'dsh-todos-backup-'))
  })
  after(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('copies the live file next to it', () => {
    const file = join(dir, 'tasks.json')
    writeFileSync(file, '{"schemaVersion":1}', 'utf8')
    const backup = backupBeforeImport(file, NOW)
    assert.ok(backup !== null)
    assert.ok(existsSync(backup))
    assert.equal(readFileSync(backup, 'utf8'), '{"schemaVersion":1}')
  })

  it('returns null when there is no file yet', () => {
    assert.equal(backupBeforeImport(join(dir, 'missing.json'), NOW), null)
  })
})
