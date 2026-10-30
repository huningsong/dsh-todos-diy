/**
 * D-25 task time and status model: the ten acceptance classes from the
 * 0.2.0 test plan (`docs/testing/测试记录.md` §3.1).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRepository } from '../src/host/repo.js'
import { createStore } from '../src/host/store.js'
import { emptyState, SCHEMA_VERSION, coerceState } from '../src/host/state.js'
import { migrateDocumentV2, migrateIndexV2, migrateTaskV2 } from '../src/host/migrationV2.js'
import { buildExport, parseImport } from '../src/host/transfer.js'
import { computeNextTransition, queryTasks } from '../src/host/repoQuery.js'
import { dueOccurrences, nextFireAt, onceOccurrences, scheduledNodes } from '../src/host/rules/occurrence.js'
import { resolveTick } from '../src/host/rules/resolveTick.js'
import { toTaskView } from '../src/host/taskView.js'
import { createMemoryFs } from './memoryFs.js'
import { makeCreatedTask, makeOnceTask, makeTask } from './fixtures.js'

const DATA_DIR = '/virtual/dsh/dsh-todos-diy'
const NOW = new Date('2026-11-05T12:00:00+08:00')

/** Repository over a memory filesystem. */
function harness(now: Date = NOW) {
  const fs = createMemoryFs()
  fs.mkdir(DATA_DIR)
  const store = createStore({ dataDir: DATA_DIR, fs, now: () => now })
  store.load()
  const repo = createRepository({ store, now: () => now, debounceMs: 0 })
  return { fs, store, repo }
}

describe('D-25 #1: stage boundaries at now == startAt / now == endAt / endAt+1ms', () => {
  const task = makeOnceTask('2026-11-05T14:00:00+08:00', '2026-11-05T18:00:00+08:00')

  it('is notStarted one millisecond before startAt', () => {
    assert.equal(toTaskView(task, { now: new Date('2026-11-05T13:59:59.999+08:00') }).stage, 'notStarted')
  })

  it('is inProgress at startAt', () => {
    assert.equal(toTaskView(task, { now: new Date('2026-11-05T14:00:00.000+08:00') }).stage, 'inProgress')
  })

  it('is inProgress through the endAt second', () => {
    assert.equal(toTaskView(task, { now: new Date('2026-11-05T18:00:00.999+08:00') }).stage, 'inProgress')
  })

  it('is overdue at endAt + 1 ms of the next second', () => {
    assert.equal(toTaskView(task, { now: new Date('2026-11-05T18:00:01.000+08:00') }).stage, 'overdue')
  })
})

describe('D-25 #2: the four stage views are mutually exclusive', () => {
  const now = NOW
  const tasks = [
    makeOnceTask('2026-11-06T09:00:00+08:00', '2026-11-06T18:00:00+08:00', { id: 'n' }),
    makeOnceTask('2026-11-05T08:00:00+08:00', '2026-11-05T20:00:00+08:00', { id: 'p' }),
    makeOnceTask('2026-11-01T08:00:00+08:00', '2026-11-02T20:00:00+08:00', { id: 'o' }),
    makeOnceTask('2026-11-01T08:00:00+08:00', '2026-11-02T20:00:00+08:00', { id: 'd', status: 'done', doneAt: '2026-11-03T00:00:00Z' }),
    makeTask({ id: 'r' }),
    makeOnceTask('2026-11-01T08:00:00+08:00', '2026-11-02T20:00:00+08:00', { id: 'z', status: 'paused' }),
  ]

  it('every task appears in exactly one bucket and the sum matches', () => {
    const ctx = { now, nextAtFor: () => null, totalDone: 0 }
    const result = queryTasks(tasks, {}, ctx)
    const total = Object.values(result.counts).reduce((sum, value) => sum + value, 0)
    assert.equal(total, tasks.length)
    assert.deepEqual(result.counts, { notStarted: 1, inProgress: 1, overdue: 1, done: 1, paused: 1, recurring: 1 })
  })
})

