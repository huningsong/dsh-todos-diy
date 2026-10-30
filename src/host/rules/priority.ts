/**
 * Derived stage, priority, view selection and ordering (D-20/D-21/D-22/D-25,
 * F4.10–F4.14 / F4.21).
 *
 * Everything here is a pure function of `(tasks, now)` — or of a caller-supplied
 * `nextAtFor` resolver for recurring tasks. Neither `stage` nor `priority` is
 * ever persisted, so the file on disk can never disagree with the UI.
 *
 * Thresholds are half-open intervals on the exact millisecond remainder:
 *   overdue (remaining ≤ 0) or ≤ 24 h  → high
 *   (24 h, 72 h]                       → mid
 *   (72 h, 168 h]                      → low
 *   > 168 h, or no target              → none
 */

import type {
  Counts,
  Priority,
  PriorityKey,
  Task,
  TaskStage,
  TaskViewName,
  ViewResult,
} from './types.js'

/** Rank used for sorting; lower sorts first. `paused` sinks below `none`. */
const PRIORITY_RANK: Record<PriorityKey, number> = {
  high: 0,
  mid: 1,
  low: 2,
  none: 3,
  paused: 4,
}

const HOUR = 3_600_000

/** Options shared by the derived readers. */
export interface DeriveOptions {
  /**
   * Resolve a recurring task's next fire instant. Injected so this module stays
   * free of calendar maths; when omitted, recurring tasks report no target.
   */
  nextAtFor?: (task: Task) => Date | null
}

/** Seconds since epoch, used for the "same second still counts" rules. */
function seconds(timeMs: number): number {
  return Math.floor(timeMs / 1000)
}

/**
 * Derive a task's stage (D-25 / F1.2).
 *
 * `startAt`/`endAt` are compared at **second** granularity: a task whose
 * `endAt` is 18:00:00 is still `inProgress` at 18:00:00.900 and becomes
 * `overdue` at 18:00:01.
 * @param task - Task to inspect.
 * @param now - Current instant.
 * @returns The derived stage; `archived` for soft-deleted tasks.
 */
export function stageOf(task: Task, now: Date): TaskStage {
  if (task.status === 'archived') return 'archived'
  if (task.status === 'paused') return 'paused'
  if (task.status === 'done') return 'done'
  if (task.kind === 'recurring') return 'recurring'
  const window = task.once
  if (window === null) return 'inProgress'
  const nowMs = now.getTime()
  const startMs = Date.parse(window.startAt)
  const endMs = Date.parse(window.endAt)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 'inProgress'
  // `startAt` is millisecond-exact (`now < startAt` → notStarted, F1.2).
  if (nowMs < startMs) return 'notStarted'
  // `endAt` has the documented exception: the whole end second still counts as
  // in progress ("endAt 当秒仍算进行中").
  if (seconds(nowMs) > seconds(endMs)) return 'overdue'
  return 'inProgress'
}

/**
 * The moment a task's deadline happens (ms), or null when it has none.
 * @param task - Task to inspect.
 * @param options - Optional `nextAtFor` resolver for recurring tasks.
 * @returns Epoch milliseconds, or null.
 */
export function deadlineOf(task: Task, options: DeriveOptions = {}): number | null {
  if (task.kind === 'once') {
    if (task.once === null) return null
    const parsed = Date.parse(task.once.endAt)
    return Number.isNaN(parsed) ? null : parsed
  }
  if (task.status !== 'active') return null
  const next = options.nextAtFor?.(task) ?? null
  return next === null ? null : next.getTime()
}

/**
 * Derive priority from an exact remaining time (D-20 / F4.12).
 * @param remainingMs - Milliseconds until the deadline; negative once overdue.
 * @returns Priority key plus the floored remaining minutes.
 */
export function derivePriorityFromRemaining(remainingMs: number): Priority {
  const remainingMinutes = Math.floor(remainingMs / 60_000)
  if (remainingMs <= 24 * HOUR) return { key: 'high', remainingMinutes }
  if (remainingMs <= 72 * HOUR) return { key: 'mid', remainingMinutes }
  if (remainingMs <= 168 * HOUR) return { key: 'low', remainingMinutes }
  return { key: 'none', remainingMinutes }
}

/**
 * Priority for one task (F4.12).
 *
 * A paused task never participates and reports `paused` (D-22); a task with no
 * target reports `none`.
 * @param task - Task to inspect.
 * @param now - Current instant.
 * @param options - Optional `nextAtFor` resolver for recurring tasks.
 * @returns Derived priority.
 */
export function derivePriority(task: Task, now: Date, options: DeriveOptions = {}): Priority {
  if (task.status === 'paused') return { key: 'paused', remainingMinutes: null }
  if (task.status === 'done' || task.status === 'archived') return { key: 'none', remainingMinutes: null }
  const target = deadlineOf(task, options)
  if (target === null) return { key: 'none', remainingMinutes: null }
  return derivePriorityFromRemaining(target - now.getTime())
}

/**
 * Whole days a one-off task is overdue; null when it is not overdue.
 * @param task - Task to inspect.
 * @param now - Current instant.
 * @returns Days overdue, or null.
 */
export function daysOverdue(task: Task, now: Date): number | null {
  if (task.kind !== 'once' || task.once === null) return null
  if (stageOf(task, now) !== 'overdue') return null
  const end = Date.parse(task.once.endAt)
  if (Number.isNaN(end)) return null
  return Math.max(0, Math.floor((now.getTime() - end) / 86_400_000))
}

