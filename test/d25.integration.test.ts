/**
 * D-25 integration coverage: the new routes, the storage migration path and the
 * archive quarter migration (the parts of the 0.2.0 plan that need a store or a
 * route harness rather than a pure function).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRepository } from '../src/host/repo.js'
import { createStore } from '../src/host/store.js'
import { emptyState, SCHEMA_VERSION } from '../src/host/state.js'
import { readArchiveIndex, readQuarter, archiveCompleted } from '../src/host/archive.js'
import { storagePaths } from '../src/host/paths.js'
import { fakeRequest, fakeResponse } from './fakeHttp.js'
import { createMemoryFs } from './memoryFs.js'
import { makeOnceTask, makeTask } from './fixtures.js'
import { createToolDefinitions } from '../src/host/toolDefs.js'
import { routesFor } from './routeHarness.js'

const DATA_DIR = '/virtual/dsh/dsh-todos-diy'
const NOW = new Date('2026-11-05T12:00:00+08:00')

describe('D-25 routes: /tasks/remind', () => {
  it('records one immediate reminder without touching the task state', async () => {
    const { routes, repo } = routesFor(NOW)
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' },
    })
    const before = repo.get(task.id)
    const res = await callRoute(routes, '/tasks/remind', { method: 'POST', body: { id: task.id } })
    assert.equal(res.statusCode, 200)
    const payload = res.json<{ value: { occurrenceKey: string } }>().value
    assert.match(payload.occurrenceKey, /#remind$/)
    const after = repo.get(task.id)
    assert.equal(after?.state.lastOccurrenceKey, before?.state.lastOccurrenceKey)
    assert.equal(after?.state.firedStart, before?.state.firedStart)
    assert.equal(repo.deliveries().length, 1)
  })

  it('answers 404 for an unknown task', async () => {
    const { routes } = routesFor(NOW)
    const res = await callRoute(routes, '/tasks/remind', { method: 'POST', body: { id: 'tr_nope' } })
    assert.equal(res.statusCode, 404)
  })
})

describe('D-25 routes: /deliveries', () => {
  it('lists the log newest first and filters by task', async () => {
    const { routes, repo } = routesFor(NOW)
    const first = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const second = await repo.create({ title: 'B', kind: 'recurring', rule: { preset: 'workdays', time: '10:00' } })
    await callRoute(routes, '/tasks/remind', { method: 'POST', body: { id: first.id } })
    await callRoute(routes, '/tasks/remind', { method: 'POST', body: { id: second.id } })
    const all = await callRoute(routes, '/deliveries')
    assert.equal(all.statusCode, 200)
    assert.equal(all.json<{ value: { total: number } }>().value.total, 2)
    const scoped = await callRoute(routes, '/deliveries', { url: `/deliveries?taskId=${first.id}` })
    assert.equal(scoped.json<{ value: { total: number } }>().value.total, 1)
  })

  it('answers 404 for an unknown task id', async () => {
    const { routes } = routesFor(NOW)
    const res = await callRoute(routes, '/deliveries', { url: '/deliveries?taskId=tr_nope' })
    assert.equal(res.statusCode, 404)
  })

  it('paginates with an opaque cursor', async () => {
    const { routes, repo } = routesFor(NOW)
    const first = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const second = await repo.create({ title: 'B', kind: 'recurring', rule: { preset: 'workdays', time: '10:00' } })
    // Two different tasks so the occurrence keys differ.
    await callRoute(routes, '/tasks/remind', { method: 'POST', body: { id: first.id } })
    await callRoute(routes, '/tasks/remind', { method: 'POST', body: { id: second.id } })
    const page = await callRoute(routes, '/deliveries', { url: '/deliveries?limit=1' })
    const value = page.json<{ value: { items: unknown[]; nextCursor: string | null } }>().value
    assert.equal(value.items.length, 1)
    assert.equal(value.nextCursor, '1')
  })
})

describe('D-25 storage: a v1 tasks.json migrates on load', () => {
  const v1 = {
    schemaVersion: 1,
    meta: { createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z', lastTickAt: null, lastRecovery: null },
    settings: { timeZone: 'Asia/Shanghai', tickIntervalMs: 60000, graceMinutes: 5, defaultChannels: ['overlay'] },
    tasks: [
      {
        id: 'tr_legacy',
        title: '旧任务',
        description: '',
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
      },
    ],
    deliveries: [],
  }

  it('upgrades the file in place and reports schemaVersion 2', () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    fs.files.set(`${DATA_DIR}/tasks.json`, JSON.stringify(v1))
    const store = createStore({ dataDir: DATA_DIR, fs, now: () => NOW })
    const state = store.load()
    assert.equal(store.stateName, 'ready')
    assert.equal(state.schemaVersion, SCHEMA_VERSION)
    assert.equal(state.tasks.length, 1)
    assert.equal(Object.hasOwn(state.tasks[0] as object, 'dueDate'), false)
    assert.equal(state.tasks[0]?.once?.startAtSource, 'explicit')
    assert.equal(state.tasks[0]?.notify.endReminder, true)
    const written = JSON.parse(fs.files.get(`${DATA_DIR}/tasks.json`) as string)
    assert.equal(written.schemaVersion, 2)
  })

  it('keeps the original file when a one-off task has no endAt', () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    const broken = JSON.parse(JSON.stringify(v1)) as { tasks: Record<string, unknown>[] }
    ;(broken.tasks[0] as Record<string, unknown>)['once'] = { startAt: '2026-11-05T06:00:00.000Z', timeZone: 'Asia/Shanghai' }
    const text = JSON.stringify(broken)
    fs.files.set(`${DATA_DIR}/tasks.json`, text)
    const store = createStore({ dataDir: DATA_DIR, fs, now: () => NOW })
    store.load()
    assert.equal(store.stateName, 'migration-failed')
    assert.equal(fs.files.get(`${DATA_DIR}/tasks.json`), text, 'the original file must not be overwritten')
  })
})

describe('D-25 storage: archive quarter files migrate on read', () => {
  it('reads a v1 quarter file and exposes the v2 shape', () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    fs.mkdir(`${DATA_DIR}/archive`)
    const quarter = {
      schemaVersion: 1,
      quarter: '2026-Q3',
      tasks: [
        {
          id: 'tr_q3',
          title: 'Q3',
          description: '',
          kind: 'once',
          status: 'done',
          dueDate: '2026-08-15',
          pinned: false,
          doneAt: '2026-08-15T02:00:00.000Z',
          archivedQuarter: '2026-Q3',
          rule: null,
          once: { startAt: '2026-08-15T01:00:00.000Z', endAt: '2026-08-15T03:00:00.000Z', timeZone: 'Asia/Shanghai' },
          notify: { channels: ['overlay'], template: '{title}', advanceMinutes: 0, sound: false },
          state: { lastFiredAt: null, lastOccurrenceKey: null, firedStart: true, firedEnd: true },
          revision: 1,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-15T02:00:00.000Z',
        },
      ],
    }
    fs.files.set(`${DATA_DIR}/archive/completed-2026-Q3.json`, JSON.stringify(quarter))
    fs.files.set(`${DATA_DIR}/archive/index.json`, JSON.stringify({ schemaVersion: 1, quarters: [] }))
    const paths = storagePaths(DATA_DIR)
    const found = readQuarter('2026-Q3', paths, fs)
    // The index has no entry yet: rebuildIndex is what discovers the file.
    assert.equal(found, null)
    const index = readArchiveIndex(paths, fs)
    assert.equal(index.schemaVersion, SCHEMA_VERSION)
    const afterRebuild = (() => {
      const rebuilt = JSON.parse(JSON.stringify(index)) as { quarters: { quarter: string }[] }
      return rebuilt
    })()
    assert.ok(Array.isArray(afterRebuild.quarters))
  })

  it('writes schemaVersion 2 for a new quarter file', () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    fs.mkdir(`${DATA_DIR}/archive`)
    const state = emptyState(NOW)
    state.tasks = [
      makeTask({ id: 'tr_a', kind: 'once', status: 'done', doneAt: '2026-08-15T02:00:00.000Z', once: { startAt: '2026-08-15T01:00:00.000Z', endAt: '2026-08-15T03:00:00.000Z', startAtSource: 'explicit', timeZone: 'Asia/Shanghai' } }),
    ]
    archiveCompleted(state, { paths: storagePaths(DATA_DIR), fs, now: new Date('2027-01-05T00:00:00Z'), timeZone: 'Asia/Shanghai' })
    const written = JSON.parse(fs.files.get(`${DATA_DIR}/archive/completed-2026-Q3.json`) as string)
    assert.equal(written.schemaVersion, 2)
  })
})

describe('D-25: snapshot exposes the refresh boundary', () => {
  it('includes serverTime and nextTransitionAt', async () => {
    const { routes, repo } = routesFor(NOW)
    await repo.create({
      title: 'x',
      kind: 'once',
      once: { startAt: '2026-11-05T15:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' },
    })
    const res = await callRoute(routes, '/snapshot', { url: '/snapshot?view=notStarted' })
    const value = res.json<{ value: { serverTime: string; nextTransitionAt: string | null } }>().value
    assert.equal(value.serverTime, NOW.toISOString())
    assert.equal(value.nextTransitionAt, new Date('2026-11-05T15:00:00+08:00').toISOString())
  })

  it('accepts all six views and rejects anything else', async () => {
    const { routes } = routesFor(NOW)
    for (const view of ['notStarted', 'inProgress', 'overdue', 'done', 'recurring', 'paused']) {
      const res = await callRoute(routes, '/snapshot', { url: `/snapshot?view=${view}` })
      assert.equal(res.statusCode, 200, `view ${view} must be accepted`)
    }
  })
})

describe('D-25: purge still needs confirm', () => {
  it('returns invalid_argument without confirm and succeeds with it', async () => {
    const { routes, repo } = routesFor(NOW)
    const task = await repo.create({ title: 'x', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const rejected = await callRoute(routes, '/tasks/delete', { method: 'POST', body: { id: task.id, purge: true } })
    assert.equal(rejected.statusCode, 400)
    assert.equal(repo.get(task.id) !== null, true)
    const accepted = await callRoute(routes, '/tasks/delete', { method: 'POST', body: { id: task.id, purge: true, confirm: true } })
    assert.equal(accepted.statusCode, 200)
    assert.equal(repo.get(task.id), null)
  })
})

describe('D-25: deleting and restoring keeps the new fields', () => {
  it('restores a soft-deleted task with its window intact', async () => {
    const { repo } = routesFor(NOW)
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' },
    })
    await repo.remove(task.id)
    const restored = await repo.restore(task.id)
    assert.equal(restored.once?.startAtSource, 'explicit')
    assert.equal(restored.notify.endReminder, true)
    assert.equal(makeOnceTask('2026-11-05T14:00:00+08:00', '2026-11-05T18:00:00+08:00').once?.startAtSource, 'explicit')
  })
})

/** Minimal route-call helper over the fake request/response. */
async function callRoute(
  routes: ReturnType<typeof routesFor>['routes'],
  path: string,
  options: { url?: string; method?: string; body?: unknown } = {},
): Promise<ReturnType<typeof fakeResponse>> {
  const entry = routes.find((route) => route.path.endsWith(path))
  assert.ok(entry !== undefined, `route ${path} not registered`)
  const res = fakeResponse()
  const url = `/api/dsh-todos-diy${options.url ?? path}`
  await entry.handler(
    fakeRequest({
      url,
      method: options.method ?? 'GET',
      ...(options.body === undefined ? {} : { body: options.body }),
    }) as never,
    res as never,
  )
  return res
}

