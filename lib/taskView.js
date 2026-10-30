/**
 * `TaskView` projection (§7.4 / F4.10–F4.14).
 *
 * The API and the agent tools return this shape, never the raw stored task. It
 * adds the read-only derived fields (`priority`, `fired`, `nextAt`, `timeZone`,
 * `utcOffset`, `overdueDays`) and drops nothing the UI needs. Deriving on read
 * is what makes priority "只读、不落盘" true by construction.
 */
import { nextFireAt } from './rules/occurrence.js';
import { daysOverdue, isOverdue, priorityOf } from './rules/priority.js';
import { formatUtcOffset } from './rules/timezone.js';
/**
 * Project one task.
 * @param task - Stored task.
 * @param options - Today, now and the holiday table.
 * @returns The public view.
 */
export function toTaskView(task, options) {
    const timeZone = taskTimeZone(task);
    const priority = priorityOf(task, options.today);
    const next = task.status === 'active' ? nextFireAt(task, options.now, options.holidays) : null;
    const overdueDays = daysOverdue(task, options.today);
    return {
        ...task,
        priority,
        fired: task.kind === 'once' ? task.state.firedStart && task.state.firedEnd : false,
        timeZone,
        utcOffset: formatUtcOffset(options.now.getTime(), timeZone),
        nextAt: next === null ? null : next.toISOString(),
        overdueDays,
        overdue: isOverdue(task, options.today),
        state: task.state,
    };
}
/**
 * The zone a task is evaluated in: the rule's zone for a recurring task, else
 * the global default.
 * @param task - Stored task.
 * @param fallback - Global default zone.
 * @returns IANA zone identifier.
 */
export function taskTimeZone(task, fallback = 'Asia/Shanghai') {
    return task.rule?.timeZone ?? fallback;
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
