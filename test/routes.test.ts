/**
 * Route tests (AC-22 / AC-26 / §7.8).
 *
 * The real `createRoutes()` table is driven with fake `req`/`res` objects, so
 * status codes, envelopes and error codes are asserted exactly as a client would
 * see them. Admission is delegated to a fake `connection.requestRejection`.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { createRoutes, type RouteContext } from '../src/host/routes.js'
import { createRepository } from '../src/host/repo.js'
import { createStore } from '../src/host/store.js'
import { buildHolidayTable, type HolidayFile } from '../src/host/rules/holidays.js'
import { createHealthState } from '../src/host/health.js'
import { fakeRequest, fakeResponse } from './fakeHttp.js'
import { createMemoryFs } from './memoryFs.js'

const DATA_DIR = '/virtual/dsh/dsh-todos-diy'
const NOW = new Date('2026-10-30T09:00:00+08:00')

const here = dirname(fileURLToPath(import.meta.url))
const holidays = buildHolidayTable(
  JSON.parse(readFileSync(join(here, '../../assets/holidays-cn-2024-2027.json'), 'utf8')) as HolidayFile,
)

/** Build a route table over a memory store. */
function harness(options: {
  /** Return value of the fake `connection.requestRejection`. */
  rejection?: number
  /** Simulate a host with no `connection` service. */
  noConnection?: boolean
} = {}) {
  const fs = createMemoryFs()
  fs.mkdir(DATA_DIR)
  const store = createStore({ dataDir: DATA_DIR, fs, now: () => NOW })
  store.load()
  const repo = createRepository({ store, now: () => NOW, debounceMs: 0 })
  const config = { timeZone: 'Asia/Shanghai', tickIntervalMs: 60_000, graceMinutes: 5 }
  const health = createHealthState('0.2.0', { ...config, defaultChannels: ['overlay'], deliveriesRetention: 1000 }, [])
  health.setStorage(store.paths.stateFile, store.stateName, store.lastRecovery)

  const ctx: RouteContext = {
    repo,
    store,
    holidays,
    logger: {},
    config,
    healthSnapshot: () => health.snapshot(holidays),
    today: () => '2026-10-30',
    now: () => NOW,
    gate: (req) => {
      if (options.noConnection === true) {
        const remote = req.socket?.remoteAddress ?? ''
        const host = String(req.headers.host ?? '')
        const isLoop = remote === '::1' || remote.startsWith('127.') || remote.startsWith('::ffff:127.')
        const hostOk = host.startsWith('127.') || host.startsWith('localhost')
        return isLoop && hostOk ? undefined : 403
      }
      return options.rejection === undefined ? undefined : (options.rejection as 401 | 403)
    },
    loopbackGate: () => undefined,
  }
  return { ctx, routes: createRoutes(ctx), repo, store, fs }
}

/** Find and invoke one route. */
async function call(
  routes: ReturnType<typeof createRoutes>,
  path: string,
  options: Parameters<typeof fakeRequest>[0] = { url: path },
) {
  const entry = routes.find((candidate) => candidate.path.endsWith(path))
  assert.ok(entry !== undefined, `route ${path} not registered`)
  const res = fakeResponse()
  const req = fakeRequest({ ...options, url: `/api/dsh-todos-diy${path}${options.url.includes('?') ? options.url.slice(options.url.indexOf('?')) : ''}` })
  await entry.handler(req as never, res as never)
  return res
}

describe('route table', () => {
  it('registers every endpoint from §7.8', () => {
    const paths = harness().routes.map((route) => route.path.replace('/api/dsh-todos-diy', ''))
    for (const expected of [
      '/health',
      '/snapshot',
      '/priority/rules',
      '/archive/index',
      '/archive',
      '/archive/run',
      '/tasks/get',
      '/tasks/create',
      '/tasks/update',
      '/tasks/pause',
      '/tasks/resume',
      '/tasks/complete',
      '/tasks/snooze',
      '/tasks/pin',
      '/tasks/delete',
      '/tasks/restore',
      '/due',
      '/deliveries/ack',
      '/deliveries/report',
      '/rules/preview',
      '/settings/get',
      '/settings/update',
    ]) {
      assert.ok(paths.includes(expected), `missing route ${expected}`)
    }
  })

  it('registers only exact routes', () => {
    assert.equal(harness().routes.every((route) => route.kind === 'exact'), true)
  })
})

