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
import type { Occurrence, Task } from './rules/types.js';
import type { DeliveryRecord } from './state.js';
/** One card the overlay renders (`GET /due`). */
export interface ReminderCard {
    occurrenceKey: string;
    taskId: string;
    title: string;
    description: string;
    /** The instant the reminder fires at, UTC ISO. */
    at: string;
    /** `start` / `end` / `advance` / null for a plain recurring hit. */
    phase: 'start' | 'end' | 'advance' | null;
    /** Local time in the task zone, `YYYY-MM-DDTHH:mm`. */
    localTime: string;
    /** `UTC±HH:MM` of the task zone at that instant. */
    utcOffset: string;
    timeZone: string;
    /** Rendered text from the task template (plain text, no HTML). */
    text: string;
    /** Task-level reminder settings echoed so the client can play a sound. */
    sound: boolean;
    channels: ('overlay' | 'system')[];
    /** Task status at render time, so the overlay can hide a paused task. */
    status: Task['status'];
}
/** Result of one ack. */
export interface AckResult {
    occurrenceKey: string;
    action: 'dismiss' | 'complete' | 'snooze';
    changed: boolean;
}
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
export declare function renderTemplate(template: string, values: {
    title: string;
    time: string;
    note: string;
    phase: string;
}): string;
/**
 * Human label for one occurrence phase.
 * @param phase - Occurrence phase.
 * @returns Chinese label used in the default template.
 */
export declare function phaseLabel(phase: Occurrence['phase']): string;
/**
 * Build the reminder card for one fired occurrence.
 * @param task - Owning task.
 * @param occurrence - The occurrence that fired.
 * @returns Card payload for `/due`.
 */
export declare function buildReminderCard(task: Task, occurrence: Occurrence): ReminderCard;
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
export declare function deliveryRecordsFor(task: Task, occurrence: Occurrence, now: Date): DeliveryRecord[];
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
export declare function pendingDeliveries(records: readonly DeliveryRecord[], tasks: readonly Task[], now: Date): {
    record: DeliveryRecord;
    task: Task;
}[];
/**
 * Find one delivery row.
 * @param records - Delivery log.
 * @param occurrenceKey - Occurrence key.
 * @param channel - Optional channel filter.
 * @returns The record, or undefined.
 */
export declare function findDelivery(records: readonly DeliveryRecord[], occurrenceKey: string, channel?: 'overlay' | 'system'): DeliveryRecord | undefined;
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
export declare function acknowledge(records: readonly DeliveryRecord[], occurrenceKey: string, channel: 'overlay' | 'system', action: 'dismiss' | 'complete' | 'snooze', now: Date): {
    records: DeliveryRecord[];
    changed: boolean;
};
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
export declare function reportSystemDelivery(records: readonly DeliveryRecord[], occurrenceKey: string, outcome: {
    ok: boolean;
    error?: string | null;
}, now: Date): {
    records: DeliveryRecord[];
    found: boolean;
};
