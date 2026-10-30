/**
 * Grouping the todo list for display (F8.13 / D-21 / D-22).
 *
 * Pinned first, then the three priority bands, then paused. Split from
 * `panel.ts` to stay inside the NF5 budget and to make the ordering rules
 * testable on their own.
 */

import type { TaskView } from '../../src/host/taskView'

/** Grouping for the todo view. */
const GROUP_ORDER = ['pinned', 'high', 'mid', 'low', 'none', 'paused'] as const
export type GroupKey = (typeof GROUP_ORDER)[number]

/**
 * Group the todo items the way the panel renders them (F8.13 / D-21 / D-22).
 * Pinned first, then priority, paused last.
 * @param items - Todo-view items, already sorted by the host.
 * @returns Ordered groups, empty ones omitted.
 */
export function groupItems(items: readonly TaskView[]): { key: GroupKey; items: TaskView[] }[] {
  const buckets: Record<GroupKey, TaskView[]> = {
    pinned: [],
    high: [],
    mid: [],
    low: [],
    none: [],
    paused: [],
  }
  for (const item of items) {
    if (item.status === 'paused') {
      buckets.paused.push(item)
      continue
    }
    if (item.pinned) {
      buckets.pinned.push(item)
      continue
    }
    const key = item.priority.key === 'paused' ? 'none' : item.priority.key
    buckets[key as 'high' | 'mid' | 'low' | 'none'].push(item)
  }
  return GROUP_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({ key, items: buckets[key] }))
}

