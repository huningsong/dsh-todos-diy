/**
 * Restoring a task that was archived into a quarterly file (F4.18 / AC-39).
 *
 * An archived task no longer lives in `tasks.json`, so the normal repository
 * restore path cannot see it. This module moves the task back:
 *   1. append the (migrated) task to the live document and **persist it**;
 *   2. only then remove the entry from the quarter file;
 *   3. finally refresh `index.json`.
 *
 * That order is deliberate: a crash before step 2 leaves the task in both
 * places, which `reconcileArchive` collapses on the next start. The reverse
 * order would leave it in neither file — an unrecoverable loss.
 */
import type { ArchiveFs } from './archive.js';
import type { StoragePaths } from './paths.js';
import type { PersistedState } from './state.js';
import type { Task } from './rules/types.js';
/** Outcome of one archive restore. */
export type ArchiveRestoreResult = {
    restored: true;
    task: Task;
    quarter: string;
} | {
    restored: false;
    reason: 'not-archived' | 'corrupt';
};
/**
 * Find which quarter file holds a task id.
 * @param id - Task id.
 * @param paths - Storage paths.
 * @param fs - Filesystem seam.
 * @returns Quarter label and its task, or null.
 */
export declare function findArchivedTask(id: string, paths: StoragePaths, fs: ArchiveFs): {
    quarter: string;
    task: Task;
} | null;
/**
 * Restore one archived task into the live document.
 *
 * `persist` is called **before** the archive is touched, so a crash can only
 * create a duplicate (reconciled at startup), never a hole.
 * @param state - Live document (mutated on success).
 * @param id - Task id to restore.
 * @param paths - Storage paths.
 * @param fs - Filesystem seam.
 * @param now - Restore instant.
 * @param persist - Write the live document to disk synchronously.
 * @returns The restored task, its source quarter, or a reason.
 */
export declare function restoreArchivedTask(state: PersistedState, id: string, paths: StoragePaths, fs: ArchiveFs, now: Date, persist?: (state: PersistedState) => void): ArchiveRestoreResult;
