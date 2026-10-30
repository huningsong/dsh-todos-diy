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
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
/**
 * The quarter a `doneAt` instant belongs to, in the **task's** time zone.
 * @param iso - Completion instant.
 * @param timeZone - Task time zone.
 * @returns `YYYY-Qn`.
 */
export function quarterOf(iso, timeZone) {
    const instant = Date.parse(iso);
    if (Number.isNaN(instant))
        return '1970-Q1';
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
    }).formatToParts(new Date(instant));
    const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
    const month = Number(parts.find((part) => part.type === 'month')?.value ?? '1');
    return `${year}-Q${String(Math.floor((month - 1) / 3) + 1)}`;
}
/**
 * The quarter that contains `now`, in a zone.
 * @param now - Current instant.
 * @param timeZone - Zone identifier.
 * @returns `YYYY-Qn`.
 */
export function currentQuarter(now, timeZone) {
    return quarterOf(now.toISOString(), timeZone);
}
/**
 * Compare two `YYYY-Qn` labels.
 * @param left - First quarter.
 * @param right - Second quarter.
 * @returns Negative when `left` is earlier.
 */
export function compareQuarters(left, right) {
    const [leftYear, leftQuarter] = left.split('-Q').map(Number);
    const [rightYear, rightQuarter] = right.split('-Q').map(Number);
    if (leftYear !== rightYear)
        return (leftYear ?? 0) - (rightYear ?? 0);
    return (leftQuarter ?? 0) - (rightQuarter ?? 0);
}
/** Inclusive UTC bounds of a quarter label. */
export function quarterBounds(quarter) {
    const match = /^(\d{4})-Q([1-4])$/.exec(quarter);
    if (match === null)
        return null;
    const year = Number(match[1]);
    const index = Number(match[2]) - 1;
    const startMonth = index * 3;
    const start = Date.UTC(year, startMonth, 1);
    const end = Date.UTC(year, startMonth + 3, 1) - 1;
    return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}
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
        return { schemaVersion: parsed.schemaVersion ?? 1, quarters: parsed.quarters };
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
    if (!fs.exists(paths.archiveDir))
        return { schemaVersion: 1, quarters };
    let names;
    try {
        names = fs.listDir(paths.archiveDir);
    }
    catch (error) {
        logger?.warn?.(`todos-diy: archive directory unreadable: ${String(error)}`);
        return { schemaVersion: 1, quarters };
    }
    for (const name of names) {
        const match = /^completed-(\d{4}-Q[1-4])\.json$/.exec(name);
        if (match === null)
            continue;
        const quarter = match[1];
        try {
            const file = JSON.parse(fs.readFile(join(paths.archiveDir, name)));
            const tasks = Array.isArray(file.tasks) ? file.tasks : [];
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
    return { schemaVersion: 1, quarters };
}
/** Write one JSON document atomically inside the archive directory. */
function writeJsonAtomic(fs, path, value) {
    const tmp = `${path}.tmp`;
    fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`);
    fs.rename(tmp, path);
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
export function archiveCompleted(state, options) {
    const { paths, fs, now, timeZone } = options;
    const keepQuarter = options.keepQuarter ?? currentQuarter(now, timeZone);
    const logger = options.logger ?? {};
    const toArchive = state.tasks.filter((task) => task.status === 'done' &&
        task.doneAt !== null &&
        compareQuarters(quarterOf(task.doneAt, task.rule?.timeZone ?? timeZone), keepQuarter) < 0);
    if (toArchive.length === 0)
        return { archived: [], skipped: [], duplicatesRemoved: 0 };
    if (!fs.exists(paths.archiveDir))
        fs.mkdir(paths.archiveDir);
    const index = readArchiveIndex(paths, fs, logger);
    const byQuarter = new Map();
    for (const task of toArchive) {
        const quarter = quarterOf(task.doneAt, task.rule?.timeZone ?? timeZone);
        const bucket = byQuarter.get(quarter);
        if (bucket === undefined)
            byQuarter.set(quarter, [task]);
        else
            bucket.push(task);
    }
    const archived = [];
    for (const [quarter, tasks] of [...byQuarter.entries()].sort((left, right) => compareQuarters(left[0], right[0]))) {
        const fileName = `completed-${quarter}.json`;
        const filePath = join(paths.archiveDir, fileName);
        let existing = [];
        if (fs.exists(filePath)) {
            try {
                const parsed = JSON.parse(fs.readFile(filePath));
                existing = Array.isArray(parsed.tasks) ? parsed.tasks : [];
            }
            catch (error) {
                logger.warn?.(`todos-diy: archive file ${fileName} unreadable, skipping quarter: ${String(error)}`);
                archived.push({ quarter, count: 0 });
                continue;
            }
        }
        const merged = new Map();
        for (const task of existing)
            merged.set(task.id, task);
        for (const task of tasks)
            merged.set(task.id, { ...task, archivedQuarter: quarter });
        const tasksOut = [...merged.values()];
        writeJsonAtomic(fs, filePath, { schemaVersion: 1, quarter, tasks: tasksOut });
        const bounds = quarterBounds(quarter);
        const entryIndex = index.quarters.findIndex((entry) => entry.quarter === quarter);
        const entry = {
            quarter,
            file: fileName,
            count: tasksOut.length,
            start: bounds?.start ?? '',
            end: bounds?.end ?? '',
        };
        if (entryIndex === -1)
            index.quarters.push(entry);
        else
            index.quarters[entryIndex] = entry;
        archived.push({ quarter, count: tasks.length });
    }
    // Step 2: only now drop the archived ids from the main document.
    const archivedIds = new Set(toArchive.map((task) => task.id));
    state.tasks = state.tasks.filter((task) => !archivedIds.has(task.id));
    // Step 3: refresh the index.
    index.quarters.sort((left, right) => compareQuarters(left.quarter, right.quarter));
    writeJsonAtomic(fs, paths.archiveIndex, { schemaVersion: 1, quarters: index.quarters });
    logger.info?.(`todos-diy: archived ${String(toArchive.length)} completed task(s)`);
    return { archived, skipped: [], duplicatesRemoved: 0 };
}
/**
 * Startup reconciliation for a crash between the archive write and the main
 * write: any task id present in both places is removed from the main file.
 * @param state - Main document (mutated in place).
 * @param paths - Storage paths.
 * @param fs - Filesystem seam.
 * @param logger - Logger for repairs.
 * @returns Number of duplicate rows removed.
 */
export function reconcileArchive(state, paths, fs, logger) {
    if (!fs.exists(paths.archiveDir))
        return 0;
    const archivedIds = new Set();
    let removed = 0;
    for (const entry of readArchiveIndex(paths, fs, logger).quarters) {
        const filePath = join(paths.archiveDir, entry.file);
        if (!fs.exists(filePath))
            continue;
        try {
            const parsed = JSON.parse(fs.readFile(filePath));
            for (const task of parsed.tasks ?? [])
                archivedIds.add(task.id);
        }
        catch (error) {
            logger?.warn?.(`todos-diy: archive file ${entry.file} unreadable during reconcile: ${String(error)}`);
        }
    }
    if (archivedIds.size === 0)
        return 0;
    const before = state.tasks.length;
    state.tasks = state.tasks.filter((task) => !archivedIds.has(task.id));
    removed = before - state.tasks.length;
    if (removed > 0)
        logger?.warn?.(`todos-diy: reconciled ${String(removed)} archived duplicate(s)`);
    return removed;
}
/**
 * Read one quarter's archived tasks, plus the index entry.
 * @param quarter - Quarter label.
 * @param paths - Storage paths.
 * @param fs - Filesystem seam.
 * @returns Tasks and entry, or null when the quarter is unknown.
 */
export function readQuarter(quarter, paths, fs) {
    const index = readArchiveIndex(paths, fs);
    const entry = index.quarters.find((candidate) => candidate.quarter === quarter);
    if (entry === undefined)
        return null;
    const filePath = join(paths.archiveDir, entry.file);
    if (!fs.exists(filePath))
        return null;
    try {
        const parsed = JSON.parse(fs.readFile(filePath));
        return { tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [], entry };
    }
    catch {
        return null;
    }
}
/** Real `node:fs` implementation of the archive seam. */
export const nodeArchiveFs = {
    readFile: (path) => readFileSync(path, 'utf8'),
    writeFile: (path, content) => writeFileSync(path, content, 'utf8'),
    rename: (from, to) => renameSync(from, to),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
    exists: (path) => existsSync(path),
    listDir: (path) => readdirSync(path),
};
