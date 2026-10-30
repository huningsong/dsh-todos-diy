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
import { CronError, parseCron } from './cron.js';
import { EMPTY_HOLIDAY_TABLE, workdayPredicate } from './holidays.js';
import { MAX_OCCURRENCES_PER_TICK, latestOccurrences, nextOccurrence, occurrencesBetween, } from './search.js';
import { daysInMonth, formatLocalDate, isoWeekday } from './timezone.js';
export { MAX_OCCURRENCES_PER_TICK, latestOccurrences, nextOccurrence, occurrencesBetween };
/**
 * Build the globally unique de-duplication key (F1.4).
 * @param taskId - Owning task id.
 * @param at - The UTC instant the reminder fires at.
 * @param phase - `start` / `end` / `advance`, or omitted for a plain occurrence.
 * @returns `taskId@<ISO>Z` with an optional `#phase` suffix.
 */
export function occurrenceKey(taskId, at, phase) {
    const suffix = phase === undefined || phase === null ? '' : `#${phase}`;
    return `${taskId}@${at.toISOString()}${suffix}`;
}
/**
 * Whether a local date is excluded by the rule's `skipDates`.
 * @param rule - Recurrence rule.
 * @param localDate - `YYYY-MM-DD` in the rule's time zone.
 * @returns True when the user skipped that day.
 */
export function isSkippedDate(rule, localDate) {
    return rule.skipDates.includes(localDate);
}
/**
 * Whether a local date is forced on by the rule's `extraWorkdays`.
 * @param rule - Recurrence rule.
 * @param localDate - `YYYY-MM-DD` in the rule's time zone.
 * @returns True when the user added that day manually.
 */
export function isExtraWorkday(rule, localDate) {
    return rule.extraWorkdays.includes(localDate);
}
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
export function dateMatchesRule(spec, rule, date, table) {
    const key = formatLocalDate(date);
    if (isSkippedDate(rule, key))
        return false;
    if (isExtraWorkday(rule, key))
        return true;
    if (rule.preset === 'workdays') {
        return workdayPredicate(table, rule.holidayCalendar)(key);
    }
    if (!spec.months.includes(date.month))
        return false;
    const lastDay = daysInMonth(date.year, date.month);
    const overflowToLastDay = rule.preset === 'monthly' &&
        rule.monthlyOverflow === 'lastDay' &&
        date.day === lastDay &&
        spec.daysOfMonth.some((day) => day > lastDay);
    const dayOfMonthMatch = spec.daysOfMonth.includes(date.day) || overflowToLastDay;
    const cronWeekday = isoWeekday(date) % 7;
    const dayOfWeekMatch = spec.daysOfWeek.includes(cronWeekday);
    if (!spec.dayOfMonthStar && !spec.dayOfWeekStar)
        return dayOfMonthMatch || dayOfWeekMatch;
    return dayOfMonthMatch && dayOfWeekMatch;
}
/**
 * Whether a task's advance lead time applies to one node.
 *
 * F5.7 (v1): only the `#end` node of a **one-off** task honours
 * `advanceMinutes`. A recurring task's occurrence is already time-boxed by
 * `rule.time`; giving it a lead would silently move the whole schedule, so the
 * recurring path deliberately ignores the field.
 * @param task - Owning task.
 * @param node - Node being scheduled.
 * @returns True when the advance shift must be applied.
 */
function advanceApplies(task, node) {
    return task.kind === 'once' && node === 'end' && task.notify.advanceMinutes > 0;
}
/**
 * Apply `notify.advanceMinutes` to one natural occurrence.
 *
 * The advance reminder *replaces* the on-time reminder (F5.7), so the returned
 * occurrence carries `phase: 'advance'` and a key built from the shifted
 * instant. Nodes that do not take a lead time keep their natural instant.
 * @param task - Owning task.
 * @param naturalAt - The on-time instant.
 * @param node - Which one-off node the natural instant belongs to (`null` for recurring).
 * @returns The occurrence that should actually fire.
 */
export function applyAdvance(task, naturalAt, node) {
    if (!advanceApplies(task, node)) {
        return {
            taskId: task.id,
            at: naturalAt,
            phase: node === null ? null : node,
            key: occurrenceKey(task.id, naturalAt, node),
            kind: task.kind,
            node,
        };
    }
    const advance = Math.max(0, Math.min(1440, Math.trunc(task.notify.advanceMinutes)));
    const shifted = new Date(naturalAt.getTime() - advance * 60_000);
    return {
        taskId: task.id,
        at: shifted,
        phase: 'advance',
        key: occurrenceKey(task.id, shifted, 'advance'),
        kind: task.kind,
        node,
    };
}
/**
 * The nodes a one-off task actually schedules (F3.3 / D-03 / D-25).
 *
 * - `startAtSource="created"` → only `#end` (a task that already started has
 *   nothing to announce);
 * - explicit `startAt` → `#start` plus `#end`, unless `notify.endReminder` is
 *   false (meeting-style tasks), in which case only `#start`.
 * @param task - One-off task.
 * @returns Scheduled nodes, in display order.
 */
export function scheduledNodes(task) {
    const window = task.once;
    if (window === null)
        return [];
    if (window.startAtSource === 'created')
        return ['end'];
    return task.notify.endReminder === false ? ['start'] : ['start', 'end'];
}
/**
 * One-off occurrences, already advance-shifted where applicable.
 * Missing/fired nodes are filtered by the caller.
 * @param task - One-off task.
 * @returns Scheduled occurrences (never null for a valid task).
 */
