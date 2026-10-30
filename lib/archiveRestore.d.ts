/**
 * Restoring a task that was archived into a quarterly file (F4.18 / AC-39).
 *
 * An archived task no longer lives in `tasks.json`, so the normal repository
 * restore path cannot see it. This module moves the task back:
 *   1. read the quarter file;
 *   2. remove the entry and rewrite that quarter file atomically;
 *   3. update `index.json` (count / drop the file when empty);
 *   4. append the task to the live document with `status=active`.
 *
 * Ordering matters: the main document is written **last**, so a crash leaves the
 * task in the archive only (recoverable) rather than in neither file.
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
 * The caller is responsible for persisting `state` after this returns (the
 * repository's write queue owns the physical write). `state` is mutated in
 * place only after every file operation succeeded, so a failed restore leaves
 * the archive untouched.
 * @param state - Live document (mutated on success).
 * @param id - Task id to restore.
 * @param paths - Storage paths.
 * @param fs - Filesystem seam.
 * @param now - Restore instant.
 * @returns The restored task, its source quarter, or a reason.
 */
export declare function restoreArchivedTask(state: PersistedState, id: string, paths: StoragePaths, fs: ArchiveFs, now: Date): ArchiveRestoreResult;
