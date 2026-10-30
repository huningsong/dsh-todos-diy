/**
 * Soft-delete retention tests (F1.5): an archived task survives 30 days and is
 * then purged by the daily sweep.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRepository } from '../src/host/repo.js'
import { createStore } from '../src/host/store.js'
import { ARCHIVE_RETENTION_DAYS, isExpiredArchive, sweepExpiredArchives } from '../src/host/retention.js'
import { createMemoryFs } from './memoryFs.js'
import { makeTask } from './fixtures.js'

const DATA_DIR = '/virtual/dsh/dsh-todos-diy'
const NOW = new Date('2026-10-30T09:00:00+08:00')

describe('isExpiredArchive', () => {
  it('ignores non-archived tasks', () => {
    const task = makeTask({ status: 'active', updatedAt: '2020-01-01T00:00:00.000Z' })
    assert.equal(isExpiredArchive(task, NOW), false)
  })

  it('keeps an archive under 30 days old', () => {
    const task = makeTask({ status: 'archived', updatedAt: '2026-10-15T00:00:00.000Z' })
    assert.equal(isExpiredArchive(task, NOW), false)
  })

  it('expires an archive at exactly 30 days', () => {
    const task = makeTask({ status: 'archived', updatedAt: '2026-09-30T00:00:00.000Z' })
    assert.equal(isExpiredArchive(task, new Date('2026-10-30T00:00:00.000Z')), true)
  })

  it('expires an older archive', () => {
    const task = makeTask({ status: 'archived', updatedAt: '2026-08-01T00:00:00.000Z' })
    assert.equal(isExpiredArchive(task, NOW), true)
  })

  it('uses the documented default of 30 days', () => {
    assert.equal(ARCHIVE_RETENTION_DAYS, 30)
  })

  it('ignores an unparseable timestamp', () => {
    const task = makeTask({ status: 'archived', updatedAt: 'not-a-date' })
    assert.equal(isExpiredArchive(task, NOW), false)
  })
})

describe('sweepExpiredArchives', () => {
  it('splits kept tasks from expired ids', () => {
    const tasks = [
      makeTask({ id: 'tr_a', status: 'active' }),
      makeTask({ id: 'tr_b', status: 'archived', updatedAt: '2026-10-20T00:00:00.000Z' }),
      makeTask({ id: 'tr_c', status: 'archived', updatedAt: '2026-08-01T00:00:00.000Z' }),
    ]
    const result = sweepExpiredArchives(tasks, NOW)
    assert.deepEqual(result.purge, ['tr_c'])
    assert.deepEqual(result.keep.map((task) => task.id), ['tr_a', 'tr_b'])
  })

  it('returns nothing to purge for a clean list', () => {
    const result = sweepExpiredArchives([makeTask({ id: 'tr_a' })], NOW)
    assert.deepEqual(result.purge, [])
  })
})

describe('repository.sweepArchives', () => {
  /** Repository over a memory filesystem. */
  function harness() {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    const store = createStore({ dataDir: DATA_DIR, fs, now: () => NOW })
    store.load()
    const repo = createRepository({ store, now: () => NOW, debounceMs: 0 })
    return { fs, store, repo }
  }

  it('purges only the expired archive', async () => {
    const { repo } = harness()
    const kept = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const expired = await repo.create({ title: 'B', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    await repo.remove(expired.id)
    // Backdate the archive so it is older than the window.
    const stored = repo.get(expired.id)
    assert.ok(stored !== null)
    ;(repo.snapshotTasks() as unknown as { updatedAt: string }[])[1]!.updatedAt = '2026-08-01T00:00:00.000Z'
    const purged = await repo.sweepArchives(NOW)
    assert.equal(purged, 1)
    assert.equal(repo.get(expired.id), null)
    assert.ok(repo.get(kept.id) !== null)
  })

  it('is a no-op when nothing expired', async () => {
    const { repo } = harness()
    await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    assert.equal(await repo.sweepArchives(NOW), 0)
  })
})
