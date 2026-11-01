/**
 * A list section that shows at most five rows until the user expands it
 * (UX-19 / F8.9). Kept separate from `task-list.ts` so both the normal list
 * and the completed/archive list can share the same behavior.
 */

import * as React from 'react'

import type { TaskView } from '../../src/host/taskView.js'
import { GROUP_PAGE_SIZE, visibleGroupItems } from './grouping.js'

const h = React.createElement

/** Props for {@link CollapsibleRows}. */
export interface CollapsibleRowsProps {
  /** Rows in display order. */
  items: readonly TaskView[]
  /** Render one row, including its React key. */
  renderItem: (item: TaskView) => React.ReactElement
  /** Translator used for the show-more/show-less label. */
  t: (key: string, params?: Record<string, string | number>) => string
  /** Extra class name for the wrapper. */
  className?: string
  /** Expand on first render; used when a paginated list needs its groups open. */
  defaultExpanded?: boolean
  /** Optional key for remembering the user's expand/collapse choice. */
  storageKey?: string
}

/**
 * Render a group of rows with a five-row initial page.
 *
 * The show-more button appears only when the group is longer than
 * {@link GROUP_PAGE_SIZE}; once expanded, the same button collapses it again.
 * @param props - Rows, renderer and translator.
 * @returns The group body and optional expand/collapse control.
 */
export function CollapsibleRows(props: CollapsibleRowsProps): React.ReactElement {
  const { items, renderItem, t, className, defaultExpanded, storageKey } = props
  const [expanded, setExpanded] = React.useState(() => {
    if (storageKey !== undefined && typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(storageKey)
        if (stored === '1') return true
        if (stored === '0') return false
      } catch {
        // Storage is optional; fall back to the default.
      }
    }
    return defaultExpanded === true
  })
  const toggle = (): void => {
    setExpanded((current) => {
      const next = !current
      if (storageKey !== undefined && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageKey, next ? '1' : '0')
        } catch {
          // Storage is optional.
        }
      }
      return next
    })
  }
  const visible = visibleGroupItems(items, expanded)
  const hidden = items.length - visible.length

  return h(
    'div',
    { className: className ?? 'dtd-collapsible' },
    h('ul', { className: 'dtd-rows' }, visible.map((item) => renderItem(item))),
    items.length > GROUP_PAGE_SIZE
      ? h(
          'div',
          { className: 'dtd-groupMore' },
          h(
            'button',
            {
              type: 'button',
              className: 'dtd-btn ghost small',
              'aria-expanded': expanded,
              onClick: toggle,
            },
            expanded ? t('group.showLess') : t('group.showMore', { n: hidden }),
          ),
        )
      : null,
  )
}
