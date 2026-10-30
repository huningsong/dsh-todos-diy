/**
 * D-25 task time and status model: the ten acceptance classes from the
 * 0.2.0 test plan (`docs/testing/测试记录.md` §3.1).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRepository } from '../src/host/repo.js'
import { createStore } from '../src/host/store.js'
import { archiveCompleted, readArchiveIndex } from '../src/host/archive.js'
import { storagePaths } from '../src/host/paths.js'
import { restoreArchivedTask } from '../src/host/archiveRestore.js'
import { emptyState, SCHEMA_VERSION, coerceState } from '../src/host/state.js'
import { migrateDocumentV2, migrateIndexV2, migrateTaskV2 } from '../src/host/migrationV2.js'
import { buildExport, parseImport } from '../src/host/transfer.js'
import { computeNextTransition, queryTasks } from '../src/host/repoQuery.js'
import { dueOccurrences, nextFireAt, onceOccurrences, scheduledNodes } from '../src/host/rules/occurrence.js'
import { resolveTick } from '../src/host/rules/resolveTick.js'
import { toTaskView } from '../src/host/taskView.js'
import { planToChanges } from '../src/host/tickChanges.js'
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

  it('adds real archived quarters to totalDone and drops them after a restore', async () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    const paths = storagePaths(DATA_DIR)
    const store = createStore({ dataDir: DATA_DIR, fs, now: () => NOW })
    store.load()
    // Seed one completed task from a previous quarter and archive it for real.
    store.state.tasks.push(
      makeTask({ id: 'tr_q3', kind: 'once', status: 'done', doneAt: '2026-08-15T02:00:00.000Z', once: { startAt: '2026-08-15T01:00:00.000Z', endAt: '2026-08-15T03:00:00.000Z', startAtSource: 'explicit', timeZone: 'Asia/Shanghai' } }),
    )
    archiveCompleted(store.state, { paths, fs, now: new Date('2026-11-05T00:00:00Z'), timeZone: 'Asia/Shanghai' })
    const repo = createRepository({ store, now: () => NOW, debounceMs: 0, archiveDone: () => {
      try {
        return readArchiveIndex(paths, fs).quarters.reduce((sum, entry) => sum + entry.count, 0)
      } catch {
        return 0
      }
    } })
    // One live done task + one archived quarter row.
    const live = await repo.create({
      title: 'done live',
      kind: 'once',
      once: { startAt: '2026-11-05T08:00:00+08:00', endAt: '2026-11-05T20:00:00+08:00' },
    })
    await repo.complete(live.id)
    assert.equal(repo.list({}).totalDone, 2)
    // Restoring the archived task must drop the archived count immediately.
    const restored = restoreArchivedTask(store.state, 'tr_q3', paths, fs, NOW)
    assert.equal(restored.restored, true)
    // It is now a live task (status active), so totalDone is just the one done row.
    assert.equal(repo.list({}).totalDone, 1, 'the archived row left the index when restored')
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
    let fired = 0
    let missed = 0
    for (let index = 0; index < 3; index += 1) {
      const now = new Date(`2026-11-05T19:0${String(index)}:00+08:00`)
      const tasks = repo.snapshotTasks()
      const plan = resolveTick(tasks, now, { graceMinutes: 5 })
      fired += plan.fire.length
      missed += plan.markMissed.length
      // Use the production mapper: hand-built changes would hide a missing
      // field in `createTick` (the exact class of bug this project hit before).
      const changes = planToChanges(plan, tasks)
      if (changes.length > 0) await repo.applyTick(changes, now)
    }
    const after = repo.get(task.id)
    assert.equal(after?.status, 'active')
    assert.equal(after?.doneAt, null)
    assert.equal(toTaskView(after as never, { now: new Date('2026-11-05T19:00:00+08:00') }).stage, 'overdue')
    // Both nodes (14:00 start, 18:00 end) are already past the grace window at
    // 19:00, so each is recorded as missed exactly once — nothing fires.
    assert.equal(fired, 0)
    assert.equal(missed, 2)
    assert.equal(after?.state.missedStart, true)
    assert.equal(after?.state.missedEnd, true)
    assert.equal(after?.state.missedCount, 2)
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
    assert.equal(migrated['schemaVersion'], 2)
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
    assert.equal(migrated['schemaVersion'], 2)
    assert.equal((migrated['tasks'] as Record<string, unknown>[])[0]?.['dueDate'], undefined)
  })

  it('migrates an index document without touching the entries', () => {
    const entries = [{ quarter: '2026-Q3', file: 'completed-2026-Q3.json', count: 2, start: '', end: '' }]
    const migrated = migrateIndexV2({ schemaVersion: 1, quarters: entries })
    assert.equal(migrated['schemaVersion'], 2)
    assert.deepEqual(migrated['quarters'], entries)
  })

  it('fails a one-off task with no endAt instead of guessing', () => {
    const broken = { ...v1Task, once: { startAt: '2026-11-05T06:00:00.000Z', timeZone: 'Asia/Shanghai' } }
    assert.throws(() => migrateTaskV2(broken as Record<string, unknown>), /endAt/)
  })

  it('migrates an import bundle through the same function', () => {
    const bundle = { kind: 'dsh-todos-diy/export', schemaVersion: 1, exportedAt: '2026-11-01T00:00:00.000Z', settings: {}, tasks: [v1Task], deliveries: [] }
    const parsed = parseImport(bundle)
    assert.equal(parsed.tasks.length, 1)
    assert.equal(Object.hasOwn(parsed.tasks[0] as object, 'dueDate'), false)
    assert.equal(parsed.tasks[0]?.once?.startAtSource, 'explicit')
    assert.equal(parsed.tasks[0]?.notify.endReminder, true)
  })

  it('fails an import whose v1 one-off task has no endAt', () => {
    const broken = { ...v1Task, once: { startAt: '2026-11-05T06:00:00.000Z', timeZone: 'Asia/Shanghai' } }
    const bundle = { kind: 'dsh-todos-diy/export', schemaVersion: 1, exportedAt: '2026-11-01T00:00:00.000Z', settings: {}, tasks: [broken], deliveries: [] }
    assert.throws(() => parseImport(bundle), (error: { code?: string }) => {
      assert.equal(error.code, 'migration-failed')
      return true
    })
  })

  it('exposes the current schemaVersion in an export bundle', () => {
    const state = emptyState(NOW)
    state.tasks.push(makeOnceTask('2026-11-05T14:00:00+08:00', '2026-11-05T18:00:00+08:00'))
    assert.equal(buildExport(state, NOW).schemaVersion, SCHEMA_VERSION)
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

describe('Review fixes: migration/import edge cases', () => {
  it('skips a structurally bad task and keeps a migration warning', () => {
    const result = migrates({ schemaVersion: 1, tasks: [null, { id: '' }, { id: 'ok', kind: 'recurring', rule: { preset: 'workdays', cron: '0 9 * * 1-5', timeZone: 'Asia/Shanghai' }, status: 'active' }] })
    assert.equal(result.tasks.length, 1)
    assert.ok(result.warnings.length >= 2)
  })

  it('warns when a v1 task had dueDate dropped', () => {
    const result = migrates({ schemaVersion: 1, tasks: [{ id: 'tr_a', kind: 'once', status: 'active', dueDate: '2026-11-03', once: { startAt: '2026-11-05T06:00:00.000Z', endAt: '2026-11-05T10:00:00.000Z' } }] })
    assert.equal(result.warnings.some((warning) => warning.includes('dueDate')), true)
  })

  it('imports a v1 bundle with dueDate and reports a warning', () => {
    const bundle = {
      kind: 'dsh-todos-diy/export',
      schemaVersion: 1,
      exportedAt: '2026-11-01T00:00:00.000Z',
      settings: {},
      tasks: [{ id: 'tr_legacy', title: 'legacy', kind: 'once', status: 'active', dueDate: '2026-11-03', once: { startAt: '2026-11-05T06:00:00.000Z', endAt: '2026-11-05T10:00:00.000Z' } }],
      deliveries: [],
    }
    const parsed = parseImport(bundle)
    assert.equal(parsed.tasks.length, 1)
    assert.equal(parsed.warnings.some((warning) => warning.includes('dueDate')), true)
  })

  it('turns an imported recurring+done task back into active', () => {
    const bundle = {
      kind: 'dsh-todos-diy/export',
      schemaVersion: 2,
      exportedAt: '2026-11-01T00:00:00.000Z',
      settings: {},
      tasks: [{ id: 'tr_bad', title: 'bad', kind: 'recurring', status: 'done', rule: { preset: 'workdays', cron: '0 9 * * 1-5', timeZone: 'Asia/Shanghai' } }],
      deliveries: [],
    }
    const parsed = parseImport(bundle)
    assert.equal(parsed.tasks[0]?.status, 'active')
  })
})

describe('Review fixes: partial once patch keeps the start bound (F3.8)', () => {
  it('keeps startAt/startAtSource when only endAt changes', async () => {
    const { repo } = harness()
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' },
    })
    const updated = await repo.update(task.id, task.revision, { once: { endAt: '2026-11-06T18:00:00+08:00' } })
    assert.equal(updated.once?.startAt, '2026-11-05T06:00:00.000Z')
    assert.equal(updated.once?.startAtSource, 'explicit')
    assert.equal(updated.once?.endAt, '2026-11-06T10:00:00.000Z')
  })
})

describe('Review fixes: a stale tick change never overwrites a user edit (F1.6)', () => {
  it('drops a change whose expectedRevision is out of date', async () => {
    const { repo } = harness()
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' },
    })
    // Scheduler solved against revision 1; the user edits to revision 2 first.
    const plan = resolveTick(repo.snapshotTasks(), new Date('2026-11-05T06:00:30Z'), { graceMinutes: 5 })
    const stale = planToChanges(plan, [{ ...task, revision: 1 }])
    await repo.update(task.id, 1, { once: { startAt: '2026-11-05T15:00:00+08:00', endAt: '2026-11-05T19:00:00+08:00' } })
    await repo.applyTick(stale, new Date('2026-11-05T06:00:30Z'))
    const after = repo.get(task.id)
    assert.equal(after?.state.firedStart, false, 'the stale start claim must not stick')
  })
})

/** Run the migration chain and expose the warning list for assertions. */
function migrates(document: Record<string, unknown>): { tasks: unknown[]; warnings: string[] } {
  const warnings: string[] = []
  const result = migrateDocumentV2(document, warnings)
  return { tasks: (result['tasks'] as unknown[]) ?? [], warnings }
}

