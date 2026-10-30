/**
 * Idempotent task creation (F7.15).
 *
 * Split from `repo.ts` to stay inside the NF5 line budget. The function takes
 * the store and the small mutation helpers it needs, so the write queue and the
 * read-only guard remain owned by the repository.
 */

import type { Store } from './store.js'
import type { CreateResult, CreateTaskInput } from './repoTypes.js'
import type { Task } from './rules/types.js'
import { fingerprintCreateInput, trimIdempotency, validateIdempotencyKey } from './idempotency.js'
import { ValidationError } from './validationError.js'

/** Helpers the repository lends to the create path. */
export interface CreateDeps {
  store: Store
  clock: () => Date
  assertWritable: () => void
  touch: () => void
  build: (input: CreateTaskInput, now: Date) => Task
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
export function runIdempotentCreate(input: CreateTaskInput, deps: CreateDeps): CreateResult {
  const { store, clock, assertWritable, touch, build } = deps
  assertWritable()
  const key = validateIdempotencyKey(input.idempotencyKey)
  const now = clock()
  const index = store.state.meta.idempotency ?? {}
  if (key !== null) {
    const existing = index[key]
    if (existing !== undefined) {
      const sameInput = existing.fingerprint === fingerprintCreateInput(input)
      const original = store.state.tasks.find((task) => task.id === existing.taskId)
      if (!sameInput) {
        throw new ValidationError('conflict', 'idempotencyKey was already used with a different payload', {
          currentRevision: original?.revision,
          field: 'idempotencyKey',
        })
      }
      if (original !== undefined) return { task: original, replayed: true }
    }
  }
  const task = build(input, now)
  store.state.tasks.push(task)
  if (key !== null) {
    index[key] = { taskId: task.id, fingerprint: fingerprintCreateInput(input), at: now.toISOString() }
    store.state.meta.idempotency = trimIdempotency(index)
  }
  touch()
  return { task, replayed: false }
}
