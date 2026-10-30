/**
 * Restoring a task that was archived into a quarterly file (F4.18 / AC-39).
 *
 * An archived task no longer lives in `tasks.json`, so the normal repository
 * restore path cannot see it. This module moves the task back:
 *   1. read the quarter file;
 *   2. remove the entry and rewrite that quarter file atomically;
 *   3. update `index.json` (count / drop the file when empty);
 *   4. append the task to the live document with `status=active`.
 *
 * Ordering matters: the main document is written **last**, so a crash leaves the
 * task in the archive only (recoverable) rather than in neither file.
 */

import { join } from 'node:path'

import type { ArchiveFs } from './archive.js'
import { readArchiveIndex } from './archive.js'
import type { StoragePaths } from './paths.js'
import type { PersistedState } from './state.js'
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
 * The caller is responsible for persisting `state` after this returns (the
 * repository's write queue owns the physical write). `state` is mutated in
 * place only after every file operation succeeded, so a failed restore leaves
 * the archive untouched.
 * @param state - Live document (mutated on success).
 * @param id - Task id to restore.
 * @param paths - Storage paths.
 * @param fs - Filesystem seam.
 * @param now - Restore instant.
 * @returns The restored task, its source quarter, or a reason.
 */
export function restoreArchivedTask(
  state: PersistedState,
  id: string,
  paths: StoragePaths,
  fs: ArchiveFs,
  now: Date,
): ArchiveRestoreResult {
  const found = findArchivedTask(id, paths, fs)
  if (found === null) return { restored: false, reason: 'not-archived' }

  const filePath = join(paths.archiveDir, `completed-${found.quarter}.json`)
  let parsed: { schemaVersion: number; quarter: string; tasks: Task[] }
  try {
    parsed = JSON.parse(fs.readFile(filePath)) as { schemaVersion: number; quarter: string; tasks: Task[] }
  } catch {
    return { restored: false, reason: 'corrupt' }
  }
  const remaining = (parsed.tasks ?? []).filter((task) => task.id !== id)
  const tmp = `${filePath}.tmp`
  fs.writeFile(tmp, `${JSON.stringify({ ...parsed, tasks: remaining }, null, 2)}\n`)
  fs.rename(tmp, filePath)

  // Refresh the index; drop the quarter entirely when it is now empty.
  const index = readArchiveIndex(paths, fs)
  const entry = index.quarters.find((candidate) => candidate.quarter === found.quarter)
  if (entry !== undefined) {
    entry.count = remaining.length
    if (remaining.length === 0) {
      index.quarters = index.quarters.filter((candidate) => candidate.quarter !== found.quarter)
    }
    const indexTmp = `${paths.archiveIndex}.tmp`
    fs.writeFile(indexTmp, `${JSON.stringify({ schemaVersion: 1, quarters: index.quarters }, null, 2)}\n`)
    fs.rename(indexTmp, paths.archiveIndex)
  }

  const restored: Task = {
    ...found.task,
    status: 'active',
    doneAt: null,
    archivedQuarter: null,
    pinned: false,
    revision: found.task.revision + 1,
    updatedAt: now.toISOString(),
  }
  state.tasks.push(restored)
  return { restored: true, task: restored, quarter: found.quarter }
}
