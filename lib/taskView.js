/**
 * `TaskView` projection (§7.4 / F1.1 / F4.10–F4.14 / F4.21).
 *
 * The API and the agent tools return this shape, never the raw stored task. It
 * adds the read-only derived fields (`stage`, `priority`, `fired`, `nextAt`,
 * `timeZone`, `utcOffset`, `overdueDays`, `overdue`) and drops nothing the UI
 * needs. Deriving on read is what makes stage/priority "只读、不落盘" true by
 * construction (D-25).
 */
import { nextFireAt } from './rules/occurrence.js';
import { daysOverdue, derivePriority, isOverdue, stageOf } from './rules/priority.js';
import { formatUtcOffset } from './rules/timezone.js';
/**
 * Project one task.
 * @param task - Stored task.
 * @param options - Now and the holiday table.
 * @returns The public view.
 */
export function toTaskView(task, options) {
    const timeZone = taskTimeZone(task);
    const next = task.status === 'active' ? nextFireAt(task, options.now, options.holidays) : null;
    const nextAtFor = (candidate) => candidate.status === 'active' ? nextFireAt(candidate, options.now, options.holidays) : null;
    return {
        ...task,
        rule: task.rule === null ? null : expandRule(task.rule),
        stage: stageOf(task, options.now),
        priority: derivePriority(task, options.now, { nextAtFor }),
        // F3.4: `fired` is exactly the two node flags; an advance reminder marks the
        // node as settled because it replaces the on-time reminder (F5.7).
        fired: task.kind === 'once'
            ? (task.state.firedStart || task.state.firedStartAdvance) &&
                (task.state.firedEnd || task.state.firedEndAdvance)
            : false,
        timeZone,
        utcOffset: formatUtcOffset(options.now.getTime(), timeZone),
        nextAt: next === null ? null : next.toISOString(),
        overdueDays: daysOverdue(task, options.now),
        overdue: isOverdue(task, options.now),
        state: task.state,
    };
}
/**
 * The zone a task is evaluated in: the rule's zone for a recurring task, the
 * window's zone for a one-off task, else the global default.
 * @param task - Stored task.
 * @param fallback - Global default zone.
 * @returns IANA zone identifier.
 */
export function taskTimeZone(task, fallback = 'Asia/Shanghai') {
    return task.rule?.timeZone ?? task.once?.timeZone ?? fallback;
}
/**
 * Project a list of tasks.
 * @param tasks - Stored tasks.
 * @param options - Shared projection options.
 * @returns Views in the same order.
 */
export function toTaskViews(tasks, options) {
    return tasks.map((task) => toTaskView(task, options));
}
/**
 * Expand a stored canonical rule back into the preset-specific fields the
 * editor and the create API expect (F1.1 round-trip).
 * @param rule - Stored rule.
 * @returns Rule plus `time` / `weekdays` / `monthDays` as applicable.
 */
export function expandRule(rule) {
    const fields = rule.cron.split(/\s+/);
    const minute = Number(fields[0] ?? '0');
    const hour = Number(fields[1] ?? '0');
    const pad = (value) => String(value).padStart(2, '0');
    const expanded = { ...rule };
    if (rule.preset === 'custom')
        return expanded;
    expanded.time = `${pad(Number.isFinite(hour) ? hour : 0)}:${pad(Number.isFinite(minute) ? minute : 0)}`;
    if (rule.preset === 'weekly') {
        expanded.weekdays = (fields[4] ?? '1')
            .split(',')
            .map((token) => Number(token))
            .filter((value) => Number.isInteger(value) && value >= 0 && value <= 7)
            .map((value) => (value === 0 ? 7 : value));
    }
    if (rule.preset === 'monthly') {
        expanded.monthDays = (fields[2] ?? '1')
            .split(',')
            .map((token) => Number(token))
            .filter((value) => Number.isInteger(value) && value >= 1 && value <= 31);
    }
    return expanded;
}
