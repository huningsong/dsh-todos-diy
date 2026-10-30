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
import type { Priority, PriorityKey, Task, TaskViewName, ViewResult } from './types.js';
/**
 * Derive priority from a due date and "today".
 *
 * `daysLeft ≤ 0` → high (today or overdue); `1–3` → mid; `4–7` → low;
 * `> 7` or no due date → none.
 * @param dueDate - Local `YYYY-MM-DD`, or null for "no deadline".
 * @param todayLocalDate - Today's local `YYYY-MM-DD` in the task's time zone.
 * @returns Priority key plus the day count (null when there is no due date).
 */
export declare function derivePriority(dueDate: string | null, todayLocalDate: string): Priority;
/**
 * Priority for one task, honouring D-22: a paused task never participates in
 * priority and reports `paused` instead.
 * @param task - Task to inspect.
 * @param todayLocalDate - Today's local date in the task's time zone.
 * @returns Derived priority.
 */
export declare function priorityOf(task: Task, todayLocalDate: string): Priority;
/**
 * Whether a task is overdue: `active` and its due date is before today.
 * Paused tasks are never overdue (D-22).
 * @param task - Task to inspect.
 * @param todayLocalDate - Today's local date in the task's time zone.
 * @returns True when the task should appear on the 超期 tab.
 */
export declare function isOverdue(task: Task, todayLocalDate: string): boolean;
/** Day counts for the badge and the "超期 N 天" marker. */
export declare function daysOverdue(task: Task, todayLocalDate: string): number | null;
/**
 * Sort tasks for display: pinned → priority → due date → title.
 *
 * The input array is not mutated.
 * @param tasks - Tasks in any order.
 * @param todayLocalDate - Today's local date in the relevant task time zone.
 * @returns New sorted array.
 */
export declare function sortTasksForView(tasks: readonly Task[], todayLocalDate: string): Task[];
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
export declare function selectView(tasks: readonly Task[], view: TaskViewName, todayLocalDate: string): ViewResult;
/**
 * Split the todo list into the groups the panel renders (F8.13/F8.9).
 *
 * Pinned tasks form one group at the very top; the rest are grouped by derived
 * priority; paused tasks always form the last group (D-22).
 * @param tasks - Todo-view items, already sorted.
 * @param todayLocalDate - Today's local date.
 * @returns Ordered groups; empty groups are omitted.
 */
export declare function groupTodoTasks(tasks: readonly Task[], todayLocalDate: string): {
    key: 'pinned' | PriorityKey;
    tasks: Task[];
}[];
