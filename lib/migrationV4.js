/**
 * `schemaVersion 3 → 4` (F5.13 / UX-30): add the global desktop-notification
 * setting. The task shape is intentionally unchanged; this migration only
 * fills the new settings field with the safe default (off).
 */
/** Whether a value is a plain object (not an array, not null). */
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/**
 * Upgrade a main/quarter document to v4.
 * @param raw - v3 document.
 * @param _warnings - Warning sink (unused; kept for the Migration signature).
 * @returns v4 document with `settings.desktopNotifications.enabled=false`.
 */
export function migrateDocumentV4(raw, _warnings = []) {
    const settings = isRecord(raw['settings']) ? { ...raw['settings'] } : {};
    const desktop = isRecord(settings['desktopNotifications']) ? settings['desktopNotifications'] : {};
    return {
        ...raw,
        schemaVersion: 4,
        settings: {
            ...settings,
            desktopNotifications: { enabled: desktop['enabled'] === true },
        },
    };
}
/**
 * Upgrade an archive index to v4 (indexes carry no settings, only the version).
 * @param raw - v1/v2/v3 index.
 * @returns v4 index.
 */
export function migrateIndexV4(raw) {
    return { ...raw, schemaVersion: 4 };
}
