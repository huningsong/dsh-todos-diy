/**
 * Idempotent task creation (F7.15).
 *
 * Split from `repo.ts` to stay inside the NF5 line budget. The function takes
 * the store and the small mutation helpers it needs, so the write queue and the
 * read-only guard remain owned by the repository.
 */
import type { Store } from './store.js';
import type { CreateResult, CreateTaskInput } from './repoTypes.js';
import type { Task } from './rules/types.js';
/** Helpers the repository lends to the create path. */
export interface CreateDeps {
    store: Store;
    clock: () => Date;
    assertWritable: () => void;
    touch: () => void;
    build: (input: CreateTaskInput, now: Date) => Task;
}
/**
 * Create a task with optional idempotency.
 *
 * - no key: plain create;
 * - new key: create and remember `key → {taskId, fingerprint}`;
 * - same key + same fingerprint: return the original task with `replayed: true`;
 * - same key + different fingerprint: `conflict`;
 * - same key whose task was purged: create a fresh one and replace the record.
 * @param input - Create payload.
 * @param deps - Store and mutation helpers.
 * @returns The task plus the replay flag.
 * @throws ValidationError `invalid_argument` / `conflict`.
 */
export declare function runIdempotentCreate(input: CreateTaskInput, deps: CreateDeps): CreateResult;
