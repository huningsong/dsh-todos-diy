/**
 * Delivery-log operations (F5.5 / D-16).
 *
 * Split from `repo.ts` to stay inside the NF5 line budget. The log is append-only
 * with `occurrenceKey + channel` de-duplication and a 1000-row cap.
 */
import type { DeliveryRecord } from './state.js';
import type { Store } from './store.js';
import type { WriteQueue } from './writeQueue.js';
/** Helpers the repository lends to the delivery log. */
export interface DeliveryDeps {
    store: Store;
    queue: WriteQueue;
    assertWritable: () => void;
    touch: () => void;
}
/** The delivery-log slice of the repository. */
export interface DeliveryOps {
    deliveries(): readonly DeliveryRecord[];
    recordDelivery(record: DeliveryRecord): Promise<void>;
    recordDeliveries(records: DeliveryRecord[]): Promise<void>;
    replaceDeliveries(records: DeliveryRecord[]): Promise<void>;
}
/**
 * Build the delivery-log operations.
 * @param deps - Store, write queue and mutation guards.
 * @returns Delivery operations bound to that store.
 */
export declare function createDeliveryOps(deps: DeliveryDeps): DeliveryOps;
