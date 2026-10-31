/**
 * dsh-todos-diy — host entry.
 *
 * Mounted by the `todos-diy` loader row from `cordis.patch.yml`. Order follows
 * §7.6 / F6.3: **load → migrate → ready → tick**. The scheduler starts only
 * after the store has been read and validated, so a corrupt file can never
 * trigger a reminder, and no UI has to be opened for reminders to work.
 *
 * Zero `@deepseek-ai/*` runtime imports: only Node built-ins.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeConfig, type PluginConfig } from './config.js'
import { buildHolidayTable, EMPTY_HOLIDAY_TABLE, type HolidayFile, type HolidayTable } from './rules/holidays.js'
import { resolveTick } from './rules/resolveTick.js'
import { localDateKey } from './rules/timezone.js'
import type { Task } from './rules/types.js'
import { createHealthState, type HealthState } from './health.js'
import { createRequestGate, loopbackRejection, sendError } from './http.js'
import { createRoutes } from './routes.js'
import { registerTools } from './tools.js'
import { resolveDataDir } from './paths.js'
import { createStore, nodeFileSystem, type Store } from './store.js'
import { createRepository, type Repository } from './repo.js'
import { archiveCompleted, nodeArchiveFs, readArchiveIndex, rebuildIndex, reconcileArchive } from './archive.js'
import { buildReminderCard, deliveryRecordsFor } from './delivery.js'
import { isWithinDnd, shouldDropInsteadOfSummarise } from './dnd.js'
import { planToChanges } from './tickChanges.js'
import { emptyState } from './state.js'
import { quarterOf } from './quarter.js'

/** Loader/display identity; the package name is `dsh-todos-diy`. */
export const name = 'dsh-todos-diy'

/**
 * Required services. `timer` supplies `ctx.interval` / `ctx.timeout`
 * (`cordis-plugin-timer`). Everything else is acquired optionally through
 * `ctx.inject`, so a minimal composition still loads this plugin.
 */
export const inject = ['timer']

/** Plugin version reported by `/health`; kept in sync with `package.json`. */
export const PLUGIN_VERSION = '0.5.1'

const LOG_PREFIX = 'todos-diy:'

/**
 * Read the bundled Chinese holiday table.
 *
 * A missing or corrupt asset degrades `workdays` rules to plain Mon–Fri rather
 * than failing activation (the file ships with the package, so this only
 * happens on a broken installation).
 * @param logger - Host logger used for the warning.
 * @returns Parsed table, or an empty one.
 */
function loadHolidayTable(logger: { warn?: (message: string) => void }): HolidayTable {
  const here = dirname(fileURLToPath(import.meta.url))
  const assetPath = join(here, '..', 'assets', 'holidays-cn-2024-2027.json')
  try {
    const parsed = JSON.parse(readFileSync(assetPath, 'utf8')) as HolidayFile
    return buildHolidayTable(parsed)
  } catch (error) {
    logger.warn?.(`${LOG_PREFIX} holiday table unavailable, workdays fall back to Mon-Fri: ${String(error)}`)
    return EMPTY_HOLIDAY_TABLE
  }
}

/** Everything one scheduler pass needs. */
interface SchedulerDeps {
  repo: Repository
  config: PluginConfig
  holidays: HolidayTable
  health: HealthState
  logger: { info?: (message: string) => void; warn?: (message: string) => void }
}

/**
 * Create the tick function. Re-entrancy is guarded so a slow tick cannot
 * overlap the next interval callback (§8.2 "tick 重入").
 * @param deps - Scheduler dependencies.
 * @returns Async tick entry point.
 */
