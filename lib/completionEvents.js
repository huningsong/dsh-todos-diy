/**
 * Completion-event log (F11.2, schema v3).
 *
 * One event per completed occurrence. One-off tasks also keep `doneAt`; the
 * log is what makes recurring completions countable over a week or month.
 */
import { newTaskId } from './ids.js';
/** Keep at most this many events. */
export const COMPLETION_EVENT_LIMIT = 5000;
/** Also drop events older than this many months (whichever trims first). */
export const COMPLETION_EVENT_MONTHS = 24;
/**
 * Extract the occurrence instant from an occurrence key (`task@ISO#phase`).
 * @param key - Occurrence key.
 * @returns ISO instant, or null when the key has no timestamp.
 */
export function occurrenceInstant(key) {
    const at = key.indexOf('@');
    if (at === -1)
        return null;
    const rest = key.slice(at + 1);
    const hash = rest.indexOf('#');
    const iso = hash === -1 ? rest : rest.slice(0, hash);
    return Number.isNaN(Date.parse(iso)) ? null : new Date(iso).toISOString();
}
/**
 * Build one completion event for a task.
 * @param task - Task *after* the state change.
 * @param occurrenceKey - Completed occurrence key.
 * @param completedAt - Completion instant.
 * @param now - Clock used for the id.
 * @returns The event.
 */
export function makeCompletionEvent(task, occurrenceKey, completedAt, now = completedAt) {
    const dueAt = task.kind === 'once' ? task.once?.endAt ?? null : occurrenceInstant(occurrenceKey);
    const timeZone = task.kind === 'once' ? task.once?.timeZone ?? 'Asia/Shanghai' : task.rule?.timeZone ?? 'Asia/Shanghai';
    return {
        id: `ev_${newTaskId(now).slice(3)}`,
        taskId: task.id,
        taskTitle: task.title,
        kind: task.kind,
        occurrenceKey,
        completedAt: completedAt.toISOString(),
        dueAt,
        timeZone,
    };
}
/**
 * Append an event and trim the log (24 months, then 5000 rows).
 * @param state - Persisted state, mutated in place.
 * @param event - Event to append.
 * @param now - Clock for the age cutoff.
 */
export function appendCompletionEvent(state, event, now) {
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - COMPLETION_EVENT_MONTHS);
    const kept = state.completionEvents.filter((entry) => Date.parse(entry.completedAt) >= cutoff.getTime());
    kept.push(event);
    state.completionEvents = kept.slice(-COMPLETION_EVENT_LIMIT);
}
