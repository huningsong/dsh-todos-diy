/**
 * Atomic single-file JSON storage (D-23 / F6.5).
 *
 * Write protocol: `writeFile(tmp)` → `rename(tmp, target)`. `rename` within one
 * directory is atomic on POSIX, so a reader (or a crash) only ever observes the
 * previous complete file or the new complete file — never a half-written one.
 * `fsync` is deliberately skipped (v1 accepts the documented risk: a power loss
 * right after `rename` may fall back to the previous version).
 *
 * Everything filesystem-related lives behind the `FileSystem` interface so the
 * store can be unit-tested against an in-memory double, including injected
 * `ENOSPC` / `EACCES` failures (§10.1 "存储测试").
 */
import { mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { coerceState, defaultSettings, emptyState, SCHEMA_VERSION } from './state.js';
import { migrateState } from './migrations.js';
import { storagePaths } from './paths.js';
/** Real `node:fs` implementation. */
export const nodeFileSystem = {
    readFile: (path) => readFileSync(path, 'utf8'),
    writeFile: (path, content) => writeFileSync(path, content, 'utf8'),
    rename: (from, to) => renameSync(from, to),
    unlink: (path) => unlinkSync(path),
    mkdir: (path) => mkdirSync(path, { recursive: true }),
    exists: (path) => existsSync(path),
    copyFile: (from, to) => copyFileSync(from, to),
    mtimeMs: (path) => statSync(path).mtimeMs,
};
/**
 * Create the store for one data directory.
 *
 * Loading order (F6.3): read → parse → migrate → validate → build the in-memory
 * state. No delivery can happen during load because the caller starts the timer
 * only afterwards.
 * @param options - Data directory, filesystem, logger and clock.
 * @returns Store handle.
 */
export function createStore(options) {
    const fs = options.fs ?? nodeFileSystem;
    const paths = storagePaths(options.dataDir);
    const logger = options.logger ?? {};
    const clock = options.now ?? (() => new Date());
    let state = emptyState(clock(), defaultSettings());
    let stateName = 'ready';
    /** Set when the on-disk file is newer than this build; disables every write. */
    let readOnly = false;
    let lastRecovery = null;
    let isDirty = false;
    /** Ensure the data directory exists before the first write. */
    function ensureDir() {
        if (!fs.exists(paths.dataDir))
            fs.mkdir(paths.dataDir);
    }
    /**
     * Write `state` atomically.
     * @returns True on success; false when the write failed (memory keeps the new value).
     */
    function writeAtomic() {
        if (readOnly) {
            logger.warn?.('todos-diy: refusing to write — the on-disk file is newer than this plugin');
            return false;
        }
        const tmp = `${paths.stateFile}.tmp`;
        try {
            ensureDir();
            // Keep exactly one previous generation for manual recovery (§7.7.2).
            if (fs.exists(paths.stateFile)) {
                try {
                    fs.copyFile(paths.stateFile, paths.backupFile);
                }
                catch (error) {
                    logger.warn?.(`todos-diy: could not refresh tasks.json.bak: ${String(error)}`);
                }
            }
            fs.writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`);
            fs.rename(tmp, paths.stateFile);
            isDirty = false;
            // A recovery state (corrupt / unsupported-version / migration-failed) is
            // sticky for the rest of the process: the UI must keep showing the banner
            // even though the rebuilt file itself is now writable.
            if (stateName === 'ready')
                stateName = 'ready';
            return true;
        }
        catch (error) {
            // Leave the old file intact; surface the failure instead of hiding it.
            logger.warn?.(`todos-diy: write failed: ${String(error)}`);
            try {
                if (fs.exists(tmp))
                    fs.unlink(tmp);
            }
            catch {
                // A leftover tmp file is harmless; never mask the original error.
            }
            return false;
        }
    }
    /**
     * Move a bad file aside so it is never overwritten.
     * @param reason - Short tag used in the backup file name.
     * @returns Absolute backup path, or null when the move failed.
     */
    function quarantine(reason) {
        const stamp = clock().toISOString().replace(/[:.]/g, '-');
        const target = `${paths.stateFile}.${reason}.${stamp}`;
        try {
            if (!fs.exists(paths.stateFile))
                return null;
            fs.rename(paths.stateFile, target);
            return target;
        }
        catch (error) {
            logger.warn?.(`todos-diy: could not quarantine tasks.json: ${String(error)}`);
            return null;
        }
    }
    /** Record a recovery event on the fresh document and persist it. */
    function recordRecovery(reason, message, backup) {
        lastRecovery = { at: clock().toISOString(), reason, message, backupFile: backup };
        state.meta.lastRecovery = lastRecovery;
    }
    return {
        paths,
        get state() {
            return state;
        },
        get stateName() {
            return stateName;
        },
        get lastRecovery() {
            return lastRecovery;
        },
        get readOnly() {
            return readOnly;
        },
        get dirty() {
            return isDirty;
        },
        load() {
            logger.info?.('todos-diy: load');
            if (!fs.exists(paths.stateFile)) {
                // First run: an empty state, written on the first real change.
                logger.info?.('todos-diy: ready (new store)');
                return state;
            }
            let text;
            try {
                text = fs.readFile(paths.stateFile);
            }
            catch (error) {
                stateName = 'corrupt';
                const backup = quarantine('corrupt');
                state = emptyState(clock(), defaultSettings());
                recordRecovery('corrupt', `unreadable file: ${String(error)}`, backup);
                logger.warn?.(`todos-diy: tasks.json unreadable, rebuilt empty`);
                isDirty = true;
                writeAtomic();
                return state;
            }
            let parsed;
            try {
                parsed = JSON.parse(text);
            }
            catch (error) {
                stateName = 'corrupt';
                const backup = quarantine('corrupt');
                state = emptyState(clock(), defaultSettings());
                recordRecovery('corrupt', `invalid JSON: ${String(error)}`, backup);
                logger.warn?.('todos-diy: tasks.json is not valid JSON, backed up and rebuilt');
                isDirty = true;
                writeAtomic();
                return state;
            }
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                stateName = 'corrupt';
                const backup = quarantine('corrupt');
                state = emptyState(clock(), defaultSettings());
                recordRecovery('corrupt', 'root is not an object', backup);
                logger.warn?.('todos-diy: tasks.json root is not an object, backed up and rebuilt');
                isDirty = true;
                writeAtomic();
                return state;
            }
            const raw = parsed;
            const version = raw['schemaVersion'];
            if (typeof version === 'number' && version > SCHEMA_VERSION) {
                // Data-loss guard (F6.8 / §8.3): a newer file must never be replaced.
                // The store stays read-only for the rest of the process so no create,
                // tick or archive can write a v1 document over it.
                readOnly = true;
                // Never touch a newer file: this build is too old to understand it.
                stateName = 'unsupported-version';
                const kept = emptyState(clock(), defaultSettings());
                lastRecovery = {
                    at: clock().toISOString(),
                    reason: 'unsupported-version',
                    message: `tasks.json schemaVersion ${String(version)} is newer than this plugin (${String(SCHEMA_VERSION)})`,
                    backupFile: null,
                };
                state = { ...kept, meta: { ...kept.meta, lastRecovery } };
                logger.warn?.(`todos-diy: tasks.json schemaVersion ${String(version)} unsupported; file left untouched`);
                return state;
            }
            let document = raw;
            let migratedInPlace = false;
            if (typeof version === 'number' && version < SCHEMA_VERSION) {
                logger.info?.(`todos-diy: migrate from ${String(version)} to ${String(SCHEMA_VERSION)}`);
                const migrated = migrateState(raw);
                if (!migrated.ok) {
                    stateName = 'migration-failed';
                    // F9.5: a failed migration must never overwrite the original file.
                    // The store therefore becomes read-only exactly like the
                    // unsupported-version case — otherwise the first successful create
                    // would replace the unreadable-but-recoverable file with an empty v2
                    // document.
                    readOnly = true;
                    // Deliberately NOT quarantined: the file is readable, just from a
                    // version we cannot upgrade. Moving it would violate "迁移失败不覆盖
                    // 原文件"; the operator can fix it in place.
                    const backup = null;
                    const fresh = emptyState(clock(), defaultSettings());
                    lastRecovery = {
                        at: clock().toISOString(),
                        reason: 'migration-failed',
                        message: migrated.message,
                        backupFile: backup,
                    };
                    state = { ...fresh, meta: { ...fresh.meta, lastRecovery } };
                    logger.warn?.(`todos-diy: migration failed (${migrated.message}); file preserved`);
                    return state;
                }
                document = migrated.state;
                migratedInPlace = true;
                for (const warning of migrated.warnings)
                    logger.warn?.(`todos-diy: migration: ${warning}`);
            }
            const result = coerceState(document);
            if (result.state === null) {
                stateName = result.problem.kind === 'unsupported-version' ? 'unsupported-version' : 'corrupt';
                const backup = quarantine('corrupt');
                const fresh = emptyState(clock(), defaultSettings());
                const message = result.problem.kind === 'corrupt' ? result.problem.message : 'unreadable document';
                recordRecovery('corrupt', message, backup);
                state = fresh;
                logger.warn?.(`todos-diy: tasks.json validation failed (${message}); rebuilt empty`);
                return state;
            }
            for (const warning of result.warnings)
                logger.warn?.(`todos-diy: ${warning}`);
            state = result.state;
            if (result.warnings.length > 0)
                isDirty = true;
            if (migratedInPlace) {
                // F6.8 / F9.5: persist the upgraded document right away so the on-disk
                // file is at the current schema even if nothing else changes this run.
                isDirty = true;
                writeAtomic();
            }
            logger.info?.(`todos-diy: ready (${String(state.tasks.length)} task(s))`);
            return state;
        },
        set(next) {
            if (readOnly) {
                logger.warn?.('todos-diy: ignoring a write to a read-only store');
                return;
            }
            state = next;
            state.meta.updatedAt = clock().toISOString();
            isDirty = true;
        },
        markDirty() {
            isDirty = true;
        },
        flush() {
            if (!isDirty)
                return true;
            return writeAtomic();
        },
        flushSync() {
            if (isDirty)
                writeAtomic();
        },
        fileMtimeMs() {
            try {
                return fs.exists(paths.stateFile) ? fs.mtimeMs(paths.stateFile) : null;
            }
            catch {
                return null;
            }
        },
    };
}
export { storagePaths };
export { dirname };
