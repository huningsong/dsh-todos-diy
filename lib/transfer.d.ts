/**
 * Import / export (F9.4 / AC-25).
 *
 * Export is the whole persisted document plus a wrapper header, so a future
 * schema can still read an old file. Import supports `replace` and `merge`,
 * always backs the current file up first, and validates the payload before it
 * touches memory — a bad file must never destroy the live state.
 */
import type { PersistedState, Settings } from './state.js';
import type { Task } from './rules/types.js';
/** One exported bundle. */
export interface ExportBundle {
    kind: 'dsh-todos-diy/export';
    exportedAt: string;
    schemaVersion: number;
    settings: Settings;
    tasks: Task[];
    deliveries: PersistedState['deliveries'];
}
/** Result of an import. */
export interface ImportResult {
    imported: number;
    skipped: number;
    backupFile: string | null;
    mode: 'replace' | 'merge';
    warnings: string[];
}
/**
 * Build the export payload.
 * @param state - Live document.
 * @param now - Export instant.
 * @returns Serializable bundle.
 */
export declare function buildExport(state: PersistedState, now: Date): ExportBundle;
/**
 * Take a timestamped backup next to the live file.
 * @param stateFile - Absolute path of `tasks.json`.
 * @param now - Backup instant.
 * @returns The backup path, or null when there was nothing to copy.
 */
export declare function backupBeforeImport(stateFile: string, now: Date): string | null;
/** A validated import candidate. */
export interface ImportCandidate {
    tasks: Task[];
    settings: Settings | null;
    deliveries: PersistedState['deliveries'];
    warnings: string[];
    /** Number of structurally invalid task entries that were skipped. */
    skipped: number;
}
/**
 * Validate an import payload before anything is mutated.
 *
 * Accepts both the export wrapper and a bare `tasks.json` document; unknown
 * envelope versions are refused with `schema_mismatch`.
 * @param payload - Parsed JSON value.
 * @returns Validated tasks/settings, or a thrown error code.
 */
export declare function parseImport(payload: unknown): ImportCandidate;
/**
 * Merge imported tasks into the live document by id.
 * @param current - Live tasks.
 * @param incoming - Imported tasks.
 * @returns Merged list and the number actually added.
 */
export declare function mergeTasks(current: readonly Task[], incoming: readonly Task[]): {
    tasks: Task[];
    added: number;
};
/**
 * Write a settings-only export (F9.6).
 * @param settings - Current settings.
 * @param now - Export instant.
 * @returns Pretty JSON text.
 */
export declare function settingsExport(settings: Settings, now: Date): string;
/** Write text to a path (thin wrapper so tests can spy). */
export declare function writeText(path: string, content: string): void;