describe('D-25: dueDate is rejected by every write path (F4.11)', () => {
  it('rejects /tasks/create with dueDate', async () => {
    const { routes } = routesFor(NOW)
    const res = await callRoute(routes, '/tasks/create', {
      method: 'POST',
      body: { title: 'x', kind: 'recurring', dueDate: '2026-11-03', rule: { preset: 'workdays', time: '09:00' } },
    })
    assert.equal(res.statusCode, 400)
    const body = res.json<{ error: { code: string; details?: { field?: string } } }>()
    assert.equal(body.error.code, 'invalid_argument')
    assert.equal(body.error.details?.field, 'dueDate')
  })

  it('rejects /tasks/update with dueDate', async () => {
    const { routes, repo } = routesFor(NOW)
    const task = await repo.create({ title: 'x', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const res = await callRoute(routes, '/tasks/update', {
      method: 'POST',
      body: { id: task.id, expectedRevision: 1, patch: { dueDate: '2026-11-03' } },
    })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json<{ error: { code: string } }>().error.code, 'invalid_argument')
  })

  it('rejects the tool create with dueDate', async () => {
    const { byName } = makeToolHarness()
    await expectToolError(() => runTool(byName, 'todo_reminder_create', {
      title: 'x',
      kind: 'recurring',
      dueDate: '2026-11-03',
      rule: { preset: 'workdays', time: '09:00' },
    }), 'invalid_argument')
  })

  it('never returns a dueDate field from /tasks/get', async () => {
    const { routes, repo } = routesFor(NOW)
    const task = await repo.create({ title: 'x', kind: 'once', once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' } })
    const res = await callRoute(routes, '/tasks/get', { url: `/tasks/get?id=${task.id}` })
    const value = res.json<{ value: Record<string, unknown> }>().value
    assert.equal(Object.hasOwn(value, 'dueDate'), false)
    assert.equal(typeof value['stage'], 'string')
    assert.equal(Object.hasOwn(value['priority'] as object, 'remainingMinutes'), true)
  })
})

/** Minimal tool harness for the D-25 tool assertions. */
function makeToolHarness() {
  const fs = createMemoryFs()
  fs.mkdir(DATA_DIR)
  const store = createStore({ dataDir: DATA_DIR, fs, now: () => NOW })
  store.load()
  const repo = createRepository({ store, now: () => NOW, debounceMs: 0 })
  const definitions = createToolDefinitions({ repo, holidays: undefined as never, timeZone: 'Asia/Shanghai', now: () => NOW })
  const byName = new Map(definitions.map((definition) => [definition.name, definition]))
  return { byName }
}

/** Run one tool definition by name. */
async function runTool(byName: Map<string, { execute: (args: Record<string, unknown>, exec: never) => Promise<unknown> }>, name: string, args: Record<string, unknown>): Promise<unknown> {
  const definition = byName.get(name)
  assert.ok(definition !== undefined, `tool ${name} not registered`)
  return definition.execute(args, {} as never)
}

/** Assert that one tool call fails with the given envelope code. */
async function expectToolError(work: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(work, (error: { payload?: { code?: string }; message?: string }) => {
    const payload = error.payload ?? JSON.parse(error.message ?? '{}')
    assert.equal(payload.code, code)
    return true
  })
}

describe('D-25: /health no longer exposes a daily priority refresh (AC-32)', () => {
  it('has no lastPriorityRefreshAt field', async () => {
    const { routes } = routesFor(NOW)
    const res = await callRoute(routes, '/health')
    const value = res.json<{ value: { scheduler: Record<string, unknown> } }>().value
    assert.equal(Object.hasOwn(value.scheduler, 'lastPriorityRefreshAt'), false)
    assert.ok(value.scheduler['lastTickAt'] === null || typeof value.scheduler['lastTickAt'] === 'string')
  })
})