function createTick(deps: SchedulerDeps): (now?: Date) => Promise<void> {
  let ticking = false
  return async (now: Date = new Date()): Promise<void> => {
    if (ticking) {
      deps.health.recordSkippedTick()
      return
    }
    ticking = true
    try {
      deps.health.markRunning()
      const tasks = deps.repo.snapshotTasks()
      // The persisted setting wins over the loader-row default: the settings
      // page writes `settings.graceMinutes`, and a user who changes it expects
      // the next tick to use it (F9.x / D-06).
      const plan = resolveTick(tasks, now, {
        graceMinutes: deps.repo.settings().graceMinutes,
        holidays: deps.holidays,
      })
      // DND (F5.6): occurrences that come due inside the window are held, not
      // delivered live. They are still claimed and written to the outbox, but
      // marked `dnd` so `/due` hides them until the window ends — at which point
      // the client renders one merged summary (UX-05). Over-long windows drop
      // them as missed instead of replaying a pile of stale cards.
      const settings = deps.repo.settings()
      const dnd = settings.dnd
      const heldByDnd = plan.fire.length > 0 && isWithinDnd(dnd, now, settings.timeZone)
      if (heldByDnd && shouldDropInsteadOfSummarise(dnd)) {
        for (const occurrence of plan.fire) plan.markMissed.push(occurrence)
        plan.fire.length = 0
      } else if (heldByDnd) {
        deps.health.recordDndHeld(plan.fire.length)
      }
      // Persist the scheduling decisions before anything is delivered, so a
      // crash cannot re-fire a claimed occurrence (F5.5 "先落盘 claim 再投递").
      const changes = planToChanges(plan, tasks)
      if (changes.length > 0) {
        await deps.repo.applyTick(changes, now)
        // Write the outbox rows in the same batch as the claim: a crash after
        // this point re-shows the card instead of losing the reminder (F5.5).
        const records = plan.fire.flatMap((occurrence) => {
          const task = tasks.find((candidate) => candidate.id === occurrence.taskId)
          if (task === undefined) return []
          return deliveryRecordsFor(task, occurrence, now).map((record) =>
            heldByDnd ? { ...record, error: 'dnd-held' } : record,
          )
        })
        if (records.length > 0) await deps.repo.recordDeliveries(records)
        await deps.repo.flush()
      }
      if (plan.markMissed.length > 0) {
        deps.logger.info?.(
          `${LOG_PREFIX} missed ${String(plan.markMissed.length)} occurrence(s): ${plan.markMissed
            .slice(0, 3)
            .map((occurrence) => occurrence.key)
            .join(', ')}`,
        )
      }
      // Priority is derived on read; the daily 00:05 timestamp only proves the
      // refresh ran (F4.13). Nothing is written to disk for it.
      deps.health.recordTick(now, plan, tasks.length, localDateKey(now.getTime(), settings.timeZone))
    } catch (error) {
      deps.logger.warn?.(`${LOG_PREFIX} tick failed: ${String(error)}`)
      deps.health.recordError(error, now)
    } finally {
      ticking = false
    }
  }
}


/**
 * Loopback-only admission for `/health`.
 *
 * `/health` is the one route §7.8 keeps outside the login gate, but it must not
 * become readable through a tunnel: only a loopback socket with a loopback
 * `Host` and a non-cross-site fetch is admitted.
 * @param req - Incoming request.
 * @returns 401/403 to refuse, undefined to admit.
 */
function loopbackOnly(req: any): 401 | 403 | undefined {
  const rejection = loopbackRejection(req)
  return rejection
}

/**
 * Mount the plugin on the host context.
 * @param ctx - Cordis context.
 * @param rawConfig - Loader row config from `cordis.patch.yml`.
 */