describe('admission (§4.4 / AC-26)', () => {
  it('answers 401 when the gate rejects with 401', async () => {
    const { routes } = harness({ rejection: 401 })
    const res = await call(routes, '/snapshot')
    assert.equal(res.statusCode, 401)
    assert.equal(res.json<{ error: { code: string } }>().error.code, 'unauthorized')
  })

  it('answers 403 when the gate rejects with 403', async () => {
    const { routes } = harness({ rejection: 403 })
    const res = await call(routes, '/snapshot')
    assert.equal(res.statusCode, 403)
    assert.equal(res.json<{ error: { code: string } }>().error.code, 'forbidden')
  })

  it('refuses a non-loopback caller when no connection service exists', async () => {
    const { routes } = harness({ noConnection: true })
    const res = await call(routes, '/snapshot', { url: '/snapshot', remoteAddress: '10.0.0.7' })
    assert.equal(res.statusCode, 403)
  })

  it('admits a loopback caller when no connection service exists', async () => {
    const { routes } = harness({ noConnection: true })
    const res = await call(routes, '/snapshot')
    assert.equal(res.statusCode, 200)
  })

  it('guards every route except /health', async () => {
    const { routes } = harness({ rejection: 401 })
    for (const route of routes) {
      if (route.path.endsWith('/health')) continue
      const res = fakeResponse()
      await route.handler(
        fakeRequest({ url: route.path, method: 'GET' }) as never,
        res as never,
      )
      assert.equal(res.statusCode, 401, `route ${route.path} was not gated`)
    }
  })
})

describe('GET /health', () => {
  it('returns the documented envelope', async () => {
    const res = await call(harness().routes, '/health')
    assert.equal(res.statusCode, 200)
    const payload = res.json<{ ok: boolean; value: { version: string; scheduler: { running: boolean } } }>()
    assert.equal(payload.ok, true)
    assert.equal(payload.value.version, '0.2.0')
    assert.equal(typeof payload.value.scheduler.running, 'boolean')
  })

  it('answers 405 for a non-GET method', async () => {
    const { routes } = harness()
    const entry = routes.find((route) => route.path.endsWith('/health'))
    const res = fakeResponse()
    await entry!.handler(fakeRequest({ url: '/api/dsh-todos-diy/health', method: 'POST', body: {} }) as never, res as never)
    assert.equal(res.statusCode, 405)
    assert.equal(res.headers['allow'], 'GET')
  })
})

describe('GET /snapshot', () => {
  it('returns items, the six counts, byKind, totalDone and settings', async () => {
    const { routes, repo } = harness()
    await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const res = await call(routes, '/snapshot', { url: '/snapshot?view=recurring' })
    assert.equal(res.statusCode, 200)
    const payload = res.json<{
      value: {
        items: unknown[]
        counts: Record<string, number>
        byKind: Record<string, number>
        totalDone: number
        serverTime: string
        nextTransitionAt: string | null
        settings: unknown
      }
    }>()
    assert.equal(payload.value.items.length, 1)
    assert.equal(payload.value.counts.recurring, 1)
    assert.deepEqual(payload.value.byKind, { once: 0, recurring: 1 })
    assert.equal(payload.value.totalDone, 0)
    assert.equal(typeof payload.value.serverTime, 'string')
    assert.ok(payload.value.settings !== undefined)
  })

  it('defaults to the inProgress view', async () => {
    const res = await call(harness().routes, '/snapshot')
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.json<{ value: { items: unknown[] } }>().value.items, [])
  })

  it('rejects an unknown view', async () => {
    const res = await call(harness().routes, '/snapshot', { url: '/snapshot?view=weird' })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json<{ error: { code: string } }>().error.code, 'invalid_argument')
  })

  it('serves the done view', async () => {
    const { routes, repo } = harness()
    const task = await repo.create({ title: 'done', kind: 'once', once: { startAt: '2026-10-01T02:00:00Z', endAt: '2026-10-01T04:00:00Z' } })
    await repo.complete(task.id)
    const res = await call(routes, '/snapshot', { url: '/snapshot?view=done' })
    assert.equal(res.json<{ value: { items: unknown[] } }>().value.items.length, 1)
  })
})

