/**
 * Reading, rebuilding and migrating `archive/index.json` (F4.17 / F6.8).
 *
 * Split from `archive.ts` to stay inside the NF5 line budget. The rebuild is
 * also the startup repair hook: a crash before the index write leaves quarter
 * files the index does not know about, and a v1 index/quarter must be upgraded
 * on disk without ever downgrading a newer file.
 */
import { join } from 'node:path';
import { compareQuarters, quarterBounds } from './archive.js';
import { SCHEMA_VERSION } from './state.js';
import { migrateDocumentToCurrent, migrateIndexToCurrent } from './migrationV3.js';
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
export function readArchiveIndex(paths, fs, logger) {
    if (!fs.exists(paths.archiveIndex))
        return rebuildIndex(paths, fs, logger);
    try {
        const parsed = JSON.parse(fs.readFile(paths.archiveIndex));
        if (!Array.isArray(parsed.quarters))
            return rebuildIndex(paths, fs, logger);
        // F6.8: the index shares `SCHEMA_VERSION` with the main file; a v1 index is
        // upgraded in memory (entries untouched) and rewritten on the next archive.
        const version = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1;
        if (version > SCHEMA_VERSION) {
            // F6.8: never downgrade an archive index written by a newer plugin.
            logger?.warn?.(`todos-diy: archive index schemaVersion ${String(version)} is newer than this plugin; leaving it untouched`);
            return { schemaVersion: version, quarters: [], unsupported: true };
        }
        if (version < SCHEMA_VERSION) {
            // F6.8 / F9.5: the index uses the same migration function as the other
            // files and is upgraded on disk so it never stays at an old version.
            const migrated = migrateIndexToCurrent(parsed);
            try {
                writeJsonAtomic(fs, paths.archiveIndex, migrated);
            }
            catch (error) {
                logger?.warn?.(`todos-diy: could not persist migrated archive index: ${String(error)}`);
            }
            return { schemaVersion: SCHEMA_VERSION, quarters: parsed.quarters };
        }
        return { schemaVersion: SCHEMA_VERSION, quarters: parsed.quarters };
    }
    catch (error) {
        logger?.warn?.(`todos-diy: archive index unreadable, rebuilding: ${String(error)}`);
        return rebuildIndex(paths, fs, logger);
    }
}
/**
 * Reconstruct the index from the quarter files present on disk.
 * @param paths - Storage paths.
 * @param fs - Filesystem seam.
 * @param logger - Logger for repairs.
 * @returns Rebuilt index.
 */
export function rebuildIndex(paths, fs, logger) {
    const quarters = [];
    // F6.8: rebuilding must not downgrade an index written by a newer plugin.
    if (fs.exists(paths.archiveIndex)) {
        try {
            const existing = JSON.parse(fs.readFile(paths.archiveIndex));
            if (typeof existing.schemaVersion === 'number' && existing.schemaVersion > SCHEMA_VERSION) {
                logger?.warn?.(`todos-diy: archive index is newer than this plugin; rebuild skipped`);
                return { schemaVersion: existing.schemaVersion, quarters: [], unsupported: true };
            }
        }
        catch {
            // An unreadable index is rebuilt below — that is this function's job.
        }
    }
    if (!fs.exists(paths.archiveDir))
        return { schemaVersion: SCHEMA_VERSION, quarters };
    let names;
    try {
        names = fs.listDir(paths.archiveDir);
    }
    catch (error) {
        logger?.warn?.(`todos-diy: archive directory unreadable: ${String(error)}`);
        return { schemaVersion: SCHEMA_VERSION, quarters };
    }
    for (const name of names) {
        const match = /^completed-(\d{4}-Q[1-4])\.json$/.exec(name);
        if (match === null)
            continue;
        const quarter = match[1];
        try {
            const file = JSON.parse(fs.readFile(join(paths.archiveDir, name)));
            // A-03: a quarter written by a newer plugin stays out of this index.
            if (typeof file.schemaVersion === 'number' && file.schemaVersion > SCHEMA_VERSION) {
                logger?.warn?.(`todos-diy: archive file ${name} is newer than this plugin; skipped`);
                continue;
            }
            let tasks = Array.isArray(file.tasks) ? file.tasks : [];
            // F6.8 / AC-41: a quarter file left at v1 is migrated **on disk** during
            // the startup rebuild, so the archive reaches the current schema without
            // a separate maintenance command.
            if ((file.schemaVersion ?? 1) < SCHEMA_VERSION) {
                try {
                    const migrated = migrateDocumentToCurrent({ ...file, tasks });
                    tasks = migrated['tasks'];
                    writeJsonAtomic(fs, join(paths.archiveDir, name), migrated);
                    logger?.warn?.(`todos-diy: migrated archive file ${name} to schemaVersion ${String(SCHEMA_VERSION)}`);
                }
                catch (migrationError) {
                    logger?.warn?.(`todos-diy: archive file ${name} could not be migrated: ${String(migrationError)}`);
                }
            }
            const bounds = quarterBounds(quarter);
            quarters.push({
                quarter,
                file: name,
                count: tasks.length,
                start: bounds?.start ?? '',
                end: bounds?.end ?? '',
            });
        }
        catch (error) {
            logger?.warn?.(`todos-diy: archive file ${name} is unreadable: ${String(error)}`);
        }
    }
    quarters.sort((left, right) => compareQuarters(left.quarter, right.quarter));
    return { schemaVersion: SCHEMA_VERSION, quarters };
}
/** Write one JSON document atomically inside the archive directory. */
function writeJsonAtomic(fs, path, value) {
    const tmp = `${path}.tmp`;
    fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`);
    fs.rename(tmp, path);
}
