/**
 * The scrollable task list (F8.2 / F8.4 / F8.13 / F8.15).
 *
 * Split from `panel.ts` to stay inside the NF5 budget. Receives everything it
 * renders through props: the panel owns state and mutations, this module owns
 * the loading / error / empty / grouped-list layout.
 */

import * as React from 'react'

import type { TaskView } from '../../src/host/taskView'
import { groupItems, type GroupKey } from './grouping'
import type { TaskDraft } from './task-editor'
import { TaskRow } from './task-row'
import { TodoGlyph } from './ui'
import { ArchiveView } from './archive-view'

const h = React.createElement

/** Everything the list needs. */
export interface TaskListProps {
  view: 'todo' | 'done' | 'overdue'
  phase: 'loading' | 'ready' | 'error'
  errorCode: string
  items: TaskView[]
  today: string
  t: (key: string, params?: Record<string, string | number>) => string
  firstRun: boolean
  examples: { key: string; label: string; draft: TaskDraft }[]
  onRetry: () => void
  onNew: () => void
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
    onOpen: () => props.onOpen(task),
    onComplete: () => props.onComplete(task),
    onPin: () => props.onPin(task),
    onPause: () => props.onPause(task),
    onResume: () => props.onResume(task),
    onMenu: (x: number, y: number) => props.onMenu(task, x, y),
    onDuplicate: () => props.onDuplicate(task),
    onDelete: () => props.onDelete(task),
    onRemindNow: () => props.onRemindNow(task),
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

  if (props.items.length === 0) {
    return h(
      'div',
      { className: 'dtd-center', 'data-testid': 'todos-diy-empty' },
      h('span', { className: 'glyph' }, h(TodoGlyph, { size: 40 })),
      h('h2', null, t(`empty.${view}`)),
      h('p', null, t('empty.hint')),
      props.firstRun
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
        : h('button', { type: 'button', className: 'dtd-btn', onClick: props.onNew }, t('panel.new')),
    )
  }

  if (view === 'todo') {
    return h(
      'div',
      { className: 'dtd-body' },
      groupItems(props.items).map((group) =>
        h(
          'div',
          { className: 'dtd-group', key: group.key },
          h(
            'div',
            { className: 'dtd-groupHead' },
            h('b', null, group.key === 'pinned' ? `📌 ${t(`group.${group.key}`)}` : t(`group.${group.key}`)),
            h('span', { className: 'n' }, String(group.items.length)),
            group.key === 'pinned' ? h('span', { className: 'hint' }, t('group.pinnedHint')) : null,
          ),
          h('ul', { className: 'dtd-rows' }, group.items.map((task) => renderRow(task, props))),
        ),
      ),
    )
  }

  if (view === 'done') {
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

  return h(
    'div',
    { className: 'dtd-body' },
    h('ul', { className: 'dtd-rows' }, props.items.map((task) => renderRow(task, props))),
  )
}

export type { GroupKey }
