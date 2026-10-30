/**
 * The panel's header, view tabs and independent filters (F8.11 / F8.12 / D-25).
 *
 * Split from `panel.ts` to stay inside the NF5 budget. Purely presentational:
 * the panel owns state and hands every value down.
 */

import * as React from 'react'

import type { CountsPayload, ViewName } from './api'
import { PlusGlyph } from './ui'

const h = React.createElement

/** The four stage tabs, in display order (F8.11). */
export const STAGE_VIEWS = ['notStarted', 'inProgress', 'overdue', 'done'] as const
/** The two independent filters below them (D-22). */
export const FILTER_VIEWS = ['recurring', 'paused'] as const

/** Props for {@link PanelHeader}. */
export interface PanelHeaderProps {
  t: (key: string, params?: Record<string, string | number>) => string
  view: ViewName
  counts: CountsPayload
  totals: { once: number; recurring: number; done: number }
  readOnly: boolean
  onSettings: () => void
  onNew: () => void
  onSelect: (view: ViewName) => void
}

/** Header + tabs + filters + the priority rule strip. */
export function PanelHeader(props: PanelHeaderProps) {
  const { t, view, counts } = props
  return h(
    React.Fragment,
    null,
    h(
      'header',
      { className: 'dtd-head' },
      h('div', null, h('h1', null, t('panel.title')), h('p', null, t('panel.subtitle'))),
      h(
        'div',
        { className: 'dtd-actions' },
        h(
          'button',
          {
            type: 'button',
            className: 'dtd-btn ghost',
            'aria-label': t('panel.settings'),
            onClick: props.onSettings,
          },
          t('panel.settings'),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dtd-btn',
            onClick: props.onNew,
            disabled: props.readOnly,
            title: props.readOnly ? t('error.plugin_too_old') : undefined,
          },
          h(PlusGlyph, {}),
          t('panel.new'),
        ),
      ),
    ),
    props.readOnly
      ? h('div', { className: 'dtd-error', role: 'alert', style: { margin: '12px 32px 0' } }, t('error.plugin_too_old'))
      : null,
    h(
      'div',
      { className: 'dtd-tabs', role: 'tablist' },
      STAGE_VIEWS.map((key) =>
        h(
          'button',
          {
            key,
            type: 'button',
            role: 'tab',
            className: 'dtd-tab',
            'aria-selected': view === key ? 'true' : 'false',
            onClick: () => props.onSelect(key),
          },
          t(`tab.${key}`),
          h('span', { className: 'dtd-count', 'aria-hidden': 'true' }, String(counts[key] ?? 0)),
        ),
      ),
    ),
    h(
      'div',
      { className: 'dtd-filters' },
      h('span', { className: 'dtd-filtersLabel' }, t('filter.label')),
      FILTER_VIEWS.map((key) =>
        h(
          'button',
          {
            key,
            type: 'button',
            className: 'dtd-chip',
            'aria-pressed': view === key ? 'true' : 'false',
            onClick: () => props.onSelect(key),
          },
          t(`filter.${key}`),
          h('span', { className: 'dtd-count', 'aria-hidden': 'true' }, String(counts[key] ?? 0)),
        ),
      ),
      h(
        'span',
        { className: 'dtd-totals' },
        t('stats.totals', { once: props.totals.once, recurring: props.totals.recurring, done: props.totals.done }),
      ),
    ),
    h(
      'div',
      { className: 'dtd-rules', 'aria-label': t('rule.hint') },
      h('span', null, h('i', { className: 'dtd-dot high' }), t('rule.high')),
      h('span', null, h('i', { className: 'dtd-dot mid' }), t('rule.mid')),
      h('span', null, h('i', { className: 'dtd-dot low' }), t('rule.low')),
      h('span', null, h('i', { className: 'dtd-dot none' }), t('rule.none')),
      h('span', { className: 'refresh' }, t('rule.refresh')),
    ),
  )
}
