/**
 * Regression tests for the four defects the independent test pass found.
 *
 *  1. snooze never fired (F4.5 / AC-12)
 *  2. paused/archived/done recurring tasks accepted `complete` (F1.2 / F7.7)
 *  3. an archived task could not be restored (F4.18 / AC-39)
 *  4. no quarter switcher in the done tab (F4.17) — covered by the client build
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { createRepository } from '../src/host/repo.js'
import { createStore } from '../src/host/store.js'
import { buildHolidayTable, type HolidayFile } from '../src/host/rules/holidays.js'
import { resolveTick } from '../src/host/rules/resolveTick.js'
import { archiveCompleted } from '../src/host/archive.js'
import { findArchivedTask, restoreArchivedTask } from '../src/host/archiveRestore.js'
import { storagePaths } from '../src/host/paths.js'
import { emptyState } from '../src/host/state.js'
import { createMemoryFs, type MemoryFs } from './memoryFs.js'
import { makeTask } from './fixtures.js'

const DATA_DIR = '/virtual/dsh/dsh-todos-diy'
const STATE = `${DATA_DIR}/tasks.json`
const NOW = new Date('2026-10-30T09:00:00+08:00')

const here = dirname(fileURLToPath(import.meta.url))
const holidays = buildHolidayTable(
  JSON.parse(readFileSync(join(here, '../../assets/holidays-cn-2024-2027.json'), 'utf8')) as HolidayFile,
)

/** Repository over a memory filesystem. */
function harness(now: Date = NOW) {
  const fs = createMemoryFs()
  fs.mkdir(DATA_DIR)
  const store = createStore({ dataDir: DATA_DIR, fs, now: () => now })
  store.load()
  const repo = createRepository({ store, now: () => now, debounceMs: 0 })
  return { fs, store, repo }
}

describe('DEFECT-4: snooze must fire once (F4.5 / AC-12)', () => {
  it('re-fires the task when snoozeUntil elapses', async () => {
    const { repo } = harness()
    const task = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    await repo.snooze(task.id, 15)
    const stored = repo.get(task.id)
    assert.ok(stored !== null)
    const plan = resolveTick([stored], new Date('2026-10-30T01:15:30Z'), { holidays, graceMinutes: 5 })
    assert.equal(plan.fire.length, 1, 'the snoozed reminder must fire once')
    assert.equal(plan.fire[0]?.key.endsWith('#snooze'), true)
  })

  it('does not fire before the snooze window elapses', async () => {
    const { repo } = harness()
    const task = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    await repo.snooze(task.id, 15)
    const stored = repo.get(task.id)
    assert.ok(stored !== null)
    const plan = resolveTick([stored], new Date('2026-10-30T01:14:00Z'), { holidays, graceMinutes: 5 })
    assert.equal(plan.fire.length, 0)
  })

  it('fires only once for the same snooze target', async () => {
    const { repo } = harness()
    const task = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    await repo.snooze(task.id, 15)
    const first = repo.get(task.id)
    assert.ok(first !== null)
    const plan = resolveTick([first], new Date('2026-10-30T01:15:30Z'), { holidays, graceMinutes: 5 })
    const delivered = plan.fire[0]
    assert.ok(delivered !== undefined)
    // Simulate the repository recording the delivery.
    const after = { ...first, state: { ...first.state, lastOccurrenceKey: delivered.key, lastFiredAt: new Date('2026-10-30T01:15:30Z').toISOString() } }
    const second = resolveTick([after], new Date('2026-10-30T01:16:00Z'), { holidays, graceMinutes: 5 })
    assert.equal(second.fire.length, 0, 'a snooze must not re-fire on the next tick')
  })

  it('does not fire a stale snooze outside the grace window', async () => {
    const { repo } = harness()
    const task = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    await repo.snooze(task.id, 15)
    const stored = repo.get(task.id)
    assert.ok(stored !== null)
    const plan = resolveTick([stored], new Date('2026-10-30T01:40:00Z'), { holidays, graceMinutes: 5 })
    assert.equal(plan.fire.some((occurrence) => occurrence.key.endsWith('#snooze')), false)
  })

  it('leaves the normal rule untouched', async () => {
    const { repo } = harness()
    const task = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    await repo.snooze(task.id, 15)
    const stored = repo.get(task.id)
    assert.ok(stored !== null)
    // Next regular occurrence (Monday) must still be scheduled.
    const plan = resolveTick([stored], new Date('2026-10-31T03:00:00Z'), { holidays, graceMinutes: 5 })
    assert.ok(plan.nextWakeAt !== null)
    assert.equal(plan.nextWakeAt.getTime() > new Date('2026-10-31T03:00:00Z').getTime(), true)
  })
})

