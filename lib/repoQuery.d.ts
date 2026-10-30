/**
 * Read-side helpers for the repository: list filtering, cursor pagination and
 * today-per-zone resolution. Kept pure and separate from the mutation code so
 * each file stays inside the NF5 budget.
 */
import type { Task } from './rules/types.js';
import type { ListQuery, ListResult } from './repoTypes.js';
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
 * Today's local date in the configured zone.
 * @param now - Current instant.
 * @param timeZone - Zone identifier.
 * @returns `YYYY-MM-DD`.
 */
export declare function todayKey(now: Date, timeZone: string): string;
/**
 * Apply one list query to the in-memory task set.
 *
 * Views come from `selectView` so the three tab badges always agree with the
 * rows. Text/status/kind filters narrow the view's items without changing the
 * badges — a search must not make the "已完成 4" badge read 0.
 * @param allTasks - Every task in the store.
 * @param query - Query parameters.
 * @param today - Today's local date.
 * @returns Page, cursor, counts and priority summary.
 */
export declare function queryTasks(allTasks: readonly Task[], query: ListQuery, today: string): ListResult;