describe('D-25 #3: counts / byKind / totalDone and "badge = tab rows"', () => {
  it('reports byKind over non-archived tasks and totalDone including the archive', async () => {
    const { repo } = harness()
    await repo.create({ title: 'once', kind: 'once', once: { startAt: '2026-11-05T08:00:00+08:00', endAt: '2026-11-05T20:00:00+08:00' } })
    await repo.create({ title: 'rec', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const result = repo.list({})
    assert.deepEqual(result.byKind, { once: 1, recurring: 1 })
    assert.equal(result.totalDone, 0)
  })

  it('counts a main-file done task exactly once', async () => {
    const { repo } = harness()
    const task = await repo.create({
      title: 'done',
      kind: 'once',
      once: { startAt: '2026-11-05T08:00:00+08:00', endAt: '2026-11-05T20:00:00+08:00' },
    })
    await repo.complete(task.id)
    const result = repo.list({})
    assert.equal(result.counts.done, 1)
    assert.equal(result.totalDone, 1, 'totalDone must not double-count the main-file done row')
  })

  it('adds archived quarters to totalDone without double counting', async () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    const store = createStore({ dataDir: DATA_DIR, fs, now: () => NOW })
    store.load()
    const repo = createRepository({ store, now: () => NOW, debounceMs: 0, archiveDone: () => 7 })
    const task = await repo.create({
      title: 'done',
      kind: 'once',
      once: { startAt: '2026-11-05T08:00:00+08:00', endAt: '2026-11-05T20:00:00+08:00' },
    })
    await repo.complete(task.id)
    assert.equal(repo.list({}).totalDone, 8)
  })

  it('makes each view row count equal its badge', () => {
    const tasks = [
      makeOnceTask('2026-11-06T09:00:00+08:00', '2026-11-06T18:00:00+08:00', { id: 'n1' }),
      makeOnceTask('2026-11-07T09:00:00+08:00', '2026-11-07T18:00:00+08:00', { id: 'n2' }),
      makeOnceTask('2026-11-05T08:00:00+08:00', '2026-11-05T20:00:00+08:00', { id: 'p1' }),
    ]
    const ctx = { now: NOW, nextAtFor: () => null, totalDone: 0 }
    assert.equal(queryTasks(tasks, { view: 'notStarted' }, ctx).items.length, 2)
    assert.equal(queryTasks(tasks, { view: 'inProgress' }, ctx).items.length, 1)
  })
})

describe('D-25 #4: omitted startAt → createdAt + startAtSource="created" + no #start', () => {
  it('fills startAt from createdAt and suppresses the start reminder', async () => {
    const { repo } = harness()
    const task = await repo.create({ title: 'x', kind: 'once', once: { endAt: '2026-11-06T18:00:00+08:00' } })
    assert.equal(task.once?.startAt, task.createdAt)
    assert.equal(task.once?.startAtSource, 'created')
    assert.equal(task.state.firedStart, true)
    assert.deepEqual(scheduledNodes(task), ['end'])
    assert.equal(onceOccurrences(task).some((occurrence) => occurrence.node === 'start'), false)
  })
})

describe('D-25 #5: endReminder=false → only #start; without explicit startAt → invalid_argument', () => {
  it('schedules only the start node', async () => {
    const { repo } = harness()
    const task = await repo.create({
      title: '会议',
      kind: 'once',
      once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' },
      notify: { endReminder: false },
    })
    assert.deepEqual(scheduledNodes(task), ['start'])
    assert.equal(onceOccurrences(task).some((occurrence) => occurrence.node === 'end'), false)
  })

  it('rejects endReminder=false without an explicit startAt', async () => {
    const { repo } = harness()
    await assert.rejects(
      repo.create({
        title: '会议',
        kind: 'once',
        once: { endAt: '2026-11-06T18:00:00+08:00' },
        notify: { endReminder: false },
      }),
      (error: { code?: string; details?: { field?: string } }) => {
        assert.equal(error.code, 'invalid_argument')
        assert.equal(error.details?.field, 'notify.endReminder')
        return true
      },
    )
  })
})

describe('D-25 #6: after endAt the task stays active/overdue and never auto-completes', () => {
  it('keeps status=active and stage=overdue across many ticks', async () => {
    const { repo } = harness(new Date('2026-11-05T19:00:00+08:00'))
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' },
    })
    for (let index = 0; index < 3; index += 1) {
      const plan = resolveTick(repo.snapshotTasks(), new Date(`2026-11-05T19:0${String(index)}:00+08:00`), { graceMinutes: 5 })
      await repo.applyTick(plan.fire.concat(plan.markMissed), new Date('2026-11-05T19:00:00+08:00'))
    }
    const after = repo.get(task.id)
    assert.equal(after?.status, 'active')
    assert.equal(after?.doneAt, null)
    assert.equal(toTaskView(after as never, { now: new Date('2026-11-05T19:00:00+08:00') }).stage, 'overdue')
  })

  it('becomes done only when completed explicitly', async () => {
    const { repo } = harness(new Date('2026-11-05T19:00:00+08:00'))
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' },
    })
    const done = await repo.complete(task.id)
    assert.equal(done.task.status, 'done')
    assert.ok(done.task.doneAt !== null)
  })
})

