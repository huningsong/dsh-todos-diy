/**
 * Read-side helpers for the repository: list filtering, cursor pagination and
 * today-per-zone resolution. Kept pure and separate from the mutation code so
 * each file stays inside the NF5 budget.
 */
import { localDateKey } from './rules/timezone.js';
import { selectView, sortTasksForView } from './rules/priority.js';
/** Encode a list cursor (`createdAt|id`) as opaque base64url. */
export function encodeCursor(task) {
    return Buffer.from(`${task.createdAt}|${task.id}`).toString('base64url');
}
/**
 * Decode a list cursor.
 * @param cursor - Opaque token from a previous page.
 * @returns The pivot task identity, or null when malformed.
 */
export function decodeCursor(cursor) {
    try {
        const text = Buffer.from(cursor, 'base64url').toString('utf8');
        const at = text.indexOf('|');
        if (at === -1)
            return null;
        return { createdAt: text.slice(0, at), id: text.slice(at + 1) };
    }
    catch {
        return null;
    }
}
/**
 * Today's local date in the configured zone.
 * @param now - Current instant.
 * @param timeZone - Zone identifier.
 * @returns `YYYY-MM-DD`.
 */
export function todayKey(now, timeZone) {
    return localDateKey(now.getTime(), timeZone);
}
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
export function queryTasks(allTasks, query, today) {
    const view = query.view ?? 'todo';
    const includeArchived = query.includeArchived === true;
    let pool = allTasks.filter((task) => includeArchived || task.status !== 'archived');
    if (query.status !== undefined)
        pool = pool.filter((task) => task.status === query.status);
    if (query.kind !== undefined)
        pool = pool.filter((task) => task.kind === query.kind);
    const needle = (query.query ?? '').trim().toLowerCase();
    if (needle !== '') {
        pool = pool.filter((task) => task.title.toLowerCase().includes(needle) || task.description.toLowerCase().includes(needle));
    }
    const viewResult = selectView(pool, view, today);
    let items = viewResult.items;
    // `includeArchived` widens the pool, but `selectView` drops archived rows
    // because no view shows them. Append them explicitly so a debug/export caller
    // can actually see what it asked for.
    if (includeArchived) {
        const archived = pool.filter((task) => task.status === 'archived');
        if (archived.length > 0)
            items = [...items, ...sortTasksForView(archived, today)];
    }
    // A filtered view re-sorts by the same ordering so the page stays predictable.
    if (query.status !== undefined || query.kind !== undefined || needle !== '') {
        items = sortTasksForView(items, today);
    }
    const limit = Math.min(200, Math.max(1, Math.trunc(query.limit ?? 50)));
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor);
    if (cursor !== null) {
        const pivot = items.findIndex((task) => task.createdAt === cursor.createdAt && task.id === cursor.id);
        items = pivot === -1 ? items : items.slice(pivot + 1);
    }
    const page = items.slice(0, limit);
    const nextCursor = items.length > limit && page.length === limit ? encodeCursor(page[page.length - 1]) : null;
    return { items: page, nextCursor, counts: viewResult.counts, prioritySummary: viewResult.prioritySummary };
}
