/**
 * Derived priority, view selection and list ordering (D-20/D-21/D-22, F4.10–F4.14).
 *
 * Everything here is a pure function of `(tasks, todayLocalDate)`: priority is
 * never persisted, so nothing can drift between the file and the UI.
 *
 * Sorting contract — `pinned → priority → dueDate`, with no due date last and a
 * title tie-break:
 *  0. pinned first (超期任务仍留在置顶组，D-21);
 *  1. priority rank high → mid → low → none → paused;
 *  2. earliest due date first, null due date last;
 *  3. title, locale-independent (code-unit) so the order is stable.
 */
import { daysBetween, parseLocalDate } from './timezone.js';
/** Rank used for sorting; lower sorts first. `paused` sinks below `none`. */
const PRIORITY_RANK = {
    high: 0,
    mid: 1,
    low: 2,
    none: 3,
    paused: 4,
};
/**
 * Derive priority from a due date and "today".
 *
 * `daysLeft ≤ 0` → high (today or overdue); `1–3` → mid; `4–7` → low;
 * `> 7` or no due date → none.
 * @param dueDate - Local `YYYY-MM-DD`, or null for "no deadline".
 * @param todayLocalDate - Today's local `YYYY-MM-DD` in the task's time zone.
 * @returns Priority key plus the day count (null when there is no due date).
 */
export function derivePriority(dueDate, todayLocalDate) {
    if (dueDate === null)
        return { key: 'none', daysLeft: null };
    const due = parseLocalDate(dueDate);
    const today = parseLocalDate(todayLocalDate);
    if (due === undefined || today === undefined)
        return { key: 'none', daysLeft: null };
    const daysLeft = daysBetween(due, today);
    if (daysLeft <= 0)
        return { key: 'high', daysLeft };
    if (daysLeft <= 3)
        return { key: 'mid', daysLeft };
    if (daysLeft <= 7)
        return { key: 'low', daysLeft };
    return { key: 'none', daysLeft };
}
/**
 * Priority for one task, honouring D-22: a paused task never participates in
 * priority and reports `paused` instead.
 * @param task - Task to inspect.
 * @param todayLocalDate - Today's local date in the task's time zone.
 * @returns Derived priority.
 */
export function priorityOf(task, todayLocalDate) {
    if (task.status === 'paused') {
        const base = derivePriority(task.dueDate, todayLocalDate);
        return { key: 'paused', daysLeft: base.daysLeft };
    }
    return derivePriority(task.dueDate, todayLocalDate);
}
/**
 * Whether a task is overdue: `active` and its due date is before today.
 * Paused tasks are never overdue (D-22).
 * @param task - Task to inspect.
 * @param todayLocalDate - Today's local date in the task's time zone.
 * @returns True when the task should appear on the 超期 tab.
 */
export function isOverdue(task, todayLocalDate) {
    if (task.status !== 'active')
        return false;
    if (task.dueDate === null)
        return false;
    const due = parseLocalDate(task.dueDate);
    const today = parseLocalDate(todayLocalDate);
    if (due === undefined || today === undefined)
        return false;
    return daysBetween(due, today) < 0;
}
/** Day counts for the badge and the "超期 N 天" marker. */
export function daysOverdue(task, todayLocalDate) {
    if (!isOverdue(task, todayLocalDate) || task.dueDate === null)
        return null;
    const due = parseLocalDate(task.dueDate);
    const today = parseLocalDate(todayLocalDate);
    if (due === undefined || today === undefined)
        return null;
    return daysBetween(today, due);
}
/**
 * Sort tasks for display: pinned → priority → due date → title.
 *
 * The input array is not mutated.
 * @param tasks - Tasks in any order.
 * @param todayLocalDate - Today's local date in the relevant task time zone.
 * @returns New sorted array.
 */
