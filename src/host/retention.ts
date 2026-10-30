/**
 * Soft-delete retention (F1.5).
 *
 * An `archived` task is a recycle-bin entry: it disappears from every list and
 * stops firing immediately, and after 30 days a daily sweep removes it for good.
 * The sweep is a pure function so the caller decides when to run it.
 */

import type { Task } from './rules/types.js'

/** Days a soft-deleted task stays recoverable (F1.5). */
export const ARCHIVE_RETENTION_DAYS = 30

/**
 * Whether an archived task is older than the retention window.
 *
 * Age is measured from `updatedAt` (the instant it was archived), which is what
 * the repository stamps when `remove()` runs.
 * @param task - Candidate task.
 * @param now - Current instant.
 * @param retentionDays - Window in days (defaults to 30).
 * @returns True when the task should be purged.
 */
export function isExpiredArchive(task: Task, now: Date, retentionDays: number = ARCHIVE_RETENTION_DAYS): boolean {
  if (task.status !== 'archived') return false
  const stamp = Date.parse(task.updatedAt)
  if (Number.isNaN(stamp)) return false
  return now.getTime() - stamp >= retentionDays * 86_400_000
}

/**
 * Split a task list into the ones to keep and the expired archives to purge.
 * @param tasks - All tasks.
 * @param now - Current instant.
 * @param retentionDays - Window in days.
 * @returns Kept tasks and the ids that should be removed.
 */
export function sweepExpiredArchives(
  tasks: readonly Task[],
  now: Date,
  retentionDays: number = ARCHIVE_RETENTION_DAYS,
): { keep: Task[]; purge: string[] } {
  const keep: Task[] = []
  const purge: string[] = []
  for (const task of tasks) {
    if (isExpiredArchive(task, now, retentionDays)) purge.push(task.id)
    else keep.push(task)
  }
  return { keep, purge }
}