describe('GET /priority/rules', () => {
  it('returns the thresholds the UI renders', async () => {
    const res = await call(harness().routes, '/priority/rules')
    assert.deepEqual(res.json<{ value: unknown }>().value, {
      thresholds: { highHours: 24, midHours: 72, lowHours: 168 },
      derived: true,
    })
  })
})

describe('task routes', () => {
  it('creates a task and returns 201 with the TaskView', async () => {
    const { routes } = harness()
    const res = await call(routes, '/tasks/create', {
      url: '/tasks/create',
      method: 'POST',
      body: { title: '查看今日待办', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } },
    })
    assert.equal(res.statusCode, 201)
    const view = res.json<{ value: { id: string; priority: { key: string }; stage: string; utcOffset: string; nextAt: string } }>().value
    assert.match(view.id, /^tr_/)
    // A recurring task's priority follows its `nextAt`, which for a workdays
    // rule created "today" is at most a few days away.
    assert.ok(['high', 'mid', 'low'].includes(view.priority.key))
    assert.equal(view.stage, 'recurring')
    assert.equal(view.utcOffset, 'UTC+08:00')
    assert.ok(view.nextAt !== null)
  })

  it('rejects a missing title with invalid_argument', async () => {
    const res = await call(harness().routes, '/tasks/create', {
      url: '/tasks/create',
      method: 'POST',
      body: { kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } },
    })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json<{ error: { code: string } }>().error.code, 'invalid_argument')
  })

  it('rejects an invalid cron with invalid_cron', async () => {
    const res = await call(harness().routes, '/tasks/create', {
      url: '/tasks/create',
      method: 'POST',
      body: { title: 'x', kind: 'recurring', rule: { preset: 'custom', cron: '0 9 L * *' } },
    })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json<{ error: { code: string } }>().error.code, 'invalid_cron')
  })

  it('returns not_found for an unknown id', async () => {
    const res = await call(harness().routes, '/tasks/get', { url: '/tasks/get?id=tr_nope' })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json<{ error: { code: string } }>().error.code, 'not_found')
  })

  it('updates with the expected revision and rejects a stale one', async () => {
    const { routes, repo } = harness()
    const task = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const okRes = await call(routes, '/tasks/update', {
      url: '/tasks/update',
      method: 'POST',
      body: { id: task.id, expectedRevision: 1, patch: { title: 'B' } },
    })
    assert.equal(okRes.statusCode, 200)
    const conflict = await call(routes, '/tasks/update', {
      url: '/tasks/update',
      method: 'POST',
      body: { id: task.id, expectedRevision: 1, patch: { title: 'C' } },
    })
    assert.equal(conflict.statusCode, 409)
    assert.equal(conflict.json<{ error: { code: string; details?: { currentRevision?: number } } }>().error.code, 'conflict')
  })

  it('pauses and resumes idempotently', async () => {
    const { routes, repo } = harness()
    const task = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const paused = await call(routes, '/tasks/pause', { url: '/tasks/pause', method: 'POST', body: { id: task.id } })
    assert.deepEqual(paused.json<{ value: unknown }>().value, { id: task.id, status: 'paused', changed: true })
    const again = await call(routes, '/tasks/pause', { url: '/tasks/pause', method: 'POST', body: { id: task.id } })
    assert.deepEqual(again.json<{ value: unknown }>().value, { id: task.id, status: 'paused', changed: false })
    const resumed = await call(routes, '/tasks/resume', { url: '/tasks/resume', method: 'POST', body: { id: task.id } })
    assert.deepEqual(resumed.json<{ value: unknown }>().value, { id: task.id, status: 'active', changed: true })
  })

  it('requires confirm:true for a purge', async () => {
    const { routes, repo } = harness()
    const task = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const refused = await call(routes, '/tasks/delete', {
      url: '/tasks/delete',
      method: 'POST',
      body: { id: task.id, purge: true },
    })
    assert.equal(refused.statusCode, 400)
    const allowed = await call(routes, '/tasks/delete', {
      url: '/tasks/delete',
      method: 'POST',
      body: { id: task.id, purge: true, confirm: true },
    })
    assert.equal(allowed.statusCode, 200)
    assert.deepEqual(allowed.json<{ value: unknown }>().value, { id: task.id, deleted: true, purged: true })
  })

  it('snoozes with a valid minute count', async () => {
    const { routes, repo } = harness()
    const task = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const res = await call(routes, '/tasks/snooze', { url: '/tasks/snooze', method: 'POST', body: { id: task.id, minutes: 15 } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json<{ value: { snoozeUntil: string } }>().value.snoozeUntil, '2026-10-30T01:15:00.000Z')
  })

  it('pins and unpins', async () => {
    const { routes, repo } = harness()
    const task = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const res = await call(routes, '/tasks/pin', { url: '/tasks/pin', method: 'POST', body: { id: task.id, pinned: true } })
    assert.deepEqual(res.json<{ value: unknown }>().value, { id: task.id, pinned: true })
  })

  it('completes a one-off task', async () => {
    const { routes, repo } = harness()
    const task = await repo.create({
      title: 'A',
      kind: 'once',
      once: { startAt: '2026-10-30T02:00:00Z', endAt: '2026-10-30T04:00:00Z' },
    })
    const res = await call(routes, '/tasks/complete', { url: '/tasks/complete', method: 'POST', body: { id: task.id } })
    assert.equal(res.statusCode, 200)
    assert.equal((res.json<{ value: { id: string } }>().value.id), task.id)
  })

  it('restores a soft-deleted task', async () => {
    const { routes, repo } = harness()
    const task = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    await repo.remove(task.id)
    const res = await call(routes, '/tasks/restore', { url: '/tasks/restore', method: 'POST', body: { id: task.id } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json<{ value: { status: string } }>().value.status, 'active')
  })
})

