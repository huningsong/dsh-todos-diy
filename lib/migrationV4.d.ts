/**
 * `schemaVersion 3 → 4` (F5.13 / UX-30): add the global desktop-notification
 * setting. The task shape is intentionally unchanged; this migration only
 * fills the new settings field with the safe default (off).
 */
/**
 * Upgrade a main/quarter document to v4.
 * @param raw - v3 document.
 * @param _warnings - Warning sink (unused; kept for the Migration signature).
 * @returns v4 document with `settings.desktopNotifications.enabled=false`.
 */
export declare function migrateDocumentV4(raw: Record<string, unknown>, _warnings?: string[]): Record<string, unknown>;
/**
 * Upgrade an archive index to v4 (indexes carry no settings, only the version).
 * @param raw - v1/v2/v3 index.
 * @returns v4 index.
 */
export declare function migrateIndexV4(raw: Record<string, unknown>): Record<string, unknown>;
