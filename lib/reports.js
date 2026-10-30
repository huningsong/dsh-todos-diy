/**
 * Weekly / monthly report aggregation (F11.1–F11.4).
 *
 * Pure functions only: the route feeds in tasks, archived tasks, completion
 * events and a clock, and gets back a `ReportData` value. Nothing here writes
 * to the store, and no LLM is involved — the report is a deterministic view.
 */
import { stageOf } from './rules/priority.js';
import { addDays, daysInMonth, formatLocalDate, isoWeekday, localToInstant, parseLocalDate } from './rules/timezone.js';
/**
 * First day of a month as a local date.
 * @param date - Any day in the month.
 * @returns The 1st.
 */
function firstOfMonth(date) {
    return { year: date.year, month: date.month, day: 1 };
}
/**
 * Advance a local date by whole months, landing on the 1st.
 * @param date - Start month.
 * @param months - Months to add.
 * @returns First day of the resulting month.
 */
function addMonthsFirst(date, months) {
    const total = date.year * 12 + (date.month - 1) + months;
    return { year: Math.floor(total / 12), month: (total % 12) + 1, day: 1 };
}
/**
 * Resolve a local midnight boundary, falling back to the first valid hour when
 * a DST spring-forward gap deletes 00:00 (e.g. America/Asuncion 2023-10-01).
 * @param date - Local date.
 * @param timeZone - IANA zone.
 * @returns Unix milliseconds of the boundary.
 */
function boundaryInstant(date, timeZone) {
    for (const hour of [0, 1, 2, 3]) {
        const ms = localToInstant({ ...date, hour, minute: 0 }, timeZone);
        if (ms !== undefined)
            return ms;
    }
    throw new Error('report period boundary does not exist in this time zone');
}
/**
 * Resolve the reporting window around an anchor day.
 * @param kind - `weekly` (Mon–Sun) or `monthly` (natural month).
 * @param anchor - `YYYY-MM-DD` in `timeZone`.
 * @param timeZone - IANA zone.
 * @returns Instants plus display dates.
 * @throws Error when the anchor is not a valid local date.
 */
export function periodOf(kind, anchor, timeZone) {
    const parsed = parseLocalDate(anchor);
    if (parsed === undefined)
        throw new Error(`invalid anchor date: ${anchor}`);
    const startDate = kind === 'weekly'
        ? addDays(parsed, -(isoWeekday(parsed) - 1))
        : firstOfMonth(parsed);
    const nextStartDate = kind === 'weekly' ? addDays(startDate, 7) : addMonthsFirst(startDate, 1);
    const nextEndDate = kind === 'weekly' ? addDays(nextStartDate, 7) : addMonthsFirst(nextStartDate, 1);
    const startMs = boundaryInstant(startDate, timeZone);
    const nextStartMs = boundaryInstant(nextStartDate, timeZone);
    const nextEndMs = boundaryInstant(nextEndDate, timeZone);
    const lastDay = kind === 'weekly'
        ? addDays(nextStartDate, -1)
        : { year: startDate.year, month: startDate.month, day: daysInMonth(startDate.year, startDate.month) };
    return {
        kind,
        start: new Date(startMs).toISOString(),
        end: new Date(nextStartMs - 1).toISOString(),
        nextStart: new Date(nextStartMs).toISOString(),
        nextEnd: new Date(nextEndMs - 1).toISOString(),
        localStart: formatLocalDate(startDate),
        localEnd: formatLocalDate(lastDay),
    };
}
/** Whether an ISO instant lies inside `[start, end]`. */
function within(iso, startMs, endMs) {
    if (iso === null || iso === undefined)
        return false;
    const at = Date.parse(iso);
    return !Number.isNaN(at) && at >= startMs && at <= endMs;
}
/** Round to a 0–1 rate with three decimals. */
function rate(completed, overdue) {
    const total = completed + overdue;
    if (total === 0)
        return null;
    return Math.round((completed / total) * 1000) / 1000;
}
/**
 * Build a report from already-loaded data.
 * @param input - Tasks, archive tasks, events and clock.
 * @returns The report value.
 */
