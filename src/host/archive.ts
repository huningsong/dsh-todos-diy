/**
 * Quarterly archive of completed tasks (D-24 / F4.16–F4.19).
 *
 * Layout: `$DSH_HOME/dsh-todos-diy/archive/completed-YYYY-Qn.json` plus an
 * `index.json` describing every file. Write order is deliberately
 * archive-first, main-file-second (§7.7.2):
 *
 *   1. write the quarter file (tmp + rename);
 *   2. remove that batch from the main document and write it;
 *   3. rewrite `index.json`.
 *
 * A crash between 1 and 2 leaves the task in **both** files; startup
 * reconciliation (by id) collapses that to exactly one. A crash between 2 and 3
 * leaves a correct archive with a stale index, which the next run repairs.
 */

import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import type { Task } from './rules/types.js'
import { SCHEMA_VERSION } from './state.js'
import { quarterOf } from './quarter.js'
import { readArchiveIndex, rebuildIndex } from './archiveIndex.js'
import type { PersistedState } from './state.js'
import { migrateDocumentV2, migrateIndexV2, migrateTaskV2 } from './migrationV2.js'
import type { StoragePaths } from './paths.js'

/** One entry of `archive/index.json`. */
export interface ArchiveIndexEntry {
  quarter: string
  file: string
  count: number
  start: string
  end: string
}

/** `archive/index.json` shape. */
export interface ArchiveIndex {
  schemaVersion: number
  /** True when the file was written by a newer plugin; it must not be rewritten. */
  unsupported?: boolean
  quarters: ArchiveIndexEntry[]
}

/** File-system seam, mirroring `store.ts` so tests can use the memory double. */
export interface ArchiveFs {
  readFile(path: string): string
  writeFile(path: string, content: string): void
  rename(from: string, to: string): void
  mkdir(path: string): void
  exists(path: string): boolean
  listDir(path: string): string[]
}


/**
 * The quarter that contains `now`, in a zone.
 * @param now - Current instant.
 * @param timeZone - Zone identifier.
 * @returns `YYYY-Qn`.
 */
export function currentQuarter(now: Date, timeZone: string): string {
  return quarterOf(now.toISOString(), timeZone)
}

/**
 * Compare two `YYYY-Qn` labels.
 * @param left - First quarter.
 * @param right - Second quarter.
 * @returns Negative when `left` is earlier.
 */
export function compareQuarters(left: string, right: string): number {
  const [leftYear, leftQuarter] = left.split('-Q').map(Number)
  const [rightYear, rightQuarter] = right.split('-Q').map(Number)
  if (leftYear !== rightYear) return (leftYear ?? 0) - (rightYear ?? 0)
  return (leftQuarter ?? 0) - (rightQuarter ?? 0)
}

/** Inclusive UTC bounds of a quarter label. */
export function quarterBounds(quarter: string): { start: string; end: string } | null {
  const match = /^(\d{4})-Q([1-4])$/.exec(quarter)
  if (match === null) return null
  const year = Number(match[1])
  const index = Number(match[2]) - 1
  const startMonth = index * 3
  const start = Date.UTC(year, startMonth, 1)
  const end = Date.UTC(year, startMonth + 3, 1) - 1
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() }
}

/** A quarter file's on-disk shape. */
export interface QuarterFile {
  schemaVersion: number
  quarter: string
  tasks: Task[]
}

/** Result of one archive run. */
export interface ArchiveRunResult {
  archived: { quarter: string; count: number }[]
  skipped: string[]
  /** Tasks that appear in both the archive and the main file (reconciled). */
  duplicatesRemoved: number
}

/** Options for {@link archiveCompleted}. */
export interface ArchiveOptions {
  paths: StoragePaths
  fs: ArchiveFs
  now: Date
  timeZone: string
  /** Quarter that must stay in the main file; defaults to the current one. */
  keepQuarter?: string
  logger?: { info?: (message: string) => void; warn?: (message: string) => void }
}

