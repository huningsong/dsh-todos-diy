/**
 * `GET /reports` — read-only weekly/monthly report (F11.3).
 *
 * The handler loads the main document plus archive quarters, then delegates to
 * the pure `buildReport`. It never calls `touch()`, so asking for a report can
 * never change `tasks.json`.
 */
import { route } from './http.js';
import { ok, queryValue } from './routeKit.js';
import { ValidationError } from './validationError.js';
import { buildReport, periodOf } from './reports.js';
import { nextFireAt } from './rules/occurrence.js';
import { localDateKey } from './rules/timezone.js';
import { nodeArchiveFs, readArchiveIndex, readQuarter } from './archive.js';
/** Prefix all plugin routes live under. */
const PREFIX = '/api/dsh-todos-diy';
/** Kinds the endpoint accepts. */
const KINDS = ['weekly', 'monthly'];
/**
 * Convert a `YYYY-MM-DD` anchor into a local date key, defaulting to today.
 * @param raw - Query value.
 * @param timeZone - Reporting zone.
 * @param now - Clock.
 * @returns Date key.
 */
export function resolveAnchor(raw, timeZone, now) {
    if (raw === undefined || raw === '')
        return localDateKey(now.getTime(), timeZone);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        throw new ValidationError('invalid_argument', 'anchor must be YYYY-MM-DD', { field: 'anchor' });
    }
    try {
        periodOf('weekly', raw, timeZone);
    }
    catch {
        throw new ValidationError('invalid_argument', 'anchor is not a valid date', { field: 'anchor' });
    }
    return raw;
}
/**
 * Load every archived task visible in the archive index.
 * @param ctx - Route context.
 * @returns Archived tasks (empty when the archive is unavailable).
 */
export function loadArchivedTasks(ctx) {
    const fs = ctx.archiveFs ?? nodeArchiveFs;
    try {
        const index = readArchiveIndex(ctx.store.paths, fs, ctx.logger);
        const tasks = [];
        for (const entry of index.quarters) {
            const quarter = readQuarter(entry.quarter, ctx.store.paths, fs);
            if (quarter !== null)
                tasks.push(...quarter.tasks);
        }
        return tasks;
    }
    catch {
        // A broken archive must not break the report; the main file still counts.
        return [];
    }
}
/**
 * Build the report routes.
 * @param ctx - Route context.
 * @returns One route definition.
 */
export function createReportRoutes(ctx) {
    return [
        {
            kind: 'exact',
            path: `${PREFIX}/reports`,
            handler: route({ gate: ctx.gate, logger: ctx.logger }, 'GET', async (_req, res, url) => {
                const kindRaw = queryValue(url, 'kind') ?? 'weekly';
                if (!KINDS.includes(kindRaw)) {
                    throw new ValidationError('invalid_argument', 'kind must be weekly or monthly', { field: 'kind' });
                }
                const timeZone = ctx.store.state.settings.timeZone;
                const anchor = resolveAnchor(queryValue(url, 'anchor'), timeZone, ctx.now());
                const now = ctx.now();
                const report = buildReport({
                    kind: kindRaw,
                    anchor,
                    timeZone,
                    now,
                    tasks: ctx.store.state.tasks,
                    archived: loadArchivedTasks(ctx),
                    events: ctx.store.state.completionEvents,
                    nextAtFor: (task) => {
                        const next = nextFireAt(task, now, ctx.holidays);
                        return next === null ? null : next.toISOString();
                    },
                });
                ok(res, report);
            }),
        },
    ];
}
