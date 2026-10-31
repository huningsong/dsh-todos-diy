/**
 * Read-side helpers for the repository: list filtering, cursor pagination and
 * the derived counters the panel needs (F4.21).
 *
 * Kept pure and separate from the mutation code so each file stays inside the
 * NF5 budget.
 */

import { derivePriority, stageOf } from './rules/priority.js'
import type { DeriveOptions } from './rules/priority.js'
import { selectView, sortTasksForView } from './rules/priority.js'
import type { Task } from './rules/types.js'
import type { ListQuery, ListResult } from './repoTypes.js'

/** Everything the read path needs from the caller (clock + calendar). */
export interface QueryContext {
  /** The single `now` every derived value is computed against. */
  now: Date
  /** Resolver for a recurring task's next fire instant. */
  nextAtFor: (task: Task) => Date | null
  /** Main-file done + archived quarters, de-duplicated (F4.21). */
  totalDone: number
  /** F4.21: `done` counts only completions in the current quarter. */
  doneInCurrentQuarter?: (task: Task) => boolean
}

/** Encode a list cursor (`createdAt|id`) as opaque base64url. */
export function encodeCursor(task: Task): string {
  return Buffer.from(`${task.createdAt}|${task.id}`).toString('base64url')
}

/**
 * Decode a list cursor.
 * @param cursor - Opaque token from a previous page.
 * @returns The pivot task identity, or null when malformed.
 */
export function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const text = Buffer.from(cursor, 'base64url').toString('utf8')
    const at = text.indexOf('|')
    if (at === -1) return null
    return { createdAt: text.slice(0, at), id: text.slice(at + 1) }
  } catch {
    return null
  }
}

/**
 * The next instant at which any visible task changes stage (F4.13).
 *
 * Considers every non-archived active/paused task and ignores the current view
 * and search: the panel must refresh even when the boundary belongs to a row
 * that is not on screen. Only instants **strictly after** `now` qualify.
 * @param tasks - Every task in the store.
 * @param options - `now` plus the recurring `nextAtFor` resolver.
 * @returns ISO instant, or null when nothing is scheduled.
 */
export function computeNextTransition(tasks: readonly Task[], options: { now: Date; nextAtFor: (task: Task) => Date | null }): string | null {
  const nowMs = options.now.getTime()
  let earliest: number | null = null
  const consider = (value: number | null): void => {
    if (value === null || Number.isNaN(value) || value <= nowMs) return
    if (earliest === null || value < earliest) earliest = value
  }
  for (const task of tasks) {
    // F4.13: only active/paused tasks contribute a boundary; a done or archived
    // task cannot change stage again.
    if (task.status === 'archived' || task.status === 'done') continue
    if (task.kind === 'once' && task.once !== null) {
      consider(Date.parse(task.once.startAt))
      consider(Date.parse(task.once.endAt))
    }
    if (task.status === 'active' && task.kind === 'recurring') {
      const next = options.nextAtFor(task)
      consider(next === null ? null : next.getTime())
    }
  }
  return earliest === null ? null : new Date(earliest).toISOString()
}

/**
 * Apply one list query to the in-memory task set.
 *
 * Counts come from `computeCounts`, so the six badges always describe the whole
 * dataset — a search must never make the "进行中 2" badge read 0 (F4.21).
 * @param allTasks - Every task in the store.
 * @param query - Query parameters.
 * @param ctx - Clock, next-at resolver and the archived done total.
 * @returns Page, cursor, counts, priority summary and the refresh boundary.
 */
export function queryTasks(allTasks: readonly Task[], query: ListQuery, ctx: QueryContext): ListResult {
  const view = query.view ?? 'inProgress'
  const derive: DeriveOptions = { nextAtFor: ctx.nextAtFor, doneInCurrentQuarter: ctx.doneInCurrentQuarter }
  const includeArchived = query.includeArchived === true
  const visible = allTasks.filter((task) => task.status !== 'archived')

  // Counts and the priority summary are computed over the *unfiltered* pool:
  // a search narrows the rows, never the tab badges.
  const countSource = selectView(visible, view, ctx.now, derive)
  const counts = countSource.counts
  const prioritySummary = countSource.prioritySummary
  const byKind = {
    once: visible.filter((task) => task.kind === 'once').length,
    recurring: visible.filter((task) => task.kind === 'recurring').length,
  }

  // F4.6 / F7.1: an explicit `status`/`kind` filter is a *flat* query — it must
  // not be intersected with the default stage view, otherwise
  // `status=paused` would always come back empty.
  const flat = query.status !== undefined || query.kind !== undefined
  let pool = includeArchived ? allTasks : visible
  if (query.status !== undefined) pool = pool.filter((task) => task.status === query.status)
  if (query.kind !== undefined) pool = pool.filter((task) => task.kind === query.kind)

  const needle = (query.query ?? '').trim().toLowerCase()
  if (needle !== '') {
    pool = pool.filter(
      (task) => task.title.toLowerCase().includes(needle) || task.description.toLowerCase().includes(needle),
    )
  }

  const viewResult = selectView(pool, view, ctx.now, derive)
  let items = flat ? sortTasksForView(pool, ctx.now, derive) : viewResult.items
  if (includeArchived && !flat) {
    const archived = allTasks.filter((task) => task.status === 'archived')
    if (archived.length > 0) items = [...items, ...sortTasksForView(archived, ctx.now, derive)]
  }
  // A filtered view re-sorts by the same ordering so the page stays predictable.
  if (query.status !== undefined || query.kind !== undefined || needle !== '') {
    items = sortTasksForView(items, ctx.now, derive)
  }

  // F8.19 follow-up: exact per-group totals over the *whole* filtered result,
  // independent of the page slice. This is what fixes '高优先级 50' below the
  // real 96 while only 50 rows are loaded.
  const groupCounts = { pinned: 0, high: 0, mid: 0, low: 0, none: 0, paused: 0 }
  for (const task of items) {
    if (task.status === 'paused') {
      groupCounts.paused += 1
      continue
    }
    if (task.pinned) {
      groupCounts.pinned += 1
      continue
    }
    const key = derivePriority(task, ctx.now, derive).key
    if (key === 'paused') groupCounts.paused += 1
    else groupCounts[key] += 1
  }

  const limit = Math.min(200, Math.max(1, Math.trunc(query.limit ?? 50)))
  const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor)
  if (cursor !== null) {
    const pivot = items.findIndex((task) => task.createdAt === cursor.createdAt && task.id === cursor.id)
    items = pivot === -1 ? items : items.slice(pivot + 1)
  }
  const page = items.slice(0, limit)
  const nextCursor = items.length > limit && page.length === limit ? encodeCursor(page[page.length - 1] as Task) : null

  return {
    items: page,
    nextCursor,
    counts,
    prioritySummary,
    groupCounts,
    byKind,
    totalDone: ctx.totalDone + counts.done,
    serverTime: ctx.now.toISOString(),
    nextTransitionAt: computeNextTransition(allTasks, { now: ctx.now, nextAtFor: ctx.nextAtFor }),
  }
}

/**
 * Stage of one task, re-exported so routes do not need to import the rules
 * module directly for the common case.
 * @param task - Task to inspect.
 * @param now - Current instant.
 * @returns Derived stage.
 */
export function stageFor(task: Task, now: Date): ReturnType<typeof stageOf> {
  return stageOf(task, now)
}
