/**
 * `schemaVersion` 1 → 2: the D-25 task time and status model.
 *
 * Four call sites share this exact function (F9.5):
 *   1. `tasks.json`
 *   2. `archive/completed-*.json`
 *   3. `archive/index.json` (version bump only, entries untouched)
 *   4. `POST /import`
 *
 * Rules frozen by the handoff:
 *  - drop `dueDate`;
 *  - keep `once.startAt`, set `startAtSource="explicit"` when it was present;
 *  - add `notify.endReminder=true` and the full `TaskState` defaults;
 *  - a v1 one-off task **without** `endAt` is a hard failure: the caller keeps
 *    the original file and reports `migration-failed` instead of guessing.
 */
/** A migration that cannot be applied without inventing data. */
export declare class MigrationError extends Error {
}
/**
 * Migrate one task object from v1 to v2.
 * @param raw - v1 task.
 * @returns The v2 task (a new object).
 * @throws MigrationError when a one-off task has no `endAt`.
 */
export declare function migrateTaskV2(raw: Record<string, unknown>): Record<string, unknown>;
/**
 * Migrate a whole document (main file or archive quarter file) from v1 to v2.
 * @param raw - v1 document.
 * @returns The v2 document.
 * @throws MigrationError when any task cannot be migrated safely.
 */
export declare function migrateDocumentV2(raw: Record<string, unknown>): Record<string, unknown>;
/**
 * Migrate `archive/index.json`: only the version bumps, entries stay identical.
 * @param raw - v1 index document.
 * @returns The v2 index document.
 */
export declare function migrateIndexV2(raw: Record<string, unknown>): Record<string, unknown>;