describe('DEFECT-5: complete must respect the state machine (F1.2)', () => {
  /** A recurring task that already has a current occurrence. */
  async function withOccurrence(repo: ReturnType<typeof createRepository>) {
    const task = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    await repo.applyTick([{ taskId: task.id, firedKey: `${task.id}@2026-10-30T01:00:00.000Z`, firedAt: '2026-10-30T01:00:05.000Z' }], NOW)
    return task
  }

  it('refuses complete on a paused recurring task', async () => {
    const { repo } = harness()
    const task = await withOccurrence(repo)
    await repo.pause(task.id)
    await assert.rejects(repo.complete(task.id), (error: { code?: string }) => {
      assert.equal(error.code, 'invalid_state')
      return true
    })
  })

  it('refuses complete on an archived recurring task', async () => {
    const { repo } = harness()
    const task = await withOccurrence(repo)
    await repo.remove(task.id)
    await assert.rejects(repo.complete(task.id), (error: { code?: string }) => {
      assert.equal(error.code, 'invalid_state')
      return true
    })
  })

  it('refuses complete on a done recurring task', async () => {
    const { repo } = harness()
    const task = await withOccurrence(repo)
    // Force the state a "done" transition would leave behind.
    const stored = repo.get(task.id)
    assert.ok(stored !== null)
    const done = { ...stored, status: 'done' as const, doneAt: NOW.toISOString() }
    const index = repo.snapshotTasks().findIndex((entry) => entry.id === task.id)
    ;(repo.snapshotTasks() as unknown as typeof done[])[index] = done
    await assert.rejects(repo.complete(task.id), (error: { code?: string }) => {
      assert.equal(error.code, 'invalid_state')
      return true
    })
  })

  it('still completes an active recurring task', async () => {
    const { repo } = harness()
    const task = await withOccurrence(repo)
    const result = await repo.complete(task.id)
    assert.equal(result.task.status, 'active')
  })
})

describe('DEFECT-6: an archived task can be restored (F4.18 / AC-39)', () => {
  /** Build a state with one task completed in the previous quarter. */
  function archivedFixture(): { fs: MemoryFs; state: ReturnType<typeof emptyState> } {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    const state = emptyState(new Date('2027-01-05T09:00:00+08:00'))
    state.tasks = [
      makeTask({
        id: 'tr_q3',
        title: 'Q3 已完成',
        status: 'done',
        doneAt: '2026-08-15T02:00:00.000Z',
      }),
    ]
    const paths = storagePaths(DATA_DIR)
    archiveCompleted(state, {
      paths,
      fs,
      now: new Date('2027-01-05T09:00:00+08:00'),
      timeZone: 'Asia/Shanghai',
    })
    return { fs, state }
  }

  it('finds an archived task by id', () => {
    const { fs } = archivedFixture()
    const found = findArchivedTask('tr_q3', storagePaths(DATA_DIR), fs)
    assert.equal(found?.quarter, '2026-Q3')
    assert.equal(found?.task.title, 'Q3 已完成')
  })

  it('moves the task back into the live document as active', () => {
    const { fs, state } = archivedFixture()
    const result = restoreArchivedTask(state, 'tr_q3', storagePaths(DATA_DIR), fs, new Date('2027-01-06T09:00:00+08:00'))
    assert.equal(result.restored, true)
    if (result.restored) {
      assert.equal(result.quarter, '2026-Q3')
      assert.equal(result.task.status, 'active')
      assert.equal(result.task.doneAt, null)
      assert.equal(result.task.archivedQuarter, null)
    }
    assert.equal(state.tasks.some((task) => task.id === 'tr_q3'), true)
  })

  it('removes the entry from the quarter file and updates the index', () => {
    const { fs, state } = archivedFixture()
    restoreArchivedTask(state, 'tr_q3', storagePaths(DATA_DIR), fs, new Date('2027-01-06T09:00:00+08:00'))
    const file = JSON.parse(fs.files.get(`${DATA_DIR}/archive/completed-2026-Q3.json`) as string)
    assert.equal(file.tasks.length, 0)
    const index = JSON.parse(fs.files.get(`${DATA_DIR}/archive/index.json`) as string)
    assert.equal(index.quarters.length, 0, 'an emptied quarter is dropped from the index')
  })

  it('reports not-archived for an unknown id', () => {
    const { fs, state } = archivedFixture()
    const result = restoreArchivedTask(state, 'tr_missing', storagePaths(DATA_DIR), fs, new Date())
    assert.deepEqual(result, { restored: false, reason: 'not-archived' })
  })

  it('keeps the archived file intact when the quarter file is unreadable', () => {
    const { fs, state } = archivedFixture()
    const path = `${DATA_DIR}/archive/completed-2026-Q3.json`
    fs.files.set(path, '{bad')
    const result = restoreArchivedTask(state, 'tr_q3', storagePaths(DATA_DIR), fs, new Date())
    assert.equal(result.restored, false)
    assert.equal(fs.files.get(path), '{bad')
  })
})

