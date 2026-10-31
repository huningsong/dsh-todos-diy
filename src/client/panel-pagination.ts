/**
 * One "load more" request for the panel (F8.19 follow-up).
 */

import { api, type SnapshotPayload } from './api'
import { resolveSearchTarget, type SearchScope } from './search-scope'
import type { ViewName } from './api'

/** Arguments for {@link fetchNextPage}. */
export interface NextPageArgs {
  view: ViewName
  search: string
  searchScope: SearchScope
  cursor: string
}

/**
 * Fetch the next page using the same effective view as the current list.
 * @param args - Current view/search/scope and the cursor.
 * @returns The next snapshot page.
 */
export function fetchNextPage(args: NextPageArgs): Promise<SnapshotPayload> {
  const effective = resolveSearchTarget(args.view, args.searchScope, args.search)
  return api.snapshot(effective, args.search, undefined, 200, args.cursor)
}