describe('Review round 4: coercion and high-version archive guards', () => {
  it('skips a task whose cron cannot be parsed', () => {
    const state = emptyState(NOW)
    const bad = makeTask({ id: 'tr_bad', rule: { ...makeTask().rule!, cron: 'not a cron' } })
    state.tasks.push(bad)
    const parsed = coerceState(JSON.parse(JSON.stringify(state)))
    assert.equal(parsed.state?.tasks.length, 0)
    assert.ok(parsed.warnings.length > 0)
  })

  it('skips a task whose zone is not resolvable', () => {
    const state = emptyState(NOW)
    state.tasks.push(makeTask({ id: 'tr_bad_zone', rule: { ...makeTask().rule!, timeZone: 'Not/AZone' } }))
    const parsed = coerceState(JSON.parse(JSON.stringify(state)))
    assert.equal(parsed.state?.tasks.length, 0)
  })

  it('falls back to Asia/Shanghai for an unusable settings zone', () => {
    const parsed = coerceState({
      schemaVersion: SCHEMA_VERSION,
      meta: {},
      settings: { timeZone: 'Not/AZone' },
      tasks: [],
      deliveries: [],
    })
    assert.equal(parsed.state?.settings.timeZone, 'Asia/Shanghai')
  })

  it('normalizes recurring+done into active with cleared completion markers', () => {
    const parsed = coerceState({
      schemaVersion: SCHEMA_VERSION,
      meta: {},
      settings: {},
      tasks: [{
        id: 'tr_r',
        title: 'r',
        kind: 'recurring',
        status: 'done',
        pinned: true,
        doneAt: '2026-11-01T00:00:00.000Z',
        rule: { preset: 'workdays', cron: '0 9 * * 1-5', timeZone: 'Asia/Shanghai' },
      }],
      deliveries: [],
    })
    const task = parsed.state?.tasks[0]
    assert.equal(task?.status, 'active')
    assert.equal(task?.doneAt, null)
    assert.equal(task?.pinned, false)
  })
})