describe('D-25 #7: v1→v2 migration across all four paths', () => {
  const v1Task = {
    id: 'tr_v1',
    title: '旧单次任务',
    description: '来自 v1',
    kind: 'once',
    status: 'active',
    dueDate: '2026-11-03',
    pinned: false,
    doneAt: null,
    archivedQuarter: null,
    rule: null,
    once: { startAt: '2026-11-05T06:00:00.000Z', endAt: '2026-11-05T10:00:00.000Z', timeZone: 'Asia/Shanghai' },
    notify: { channels: ['overlay'], template: '{title}', advanceMinutes: 0, sound: false },
    state: { lastFiredAt: null, lastOccurrenceKey: null, firedStart: false, firedEnd: false },
    revision: 1,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  }

  it('migrates a main-file document', () => {
    const migrated = migrateDocumentV2({ schemaVersion: 1, tasks: [v1Task], settings: {}, meta: {}, deliveries: [] })
    assert.equal(migrated['schemaVersion'], SCHEMA_VERSION)
    const tasks = migrated['tasks'] as Record<string, unknown>[]
    assert.equal(tasks.length, 1)
    const task = tasks[0] as Record<string, unknown>
    assert.equal(Object.hasOwn(task, 'dueDate'), false)
    assert.equal((task['once'] as Record<string, unknown>)['startAtSource'], 'explicit')
    assert.equal((task['notify'] as Record<string, unknown>)['endReminder'], true)
    const state = task['state'] as Record<string, unknown>
    assert.equal(state['firedStartAdvance'], false)
    assert.equal(state['missedStart'], false)
    assert.equal(state['missedEnd'], false)
  })

  it('migrates an archive quarter document', () => {
    const migrated = migrateDocumentV2({ schemaVersion: 1, quarter: '2026-Q3', tasks: [v1Task] })
    assert.equal(migrated['schemaVersion'], SCHEMA_VERSION)
    assert.equal((migrated['tasks'] as Record<string, unknown>[])[0]?.['dueDate'], undefined)
  })

  it('migrates an index document without touching the entries', () => {
    const entries = [{ quarter: '2026-Q3', file: 'completed-2026-Q3.json', count: 2, start: '', end: '' }]
    const migrated = migrateIndexV2({ schemaVersion: 1, quarters: entries })
    assert.equal(migrated['schemaVersion'], SCHEMA_VERSION)
    assert.deepEqual(migrated['quarters'], entries)
  })

  it('fails a one-off task with no endAt instead of guessing', () => {
    const broken = { ...v1Task, once: { startAt: '2026-11-05T06:00:00.000Z', timeZone: 'Asia/Shanghai' } }
    assert.throws(() => migrateTaskV2(broken as Record<string, unknown>), /endAt/)
  })

  it('migrates an import bundle through the same function', () => {
    const bundle = { kind: 'dsh-todos-diy/export', schemaVersion: 1, exportedAt: '2026-11-01T00:00:00.000Z', settings: {}, tasks: [v1Task], deliveries: [] }
    // The import path parses a v1 bundle and coerces it; the migrated task keeps
    // its window and gains `startAtSource`.
    const parsed = parseImport(bundle)
    assert.equal(parsed.tasks.length, 1)
    assert.equal(parsed.tasks[0]?.once?.startAtSource, 'explicit')
    assert.equal(parsed.tasks[0]?.notify.endReminder, true)
  })

  it('exposes schemaVersion 2 in an export bundle', () => {
    const state = emptyState(NOW)
    state.tasks.push(makeOnceTask('2026-11-05T14:00:00+08:00', '2026-11-05T18:00:00+08:00'))
    assert.equal(buildExport(state, NOW).schemaVersion, 2)
  })
})