/**
 * Whether a task belongs in the 已超期 view (D-22: paused is never overdue).
 * @param task - Task to inspect.
 * @param now - Current instant.
 * @returns True when the stage is `overdue`.
 */
export function isOverdue(task: Task, now: Date): boolean {
  return stageOf(task, now) === 'overdue'
}

/**
 * Sort tasks for display: pinned → priority → deadline → title (F4.7 / F4.14).
 *
 * The input array is not mutated.
 * @param tasks - Tasks in any order.
 * @param now - Current instant.
 * @param options - Optional `nextAtFor` resolver for recurring tasks.
 * @returns New sorted array.
 */
export function sortTasksForView(
  tasks: readonly Task[],
  now: Date,
  options: DeriveOptions = {},
): Task[] {
  return [...tasks].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
    const leftRank = PRIORITY_RANK[derivePriority(left, now, options).key]
    const rightRank = PRIORITY_RANK[derivePriority(right, now, options).key]
    if (leftRank !== rightRank) return leftRank - rightRank
    const leftTarget = deadlineOf(left, options)
    const rightTarget = deadlineOf(right, options)
    if (leftTarget !== rightTarget) {
      if (leftTarget === null) return 1
      if (rightTarget === null) return -1
      return leftTarget - rightTarget
    }
    if (left.title !== right.title) return left.title < right.title ? -1 : 1
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  })
}

/**
 * Compute the six mutually exclusive counts plus the priority summary (F4.21).
 * @param tasks - Every task in scope (archived ones are ignored).
 * @param now - Current instant.
 * @param options - Optional `nextAtFor` resolver.
 * @returns Counts and the priority summary.
 */
export function computeCounts(
  tasks: readonly Task[],
  now: Date,
  options: DeriveOptions = {},
): { counts: Counts; prioritySummary: { high: number; mid: number; low: number; none: number } } {
  const counts: Counts = { notStarted: 0, inProgress: 0, overdue: 0, done: 0, paused: 0, recurring: 0 }
  const prioritySummary = { high: 0, mid: 0, low: 0, none: 0 }
  for (const task of tasks) {
    const stage = stageOf(task, now)
    if (stage === 'archived') continue
    counts[stage] += 1
    // F4.21: only paused/done/archived are excluded from the priority summary;
    // an active recurring task takes part via its `nextAt`.
    if (stage === 'paused' || stage === 'done') continue
    const key = derivePriority(task, now, options).key
    if (key !== 'paused') prioritySummary[key] += 1
  }
  return { counts, prioritySummary }
}

/**
 * Filter one view and compute the badges plus the priority summary.
 *
 * View contracts (F4.10 / D-22 / D-25):
 *  - the four stage views cover one-off tasks only;
 *  - `recurring` is `active && kind=recurring`, `paused` is its own bucket;
 *  - neither recurring nor paused ever appears in a stage view.
 * @param tasks - All tasks in scope (archived ones are ignored).
 * @param view - Which view to render.
 * @param now - Current instant.
 * @param options - Optional `nextAtFor` resolver.
 * @returns Items, counts and priority summary.
 */
export function selectView(
  tasks: readonly Task[],
  view: TaskViewName,
  now: Date,
  options: DeriveOptions = {},
): ViewResult {
  const scoped = tasks.filter((task) => task.status !== 'archived')
  const { counts, prioritySummary } = computeCounts(scoped, now, options)

  if (view === 'done') {
    const items = scoped
      .filter((task) => task.status === 'done')
      .sort((left, right) => {
        const leftAt = left.doneAt ?? ''
        const rightAt = right.doneAt ?? ''
        if (leftAt !== rightAt) return leftAt < rightAt ? 1 : -1
        return left.id < right.id ? -1 : 1
      })
    return { items, counts, prioritySummary }
  }

  const items = sortTasksForView(
    scoped.filter((task) => stageOf(task, now) === view),
    now,
    options,
  )
  return { items, counts, prioritySummary }
}

/**
 * Split a list into the groups the panel renders (F8.13 / F8.9).
 *
 * Pinned tasks form one group at the very top; the rest are grouped by derived
 * priority; paused tasks always form the last group (D-22).
 * @param tasks - View items, already sorted.
 * @param now - Current instant.
 * @param options - Optional `nextAtFor` resolver.
 * @returns Ordered groups; empty groups are omitted.
 */
export function groupTasks(
  tasks: readonly Task[],
  now: Date,
  options: DeriveOptions = {},
): { key: 'pinned' | PriorityKey; tasks: Task[] }[] {
  const pinned: Task[] = []
  const byPriority: Record<'high' | 'mid' | 'low' | 'none' | 'paused', Task[]> = {
    high: [],
    mid: [],
    low: [],
    none: [],
    paused: [],
  }
  for (const task of tasks) {
    if (task.status === 'paused') {
      byPriority.paused.push(task)
      continue
    }
    if (task.pinned) {
      pinned.push(task)
      continue
    }
    const key = derivePriority(task, now, options).key
    byPriority[key === 'paused' ? 'none' : key].push(task)
  }
  const groups: { key: 'pinned' | PriorityKey; tasks: Task[] }[] = []
  if (pinned.length > 0) groups.push({ key: 'pinned', tasks: pinned })
  for (const key of ['high', 'mid', 'low', 'none'] as const) {
    if (byPriority[key].length > 0) groups.push({ key, tasks: byPriority[key] })
  }
  if (byPriority.paused.length > 0) groups.push({ key: 'paused', tasks: byPriority.paused })
  return groups
}
