/**
 * Read-side helpers for the repository: list filtering, cursor pagination and
 * the derived counters the panel needs (F4.21).
 *
 * Kept pure and separate from the mutation code so each file stays inside the
 * NF5 budget.
 */
import { stageOf } from './rules/priority.js';
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
 * The next instant at which any visible task changes stage (F4.13).
 *
 * Considers every non-archived active/paused task and ignores the current view
 * and search: the panel must refresh even when the boundary belongs to a row
 * that is not on screen. Only instants **strictly after** `now` qualify.
 * @param tasks - Every task in the store.
 * @param options - `now` plus the recurring `nextAtFor` resolver.
 * @returns ISO instant, or null when nothing is scheduled.
 */
export function computeNextTransition(tasks, options) {
    const nowMs = options.now.getTime();
    let earliest = null;
    const consider = (value) => {
        if (value === null || Number.isNaN(value) || value <= nowMs)
            return;
        if (earliest === null || value < earliest)
            earliest = value;
    };
    for (const task of tasks) {
        // F4.13: only active/paused tasks contribute a boundary; a done or archived
        // task cannot change stage again.
        if (task.status === 'archived' || task.status === 'done')
            continue;
        if (task.kind === 'once' && task.once !== null) {
            consider(Date.parse(task.once.startAt));
            consider(Date.parse(task.once.endAt));
        }
        if (task.status === 'active' && task.kind === 'recurring') {
            const next = options.nextAtFor(task);
            consider(next === null ? null : next.getTime());
        }
    }
    return earliest === null ? null : new Date(earliest).toISOString();
}
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
export function queryTasks(allTasks, query, ctx) {
    const view = query.view ?? 'inProgress';
    const derive = { nextAtFor: ctx.nextAtFor };
    const includeArchived = query.includeArchived === true;
    const visible = allTasks.filter((task) => task.status !== 'archived');
    // Counts and the priority summary are computed over the *unfiltered* pool:
    // a search narrows the rows, never the tab badges.
    const countSource = selectView(visible, view, ctx.now, derive);
    const counts = countSource.counts;
    const prioritySummary = countSource.prioritySummary;
    const byKind = {
        once: visible.filter((task) => task.kind === 'once').length,
        recurring: visible.filter((task) => task.kind === 'recurring').length,
    };
    // F4.6 / F7.1: an explicit `status`/`kind` filter is a *flat* query — it must
    // not be intersected with the default stage view, otherwise
    // `status=paused` would always come back empty.
    const flat = query.status !== undefined || query.kind !== undefined;
    let pool = includeArchived ? allTasks : visible;
    if (query.status !== undefined)
        pool = pool.filter((task) => task.status === query.status);
    if (query.kind !== undefined)
        pool = pool.filter((task) => task.kind === query.kind);
    const needle = (query.query ?? '').trim().toLowerCase();
    if (needle !== '') {
        pool = pool.filter((task) => task.title.toLowerCase().includes(needle) || task.description.toLowerCase().includes(needle));
    }
    const viewResult = selectView(pool, view, ctx.now, derive);
    let items = flat ? sortTasksForView(pool, ctx.now, derive) : viewResult.items;
    if (includeArchived && !flat) {
        const archived = allTasks.filter((task) => task.status === 'archived');
        if (archived.length > 0)
            items = [...items, ...sortTasksForView(archived, ctx.now, derive)];
    }
    // A filtered view re-sorts by the same ordering so the page stays predictable.
    if (query.status !== undefined || query.kind !== undefined || needle !== '') {
        items = sortTasksForView(items, ctx.now, derive);
    }
    const limit = Math.min(200, Math.max(1, Math.trunc(query.limit ?? 50)));
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor);
    if (cursor !== null) {
        const pivot = items.findIndex((task) => task.createdAt === cursor.createdAt && task.id === cursor.id);
        items = pivot === -1 ? items : items.slice(pivot + 1);
    }
    const page = items.slice(0, limit);
    const nextCursor = items.length > limit && page.length === limit ? encodeCursor(page[page.length - 1]) : null;
    return {
        items: page,
        nextCursor,
        counts,
        prioritySummary,
        byKind,
        totalDone: ctx.totalDone + counts.done,
        serverTime: ctx.now.toISOString(),
        nextTransitionAt: computeNextTransition(allTasks, { now: ctx.now, nextAtFor: ctx.nextAtFor }),
    };
}
/**
 * Stage of one task, re-exported so routes do not need to import the rules
 * module directly for the common case.
 * @param task - Task to inspect.
 * @param now - Current instant.
 * @returns Derived stage.
 */
export function stageFor(task, now) {
    return stageOf(task, now);
}
