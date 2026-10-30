/**
 * `/health` payload assembly (NF10).
 *
 * Kept separate from the route so the shape is unit-testable without a fake
 * request, and so M2 can add storage facts without touching routing code.
 */

import type { PluginConfig } from './config.js'
import type { HolidayTable } from './rules/holidays.js'
import type { TickPlan } from './rules/types.js'

/** Storage lifecycle states mirrored from `store.ts`. */
export type StorageStateName = 'ready' | 'unsupported-version' | 'migration-failed' | 'corrupt'

/** A recovery event as surfaced to the UI. */
export interface RecoveryInfo {
  at: string
  reason: string
  message: string
  backupFile: string | null
}

/** Mutable scheduler facts the tick updates. */
export interface HealthState {
  /** Replace the tick facts after a successful pass. */
  recordTick(now: Date, plan: TickPlan, taskCount: number, todayLocalDate?: string): void
  /** Record a tick that was skipped because the previous one was still running. */
  recordSkippedTick(): void
  /** Record a failed tick without stopping the scheduler. */
  recordError(error: unknown, now: Date): void
  /** Mark the scheduler as stopped (plugin disposal). */
  markStopped(): void
  /** Record the holiday coverage discovered at load time. */
  setHolidayCoverage(years: number[], source: string): void
  /** Record the storage facts discovered at load time. */
  setStorage(path: string, state: StorageStateName, recovery: RecoveryInfo | null): void
  /** Mark the scheduler as running (before the first successful tick). */
  markRunning(): void
  /** Record one archive run that moved tasks. */
  recordArchive(archived: { quarter: string; count: number }[]): void
  /** Record how many agent tools were registered (0 when `tools` is absent). */
  setToolCount(count: number): void
  /** Record that DND held `count` reminders in the latest tick. */
  recordDndHeld(count: number): void
  /** Record the browser's Notification permission as reported by the client. */
  setSystemNotificationCapability(granted: boolean): void
  /** Build the `value` object of `GET /health`. */
  snapshot(holidays: HolidayTable): HealthSnapshot
}

/** The `value` object returned by `GET /health`. */
export interface HealthSnapshot {
  version: string
  uptimeMs: number
  dshVersion: string | null
  scheduler: {
    running: boolean
    lastTickAt: string | null
    nextWakeAt: string | null
    lastPriorityRefreshAt: string | null
    skippedTicks: number
    lastErrorAt: string | null
    lastError: string | null
  }
  storage: {
    path: string
    healthy: boolean
    state: 'ready' | 'unsupported-version' | 'migration-failed' | 'corrupt'
    lastRecovery: unknown
  }
  capabilities: {
    /**
     * Whether the browser granted the Notification permission, as reported by
     * the client. `null` means "not reported yet" — the host cannot inspect a
     * browser API, and guessing `true` would make AC-15 unverifiable.
     */
    systemNotification: boolean | null
    holidayCalendar: { available: boolean; years: number[]; source: string }
    /** Number of `todo_reminder_*` tools registered in this composition. */
    agentTools: number
  }
  config: PluginConfig & { warnings: string[] }
  taskCount: number
  archive: { lastRunAt: string | null; lastArchived: { quarter: string; count: number }[] }
  /** Reminders held by DND since startup (surfaced for diagnostics). */
  dndHeld: number
}

/**
 * Create a health holder.
 * @param version - Plugin version.
 * @param config - Effective config (echoed for support).
 * @param warnings - Config fallbacks applied at load time.
 * @returns Mutable health state.
 */
export function createHealthState(
  version: string,
  config: PluginConfig,
  warnings: string[],
): HealthState {
  const startedAt = Date.now()
  const state = {
    running: false,
    lastTickAt: null as string | null,
    nextWakeAt: null as string | null,
    lastPriorityRefreshAt: null as string | null,
    skippedTicks: 0,
    lastErrorAt: null as string | null,
    lastError: null as string | null,
    priorityDate: null as string | null,
    taskCount: 0,
    holidayYears: [] as number[],
    holidaySource: 'unknown',
    storagePath: '',
    storageState: 'ready' as StorageStateName,
    storageRecovery: null as RecoveryInfo | null,
    archiveLastRunAt: null as string | null,
    archiveLastArchived: [] as { quarter: string; count: number }[],
    toolCount: 0,
    dndHeld: 0,
    systemNotification: null as boolean | null,
  }

  return {
    recordTick(now, plan, taskCount, todayLocalDate) {
      state.running = true
      state.lastTickAt = now.toISOString()
      state.nextWakeAt = plan.nextWakeAt === null ? null : plan.nextWakeAt.toISOString()
      state.taskCount = taskCount
      // Priority is derived on read; the timestamp only proves the daily
      // refresh ran (§7.6 step 4). The refresh window opens at 00:05 local.
      const dateKey = todayLocalDate ?? localDateKeyOf(now, config.timeZone)
      if (state.priorityDate !== dateKey) {
        state.priorityDate = dateKey
        state.lastPriorityRefreshAt = now.toISOString()
      }
    },
    recordSkippedTick() {
      state.skippedTicks += 1
    },
    recordError(error, now) {
      state.lastErrorAt = now.toISOString()
      state.lastError = error instanceof Error ? error.message : String(error)
    },
    markStopped() {
      state.running = false
    },
    setHolidayCoverage(years, source) {
      state.holidayYears = years
      state.holidaySource = source
    },
    setStorage(path, stateName, recovery) {
      state.storagePath = path
      state.storageState = stateName
      state.storageRecovery = recovery
    },
    markRunning() {
      state.running = true
    },
    recordArchive(archived) {
      state.archiveLastRunAt = new Date().toISOString()
      state.archiveLastArchived = archived
    },
    setToolCount(count) {
      state.toolCount = count
    },
    recordDndHeld(count) {
      state.dndHeld += count
    },
    setSystemNotificationCapability(granted) {
      state.systemNotification = granted
    },
    snapshot(holidays) {
      return {
        version,
        uptimeMs: Date.now() - startedAt,
        dshVersion: readDshVersion(),
        scheduler: {
          running: state.running,
          lastTickAt: state.lastTickAt,
          nextWakeAt: state.nextWakeAt,
          lastPriorityRefreshAt: state.lastPriorityRefreshAt,
          skippedTicks: state.skippedTicks,
          lastErrorAt: state.lastErrorAt,
          lastError: state.lastError,
        },
        storage: {
          path: state.storagePath,
          // Only `ready` means the file is usable; a corrupt/migration failure
          // is reported as unhealthy so the UI can show its banner (F6.7).
          healthy: state.storageState === 'ready',
          state: state.storageState,
          lastRecovery: state.storageRecovery,
        },
        capabilities: {
          systemNotification: state.systemNotification,
          holidayCalendar: {
            available: state.holidayYears.length > 0,
            years: state.holidayYears,
            source: state.holidaySource,
          },
          agentTools: state.toolCount,
        },
        config: { ...config, warnings },
        taskCount: state.taskCount,
        archive: { lastRunAt: state.archiveLastRunAt, lastArchived: state.archiveLastArchived },
        dndHeld: state.dndHeld,
      }
    },
  }
}

/**
 * The DSH runtime version, when the host exports it.
 *
 * §7.11: read `DSH_VERSION` only; never guess and never reach into app-boot.
 * @returns Version string, or null when unavailable.
 */
function readDshVersion(): string | null {
  const value = process.env['DSH_VERSION']
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** Local `YYYY-MM-DD` of an instant in a zone. */
function localDateKeyOf(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const pick = (type: string): string => parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}
