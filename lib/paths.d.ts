/**
 * Data-directory resolution (`$DSH_HOME` first, then `~/.dsh`).
 *
 * Mirrors `@deepseek-ai/dsh-home-paths` semantics without importing it (§7.11:
 * zero official runtime dependencies): a blank `$DSH_HOME` must never resolve to
 * the current working directory, which is what `path.resolve('')` would do.
 */
/** Directory name created under `$DSH_HOME`. */
export declare const DATA_DIR_NAME = "dsh-todos-diy";
/** File name of the primary state file. */
export declare const STATE_FILE_NAME = "tasks.json";
/** Directory name of the quarterly archive. */
export declare const ARCHIVE_DIR_NAME = "archive";
/**
 * Resolve the DSH home directory.
 *
 * Precedence: `$DSH_HOME` when non-blank, else `~/.dsh`.
 * @param env - Environment mapping (injectable for tests).
 * @param homeDir - OS home override (injectable for tests).
 * @returns Absolute home path.
 */
export declare function resolveDshHome(env?: Record<string, string | undefined>, homeDir?: string): string;
/**
 * Resolve this plugin's data directory.
 * @param env - Environment mapping.
 * @param homeDir - OS home override.
 * @returns Absolute path of `$DSH_HOME/dsh-todos-diy`.
 */
export declare function resolveDataDir(env?: Record<string, string | undefined>, homeDir?: string): string;
/**
 * Every path the storage layer owns, derived from one data directory.
 * @param dataDir - Absolute data directory.
 * @returns Full path set.
 */
export interface StoragePaths {
    dataDir: string;
    stateFile: string;
    archiveDir: string;
    archiveIndex: string;
    backupFile: string;
    lockFile: string;
}
/**
 * Derive the storage path set.
 * @param dataDir - Absolute data directory.
 * @returns Paths used by `store.ts`.
 */
export declare function storagePaths(dataDir: string): StoragePaths;
