/**
 * HTTP routes (§7.8), split from `index.ts` so the entry point stays readable.
 *
 * Every route is registered through `ctx.webServer.register({kind:'exact'})` and
 * wrapped by `route()`, which applies the `connection.requestRejection` gate
 * before anything else. Exact routes win over the official `/api` prefix, so
 * skipping that gate would leave the plugin unauthenticated (§4.4).
 */
import { route, sendJson } from './http.js';
import { ok, queryFlag, queryInt, queryValue, readObjectBody } from './routeKit.js';
import { taskTimeZone, toTaskViews } from './taskView.js';
import { localDateKey } from './rules/timezone.js';
import { validateTimeZone } from './validate.js';
import { validateRule } from './validate.js';
import { validateSettingsPatch } from './validateSettings.js';
import { ValidationError } from './validationError.js';
import { nextOccurrence } from './rules/occurrence.js';
import { taskRoutes } from './taskRoutes.js';
import { acknowledge, buildReminderCard, findDelivery, pendingDeliveries, reportSystemDelivery, } from './delivery.js';
import { transferRoutes } from './transferRoutes.js';
import { archiveRoutes } from './archiveRoutes.js';
import { isWithinDnd } from './dnd.js';
/** Prefix all plugin routes live under. */
const PREFIX = '/api/dsh-todos-diy';
/** The six selectable views (F4.10 / F4.21). */
const VIEW_NAMES = [
    'all',
    'notStarted',
    'inProgress',
    'overdue',
    'done',
    'recurring',
    'paused',
];
/**
 * Derive the occurrence phase from its key suffix.
 *
 * `occurrenceKey` embeds the phase as `#start` / `#end` / `#advance`; the
 * delivery row stores only the key, so the overlay needs this to show the right
 * 「任务开始 / 任务结束」wording.
 * @param key - Occurrence key.
 * @returns The phase, or null for a plain recurring reminder.
 */
function phaseFromKey(key) {
    const hash = key.lastIndexOf('#');
    if (hash === -1)
        return null;
    const suffix = key.slice(hash + 1);
    if (suffix === 'start' || suffix === 'end' || suffix === 'advance')
        return suffix;
    return null;
}
/**
 * Build every route.
 * @param ctx - Route context.
 * @returns Route definitions in registration order.
 */
