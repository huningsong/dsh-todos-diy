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
import type { CreateTaskInput } from './repoTypes.js';
import type { IdempotencyRecord } from './state.js';
/** Minimum length of an idempotency key. */
export declare const IDEMPOTENCY_MIN = 16;
/** Maximum length of an idempotency key. */
export declare const IDEMPOTENCY_MAX = 128;
/** How many records to keep; the oldest ones are evicted first. */
export declare const IDEMPOTENCY_LIMIT = 200;
/**
 * Validate an optional idempotency key.
 * @param value - Candidate from the API/tool payload.
 * @returns The normalized key, or null when absent.
 * @throws ValidationError `invalid_argument` when present but malformed.
 */
export declare function validateIdempotencyKey(value: unknown): string | null;
/**
 * Deterministic JSON for fingerprinting: object keys are sorted so the same
 * payload produces the same string regardless of property order.
 * @param value - Any JSON-compatible value.
 * @returns Stable JSON text.
 */
export declare function stableStringify(value: unknown): string;
/**
 * Fingerprint the writable fields of a create payload.
 *
 * Only business fields participate: a retry that adds `idempotencyKey` itself
 * must still match, and server-side defaults are not part of the comparison.
 * @param input - Create input.
 * @returns Stable fingerprint string.
 */
export declare function fingerprintCreateInput(input: CreateTaskInput): string;
/**
 * Keep the idempotency map bounded: drop the oldest records past the limit.
 * @param index - Current map.
 * @returns A map with at most {@link IDEMPOTENCY_LIMIT} entries.
 */
export declare function trimIdempotency(index: Record<string, IdempotencyRecord>): Record<string, IdempotencyRecord>;
