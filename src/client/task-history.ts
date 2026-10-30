/**
 * Per-task reminder history (F8.14 「查看历史」).
 *
 * Reads `/export` (the only endpoint that returns the delivery log) and shows
 * the rows for one task, newest first. Failure is non-fatal: the modal shows a
 * short message instead of throwing.
 */

import * as React from 'react'

import type { TaskView } from '../../src/host/taskView'
import { api } from './api'
import { Modal, formatInZone } from './ui'

const h = React.createElement

/** One persisted delivery row. */
interface DeliveryRow {
  occurrenceKey: string
  channel: 'overlay' | 'system'
  status: 'ok' | 'failed' | 'skipped'
  at: string
  readAt: string | null
  ignoredAt: string | null
  dismissedAt: string | null
  error: string | null
}

/** Props for the history panel. */
export interface TaskHistoryProps {
  task: TaskView
  t: (key: string, params?: Record<string, string | number>) => string
}

/** Delivery history for one task. */
export function TaskHistory(props: TaskHistoryProps) {
  const [rows, setRows] = React.useState<DeliveryRow[] | null>(null)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    void api
      .exportData()
      .then(({ text }) => {
        if (cancelled) return
        const parsed = JSON.parse(text) as { deliveries?: DeliveryRow[] }
        const prefix = `${props.task.id}@`
        setRows((parsed.deliveries ?? []).filter((row) => row.occurrenceKey.startsWith(prefix)).reverse())
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [props.task.id])

  if (failed) return h('div', { className: 'dtd-center' }, h('p', null, props.t('state.errorHint')))
  if (rows === null) return h('div', { className: 'dtd-center' }, h('p', null, props.t('state.loading')))
  if (rows.length === 0) return h('div', { className: 'dtd-center' }, h('p', null, props.t('task.noNext')))

  return h(
    'ul',
    { className: 'dtd-rows' },
    rows.map((row) =>
      h(
        'li',
        { key: `${row.occurrenceKey}-${row.channel}`, className: 'dtd-row' },
        h(
          'div',
          { className: 'dtd-rowMain' },
          h('div', { className: 'dtd-rowTitle' }, h('span', { className: 't' }, row.occurrenceKey)),
          h(
            'div',
            { className: 'dtd-rowSub' },
            h('span', null, `${row.channel} · ${row.status}`),
            h('span', { className: 'sep' }, '·'),
            h('span', null, formatInZone(row.at, props.task.timeZone)),
            row.error === null ? null : h('span', { className: 'sep' }, '·'),
            row.error === null ? null : h('span', null, row.error),
          ),
        ),
      ),
    ),
  )
}

/** Modal wrapper around {@link TaskHistory}. */
export function TaskHistoryModal(props: {
  task: TaskView
  t: (key: string, params?: Record<string, string | number>) => string
  onClose: () => void
}) {
  return h(
    Modal,
    {
      title: `${props.t('task.history')} · ${props.task.title}`,
      onClose: props.onClose,
      footer: h(
        'button',
        { type: 'button', className: 'dtd-btn ghost', onClick: props.onClose },
        props.t('form.cancel'),
      ),
    },
    h(TaskHistory, { task: props.task, t: props.t }),
  )
}
