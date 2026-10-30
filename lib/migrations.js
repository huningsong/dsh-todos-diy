/**
 * `schemaVersion` migration chain (F6.8 / F9.5).
 *
 * Every migration is a pure function from one document shape to the next, so
 * the chain is unit-testable without touching the filesystem. The runner
 * refuses to run on a version it does not know: a *newer* file must never be
 * "migrated" downwards.
 */
import { SCHEMA_VERSION } from './state.js';
import { migrateDocumentV2 } from './migrationV2.js';
/**
 * Registered migrations, ascending.
 *
 * v1 → v2 is the D-25 model change: drop `dueDate`, add `startAtSource` and
 * `endReminder`, and fill in the extended `TaskState`.
 */
export const MIGRATIONS = [
    {
        from: 1,
        describe: 'v1→v2: D-25 task time and status model',
        run: (raw) => migrateDocumentV2(raw),
    },
];
/**
 * Run every migration from the document's version up to `SCHEMA_VERSION`.
 *
 * Never throws: a failing step returns `ok: false`, and the caller keeps the
 * original file untouched (F9.5 "迁移失败不覆盖原文件").
 * @param raw - Parsed document with a numeric `schemaVersion`.
 * @param chain - Migration list (injectable for tests).
 * @param target - Target version (defaults to the shipped schema version).
 * @returns Migrated document, or a failure message.
 */
export function migrateState(raw, chain = MIGRATIONS, target = SCHEMA_VERSION) {
    const start = raw['schemaVersion'];
    if (typeof start !== 'number' || !Number.isInteger(start)) {
        return { ok: false, message: 'schemaVersion is missing or not an integer' };
    }
    if (start > target) {
        return { ok: false, message: `document version ${String(start)} is newer than this plugin (${String(target)})` };
    }
    const applied = [];
    let current = raw;
    let version = start;
    while (version < target) {
        const step = chain.find((migration) => migration.from === version);
        if (step === undefined) {
            return { ok: false, message: `no migration registered from version ${String(version)}` };
        }
        try {
            current = step.run(current);
        }
        catch (error) {
            return { ok: false, message: `migration from ${String(version)} failed: ${String(error)}` };
        }
        const next = current['schemaVersion'];
        if (next !== version + 1) {
            return {
                ok: false,
                message: `migration from ${String(version)} did not advance schemaVersion (got ${String(next)})`,
            };
        }
        applied.push(step.describe);
        version += 1;
    }
    return { ok: true, state: current, applied };
}
/**
 * Whether this build can read a document at all.
 * @param version - `schemaVersion` found in the file.
 * @returns True when the version is known (equal or older than current).
 */
export function isKnownVersion(version) {
    return Number.isInteger(version) && version >= 1 && version <= SCHEMA_VERSION;
}
