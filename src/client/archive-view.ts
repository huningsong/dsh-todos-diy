/**
 * The "已完成" tab's quarter switch (F4.17 / AC-38).
 *
 * Defaults to the current quarter (the live document), and can switch to any
 * archived quarter listed by `/archive/index`. Archived tasks can be restored,
 * which moves them back into the live document (F4.18).
 */

import * as React from 'react'

import type { TaskView } from '../../src/host/taskView'
import { api, ApiError } from './api'
import { TaskRow } from './task-row'
import { formatInZone } from './ui'

const h = React.createElement

/** Props for the archive view. */
export interface ArchiveViewProps {
  /** Tasks of the current quarter, already loaded by the panel. */
  currentItems: TaskView[]
  today: string
  t: (key: string, params?: Record<string, string | number>) => string
  onOpen: (task: TaskView) => void
  onRestore: (task: TaskView) => void
  onChanged: () => void
}

/** The quarter switcher plus the archived month list. */
export function ArchiveView(props: ArchiveViewProps) {
  const { t } = props
  const [quarters, setQuarters] = React.useState<{ quarter: string; count: number }[]>([])
  const [selected, setSelected] = React.useState<string | null>(null)
  const [items, setItems] = React.useState<TaskView[]>([])
  const [cursor, setCursor] = React.useState<string | null>(null)
  const [phase, setPhase] = React.useState<'idle' | 'loading' | 'error'>('idle')

  // Load the index once so the selector can list the archived quarters.
  React.useEffect(() => {
    let cancelled = false
    void api
      .archiveIndex()
      .then((result) => {
        if (!cancelled) setQuarters(result.quarters.map((entry) => ({ quarter: entry.quarter, count: entry.count })))
      })
      .catch(() => {
        if (!cancelled) setQuarters([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** Load one archived quarter (or the first page more of it). */
  const load = React.useCallback(
    async (quarter: string, nextCursor?: string): Promise<void> => {
      setPhase('loading')
      try {
        const page = await api.archive(quarter, nextCursor)
        setItems((current) => (nextCursor === undefined ? page.items : [...current, ...page.items]))
        setCursor(page.nextCursor)
        setSelected(quarter)
        setPhase('idle')
      } catch (caught) {
        setPhase(caught instanceof ApiError && caught.code === 'not_found' ? 'idle' : 'error')
      }
    },
    [],
  )

  /** Restore one archived task and refresh both lists. */
  const restore = async (task: TaskView): Promise<void> => {
    try {
      await api.restore(task.id)
      setItems((current) => current.filter((entry) => entry.id !== task.id))
      setQuarters((current) =>
        current
          .map((entry) => (selected === null ? entry : { ...entry, count: Math.max(0, entry.count - 1) }))
          .filter((entry) => entry.count > 0 || entry.quarter !== selected),
      )
      props.onChanged()
    } catch {
      // Leave the row in place; the panel's toast reports the failure.
    }
  }

  return h(
    'div',
    { className: 'dtd-archive' },
    h(
      'div',
      { className: 'dtd-segment', role: 'tablist', 'aria-label': t('archive.history') },
      h(
        'button',
        {
          type: 'button',
          className: 'dtd-seg',
          role: 'tab',
          'aria-selected': selected === null ? 'true' : 'false',
          onClick: () => {
            setSelected(null)
            setItems([])
          },
        },
        t('archive.current'),
      ),
      quarters.map((entry) =>
        h(
          'button',
          {
            key: entry.quarter,
            type: 'button',
            className: 'dtd-seg',
            role: 'tab',
            'aria-selected': selected === entry.quarter ? 'true' : 'false',
            onClick: () => void load(entry.quarter),
          },
          `${entry.quarter} (${String(entry.count)})`,
        ),
      ),
    ),
    selected === null
      ? props.currentItems.length === 0
        ? h('div', { className: 'dtd-center' }, h('p', null, t('empty.done')))
        : h(
            'ul',
            { className: 'dtd-rows' },
            props.currentItems.map((task) =>
              h(TaskRow, {
                key: task.id,
                task,
                today: props.today,
                t,
                onOpen: () => props.onOpen(task),
                onComplete: () => undefined,
                onPin: () => undefined,
                onPause: () => undefined,
                onResume: () => undefined,
                onMenu: () => undefined,
                onDuplicate: () => undefined,
                onDelete: () => undefined,
                onRemindNow: () => undefined,
              }),
            ),
          )
      : phase === 'loading'
        ? h('div', { className: 'dtd-center' }, h('p', null, t('archive.loading')))
        : phase === 'error'
          ? h('div', { className: 'dtd-center' }, h('p', null, t('archive.error')))
          : items.length === 0
            ? h('div', { className: 'dtd-center' }, h('p', null, t('archive.empty')))
            : h(
                'ul',
                { className: 'dtd-rows' },
                items.map((task) =>
                  h(
                    'li',
                    { key: task.id, className: 'dtd-row', 'data-testid': 'archive-row' },
                    h(
                      'div',
                      { className: 'dtd-rowMain' },
                      h('div', { className: 'dtd-rowTitle' }, h('span', { className: 't' }, task.title)),
                      h(
                        'div',
                        { className: 'dtd-rowSub' },
                        h('span', null, task.doneAt === null ? '' : formatInZone(task.doneAt, task.timeZone)),
                        h('span', { className: 'sep' }, '·'),
                        h('span', null, task.timeZone),
                      ),
                    ),
                    h(
                      'button',
                      { type: 'button', className: 'dtd-btn small ghost', onClick: () => void restore(task) },
                      t('archive.restore'),
                    ),
                  ),
                ),
                cursor === null
                  ? null
                  : h(
                      'button',
                      { type: 'button', className: 'dtd-btn ghost', onClick: () => void load(selected, cursor) },
                      t('overlay.expand'),
                    ),
              ),
  )
}
