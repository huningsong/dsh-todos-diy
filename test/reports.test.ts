/**
 * F11 weekly/monthly reports — period boundaries, aggregation, completion
 * events, archive merge, read-only route and v2→v3 migration (AC-REP-01..08).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { periodOf, buildReport } from '../src/host/reports.js'
import { appendCompletionEvent, makeCompletionEvent, occurrenceInstant } from '../src/host/completionEvents.js'
import { migrateDocumentV3, migrateIndexToCurrent } from '../src/host/migrationV3.js'
import { migrateState } from '../src/host/migrations.js'
import { SCHEMA_VERSION, emptyState, type CompletionEvent } from '../src/host/state.js'
import { createStore } from '../src/host/store.js'
import { createRepository } from '../src/host/repo.js'
import { makeOnceTask, makeTask, makeRule, makeCreatedTask } from './fixtures.js'
import { routesFor } from './routeHarness.js'
import { fakeRequest, fakeResponse } from './fakeHttp.js'
import { createMemoryFs } from './memoryFs.js'

const ZONE = 'Asia/Shanghai'
const NOW = new Date('2026-10-30T12:00:00+08:00')
const DATA_DIR = '/virtual/dsh/dsh-todos-diy'

/** Build a task with an explicit doneAt/createdAt for report fixtures. */
function done(id: string, title: string, doneAt: string): ReturnType<typeof makeOnceTask> {
  const task = makeOnceTask('2026-10-01T09:00:00+08:00', '2026-10-20T18:00:00+08:00')
  task.id = id
  task.title = title
  task.status = 'done'
  task.doneAt = doneAt
  return task
}

describe('AC-REP-01: period boundaries', () => {
  it('weekly runs Monday 00:00 to Sunday 23:59:59.999', () => {
    const period = periodOf('weekly', '2026-10-30', ZONE)
    assert.equal(period.localStart, '2026-10-26')
    assert.equal(period.localEnd, '2026-11-01')
    assert.equal(period.start, '2026-10-25T16:00:00.000Z')
    assert.equal(period.end, '2026-11-01T15:59:59.999Z')
    assert.equal(period.nextStart, '2026-11-01T16:00:00.000Z')
  })

  it('monthly runs the natural month', () => {
    const period = periodOf('monthly', '2026-10-30', ZONE)
    assert.equal(period.localStart, '2026-10-01')
    assert.equal(period.localEnd, '2026-10-31')
    assert.equal(period.start, '2026-09-30T16:00:00.000Z')
    assert.equal(period.end, '2026-10-31T15:59:59.999Z')
    assert.equal(period.nextStart, '2026-10-31T16:00:00.000Z')
  })

  it('handles a Monday anchor and a month boundary', () => {
    assert.equal(periodOf('weekly', '2026-10-26', ZONE).localStart, '2026-10-26')
    assert.equal(periodOf('weekly', '2026-11-01', ZONE).localStart, '2026-10-26')
    assert.equal(periodOf('monthly', '2026-02-15', ZONE).localEnd, '2026-02-28')
    assert.equal(periodOf('monthly', '2026-12-31', ZONE).nextStart, '2026-12-31T16:00:00.000Z')
  })
})

describe('AC-REP-02: one-off completions from main + archive without duplicates', () => {
  it('merges both sources and de-duplicates by id', () => {
    const main = done('tr_a', '主文件完成', '2026-10-28T10:00:00+08:00')
    const archived = done('tr_b', '归档完成', '2026-10-27T10:00:00+08:00')
    const duplicate = done('tr_a', '重复', '2026-10-28T10:00:00+08:00')
    const report = buildReport({
      kind: 'weekly', anchor: '2026-10-30', timeZone: ZONE, now: NOW,
      tasks: [main], archived: [archived, duplicate], events: [],
    })
    assert.deepEqual(report.completed.map((item) => item.id).sort(), ['tr_a', 'tr_b'])
    assert.equal(report.stats.completed, 2)
  })

  it('ignores completions outside the period', () => {
    const report = buildReport({
      kind: 'weekly', anchor: '2026-10-30', timeZone: ZONE, now: NOW,
      tasks: [done('tr_old', '上周完成', '2026-10-20T10:00:00+08:00')], archived: [], events: [],
    })
    assert.deepEqual(report.completed, [])
  })
})

