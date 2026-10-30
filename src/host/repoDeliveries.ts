/**
 * Delivery-log operations (F5.5 / D-16).
 *
 * Split from `repo.ts` to stay inside the NF5 line budget. The log is append-only
 * with `occurrenceKey + channel` de-duplication and a 1000-row cap.
 */

import type { DeliveryRecord } from './state.js'
import type { Store } from './store.js'
import type { WriteQueue } from './writeQueue.js'

/** Helpers the repository lends to the delivery log. */
export interface DeliveryDeps {
  store: Store
  queue: WriteQueue
  assertWritable: () => void
  touch: () => void
}

/** The delivery-log slice of the repository. */
export interface DeliveryOps {
  deliveries(): readonly DeliveryRecord[]
  recordDelivery(record: DeliveryRecord): Promise<void>
  recordDeliveries(records: DeliveryRecord[]): Promise<void>
  replaceDeliveries(records: DeliveryRecord[]): Promise<void>
}

/**
 * Build the delivery-log operations.
 * @param deps - Store, write queue and mutation guards.
 * @returns Delivery operations bound to that store.
 */
export function createDeliveryOps(deps: DeliveryDeps): DeliveryOps {
  const { store, queue, assertWritable, touch } = deps
  const recordDeliveries = async (incoming: DeliveryRecord[]): Promise<void> =>
    queue.run(() => {
      assertWritable()
      for (const record of incoming) {
        // Same `occurrenceKey + channel` only ever succeeds once (F5.5).
        const existing = store.state.deliveries.find(
          (entry) => entry.occurrenceKey === record.occurrenceKey && entry.channel === record.channel,
        )
        if (existing !== undefined) continue
        store.state.deliveries.push(record)
      }
      // D-16: keep the most recent 1000 records.
      if (store.state.deliveries.length > 1000) store.state.deliveries = store.state.deliveries.slice(-1000)
      touch()
    })
  return {
    deliveries: () => store.state.deliveries,
    recordDelivery: (record) => recordDeliveries([record]),
    recordDeliveries,
    replaceDeliveries: async (records) =>
      queue.run(() => {
        assertWritable()
        store.state.deliveries = [...records]
        touch()
      }),
  }
}
