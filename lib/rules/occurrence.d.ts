/**
 * Occurrence resolution: which instants a task should fire at.
 *
 * Pure module. No clock, no IO: `now` and `after` are always arguments. The
 * instant ⇄ wall-clock conversion comes from `timezone.ts`, the cron dialect
 * from `cron.ts`, and the holiday data is injected as a plain lookup table.
 *
 * Two rules govern every function here:
 *  1. `nextOccurrence` is **strictly later than** `after`, so a boundary tick
 *     can never re-fire the occurrence it just handled.
 *  2. `occurrenceKey` is derived from the UTC instant, so changing a task's
 *     time zone later never rewrites a historical key (F1.4).
 */
import { CronError, type CronSpec } from './cron.js';
import { type HolidayTable } from './holidays.js';
import { MAX_OCCURRENCES_PER_TICK, latestOccurrences, nextOccurrence, occurrencesBetween } from './search.js';
import type { Occurrence, Phase, RecurrenceRule, Task } from './types.js';
import { type LocalDate } from './timezone.js';
export { MAX_OCCURRENCES_PER_TICK, latestOccurrences, nextOccurrence, occurrencesBetween };
/**
 * Build the globally unique de-duplication key (F1.4).
 * @param taskId - Owning task id.
 * @param at - The UTC instant the reminder fires at.
 * @param phase - `start` / `end` / `advance`, or omitted for a plain occurrence.
 * @returns `taskId@<ISO>Z` with an optional `#phase` suffix.
 */
export declare function occurrenceKey(taskId: string, at: Date, phase?: Phase | null): string;
/**
 * Whether a local date is excluded by the rule's `skipDates`.
 * @param rule - Recurrence rule.
 * @param localDate - `YYYY-MM-DD` in the rule's time zone.
 * @returns True when the user skipped that day.
 */
export declare function isSkippedDate(rule: RecurrenceRule, localDate: string): boolean;
/**
 * Whether a local date is forced on by the rule's `extraWorkdays`.
 * @param rule - Recurrence rule.
 * @param localDate - `YYYY-MM-DD` in the rule's time zone.
 * @returns True when the user added that day manually.
 */
export declare function isExtraWorkday(rule: RecurrenceRule, localDate: string): boolean;
/**
 * Whether a calendar date matches the rule's *date* predicate, ignoring the
 * time of day. `skipDates` wins over everything; `extraWorkdays` wins over the
 * preset and over the built-in holiday table (F2.5).
 * @param spec - Parsed cron expression.
 * @param rule - Recurrence rule (preset, overflow policy, exception dates).
 * @param date - Local calendar date.
 * @param table - Holiday lookup table.
 * @returns True when an occurrence may start on that date.
 */
export declare function dateMatchesRule(spec: CronSpec, rule: RecurrenceRule, date: LocalDate, table: HolidayTable): boolean;
/**
 * Apply `notify.advanceMinutes` to one natural occurrence.
 *
 * The advance reminder *replaces* the on-time reminder (UX-06), so the
 * returned occurrence carries `phase: 'advance'` and a key built from the
 * shifted instant.
 * @param task - Owning task.
 * @param naturalAt - The on-time instant.
 * @param node - Which one-off node the natural instant belongs to (`null` for recurring).
 * @returns The occurrence that should actually fire.
 */
export declare function applyAdvance(task: Task, naturalAt: Date, node: 'start' | 'end' | null): Occurrence;
/**
 * One-off occurrences: the start node and the end node, each shifted by the
 * task's advance setting. Missing/fired nodes are filtered by the caller.
 * @param task - One-off task.
 * @returns Start occurrence first, then end (never null for a valid task).
 */
export declare function onceOccurrences(task: Task): Occurrence[];
/**
 * Occurrences due in `(lastFiredAt, now]` for one task.
 *
 * §7.5 semantics:
 *  - recurring: **at most one** entry — the latest due occurrence. Everything
 *    earlier is a missed backlog and must be counted with
 *    {@link missedOccurrences}, never delivered;
 *  - one-off: the un-fired start and/or end node (each is independently
 *    delivered per D-03), ascending.
 * @param task - Task being evaluated.
 * @param now - Current instant supplied by the caller.
 * @param lastFiredAt - Last fired instant, or null before the first fire.
 * @param table - Holiday lookup table; **must** be the same table `resolveTick`
 *                uses, otherwise a workdays rule fires on a public holiday.
 * @returns Due occurrences, ascending, at most one for a recurring task.
 */
export declare function dueOccurrences(task: Task, now: Date, lastFiredAt: Date | null, table?: HolidayTable): Occurrence[];
/**
 * Recurring backlog in **natural** time.
 *
 * Both bounds are natural (unshifted) instants; the caller converts any
 * advance-shifted `lastFiredAt` / target back before calling. The returned
 * occurrences are advance-shifted, ready for delivery bookkeeping.
 * @param task - Recurring task.
 * @param naturalBefore - Exclusive upper bound in natural time.
 * @param naturalLastFired - Last fired instant in natural time, or null.
 * @param limit - Maximum entries to return (newest kept).
 * @param table - Holiday lookup table.
 * @returns Missed occurrences (advance-shifted), ascending.
 */
export declare function missedOccurrences(task: Task, naturalBefore: Date, naturalLastFired: Date | null, limit?: number, table?: HolidayTable): Occurrence[];
/**
 * Next instant this task will fire at (already advance-shifted), strictly
 * after `after`. Recurring only; one-off tasks report their remaining nodes.
 * @param task - Task.
 * @param after - Exclusive lower bound.
 * @param table - Holiday lookup table.
 * @returns Next fire instant, or null.
 */
export declare function nextFireAt(task: Task, after: Date, table?: HolidayTable): Date | null;
/**
 * Earliest `nextFireAt` across many tasks (used for `health.nextWakeAt`).
 * @param tasks - Tasks to inspect; non-active ones are skipped.
 * @param now - Lower bound.
 * @param table - Holiday lookup table.
 * @returns Earliest next fire instant, or null when nothing is scheduled.
 */
export declare function nextWakeAt(tasks: readonly Task[], now: Date, table?: HolidayTable): Date | null;
/**
 * Validate that a cron expression is usable as a rule and report why not.
 * @param expression - Candidate expression.
 * @returns `null` when valid, otherwise the `CronError`.
 */
export declare function cronError(expression: string): CronError | null;
