/**
 * One-line rule summary for a task row (F8.2).
 *
 * Pure: no React, no DOM — so the D-25 "created start is not a real start"
 * rule can be unit-tested directly.
 */

import type { TaskView } from '../../src/host/taskView.js'
import { formatInZone, weekdayLabel } from './format.js'

/**
 * Rule text, e.g. "每个工作日 09:00" / "每月 1、30 日 09:00".
 * @param task - Task view.
 * @param t - Translator.
 * @returns Short summary.
 */
export function ruleSummary(task: TaskView, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (task.kind === 'once' && task.once !== null) {
    const zone = task.timeZone
    const end = formatInZone(task.once.endAt, zone)
    // FIX-03: a task created with the default start has no user-entered start
    // time; showing `createdAt → endAt` would pretend it has one.
    if (task.once.startAtSource === 'created') {
      return t('task.onceDeadlineOnly', { end })
    }
    const start = formatInZone(task.once.startAt, zone)
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

