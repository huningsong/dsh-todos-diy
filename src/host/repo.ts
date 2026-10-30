/**
 * Repository: the single write path for HTTP routes **and** agent tools
 * (F7.11). Mutations are serialized through a FIFO queue; the physical write is
 * debounced so a burst of edits coalesces (F6.9), and disposal forces a flush
 * (F6.6).
 *
 * The repository never formats times for display and never decides "today" —
 * both are arguments, keeping the layer testable.
 */

import type { DeliveryRecord, Settings } from './state.js'
import { canTransition, describeTransition } from './stateMachine.js'
import type { Store } from './store.js'
import type { Task } from './rules/types.js'
import { sweepExpiredArchives } from './retention.js'
import { assertStoreWritable } from './repoGuard.js'
import { applyTickChange } from './repoTick.js'
import { localDateKey } from './rules/timezone.js'
import { createDebouncedFlush, createWriteQueue, type WriteQueue } from './writeQueue.js'
import { computeNextTransition, queryTasks } from './repoQuery.js'
import { buildTask, patchTask } from './repoBuild.js'
import type {
  CreateResult,
  CreateTaskInput,
  ListQuery,
  ListResult,
  Repository,
  RepositoryOptions,
  TickChange,
  UpdateTaskPatch,
} from './repoTypes.js'
import { ValidationError } from './validate.js'
import { nextFireAt, occurrenceKey as occurrenceKeyFor } from './rules/occurrence.js'
import { runIdempotentCreate } from './repoCreate.js'
import { appendCompletionEvent, makeCompletionEvent } from './completionEvents.js'
import { createDeliveryOps } from './repoDeliveries.js'
import { quarterOf } from './quarter.js'
import type { HolidayTable } from './rules/holidays.js'

export type {
  CompleteResult,
  CreateTaskInput,
  ListQuery,
  ListResult,
  Repository,
  RepositoryOptions,
  TickChange,
  UpdateTaskPatch,
} from './repoTypes.js'

/**
 * Create the repository over a loaded store.
 * @param options - Store, clock and debounce window.
 * @returns Repository handle.
 */
