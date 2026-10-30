/**
 * Persisted state shape and its (de)serialization/validation.
 *
 * `schemaVersion` is the migration pivot (§7.7.2): a file below the current
 * version is upgraded through `migrations.ts`; a file **above** it must never be
 * overwritten — the plugin is then too old to understand the data and has to be
 * upgraded. Validation is strict enough to catch hand-edited corruption but
 * tolerant enough that one bad task does not destroy a user's whole list: a
 * malformed task is dropped with a warning, and the file is only treated as
 * corrupt when the envelope itself is unusable.
 */
import type { Task } from './rules/types.js';
/** Current on-disk schema version. Bump together with a migration. */
export declare const SCHEMA_VERSION = 3;
/** One completion record (F11.2 / schema v3).
 *
 * Unlike `Task.doneAt` (one-off tasks only), this keeps the history needed to
 * count recurring-task completions in weekly/monthly reports.
 */
export interface CompletionEvent {
    id: string;
    taskId: string;
    /** Snapshot of the title so a deleted task still shows up in reports. */
    taskTitle: string;
    kind: 'once' | 'recurring';
    occurrenceKey: string;
    completedAt: string;
    /** Deadline (one-off `once.endAt`) or the occurrence instant for recurring. */
    dueAt: string | null;
    timeZone: string;
}
/** One record of the delivery log (F5.5 / D-16). */
export interface DeliveryRecord {
    occurrenceKey: string;
    channel: 'overlay' | 'system';
    status: 'ok' | 'failed' | 'skipped';
    at: string;
    readAt: string | null;
    ignoredAt: string | null;
    dismissedAt: string | null;
    error: string | null;
}
/** Do-not-disturb settings (F5.6 / F9.2). */
export interface DndSettings {
    enabled: boolean;
    start: string;
    end: string;
    weekdaysOnly: boolean;
}
/** User-visible settings persisted alongside the tasks (§7.4). */
export interface Settings {
    timeZone: string;
    tickIntervalMs: number;
    graceMinutes: number;
    defaultChannels: ('overlay' | 'system')[];
    dnd: DndSettings;
    retentionDays: number;
    /** Natural-language parsing (F10.7): off by default, user must opt in. */
    nlp: {
        enabled: boolean;
    };
}
/** Facts about a corrupt/lost file that the UI must surface (F6.7). */
export interface RecoveryRecord {
    at: string;
    reason: 'corrupt' | 'unsupported-version' | 'migration-failed' | 'missing';
    message: string;
    backupFile: string | null;
}
/** One idempotent-create record (F7.15). */
export interface IdempotencyRecord {
    /** Id of the task that was created for this key. */
    taskId: string;
    /** Stable fingerprint of the create payload; a different one is a conflict. */
    fingerprint: string;
    /** Creation instant, used for the FIFO trim. */
    at: string;
}
/** Envelope metadata. */
export interface StateMeta {
    createdAt: string;
    updatedAt: string;
    lastTickAt: string | null;
    lastRecovery: RecoveryRecord | null;
    /**
     * Idempotency index for `POST /tasks/create` (F7.15). Optional so existing
     * v2 files keep loading without a migration; capped on write.
     */
    idempotency?: Record<string, IdempotencyRecord>;
}
/** The whole persisted document. */
export interface PersistedState {
    schemaVersion: number;
    meta: StateMeta;
    settings: Settings;
    tasks: Task[];
    deliveries: DeliveryRecord[];
    /** Completion history, newest last (F11.2). */
    completionEvents: CompletionEvent[];
}
/** Why a loaded state was rejected, when it was. */
export type LoadProblem = {
    kind: 'ok';
} | {
    kind: 'missing';
} | {
    kind: 'corrupt';
    message: string;
} | {
    kind: 'unsupported-version';
    found: number;
} | {
    kind: 'migration-failed';
    message: string;
};
/** Result of parsing one candidate document. */
export interface ParseResult {
    problem: LoadProblem;
    state: PersistedState | null;
    warnings: string[];
}
/** Default settings for a fresh install. */
export declare function defaultSettings(overrides?: Partial<Settings>): Settings;
/**
 * Create an empty document.
 * @param now - Creation instant (injected so tests are deterministic).
 * @param settings - Settings to seed.
 * @returns A valid empty state at the current schema version.
 */
export declare function emptyState(now: Date, settings?: Settings): PersistedState;
/**
 * Coerce a stored document into a `PersistedState`, dropping invalid tasks.
 *
 * Returns a `corrupt` problem only when the envelope itself is unusable; a
 * document with a few bad tasks loads with warnings instead.
 * @param raw - Parsed JSON value.
 * @returns Parse outcome.
 */
export declare function coerceState(raw: unknown): ParseResult;
/**
 * Coerce one stored task. Unknown fields are dropped; a task without an id,
 * title or a valid kind/status is rejected.
 * @param raw - Candidate task.
 * @returns A valid task, or null.
 */
export declare function coerceTask(raw: unknown): Task | null;
export { coerceSettings } from './stateSettings.js';
