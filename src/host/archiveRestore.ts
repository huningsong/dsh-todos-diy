/**
 * Restoring a task that was archived into a quarterly file (F4.18 / AC-39).
 *
 * An archived task no longer lives in `tasks.json`, so the normal repository
 * restore path cannot see it. This module moves the task back:
 *   1. append the (migrated) task to the live document and **persist it**;
 *   2. only then remove the entry from the quarter file;
 *   3. finally refresh `index.json`.
 *
 * That order is deliberate: a crash before step 2 leaves the task in both
 * places, which `reconcileArchive` collapses on the next start. The reverse
 * order would leave it in neither file — an unrecoverable loss.
 */

import { join } from 'node:path'

import type { ArchiveFs } from './archive.js'
import { readArchiveIndex } from './archive.js'
import type { StoragePaths } from './paths.js'
import type { PersistedState } from './state.js'
import { SCHEMA_VERSION } from './state.js'
import { migrateTaskV2 } from './migrationV2.js'
import { migrateIndexToCurrent } from './migrationV3.js'
import type { Task } from './rules/types.js'

/** Outcome of one archive restore. */
export type ArchiveRestoreResult =
  | { restored: true; task: Task; quarter: string }
  | { restored: false; reason: 'not-archived' | 'corrupt' }

/**
 * Find which quarter file holds a task id.
 * @param id - Task id.
 * @param paths - Storage paths.
 * @param fs - Filesystem seam.
 * @returns Quarter label and its task, or null.
 */
export function findArchivedTask(
  id: string,
  paths: StoragePaths,
  fs: ArchiveFs,
): { quarter: string; task: Task } | null {
  const index = readArchiveIndex(paths, fs)
  for (const entry of index.quarters) {
    const filePath = join(paths.archiveDir, entry.file)
    if (!fs.exists(filePath)) continue
    let parsed: { tasks?: Task[] }
    try {
      parsed = JSON.parse(fs.readFile(filePath)) as { tasks?: Task[] }
    } catch {
      continue
    }
    const task = (parsed.tasks ?? []).find((candidate) => candidate.id === id)
    if (task !== undefined) return { quarter: entry.quarter, task }
  }
  return null
}

/**
 * Restore one archived task into the live document.
 *
 * `persist` is called **before** the archive is touched, so a crash can only
 * create a duplicate (reconciled at startup), never a hole.
 * @param state - Live document (mutated on success).
 * @param id - Task id to restore.
 * @param paths - Storage paths.
 * @param fs - Filesystem seam.
 * @param now - Restore instant.
 * @param persist - Write the live document to disk synchronously.
 * @returns The restored task, its source quarter, or a reason.
 */
export function restoreArchivedTask(
  state: PersistedState,
  id: string,
  paths: StoragePaths,
  fs: ArchiveFs,
  now: Date,
  persist: (state: PersistedState) => void = () => undefined,
): ArchiveRestoreResult {
  const found = findArchivedTask(id, paths, fs)
  if (found === null) return { restored: false, reason: 'not-archived' }

  const filePath = join(paths.archiveDir, `completed-${found.quarter}.json`)
  let parsed: { schemaVersion?: number; quarter: string; tasks: Task[] }
  try {
    parsed = JSON.parse(fs.readFile(filePath)) as { schemaVersion?: number; quarter: string; tasks: Task[] }
  } catch {
    return { restored: false, reason: 'corrupt' }
  }
  // A-03: never rewrite a quarter file produced by a newer plugin build.
  if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > SCHEMA_VERSION) {
    return { restored: false, reason: 'corrupt' }
  }

  // A v1 quarter file is migrated through the shared task migration first.
  let migratedTask: Task
  try {
    const source = (parsed.schemaVersion ?? 1) < 2
      ? (migrateTaskV2(found.task as unknown as Record<string, unknown>) as unknown as Task)
      : found.task
    migratedTask = source
  } catch {
    return { restored: false, reason: 'corrupt' }
  }

  // Step 1: rebuild the live task and persist it before touching the archive.
  const restored: Task = {
    ...migratedTask,
    status: 'active',
    doneAt: null,
    archivedQuarter: null,
    pinned: false,
    revision: migratedTask.revision + 1,
    updatedAt: now.toISOString(),
  }
  state.tasks.push(restored)
  persist(state)

  // Step 2: drop the entry from the quarter file.
  const remaining = (parsed.tasks ?? []).filter((task) => task.id !== id)
  const tmp = `${filePath}.tmp`
  fs.writeFile(tmp, `${JSON.stringify({ ...parsed, schemaVersion: SCHEMA_VERSION, tasks: remaining }, null, 2)}\n`)
  fs.rename(tmp, filePath)

  // Step 3: refresh the index; drop the quarter entirely when it is now empty.
  const index = readArchiveIndex(paths, fs)
  const entry = index.quarters.find((candidate) => candidate.quarter === found.quarter)
  if (entry !== undefined) {
    entry.count = remaining.length
    if (remaining.length === 0) {
      index.quarters = index.quarters.filter((candidate) => candidate.quarter !== found.quarter)
    }
    const nextIndex = migrateIndexToCurrent({ schemaVersion: index.schemaVersion, quarters: index.quarters })
    const indexTmp = `${paths.archiveIndex}.tmp`
    fs.writeFile(indexTmp, `${JSON.stringify(nextIndex, null, 2)}\n`)
    fs.rename(indexTmp, paths.archiveIndex)
  }

  return { restored: true, task: restored, quarter: found.quarter }
}
