/**
 * Convert a tick plan into the repository's `applyTick` changes.
 *
 * Extracted so the exact mapping the scheduler uses is unit-testable: a missing
 * field here (notably `node`) silently breaks one-off missed de-duplication
 * while every lower-level test still passes.
 */

import type { Occurrence, TickPlan } from './rules/types.js'
import type { TickChange } from './repoTypes.js'
import type { Task } from './rules/types.js'

/**
 * Map a tick plan to repository changes.
 *
 * Both lists carry the occurrence's own instant and its one-off node:
 * - `firedAt` / `missedAt` are the occurrence instants, never the tick time, so
 *   a backlog watermark stays correct when several occurrences are caught up at
 *   once;
 * - `node` lets `applyTick` settle `firedStart`/`firedEnd` (or the missed
 *   equivalents) for one-off tasks.
 * @param plan - Result of `resolveTick`.
 * @returns Changes ready for `repo.applyTick`.
 */
export function planToChanges(
  plan: { fire: Occurrence[]; markMissed: Occurrence[] },
  tasks: readonly Task[] = [],
): TickChange[] {
  const revisionOf = new Map(tasks.map((task) => [task.id, task.revision]))
  return [
    ...plan.fire.map((occurrence) => ({
      taskId: occurrence.taskId,
      expectedRevision: revisionOf.get(occurrence.taskId),
      firedKey: occurrence.key,
      firedAt: occurrence.at.toISOString(),
      phase: occurrence.phase,
      node: occurrence.node ?? null,
    })),
    ...plan.markMissed.map((occurrence) => ({
      taskId: occurrence.taskId,
      expectedRevision: revisionOf.get(occurrence.taskId),
      missedKey: occurrence.key,
      missedAt: occurrence.at.toISOString(),
      node: occurrence.node ?? null,
    })),
  ]
}