export function apply(ctx: any, rawConfig: unknown): void {
  const { config, warnings } = normalizeConfig(rawConfig)
  const logger = ctx.logger ?? console
  const dataDir = resolveDataDir()
  const health = createHealthState(PLUGIN_VERSION, config, warnings)
  const holidays = loadHolidayTable(logger)
  health.setHolidayCoverage([...holidays.years], holidays.source)

  // 1) load → 2) migrate → 3) build the in-memory model. Synchronous, before
  //    any timer exists (F6.3: no `deliver` line before `ready`).
  const store: Store = createStore({ dataDir, fs: nodeFileSystem, logger })
  const state = store.load()
  health.setStorage(store.paths.stateFile, store.stateName, store.lastRecovery)
  // Crash recovery: a task left in both the archive and the main file by a
  // crash between the two archive writes is collapsed to one copy (F4.19).
  // Rebuild the archive index from the quarter files first: a crash before the
  // index write leaves an orphan file that the index alone would never show
  // (F4.17 / §8.3).
  const archiveIndex = rebuildIndex(store.paths, nodeArchiveFs, logger)
  if (!store.readOnly && archiveIndex.unsupported !== true && archiveIndex.quarters.length > 0) {
    try {
      nodeArchiveFs.writeFile(
        store.paths.archiveIndex,
        `${JSON.stringify(archiveIndex, null, 2)}\n`,
      )
    } catch (error) {
      logger.warn?.(`${LOG_PREFIX} could not persist the rebuilt archive index: ${String(error)}`)
    }
  }
  const reconciled = reconcileArchive(state, store.paths, nodeArchiveFs, logger)
  if (reconciled > 0) {
    store.set(state)
    store.flush()
  }

  // `totalDone` needs the archive index; read it live on every list call so a
  // restore or an archive run is reflected immediately (F4.21 / AC-39).
  const archivedDone = (): number => {
    try {
      return readArchiveIndex(store.paths, nodeArchiveFs, logger).quarters.reduce((sum, entry) => sum + entry.count, 0)
    } catch {
      return 0
    }
  }
  const repo = createRepository({
    store,
    now: () => new Date(),
    debounceMs: 200,
    holidays,
    archiveDone: archivedDone,
  })
  const tick = createTick({ repo, config, holidays, health, logger })

  if (store.readOnly) {
    // F6.8: a file written by a newer plugin must not be scheduled against or
    // mutated. The panel still opens (read-only), and `/health` reports the
    // state so the UI can show its banner.
    logger.error?.(
      `${LOG_PREFIX} tasks.json was written by a newer plugin version; running read-only until the plugin is upgraded`,
    )
    health.markReadOnly()
  }

  for (const warning of warnings) logger.warn?.(`${LOG_PREFIX} config: ${warning}`)
  logger.info?.(
    `${LOG_PREFIX} starting scheduler (tick=${String(config.tickIntervalMs)}ms, tz=${config.timeZone}, grace=${String(config.graceMinutes)}m)`,
  )

  ctx.effect(() => {
    if (store.readOnly) return () => undefined
    const dispose = ctx.interval(() => {
      void tick()
    }, config.tickIntervalMs)
    // Immediate first pass: never depend on a UI being opened (F6.1).
    void tick()
    return () => {
      health.markStopped()
      dispose()
      repo.dispose()
      store.flushSync()
      logger.info?.(`${LOG_PREFIX} scheduler stopped`)
    }
  }, 'todos-diy: scheduler')

  // Quarterly archive check: once per tick at 00:05 on the first day of a
  // quarter, plus a startup pass so a long downtime still archives (F4.16).
  ctx.effect(() => {
    if (store.readOnly) return () => undefined
    const runArchive = (): void => {
      try {
        const result = archiveCompleted(store.state, {
          paths: store.paths,
          fs: nodeArchiveFs,
          now: new Date(),
          timeZone: config.timeZone,
          logger,
        })
        if (result.archived.length > 0) {
          store.set(store.state)
          store.flush()
          health.recordArchive(result.archived)
        }
        // F1.5: soft-deleted tasks expire after 30 days.
        void repo.sweepArchives(new Date()).then((purged) => {
          if (purged > 0) {
            logger.info?.(`${LOG_PREFIX} purged ${String(purged)} expired archive(s)`)
            store.flush()
          }
        })
      } catch (error) {
        logger.warn?.(`${LOG_PREFIX} archive failed: ${String(error)}`)
      }
    }
    runArchive()
    // F4.16: the first tick after a quarter boundary must move last quarter's
    // completed tasks, so this runs at the tick cadence. `archiveCompleted` is
    // a cheap in-memory scan unless there is something to move.
    const dispose = ctx.interval(runArchive, config.tickIntervalMs)
    return () => dispose()
  }, 'todos-diy: archive')

  const gate = createRequestGate(ctx)
  /** `/health` is exempt from the login gate (§7.8) but stays loopback-only. */
  const loopbackGate = (req: any): 401 | 403 | undefined => loopbackOnly(req)

  /** F10: services resolved through `ctx.inject` so cordis hands us live values. */
  const nlpServices: { llm?: unknown; agentDefaultModel?: unknown } = {}
  try {
    ctx.inject(['llm'], (llmCtx: any) => {
      nlpServices.llm = llmCtx.llm
    })
  } catch {
    // Older hosts without an LLM service: the parse route degrades.
  }
  try {
    ctx.inject(['agentDefaultModel'], (modelCtx: any) => {
      nlpServices.agentDefaultModel = modelCtx.agentDefaultModel
    })
  } catch {
    // Optional service.
  }

  const routeContext = {
    repo,
    store,
    holidays,
    logger,
    config,
    healthSnapshot: () => health.snapshot(holidays),
    today: () => localDateKey(Date.now(), repo.settings().timeZone),
    now: () => new Date(),
    gate,
    loopbackGate,
    setSystemNotification: (granted: boolean) => health.setSystemNotificationCapability(granted),
    // F10: resolved lazily so the plugin also loads in compositions without an
    // LLM service (the parse route then degrades to a plain form).
    get llm() {
      return nlpServices.llm
    },
    get agentDefaultModel() {
      return nlpServices.agentDefaultModel
    },
  }

  ctx.inject(['webServer'], (webCtx: any) => {
    webCtx.effect(() => {
      const routes = createRoutes(routeContext)
      const disposers = routes.map((entry) => webCtx.webServer.register(entry))
      logger.info?.(`${LOG_PREFIX} registered ${String(routes.length)} route(s)`)
      return () => {
        for (const dispose of disposers) dispose()
      }
    }, 'todos-diy: routes')
  })

  ctx.inject(['tools'], (toolCtx: any) => {
    toolCtx.effect(
      () => {
        const registration = registerTools(toolCtx, {
          repo,
          holidays,
          timeZone: config.timeZone,
          now: () => new Date(),
        })
        health.setToolCount(registration.count)
        logger.info?.(`${LOG_PREFIX} registered ${String(registration.count)} tool(s)`)
        return registration.dispose
      },
      'todos-diy: tools',
    )
  })
}

export { sendError }
export { emptyState }
export type { Task }
