/**
 * Panel toolbar: the search field plus the optional natural-language bar.
 *
 * Extracted from `panel.ts` to stay inside the NF5 line budget.
 */

import * as React from 'react'

import type { NlpParsePayload } from './api'
import { NlpBar } from './nlp-bar'
import type { TaskDraft } from './task-draft'
import { SearchGlyph } from './ui'

const h = React.createElement

/** Props for the toolbar. */
export interface PanelToolbarProps {
  t: (key: string, params?: Record<string, string | number>) => string
  search: string
  onSearch: (value: string) => void
  searchRef: React.RefObject<HTMLInputElement | null>
  nlpEnabled: boolean
  timeZone: string
  onParsed: (draft: TaskDraft, result: NlpParsePayload) => void
  onDegraded: (text: string) => void
}

/** The search + quick-add row. */
export function PanelToolbar(props: PanelToolbarProps): React.ReactNode {
  const { t } = props
  return h(
    'div',
    { className: 'dtd-toolbar' },
    h(
      'div',
      { className: 'dtd-search' },
      h(SearchGlyph, {}),
      h('input', {
        ref: props.searchRef,
        type: 'search',
        value: props.search,
        placeholder: t('panel.searchPlaceholder'),
        'aria-label': t('panel.search'),
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => props.onSearch(event.target.value),
      }),
    ),
    props.nlpEnabled
      ? h(NlpBar, {
          t,
          timeZone: props.timeZone,
          onParsed: props.onParsed,
          onDegraded: props.onDegraded,
        })
      : null,
  )
}
