/**
 * Coercion for the small records stored next to tasks: delivery rows and
 * recovery notices. Split from `state.ts` to stay inside the NF5 budget.
 */
import type { DeliveryRecord, RecoveryRecord } from './state.js';
/** Coerce a delivery record; invalid entries are dropped silently. */
export declare function coerceDelivery(raw: unknown): DeliveryRecord | null;
/** Coerce a recovery record. */
export declare function coerceRecovery(raw: unknown): RecoveryRecord | null;
