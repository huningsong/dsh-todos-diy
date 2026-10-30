/**
 * Calendar search primitives: walk a rule forward or backward over local dates.
 *
 * Split out of `occurrence.ts` to keep each file small (NF5: ≤ 400 lines) and to
 * keep the "search" concern separate from the "task-level occurrence" concern.
 * Pure: no clock, no IO.
 */
import { cronTimes, parseCron } from './cron.js';
import { EMPTY_HOLIDAY_TABLE } from './holidays.js';
import { dateMatchesRule } from './occurrence.js';
import { addDays, formatLocalDate, localToInstant, parseLocalDate, startOfMonthOffset, zonedParts, } from './timezone.js';
/** How far a single search may walk before declaring "no match" (8 years). */
export const SEARCH_HORIZON_DAYS = 2_922;
/** Hard cap on occurrences collected for one task in one tick (F6.4 "最多 50 条"). */
export const MAX_OCCURRENCES_PER_TICK = 50;
/**
 * Local `YYYY-MM-DD` of an instant in a zone.
 * @param instant - Epoch milliseconds.
 * @param timeZone - IANA zone identifier.
 * @returns Local date key.
 */
export function localDayKey(instant, timeZone) {
    const parts = zonedParts(instant, timeZone);
    return formatLocalDate({ year: parts.year, month: parts.month, day: parts.day });
}
/**
 * All local times of day a rule fires at, ascending.
 *
 * For a `workdays` rule the times come from the canonical cron (`0 9 * * 1-5`
 * → 09:00); the holiday table replaces the *date* predicate, not the time.
 * @param spec - Parsed cron expression.
 * @returns Ascending `{hour, minute}` pairs.
 */
export function timesOfDay(spec) {
    return cronTimes(spec).sort((left, right) => left.hour === right.hour ? left.minute - right.minute : left.hour - right.hour);
}
/**
 * Whether the walk may skip the rest of a month because the rule has no
 * matching month entry. Skipped when `extraWorkdays` is non-empty: a manual date
 * may fall in a month the cron excludes.
 * @param spec - Parsed expression.
 * @param rule - Recurrence rule.
 * @returns True when the month-skip shortcut is safe.
 */
export function canSkipMonths(spec, rule) {
    return rule.extraWorkdays.length === 0 && rule.preset !== 'workdays' && !spec.months.includes(0);
}
/**
 * Whether one date/time combination resolves to an instant inside the bounds.
 * @param rule - Recurrence rule (supplies the zone).
 * @param date - Local date.
 * @param time - Local wall clock.
 * @returns Epoch milliseconds, or undefined inside a DST gap.
 */
function resolveInstant(rule, date, time) {
    return localToInstant({ year: date.year, month: date.month, day: date.day, hour: time.hour, minute: time.minute }, rule.timeZone);
}
/**
 * Enumerate the rule's occurrences in `(after, until]`, ascending, capped.
 * @param rule - Recurrence rule.
 * @param after - Exclusive lower bound.
 * @param until - Inclusive upper bound.
 * @param table - Holiday lookup table.
 * @param limit - Maximum entries to collect.
 * @returns Occurrences in ascending order.
 */
export function occurrencesBetween(rule, after, until, table = EMPTY_HOLIDAY_TABLE, limit = MAX_OCCURRENCES_PER_TICK) {
    const spec = parseCron(rule.cron);
    const times = timesOfDay(spec);
    const collected = [];
    const afterMs = after.getTime();
    const untilMs = until.getTime();
    if (untilMs < afterMs || times.length === 0)
        return collected;
    let date = parseLocalDate(localDayKey(afterMs, rule.timeZone));
    if (date === undefined)
        return collected;
    const skipMonths = canSkipMonths(spec, rule);
    for (let guard = 0; guard <= SEARCH_HORIZON_DAYS; guard += 1) {
        if (skipMonths && !spec.months.includes(date.month)) {
            date = startOfMonthOffset(date, 1);
            continue;
        }
        if (dateMatchesRule(spec, rule, date, table)) {
            for (const time of times) {
                const instant = resolveInstant(rule, date, time);
                if (instant === undefined)
                    continue; // DST gap: skip that occurrence (F2.7)
                if (instant <= afterMs)
                    continue;
                if (instant > untilMs)
                    return collected;
                collected.push(new Date(instant));
                if (collected.length >= limit)
                    return collected;
            }
        }
        date = addDays(date, 1);
    }
    return collected;
}
/**
 * First occurrence strictly after `after`.
 * @param rule - Recurrence rule.
 * @param after - Exclusive lower bound.
 * @param timeZone - Zone to evaluate in (defaults to `rule.timeZone`).
 * @param table - Holiday lookup table.
 * @returns The next firing instant, or null when the rule never matches.
 */
export function nextOccurrence(rule, after, timeZone = rule.timeZone, table = EMPTY_HOLIDAY_TABLE) {
    const effective = { ...rule, timeZone };
    const spec = parseCron(effective.cron);
    const times = timesOfDay(spec);
    if (times.length === 0)
        return null;
    let date = parseLocalDate(localDayKey(after.getTime(), timeZone));
    if (date === undefined)
        return null;
    const skipMonths = canSkipMonths(spec, effective);
    for (let guard = 0; guard <= SEARCH_HORIZON_DAYS; guard += 1) {
        if (skipMonths && !spec.months.includes(date.month)) {
            date = startOfMonthOffset(date, 1);
            continue;
        }
        if (dateMatchesRule(spec, effective, date, table)) {
            for (const time of times) {
                const instant = localToInstant({ year: date.year, month: date.month, day: date.day, hour: time.hour, minute: time.minute }, timeZone);
                if (instant === undefined)
                    continue;
                if (instant > after.getTime())
                    return new Date(instant);
            }
        }
        date = addDays(date, 1);
    }
    return null;
}
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
export function latestOccurrences(rule, after, until, table = EMPTY_HOLIDAY_TABLE) {
    const spec = parseCron(rule.cron);
    const times = timesOfDay(spec);
    if (times.length === 0)
        return [];
    const afterMs = after.getTime();
    const untilMs = until.getTime();
    if (untilMs <= afterMs)
        return [];
    let date = parseLocalDate(localDayKey(untilMs, rule.timeZone));
    if (date === undefined)
        return [];
    const skipMonths = canSkipMonths(spec, rule);
    for (let guard = 0; guard <= SEARCH_HORIZON_DAYS; guard += 1) {
        if (skipMonths && !spec.months.includes(date.month)) {
            // Jump to the last day of the previous month: the first of this month
            // minus one day. (Using +1 month here would land back on the same day
            // and stall the loop.)
            date = addDays(startOfMonthOffset(date, 0), -1);
            continue;
        }
        if (dateMatchesRule(spec, rule, date, table)) {
            const found = [];
            for (const time of times) {
                const instant = resolveInstant(rule, date, time);
                if (instant === undefined)
                    continue;
                if (instant <= afterMs || instant > untilMs)
                    continue;
                found.push(new Date(instant));
            }
            if (found.length > 0)
                return found;
        }
        date = addDays(date, -1);
    }
    return [];
}
