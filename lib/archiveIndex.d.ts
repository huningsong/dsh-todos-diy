/**
 * Reading, rebuilding and migrating `archive/index.json` (F4.17 / F6.8).
 *
 * Split from `archive.ts` to stay inside the NF5 line budget. The rebuild is
 * also the startup repair hook: a crash before the index write leaves quarter
 * files the index does not know about, and a v1 index/quarter must be upgraded
 * on disk without ever downgrading a newer file.
 */
import type { ArchiveFs, ArchiveIndex } from './archive.js';
import type { StoragePaths } from './paths.js';
/**
 * Read `archive/index.json`.
 *
 * A missing or unreadable index is rebuilt from the file names rather than
 * aborting startup (§8.3 "归档目录被删").
 * @param paths - Storage paths.
 * @param fs - Filesystem seam.
 * @param logger - Logger for repairs.
 * @returns Parsed index (possibly empty).
 */
export declare function readArchiveIndex(paths: StoragePaths, fs: ArchiveFs, logger?: {
    warn?: (message: string) => void;
}): ArchiveIndex;
/**
 * Reconstruct the index from the quarter files present on disk.
 * @param paths - Storage paths.
 * @param fs - Filesystem seam.
 * @param logger - Logger for repairs.
 * @returns Rebuilt index.
 */
export declare function rebuildIndex(paths: StoragePaths, fs: ArchiveFs, logger?: {
    warn?: (message: string) => void;
}): ArchiveIndex;
