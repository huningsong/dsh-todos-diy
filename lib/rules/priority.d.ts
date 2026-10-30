/**
 * Derived stage, priority, view selection and ordering (D-20/D-21/D-22/D-25,
 * F4.10–F4.14 / F4.21).
 *
 * Everything here is a pure function of `(tasks, now)` — or of a caller-supplied
 * `nextAtFor` resolver for recurring tasks. Neither `stage` nor `priority` is
 * ever persisted, so the file on disk can never disagree with the UI.
 *
 * Thresholds are half-open intervals on the exact millisecond remainder:
 *   overdue (remaining ≤ 0) or ≤ 24 h  → high
 *   (24 h, 72 h]                       → mid
 *   (72 h, 168 h]                      → low
 *   > 168 h, or no target              → none
 */
import type { Counts, Priority, PriorityKey, Task, TaskStage, TaskViewName, ViewResult } from './types.js';
/** Options shared by the derived readers. */
export interface DeriveOptions {
    /**
     * Resolve a recurring task's next fire instant. Injected so this module stays
     * free of calendar maths; when omitted, recurring tasks report no target.
     */
    nextAtFor?: (task: Task) => Date | null;
}
/**
 * Derive a task's stage (D-25 / F1.2).
 *
 * `startAt`/`endAt` are compared at **second** granularity: a task whose
 * `endAt` is 18:00:00 is still `inProgress` at 18:00:00.900 and becomes
 * `overdue` at 18:00:01.
 * @param task - Task to inspect.
 * @param now - Current instant.
 * @returns The derived stage; `archived` for soft-deleted tasks.
 */
export declare function stageOf(task: Task, now: Date): TaskStage;
/**
 * The moment a task's deadline happens (ms), or null when it has none.
 * @param task - Task to inspect.
 * @param options - Optional `nextAtFor` resolver for recurring tasks.
 * @returns Epoch milliseconds, or null.
 */
export declare function deadlineOf(task: Task, options?: DeriveOptions): number | null;
/**
 * Derive priority from an exact remaining time (D-20 / F4.12).
 * @param remainingMs - Milliseconds until the deadline; negative once overdue.
 * @returns Priority key plus the floored remaining minutes.
 */
export declare function derivePriorityFromRemaining(remainingMs: number): Priority;
/**
 * Priority for one task (F4.12).
 *
 * A paused task never participates and reports `paused` (D-22); a task with no
 * target reports `none`.
 * @param task - Task to inspect.
 * @param now - Current instant.
 * @param options - Optional `nextAtFor` resolver for recurring tasks.
 * @returns Derived priority.
 */
export declare function derivePriority(task: Task, now: Date, options?: DeriveOptions): Priority;
/**
 * Whole days a one-off task is overdue; null when it is not overdue.
 * @param task - Task to inspect.
 * @param now - Current instant.
 * @returns Days overdue, or null.
 */
export declare function daysOverdue(task: Task, now: Date): number | null;
/**
 * Whether a task belongs in the 已超期 view (D-22: paused is never overdue).
 * @param task - Task to inspect.
 * @param now - Current instant.
 * @returns True when the stage is `overdue`.
 */
export declare function isOverdue(task: Task, now: Date): boolean;
/**
 * Sort tasks for display: pinned → priority → deadline → title (F4.7 / F4.14).
 *
 * The input array is not mutated.
 * @param tasks - Tasks in any order.
 * @param now - Current instant.
 * @param options - Optional `nextAtFor` resolver for recurring tasks.
 * @returns New sorted array.
 */
export declare function sortTasksForView(tasks: readonly Task[], now: Date, options?: DeriveOptions): Task[];
/**
 * Compute the six mutually exclusive counts plus the priority summary (F4.21).
 * @param tasks - Every task in scope (archived ones are ignored).
 * @param now - Current instant.
 * @param options - Optional `nextAtFor` resolver.
 * @returns Counts and the priority summary.
 */
export declare function computeCounts(tasks: readonly Task[], now: Date, options?: DeriveOptions): {
    counts: Counts;
    prioritySummary: {
        high: number;
        mid: number;
        low: number;
        none: number;
    };
};
/**
 * Filter one view and compute the badges plus the priority summary.
 *
 * View contracts (F4.10 / D-22 / D-25):
 *  - the four stage views cover one-off tasks only;
 *  - `recurring` is `active && kind=recurring`, `paused` is its own bucket;
 *  - neither recurring nor paused ever appears in a stage view.
 * @param tasks - All tasks in scope (archived ones are ignored).
 * @param view - Which view to render.
 * @param now - Current instant.
 * @param options - Optional `nextAtFor` resolver.
 * @returns Items, counts and priority summary.
 */
export declare function selectView(tasks: readonly Task[], view: TaskViewName, now: Date, options?: DeriveOptions): ViewResult;
/**
 * Split a list into the groups the panel renders (F8.13 / F8.9).
 *
 * Pinned tasks form one group at the very top; the rest are grouped by derived
 * priority; paused tasks always form the last group (D-22).
 * @param tasks - View items, already sorted.
 * @param now - Current instant.
 * @param options - Optional `nextAtFor` resolver.
 * @returns Ordered groups; empty groups are omitted.
 */
export declare function groupTasks(tasks: readonly Task[], now: Date, options?: DeriveOptions): {
    key: 'pinned' | PriorityKey;
    tasks: Task[];
}[];