export function onceOccurrences(task) {
    const window = task.once;
    if (window === null)
        return [];
    const start = new Date(window.startAt);
    const end = new Date(window.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
        return [];
    const nodes = scheduledNodes(task);
    return nodes.map((node) => applyAdvance(task, node === 'start' ? start : end, node));
}
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
export function dueOccurrences(task, now, lastFiredAt, table = EMPTY_HOLIDAY_TABLE) {
    if (task.kind === 'once') {
        if (task.once === null)
            return [];
        const result = [];
        const nowMs = now.getTime();
        for (const occurrence of onceOccurrences(task)) {
            // A node is settled once it was delivered on time, delivered as an
            // advance reminder, or recorded missed (F3.4 / F5.7 / F6.4).
            if (occurrence.node === 'start' && (task.state.firedStart || task.state.firedStartAdvance || task.state.missedStart))
                continue;
            if (occurrence.node === 'end' && (task.state.firedEnd || task.state.firedEndAdvance || task.state.missedEnd))
                continue;
            if (task.state.lastOccurrenceKey === occurrence.key)
                continue;
            if (occurrence.at.getTime() <= nowMs)
                result.push(occurrence);
        }
        return result;
    }
    if (task.rule === null)
        return [];
    // Both ends of the search must be expressed in *natural* time, because a
    // fired `lastFiredAt` records the shifted (advance) instant: the 09:00
    // occurrence whose reminder fired at 08:50 has a natural time 10 minutes
    // later, so a floor of 08:50 would still include it and re-fire.
    const advanceMs = 0; // recurring tasks never take an advance lead (F5.7 v1)
    const anchor = lastFiredAt ?? new Date(task.createdAt);
    if (Number.isNaN(anchor.getTime()))
        return [];
    // Everything is compared in *natural* time. `lastFiredAt` stores the shifted
    // instant, so it is moved back by the advance offset first; a candidate is
    // only eligible when its natural time is strictly after that floor.
    const naturalFloor = anchor.getTime() - advanceMs;
    const searchUntil = new Date(now.getTime() + advanceMs);
    const natural = latestOccurrences(task.rule, new Date(naturalFloor), searchUntil, table);
    for (let index = natural.length - 1; index >= 0; index -= 1) {
        const candidate = natural[index];
        if (candidate.getTime() <= naturalFloor)
            continue;
        const occurrence = applyAdvance(task, candidate, null);
        // The key is authoritative: a re-tick after the advance already fired must
        // not fire the same occurrence again, even though its natural instant is
        // still in the past.
        if (task.state.lastOccurrenceKey === occurrence.key)
            continue;
        if (occurrence.at.getTime() <= now.getTime())
            return [occurrence];
    }
    return [];
}
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
export function missedOccurrences(task, naturalBefore, naturalLastFired, limit = MAX_OCCURRENCES_PER_TICK, table = EMPTY_HOLIDAY_TABLE) {
    if (task.kind !== 'recurring' || task.rule === null)
        return [];
    const floor = naturalLastFired ?? new Date(task.createdAt);
    if (Number.isNaN(floor.getTime()))
        return [];
    const floorMs = floor.getTime();
    const beforeMs = naturalBefore.getTime();
    // `occurrencesBetween` takes an exclusive lower bound, which is exactly the
    // watermark semantics we need: a record at `floor` is already accounted for.
    const natural = occurrencesBetween(task.rule, floor, naturalBefore, table, limit + 1);
    const earlier = natural
        .filter((instant) => instant.getTime() > floorMs && instant.getTime() < beforeMs)
        .slice(-limit);
    return earlier.map((instant) => applyAdvance(task, instant, null));
}
/**
 * Next instant this task will fire at (already advance-shifted), strictly
 * after `after`. Recurring only; one-off tasks report their remaining nodes.
 * @param task - Task.
 * @param after - Exclusive lower bound.
 * @param table - Holiday lookup table.
 * @returns Next fire instant, or null.
 */
export function nextFireAt(task, after, table = EMPTY_HOLIDAY_TABLE) {
    if (task.kind === 'once') {
        const candidates = [];
        for (const occurrence of onceOccurrences(task)) {
            if (occurrence.node === 'start' && task.state.firedStart)
                continue;
            if (occurrence.node === 'end' && task.state.firedEnd)
                continue;
            if (occurrence.at.getTime() > after.getTime())
                candidates.push(occurrence.at);
        }
        if (candidates.length === 0)
            return null;
        return new Date(Math.min(...candidates.map((date) => date.getTime())));
    }
    if (task.rule === null)
        return null;
    const natural = nextOccurrence(task.rule, after, task.rule.timeZone, table);
    if (natural === null)
        return null;
    return applyAdvance(task, natural, null).at;
}
/**
 * Earliest `nextFireAt` across many tasks (used for `health.nextWakeAt`).
 * @param tasks - Tasks to inspect; non-active ones are skipped.
 * @param now - Lower bound.
 * @param table - Holiday lookup table.
 * @returns Earliest next fire instant, or null when nothing is scheduled.
 */
export function nextWakeAt(tasks, now, table = EMPTY_HOLIDAY_TABLE) {
    let earliest = null;
    for (const task of tasks) {
        if (task.status !== 'active')
            continue;
        const next = nextFireAt(task, now, table);
        if (next === null)
            continue;
        if (earliest === null || next.getTime() < earliest)
            earliest = next.getTime();
    }
    return earliest === null ? null : new Date(earliest);
}
/**
 * Validate that a cron expression is usable as a rule and report why not.
 * @param expression - Candidate expression.
 * @returns `null` when valid, otherwise the `CronError`.
 */
export function cronError(expression) {
    try {
        parseCron(expression);
        return null;
    }
    catch (error) {
        return error instanceof CronError ? error : new CronError(String(error), 'expression');
    }
}
