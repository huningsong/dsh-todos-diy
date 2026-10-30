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
import { join } from 'node:path';
import { readArchiveIndex } from './archive.js';
import { SCHEMA_VERSION } from './state.js';
import { migrateIndexV2, migrateTaskV2 } from './migrationV2.js';
/**
 * Find which quarter file holds a task id.
 * @param id - Task id.
 * @param paths - Storage paths.
 * @param fs - Filesystem seam.
 * @returns Quarter label and its task, or null.
 */
export function findArchivedTask(id, paths, fs) {
    const index = readArchiveIndex(paths, fs);
    for (const entry of index.quarters) {
        const filePath = join(paths.archiveDir, entry.file);
        if (!fs.exists(filePath))
            continue;
        let parsed;
        try {
            parsed = JSON.parse(fs.readFile(filePath));
        }
        catch {
            continue;
        }
        const task = (parsed.tasks ?? []).find((candidate) => candidate.id === id);
        if (task !== undefined)
            return { quarter: entry.quarter, task };
    }
    return null;
}
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
export function restoreArchivedTask(state, id, paths, fs, now, persist = () => undefined) {
    const found = findArchivedTask(id, paths, fs);
    if (found === null)
        return { restored: false, reason: 'not-archived' };
    const filePath = join(paths.archiveDir, `completed-${found.quarter}.json`);
    let parsed;
    try {
        parsed = JSON.parse(fs.readFile(filePath));
    }
    catch {
        return { restored: false, reason: 'corrupt' };
    }
    // A v1 quarter file is migrated through the shared task migration first.
    let migratedTask;
    try {
        const source = (parsed.schemaVersion ?? 1) < SCHEMA_VERSION
            ? migrateTaskV2(found.task)
            : found.task;
        migratedTask = source;
    }
    catch {
        return { restored: false, reason: 'corrupt' };
    }
    // Step 1: rebuild the live task and persist it before touching the archive.
    const restored = {
        ...migratedTask,
        status: 'active',
        doneAt: null,
        archivedQuarter: null,
        pinned: false,
        revision: migratedTask.revision + 1,
        updatedAt: now.toISOString(),
    };
    state.tasks.push(restored);
    persist(state);
    // Step 2: drop the entry from the quarter file.
    const remaining = (parsed.tasks ?? []).filter((task) => task.id !== id);
    const tmp = `${filePath}.tmp`;
    fs.writeFile(tmp, `${JSON.stringify({ ...parsed, schemaVersion: SCHEMA_VERSION, tasks: remaining }, null, 2)}\n`);
    fs.rename(tmp, filePath);
    // Step 3: refresh the index; drop the quarter entirely when it is now empty.
    const index = readArchiveIndex(paths, fs);
    const entry = index.quarters.find((candidate) => candidate.quarter === found.quarter);
    if (entry !== undefined) {
        entry.count = remaining.length;
        if (remaining.length === 0) {
            index.quarters = index.quarters.filter((candidate) => candidate.quarter !== found.quarter);
        }
        const nextIndex = migrateIndexV2({ schemaVersion: index.schemaVersion, quarters: index.quarters });
        const indexTmp = `${paths.archiveIndex}.tmp`;
        fs.writeFile(indexTmp, `${JSON.stringify(nextIndex, null, 2)}\n`);
        fs.rename(indexTmp, paths.archiveIndex);
    }
    return { restored: true, task: restored, quarter: found.quarter };
}