export function createRepository(options: RepositoryOptions): Repository {
  const store: Store = options.store
  const clock = options.now ?? (() => new Date())
  const holidays: HolidayTable | undefined = options.holidays
  const archiveDone = options.archiveDone ?? (() => 0)

  /** Resolver for a recurring task's next fire instant (D-25 priority/sort). */
  const nextAtResolver = (now: Date) => (task: Task): Date | null =>
    task.status === 'active' && task.kind === 'recurring' ? nextFireAt(task, now, holidays) : null

  const queue: WriteQueue = createWriteQueue()
  let writeCount = 0
  const flusher = createDebouncedFlush(() => {
    if (store.flush()) writeCount += 1
  }, options.debounceMs ?? 200)

  /** Refuse a mutation when the store is read-only (F6.8). */
  const assertWritable = (): void => {
    assertStoreWritable(store)
  }

  /** Mark the store dirty and arm the debounced physical write. */
  function touch(): void {
    store.markDirty()
    flusher.schedule()
  }

  /** Index of a task by id, or -1. */
  function indexOf(id: string): number {
    return store.state.tasks.findIndex((task) => task.id === id)
  }

  /** Read one task or throw `not_found`. */
  function requireTask(id: string): Task {
    const task = store.state.tasks.find((candidate) => candidate.id === id)
    if (task === undefined) throw new ValidationError('not_found', `task ${JSON.stringify(id)} does not exist`)
    return task
  }

  /** Replace one task in place (the caller has already bumped the revision). */
  function replaceTask(next: Task): void {
    const index = indexOf(next.id)
    if (index === -1) throw new ValidationError('not_found', `task ${JSON.stringify(next.id)} does not exist`)
    store.state.tasks[index] = next
    touch()
  }

  /** Idempotent create shared by `create` and `createTask` (F7.15). */
  const createTaskInternal = (input: CreateTaskInput): Promise<CreateResult> =>
    queue.run(() =>
      runIdempotentCreate(input, {
        store,
        clock,
        assertWritable,
        touch,
        build: (value, now) => buildTask(value, store.state.settings, now),
      }),
    )

  return {
    get writeCount() {
      return writeCount
    },
    snapshotTasks() {
      return store.state.tasks
    },
    settings() {
      return store.state.settings
    },
    updateSettings(patch) {
      assertWritable()
      const next: Settings = {
        ...store.state.settings,
        ...patch,
        dnd: { ...store.state.settings.dnd, ...(patch.dnd ?? {}) },
      }
      store.state.settings = next
      store.set(store.state)
      touch()
      return next
    },
    get(id) {
      return store.state.tasks.find((task) => task.id === id) ?? null
    },
    list(query: ListQuery): ListResult {
      const now = clock()
      const nextAtFor = nextAtResolver(now)
      // `queryTasks` adds the main-file `done` count itself, so only the
      // archived quarters belong in this seed (F4.21: no double counting).
      const settings = store.state.settings
      const currentQuarter = quarterOf(now.toISOString(), settings.timeZone)
      return queryTasks(store.state.tasks, query, {
        now,
        nextAtFor,
        totalDone: archiveDone(),
        doneInCurrentQuarter: (task) =>
          task.kind === 'once' && task.doneAt !== null
            ? quarterOf(task.doneAt, task.once?.timeZone ?? settings.timeZone) === currentQuarter
            : false,
      })
    },
    async create(input) {
      return (await createTaskInternal(input)).task
    },
    createTask: createTaskInternal,
    async update(id, expectedRevision, patch) {
      return queue.run(() => {
        assertWritable()
        const current = requireTask(id)
        if (current.revision !== expectedRevision) {
          throw new ValidationError('conflict', 'task was modified by another request', {
            currentRevision: current.revision,
          })
        }
        const next = patchTask(current, patch, store.state.settings, clock())
        replaceTask(next)
        return next
      })
    },
    async pause(id) {
      return queue.run(() => {
        assertWritable()
        const task = requireTask(id)
        if (task.status === 'paused') return { id, status: 'paused' as const, changed: false }
        if (!canTransition(task.status, 'paused')) {
          throw new ValidationError('invalid_state', describeTransition(task.status, 'paused'))
        }
        replaceTask({ ...task, status: 'paused', revision: task.revision + 1, updatedAt: clock().toISOString() })
        return { id, status: 'paused' as const, changed: true }
      })
    },
    async resume(id) {
      return queue.run(() => {
        assertWritable()
        const task = requireTask(id)
        if (task.status === 'active') return { id, status: 'active' as const, changed: false }
        if (!canTransition(task.status, 'active')) {
          throw new ValidationError('invalid_state', describeTransition(task.status, 'active'))
        }
        const stamp = clock().toISOString()
        const fromDone = task.status === 'done'
        const revived: Task = {
          ...task,
          status: 'active',
          doneAt: null,
          // F4.15 only requires clearing the pin when a task is completed; a
          // pause/resume cycle must keep the user's pin (D-21).
          pinned: fromDone ? false : task.pinned,
          revision: task.revision + 1,
          updatedAt: stamp,
          // F4.2 / AC-10: resuming continues from the next future instant. The
          // watermark is moved to now so the paused interval is not replayed as
          // a backlog of missed occurrences.
          state: { ...task.state, lastFiredAt: stamp, lastOccurrenceKey: task.state.lastOccurrenceKey },
        }
        replaceTask(revived)
        return { id, status: 'active' as const, changed: true }
      })
    },
    async complete(id, occurrenceKey, now = clock(), skipNext = false) {
      return queue.run(() => {
        assertWritable()
        const task = requireTask(id)
        const stamp = now.toISOString()
        if (task.kind === 'once') {
          if (task.status === 'done') {
            return { task, completedOccurrenceKey: task.state.completedOccurrenceKey, nextAt: null }
          }
          if (!canTransition(task.status, 'done')) {
            throw new ValidationError('invalid_state', describeTransition(task.status, 'done'))
          }
          const completed: Task = {
            ...task,
            status: 'done',
            pinned: false,
            doneAt: stamp,
            revision: task.revision + 1,
            updatedAt: stamp,
            state: {
              ...task.state,
              firedStart: true,
              firedEnd: true,
              completedOccurrenceKey: occurrenceKey ?? task.state.completedOccurrenceKey,
            },
          }
          replaceTask(completed)
          const eventKey = completed.state.completedOccurrenceKey ?? occurrenceKeyFor(task.id, now, null)
          appendCompletionEvent(store.state, makeCompletionEvent(completed, eventKey, now), now)
          return { task: completed, completedOccurrenceKey: completed.state.completedOccurrenceKey, nextAt: null }
        }
        // Recurring: skip the current occurrence and stay active (F4.4).
        // F1.2: only an `active` task may be completed.
        if (task.status !== 'active') {
          throw new ValidationError('invalid_state', describeTransition(task.status, 'active'))
        }
        let key = occurrenceKey ?? task.state.lastOccurrenceKey
        // A-02: the same occurrence must not be counted twice.
        const duplicate = key !== null && key !== undefined &&
          store.state.completionEvents.some((event) => event.taskId === task.id && event.occurrenceKey === key)
        if (duplicate) return { task, completedOccurrenceKey: key, nextAt: null }
        /** When `skipNext` synthesized the key, its instant is the new floor. */
        let skippedAt: string | null = null
        if (key === null || key === undefined) {
          // F7.18: resolve the next occurrence for a never-fired task.
          if (!skipNext) {
            throw new ValidationError('no_occurrence', 'this recurring task has no occurrence to complete')
          }
          const next = nextFireAt(task, now)
          if (next === null) {
            throw new ValidationError('no_occurrence', 'this recurring task has no future occurrence to skip')
          }
          key = occurrenceKeyFor(task.id, next, null)
          skippedAt = next.toISOString()
        }
        const skipped: Task = {
          ...task,
          revision: task.revision + 1,
          updatedAt: stamp,
          state: {
            ...task.state,
            completedOccurrenceKey: key,
            lastOccurrenceKey: key,
            lastFiredAt: skippedAt ?? stamp,
          },
        }
        replaceTask(skipped)
        appendCompletionEvent(store.state, makeCompletionEvent(skipped, key, now), now)
        return { task: skipped, completedOccurrenceKey: key, nextAt: null }
      })
    },
    async snooze(id, minutes, now = clock()) {
      return queue.run(() => {
        assertWritable()
        const task = requireTask(id)
        const value = Number(minutes)
        if (!Number.isInteger(value) || value < 1 || value > 1440) {
          throw new ValidationError('invalid_argument', 'minutes must be an integer between 1 and 1440', {
            field: 'minutes',
          })
        }
        const until = new Date(now.getTime() + value * 60_000).toISOString()
        replaceTask({
          ...task,
          revision: task.revision + 1,
          updatedAt: now.toISOString(),
          state: { ...task.state, snoozeUntil: until },
        })
        return { id, snoozeUntil: until }
      })
    },
    async pin(id, pinned) {
      return queue.run(() => {
        assertWritable()
        const task = requireTask(id)
        if (typeof pinned !== 'boolean') {
          throw new ValidationError('invalid_argument', 'pinned must be a boolean', { field: 'pinned' })
        }
        if (task.pinned === pinned) return { id, pinned }
        replaceTask({ ...task, pinned, revision: task.revision + 1, updatedAt: clock().toISOString() })
        return { id, pinned }
      })
    },
    async remove(id, purge = false) {
      return queue.run(() => {
        assertWritable()
        const task = requireTask(id)
        if (purge) {
          store.state.tasks = store.state.tasks.filter((candidate) => candidate.id !== id)
          touch()
          return { id, deleted: true, purged: true }
        }
        if (task.status === 'archived') return { id, deleted: true, purged: false }
        replaceTask({
          ...task,
          status: 'archived',
          pinned: false,
          revision: task.revision + 1,
          updatedAt: clock().toISOString(),
        })
        return { id, deleted: true, purged: false }
      })
    },
    async restore(id) {
      return queue.run(() => {
        assertWritable()
        const task = requireTask(id)
        if (task.status === 'active') return task
        if (!canTransition(task.status, 'active')) {
          throw new ValidationError('invalid_state', describeTransition(task.status, 'active'))
        }
        const restored: Task = {
          ...task,
          status: 'active',
          doneAt: null,
          archivedQuarter: null,
          pinned: false,
          revision: task.revision + 1,
          updatedAt: clock().toISOString(),
        }
        replaceTask(restored)
        return restored
      })
    },
    ...createDeliveryOps({ store, queue, assertWritable, touch }),
    async applyTick(changes: TickChange[], now) {
      return queue.run(() => {
        assertWritable() // defensive: no write path may bypass F6.8
        const stamp = now.toISOString()
        for (const change of changes) {
          const index = indexOf(change.taskId)
          if (index === -1) continue
          const task = store.state.tasks[index] as Task
          // F1.6 / §8.2: drop a change solved against an older revision. The
          // user's edit wins; the next tick re-solves the new schedule.
          if (change.expectedRevision !== undefined && change.expectedRevision !== task.revision) continue
          store.state.tasks[index] = applyTickChange(task, change, stamp)
        }
        store.state.meta.lastTickAt = stamp
        touch()
      })
    },
    async sweepArchives(now = clock()) {
      return queue.run(() => {
        const result = sweepExpiredArchives(store.state.tasks, now, 30)
        if (result.purge.length === 0) return 0
        store.state.tasks = result.keep
        touch()
        return result.purge.length
      })
    },
    async flush() {
      await queue.run(() => {
        flusher.flushNow()
      })
    },
    dispose() {
      queue.dispose()
      flusher.dispose()
    },
  }
}

/** Today's local date helper, re-exported for routes that need the same default. */
export { localDateKey }
