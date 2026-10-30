/**
 * Read-side helpers for the repository: list filtering, cursor pagination and
 * the derived counters the panel needs (F4.21).
 *
 * Kept pure and separate from the mutation code so each file stays inside the
 * NF5 budget.
 */
import { stageOf } from './rules/priority.js';
import type { Task } from './rules/types.js';
import type { ListQuery, ListResult } from './repoTypes.js';
/** Everything the read path needs from the caller (clock + calendar). */
export interface QueryContext {
    /** The single `now` every derived value is computed against. */
    now: Date;
    /** Resolver for a recurring task's next fire instant. */
    nextAtFor: (task: Task) => Date | null;
    /** Main-file done + archived quarters, de-duplicated (F4.21). */
    totalDone: number;
    /** F4.21: `done` counts only completions in the current quarter. */
    doneInCurrentQuarter?: (task: Task) => boolean;
}
/** Encode a list cursor (`createdAt|id`) as opaque base64url. */
export declare function encodeCursor(task: Task): string;
/**
 * Decode a list cursor.
 * @param cursor - Opaque token from a previous page.
 * @returns The pivot task identity, or null when malformed.
 */
export declare function decodeCursor(cursor: string): {
    createdAt: string;
    id: string;
} | null;
/**
 * The next instant at which any visible task changes stage (F4.13).
 *
 * Considers every non-archived active/paused task and ignores the current view
 * and search: the panel must refresh even when the boundary belongs to a row
 * that is not on screen. Only instants **strictly after** `now` qualify.
 * @param tasks - Every task in the store.
 * @param options - `now` plus the recurring `nextAtFor` resolver.
 * @returns ISO instant, or null when nothing is scheduled.
 */
export declare function computeNextTransition(tasks: readonly Task[], options: {
    now: Date;
    nextAtFor: (task: Task) => Date | null;
}): string | null;
/**
 * Apply one list query to the in-memory task set.
 *
 * Counts come from `computeCounts`, so the six badges always describe the whole
 * dataset — a search must never make the "进行中 2" badge read 0 (F4.21).
 * @param allTasks - Every task in the store.
 * @param query - Query parameters.
 * @param ctx - Clock, next-at resolver and the archived done total.
 * @returns Page, cursor, counts, priority summary and the refresh boundary.
 */
export declare function queryTasks(allTasks: readonly Task[], query: ListQuery, ctx: QueryContext): ListResult;
/**
 * Stage of one task, re-exported so routes do not need to import the rules
 * module directly for the common case.
 * @param task - Task to inspect.
 * @param now - Current instant.
 * @returns Derived stage.
 */
export declare function stageFor(task: Task, now: Date): ReturnType<typeof stageOf>;
