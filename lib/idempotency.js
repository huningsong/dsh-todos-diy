/**
 * Idempotent task creation (F7.15).
 *
 * An Agent retrying a create after a network timeout must not end up with two
 * tasks (and therefore two reminder series). The client supplies a key; the
 * host records `key → {taskId, fingerprint}` and replays the original task
 * when the same key arrives again.
 *
 * Storage: `meta.idempotency` — an optional map in the existing v2 document, so
 * no schema migration is needed. It is capped with a FIFO trim to keep the file
 * bounded.
 */
import { ValidationError } from './validationError.js';
/** Minimum length of an idempotency key. */
export const IDEMPOTENCY_MIN = 16;
/** Maximum length of an idempotency key. */
export const IDEMPOTENCY_MAX = 128;
/** How many records to keep; the oldest ones are evicted first. */
export const IDEMPOTENCY_LIMIT = 200;
/**
 * Validate an optional idempotency key.
 * @param value - Candidate from the API/tool payload.
 * @returns The normalized key, or null when absent.
 * @throws ValidationError `invalid_argument` when present but malformed.
 */
export function validateIdempotencyKey(value) {
    if (value === undefined || value === null || value === '')
        return null;
    if (typeof value !== 'string') {
        throw new ValidationError('invalid_argument', 'idempotencyKey must be a string', { field: 'idempotencyKey' });
    }
    const trimmed = value.trim();
    if (trimmed.length < IDEMPOTENCY_MIN || trimmed.length > IDEMPOTENCY_MAX) {
        throw new ValidationError('invalid_argument', `idempotencyKey must be ${String(IDEMPOTENCY_MIN)}–${String(IDEMPOTENCY_MAX)} characters`, { field: 'idempotencyKey' });
    }
    return trimmed;
}
/**
 * Deterministic JSON for fingerprinting: object keys are sorted so the same
 * payload produces the same string regardless of property order.
 * @param value - Any JSON-compatible value.
 * @returns Stable JSON text.
 */
export function stableStringify(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value))
        return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
    const record = value;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}
/**
 * Fingerprint the writable fields of a create payload.
 *
 * Only business fields participate: a retry that adds `idempotencyKey` itself
 * must still match, and server-side defaults are not part of the comparison.
 * @param input - Create input.
 * @returns Stable fingerprint string.
 */
export function fingerprintCreateInput(input) {
    const payload = {
        title: input.title,
        description: input.description ?? '',
        kind: input.kind,
        rule: input.rule ?? null,
        once: input.once ?? null,
        notify: input.notify ?? null,
        timeZone: input.timeZone ?? null,
        pinned: input.pinned === true,
    };
    return stableStringify(payload);
}
/**
 * Keep the idempotency map bounded: drop the oldest records past the limit.
 * @param index - Current map.
 * @returns A map with at most {@link IDEMPOTENCY_LIMIT} entries.
 */
export function trimIdempotency(index) {
    const entries = Object.entries(index);
    if (entries.length <= IDEMPOTENCY_LIMIT)
        return index;
    entries.sort((left, right) => (left[1].at < right[1].at ? -1 : left[1].at > right[1].at ? 1 : 0));
    return Object.fromEntries(entries.slice(entries.length - IDEMPOTENCY_LIMIT));
}
