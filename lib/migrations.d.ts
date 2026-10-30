/**
 * `schemaVersion` migration chain (F6.8 / F9.5).
 *
 * Every migration is a pure function from one document shape to the next, so
 * the chain is unit-testable without touching the filesystem. The runner
 * refuses to run on a version it does not know: a *newer* file must never be
 * "migrated" downwards.
 */
import { type PersistedState } from './state.js';
/** One upgrade step: from `from` to `from + 1`. */
export interface Migration {
    from: number;
    /** Short description used in logs and in the failure message. */
    describe: string;
    /**
     * Upgrade one document.
     * @param raw - Document at version `from`.
     * @returns Document at version `from + 1`.
     */
    run(raw: Record<string, unknown>): Record<string, unknown>;
}
/**
 * Registered migrations, ascending.
 *
 * v1 is the first shipped schema, so the chain is empty today. Adding v2 means
 * appending `{ from: 1, ... }` here and bumping `SCHEMA_VERSION`; nothing else
 * in the storage layer changes.
 */
export declare const MIGRATIONS: readonly Migration[];
/** Result of running the chain. */
export type MigrateResult = {
    ok: true;
    state: Record<string, unknown>;
    applied: string[];
} | {
    ok: false;
    message: string;
};
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
export declare function migrateState(raw: Record<string, unknown>, chain?: readonly Migration[], target?: number): MigrateResult;
/**
 * Whether this build can read a document at all.
 * @param version - `schemaVersion` found in the file.
 * @returns True when the version is known (equal or older than current).
 */
export declare function isKnownVersion(version: number): boolean;
/** Re-export for callers that only need the constant. */
export type { PersistedState };
