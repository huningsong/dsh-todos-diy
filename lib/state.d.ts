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
export declare const SCHEMA_VERSION = 1;
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
}
/** Facts about a corrupt/lost file that the UI must surface (F6.7). */
export interface RecoveryRecord {
    at: string;
    reason: 'corrupt' | 'unsupported-version' | 'migration-failed' | 'missing';
    message: string;
    backupFile: string | null;
}
/** Envelope metadata. */
export interface StateMeta {
    createdAt: string;
    updatedAt: string;
    lastTickAt: string | null;
    lastRecovery: RecoveryRecord | null;
}
/** The whole persisted document. */
export interface PersistedState {
    schemaVersion: number;
    meta: StateMeta;
    settings: Settings;
    tasks: Task[];
    deliveries: DeliveryRecord[];
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
/**
 * Coerce the settings block.
 * @param raw - Candidate settings.
 * @returns Always-valid settings with documented defaults.
 */
export declare function coerceSettings(raw: Record<string, unknown>): Settings;
