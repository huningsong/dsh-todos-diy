/**
 * The scrollable task list (F8.2 / F8.4 / F8.13 / F8.15).
 *
 * Split from `panel.ts` to stay inside the NF5 budget. Receives everything it
 * renders through props: the panel owns state and mutations, this module owns
 * the loading / error / empty / grouped-list layout.
 */

import * as React from 'react'

import type { ViewName } from './api'
import type { TaskView } from '../../src/host/taskView'
import { groupItems, type GroupKey } from './grouping'
import type { TaskDraft } from './task-editor'
import { TaskRow } from './task-row'
import { TodoGlyph } from './ui'
import { CollapsibleRows } from './list-collapse'
import { ArchiveView } from './archive-view'
import type { SearchScope } from './search-scope'

const h = React.createElement

/** Everything the list needs. */
export interface TaskListProps {
  view: ViewName
  phase: 'loading' | 'ready' | 'error'
  errorCode: string
  items: TaskView[]
  /** Current search query; used to distinguish an empty view from no matches. */
  search: string
  today: string
  t: (key: string, params?: Record<string, string | number>) => string
  firstRun: boolean
  examples: { key: string; label: string; draft: TaskDraft }[]
  onRetry: () => void
  onNew: () => void
  /** Clear the search box from the no-match state. */
  onClearSearch: () => void
  onUseExample: (draft: TaskDraft) => void
  onOpen: (task: TaskView) => void
  onComplete: (task: TaskView) => void
  onPin: (task: TaskView) => void
  onPause: (task: TaskView) => void
  onResume: (task: TaskView) => void
  onMenu: (task: TaskView, x: number, y: number) => void
  onDuplicate: (task: TaskView) => void
  onDelete: (task: TaskView) => void
  onRemindNow: (task: TaskView) => void
  /** Restore one task from an archived quarter (F4.18). */
  onRestoreArchived?: (task: TaskView) => void
  /** True when the data file belongs to a newer plugin; all writes are blocked. */
  readOnly?: boolean
  /** F8.17: a search is active (list must render results, not ArchiveView). */
  searchActive?: boolean
  /** F8.17: search scope, used for the stage badge and the empty-state CTA. */
  searchScope?: SearchScope
  /** F8.17: switch the scope to "all tasks" from the empty state. */
  onSearchAll?: () => void
  /** Exact per-group totals over the whole result (F8.19 follow-up). */
  groupCounts?: { pinned: number; high: number; mid: number; low: number; none: number; paused: number }
  /** Exact total rows in the current view/search. */
  total?: number
  /** Rows already loaded into `items`. */
  loaded?: number
  /** Whether more pages are available. */
  hasMore?: boolean
  /** A load-more request is in flight. */
  loadingMore?: boolean
  onLoadMore?: () => void
}

/**
 * Render one row bound to the panel's handlers.
 * @param task - Task view.
 * @param props - List props.
 * @returns A `TaskRow` element.
 */
function renderRow(task: TaskView, props: TaskListProps): React.ReactElement {
  return h(TaskRow, {
    key: task.id,
    task,
    today: props.today,
    t: props.t,
    readOnly: props.readOnly === true,
    onOpen: () => props.onOpen(task),
    onComplete: () => props.onComplete(task),
    onPin: () => props.onPin(task),
    onPause: () => props.onPause(task),
    onResume: () => props.onResume(task),
    onMenu: (x: number, y: number) => props.onMenu(task, x, y),
    onDuplicate: () => props.onDuplicate(task),
    onDelete: () => props.onDelete(task),
    onRemindNow: () => props.onRemindNow(task),
    showStage: props.searchActive === true && props.searchScope === 'all',
  })
}

