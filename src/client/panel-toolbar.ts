/**
 * Panel toolbar: the search field plus the optional natural-language bar.
 *
 * Extracted from `panel.ts` to stay inside the NF5 line budget.
 */

import * as React from 'react'

import type { NlpParsePayload } from './api'
import { NlpBar } from './nlp-bar'
import type { TaskDraft } from './task-draft'
import type { SearchScope } from './search-scope'
import { SearchGlyph } from './ui'

const h = React.createElement

/** Props for the toolbar. */
export interface PanelToolbarProps {
  t: (key: string, params?: Record<string, string | number>) => string
  search: string
  onSearch: (value: string) => void
  searchRef: React.RefObject<HTMLInputElement | null>
  searchScope: SearchScope
  onSearchScope: (scope: SearchScope) => void
  nlpEnabled: boolean
  timeZone: string
  onParsed: (draft: TaskDraft, result: NlpParsePayload) => void
  onDegraded: (context: { text: string; reason: string }) => void
  nlpHint?: string | null
  /** Open settings when the feature is disabled (F10.12 discoverability). */
  onOpenSettings: () => void
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
        placeholder: t(props.searchScope === 'all' ? 'search.placeholderAll' : 'search.placeholderView'),
        'aria-label': t('panel.search'),
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => props.onSearch(event.target.value),
      }),
    ),
    h(
      'div',
      { className: 'dtd-scope', role: 'group', 'aria-label': t('nlp.searchScope.label') },
      (['all', 'view'] as const).map((scope) =>
        h(
          'button',
          {
            key: scope,
            type: 'button',
            className: 'dtd-scopeBtn',
            'aria-pressed': props.searchScope === scope,
            onClick: () => props.onSearchScope(scope),
          },
          t(scope === 'all' ? 'nlp.searchScope.all' : 'nlp.searchScope.view'),
        ),
      ),
    ),
    props.nlpEnabled
      ? h(NlpBar, {
          t,
          timeZone: props.timeZone,
          onParsed: props.onParsed,
          onDegraded: props.onDegraded,
          hint: props.nlpHint ?? null,
        })
      : h(
          'button',
          {
            type: 'button',
            className: 'dtd-nlpToggle dtd-nlpToggleOff',
            title: t('nlp.disabledHint'),
            'aria-label': t('nlp.disabledHint'),
            'data-testid': 'nlp-disabled-entry',
            onClick: props.onOpenSettings,
          },
          '✨ ',
          t('nlp.openDisabled'),
        ),
  )
}
