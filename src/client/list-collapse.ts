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
  const { items, renderItem, t, className } = props
  const [expanded, setExpanded] = React.useState(false)
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
              onClick: () => setExpanded((current) => !current),
            },
            expanded ? t('group.showLess') : t('group.showMore', { n: hidden }),
          ),
        )
      : null,
  )
}