describe('AC-REP-03: recurring completions count every occurrence', () => {
  it('counts N events for the same task', () => {
    const events: CompletionEvent[] = ['2026-10-27T10:00:00+08:00', '2026-10-28T10:00:00+08:00', '2026-10-29T10:00:00+08:00'].map((at, index) => ({
      id: `ev_${String(index)}`, taskId: 'tr_r', taskTitle: '交周报', kind: 'recurring' as const,
      occurrenceKey: `tr_r@${new Date(at).toISOString()}`, completedAt: new Date(at).toISOString(), dueAt: new Date(at).toISOString(), timeZone: ZONE,
    }))
    const report = buildReport({
      kind: 'weekly', anchor: '2026-10-30', timeZone: ZONE, now: NOW,
      tasks: [], archived: [], events,
    })
    assert.equal(report.completed.length, 1)
    assert.equal(report.completed[0]?.count, 3)
    assert.equal(report.stats.completed, 3)
  })

  it('repo.complete appends one event per completion for both kinds', async () => {
    const fs = createMemoryFs(); fs.mkdir(DATA_DIR)
    const store = createStore({ dataDir: DATA_DIR, fs, now: () => NOW }); store.load()
    const repo = createRepository({ store, now: () => NOW, debounceMs: 0 })
    const once = await repo.create({ title: '单次', kind: 'once', once: { startAt: '2026-10-01T09:00:00+08:00', endAt: '2026-10-02T18:00:00+08:00' } })
    await repo.complete(once.id)
    const recurring = await repo.create({ title: '循环', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    await repo.complete(recurring.id, 'tr_x@2026-10-29T01:00:00.000Z')
    await repo.complete(recurring.id, 'tr_x@2026-10-30T01:00:00.000Z')
    const events = store.state.completionEvents
    assert.equal(events.length, 3)
    assert.equal(events[0]?.kind, 'once')
    assert.equal(events[0]?.dueAt, '2026-10-02T10:00:00.000Z')
    assert.equal(events.filter((event) => event.kind === 'recurring').length, 2)
  })

  it('trims to the newest 5000 events', () => {
    const state = emptyState(NOW)
    for (let index = 0; index < 5003; index += 1) {
      appendCompletionEvent(state, {
        id: `ev_${String(index)}`, taskId: 't', taskTitle: 'x', kind: 'once', occurrenceKey: `t@${String(index)}`,
        completedAt: new Date(NOW.getTime() - (5003 - index) * 1000).toISOString(), dueAt: null, timeZone: ZONE,
      }, NOW)
    }
    assert.equal(state.completionEvents.length, 5000)
    assert.equal(state.completionEvents[0]?.id, 'ev_3')
  })

  it('parses the occurrence instant out of a key', () => {
    assert.equal(occurrenceInstant('tr_a@2026-10-30T01:00:00.000Z'), '2026-10-30T01:00:00.000Z')
    assert.equal(occurrenceInstant('tr_a@2026-10-30T01:00:00.000Z#end'), '2026-10-30T01:00:00.000Z')
    assert.equal(occurrenceInstant('bad'), null)
  })
})

describe('AC-REP-04: overdue / created / upcoming scopes', () => {
  it('lists only active one-off tasks with endAt < now', () => {
    const overdue = makeOnceTask('2026-10-01T09:00:00+08:00', '2026-10-20T18:00:00+08:00')
    overdue.title = '逾期'; overdue.id = 'tr_over'
    const paused = { ...overdue, id: 'tr_paused', status: 'paused' as const }
    const doneTask = { ...overdue, id: 'tr_done', status: 'done' as const, doneAt: '2026-10-21T10:00:00+08:00' }
    const future = makeOnceTask('2026-11-01T09:00:00+08:00', '2026-11-02T18:00:00+08:00')
    future.id = 'tr_future'
    const report = buildReport({ kind: 'weekly', anchor: '2026-10-30', timeZone: ZONE, now: NOW, tasks: [overdue, paused, doneTask, future], archived: [], events: [] })
    assert.deepEqual(report.overdue.map((item) => item.id), ['tr_over'])
    assert.equal(report.overdue[0]?.overdueDays, 9)
  })

  it('lists created-in-period tasks and next-period plans', () => {
    const created = makeCreatedTask('2026-10-28T09:00:00+08:00', '2026-11-02T18:00:00+08:00')
    created.id = 'tr_new'
    const upcoming = makeOnceTask('2026-11-01T09:00:00+08:00', '2026-11-03T18:00:00+08:00')
    upcoming.id = 'tr_plan'
    const recurring = makeTask({ kind: 'recurring', rule: makeRule({ preset: 'workdays', cron: '0 9 * * 1-5' }) })
    recurring.id = 'tr_rec'
    const report = buildReport({
      kind: 'weekly', anchor: '2026-10-30', timeZone: ZONE, now: NOW,
      tasks: [created, upcoming, recurring], archived: [], events: [],
      nextAtFor: (task) => (task.id === 'tr_rec' ? '2026-11-02T01:00:00.000Z' : null),
    })
    assert.deepEqual(report.created.map((item) => item.id).sort(), ['tr_new'])
    assert.deepEqual(report.upcoming.map((item) => item.id).sort(), ['tr_new', 'tr_plan', 'tr_rec'])
    assert.equal(report.stats.recurring, 1)
  })
})

describe('AC-REP-06: empty report', () => {
  it('returns empty sections and a null completion rate', () => {
    const report = buildReport({ kind: 'weekly', anchor: '2026-10-30', timeZone: ZONE, now: NOW, tasks: [], archived: [], events: [] })
    assert.deepEqual(report.completed, [])
    assert.deepEqual(report.overdue, [])
    assert.deepEqual(report.created, [])
    assert.deepEqual(report.upcoming, [])
    assert.equal(report.stats.completionRate, null)
  })
})

describe('AC-REP-07: the report route is read-only', () => {
  it('does not touch tasks.json', async () => {
    const { routes, store, fs } = routesFor(NOW)
    const repo = (await import('../src/host/repo.js')).createRepository({ store, now: () => NOW, debounceMs: 0 })
    await repo.create({ title: 'x', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    await repo.flush()
    const path = `${DATA_DIR}/tasks.json`
    const before = fs.files.get(path) as string
    const res = await call(routes, '/reports?kind=weekly&anchor=2026-10-30')
    assert.equal(res.statusCode, 200)
    const after = fs.files.get(path) as string
    assert.equal(after, before)
  })

  it('rejects a bad kind or anchor', async () => {
    const { routes } = routesFor(NOW)
    for (const query of ['kind=daily', 'kind=weekly&anchor=2026-13-01', 'kind=weekly&anchor=nope']) {
      const res = await call(routes, `/reports?${query}`)
      assert.equal(res.statusCode, 400)
      assert.equal(res.json<{ error: { code: string } }>().error.code, 'invalid_argument')
    }
  })
})

describe('AC-REP-08: v2→v3 migration', () => {
  it('adds an empty completionEvents list', () => {
    const migrated = migrateDocumentV3({ schemaVersion: 2, tasks: [], deliveries: [] })
    assert.equal(migrated['schemaVersion'], 3)
    assert.deepEqual(migrated['completionEvents'], [])
  })

  it('runs through the shared chain', () => {
    const result = migrateState({ schemaVersion: 2, tasks: [], deliveries: [] })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.deepEqual(result.applied, ['v2→v3: completion-event log (F11.2)'])
      assert.deepEqual(result.state['completionEvents'], [])
    }
  })

  it('upgrades an index from v1 straight to v3', () => {
    const next = migrateIndexToCurrent({ schemaVersion: 1, quarters: [] })
    assert.equal(next['schemaVersion'], SCHEMA_VERSION)
  })

  it('keeps the v2 tasks untouched', () => {
    const task = { id: 'tr_a', title: 'x', kind: 'once', status: 'active', dueDate: undefined }
    const migrated = migrateDocumentV3({ schemaVersion: 2, tasks: [task] })
    assert.deepEqual(migrated['tasks'], [task])
  })
})

/** Route helper. */
async function call(
  routes: ReturnType<typeof routesFor>['routes'],
  url: string,
): Promise<ReturnType<typeof fakeResponse>> {
  const entry = routes.find((route) => route.path.endsWith('/reports'))
  assert.ok(entry !== undefined)
  const res = fakeResponse()
  await entry.handler(fakeRequest({ url: `/api/dsh-todos-diy${url}`, method: 'GET' }) as never, res as never)
  return res
}

describe('Review fixes: A-01 DST midnight gap', () => {
  it('falls back to the first valid hour when midnight is deleted', () => {
    const period = periodOf('monthly', '2023-10-15', 'America/Asuncion')
    assert.equal(period.start, '2023-10-01T04:00:00.000Z')
    assert.equal(period.end, '2023-11-01T02:59:59.999Z')
  })

  it('keeps a weekly anchor valid when the week starts in a gap', () => {
    const period = periodOf('weekly', '2021-03-24', 'Asia/Tehran')
    assert.equal(Number.isNaN(Date.parse(period.start)), false)
    assert.ok(Date.parse(period.end) > Date.parse(period.start))
  })
})

describe('Review fixes: A-02 duplicate occurrence completion', () => {
  it('does not append a second event for the same occurrence', async () => {
    const fs = createMemoryFs(); fs.mkdir(DATA_DIR)
    const store = createStore({ dataDir: DATA_DIR, fs, now: () => NOW }); store.load()
    const repo = createRepository({ store, now: () => NOW, debounceMs: 0 })
    const task = await repo.create({ title: 'dup', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const key = 'tr_x@2026-10-29T01:00:00.000Z'
    await repo.complete(task.id, key)
    await repo.complete(task.id, key)
    assert.equal(store.state.completionEvents.length, 1)
  })
})

describe('Review fixes: B-01 one-off event fallback', () => {
  it('recovers a purged one-off completion from its event', () => {
    const report = buildReport({
      kind: 'weekly', anchor: '2026-10-30', timeZone: ZONE, now: NOW,
      tasks: [], archived: [], events: [{
        id: 'ev_x', taskId: 'tr_gone', taskTitle: '已删除任务', kind: 'once',
        occurrenceKey: 'tr_gone@2026-10-28T02:00:00.000Z', completedAt: '2026-10-28T02:00:00.000Z',
        dueAt: '2026-10-27T10:00:00.000Z', timeZone: ZONE,
      }],
    })
    assert.deepEqual(report.completed.map((item) => item.id), ['tr_gone'])
    assert.equal(report.stats.completed, 1)
  })

  it('prefers task doneAt over a duplicate once event', () => {
    const task = done('tr_a', '任务内完成', '2026-10-28T10:00:00+08:00')
    const report = buildReport({
      kind: 'weekly', anchor: '2026-10-30', timeZone: ZONE, now: NOW,
      tasks: [task], archived: [], events: [{
        id: 'ev_a', taskId: 'tr_a', taskTitle: '任务内完成', kind: 'once',
        occurrenceKey: 'tr_a@x', completedAt: '2026-10-28T02:00:00.000Z', dueAt: null, timeZone: ZONE,
      }],
    })
    assert.equal(report.completed.length, 1)
  })
})

describe('Review fixes: B-03 task time zone on report rows', () => {
  it('keeps the task zone on upcoming rows', () => {
    const task = makeTask({ kind: 'recurring', rule: makeRule({ timeZone: 'Asia/Tokyo', cron: '0 9 * * 1-5' }) })
    task.id = 'tr_tokyo'
    const report = buildReport({
      kind: 'weekly', anchor: '2026-10-30', timeZone: 'Asia/Shanghai', now: NOW,
      tasks: [task], archived: [], events: [],
      nextAtFor: () => '2026-11-02T00:00:00.000Z',
    })
    assert.equal(report.upcoming[0]?.timeZone, 'Asia/Tokyo')
  })
})

describe('Review fixes: A-04 report route never writes archive files', () => {
  it('leaves a v2 archive index and quarter untouched', async () => {
    const { routes, store, fs } = routesFor(NOW)
    const paths = store.paths
    fs.mkdir(paths.archiveDir)
    const index = { schemaVersion: 2, quarters: [{ quarter: '2026-Q3', file: 'completed-2026-Q3.json', count: 1, start: '', end: '' }] }
    const quarter = { schemaVersion: 2, quarter: '2026-Q3', tasks: [] }
    fs.writeFile(paths.archiveIndex, JSON.stringify(index))
    fs.writeFile(`${paths.archiveDir}/completed-2026-Q3.json`, JSON.stringify(quarter))
    const beforeIndex = fs.readFile(paths.archiveIndex)
    const beforeQuarter = fs.readFile(`${paths.archiveDir}/completed-2026-Q3.json`)
    const res = await call(routes, '/reports?kind=weekly&anchor=2026-10-30')
    assert.equal(res.statusCode, 200)
    assert.equal(fs.readFile(paths.archiveIndex), beforeIndex)
    assert.equal(fs.readFile(`${paths.archiveDir}/completed-2026-Q3.json`), beforeQuarter)
  })
})

describe('Review fixes: B-02 malformed completionEvents on import', () => {
  it('drops malformed events instead of crashing the report', async () => {
    const { parseImport } = await import('../src/host/transfer.js')
    const candidate = parseImport({ schemaVersion: 3, tasks: [], deliveries: [], completionEvents: [null, { id: 'bad' }] })
    assert.deepEqual(candidate.completionEvents, [])
    assert.ok(candidate.warnings.some((warning) => warning.includes('completion event')))
    const report = buildReport({
      kind: 'weekly', anchor: '2026-10-30', timeZone: ZONE, now: NOW,
      tasks: candidate.tasks, archived: [], events: candidate.completionEvents,
    })
    assert.equal(report.stats.completed, 0)
  })
})
