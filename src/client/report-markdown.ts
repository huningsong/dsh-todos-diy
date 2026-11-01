/**
 * Deterministic Markdown rendering for weekly/monthly reports (F11.5).
 *
 * Pure: the modal preview, copy and export all call this one function, so the
 * three outputs can never drift apart.
 */

import type { ReportData, ReportItem } from '../host/reports.js'

/** Maximum rows rendered per report section; counts remain complete. */
export const REPORT_SECTION_LIMIT = 50

/** Translator signature used by the renderer. */
export type Translate = (key: string, params?: Record<string, string | number>) => string

/**
 * Format an instant as a short local date-time.
 * @param iso - Instant.
 * @param timeZone - IANA zone.
 * @returns `MM-DD HH:mm`, or the original text when unparseable.
 */
export function shortTime(iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date)
    const pick = (type: string): string => parts.find((part) => part.type === type)?.value ?? ''
    return `${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`
  } catch {
    return iso
  }
}

/**
 * Format an instant as `YYYY-MM-DD` in a zone (used for file names).
 * @param iso - Instant.
 * @param timeZone - IANA zone.
 * @returns Date key.
 */
export function localDate(iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10)
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  } catch {
    return iso.slice(0, 10)
  }
}

/** Render one bullet row. */
function row(item: ReportItem, t: Translate, timeZone: string, checked: boolean): string {
  const suffix = item.count !== undefined && item.count > 1 ? ` ${t('report.item.count', { n: item.count })}` : ''
  const box = checked ? '[x]' : '[ ]'
  if (item.overdueDays !== undefined && item.overdueDays > 0) {
    return `- ${box} ${item.title}${suffix}（${t('report.item.overdueDays', { n: item.overdueDays })}）`
  }
  const zone = item.timeZone ?? timeZone
  if (item.nextAt !== undefined && item.nextAt !== null) {
    return `- ${box} ${item.title}${suffix}（${shortTime(item.nextAt, zone)}）`
  }
  if (item.dueAt !== undefined && item.dueAt !== null && item.completedAt === undefined) {
    return `- ${box} ${item.title}${suffix}（${shortTime(item.dueAt, zone)}）`
  }
  return `- ${box} ${item.title}${suffix}`
}

/**
 * Render a whole report to Markdown.
 * @param report - Report data.
 * @param t - Translator.
 * @returns Markdown text (ends with a newline).
 */
export function renderReportMarkdown(report: ReportData, t: Translate): string {
  const { kind, start, end, timeZone } = report.period
  const startDate = localDate(start, timeZone)
  const endDate = localDate(end, timeZone)
  const heading = '# ' + (kind === 'weekly'
    ? t('report.title.weekly', { start: startDate, end: endDate })
    : t('report.title.monthly', { start: startDate, end: endDate }))
  const section = (key: string, items: ReportItem[], checked = false): string[] => {
    const shown = items.slice(0, REPORT_SECTION_LIMIT)
    const hidden = items.length - shown.length
    return [
      `## ${t(key, { n: items.length })}`,
      ...(items.length === 0 ? [`- ${t('report.none')}`] : shown.map((item) => row(item, t, timeZone, checked))),
      ...(hidden > 0 ? [`- ${t('report.truncated', { n: hidden })}`] : []),
      '',
    ]
  }
  const lines: string[] = [heading, '']
  lines.push(...section(`report.section.completed.${kind}`, report.completed, true))
  lines.push(...section('report.section.overdue', report.overdue))
  lines.push(...section(`report.section.created.${kind}`, report.created))
  lines.push(...section(`report.section.upcoming.${kind}`, report.upcoming))
  lines.push('## ' + t('report.section.stats'))
  lines.push(t('report.stats.line', {
    completed: report.stats.completed,
    overdue: report.stats.overdue,
    inProgress: report.stats.inProgress,
    recurring: report.stats.recurring,
  }))
  if (report.stats.completionRate !== null) {
    lines.push(t('report.stats.rate', { rate: Math.round(report.stats.completionRate * 1000) / 10 }))
  }
  return `${lines.join('\n').trimEnd()}\n`
}

/**
 * Build the export file name.
 * @param report - Report data.
 * @param t - Translator (for the 工作周报/工作月报 prefix).
 * @returns `工作周报-YYYY-MM-DD.md` or `工作月报-YYYY-MM.md`.
 */
export function reportFileName(report: ReportData, t: Translate): string {
  const date = localDate(report.period.start, report.period.timeZone)
  return report.period.kind === 'weekly'
    ? t('report.file.weekly', { date })
    : t('report.file.monthly', { month: date.slice(0, 7) })
}
