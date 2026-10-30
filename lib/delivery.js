/**
 * Reminder delivery (F5.1–F5.5, D-02).
 *
 * The persisted `deliveries` array **is** the outbox: one row per
 * `occurrenceKey + channel`, written when the tick claims the occurrence and
 * cleared (via `readAt` / `ignoredAt` / `dismissedAt`) when the user acts. That
 * keeps the "same occurrence + channel delivers at most once" guarantee in the
 * same atomic document as the task state — there is no second store to drift.
 *
 * Two channels only (D-02): `overlay` (always) and `system` (best effort, only
 * while the page is hidden and the browser granted permission). The host never
 * touches a browser API; the client reports what actually happened through
 * `POST /deliveries/report`.
 */
import { localDateTimeKey, formatUtcOffset } from './rules/timezone.js';
/**
 * Fill one template with the four documented variables (UX-10 / F5.4).
 *
 * Plain-text substitution only: the result is rendered as text, never as HTML,
 * so a task title containing `<script>` is harmless. Unknown variables are left
 * verbatim.

 * @param template - Template text.
 * @param values - Variable values.
 * @returns Rendered text.
 */
export function renderTemplate(template, values) {
    return template
        .replaceAll('{title}', values.title)
        .replaceAll('{time}', values.time)
        .replaceAll('{note}', values.note)
        .replaceAll('{phase}', values.phase);
}
/**
 * Human label for one occurrence phase.
 * @param phase - Occurrence phase.
 * @returns Chinese label used in the default template.
 */
export function phaseLabel(phase) {
    if (phase === 'start')
        return '任务开始';
    if (phase === 'end')
        return '任务结束';
    if (phase === 'advance')
        return '提前提醒';
    return '提醒';
}
/**
 * Build the reminder card for one fired occurrence.
 * @param task - Owning task.
 * @param occurrence - The occurrence that fired.
 * @returns Card payload for `/due`.
 */
export function buildReminderCard(task, occurrence) {
    const timeZone = task.rule?.timeZone ?? 'Asia/Shanghai';
    const atMs = occurrence.at.getTime();
    const localTime = localDateTimeKey(atMs, timeZone);
    const phase = occurrence.phase;
    const text = renderTemplate(task.notify.template, {
        title: task.title,
        time: `${localTime.replace('T', ' ')}（${formatUtcOffset(atMs, timeZone)}）`,
        note: task.description,
        phase: phaseLabel(phase),
    });
    return {
        occurrenceKey: occurrence.key,
        taskId: task.id,
        title: task.title,
        description: task.description,
        at: occurrence.at.toISOString(),
        phase,
        localTime,
        utcOffset: formatUtcOffset(atMs, timeZone),
        timeZone,
        text,
        sound: task.notify.sound,
        channels: task.notify.channels,
        status: task.status,
    };
}
/**
 * Build the `deliveries` rows for one fired occurrence.
 *
 * `overlay` is always recorded as `ok`. A task that also lists `system` gets a
 * `skipped` row with `error: 'page-visible'` as a placeholder; the client
 * replaces it with the real outcome through `/deliveries/report`.
 * @param task - Owning task.
 * @param occurrence - The occurrence that fired.
 * @param now - Delivery instant.
 * @returns One or two records.
 */
export function deliveryRecordsFor(task, occurrence, now) {
    const stamp = now.toISOString();
    const records = [
        {
            occurrenceKey: occurrence.key,
            channel: 'overlay',
            status: 'ok',
            at: stamp,
            readAt: null,
            ignoredAt: null,
            dismissedAt: null,
            error: null,
        },
    ];
    if (task.notify.channels.includes('system')) {
        records.push({
            occurrenceKey: occurrence.key,
            channel: 'system',
            status: 'skipped',
            at: stamp,
            readAt: null,
            ignoredAt: null,
            dismissedAt: null,
            error: 'page-visible',
        });
    }
    return records;
}
/**
 * Deliveries that still need the user's attention.
 *
 * A record is pending while it has neither `readAt` nor `ignoredAt`, its bound
 * task is still in a state that can be reminded, and it is recent enough to be
 * worth showing (90 minutes — an old unacknowledged card should not haunt a
 * restart forever).
 * @param records - Persisted delivery log.
 * @param tasks - Current tasks (to resolve titles and status).
 * @param now - Current instant.
 * @returns Pending overlay records, newest last.
 */
export function pendingDeliveries(records, tasks, now) {
    const byId = new Map(tasks.map((task) => [task.id, task]));
    const horizon = now.getTime() - 90 * 60_000;
    const pending = [];
    for (const record of records) {
        if (record.channel !== 'overlay')
            continue;
        if (record.status !== 'ok')
            continue;
        if (record.readAt !== null || record.ignoredAt !== null || record.dismissedAt !== null)
            continue;
        const at = Date.parse(record.at);
        if (Number.isNaN(at) || at < horizon)
            continue;
        const taskId = record.occurrenceKey.split('@')[0] ?? '';
        const task = byId.get(taskId);
        if (task === undefined)
            continue;
        // D-22: a paused task is deliberately set aside, so its held cards must not
        // keep nagging. A done task is already finished for the same reason.
        if (task.status === 'archived' || task.status === 'paused' || task.status === 'done')
            continue;
        pending.push({ record, task });
    }
    return pending;
}
/**
 * Find one delivery row.
 * @param records - Delivery log.
 * @param occurrenceKey - Occurrence key.
 * @param channel - Optional channel filter.
 * @returns The record, or undefined.
 */
export function findDelivery(records, occurrenceKey, channel) {
    return records.find((record) => record.occurrenceKey === occurrenceKey && (channel === undefined || record.channel === channel));
}
/**
 * Apply one acknowledgement to a delivery row, returning a new array.
 *
 * @param records - Delivery log.
 * @param occurrenceKey - Occurrence key.
 * @param channel - Channel being acknowledged.
 * @param action - User action.
 * @param now - Acknowledgement instant.
 * @returns Updated log plus whether anything changed.
 */
export function acknowledge(records, occurrenceKey, channel, action, now) {
    const stamp = now.toISOString();
    let changed = false;
    const next = records.map((record) => {
        if (record.occurrenceKey !== occurrenceKey || record.channel !== channel)
            return record;
        changed = true;
        if (action === 'dismiss') {
            return { ...record, ignoredAt: stamp, readAt: record.readAt ?? stamp, dismissedAt: stamp };
        }
        return { ...record, readAt: record.readAt ?? stamp, dismissedAt: stamp };
    });
    return { records: next, changed };
}
/**
 * Record what really happened on the `system` channel (F5.2/F5.3).
 *
 * The host cannot know whether the browser actually showed a notification, so
 * the client reports it. A failure is recorded as `failed` with the browser's
 * reason (`permission-denied` / `not-supported`), never thrown.
 * @param records - Delivery log.
 * @param occurrenceKey - Occurrence key.
 * @param outcome - Reported outcome.
 * @param now - Report instant.
 * @returns Updated log plus whether a row was found.
 */
export function reportSystemDelivery(records, occurrenceKey, outcome, now) {
    let found = false;
    const stamp = now.toISOString();
    const next = records.map((record) => {
        if (record.occurrenceKey !== occurrenceKey || record.channel !== 'system')
            return record;
        found = true;
        return {
            ...record,
            status: outcome.ok ? 'ok' : 'failed',
            at: record.at === '' ? stamp : record.at,
            error: outcome.ok ? null : (outcome.error ?? 'not-supported'),
        };
    });
    return { records: next, found };
}
