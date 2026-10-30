/**
 * `TaskView` projection (§7.4 / F1.1 / F4.10–F4.14 / F4.21).
 *
 * The API and the agent tools return this shape, never the raw stored task. It
 * adds the read-only derived fields (`stage`, `priority`, `fired`, `nextAt`,
 * `timeZone`, `utcOffset`, `overdueDays`, `overdue`) and drops nothing the UI
 * needs. Deriving on read is what makes stage/priority "只读、不落盘" true by
 * construction (D-25).
 */
import type { HolidayTable } from './rules/holidays.js';
import type { Priority, Task, TaskStage } from './rules/types.js';
/** The public projection of one task. */
export interface TaskView extends Omit<Task, 'state'> {
    /**
     * The rule with its preset-specific fields expanded (`time`, `weekdays`,
     * `monthDays`), so a TaskView can be fed straight back into
     * `POST /tasks/create` for a lossless round-trip (F1.1).
     */
    rule: (Task['rule'] & {
        time?: string;
        weekdays?: number[];
        monthDays?: number[];
    }) | null;
    /** Read-only derived stage (D-25). */
    stage: TaskStage;
    /** Derived priority; `paused` for a paused task (D-20/D-22). */
    priority: Priority;
    /** Read-only aggregate: `firedStart && firedEnd` (F3.4). */
    fired: boolean;
    /** IANA zone the task is evaluated in. */
    timeZone: string;
    /** `UTC±HH:MM` for the current instant, for the list row (F8.2). */
    utcOffset: string;
    /** Next fire instant (advance-shifted), ISO, or null. */
    nextAt: string | null;
    /** Whole days overdue; null when not overdue (D-22: paused is never overdue). */
    overdueDays: number | null;
    /** True when the task should show the red「超期」marker. */
    overdue: boolean;
    /** The persisted state block, exposed for the detail drawer. */
    state: Task['state'];
}
/** Options for {@link toTaskView}. */
export interface ViewOptions {
    /** Current instant, used for stage/priority/offset and `nextAt`. */
    now: Date;
    /** Holiday table for `workdays` next-occurrence maths. */
    holidays?: HolidayTable;
}
/**
 * Project one task.
 * @param task - Stored task.
 * @param options - Now and the holiday table.
 * @returns The public view.
 */
export declare function toTaskView(task: Task, options: ViewOptions): TaskView;
/**
 * The zone a task is evaluated in: the rule's zone for a recurring task, the
 * window's zone for a one-off task, else the global default.
 * @param task - Stored task.
 * @param fallback - Global default zone.
 * @returns IANA zone identifier.
 */
export declare function taskTimeZone(task: Task, fallback?: string): string;
/**
 * Project a list of tasks.
 * @param tasks - Stored tasks.
 * @param options - Shared projection options.
 * @returns Views in the same order.
 */
export declare function toTaskViews(tasks: readonly Task[], options: ViewOptions): TaskView[];
/**
 * Expand a stored canonical rule back into the preset-specific fields the
 * editor and the create API expect (F1.1 round-trip).
 * @param rule - Stored rule.
 * @returns Rule plus `time` / `weekdays` / `monthDays` as applicable.
 */
export declare function expandRule(rule: NonNullable<Task['rule']>): NonNullable<TaskView['rule']>;