describe('Review round 5: import warnings and quarter-scoped done counts', () => {
  it('warns when an imported task carries the read-only `fired` field', () => {
    const bundle = {
      kind: 'dsh-todos-diy/export',
      schemaVersion: 2,
      exportedAt: '2026-11-01T00:00:00.000Z',
      settings: {},
      tasks: [{
        id: 'tr_f',
        title: 'x',
        kind: 'once',
        status: 'active',
        fired: true,
        once: { startAt: '2026-11-05T06:00:00.000Z', endAt: '2026-11-05T10:00:00.000Z', startAtSource: 'explicit', timeZone: 'Asia/Shanghai' },
      }],
      deliveries: [],
    }
    const parsed = parseImport(bundle)
    assert.equal(parsed.warnings.some((warning) => warning.includes('fired')), true)
  })

  it('excludes a done task from a previous quarter from counts.done (F4.21)', async () => {
    const { repo, store } = harness()
    store.state.tasks.push(
      makeTask({
        id: 'tr_old_done',
        kind: 'once',
        status: 'done',
        doneAt: '2026-08-15T02:00:00.000Z',
        once: { startAt: '2026-08-15T01:00:00.000Z', endAt: '2026-08-15T03:00:00.000Z', startAtSource: 'explicit', timeZone: 'Asia/Shanghai' },
      }),
    )
    const result = repo.list({ view: 'done' })
    assert.equal(result.counts.done, 0, 'a Q3 completion does not belong to the Q4 done badge')
    assert.equal(result.items.length, 0)
  })

  it('keeps a current-quarter done task in counts.done', async () => {
    const { repo } = harness()
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      once: { startAt: '2026-11-05T08:00:00+08:00', endAt: '2026-11-05T20:00:00+08:00' },
    })
    await repo.complete(task.id)
    const result = repo.list({ view: 'done' })
    assert.equal(result.counts.done, 1)
  })
})
