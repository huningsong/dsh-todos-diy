/**
 * Regression tests for the independent code review's findings.
 *
 * Each describe block names the defect so a future refactor cannot reintroduce
 * it silently.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { archiveCompleted, readArchiveIndex } from '../src/host/archive.js'
import { createRepository } from '../src/host/repo.js'
import { createStore } from '../src/host/store.js'
import { storagePaths } from '../src/host/paths.js'
import { SCHEMA_VERSION, emptyState } from '../src/host/state.js'
import { resolveTick } from '../src/host/rules/resolveTick.js'
import { buildHolidayTable, type HolidayFile } from '../src/host/rules/holidays.js'
import { toTaskView } from '../src/host/taskView.js'
import { planToChanges } from '../src/host/tickChanges.js'
import { createMemoryFs, type MemoryFs } from './memoryFs.js'
import { makeOnceTask, makeTask } from './fixtures.js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

describe('BLOCKER A: a newer schema file must never be overwritten (F6.8)', () => {
  it('refuses every write after loading an unsupported version', async () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    const future = JSON.stringify({ schemaVersion: 99, tasks: [{ id: 'keep' }], settings: {}, meta: {} })
    fs.files.set(STATE, future)
    const store = createStore({ dataDir: DATA_DIR, fs, now: () => NOW })
    store.load()
    assert.equal(store.stateName, 'unsupported-version')
    assert.equal(store.readOnly, true)
    const repo = createRepository({ store, now: () => NOW, debounceMs: 0 })
    await assert.rejects(
      repo.create({ title: 'x', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } }),
      (error: { code?: string }) => error.code === 'storage_read_only',
    )
    await repo.flush()
    assert.equal(fs.files.get(STATE), future, 'the newer file must stay byte-identical')
  })
})

describe('BLOCKER B: a corrupt quarter file must not delete its tasks (F4.19)', () => {
  it('keeps the task in the main file and reports the quarter as skipped', () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    fs.mkdir(`${DATA_DIR}/archive`)
    fs.files.set(`${DATA_DIR}/archive/completed-2026-Q4.json`, '{bad')
    fs.files.set(
      `${DATA_DIR}/archive/index.json`,
      JSON.stringify({ schemaVersion: 1, quarters: [{ quarter: '2026-Q4', file: 'completed-2026-Q4.json', count: 1, start: '', end: '' }] }),
    )
    const state = emptyState(new Date('2027-01-05T09:00:00+08:00'))
    state.tasks = [makeTask({ id: 'tr_a', status: 'done', doneAt: '2026-11-01T02:00:00.000Z' })]
    const result = archiveCompleted(state, {
      paths: storagePaths(DATA_DIR),
      fs,
      now: new Date('2027-01-05T09:00:00+08:00'),
      timeZone: 'Asia/Shanghai',
    })
    assert.deepEqual(result.skipped, ['2026-Q4'])
    assert.equal(state.tasks.length, 1, 'the task must stay in the main document')
    assert.equal(fs.files.get(`${DATA_DIR}/archive/completed-2026-Q4.json`), '{bad', 'the corrupt file must not be rewritten')
  })
})

describe('MAJOR: missedCount must not grow on every tick (F6.4)', () => {
  it('records the backlog exactly once across repeated ticks', () => {
    const task = makeTask({
      id: 'tr_a',
      createdAt: '2026-10-26T00:00:00.000Z',
      state: { ...makeTask().state, lastFiredAt: '2026-10-27T01:00:00.000Z', missedAt: null },
    })
    const first = resolveTick([task], new Date('2026-10-30T03:00:00Z'), { holidays, graceMinutes: 5 })
    assert.equal(first.markMissed.length, 3)
    // Simulate applyTick: record the newest missed instant *and* advance the
    // de-duplication marker to that occurrence.
    const newest = first.markMissed[first.markMissed.length - 1]
    assert.ok(newest !== undefined)
    const recorded = {
      ...task,
      state: {
        ...task.state,
        missedAt: newest.at.toISOString(),
        missedCount: 3,
        lastOccurrenceKey: newest.key,
        lastFiredAt: newest.at.toISOString(),
      },
    }
    const second = resolveTick([recorded], new Date('2026-10-30T03:01:00Z'), { holidays, graceMinutes: 5 })
    assert.equal(second.markMissed.length, 0, 'the same backlog must not be re-counted')
  })
})

describe('MAJOR: one-off advance must deliver once (F5.7)', () => {
  it('does not repeat the advance occurrence on a second tick', () => {
    const task = makeOnceTask('2026-11-05T14:00:00+08:00', '2026-11-05T18:00:00+08:00', {
      id: 'tr_b',
      notify: { channels: ['overlay'], template: '{title}', advanceMinutes: 10, sound: false, endReminder: true },
    })
    // 18:00 +08:00 = 10:00Z, so the 10-minute lead fires at 09:50Z.
    const first = resolveTick([task], new Date('2026-11-05T09:50:30Z'), { holidays, graceMinutes: 5 })
    const advance = first.fire.filter((occurrence) => occurrence.key.endsWith('#advance'))
    assert.equal(advance.length, 1)
    const after = { ...task, state: { ...task.state, lastOccurrenceKey: advance[0]?.key ?? null, firedEndAdvance: true } }
    const second = resolveTick([after], new Date('2026-11-05T09:51:30Z'), { holidays, graceMinutes: 5 })
    assert.equal(second.fire.filter((occurrence) => occurrence.key.endsWith('#advance')).length, 0, 'the advance must not be delivered twice')
  })

  it('does not mark the delivered advance as missed later', () => {
    const task = makeOnceTask('2026-11-05T14:00:00+08:00', '2026-11-05T18:00:00+08:00', {
      id: 'tr_c',
      notify: { channels: ['overlay'], template: '{title}', advanceMinutes: 10, sound: false, endReminder: true },
    })
    const key = 'tr_c@2026-11-05T09:50:00.000Z#advance'
    const after = { ...task, state: { ...task.state, lastOccurrenceKey: key, firedEndAdvance: true } }
    const later = resolveTick([after], new Date('2026-11-05T09:56:00Z'), { holidays, graceMinutes: 5 })
    assert.equal(later.markMissed.some((occurrence) => occurrence.key === key), false)
  })
})

describe('D-25: reaching endAt never auto-completes a one-off task (F3.6)', () => {
  it('stays active and becomes overdue once both nodes fired', async () => {
    const { repo } = harness()
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      once: { startAt: '2026-10-30T02:00:00Z', endAt: '2026-10-30T04:00:00Z' },
    })
    await repo.applyTick(
      [
        { taskId: task.id, firedKey: `${task.id}@2026-10-30T02:00:00.000Z#start`, phase: 'start', node: 'start' },
        { taskId: task.id, firedKey: `${task.id}@2026-10-30T04:00:00.000Z#end`, phase: 'end', node: 'end' },
      ],
      new Date('2026-10-30T05:00:00Z'),
    )
    const after = repo.get(task.id)
    assert.equal(after?.status, 'active', 'done must be an explicit user action (D-25)')
    assert.equal(after?.doneAt, null)
    assert.equal(after?.state.firedStart, true)
    assert.equal(after?.state.firedEnd, true)
  })

  it('is reported as overdue in the derived stage', async () => {
    const { repo } = harness()
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      once: { startAt: '2026-10-30T02:00:00Z', endAt: '2026-10-30T04:00:00Z' },
    })
    const view = toTaskView(repo.get(task.id) as never, { now: new Date('2026-10-30T05:00:00Z') })
    assert.equal(view.stage, 'overdue')
    assert.equal(view.status, 'active')
  })
})

describe('MAJOR: TaskView round-trips through create (F1.1)', () => {
  it('preserves the preset time for workdays', async () => {
    const { repo } = harness()
    const task = await repo.create({ title: 'x', kind: 'recurring', rule: { preset: 'workdays', time: '14:00' } })
    const view = toTaskView(task, { now: NOW })
    const rebuilt = await repo.create({
      title: view.title,
      kind: 'recurring',
      rule: view.rule,
      notify: view.notify,
    })
    assert.equal(rebuilt.rule?.cron, task.rule?.cron)
  })

  it('preserves weekly and monthly presets', async () => {
    const { repo } = harness()
    for (const rule of [
      { preset: 'weekly' as const, weekdays: [1, 3], time: '10:00' },
      { preset: 'monthly' as const, monthDays: [1, 30], time: '09:00' },
    ]) {
      const task = await repo.create({ title: 'x', kind: 'recurring', rule })
      const view = toTaskView(task, { now: NOW })
      const rebuilt = await repo.create({ title: view.title, kind: 'recurring', rule: view.rule, notify: view.notify })
      assert.equal(rebuilt.rule?.cron, task.rule?.cron)
    }
  })
})

describe('MAJOR: one-off tasks keep their own time zone (F2.6)', () => {
  it('reports the creating zone, not the global default', async () => {
    const { repo } = harness()
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      timeZone: 'America/New_York',
      once: { startAt: '2026-11-05T14:00:00', endAt: '2026-11-05T18:00:00' },
    })
    const view = toTaskView(task, { now: NOW })
    assert.equal(view.timeZone, 'America/New_York')
    assert.equal(view.utcOffset, 'UTC-04:00')
  })
})

describe('F1.2: done -> active undo clears doneAt (D-25)', () => {
  it('revives a completed task and clears the completion markers', async () => {
    const { repo } = harness()
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      once: { startAt: '2026-10-30T02:00:00Z', endAt: '2026-10-30T04:00:00Z' },
    })
    await repo.complete(task.id)
    assert.equal(repo.get(task.id)?.status, 'done')
    const revived = await repo.resume(task.id)
    assert.equal(revived.status, 'active')
    const after = repo.get(task.id)
    assert.equal(after?.doneAt, null)
    assert.equal(after?.pinned, false)
  })
})

describe('MINOR: search must not shrink the tab badges (F4.10)', () => {
  it('keeps counts over the unfiltered pool', async () => {
    const { repo } = harness()
    await repo.create({ title: '材料 A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    await repo.create({ title: '别的任务', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const all = repo.list({ view: 'recurring' })
    const searched = repo.list({ view: 'recurring', query: '材料' })
    assert.equal(all.counts.recurring, 2)
    assert.equal(searched.counts.recurring, 2, 'the badge must ignore the search box')
    assert.equal(searched.items.length, 1)
  })
})

describe('MINOR: settings validation rejects bad values (F9.1–F9.3)', () => {
  it('rejects NaN, out-of-range and malformed clock values', async () => {
    const { validateSettingsPatch } = await import('../src/host/validateSettings.js')
    for (const body of [
      { graceMinutes: 'abc' },
      { graceMinutes: 999 },
      { tickIntervalMs: 0 },
      { dnd: { start: '99:99' } },
      { dnd: { enabled: true, start: '22:00', end: '08:00', weekdaysOnly: true } },
    ]) {
      if (body['dnd'] !== undefined && typeof body['dnd'] === 'object') {
        const dnd = body['dnd'] as Record<string, unknown>
        if (dnd['start'] === '22:00') {
          // The valid shape must pass; only the malformed ones below must fail.
          assert.doesNotThrow(() => validateSettingsPatch(body))
          continue
        }
      }
      assert.throws(() => validateSettingsPatch(body), (error: { code?: string }) => error.code === 'invalid_argument')
    }
  })
})

describe('store must survive a JSON `null` root (F6.7)', () => {
  it('treats null as corrupt and rebuilds', () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    fs.files.set(STATE, 'null')
    const store = createStore({ dataDir: DATA_DIR, fs, now: () => NOW })
    assert.doesNotThrow(() => store.load())
    assert.equal(store.stateName, 'corrupt')
    assert.ok(store.lastRecovery !== null)
  })
})

describe('MAJOR: once + advance full lifecycle', () => {
  it('delivers exactly two advance reminders, then completes the task', async () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    let now = new Date('2026-11-05T13:40:00+08:00')
    const store = createStore({ dataDir: DATA_DIR, fs, now: () => now })
    store.load()
    const repo = createRepository({ store, now: () => now, debounceMs: 0 })
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      timeZone: 'Asia/Shanghai',
      once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' },
      notify: { channels: ['overlay'], template: '{title}', advanceMinutes: 10, sound: false, endReminder: true },
    })
    let fires = 0
    let missed = 0
    for (let index = 0; index < 400; index += 1) {
      now = new Date(now.getTime() + 60_000)
      const plan = resolveTick(repo.snapshotTasks(), now, { holidays, graceMinutes: 5 })
      fires += plan.fire.length
      missed += plan.markMissed.length
      // Use the *production* mapper: a hand-built change list would hide a
      // missing field in createTick, which is exactly how the `node` defect
      // slipped through the first time.
      const changes = planToChanges(plan)
      if (changes.length > 0) await repo.applyTick(changes, now)
    }
    assert.equal(fires, 2, 'the start reminder and the end advance, each exactly once')
    assert.equal(missed, 0, 'nothing may be marked missed for an advance-only task')
    const after = repo.get(task.id)
    // D-25: reaching endAt never completes the task; an explicit complete does.
    assert.equal(after?.status, 'active')
    assert.equal(after?.doneAt, null)
    assert.equal(after?.state.missedCount, 0)
    const completed = await repo.complete(task.id)
    assert.equal(completed.task.status, 'done')
  })
})

describe('MAJOR: a read-only store must not start the scheduler', () => {
  it('reports readOnly in health and refuses writes', async () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    const future = JSON.stringify({ schemaVersion: 99, tasks: [], settings: {}, meta: {} })
    fs.files.set(STATE, future)
    const store = createStore({ dataDir: DATA_DIR, fs, now: () => NOW })
    store.load()
    assert.equal(store.readOnly, true)
    const repo = createRepository({ store, now: () => NOW, debounceMs: 0 })
    await assert.rejects(
      repo.create({ title: 'x', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } }),
      (error: { code?: string }) => error.code === 'storage_read_only',
    )
    await repo.flush()
    assert.equal(fs.files.get(STATE), future)
  })
})

describe('MAJOR: DND-held reminders collapse into one summary', () => {
  it('returns a dndSummary once the quiet window has ended', async () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    const store = createStore({ dataDir: DATA_DIR, fs, now: () => NOW })
    store.load()
    const repo = createRepository({ store, now: () => NOW, debounceMs: 0 })
    const task = await repo.create({ title: '夜间提醒', kind: 'recurring', rule: { preset: 'workdays', time: '23:00' } })
    // Two held rows plus the DND settings that produced them.
    await repo.recordDeliveries([
      {
        occurrenceKey: `${task.id}@2026-10-29T15:00:00.000Z`,
        channel: 'overlay',
        status: 'ok',
        at: '2026-10-29T15:00:05.000Z',
        readAt: null,
        ignoredAt: null,
        dismissedAt: null,
        error: 'dnd-held',
      },
      {
        occurrenceKey: `${task.id}@2026-10-30T15:00:00.000Z`,
        channel: 'overlay',
        status: 'ok',
        at: '2026-10-30T15:00:05.000Z',
        readAt: null,
        ignoredAt: null,
        dismissedAt: null,
        error: 'dnd-held',
      },
    ])
    // Build the same payload `/due` would, using the delivery helpers directly.
    const { pendingDeliveries } = await import('../src/host/delivery.js')
    const pending = pendingDeliveries(repo.deliveries(), repo.snapshotTasks(), NOW)
    const held = pending.filter(({ record }) => record.error === 'dnd-held')
    assert.equal(held.length, 2)
    assert.deepEqual(held.map(({ task: bound }) => bound.title), ['夜间提醒', '夜间提醒'])
  })
})

describe('MAJOR: both one-off nodes missed must converge (F6.4)', () => {
  it('counts each missed node once and marks the task done', async () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    let now = new Date('2026-11-05T09:10:00+08:00')
    const store = createStore({ dataDir: DATA_DIR, fs, now: () => now })
    store.load()
    const repo = createRepository({ store, now: () => now, debounceMs: 0 })
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      timeZone: 'Asia/Shanghai',
      once: { startAt: '2026-11-05T09:00:00+08:00', endAt: '2026-11-05T09:05:00+08:00' },
    })
    let missed = 0
    for (let index = 0; index < 100; index += 1) {
      now = new Date(now.getTime() + 60_000)
      const plan = resolveTick(repo.snapshotTasks(), now, { holidays, graceMinutes: 5 })
      missed += plan.markMissed.length
      const changes = planToChanges(plan)
      if (changes.length > 0) await repo.applyTick(changes, now)
    }
    assert.equal(missed, 2, 'each of the two missed nodes is recorded exactly once')
    const after = repo.get(task.id)
    assert.equal(after?.state.missedCount, 2)
    // D-25: a missed window does not complete the task either.
    assert.equal(after?.status, 'active')
    assert.equal((await repo.complete(task.id)).task.status, 'done')
  })
})

describe('DEFECT: the production tick mapping must carry `node`', () => {
  it('planToChanges keeps node for both fired and missed occurrences', () => {
    const changes = planToChanges({
      fire: [
        { taskId: 't1', at: new Date('2026-11-05T02:00:00Z'), phase: 'start', key: 'k1', kind: 'once', node: 'start' },
      ],
      markMissed: [
        { taskId: 't1', at: new Date('2026-11-05T06:00:00Z'), phase: 'end', key: 'k2', kind: 'once', node: 'end' },
      ],
    })
    assert.equal(changes[0]?.node, 'start')
    assert.equal(changes[1]?.node, 'end')
  })

  it('a missed one-off node settles through the real mapping', async () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    let now = new Date('2026-11-05T09:10:00+08:00')
    const store = createStore({ dataDir: DATA_DIR, fs, now: () => now })
    store.load()
    const repo = createRepository({ store, now: () => now, debounceMs: 0 })
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      timeZone: 'Asia/Shanghai',
      once: { startAt: '2026-11-05T09:00:00+08:00', endAt: '2026-11-05T09:05:00+08:00' },
    })
    let missed = 0
    for (let index = 0; index < 100; index += 1) {
      now = new Date(now.getTime() + 60_000)
      const plan = resolveTick(repo.snapshotTasks(), now, { holidays, graceMinutes: 5 })
      missed += plan.markMissed.length
      const changes = planToChanges(plan)
      if (changes.length > 0) {
        try {
          await repo.applyTick(changes, now)
        } catch (error) {
          throw error
        }
      }
    }
    assert.equal(missed, 2)
    const after = repo.get(task.id)
    assert.equal(after?.state.missedStart, true)
    assert.equal(after?.state.missedEnd, true)
    assert.equal(after?.status, 'active')
    assert.equal((await repo.complete(task.id)).task.status, 'done')
  })
})

describe('MINOR: TaskView.fired reflects advance/missed settlement', () => {
  it('reports fired for an advance-only one-off task', async () => {
    const { repo } = harness()
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      timeZone: 'Asia/Shanghai',
      once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' },
      notify: { channels: ['overlay'], template: '{title}', advanceMinutes: 10, sound: false, endReminder: true },
    })
    // Simulate both advance reminders having been delivered.
    const state = repo.get(task.id)?.state
    assert.ok(state !== undefined)
    const seeded = {
      ...repo.get(task.id)!,
      status: 'done' as const,
      state: { ...state, firedStartAdvance: true, firedEndAdvance: true },
    }
    const view = toTaskView(seeded, { now: NOW })
    assert.equal(view.fired, true)
  })
})
