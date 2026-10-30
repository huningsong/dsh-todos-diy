/**
 * Completion-event log (F11.2, schema v3).
 *
 * One event per completed occurrence. One-off tasks also keep `doneAt`; the
 * log is what makes recurring completions countable over a week or month.
 */
import type { CompletionEvent, PersistedState } from './state.js';
import type { Task } from './rules/types.js';
/** Keep at most this many events. */
export declare const COMPLETION_EVENT_LIMIT = 5000;
/** Also drop events older than this many months (whichever trims first). */
export declare const COMPLETION_EVENT_MONTHS = 24;
/**
 * Extract the occurrence instant from an occurrence key (`task@ISO#phase`).
 * @param key - Occurrence key.
 * @returns ISO instant, or null when the key has no timestamp.
 */
export declare function occurrenceInstant(key: string): string | null;
/**
 * Build one completion event for a task.
 * @param task - Task *after* the state change.
 * @param occurrenceKey - Completed occurrence key.
 * @param completedAt - Completion instant.
 * @param now - Clock used for the id.
 * @returns The event.
 */
export declare function makeCompletionEvent(task: Task, occurrenceKey: string, completedAt: Date, now?: Date): CompletionEvent;
/**
 * Append an event and trim the log (24 months, then 5000 rows).
 * @param state - Persisted state, mutated in place.
 * @param event - Event to append.
 * @param now - Clock for the age cutoff.
 */
export declare function appendCompletionEvent(state: PersistedState, event: CompletionEvent, now: Date): void;