/** Write one JSON document atomically inside the archive directory. */
function writeJsonAtomic(fs: ArchiveFs, path: string, value: unknown): void {
  const tmp = `${path}.tmp`
  fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`)
  fs.rename(tmp, path)
}

/**
 * Move tasks that completed in a previous quarter out of the main document.
 *
 * Idempotent: running it twice archives nothing the second time. Tasks are
 * grouped by the quarter of their `doneAt` in their own time zone, which is what
 * D-24 specifies.
 * @param state - Mutable main document (mutated in place).
 * @param options - Paths, clock and target quarter.
 * @returns What was archived.
 */
export function archiveCompleted(state: PersistedState, options: ArchiveOptions): ArchiveRunResult {
  const { paths, fs, now, timeZone } = options
  const keepQuarter = options.keepQuarter ?? currentQuarter(now, timeZone)
  const logger = options.logger ?? {}

  const toArchive = state.tasks.filter(
    (task) =>
      task.status === 'done' &&
      task.doneAt !== null &&
      compareQuarters(quarterOf(task.doneAt, task.rule?.timeZone ?? timeZone), keepQuarter) < 0,
  )
  if (toArchive.length === 0) return { archived: [], skipped: [], duplicatesRemoved: 0 }

  if (!fs.exists(paths.archiveDir)) fs.mkdir(paths.archiveDir)
  const index = readArchiveIndex(paths, fs, logger)
  if (index.unsupported === true) {
    logger?.warn?.('todos-diy: archive index is newer than this plugin; refusing to rewrite it')
    return { archived: [], skipped: ['*'], duplicatesRemoved: 0 }
  }
  const byQuarter = new Map<string, Task[]>()
  for (const task of toArchive) {
    // F4.16: the quarter is decided in the task's own zone — a one-off task
    // carries it on `once`, not on `rule`.
    const quarter = quarterOf(task.doneAt as string, task.rule?.timeZone ?? task.once?.timeZone ?? timeZone)
    const bucket = byQuarter.get(quarter)
    if (bucket === undefined) byQuarter.set(quarter, [task])
    else bucket.push(task)
  }

  const archived: { quarter: string; count: number }[] = []
  const skipped: string[] = []
  /** Ids actually written to a readable quarter file; only these may leave the main file. */
  const safelyArchived = new Set<string>()
  for (const [quarter, tasks] of [...byQuarter.entries()].sort((left, right) =>
    compareQuarters(left[0], right[0]),
  )) {
    const fileName = `completed-${quarter}.json`
    const filePath = join(paths.archiveDir, fileName)
    let existing: Task[] = []
    if (fs.exists(filePath)) {
      try {
        const parsed = JSON.parse(fs.readFile(filePath)) as QuarterFile & { schemaVersion?: number }
        if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > SCHEMA_VERSION) {
          logger?.warn?.(`todos-diy: archive file ${fileName} is newer than this plugin; skipping quarter`)
          skipped.push(quarter)
          continue
        }
        existing = Array.isArray(parsed.tasks) ? parsed.tasks : []
      } catch (error) {
        // Data-loss guard (F4.19 / §8.3): if the existing quarter file cannot
        // be read, leave that batch in the main file. Removing it here would
        // make the tasks disappear from both places.
        logger.warn?.(`todos-diy: archive file ${fileName} unreadable, keeping its tasks in the main file: ${String(error)}`)
        skipped.push(quarter)
        continue
      }
    }
    const merged = new Map<string, Task>()
    for (const task of existing) merged.set(task.id, task)
    for (const task of tasks) merged.set(task.id, { ...task, archivedQuarter: quarter })
    const tasksOut = [...merged.values()]
    writeJsonAtomic(fs, filePath, { schemaVersion: SCHEMA_VERSION, quarter, tasks: tasksOut })
    const bounds = quarterBounds(quarter)
    const entryIndex = index.quarters.findIndex((entry) => entry.quarter === quarter)
    const entry: ArchiveIndexEntry = {
      quarter,
      file: fileName,
      count: tasksOut.length,
      start: bounds?.start ?? '',
      end: bounds?.end ?? '',
    }
    if (entryIndex === -1) index.quarters.push(entry)
    else index.quarters[entryIndex] = entry
    for (const task of tasks) safelyArchived.add(task.id)
    archived.push({ quarter, count: tasks.length })
  }

  // Step 2: only drop the ids that were actually written to a readable quarter
  // file. A skipped quarter keeps its tasks in the main document.
  if (safelyArchived.size === 0) {
    return { archived, skipped, duplicatesRemoved: 0 }
  }
  state.tasks = state.tasks.filter((task) => !safelyArchived.has(task.id))

  // Step 3: refresh the index.
  index.quarters.sort((left, right) => compareQuarters(left.quarter, right.quarter))
  writeJsonAtomic(fs, paths.archiveIndex, { schemaVersion: SCHEMA_VERSION, quarters: index.quarters })
  logger.info?.(`todos-diy: archived ${String(safelyArchived.size)} completed task(s)`)
  return { archived, skipped, duplicatesRemoved: 0 }
}

/**
 * Startup reconciliation for a crash between the archive write and the main
 * write: any task id present in both places is removed from the main file.
 * @param state - Main document (mutated in place).
 * @param paths - Storage paths.
 * @param fs - Filesystem seam.
 * @param logger - Logger for repairs.
 * @returns Number of duplicate rows removed.
 */
export function reconcileArchive(
  state: PersistedState,
  paths: StoragePaths,
  fs: ArchiveFs,
  logger?: { warn?: (message: string) => void },
): number {
  if (!fs.exists(paths.archiveDir)) return 0
  const archivedIds = new Set<string>()
  let removed = 0
  for (const entry of readArchiveIndex(paths, fs, logger).quarters) {
    const filePath = join(paths.archiveDir, entry.file)
    if (!fs.exists(filePath)) continue
    try {
      const parsed = JSON.parse(fs.readFile(filePath)) as QuarterFile
      for (const task of parsed.tasks ?? []) archivedIds.add(task.id)
    } catch (error) {
      logger?.warn?.(`todos-diy: archive file ${entry.file} unreadable during reconcile: ${String(error)}`)
    }
  }
  if (archivedIds.size === 0) return 0
  const before = state.tasks.length
  state.tasks = state.tasks.filter((task) => !archivedIds.has(task.id))
  removed = before - state.tasks.length
  if (removed > 0) logger?.warn?.(`todos-diy: reconciled ${String(removed)} archived duplicate(s)`)
  return removed
}

/**
 * Read one quarter's archived tasks, plus the index entry.
 * @param quarter - Quarter label.
 * @param paths - Storage paths.
 * @param fs - Filesystem seam.
 * @returns Tasks and entry, or null when the quarter is unknown.
 */
export function readQuarter(
  quarter: string,
  paths: StoragePaths,
  fs: ArchiveFs,
): { tasks: Task[]; entry: ArchiveIndexEntry } | null {
  const index = readArchiveIndex(paths, fs)
  const entry = index.quarters.find((candidate) => candidate.quarter === quarter)
  if (entry === undefined) return null
  const filePath = join(paths.archiveDir, entry.file)
  if (!fs.exists(filePath)) return null
  try {
    const parsed = JSON.parse(fs.readFile(filePath)) as QuarterFile & { schemaVersion?: number }
    if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > SCHEMA_VERSION) return null
    const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : []
    // F6.8 / AC-41: a v1 quarter file goes through the same task migration as
    // the main document. A task that cannot be migrated safely leaves the file
    // untouched and the quarter unreadable rather than guessed at.
    const tasks = (parsed.schemaVersion ?? 1) < SCHEMA_VERSION
      ? rawTasks.map((task) => migrateTaskV2(task as unknown as Record<string, unknown>) as unknown as Task)
      : rawTasks
    return { tasks, entry }
  } catch {
    return null
  }
}

/** Real `node:fs` implementation of the archive seam. */
export const nodeArchiveFs: ArchiveFs = {
  readFile: (path) => readFileSync(path, 'utf8'),
  writeFile: (path, content) => writeFileSync(path, content, 'utf8'),
  rename: (from, to) => renameSync(from, to),
  mkdir: (path) => mkdirSync(path, { recursive: true }),
  exists: (path) => existsSync(path),
  listDir: (path) => readdirSync(path),
}
export { quarterOf }
export { readArchiveIndex, rebuildIndex } from './archiveIndex.js'
