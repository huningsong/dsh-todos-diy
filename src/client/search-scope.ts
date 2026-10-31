/**
 * Search scope helpers (F8.17).
 *
 * Pure: the panel asks these functions which view to request and whether the
 * search UI is active, so the behaviour is identical on every refresh path.
 */

import type { ViewName } from './api.js'

/** Where a search looks: all non-archived tasks, or only the current view. */
export type SearchScope = 'all' | 'view'

/** Normalize a raw search box value. */
export function normalizeQuery(query: string): string {
  return query.trim()
}

/** Whether a query is active (non-empty after trimming). */
export function searchActive(query: string): boolean {
  return normalizeQuery(query) !== ''
}

/**
 * Resolve the view to request for a search.
 * @param view - Current tab/filter.
 * @param scope - Search scope.
 * @param query - Raw search text.
 * @returns The view to send to `/snapshot`.
 */
export function resolveSearchTarget(view: ViewName, scope: SearchScope, query: string): ViewName {
  if (!searchActive(query)) return view
  return scope === 'all' ? 'all' : view
}

/**
 * Localized stage label key for a task stage.
 * @param stage - `TaskView.stage`.
 * @returns Dictionary key.
 */
export function stageLabelKey(stage: string): string {
  if (stage === 'recurring') return 'filter.recurring'
  if (stage === 'paused') return 'filter.paused'
  return `tab.${stage}`
}
