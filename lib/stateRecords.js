/**
 * Coercion for the small records stored next to tasks: delivery rows and
 * recovery notices. Split from `state.ts` to stay inside the NF5 budget.
 */
/** Whether a value is a plain object (not an array, not null). */
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Read a nullable ISO string; anything unparseable becomes null. */
function nullableIso(value) {
    if (typeof value !== 'string' || value === '')
        return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}
/** Read a string or fall back. */
function str(value, fallback) {
    return typeof value === 'string' ? value : fallback;
}
/** Coerce a delivery record; invalid entries are dropped silently. */
export function coerceDelivery(raw) {
    if (!isRecord(raw))
        return null;
    const key = raw['occurrenceKey'];
    const channel = raw['channel'];
    const status = raw['status'];
    const at = nullableIso(raw['at']);
    if (typeof key !== 'string' || at === null)
        return null;
    if (channel !== 'overlay' && channel !== 'system')
        return null;
    if (status !== 'ok' && status !== 'failed' && status !== 'skipped')
        return null;
    return {
        occurrenceKey: key,
        channel,
        status,
        at,
        readAt: nullableIso(raw['readAt']),
        ignoredAt: nullableIso(raw['ignoredAt']),
        dismissedAt: nullableIso(raw['dismissedAt']),
        error: typeof raw['error'] === 'string' ? raw['error'] : null,
    };
}
/** Coerce a recovery record. */
export function coerceRecovery(raw) {
    if (!isRecord(raw))
        return null;
    const reason = raw['reason'];
    if (reason !== 'corrupt' && reason !== 'unsupported-version' && reason !== 'migration-failed' && reason !== 'missing') {
        return null;
    }
    return {
        at: nullableIso(raw['at']) ?? new Date(0).toISOString(),
        reason,
        message: str(raw['message'], ''),
        backupFile: typeof raw['backupFile'] === 'string' ? raw['backupFile'] : null,
    };
}
