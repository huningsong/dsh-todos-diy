/**
 * One task row (F8.2 / F8.13 / F8.14).
 *
 * Hover reveals exactly three controls (UX-03): pin, pause/resume and "more".
 * The row itself is a button-like element: clicking opens the editor, while the
 * checkbox completes the task.
 */

import * as React from 'react'

import type { TaskView } from '../../src/host/taskView'
import { CheckGlyph, PinGlyph } from './ui'
import { formatInZone } from './format'
import { stageLabelKey } from './search-scope'
import { ruleSummary } from './task-summary'

export { ruleSummary } from './task-summary'

const h = React.createElement

/** Props for one row. */
export interface TaskRowProps {
  task: TaskView
  today: string
  t: (key: string, params?: Record<string, string | number>) => string
  onOpen: () => void
  onComplete: () => void
  onPin: () => void
  onPause: () => void
  onResume: () => void
  onMenu: (x: number, y: number) => void
  onDuplicate: () => void
  onDelete: () => void
  onRemindNow: () => void
  /** Read-only mode: row actions are hidden and the checkbox does nothing. */
  readOnly?: boolean
  /** F8.17: show the stage badge (used by cross-stage search results). */
  showStage?: boolean
}

/**
 * Deadline text for the row (D-25: the only deadline is `once.endAt`).
 *
 * One-off tasks show the remaining time until `endAt`; recurring tasks show
 * their next trigger instead (handled separately).
 * @param task - Task view.
 * @param t - Translator.
 * @returns Label and whether it should read as overdue.
 */
function deadlineText(
  task: TaskView,
  t: (key: string, params?: Record<string, string | number>) => string,
): { text: string; overdue: boolean } {
  if (task.kind !== 'once' || task.once === null) return { text: t('task.noDeadline'), overdue: false }
  if (task.overdueDays !== null && task.overdueDays > 0) {
    return { text: t('task.overdue', { n: task.overdueDays }), overdue: true }
  }
  if (task.stage === 'overdue') return { text: t('task.overdue', { n: 0 }), overdue: true }
  const remaining = task.priority.remainingMinutes
  if (remaining === null) return { text: formatInZone(task.once.endAt, task.timeZone), overdue: false }
  if (remaining <= 60) return { text: t('task.dueInMinutes', { n: Math.max(1, remaining) }), overdue: false }
  if (remaining <= 24 * 60) return { text: t('task.dueInHours', { n: Math.floor(remaining / 60) }), overdue: false }
  return { text: formatInZone(task.once.endAt, task.timeZone), overdue: false }
}

/** Render one task row. */
export function TaskRow(props: TaskRowProps) {
  const { task, t } = props
  const due = deadlineText(task, t)
  const isPaused = task.status === 'paused'
  const canComplete = task.status === 'active'
  const canPause = task.status === 'active' || task.status === 'paused'
  const canPin = task.status !== 'done' && task.status !== 'archived'
  const nextText =
    task.kind === 'recurring'
      ? task.nextAt === null
        ? t('task.noNext')
        : t('task.nextAt', { time: formatInZone(task.nextAt, task.timeZone) })
      : null

  const rowClass = `dtd-row${task.pinned ? ' pinned' : ''}`

  return h(
    'li',
    {
      className: rowClass,
      'data-testid': 'task-row',
      'data-task-id': task.id,
      tabIndex: 0,
      role: 'button',
      'aria-label': `${task.title} — ${due.text}`,
      onClick: props.onOpen,
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          props.onOpen()
        }
      },
    },
    h(
      'button',
      {
        type: 'button',
        className: 'dtd-check',
        'aria-label': t('task.complete'),
        title: t('task.complete'),
        disabled: props.readOnly === true,
        onClick: (event: React.MouseEvent) => {
          event.stopPropagation()
          props.onComplete()
        },
      },
      h(CheckGlyph, { size: 10 }),
    ),
    h(
      'div',
      { className: 'dtd-rowMain' },
      h(
        'div',
        { className: 'dtd-rowTitle' },
        task.pinned ? h(PinGlyph, { size: 12, filled: true }) : null,
        h('span', { className: 't' }, task.title),
        h('span', { className: `dtd-badge ${task.priority.key}` }, t(`priority.${task.priority.key}`)),
        props.showStage === true ? h('span', { className: 'dtd-badge stage' }, t(stageLabelKey(task.stage))) : null,
        task.overdue ? h('span', { className: 'dtd-badge overdue' }, t('task.overdue', { n: task.overdueDays ?? 0 })) : null,
      ),
      h(
        'div',
        { className: 'dtd-rowSub' },
        h('span', { className: 'dtd-badge kind' }, t(`kind.${task.kind}`)),
        h('span', null, ruleSummary(task, t)),
        h('span', { className: 'sep' }, '·'),
        h('span', null, `${task.timeZone} ${task.utcOffset}`),
      ),
    ),
    h(
      'div',
      { className: 'dtd-rowRight' },
      h('span', { className: due.overdue ? 'overdue big' : 'big' }, due.text),
      h('span', null, isPaused ? t('priority.paused') : nextText),
    ),
    props.readOnly === true
      ? null
      : h(
      'div',
      { className: 'dtd-rowActions', onClick: (event: React.MouseEvent) => event.stopPropagation() },
      h(
        'button',
        {
          type: 'button',
          className: 'dtd-iconBtn',
          'aria-label': task.pinned ? t('task.unpin') : t('task.pin'),
          title: task.pinned ? t('task.unpin') : t('task.pin'),
          'aria-pressed': task.pinned,
          disabled: !canPin,
          onClick: props.onPin,
        },
        h(PinGlyph, { size: 13, filled: task.pinned }),
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'dtd-iconBtn',
          'aria-label': isPaused ? t('task.resume') : t('task.pause'),
          disabled: !canPause,
          onClick: isPaused ? props.onResume : props.onPause,
        },
        isPaused ? '▶' : '⏸',
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'dtd-iconBtn',
          'aria-label': t('task.more'),
          'aria-haspopup': 'menu',
          onClick: (event: React.MouseEvent) => {
            event.stopPropagation()
            const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
            props.onMenu(rect.left, rect.bottom + 4)
          },
        },
        '⋯',
      ),
    ),
  )
}
