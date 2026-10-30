/**
 * Coercion for the small records stored next to tasks: delivery rows and
 * recovery notices. Split from `state.ts` to stay inside the NF5 budget.
 */
import type { CompletionEvent, DeliveryRecord, IdempotencyRecord, RecoveryRecord } from './state.js';
/** Coerce a delivery record; invalid entries are dropped silently. */
export declare function coerceDelivery(raw: unknown): DeliveryRecord | null;
/** Coerce a recovery record. */
export declare function coerceRecovery(raw: unknown): RecoveryRecord | null;
/**
 * Coerce one completion event; malformed entries are dropped.
 * @param raw - Candidate from a stored file.
 * @returns A clean event, or null.
 */
export declare function coerceCompletionEvent(raw: unknown): CompletionEvent | null;
/**
 * Coerce the idempotency index, dropping malformed entries.
 * @param raw - Candidate map from a stored file.
 * @returns A clean map (empty when absent).
 */
export declare function coerceIdempotency(raw: unknown): Record<string, IdempotencyRecord>;
