/**
 * Calendar search primitives: walk a rule forward or backward over local dates.
 *
 * Split out of `occurrence.ts` to keep each file small (NF5: ≤ 400 lines) and to
 * keep the "search" concern separate from the "task-level occurrence" concern.
 * Pure: no clock, no IO.
 */
import { type CronSpec } from './cron.js';
import { type HolidayTable } from './holidays.js';
import type { RecurrenceRule } from './types.js';
/** How far a single search may walk before declaring "no match" (8 years). */
export declare const SEARCH_HORIZON_DAYS = 2922;
/** Hard cap on occurrences collected for one task in one tick (F6.4 "最多 50 条"). */
export declare const MAX_OCCURRENCES_PER_TICK = 50;
/**
 * Local `YYYY-MM-DD` of an instant in a zone.
 * @param instant - Epoch milliseconds.
 * @param timeZone - IANA zone identifier.
 * @returns Local date key.
 */
export declare function localDayKey(instant: number, timeZone: string): string;
/**
 * All local times of day a rule fires at, ascending.
 *
 * For a `workdays` rule the times come from the canonical cron (`0 9 * * 1-5`
 * → 09:00); the holiday table replaces the *date* predicate, not the time.
 * @param spec - Parsed cron expression.
 * @returns Ascending `{hour, minute}` pairs.
 */
export declare function timesOfDay(spec: CronSpec): {
    hour: number;
    minute: number;
}[];
/**
 * Whether the walk may skip the rest of a month because the rule has no
 * matching month entry. Skipped when `extraWorkdays` is non-empty: a manual date
 * may fall in a month the cron excludes.
 * @param spec - Parsed expression.
 * @param rule - Recurrence rule.
 * @returns True when the month-skip shortcut is safe.
 */
export declare function canSkipMonths(spec: CronSpec, rule: RecurrenceRule): boolean;
/**
 * Enumerate the rule's occurrences in `(after, until]`, ascending, capped.
 * @param rule - Recurrence rule.
 * @param after - Exclusive lower bound.
 * @param until - Inclusive upper bound.
 * @param table - Holiday lookup table.
 * @param limit - Maximum entries to collect.
 * @returns Occurrences in ascending order.
 */
export declare function occurrencesBetween(rule: RecurrenceRule, after: Date, until: Date, table?: HolidayTable, limit?: number): Date[];
/**
 * First occurrence strictly after `after`.
 * @param rule - Recurrence rule.
 * @param after - Exclusive lower bound.
 * @param timeZone - Zone to evaluate in (defaults to `rule.timeZone`).
 * @param table - Holiday lookup table.
 * @returns The next firing instant, or null when the rule never matches.
 */
export declare function nextOccurrence(rule: RecurrenceRule, after: Date, timeZone?: string, table?: HolidayTable): Date | null;
/**
 * The most recent occurrences at or before `until`, searching backwards.
 *
 * The forward walk cannot answer "latest" cheaply: after a long downtime the
 * latest due occurrence is far past the first one. This walks back at most
 * {@link SEARCH_HORIZON_DAYS} days and stops at the first day with a match.
 * @param rule - Recurrence rule.
 * @param after - Exclusive lower bound.
 * @param until - Inclusive upper bound.
 * @param table - Holiday lookup table.
 * @returns Occurrences on the last matching day, ascending (several when the
 *          rule fires more than once a day).
 */
export declare function latestOccurrences(rule: RecurrenceRule, after: Date, until: Date, table?: HolidayTable): Date[];
