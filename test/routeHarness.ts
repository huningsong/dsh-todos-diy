/**
 * Shared route-table harness: a real `createRoutes()` over an in-memory store.
 *
 * Extracted from `routes.test.ts` so the D-25 integration tests drive the same
 * wiring (gate, health snapshot, clock) instead of re-inventing it.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRoutes, type RouteContext } from '../src/host/routes.js'
import { createRepository } from '../src/host/repo.js'
import { createStore } from '../src/host/store.js'
import { buildHolidayTable, type HolidayFile } from '../src/host/rules/holidays.js'
import { createHealthState } from '../src/host/health.js'
import { createMemoryFs } from './memoryFs.js'

const DATA_DIR = '/virtual/dsh/dsh-todos-diy'

const here = dirname(fileURLToPath(import.meta.url))
const holidays = buildHolidayTable(
  JSON.parse(readFileSync(join(here, '../../assets/holidays-cn-2024-2027.json'), 'utf8')) as HolidayFile,
)

/** Options for {@link routesFor}. */
export interface RouteHarnessOptions {
  /** Return value of the fake `connection.requestRejection`. */
  rejection?: number
  /** Simulate a host with no `connection` service. */
  noConnection?: boolean
  /** Fake LLM service for the F10 parse route. */
  llm?: unknown
  /** Fake default-model service for the F10 parse route. */
  agentDefaultModel?: unknown
}

/**
 * Build a route table over a memory store.
 * @param now - Pinned clock for the whole harness.
 * @param options - Admission behaviour overrides.
 * @returns Routes plus the store/repo behind them.
 */
export function routesFor(now: Date, options: RouteHarnessOptions = {}) {
  const fs = createMemoryFs()
  fs.mkdir(DATA_DIR)
  const store = createStore({ dataDir: DATA_DIR, fs, now: () => now })
  store.load()
  const repo = createRepository({ store, now: () => now, debounceMs: 0, holidays })
  const config = { timeZone: 'Asia/Shanghai', tickIntervalMs: 60_000, graceMinutes: 5 }
  const health = createHealthState('0.5.0', { ...config, defaultChannels: ['overlay'], deliveriesRetention: 1000 }, [])
  health.setStorage(store.paths.stateFile, store.stateName, store.lastRecovery)

  const ctx: RouteContext = {
    repo,
    store,
    holidays,
    logger: {},
    config,
    healthSnapshot: () => health.snapshot(holidays),
    today: () => '2026-10-30',
    now: () => now,
    setSystemNotification: (granted: boolean) => health.setSystemNotificationCapability(granted),
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
    llm: options.llm,
    agentDefaultModel: options.agentDefaultModel,
  }
  return { ctx, routes: createRoutes(ctx), repo, store, fs }
}
