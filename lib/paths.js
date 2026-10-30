/**
 * Data-directory resolution (`$DSH_HOME` first, then `~/.dsh`).
 *
 * Mirrors `@deepseek-ai/dsh-home-paths` semantics without importing it (§7.11:
 * zero official runtime dependencies): a blank `$DSH_HOME` must never resolve to
 * the current working directory, which is what `path.resolve('')` would do.
 */
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
/** Directory name created under `$DSH_HOME`. */
export const DATA_DIR_NAME = 'dsh-todos-diy';
/** File name of the primary state file. */
export const STATE_FILE_NAME = 'tasks.json';
/** Directory name of the quarterly archive. */
export const ARCHIVE_DIR_NAME = 'archive';
/**
 * Resolve the DSH home directory.
 *
 * Precedence: `$DSH_HOME` when non-blank, else `~/.dsh`.
 * @param env - Environment mapping (injectable for tests).
 * @param homeDir - OS home override (injectable for tests).
 * @returns Absolute home path.
 */
export function resolveDshHome(env = process.env, homeDir = homedir()) {
    const configured = env['DSH_HOME'];
    if (typeof configured === 'string' && configured.trim() !== '') {
        return resolve(configured.trim());
    }
    return join(resolve(homeDir), '.dsh');
}
/**
 * Resolve this plugin's data directory.
 * @param env - Environment mapping.
 * @param homeDir - OS home override.
 * @returns Absolute path of `$DSH_HOME/dsh-todos-diy`.
 */
export function resolveDataDir(env = process.env, homeDir = homedir()) {
    return join(resolveDshHome(env, homeDir), DATA_DIR_NAME);
}
/**
 * Derive the storage path set.
 * @param dataDir - Absolute data directory.
 * @returns Paths used by `store.ts`.
 */
export function storagePaths(dataDir) {
    return {
        dataDir,
        stateFile: join(dataDir, STATE_FILE_NAME),
        archiveDir: join(dataDir, ARCHIVE_DIR_NAME),
        archiveIndex: join(dataDir, ARCHIVE_DIR_NAME, 'index.json'),
        backupFile: join(dataDir, `${STATE_FILE_NAME}.bak`),
        lockFile: join(dataDir, 'tasks.lock'),
    };
}
