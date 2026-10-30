/**
 * Guard shared by every repository mutation (F6.8).
 *
 * Without it the HTTP layer would answer 201 while the write is silently
 * dropped, and the task would vanish on the next restart.
 */
import type { Store } from './store.js';
/**
 * Throw when the store is read-only.
 * @param store - Store backing the repository.
 * @throws ValidationError `storage_read_only` when writes are disabled.
 */
export declare function assertStoreWritable(store: Pick<Store, 'readOnly'>): void;
