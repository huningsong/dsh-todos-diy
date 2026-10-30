/**
 * `GET /reports` — read-only weekly/monthly report (F11.3).
 *
 * The handler loads the main document plus archive quarters, then delegates to
 * the pure `buildReport`. It never calls `touch()`, so asking for a report can
 * never change `tasks.json`.
 */

import { route } from './http.js'
import { ok, queryValue } from './routeKit.js'
import { ValidationError } from './validationError.js'
import { buildReport, periodOf, type ReportData } from './reports.js'
import { nextFireAt } from './rules/occurrence.js'
import { localDateKey } from './rules/timezone.js'
import { join } from 'node:path'
import { nodeArchiveFs } from './archive.js'
import { migrateDocumentToCurrent } from './migrationV3.js'
import { SCHEMA_VERSION } from './state.js'
import type { Task } from './rules/types.js'
import type { RouteContext, RouteDefinition } from './routes.js'

/** Prefix all plugin routes live under. */
const PREFIX = '/api/dsh-todos-diy'

/** Kinds the endpoint accepts. */
const KINDS = ['weekly', 'monthly'] as const

/**
 * Convert a `YYYY-MM-DD` anchor into a local date key, defaulting to today.
 * @param raw - Query value.
 * @param timeZone - Reporting zone.
 * @param now - Clock.
 * @returns Date key.
 */
export function resolveAnchor(raw: string | undefined, timeZone: string, now: Date): string {
  if (raw === undefined || raw === '') return localDateKey(now.getTime(), timeZone)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ValidationError('invalid_argument', 'anchor must be YYYY-MM-DD', { field: 'anchor' })
  }
  try {
    periodOf('weekly', raw, timeZone)
  } catch {
    throw new ValidationError('invalid_argument', 'anchor is not a valid date', { field: 'anchor' })
  }
  return raw
}

/**
 * Load archived tasks **without writing anything** (A-04).
 *
 * `readArchiveIndex`/`rebuildIndex` migrate index and quarter files on disk,
 * which would make `GET /reports` a write path. This reader parses the same
 * files in memory and never persists a migration.
 * @param ctx - Route context.
 * @returns Archived tasks (empty when the archive is unavailable).
 */
export function loadArchivedTasks(ctx: RouteContext): Task[] {
  const fs = ctx.archiveFs ?? nodeArchiveFs
  const paths = ctx.store.paths
  const files: string[] = []
  try {
    if (fs.exists(paths.archiveIndex)) {
      const raw = JSON.parse(fs.readFile(paths.archiveIndex)) as { quarters?: { file?: unknown }[] }
      for (const entry of Array.isArray(raw.quarters) ? raw.quarters : []) {
        if (typeof entry.file === 'string' && /^completed-\d{4}-Q[1-4]\.json$/.test(entry.file)) files.push(entry.file)
      }
    }
  } catch {
    // Fall through to a directory scan.
  }
  if (files.length === 0 && fs.exists(paths.archiveDir)) {
    for (const name of fs.listDir(paths.archiveDir)) {
      if (/^completed-\d{4}-Q[1-4]\.json$/.test(name)) files.push(name)
    }
  }
  const tasks: Task[] = []
  for (const name of files) {
    try {
      const path = join(paths.archiveDir, name)
      if (!fs.exists(path)) continue
      const parsed = JSON.parse(fs.readFile(path)) as { schemaVersion?: number; tasks?: unknown }
      if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > SCHEMA_VERSION) continue
      const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : []
      const migrated = (parsed.schemaVersion ?? 1) < SCHEMA_VERSION
        ? (migrateDocumentToCurrent({ ...parsed, tasks: rawTasks })['tasks'] as Task[])
        : (rawTasks as Task[])
      tasks.push(...migrated)
    } catch {
      // A broken quarter must not break the report.
    }
  }
  return tasks
}

/**
 * Build the report routes.
 * @param ctx - Route context.
 * @returns One route definition.
 */
export function createReportRoutes(ctx: RouteContext): RouteDefinition[] {
  return [
    {
      kind: 'exact',
      path: `${PREFIX}/reports`,
      handler: route({ gate: ctx.gate, logger: ctx.logger }, 'GET', async (_req, res, url) => {
        const kindRaw = queryValue(url, 'kind') ?? 'weekly'
        if (!(KINDS as readonly string[]).includes(kindRaw)) {
          throw new ValidationError('invalid_argument', 'kind must be weekly or monthly', { field: 'kind' })
        }
        const timeZone = ctx.store.state.settings.timeZone
        const anchor = resolveAnchor(queryValue(url, 'anchor'), timeZone, ctx.now())
        const now = ctx.now()
        const report: ReportData = buildReport({
          kind: kindRaw as 'weekly' | 'monthly',
          anchor,
          timeZone,
          now,
          tasks: ctx.store.state.tasks,
          archived: loadArchivedTasks(ctx),
          events: ctx.store.state.completionEvents,
          nextAtFor: (task) => {
            const next = nextFireAt(task, now, ctx.holidays)
            return next === null ? null : next.toISOString()
          },
        })
        ok(res, report)
      }),
    },
  ]
}
