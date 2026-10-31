/**
 * Archive route happy paths (§7.8): listing an existing quarter and running an
 * archive pass. Kept in a separate file so `routes.test.ts` stays focused on the
 * task surface.
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
import { createMemoryFs } from './memoryFs.js'
import { fakeRequest, fakeResponse } from './fakeHttp.js'

const DATA_DIR = '/virtual/dsh/dsh-todos-diy'
const here = dirname(fileURLToPath(import.meta.url))
const holidays = buildHolidayTable(
  JSON.parse(readFileSync(join(here, '../../assets/holidays-cn-2024-2027.json'), 'utf8')) as HolidayFile,
)

/**
 * Build a route table whose clock can be moved between the create and archive
 * steps, so a task can be completed in one quarter and archived in the next.
 */
function harness(now: () => Date) {
  const fs = createMemoryFs()
  fs.mkdir(DATA_DIR)
  const store = createStore({ dataDir: DATA_DIR, fs, now })
  store.load()
  const repo = createRepository({ store, now, debounceMs: 0 })
  const config = { timeZone: 'Asia/Shanghai', tickIntervalMs: 60_000, graceMinutes: 5 }
  const health = createHealthState('0.5.2', { ...config, defaultChannels: ['overlay'], deliveriesRetention: 1000 }, [])
  const ctx: RouteContext = {
    repo,
    store,
    holidays,
    logger: {},
    config,
    healthSnapshot: () => health.snapshot(holidays),
    today: () => '2027-01-05',
    now,
    gate: () => undefined,
    loopbackGate: () => undefined,
    // Share the same in-memory filesystem as the store, so the archive routes
    // exercise their real logic without touching the host disk.
    archiveFs: {
      readFile: (path) => fs.readFile(path),
      writeFile: (path, content) => fs.writeFile(path, content),
      rename: (from, to) => fs.rename(from, to),
      mkdir: (path) => fs.mkdir(path),
      exists: (path) => fs.exists(path),
      listDir: (path) => fs.listDir(path),
    },
  }
  return { ctx, routes: createRoutes(ctx), repo, store }
}

/** Invoke one route by suffix. */
async function call(
  routes: ReturnType<typeof createRoutes>,
  path: string,
  options: { method?: string; body?: unknown; query?: string } = {},
) {
  const entry = routes.find((candidate) => candidate.path.endsWith(path))
  assert.ok(entry !== undefined)
  const res = fakeResponse()
  const req = fakeRequest({
    url: `/api/dsh-todos-diy${path}${options.query === undefined ? '' : `?${options.query}`}`,
    method: options.method ?? 'GET',
    ...(options.body === undefined ? {} : { body: options.body }),
  })
  await entry.handler(req as never, res as never)
  return res
}

describe('POST /archive/run', () => {
  it('archives a previous quarter and reports the counts', async () => {
    let current = new Date('2026-11-15T10:00:00+08:00')
    const { routes, repo } = harness(() => current)
    const task = await repo.create({
      title: '上季度完成的任务',
      kind: 'once',
      once: { startAt: '2026-10-20T02:00:00Z', endAt: '2026-10-20T04:00:00Z' },
    })
    await repo.complete(task.id, undefined, new Date('2026-11-15T10:00:00+08:00'))
    // Move into the next quarter, then archive.
    current = new Date('2027-01-05T09:00:00+08:00')
    const res = await call(routes, '/archive/run', { method: 'POST', body: {} })
    assert.equal(res.statusCode, 200)
    const value = res.json<{ value: { archived: { quarter: string; count: number }[] } }>().value
    assert.deepEqual(value.archived, [{ quarter: '2026-Q4', count: 1 }])
  })

  it('is a no-op when nothing is archivable', async () => {
    const { routes } = harness(() => new Date('2027-01-05T09:00:00+08:00'))
    const res = await call(routes, '/archive/run', { method: 'POST', body: {} })
    assert.deepEqual(res.json<{ value: { archived: unknown[] } }>().value.archived, [])
  })
})

describe('GET /archive and /archive/index after a run', () => {
  it('lists the quarter and pages through it', async () => {
    let current = new Date('2026-11-15T10:00:00+08:00')
    const { routes, repo } = harness(() => current)
    for (const title of ['A', 'B']) {
      const task = await repo.create({
        title,
        kind: 'once',
        once: { startAt: '2026-10-20T02:00:00Z', endAt: '2026-10-20T04:00:00Z' },
      })
      await repo.complete(task.id, undefined, new Date('2026-11-15T10:00:00+08:00'))
    }
    current = new Date('2027-01-05T09:00:00+08:00')
    await call(routes, '/archive/run', { method: 'POST', body: {} })

    const index = await call(routes, '/archive/index')
    const quarters = index.json<{ value: { quarters: { quarter: string; count: number }[] } }>().value.quarters
    assert.equal(quarters.length, 1)
    assert.equal(quarters[0]?.quarter, '2026-Q4')
    assert.equal(quarters[0]?.count, 2)

    const firstPage = await call(routes, '/archive', { query: 'quarter=2026-Q4&limit=1' })
    assert.equal(firstPage.statusCode, 200)
    const page = firstPage.json<{ value: { items: unknown[]; nextCursor: string | null } }>().value
    assert.equal(page.items.length, 1)
    assert.equal(page.nextCursor, '1')

    const secondPage = await call(routes, '/archive', { query: 'quarter=2026-Q4&limit=1&cursor=1' })
    const page2 = secondPage.json<{ value: { items: unknown[]; nextCursor: string | null } }>().value
    assert.equal(page2.items.length, 1)
    assert.equal(page2.nextCursor, null)
  })
})
