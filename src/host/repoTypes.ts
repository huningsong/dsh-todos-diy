/**
 * Repository-facing types.
 *
 * Split from `repo.ts` so the implementation file stays within the NF5
 * 400-line budget and so routes/tools can import the contract without pulling
 * the implementation (and its `node:fs`-touching dependencies) into scope.
 */

import type { DeliveryRecord, Settings } from './state.js'
import type { Store } from './store.js'
import type { Task, TaskKind, TaskStatus, TaskViewName } from './rules/types.js'

/** Input accepted by `Repository.create`. */
export interface CreateTaskInput {
  title: string
  description?: string
  kind: TaskKind
  dueDate?: string | null
  rule?: unknown
  once?: unknown
  notify?: unknown
  /** Overrides the global default zone for a one-off task. */
  timeZone?: string
  pinned?: boolean
}

/** Patch accepted by `Repository.update`. */
export interface UpdateTaskPatch {
  title?: string
  description?: string
  dueDate?: string | null
  rule?: unknown
  once?: unknown
  notify?: unknown
  pinned?: boolean
}

/** Query accepted by `Repository.list`. */
export interface ListQuery {
  view?: TaskViewName
  status?: TaskStatus
  kind?: TaskKind
  query?: string
  limit?: number
  cursor?: string
  includeArchived?: boolean
  /** Today's local date; defaults to the settings zone's today. */
  today?: string
}

/** Result of `Repository.list`. */
export interface ListResult {
  items: Task[]
  nextCursor: string | null
  counts: { todo: number; done: number; overdue: number }
  prioritySummary: { high: number; mid: number; low: number; none: number }
}

/** Result of `Repository.complete`. */
export interface CompleteResult {
  task: Task
  completedOccurrenceKey: string | null
  nextAt: string | null
}

/** One scheduler-produced change to persist. */
export interface TickChange {
  taskId: string
  /** Set when the occurrence was delivered (or claimed for delivery). */
  firedKey?: string
  firedAt?: string
  phase?: 'start' | 'end' | 'advance' | null
  /** The one-off node this change belongs to (`null`/absent for recurring). */
  node?: 'start' | 'end' | null
  /** Set when the occurrence was recorded as missed. */
  missedKey?: string
  missedAt?: string
}

/** Options for `createRepository`. */
export interface RepositoryOptions {
  store: Store
  /** Clock; injected so tests can pin `now`. */
  now?: () => Date
  /** Debounce window for physical writes (default 200 ms, F6.9). */
  debounceMs?: number
}

/** Repository surface used by routes and tools. */
export interface Repository {
  /** Tasks currently in memory. */
  snapshotTasks(): readonly Task[]
  /** Current settings. */
  settings(): Settings
  /** Replace settings and persist. */
  updateSettings(patch: Partial<Settings>): Settings
  /** A single task, or null. */
  get(id: string): Task | null
  /** Filtered list with counts and cursor. */
  list(query: ListQuery): ListResult
  /** Create a task (F4.1). */
  create(input: CreateTaskInput): Promise<Task>
  /** Update a task with optimistic locking (F1.6). */
  update(id: string, expectedRevision: number, patch: UpdateTaskPatch): Promise<Task>
  /** Pause a task; idempotent (F4.2/F4.3). */
  pause(id: string): Promise<{ id: string; status: 'paused'; changed: boolean }>
  /** Resume a task; idempotent. */
  resume(id: string): Promise<{ id: string; status: 'active'; changed: boolean }>
  /** Complete a task, or skip the current occurrence of a recurring one. */
  complete(id: string, occurrenceKey?: string, now?: Date): Promise<CompleteResult>
  /** Snooze a task until `minutes` from now. */
  snooze(id: string, minutes: number, now?: Date): Promise<{ id: string; snoozeUntil: string }>
  /** Toggle pin; completing clears it (F4.15). */
  pin(id: string, pinned: boolean): Promise<{ id: string; pinned: boolean }>
  /** Soft-delete (`archived`) or hard-delete when `purge` is set (F1.5). */
  remove(id: string, purge?: boolean): Promise<{ id: string; deleted: boolean; purged: boolean }>
  /** Restore an archived task to `active`. */
  restore(id: string): Promise<Task>
  /** Persisted delivery log, newest last. */
  deliveries(): readonly DeliveryRecord[]
  /** Append one delivery record, trimming to the retention cap. */
  recordDelivery(record: DeliveryRecord): Promise<void>
  /** Append many records, skipping any `occurrenceKey + channel` already present. */
  recordDeliveries(records: DeliveryRecord[]): Promise<void>
  /** Replace the whole log (used by acknowledgement paths). */
  replaceDeliveries(records: DeliveryRecord[]): Promise<void>
  /** Merge scheduler-produced state changes in one write. */
  applyTick(changes: TickChange[], now: Date): Promise<void>
  /** Purge soft-deleted tasks older than the retention window (F1.5). */
  sweepArchives(now?: Date): Promise<number>
  /** Force any pending write. */
  flush(): Promise<void>
  /** Stop timers and flush synchronously (disposal path). */
  dispose(): void
  /** Number of physical writes performed (tests use it for write amplification). */
  readonly writeCount: number
}
