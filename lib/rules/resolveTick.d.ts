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
import type { HolidayTable } from './holidays.js';
import type { Occurrence, Task, TickPlan } from './types.js';
/** Options accepted by {@link resolveTick}. */
export interface ResolveTickOptions {
    /** Grace window in minutes; `0` means "strictly on time or missed" (D-06). */
    graceMinutes?: number;
    /** Holiday lookup table used by `workdays` rules. */
    holidays?: HolidayTable;
    /** Hard cap on `markMissed` entries per task (F6.4: "最多记录最近 50 条"). */
    missedLimit?: number;
}
/** Default grace window, matching `settings.graceMinutes` (D-06). */
export declare const DEFAULT_GRACE_MINUTES = 5;
/**
 * Whether one occurrence is still inside the grace window.
 * @param occurrence - Candidate occurrence.
 * @param now - Tick instant.
 * @param graceMinutes - Grace window in minutes.
 * @returns True when it should fire rather than be marked missed.
 */
export declare function withinGrace(occurrence: Occurrence, now: Date, graceMinutes: number): boolean;
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
export declare function resolveTick(tasks: readonly Task[], now: Date, options?: ResolveTickOptions): TickPlan;
