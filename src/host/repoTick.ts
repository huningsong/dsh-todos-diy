/**
 * Applying one scheduler tick to the task list (F5.5 / F6.4 / D-25).
 *
 * Split from `repo.ts` to stay inside the NF5 budget. Pure with respect to the
 * clock: the instant is supplied by the caller.
 */

import type { Task, TaskState } from './rules/types.js'
import type { TickChange } from './repoTypes.js'

/**
 * Apply one change to a task's state block and return the updated task.
 *
 * A fired occurrence sets the matching node flag — `advance` marks the
 * *advance* flag, because an advance reminder replaces the on-time one but must
 * not claim the natural node was announced (F3.4 / F5.7). A missed occurrence
 * advances the durable watermark so the same backlog is never counted twice
 * (F6.4).
 * @param task - Task before the change.
 * @param change - Scheduler change.
 * @param stamp - Tick instant as ISO, used when the change omits its own time.
 * @returns A new task object.
 */
export function applyTickChange(task: Task, change: TickChange, stamp: string): Task {
  const state: TaskState = { ...task.state }
  if (change.firedKey !== undefined) {
    state.lastOccurrenceKey = change.firedKey
    state.lastFiredAt = change.firedAt ?? stamp
    // F4.5: a snooze is a one-shot reminder. Clearing the target on delivery
    // means editing the rule later cannot resurrect the same snooze.
    if (change.firedKey.endsWith('#snooze')) state.snoozeUntil = null
    if (change.node === 'start') {
      if (change.phase === 'advance') state.firedStartAdvance = true
      else state.firedStart = true
    }
    if (change.node === 'end') {
      if (change.phase === 'advance') state.firedEndAdvance = true
      else state.firedEnd = true
    }
  }
  if (change.missedKey !== undefined) {
    // Keep the newest watermark: rows arrive ascending, and a stale one must
    // never move the watermark backwards.
    const next = change.missedAt ?? stamp
    if (state.missedAt === null || next > state.missedAt) state.missedAt = next
    state.missedCount += 1
    // A missed occurrence must also advance the de-duplication marker: without
    // this the next tick would mark the same backlog again (F6.4).
    const isNewest = state.missedAt === next
    if (isNewest && (state.lastOccurrenceKey === null || change.missedKey > state.lastOccurrenceKey)) {
      state.lastOccurrenceKey = change.missedKey
      state.lastFiredAt = next
    }
    // Per-node markers: a global key comparison cannot express two nodes.
    if (change.node === 'start') state.missedStart = true
    if (change.node === 'end') state.missedEnd = true
  }
  // D-25 / F3.6: reaching `endAt` never completes a task. `done` is only
  // produced by an explicit complete, so an overdue task stays `active`.
  return { ...task, state }
}