describe('D-25 #8: serverTime / nextTransitionAt', () => {
  it('reports the nearest future boundary across tasks and ignores the past', () => {
    const tasks = [
      makeOnceTask('2026-11-05T09:00:00+08:00', '2026-11-05T10:00:00+08:00', { id: 'past' }),
      makeOnceTask('2026-11-05T15:00:00+08:00', '2026-11-05T18:00:00+08:00', { id: 'next' }),
    ]
    const next = computeNextTransition(tasks, { now: NOW, nextAtFor: () => null })
    assert.equal(next, new Date('2026-11-05T15:00:00+08:00').toISOString())
  })

  it('ignores archived tasks', () => {
    const tasks = [makeTask({ id: 'a', status: 'archived' })]
    assert.equal(computeNextTransition(tasks, { now: NOW, nextAtFor: () => null }), null)
  })

  it('considers a recurring task nextAt', () => {
    const task = makeTask({ id: 'r' })
    const next = computeNextTransition([task], { now: NOW, nextAtFor: () => new Date('2026-11-06T01:00:00Z') })
    assert.equal(next, '2026-11-06T01:00:00.000Z')
  })
})

describe('D-25 #9: a date-only endAt means 23:59:59.999 in the task zone', () => {
  it('expands the end of day', async () => {
    const { repo } = harness()
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      timeZone: 'Asia/Shanghai',
      once: { startAt: '2026-11-05T09:00:00+08:00', endAt: '2026-11-07' },
    })
    assert.equal(task.once?.endAt, '2026-11-07T15:59:59.999Z')
  })
})

describe('D-25 #10: priority 24/72/168h boundaries at ±1ms', () => {
  const end = '2026-11-06T12:00:00+08:00'
  const task = makeOnceTask('2026-11-05T12:00:00+08:00', end)
  const base = Date.parse(end)

  it('is high exactly 24h before the deadline', () => {
    assert.equal(toTaskView(task, { now: new Date(base - 24 * 3_600_000) }).priority.key, 'high')
  })

  it('is mid one millisecond earlier (24h + 1ms remaining)', () => {
    assert.equal(toTaskView(task, { now: new Date(base - 24 * 3_600_000 - 1) }).priority.key, 'mid')
  })

  it('is mid exactly 72h before and low one millisecond earlier', () => {
    assert.equal(toTaskView(task, { now: new Date(base - 72 * 3_600_000) }).priority.key, 'mid')
    assert.equal(toTaskView(task, { now: new Date(base - 72 * 3_600_000 - 1) }).priority.key, 'low')
  })

  it('is low exactly 168h before and none one millisecond earlier', () => {
    assert.equal(toTaskView(task, { now: new Date(base - 168 * 3_600_000) }).priority.key, 'low')
    assert.equal(toTaskView(task, { now: new Date(base - 168 * 3_600_000 - 1) }).priority.key, 'none')
  })
})

describe('D-25: repository persists the new state fields', () => {
  it('round-trips startAtSource and endReminder through coerceState', () => {
    const state = emptyState(NOW)
    const task = makeCreatedTask('2026-11-05T09:00:00+08:00', '2026-11-05T18:00:00+08:00')
    state.tasks.push(task)
    const parsed = coerceState(JSON.parse(JSON.stringify(state)))
    assert.deepEqual(parsed.problem, { kind: 'ok' })
    assert.equal(parsed.state?.tasks[0]?.once?.startAtSource, 'created')
    assert.equal(parsed.state?.tasks[0]?.notify.endReminder, true)
    assert.equal(parsed.state?.tasks[0]?.state.firedStart, true)
  })
})

describe('D-25: nextFireAt respects endReminder and startAtSource', () => {
  it('returns only the end node for a created-start task', () => {
    const task = makeCreatedTask('2026-11-05T09:00:00+08:00', '2026-11-05T18:00:00+08:00')
    assert.equal(nextFireAt(task, new Date('2026-11-05T09:00:00+08:00'))?.toISOString(), '2026-11-05T10:00:00.000Z')
  })

  it('returns the start node for a start-only meeting', () => {
    const task = makeOnceTask('2026-11-05T14:00:00+08:00', '2026-11-05T18:00:00+08:00', {
      notify: { channels: ['overlay'], template: '{title}', advanceMinutes: 0, sound: false, endReminder: false },
    })
    assert.equal(nextFireAt(task, new Date('2026-11-05T09:00:00+08:00'))?.toISOString(), '2026-11-05T06:00:00.000Z')
  })
})

describe('D-25: dueOccurrences ignores settled nodes', () => {
  it('does not return a node whose advance marker is set', () => {
    const task = makeOnceTask('2026-11-05T14:00:00+08:00', '2026-11-05T18:00:00+08:00', {
      notify: { channels: ['overlay'], template: '{title}', advanceMinutes: 10, sound: false, endReminder: true },
    })
    task.state.firedStart = true
    task.state.firedEndAdvance = true
    assert.equal(dueOccurrences(task, new Date('2026-11-05T10:30:00Z'), null).length, 0)
  })
})
