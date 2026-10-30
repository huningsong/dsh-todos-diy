/**
 * Weekly/monthly report modal (F11.6).
 *
 * Deterministic Markdown only: the modal fetches `GET /reports`, renders the
 * same string it copies and exports, and never mutates a task.
 */

import * as React from 'react'

import { api, ApiError, type ReportPayload } from './api'
import { renderReportMarkdown, reportFileName } from './report-markdown'
import { Modal } from './ui'
import { resolveReportAnchor, type ReportPeriodChoice } from './report-anchor'

const h = React.createElement

/** Props for the report modal. */
export interface ReportModalProps {
  t: (key: string, params?: Record<string, string | number>) => string
  timeZone: string
  onClose: () => void
}

/** The report modal. */
export function ReportModal(props: ReportModalProps): React.ReactNode {
  const { t, timeZone } = props
  // The four chips select both the report kind and the period in one click
  // (F11.6: 本周 / 上周 / 本月 / 上月).
  const [period, setPeriod] = React.useState<'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth'>('thisWeek')
  const kind: 'weekly' | 'monthly' = period.endsWith('Month') ? 'monthly' : 'weekly'
  const choice: ReportPeriodChoice = period.startsWith('this') ? 'this' : 'last'
  const [data, setData] = React.useState<ReportPayload | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [hint, setHint] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    setBusy(true)
    setError(null)
    api
      .report(kind, resolveReportAnchor(kind, choice, timeZone))
      .then((next) => {
        if (active) setData(next)
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof ApiError ? t(`error.${caught.code}`) : String(caught))
      })
      .finally(() => {
        if (active) setBusy(false)
      })
    return () => {
      active = false
    }
  }, [kind, choice, timeZone, t])

  const markdown = data === null ? '' : renderReportMarkdown(data, t)

  const copy = async (): Promise<void> => {
    // The async clipboard API needs a secure context; fall back to the legacy
    // execCommand path so copy still works in a plain http preview.
    let copied = false
    try {
      await navigator.clipboard.writeText(markdown)
      copied = true
    } catch {
      try {
        const area = document.createElement('textarea')
        area.value = markdown
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        copied = document.execCommand('copy')
        area.remove()
      } catch {
        copied = false
      }
    }
    setHint(copied ? t('report.copied') : t('report.copyFailed'))
  }

  const exportFile = (): void => {
    if (data === null) return
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = reportFileName(data, t)
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const periodChoices = [
    { key: 'thisWeek', label: t('report.period.thisWeek') },
    { key: 'lastWeek', label: t('report.period.lastWeek') },
    { key: 'thisMonth', label: t('report.period.thisMonth') },
    { key: 'lastMonth', label: t('report.period.lastMonth') },
  ] as const

  return h(
    Modal,
    {
      title: t('report.title'),
      onClose: props.onClose,
      wide: true,
      footer: [
        h('button', { key: 'c', type: 'button', className: 'dtd-btn ghost', onClick: props.onClose }, t('report.close')),
        h('button', { key: 'copy', type: 'button', className: 'dtd-btn ghost', disabled: data === null, onClick: () => void copy() }, t('report.copy')),
        h('button', { key: 'export', type: 'button', className: 'dtd-btn', disabled: data === null, onClick: exportFile }, t('report.export')),
      ],
    },
    h(
      'div',
      { className: 'dtd-reportTabs', role: 'tablist' },
      (['weekly', 'monthly'] as const).map((value) =>
        h(
          'button',
          { key: value, type: 'button', role: 'tab', className: 'dtd-reportTab', 'aria-selected': kind === value, onClick: () => setPeriod(value === 'weekly' ? 'thisWeek' : 'thisMonth') },
          t(value === 'weekly' ? 'report.tab.weekly' : 'report.tab.monthly'),
        ),
      ),
    ),
    h(
      'div',
      { className: 'dtd-segment dtd-reportPeriods' },
      periodChoices.map((entry) =>
        h(
          'button',
          { key: entry.key, type: 'button', className: 'dtd-seg', 'aria-pressed': period === entry.key, onClick: () => setPeriod(entry.key) },
          entry.label,
        ),
      ),
    ),
    hint === null ? null : h('div', { className: 'dtd-hint', role: 'status' }, hint),
    error === null ? null : h('div', { className: 'dtd-error', role: 'alert' }, error),
    busy ? h('div', { className: 'dtd-hint' }, t('report.loading')) : null,
    data === null
      ? null
      : h('pre', { className: 'dtd-reportPreview', 'data-testid': 'report-preview' }, markdown),
  )
}