describe('POST /rules/preview (F2.9)', () => {
  it('returns at most five strictly ascending instants', async () => {
    const res = await call(harness().routes, '/rules/preview', {
      url: '/rules/preview',
      method: 'POST',
      body: { rule: { preset: 'workdays', time: '09:00' } },
    })
    assert.equal(res.statusCode, 200)
    const times = res.json<{ value: { times: string[] } }>().value.times
    assert.equal(times.length, 5)
    for (let index = 1; index < times.length; index += 1) {
      assert.ok((times[index] as string) > (times[index - 1] as string), 'times must be strictly ascending')
    }
  })

  it('reports invalid_cron for a bad expression', async () => {
    const res = await call(harness().routes, '/rules/preview', {
      url: '/rules/preview',
      method: 'POST',
      body: { rule: { preset: 'custom', cron: '0 9 15W * *' } },
    })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json<{ error: { code: string } }>().error.code, 'invalid_cron')
  })
})

describe('settings routes', () => {
  it('returns and updates settings', async () => {
    const { routes } = harness()
    const before = await call(routes, '/settings/get')
    assert.equal(before.statusCode, 200)
    const updated = await call(routes, '/settings/update', {
      url: '/settings/update',
      method: 'POST',
      body: { timeZone: 'Asia/Tokyo', graceMinutes: 10 },
    })
    assert.equal(updated.statusCode, 200)
    const value = updated.json<{ value: { timeZone: string; graceMinutes: number } }>().value
    assert.equal(value.timeZone, 'Asia/Tokyo')
    assert.equal(value.graceMinutes, 10)
  })

  it('rejects an invalid time zone', async () => {
    const res = await call(harness().routes, '/settings/update', {
      url: '/settings/update',
      method: 'POST',
      body: { timeZone: 'Asia/Beijing' },
    })
    assert.equal(res.statusCode, 400)
    assert.equal(res.json<{ error: { code: string } }>().error.code, 'invalid_timezone')
  })

  it('updates every settings field the UI can change', async () => {
    const res = await call(harness().routes, '/settings/update', {
      url: '/settings/update',
      method: 'POST',
      body: {
        timeZone: 'Asia/Tokyo',
        tickIntervalMs: 120000,
        graceMinutes: 15,
        defaultChannels: ['overlay', 'system'],
        dnd: { enabled: true, start: '21:00', end: '07:00', weekdaysOnly: true },
      },
    })
    assert.equal(res.statusCode, 200)
    const value = res.json<{ value: { dnd: { enabled: boolean }; defaultChannels: string[]; tickIntervalMs: number } }>().value
    assert.equal(value.dnd.enabled, true)
    assert.deepEqual(value.defaultChannels, ['overlay', 'system'])
    assert.equal(value.tickIntervalMs, 120000)
  })
})

