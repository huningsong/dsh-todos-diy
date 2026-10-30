/**
 * `schemaVersion 2 → 3` (F11.2): add the completion-event log.
 *
 * The event list starts empty on purpose: one-off history is still derivable
 * from `Task.doneAt`, while recurring completions before this version were
 * never persisted and must not be invented.
 */
import { migrateDocumentV2, migrateIndexV2 } from './migrationV2.js';
/**
 * Upgrade a main/quarter document to v3.
 * @param raw - v2 document.
 * @param _warnings - Warning sink (unused; kept for the Migration signature).
 * @returns v3 document with `completionEvents`.
 */
export function migrateDocumentV3(raw, _warnings = []) {
    return {
        ...raw,
        schemaVersion: 3,
        completionEvents: Array.isArray(raw['completionEvents']) ? raw['completionEvents'] : [],
    };
}
/**
 * Upgrade an archive index to v3 (indexes carry no events, only the version).
 * @param raw - v1 or v2 index.
 * @returns v3 index.
 */
export function migrateIndexV3(raw) {
    return { ...raw, schemaVersion: 3 };
}
/**
 * Bring an archive index of any known version up to the current one.
 * @param raw - Index document.
 * @returns Index at `SCHEMA_VERSION` shape.
 */
export function migrateIndexToCurrent(raw) {
    const version = typeof raw['schemaVersion'] === 'number' ? raw['schemaVersion'] : 1;
    let next = raw;
    if (version < 2)
        next = migrateIndexV2(next);
    const afterV2 = typeof next['schemaVersion'] === 'number' ? next['schemaVersion'] : 2;
    if (afterV2 < 3)
        next = migrateIndexV3(next);
    return next;
}
/**
 * Bring a main/quarter document of any known version up to v3.
 * @param raw - Document.
 * @param warnings - Warning sink.
 * @returns Document at `SCHEMA_VERSION`.
 */
export function migrateDocumentToCurrent(raw, warnings = []) {
    const version = typeof raw['schemaVersion'] === 'number' ? raw['schemaVersion'] : 1;
    let next = raw;
    if (version < 2)
        next = migrateDocumentV2(next, warnings);
    const afterV2 = typeof next['schemaVersion'] === 'number' ? next['schemaVersion'] : 2;
    if (afterV2 < 3)
        next = migrateDocumentV3(next, warnings);
    return next;
}
