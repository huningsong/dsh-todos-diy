/**
 * `schemaVersion 2 → 3` (F11.2): add the completion-event log.
 *
 * The event list starts empty on purpose: one-off history is still derivable
 * from `Task.doneAt`, while recurring completions before this version were
 * never persisted and must not be invented.
 */
/**
 * Upgrade a main/quarter document to v3.
 * @param raw - v2 document.
 * @param _warnings - Warning sink (unused; kept for the Migration signature).
 * @returns v3 document with `completionEvents`.
 */
export declare function migrateDocumentV3(raw: Record<string, unknown>, _warnings?: string[]): Record<string, unknown>;
/**
 * Upgrade an archive index to v3 (indexes carry no events, only the version).
 * @param raw - v1 or v2 index.
 * @returns v3 index.
 */
export declare function migrateIndexV3(raw: Record<string, unknown>): Record<string, unknown>;
/**
 * Bring an archive index of any known version up to the current one.
 * @param raw - Index document.
 * @returns Index at `SCHEMA_VERSION` shape.
 */
export declare function migrateIndexToCurrent(raw: Record<string, unknown>): Record<string, unknown>;
/**
 * Bring a main/quarter document of any known version up to v3.
 * @param raw - Document.
 * @param warnings - Warning sink.
 * @returns Document at `SCHEMA_VERSION`.
 */
export declare function migrateDocumentToCurrent(raw: Record<string, unknown>, warnings?: string[]): Record<string, unknown>;