export function buildReport(input) {
    const period = periodOf(input.kind, input.anchor, input.timeZone);
    const startMs = Date.parse(period.start);
    const endMs = Date.parse(period.end);
    const nextEndMs = Date.parse(period.nextEnd);
    const nowMs = input.now.getTime();
    // A task may exist in both the main file and a quarter file only during a
    // crash window; de-duplicate by id so reports never double-count it.
    const byId = new Map();
    for (const task of [...input.archived, ...input.tasks])
        byId.set(task.id, task);
    const all = [...byId.values()];
    const completed = [];
    for (const task of all) {
        if (task.kind !== 'once' || task.doneAt === null)
            continue;
        if (!within(task.doneAt, startMs, endMs))
            continue;
        completed.push({
            id: task.id,
            title: task.title,
            kind: 'once',
            count: 1,
            dueAt: task.once?.endAt ?? null,
            completedAt: task.doneAt,
            timeZone: task.once?.timeZone ?? input.timeZone,
        });
    }
    // B-01: events are the fallback for one-off tasks that no longer exist (purged
    // or imported history). A task's own doneAt wins when both are present.
    const completedIds = new Set(completed.map((item) => item.id));
    for (const event of input.events) {
        if (event.kind !== 'once')
            continue;
        if (!within(event.completedAt, startMs, endMs))
            continue;
        if (completedIds.has(event.taskId))
            continue;
        completed.push({
            id: event.taskId,
            title: event.taskTitle,
            kind: 'once',
            count: 1,
            dueAt: event.dueAt,
            completedAt: event.completedAt,
            timeZone: event.timeZone,
        });
        completedIds.add(event.taskId);
    }
    const recurring = new Map();
    for (const event of input.events) {
        if (event.kind !== 'recurring')
            continue;
        if (!within(event.completedAt, startMs, endMs))
            continue;
        const current = recurring.get(event.taskId);
        if (current === undefined) {
            recurring.set(event.taskId, {
                id: event.taskId,
                title: event.taskTitle,
                kind: 'recurring',
                count: 1,
                dueAt: event.dueAt,
                completedAt: event.completedAt,
                timeZone: event.timeZone,
            });
        }
        else {
            current.count = (current.count ?? 1) + 1;
            if (event.completedAt > (current.completedAt ?? ''))
                current.completedAt = event.completedAt;
        }
    }
    completed.push(...recurring.values());
    completed.sort((left, right) => (left.completedAt ?? '') < (right.completedAt ?? '') ? 1 : -1);
    const overdue = [];
    const inProgress = all.filter((task) => task.status === 'active' && stageOf(task, input.now) === 'inProgress').length;
    for (const task of all) {
        if (task.kind !== 'once' || task.status !== 'active' || task.once === null)
            continue;
        const dueMs = Date.parse(task.once.endAt);
        if (Number.isNaN(dueMs) || dueMs >= nowMs)
            continue;
        overdue.push({
            id: task.id,
            title: task.title,
            kind: 'once',
            dueAt: task.once.endAt,
            overdueDays: Math.max(0, Math.floor((nowMs - dueMs) / 86_400_000)),
            timeZone: task.once.timeZone,
        });
    }
    overdue.sort((left, right) => (left.dueAt ?? '') < (right.dueAt ?? '') ? -1 : 1);
    const created = [];
    for (const task of all) {
        if (task.status === 'archived')
            continue;
        if (!within(task.createdAt, startMs, endMs))
            continue;
        created.push({
            id: task.id,
            title: task.title,
            kind: task.kind,
            dueAt: task.kind === 'once' ? task.once?.endAt ?? null : null,
            timeZone: task.kind === 'once' ? task.once?.timeZone : task.rule?.timeZone,
        });
    }
    created.sort((left, right) => (left.id < right.id ? -1 : 1));
    const upcoming = [];
    for (const task of all) {
        if (task.status !== 'active')
            continue;
        const nextAt = task.kind === 'recurring' ? input.nextAtFor?.(task) ?? null : task.once?.endAt ?? null;
        if (nextAt === null)
            continue;
        const at = Date.parse(nextAt);
        if (Number.isNaN(at) || at < Date.parse(period.nextStart) || at > nextEndMs)
            continue;
        upcoming.push({
            id: task.id,
            title: task.title,
            kind: task.kind,
            nextAt,
            timeZone: task.kind === 'once' ? task.once?.timeZone : task.rule?.timeZone,
        });
    }
    upcoming.sort((left, right) => (left.nextAt ?? '') < (right.nextAt ?? '') ? -1 : 1);
    const completedCount = completed.reduce((sum, item) => sum + (item.count ?? 1), 0);
    const recurringActive = all.filter((task) => task.kind === 'recurring' && task.status === 'active').length;
    return {
        period: { kind: input.kind, start: period.start, end: period.end, timeZone: input.timeZone },
        completed,
        overdue,
        created,
        upcoming,
        stats: {
            completed: completedCount,
            overdue: overdue.length,
            inProgress,
            recurring: recurringActive,
            completionRate: rate(completedCount, overdue.length),
        },
        generatedAt: input.now.toISOString(),
    };
}
