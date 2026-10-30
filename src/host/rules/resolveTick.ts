/**
 * `resolveTick` — the whole scheduling decision, as a pure function.
 *
 * No IO, no clock: the caller injects `now` and the holiday table. The output is
 * a plan the scheduler turns into repository writes and deliveries.
 *
 * Semantics (§7.6 / F6.4 / D-06):
 *  - an occurrence at or before `now` fires when it is within `graceMinutes`;
 *  - an occurrence older than the grace window is reported in `markMissed` and
 *    is **never** delivered;
 *  - a recurring task contributes at most one firing occurrence per tick — only
 *    its latest due one — so a long downtime can never produce a burst;
 *  - a one-off task contributes each un-fired node independently (start and end
 *    are separate occurrences, D-03).
 */

import { MAX_OCCURRENCES_PER_TICK, dueOccurrences, missedOccurrences, nextFireAt, onceOccurrences } from './occurrence.js'
import type { HolidayTable } from './holidays.js'
import type { Occurrence, Task, TickPlan } from './types.js'

/** Options accepted by {@link resolveTick}. */
export interface ResolveTickOptions {
  /** Grace window in minutes; `0` means "strictly on time or missed" (D-06). */
  graceMinutes?: number
  /** Holiday lookup table used by `workdays` rules. */
  holidays?: HolidayTable
  /** Hard cap on `markMissed` entries per task (F6.4: "最多记录最近 50 条"). */
  missedLimit?: number
}

/** Default grace window, matching `settings.graceMinutes` (D-06). */
export const DEFAULT_GRACE_MINUTES = 5

/**
 * Whether one occurrence is still inside the grace window.
 * @param occurrence - Candidate occurrence.
 * @param now - Tick instant.
 * @param graceMinutes - Grace window in minutes.
 * @returns True when it should fire rather than be marked missed.
 */
export function withinGrace(occurrence: Occurrence, now: Date, graceMinutes: number): boolean {
  const age = now.getTime() - occurrence.at.getTime()
  return age <= Math.max(0, graceMinutes) * 60_000
}

/**
 * Compute one tick's plan across all tasks.
 *
 * Tasks that are not `active` are skipped entirely: a paused task produces no
 * firing and no missed record (D-22), and a done/archived task is out of the
 * schedule.
 * @param tasks - All stored tasks.
 * @param now - Current instant, injected by the caller.
 * @param options - Grace window and holiday table.
 * @returns The plan: occurrences to fire, missed ones, and the next wake time.
 */
export function resolveTick(
  tasks: readonly Task[],
  now: Date,
  options: ResolveTickOptions = {},
): TickPlan {
  const graceMinutes = options.graceMinutes ?? DEFAULT_GRACE_MINUTES
  const missedLimit = options.missedLimit ?? MAX_OCCURRENCES_PER_TICK
  const fire: Occurrence[] = []
  const markMissed: Occurrence[] = []

  for (const task of tasks) {
    if (task.status !== 'active') continue

    // Snooze (F4.5 / AC-12): a snoozed occurrence fires once when its window
    // elapses, as a separate `#snooze` occurrence whose key includes the target
    // instant, so repeated ticks cannot re-fire it and the normal rule is
    // untouched. `lastSnoozeFiredAt` on the task keeps the idempotency record.
    const snooze = dueSnooze(task, now, graceMinutes)
    if (snooze !== undefined) {
      fire.push(snooze)
      continue
    }

    if (task.kind === 'once') {
      for (const occurrence of collectOnceDue(task, now)) {
        if (withinGrace(occurrence, now, graceMinutes)) fire.push(occurrence)
        else markMissed.push(occurrence)
      }
      continue
    }

    const due = dueOccurrences(task, now, lastFiredInstant(task), options.holidays)
    const latest = due[0]
    if (latest === undefined) continue
    // Everything strictly before the latest due occurrence is backlog: it is
    // recorded as missed and never delivered (F6.4, "零回填"). The limit covers
    // the whole per-task record, so the firing candidate is one of the slots.
    // Convert the shift-and-probe bounds into natural time: `latest.at` is
    // advance-shifted, and so is `lastFiredAt`.
    const advanceMs = Math.max(0, Math.min(1440, Math.trunc(task.notify.advanceMinutes))) * 60_000
    const lastFired = lastFiredInstant(task)
    const naturalBefore = new Date(latest.at.getTime() + advanceMs)
    // A fired advance reminder at 08:50 corresponds to the 09:00 natural
    // occurrence, so the natural floor is the fired instant *plus* the offset.
    const naturalLastFired = lastFired === null ? null : new Date(lastFired.getTime() + advanceMs)
    const backlog = missedOccurrences(
      task,
      naturalBefore,
      naturalLastFired,
      Math.max(0, missedLimit - 1),
      options.holidays,
    )
    for (const stale of backlog) markMissed.push(stale)
    if (withinGrace(latest, now, graceMinutes)) fire.push(latest)
    else markMissed.push(latest)
  }

  return { fire, markMissed, nextWakeAt: nextWakeAtFor(tasks, now, options.holidays) }
}