export function sortTasksForView(tasks, todayLocalDate) {
    return [...tasks].sort((left, right) => {
        if (left.pinned !== right.pinned)
            return left.pinned ? -1 : 1;
        const leftRank = PRIORITY_RANK[priorityOf(left, todayLocalDate).key];
        const rightRank = PRIORITY_RANK[priorityOf(right, todayLocalDate).key];
        if (leftRank !== rightRank)
            return leftRank - rightRank;
        const leftDue = left.dueDate;
        const rightDue = right.dueDate;
        if (leftDue !== rightDue) {
            if (leftDue === null)
                return 1;
            if (rightDue === null)
                return -1;
            return leftDue < rightDue ? -1 : 1;
        }
        if (left.title !== right.title)
            return left.title < right.title ? -1 : 1;
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
}
/**
 * Filter one view and compute the three badges plus the priority summary.
 *
 * View contracts (F4.10 / D-22):
 *  - `todo`    = every unfinished task (`active` + `paused`), paused last;
 *  - `done`    = `status === 'done'`, newest `doneAt` first;
 *  - `overdue` = `active` **and** due before today; paused never appears.
 *
 * The todo badge counts only `active` tasks that are not overdue.
 * @param tasks - All tasks in scope (already excluding archived).
 * @param view - Which tab to render.
 * @param todayLocalDate - Today's local date.
 * @returns Items, counts and priority summary.
 */
export function selectView(tasks, view, todayLocalDate) {
    const active = tasks.filter((task) => task.status !== 'archived');
    const counts = {
        todo: active.filter((task) => task.status === 'active' && !isOverdue(task, todayLocalDate)).length,
        done: active.filter((task) => task.status === 'done').length,
        overdue: active.filter((task) => isOverdue(task, todayLocalDate)).length,
    };
    const prioritySummary = { high: 0, mid: 0, low: 0, none: 0 };
    for (const task of active) {
        if (task.status !== 'active')
            continue;
        prioritySummary[derivePriority(task.dueDate, todayLocalDate).key] += 1;
    }
    if (view === 'done') {
        const items = active
            .filter((task) => task.status === 'done')
            .sort((left, right) => {
            const leftAt = left.doneAt === null ? '' : left.doneAt;
            const rightAt = right.doneAt === null ? '' : right.doneAt;
            if (leftAt !== rightAt)
                return leftAt < rightAt ? 1 : -1;
            return left.id < right.id ? -1 : 1;
        });
        return { items, counts, prioritySummary };
    }
    if (view === 'overdue') {
        const items = sortTasksForView(active.filter((task) => isOverdue(task, todayLocalDate)), todayLocalDate);
        return { items, counts, prioritySummary };
    }
    const running = active.filter((task) => task.status === 'active');
    const paused = active.filter((task) => task.status === 'paused');
    const items = [...sortTasksForView(running, todayLocalDate), ...sortTasksForView(paused, todayLocalDate)];
    return { items, counts, prioritySummary };
}
/**
 * Split the todo list into the groups the panel renders (F8.13/F8.9).
 *
 * Pinned tasks form one group at the very top; the rest are grouped by derived
 * priority; paused tasks always form the last group (D-22).
 * @param tasks - Todo-view items, already sorted.
 * @param todayLocalDate - Today's local date.
 * @returns Ordered groups; empty groups are omitted.
 */
export function groupTodoTasks(tasks, todayLocalDate) {
    const pinned = [];
    const byPriority = {
        high: [],
        mid: [],
        low: [],
        none: [],
        paused: [],
    };
    for (const task of tasks) {
        if (task.status === 'paused') {
            byPriority.paused.push(task);
            continue;
        }
        if (task.pinned) {
            pinned.push(task);
            continue;
        }
        const key = derivePriority(task.dueDate, todayLocalDate).key;
        byPriority[key === 'paused' ? 'none' : key].push(task);
    }
    const groups = [];
    if (pinned.length > 0)
        groups.push({ key: 'pinned', tasks: pinned });
    for (const key of ['high', 'mid', 'low', 'none']) {
        if (byPriority[key].length > 0)
            groups.push({ key, tasks: byPriority[key] });
    }
    if (byPriority.paused.length > 0)
        groups.push({ key: 'paused', tasks: byPriority.paused });
    return groups;
}
