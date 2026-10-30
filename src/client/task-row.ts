/**
 * One task row (F8.2 / F8.13 / F8.14).
 *
 * Hover reveals exactly three controls (UX-03): pin, pause/resume and "more".
 * The row itself is a button-like element: clicking opens the editor, while the
 * checkbox completes the task.
 */

import * as React from 'react'

import type { TaskView } from '../../src/host/taskView'
import { dayDiff, formatInZone, PinGlyph, weekdayLabel } from './ui'

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
}

/**
 * Rule text, e.g. "每个工作日 09:00" / "每月 1、30 日 09:00".
 * @param task - Task view.
 * @param t - Translator.
 * @returns Short summary.
 */
export function ruleSummary(task: TaskView, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (task.kind === 'once' && task.once !== null) {
    const zone = task.timeZone
    const start = formatInZone(task.once.startAt, zone)
    const end = formatInZone(task.once.endAt, zone)
    return `${t('kind.once')} · ${start} → ${end}`
  }
  const rule = task.rule
  if (rule === null) return ''
  const cron = rule.cron.split(/\s+/)
  const minute = cron[0] ?? '0'
  const hour = cron[1] ?? '9'
  const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
  if (rule.preset === 'workdays') {
    return `${t('form.preset.workdays')} ${time}`
  }
  if (rule.preset === 'weekly') {
    const days = (cron[4] ?? '').split(',').map((token) => Number(token))
    const labels = days
      .filter((day) => Number.isInteger(day))
      .map((day) => weekdayLabel(t, day === 0 ? 7 : day))
      .join('、')
    return `${t('form.preset.weekly')} ${labels} ${time}`
  }
  if (rule.preset === 'monthly') {
    return `${t('form.preset.monthly')} ${cron[2] ?? ''} ${time}`
  }
  return rule.cron
}

/**
 * Due-date text + whether it reads as overdue.
 * @param task - Task view.
 * @param today - Today's local date in the task zone.
 * @param t - Translator.
 * @returns Label and tone.
 */
function dueText(
  task: TaskView,
  today: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): { text: string; overdue: boolean } {
  if (task.dueDate === null) return { text: t('task.noDue'), overdue: false }
  const diff = dayDiff(task.dueDate, today)
  if (diff < 0) return { text: t('task.overdue', { n: -diff }), overdue: true }
  if (diff === 0) return { text: t('task.today'), overdue: false }
  if (diff === 1) return { text: t('task.tomorrow'), overdue: false }
  if (diff <= 7) return { text: t('task.daysLater', { n: diff }), overdue: false }
  return { text: t('task.dueOn', { date: task.dueDate }), overdue: false }
}

/** Render one task row. */
export function TaskRow(props: TaskRowProps) {
  const { task, t } = props
  const due = dueText(task, props.today, t)
  const isPaused = task.status === 'paused'
  const nextText =
    task.nextAt === null
      ? t('task.noNext')
      : t('task.nextAt', { time: formatInZone(task.nextAt, task.timeZone) })

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
    h('button', {
      type: 'button',
      className: 'dtd-check',
      'aria-label': t('task.complete'),
      onClick: (event: React.MouseEvent) => {
        event.stopPropagation()
        props.onComplete()
      },
    }),
    h(
      'div',
      { className: 'dtd-rowMain' },
      h(
        'div',
        { className: 'dtd-rowTitle' },
        task.pinned ? h(PinGlyph, { size: 12, filled: true }) : null,
        h('span', { className: 't' }, task.title),
        h('span', { className: `dtd-badge ${task.priority.key}` }, t(`priority.${task.priority.key}`)),
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
    h(
      'div',
      { className: 'dtd-rowActions', onClick: (event: React.MouseEvent) => event.stopPropagation() },
      h(
        'button',
        {
          type: 'button',
          className: 'dtd-iconBtn',
          'aria-label': task.pinned ? t('task.unpin') : t('task.pin'),
          'aria-pressed': task.pinned,
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
