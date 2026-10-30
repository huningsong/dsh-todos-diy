/**
 * Quarterly archive of completed tasks (D-24 / F4.16–F4.19).
 *
 * Layout: `$DSH_HOME/dsh-todos-diy/archive/completed-YYYY-Qn.json` plus an
 * `index.json` describing every file. Write order is deliberately
 * archive-first, main-file-second (§7.7.2):
 *
 *   1. write the quarter file (tmp + rename);
 *   2. remove that batch from the main document and write it;
 *   3. rewrite `index.json`.
 *
 * A crash between 1 and 2 leaves the task in **both** files; startup
 * reconciliation (by id) collapses that to exactly one. A crash between 2 and 3
 * leaves a correct archive with a stale index, which the next run repairs.
 */
import type { Task } from './rules/types.js';
import { quarterOf } from './quarter.js';
import type { PersistedState } from './state.js';
import type { StoragePaths } from './paths.js';
/** One entry of `archive/index.json`. */
export interface ArchiveIndexEntry {
    quarter: string;
    file: string;
    count: number;
    start: string;
    end: string;
}
/** `archive/index.json` shape. */
export interface ArchiveIndex {
    schemaVersion: number;
    /** True when the file was written by a newer plugin; it must not be rewritten. */
    unsupported?: boolean;
    quarters: ArchiveIndexEntry[];
}
/** File-system seam, mirroring `store.ts` so tests can use the memory double. */
export interface ArchiveFs {
    readFile(path: string): string;
    writeFile(path: string, content: string): void;
    rename(from: string, to: string): void;
    mkdir(path: string): void;
    exists(path: string): boolean;
    listDir(path: string): string[];
}
/**
 * The quarter that contains `now`, in a zone.
 * @param now - Current instant.
 * @param timeZone - Zone identifier.
 * @returns `YYYY-Qn`.
 */
export declare function currentQuarter(now: Date, timeZone: string): string;
/**
 * Compare two `YYYY-Qn` labels.
 * @param left - First quarter.
 * @param right - Second quarter.
 * @returns Negative when `left` is earlier.
 */
export declare function compareQuarters(left: string, right: string): number;
/** Inclusive UTC bounds of a quarter label. */
export declare function quarterBounds(quarter: string): {
    start: string;
    end: string;
} | null;
/** A quarter file's on-disk shape. */
export interface QuarterFile {
    schemaVersion: number;
    quarter: string;
    tasks: Task[];
}
/** Result of one archive run. */
export interface ArchiveRunResult {
    archived: {
        quarter: string;
        count: number;
    }[];
    skipped: string[];
    /** Tasks that appear in both the archive and the main file (reconciled). */
    duplicatesRemoved: number;
}
/** Options for {@link archiveCompleted}. */
export interface ArchiveOptions {
    paths: StoragePaths;
    fs: ArchiveFs;
    now: Date;
    timeZone: string;
    /** Quarter that must stay in the main file; defaults to the current one. */
    keepQuarter?: string;
    logger?: {
        info?: (message: string) => void;
        warn?: (message: string) => void;
    };
}
/**
 * Move tasks that completed in a previous quarter out of the main document.
 *
 * Idempotent: running it twice archives nothing the second time. Tasks are
 * grouped by the quarter of their `doneAt` in their own time zone, which is what
 * D-24 specifies.
 * @param state - Mutable main document (mutated in place).
 * @param options - Paths, clock and target quarter.
 * @returns What was archived.
 */
export declare function archiveCompleted(state: PersistedState, options: ArchiveOptions): ArchiveRunResult;
/**
 * Startup reconciliation for a crash between the archive write and the main
 * write: any task id present in both places is removed from the main file.
 * @param state - Main document (mutated in place).
 * @param paths - Storage paths.
 * @param fs - Filesystem seam.
 * @param logger - Logger for repairs.
 * @returns Number of duplicate rows removed.
 */
export declare function reconcileArchive(state: PersistedState, paths: StoragePaths, fs: ArchiveFs, logger?: {
    warn?: (message: string) => void;
}): number;
/**
 * Read one quarter's archived tasks, plus the index entry.
 * @param quarter - Quarter label.
 * @param paths - Storage paths.
 * @param fs - Filesystem seam.
 * @returns Tasks and entry, or null when the quarter is unknown.
 */
export declare function readQuarter(quarter: string, paths: StoragePaths, fs: ArchiveFs): {
    tasks: Task[];
    entry: ArchiveIndexEntry;
} | null;
/** Real `node:fs` implementation of the archive seam. */
export declare const nodeArchiveFs: ArchiveFs;
export { quarterOf };
export { readArchiveIndex, rebuildIndex } from './archiveIndex.js';