/**
 * One-off occurrences due at or before `now` whose node has not fired yet.
 * @param task - One-off task.
 * @param now - Tick instant.
 * @returns Un-fired due nodes, start first.
 */
function collectOnceDue(task: Task, now: Date): Occurrence[] {
  const result: Occurrence[] = []
  const nowMs = now.getTime()
  for (const occurrence of onceOccurrences(task)) {
    if (occurrence.node === 'start' && task.state.firedStart) continue
    if (occurrence.node === 'end' && task.state.firedEnd) continue
    if (occurrence.at.getTime() <= nowMs) result.push(occurrence)
  }
  return result
}

/**
 * Parse the task's `lastFiredAt` into an instant.
 * @param task - Task to inspect.
 * @returns Instant, or null when nothing has fired yet.
 */
function lastFiredInstant(task: Task): Date | null {
  if (task.state.lastFiredAt === null) return null
  const parsed = new Date(task.state.lastFiredAt)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Earliest next fire across active tasks.
 * @param tasks - All tasks.
 * @param now - Lower bound.
 * @param holidays - Holiday table.
 * @returns Earliest instant, or null.
 */
function nextWakeAtFor(
  tasks: readonly Task[],
  now: Date,
  holidays: HolidayTable | undefined,
): Date | null {
  let earliest: number | null = null
  for (const task of tasks) {
    if (task.status !== 'active') continue
    const next = holidays === undefined ? nextFireAt(task, now) : nextFireAt(task, now, holidays)
    if (next === null) continue
    if (earliest === null || next.getTime() < earliest) earliest = next.getTime()
  }
  return earliest === null ? null : new Date(earliest)
}

/**
 * The pending snooze occurrence for one task, if it is due.
 *
 * A snooze is a one-shot reminder layered on top of the normal rule: it fires
 * when `snoozeUntil` is reached (inside the grace window), and never again for
 * the same target instant. It does not advance the rule's own
 * `lastOccurrenceKey`, so the next regular occurrence still fires on schedule.
 * @param task - Active task.
 * @param now - Tick instant.
 * @param graceMinutes - Grace window in minutes.
 * @returns The snooze occurrence, or undefined when nothing is due.
 */
function dueSnooze(task: Task, now: Date, graceMinutes: number): Occurrence | undefined {
  const until = task.state.snoozeUntil
  if (until === null) return undefined
  const at = new Date(until)
  if (Number.isNaN(at.getTime())) return undefined
  if (at.getTime() > now.getTime()) return undefined
  const key = `${task.id}@${at.toISOString()}#snooze`
  // Already delivered for this exact target? `lastOccurrenceKey` records the
  // snooze key on delivery, so a re-tick is a no-op.
  if (task.state.lastOccurrenceKey === key) return undefined
  if (!withinGrace({ taskId: task.id, at, phase: null, key, kind: task.kind }, now, graceMinutes)) {
    // Outside grace: drop the stale snooze rather than hold it forever.
    return undefined
  }
  return { taskId: task.id, at, phase: 'advance', key, kind: task.kind }
}