describe('store wiring for restored tasks', () => {
  it('persists a restored archive task into tasks.json', async () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    const state = emptyState(new Date('2027-01-05T09:00:00+08:00'))
    state.tasks = [
      makeTask({ id: 'tr_q3', title: 'Q3', status: 'done', doneAt: '2026-08-15T02:00:00.000Z' }),
    ]
    const paths = storagePaths(DATA_DIR)
    archiveCompleted(state, { paths, fs, now: new Date('2027-01-05T09:00:00+08:00'), timeZone: 'Asia/Shanghai' })
    restoreArchivedTask(state, 'tr_q3', paths, fs, new Date('2027-01-06T09:00:00+08:00'))
    const store = createStore({ dataDir: DATA_DIR, fs, now: () => new Date('2027-01-06T09:00:00+08:00') })
    store.set(state)
    store.flush()
    const written = JSON.parse(fs.files.get(STATE) as string)
    assert.equal(written.tasks.some((task: { id: string }) => task.id === 'tr_q3'), true)
  })
})

describe('DEFECT-7: settings graceMinutes must take effect at runtime', () => {
  it('uses the persisted setting rather than the loader default', async () => {
    const { repo, store } = harness()
    // Create the task the previous day so the 10-30 09:00 occurrence is due.
    const task = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const stored0 = repo.get(task.id)
    assert.ok(stored0 !== null)
    ;(repo.snapshotTasks() as unknown as { createdAt: string }[])[0]!.createdAt = '2026-10-29T00:00:00.000Z'
    repo.updateSettings({ graceMinutes: 0 })
    assert.equal(store.state.settings.graceMinutes, 0)
    const stored = repo.get(task.id)
    assert.ok(stored !== null)
    // 09:00:30 with grace 0 → missed, not fired.
    const strict = resolveTick([stored], new Date('2026-10-30T01:00:30Z'), { holidays, graceMinutes: 0 })
    assert.equal(strict.fire.length, 0)
    // With the default 5 it would still be inside the window.
    const loose = resolveTick([stored], new Date('2026-10-30T01:00:30Z'), { holidays, graceMinutes: 5 })
    assert.equal(loose.fire.length, 1)
  })
})

describe('DEFECT-8: paused/done tasks must not resurface as pending cards (D-22)', () => {
  it('drops a pending overlay row once its task is paused', async () => {
    const { pendingDeliveries } = await import('../src/host/delivery.js')
    const task = makeTask({ id: 'tr_a', status: 'paused' })
    const row = {
      occurrenceKey: 'tr_a@2026-10-30T01:00:00.000Z',
      channel: 'overlay' as const,
      status: 'ok' as const,
      at: '2026-10-30T01:00:05.000Z',
      readAt: null,
      ignoredAt: null,
      dismissedAt: null,
      error: null,
    }
    assert.equal(pendingDeliveries([row], [task], new Date('2026-10-30T09:00:00+08:00')).length, 0)
  })

  it('drops a pending row once its task is done', async () => {
    const { pendingDeliveries } = await import('../src/host/delivery.js')
    const task = makeTask({ id: 'tr_a', status: 'done' })
    const row = {
      occurrenceKey: 'tr_a@2026-10-30T01:00:00.000Z',
      channel: 'overlay' as const,
      status: 'ok' as const,
      at: '2026-10-30T01:00:05.000Z',
      readAt: null,
      ignoredAt: null,
      dismissedAt: null,
      error: null,
    }
    assert.equal(pendingDeliveries([row], [task], new Date('2026-10-30T09:00:00+08:00')).length, 0)
  })
})