describe('archive routes', () => {
  it('returns an empty index on a fresh store', async () => {
    const res = await call(harness().routes, '/archive/index')
    assert.deepEqual(res.json<{ value: { quarters: unknown[] } }>().value.quarters, [])
  })

  it('returns not_found for an unknown quarter', async () => {
    const res = await call(harness().routes, '/archive', { url: '/archive?quarter=2020-Q1' })
    assert.equal(res.statusCode, 404)
  })

  it('requires the quarter parameter', async () => {
    const res = await call(harness().routes, '/archive')
    assert.equal(res.statusCode, 400)
  })
})

describe('deliveries/ack', () => {
  it('requires an occurrence key and a known action', async () => {
    const { routes } = harness()
    const missing = await call(routes, '/deliveries/ack', {
      url: '/deliveries/ack',
      method: 'POST',
      body: { action: 'dismiss' },
    })
    assert.equal(missing.statusCode, 400)
    const badAction = await call(routes, '/deliveries/ack', {
      url: '/deliveries/ack',
      method: 'POST',
      body: { occurrenceKey: 'k', action: 'explode' },
    })
    assert.equal(badAction.statusCode, 400)
  })

  it('returns not_found for an unknown delivery', async () => {
    const res = await call(harness().routes, '/deliveries/ack', {
      url: '/deliveries/ack',
      method: 'POST',
      body: { occurrenceKey: 'tr_x@2026-10-30T01:00:00.000Z', action: 'dismiss' },
    })
    assert.equal(res.statusCode, 404)
  })

  it('acknowledges a record that exists in the log', async () => {
    const { routes, repo } = harness()
    const task = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const key = `${task.id}@2026-10-30T01:00:00.000Z`
    await repo.recordDelivery({
      occurrenceKey: key,
      channel: 'overlay',
      status: 'ok',
      at: NOW.toISOString(),
      readAt: null,
      ignoredAt: null,
      dismissedAt: null,
      error: null,
    })
    const res = await call(routes, '/deliveries/ack', {
      url: '/deliveries/ack',
      method: 'POST',
      body: { occurrenceKey: key, action: 'dismiss' },
    })
    assert.equal(res.statusCode, 200)
    const value = res.json<{ value: { ok: boolean; changed: boolean } }>().value
    assert.equal(value.ok, true)
    assert.equal(value.changed, true)
    assert.ok(repo.deliveries()[0]?.dismissedAt !== null)
  })
})
