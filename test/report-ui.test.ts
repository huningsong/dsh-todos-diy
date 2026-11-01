/**
 * F11 client-side report helpers: Markdown rendering and anchor dates.
 *
 * AC-REP-05 (preview/copy/export share one renderer) and AC-REP-06 (empty
 * sections keep their headings) are asserted against the pure renderer.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { previousMonth, resolveReportAnchor, shiftDays, todayInZone } from '../src/client/report-anchor.js'
import { localDate, renderReportMarkdown, reportFileName, shortTime } from '../src/client/report-markdown.js'
import type { ReportData } from '../src/host/reports.js'
import { zh } from '../src/client/dictionary-zh.js'
import { en } from '../src/client/dictionary-en.js'

const t = (key: string, params?: Record<string, string | number>): string => {
  const template = (zh as Record<string, string>)[key] ?? key
  if (params === undefined) return template
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template)
}

/** A complete empty report. */
const EMPTY: ReportData = {
  period: { kind: 'weekly', start: '2026-10-25T16:00:00.000Z', end: '2026-11-01T15:59:59.999Z', timeZone: 'Asia/Shanghai' },
  completed: [],
  overdue: [],
  created: [],
  upcoming: [],
  stats: { completed: 0, overdue: 0, inProgress: 0, recurring: 0, completionRate: null },
  generatedAt: '2026-10-30T04:00:00.000Z',
}

describe('AC-REP-05: one renderer for preview/copy/export', () => {
  it('renders the planned weekly template', () => {
    const report: ReportData = {
      ...EMPTY,
      completed: [{ id: 'a', title: '供应商合同评审', kind: 'once', count: 1, completedAt: '2026-10-28T02:00:00.000Z' }],
      overdue: [{ id: 'b', title: '供应商资质年审', kind: 'once', dueAt: '2026-10-28T10:00:00.000Z', overdueDays: 2 }],
      created: [{ id: 'c', title: '月度报表', kind: 'once', dueAt: '2026-11-05T02:00:00.000Z' }],
      upcoming: [{ id: 'd', title: '部门周例会', kind: 'once', nextAt: '2026-11-02T02:00:00.000Z' }],
      stats: { completed: 1, overdue: 1, inProgress: 2, recurring: 4, completionRate: 0.5 },
    }
    const markdown = renderReportMarkdown(report, t)
    assert.ok(markdown.startsWith('# 工作周报（2026-10-26 ~ 2026-11-01）'))
    assert.ok(markdown.includes('## 本周完成（1）'))
    assert.ok(markdown.includes('- [x] 供应商合同评审'))
    assert.ok(markdown.includes('## 逾期未完成（1）'))
    assert.ok(markdown.includes('- [ ] 供应商资质年审（超期 2 天）'))
    assert.ok(markdown.includes('## 本周新增（1）'))
    assert.ok(markdown.includes('- [ ] 月度报表'))
    assert.ok(markdown.includes('## 下周计划（1）'))
    assert.ok(markdown.includes('完成 1 · 逾期 1 · 进行中 2 · 循环 4'))
    assert.ok(markdown.includes('完成率 50%'))
    assert.ok(markdown.endsWith('\n'))
  })

  it('renders monthly headings and recurring counts', () => {
    const report: ReportData = {
      ...EMPTY,
      period: { kind: 'monthly', start: '2026-09-30T16:00:00.000Z', end: '2026-10-31T15:59:59.999Z', timeZone: 'Asia/Shanghai' },
      completed: [{ id: 'r', title: '交周报', kind: 'recurring', count: 3, completedAt: '2026-10-29T02:00:00.000Z' }],
    }
    const markdown = renderReportMarkdown(report, t)
    assert.ok(markdown.startsWith('# 工作月报（2026-10-01 ~ 2026-10-31）'))
    assert.ok(markdown.includes('## 本月完成（1）'))
    assert.ok(markdown.includes('- [x] 交周报 ×3'))
  })

  it('caps long sections while keeping the full count', () => {
    const report: ReportData = {
      ...EMPTY,
      completed: Array.from({ length: 60 }, (_, index) => ({
        id: `t${String(index)}`,
        title: `任务 ${String(index)}`,
        kind: 'once' as const,
        count: 1,
        completedAt: '2026-10-28T02:00:00.000Z',
      })),
    }
    const markdown = renderReportMarkdown(report, t)
    assert.ok(markdown.includes('## 本周完成（60）'))
    assert.ok(markdown.includes('其余 10 条已省略'))
    assert.equal((markdown.match(/^- \[x\]/gm) ?? []).length, 50)
  })

  it('keeps empty sections with 无', () => {
    const markdown = renderReportMarkdown(EMPTY, t)
    assert.ok(markdown.includes('## 本周完成（0）\n- 无'))
    assert.ok(markdown.includes('## 逾期未完成（0）\n- 无'))
    assert.equal(markdown.includes('完成率'), false)
  })

  it('derives the export file name', () => {
    assert.equal(reportFileName(EMPTY, t), '工作周报-2026-10-26.md')
    assert.equal(reportFileName({ ...EMPTY, period: { kind: 'monthly', start: '2026-09-30T16:00:00.000Z', end: '2026-10-31T15:59:59.999Z', timeZone: 'Asia/Shanghai' } }, t), '工作月报-2026-10.md')
  })

  it('has both languages for every report key', () => {
    for (const key of Object.keys(zh).filter((name) => name.startsWith('report.'))) {
      assert.ok((en as Record<string, string>)[key] !== undefined, `missing en key ${key}`)
    }
  })
})

describe('F11.6: period anchor helpers', () => {
  const NOW = new Date('2026-10-30T12:00:00+08:00')
  it('resolves this/last week and month', () => {
    assert.equal(resolveReportAnchor('weekly', 'this', 'Asia/Shanghai', NOW), '2026-10-30')
    assert.equal(resolveReportAnchor('weekly', 'last', 'Asia/Shanghai', NOW), '2026-10-23')
    assert.equal(resolveReportAnchor('monthly', 'this', 'Asia/Shanghai', NOW), '2026-10-30')
    assert.equal(resolveReportAnchor('monthly', 'last', 'Asia/Shanghai', NOW), '2026-09-01')
  })

  it('handles year boundaries', () => {
    assert.equal(previousMonth('2026-01-15'), '2025-12-01')
    assert.equal(shiftDays('2026-01-01', -1), '2025-12-31')
    assert.equal(todayInZone('Asia/Shanghai', NOW), '2026-10-30')
  })

  it('formats display dates', () => {
    assert.equal(shortTime('2026-10-28T02:00:00.000Z', 'Asia/Shanghai'), '10-28 10:00')
    assert.equal(localDate('2026-10-25T16:00:00.000Z', 'Asia/Shanghai'), '2026-10-26')
  })
})