/** The task list area. */
export function TaskList(props: TaskListProps) {
  const { t, view } = props

  if (props.phase === 'loading') {
    return h(
      'div',
      { className: 'dtd-skeleton', 'aria-label': t('state.loading') },
      [0, 1, 2].map((index) => h('span', { key: index })),
    )
  }

  if (props.phase === 'error') {
    const translated = t(`error.${props.errorCode}`)
    return h(
      'div',
      { className: 'dtd-center', role: 'alert' },
      h('span', { className: 'glyph' }, h(TodoGlyph, { size: 36 })),
      h('h2', null, t('state.errorTitle')),
      h('p', null, translated === `error.${props.errorCode}` ? t('state.errorHint') : translated),
      h('button', { type: 'button', className: 'dtd-btn', onClick: props.onRetry }, t('state.retry')),
    )
  }

  // The done view owns its own empty state: the quarter switcher must stay
  // reachable even when the current quarter has no completed tasks (F4.17).
  if (view === 'done' && props.searchActive !== true) {
    return h(
      'div',
      { className: 'dtd-body' },
      h(ArchiveView, {
        currentItems: props.items,
        today: props.today,
        t,
        onOpen: props.onOpen,
        onRestore: (task: TaskView) => props.onRestoreArchived?.(task),
        onChanged: () => props.onRetry(),
      }),
    )
  }

  if (props.items.length === 0) {
    const searching = props.search.trim() !== ''
    return h(
      'div',
      { className: 'dtd-center', 'data-testid': 'todos-diy-empty' },
      h('span', { className: 'glyph' }, h(TodoGlyph, { size: 40 })),
      h('h2', null, searching ? t('empty.noMatch', { query: props.search.trim() }) : t(`empty.${view}`)),
      h('p', null, searching ? t(props.searchScope === 'view' ? 'empty.noMatchHintView' : 'empty.noMatchHintAll') : t('empty.hint')),
      searching
        ? h(
            'div',
            { className: 'dtd-emptyActions' },
            props.searchScope === 'view' && props.onSearchAll !== undefined
              ? h('button', { type: 'button', className: 'dtd-btn', onClick: props.onSearchAll }, t('nlp.searchAll'))
              : null,
            h('button', { type: 'button', className: 'dtd-btn ghost', onClick: props.onClearSearch }, t('empty.clearSearch')),
          )
        : props.firstRun
          ? h(
            'div',
            null,
            h('p', { style: { marginTop: 12 } }, t('empty.firstTitle')),
            h(
              'div',
              { className: 'dtd-examples' },
              props.examples.map((example) =>
                h(
                  'button',
                  {
                    key: example.key,
                    type: 'button',
                    className: 'dtd-example',
                    onClick: () => props.onUseExample(example.draft),
                  },
                  example.label,
                  h('small', null, t('empty.useExample')),
                ),
              ),
            ),
          )
        : h(
            'button',
            { type: 'button', className: 'dtd-btn', onClick: props.onNew, disabled: props.readOnly === true },
            t('panel.new'),
          ),
    )
  }

  // Every view groups by priority; the paused filter naturally becomes one
  // "已暂停" group. Each group is paged to five rows until expanded (UX-19).
  const total = props.total ?? props.items.length
  const loaded = props.loaded ?? props.items.length
  // Show every non-empty group from the *full* counts, even when its rows have
  // not been loaded yet; otherwise the low/none groups would vanish entirely.
  const buckets = new Map<GroupKey, TaskView[]>(groupItems(props.items).map((group) => [group.key, group.items]))
  const ordered: GroupKey[] = ['pinned', 'high', 'mid', 'low', 'none', 'paused']
  const groups = ordered
    .filter((key) => (props.groupCounts?.[key] ?? 0) > 0 || (buckets.get(key)?.length ?? 0) > 0)
    .map((key) => ({ key, items: buckets.get(key) ?? [] }))
  return h(
    'div',
    { className: 'dtd-body' },
    h(
      'div',
      { className: 'dtd-listMeta' },
      t('list.meta', { total, loaded }),
      props.hasMore === true && props.onLoadMore !== undefined
        ? h('button', { type: 'button', className: 'dtd-linkBtn', disabled: props.loadingMore === true, onClick: props.onLoadMore }, props.loadingMore === true ? t('list.loadingMore') : t('list.loadMore'))
        : null,
    ),
    groups.map((group) =>
      h(
        'div',
        { className: 'dtd-group', key: `${view}:${props.search}:${group.key}` },
        h(
          'div',
          { className: 'dtd-groupHead' },
          h('b', null, group.key === 'pinned' ? `📌 ${t(`group.${group.key}`)}` : t(`group.${group.key}`)),
          h('span', { className: 'n' }, String(props.groupCounts?.[group.key] ?? group.items.length)),
          (props.groupCounts?.[group.key] ?? group.items.length) > group.items.length
            ? h('span', { className: 'hint' }, t('list.groupLoaded', { loaded: group.items.length, total: props.groupCounts?.[group.key] ?? 0 }))
            : null,
          group.key === 'pinned' ? h('span', { className: 'hint' }, t('group.pinnedHint')) : null,
        ),
        group.items.length === 0
          ? h('div', { className: 'dtd-groupEmpty' }, t('list.groupEmpty'))
          : h(CollapsibleRows, {
              items: group.items,
              renderItem: (task: TaskView) => renderRow(task, props),
              t,
              defaultExpanded: props.hasMore === true,
              storageKey: `dsh-todos-diy.group.${view}.${props.search}.${group.key}`,
            }),
      ),
    ),
  )
}

export type { GroupKey }