export function createRoutes(ctx) {
    const options = { gate: ctx.gate, logger: ctx.logger };
    const healthOptions = { gate: ctx.loopbackGate, logger: ctx.logger };
    const taskOptions = { gate: ctx.gate, logger: ctx.logger };
    return [
        {
            kind: 'exact',
            path: `${PREFIX}/health`,
            handler: route(healthOptions, 'GET', async (_req, res) => {
                sendJson(res, 200, { ok: true, value: ctx.healthSnapshot() });
            }),
        },
        {
            kind: 'exact',
            path: `${PREFIX}/snapshot`,
            handler: route(options, 'GET', async (_req, res, url) => {
                const viewParam = queryValue(url, 'view') ?? 'inProgress';
                if (!VIEW_NAMES.includes(viewParam)) {
                    sendJson(res, 400, {
                        error: { code: 'invalid_argument', message: `view must be one of ${VIEW_NAMES.join(', ')}` },
                    });
                    return;
                }
                const result = ctx.repo.list({
                    view: viewParam,
                    status: queryValue(url, 'status'),
                    kind: queryValue(url, 'kind'),
                    query: queryValue(url, 'q'),
                    limit: queryInt(url, 'limit'),
                    cursor: queryValue(url, 'cursor'),
                    includeArchived: queryFlag(url, 'includeArchived'),
                });
                ok(res, {
                    // F4.21: counts and item stages must come from ONE instant. `repo.list`
                    // already fixed `serverTime`; reuse it instead of calling ctx.now()
                    // again (a boundary could fall between the two calls).
                    items: toTaskViews(result.items, { now: new Date(result.serverTime), holidays: ctx.holidays }),
                    nextCursor: result.nextCursor,
                    counts: result.counts,
                    byKind: result.byKind,
                    totalDone: result.totalDone,
                    prioritySummary: result.prioritySummary,
                    serverTime: result.serverTime,
                    nextTransitionAt: result.nextTransitionAt,
                    settings: ctx.repo.settings(),
                });
            }),
        },
        {
            kind: 'exact',
            path: `${PREFIX}/priority/rules`,
            handler: route(options, 'GET', async (_req, res) => {
                ok(res, {
                    thresholds: { highHours: 24, midHours: 72, lowHours: 168 },
                    derived: true,
                });
            }),
        },
        ...archiveRoutes(ctx, options),
        ...taskRoutes(ctx, taskOptions),
        {
            kind: 'exact',
            path: `${PREFIX}/due`,
            handler: route(options, 'GET', async (_req, res) => {
                const now = ctx.now();
                const settings = ctx.repo.settings();
                const inDnd = isWithinDnd(settings.dnd, now, settings.timeZone);
                const all = pendingDeliveries(ctx.repo.deliveries(), ctx.repo.snapshotTasks(), now);
                // A `dnd-held` row stays hidden while the quiet window is active; once
                // it ends the whole batch becomes one summary card (F5.6 / UX-05).
                // Held rows are never returned as individual cards: while DND is on
                // they stay hidden, and once it ends they are represented only by
                // `dndSummary` (F5.6 — one summary instead of N stale cards).
                const pending = all.filter(({ record }) => record.error !== 'dnd-held');
                const heldRows = inDnd ? [] : all.filter(({ record }) => record.error === 'dnd-held');
                const dndSummary = heldRows.length === 0
                    ? null
                    : {
                        count: heldRows.length,
                        occurrences: heldRows.map(({ record }) => record.occurrenceKey),
                        titles: heldRows.map(({ task }) => task.title).slice(0, 20),
                    };
                const cards = pending.map(({ record, task }) => {
                    const at = new Date(record.at);
                    const occurrence = {
                        taskId: task.id,
                        at,
                        phase: phaseFromKey(record.occurrenceKey),
                        key: record.occurrenceKey,
                        kind: task.kind,
                    };
                    return buildReminderCard(task, occurrence);
                });
                ok(res, { items: cards, ...(dndSummary === null ? {} : { dndSummary }), serverTime: now.toISOString() });
            }),
        },
        {
            kind: 'exact',
            path: `${PREFIX}/capabilities`,
            handler: route(options, 'POST', async (req, res) => {
                const body = await readObjectBody(req);
                const granted = body['systemNotification'];
                if (typeof granted !== 'boolean') {
                    sendJson(res, 400, { error: { code: 'invalid_argument', message: 'systemNotification must be a boolean' } });
                    return;
                }
                ctx.setSystemNotification?.(granted);
                ok(res, { systemNotification: granted });
            }),
        },
        {
            kind: 'exact',
            path: `${PREFIX}/deliveries`,
            handler: route(options, 'GET', async (_req, res, url) => {
                // F8.14 「查看历史」: delivery/receipt history, newest first, optionally
                // narrowed to one task. Pagination is an opaque offset, like /archive.
                const taskId = queryValue(url, 'taskId');
                if (taskId !== undefined && ctx.repo.get(taskId) === null) {
                    sendJson(res, 404, { error: { code: 'not_found', message: `task ${JSON.stringify(taskId)} was not found` } });
                    return;
                }
                const limit = Math.min(200, Math.max(1, queryInt(url, 'limit') ?? 50));
                const offset = Math.max(0, queryInt(url, 'cursor') === undefined ? 0 : Number(queryValue(url, 'cursor')));
                const all = [...ctx.repo.deliveries()].reverse();
                const scoped = taskId === undefined ? all : all.filter((record) => record.occurrenceKey.startsWith(`${taskId}@`));
                ok(res, {
                    items: scoped.slice(offset, offset + limit),
                    nextCursor: offset + limit < scoped.length ? String(offset + limit) : null,
                    total: scoped.length,
                });
            }),
        },
        {
            kind: 'exact',
            path: `${PREFIX}/deliveries/report`,
            handler: route(options, 'POST', async (req, res) => {
                const body = await readObjectBody(req);
                const occurrenceKey = body['occurrenceKey'];
                const okFlag = body['ok'];
                if (typeof occurrenceKey !== 'string' || occurrenceKey === '') {
                    sendJson(res, 400, { error: { code: 'invalid_argument', message: 'occurrenceKey is required' } });
                    return;
                }
                if (typeof okFlag !== 'boolean') {
                    sendJson(res, 400, { error: { code: 'invalid_argument', message: 'ok must be a boolean' } });
                    return;
                }
                const error = typeof body['error'] === 'string' ? body['error'] : null;
                const result = reportSystemDelivery(ctx.repo.deliveries(), occurrenceKey, { ok: okFlag, error }, ctx.now());
                if (!result.found) {
                    sendJson(res, 404, { error: { code: 'not_found', message: 'system delivery not found' } });
                    return;
                }
                await ctx.repo.replaceDeliveries(result.records);
                ok(res, { ok: true });
            }),
        },
        {
            kind: 'exact',
            path: `${PREFIX}/deliveries/ack`,
            handler: route(options, 'POST', async (req, res) => {
                const body = await readObjectBody(req);
                const occurrenceKey = body['occurrenceKey'];
                const action = body['action'];
                const channel = body['channel'] === 'system' ? 'system' : 'overlay';
                if (typeof occurrenceKey !== 'string' || occurrenceKey === '') {
                    sendJson(res, 400, { error: { code: 'invalid_argument', message: 'occurrenceKey is required' } });
                    return;
                }
                if (action !== 'dismiss' && action !== 'complete' && action !== 'snooze') {
                    sendJson(res, 400, {
                        error: { code: 'invalid_argument', message: 'action must be dismiss, complete or snooze' },
                    });
                    return;
                }
                const record = findDelivery(ctx.repo.deliveries(), occurrenceKey, channel);
                if (record === undefined) {
                    sendJson(res, 404, { error: { code: 'not_found', message: 'delivery not found' } });
                    return;
                }
                // `complete`/`snooze` also change the task; ack is the bookkeeping half.
                if (action === 'complete') {
                    const taskId = occurrenceKey.split('@')[0] ?? '';
                    try {
                        await ctx.repo.complete(taskId, occurrenceKey);
                    }
                    catch (error) {
                        // A recurring task with no current occurrence cannot be completed;
                        // dismissing the card is still the right outcome. Match the code,
                        // not the message, so an unrelated failure is not swallowed.
                        if (!(error instanceof ValidationError) || error.code !== 'no_occurrence')
                            throw error;
                    }
                }
                if (action === 'snooze') {
                    const minutes = Number(body['minutes'] ?? 15);
                    const taskId = occurrenceKey.split('@')[0] ?? '';
                    await ctx.repo.snooze(taskId, Number.isInteger(minutes) ? minutes : 15);
                }
                const result = acknowledge(ctx.repo.deliveries(), occurrenceKey, channel, action, ctx.now());
                if (result.changed)
                    await ctx.repo.replaceDeliveries(result.records);
                ok(res, { ok: true, occurrenceKey, action, changed: result.changed });
            }),
        },
        {
            kind: 'exact',
            path: `${PREFIX}/rules/preview`,
            handler: route(options, 'POST', async (req, res) => {
                const body = await readObjectBody(req);
                const zone = validateTimeZone(body['timeZone'], ctx.config.timeZone);
                const rule = validateRule(body['rule'], zone);
                const times = [];
                let cursor = ctx.now();
                for (let index = 0; index < 5; index += 1) {
                    const next = nextOccurrence(rule, cursor, rule.timeZone, ctx.holidays);
                    if (next === null)
                        break;
                    times.push(next.toISOString());
                    cursor = next;
                }
                ok(res, { times });
            }),
        },
        ...transferRoutes(ctx, options),
        {
            kind: 'exact',
            path: `${PREFIX}/settings/get`,
            handler: route(options, 'GET', async (_req, res) => {
                ok(res, ctx.repo.settings());
            }),
        },
        {
            kind: 'exact',
            path: `${PREFIX}/settings/update`,
            handler: route(options, 'POST', async (req, res) => {
                const body = await readObjectBody(req);
                let patch;
                try {
                    patch = validateSettingsPatch(body);
                }
                catch (error) {
                    if (error instanceof ValidationError) {
                        sendJson(res, 400, {
                            error: { code: error.code, message: error.message, details: error.details },
                        });
                        return;
                    }
                    throw error;
                }
                ok(res, ctx.repo.updateSettings(patch));
            }),
        },
    ];
}
/**
 * Today's local date for a task in its own zone (§8.1).
 * @param task - Task being projected.
 * @param ctx - Route context.
 * @returns `YYYY-MM-DD` in that task's zone.
 */
function localDayKeyForTask(task, ctx) {
    return localDateKey(ctx.now().getTime(), taskTimeZone(task, ctx.config.timeZone));
}
