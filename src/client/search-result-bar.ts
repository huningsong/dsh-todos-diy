/**
 * Search result summary line (F8.17).
 */

import * as React from 'react'

import type { SearchScope } from './search-scope'
import { searchActive } from './search-scope'

const h = React.createElement

/** Props for {@link SearchResultBar}. */
export interface SearchResultBarProps {
  t: (key: string, params?: Record<string, string | number>) => string
  scope: SearchScope
  query: string
  count: number
  truncated: boolean
  /** Rows currently loaded (the truncation hint must reflect load-more). */
  loaded?: number
}

/** One-line result summary, only rendered while a search is active. */
export function SearchResultBar(props: SearchResultBarProps): React.ReactNode {
  if (!searchActive(props.query)) return null
  const { t } = props
  return h(
    'div',
    { className: 'dtd-searchResult', role: 'status' },
    h(
      'span',
      null,
      t(props.scope === 'all' ? 'nlp.searchResult.all' : 'nlp.searchResult.view', {
        query: props.query.trim(),
        n: props.count,
      }),
    ),
    props.truncated
      ? h('span', { className: 'dtd-searchLimit' }, `· ${t('nlp.searchLimit', { n: props.loaded ?? props.count })}`)
      : null,
  )
}
