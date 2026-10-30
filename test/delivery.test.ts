/**
 * Delivery-layer tests (F5.1–F5.5, D-02, UX-10).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  acknowledge,
  buildReminderCard,
  deliveryRecordsFor,
  findDelivery,
  pendingDeliveries,
  phaseLabel,
  renderTemplate,
  reportSystemDelivery,
} from '../src/host/delivery.js'
import { occurrenceKey } from '../src/host/rules/occurrence.js'
import type { Occurrence } from '../src/host/rules/types.js'
import { makeOnceTask, makeTask } from './fixtures.js'

const NOW = new Date('2026-10-30T09:00:00+08:00')

/** Build one occurrence at the given instant. */
function occurrenceOf(taskId: string, iso: string, phase: Occurrence['phase'] = null): Occurrence {
  const at = new Date(iso)
  return { taskId, at, phase, key: occurrenceKey(taskId, at, phase), kind: 'recurring' }
}

describe('renderTemplate (UX-10 / F5.4)', () => {
  const values = { title: '季度材料', time: '2026-11-05 14:00', note: '含考勤', phase: '任务开始' }

  it('substitutes all four variables', () => {
    assert.equal(
      renderTemplate('{title}｜{time}\n{note}\n{phase}', values),
      '季度材料｜2026-11-05 14:00\n含考勤\n任务开始',
    )
  })

  it('leaves unknown variables verbatim', () => {
    assert.equal(renderTemplate('{title} {unknown}', values), '季度材料 {unknown}')
  })

  it('does not interpret HTML', () => {
    const rendered = renderTemplate('{title}', { ...values, title: '<script>alert(1)</script>' })
    assert.equal(rendered, '<script>alert(1)</script>')
  })

  it('substitutes repeated variables', () => {
    assert.equal(renderTemplate('{title}/{title}', values), '季度材料/季度材料')
  })
})

describe('phaseLabel', () => {
  it('distinguishes start and end (F3.7)', () => {
    assert.equal(phaseLabel('start'), '任务开始')
    assert.equal(phaseLabel('end'), '任务结束')
    assert.equal(phaseLabel('advance'), '提前提醒')
    assert.equal(phaseLabel(null), '提醒')
  })
})

describe('buildReminderCard', () => {
  it('carries title, local time, offset and rendered text', () => {
    const task = makeTask({ id: 'tr_a', title: '季度材料', description: '含考勤汇总' })
    const card = buildReminderCard(task, occurrenceOf('tr_a', '2026-11-05T06:00:00Z'))
    assert.equal(card.title, '季度材料')
    assert.equal(card.localTime, '2026-11-05T14:00')
    assert.equal(card.utcOffset, 'UTC+08:00')
    assert.match(card.text, /季度材料/)
    assert.match(card.text, /含考勤汇总/)
  })

  it('uses the task template', () => {
    const task = makeTask({
      id: 'tr_b',
      title: 'X',
      notify: { channels: ['overlay'], template: '{title}｜{time}', advanceMinutes: 0, sound: false },
    })
    const card = buildReminderCard(task, occurrenceOf('tr_b', '2026-11-05T06:00:00Z'))
    assert.equal(card.text.split('\n').length, 1)
    assert.match(card.text, /^X｜/)
  })

  it('labels a one-off start node', () => {
    const task = makeOnceTask('2026-11-05T14:00:00+08:00', '2026-11-05T18:00:00+08:00', { id: 'tr_c' })
    const card = buildReminderCard(task, occurrenceOf('tr_c', '2026-11-05T06:00:00Z', 'start'))
    assert.equal(card.phase, 'start')
  })
})

describe('deliveryRecordsFor', () => {
  it('always writes one overlay record', () => {
    const task = makeTask({ id: 'tr_a', notify: { channels: ['overlay'], template: '{title}', advanceMinutes: 0, sound: false } })
    const records = deliveryRecordsFor(task, occurrenceOf('tr_a', '2026-10-30T01:00:00Z'), NOW)
    assert.equal(records.length, 1)
    assert.equal(records[0]?.channel, 'overlay')
    assert.equal(records[0]?.status, 'ok')
  })

  it('adds a skipped placeholder for the system channel', () => {
    const task = makeTask({
      id: 'tr_a',
      notify: { channels: ['overlay', 'system'], template: '{title}', advanceMinutes: 0, sound: false },
    })
    const records = deliveryRecordsFor(task, occurrenceOf('tr_a', '2026-10-30T01:00:00Z'), NOW)
    assert.equal(records.length, 2)
    assert.equal(records[1]?.channel, 'system')
    assert.equal(records[1]?.status, 'skipped')
  })
})

describe('pendingDeliveries (F5.1 / F8.3)', () => {
  const task = makeTask({ id: 'tr_a' })
  const record = (key: string, at: string, extra: Partial<{ readAt: string; ignoredAt: string; status: 'ok' | 'failed' | 'skipped' }> = {}) => ({
    occurrenceKey: key,
    channel: 'overlay' as const,
    status: extra.status ?? ('ok' as const),
    at,
    readAt: extra.readAt ?? null,
    ignoredAt: extra.ignoredAt ?? null,
    dismissedAt: null,
    error: null,
  })

  it('returns an unacknowledged recent overlay row', () => {
    const key = 'tr_a@2026-10-30T01:00:00.000Z'
    const pending = pendingDeliveries([record(key, '2026-10-30T01:00:05.000Z')], [task], NOW)
    assert.equal(pending.length, 1)
  })

  it('drops acknowledged rows', () => {
    const key = 'tr_a@2026-10-30T01:00:00.000Z'
    const pending = pendingDeliveries(
      [record(key, '2026-10-30T01:00:05.000Z', { readAt: '2026-10-30T01:01:00.000Z' })],
      [task],
      NOW,
    )
    assert.equal(pending.length, 0)
  })

  it('keeps an old unacknowledged row (UX-01: the overlay never self-dismisses)', () => {
    const key = 'tr_a@2026-10-30T01:00:00.000Z'
    // A row from the previous day stays pending until the user acts on it.
    const pending = pendingDeliveries([record(key, '2026-10-29T23:00:00.000Z')], [task], NOW)
    assert.equal(pending.length, 1)
  })

  it('ignores non-overlay and non-ok rows', () => {
    const key = 'tr_a@2026-10-30T01:00:00.000Z'
    const systemRow = { ...record(key, '2026-10-30T01:00:05.000Z'), channel: 'system' as const }
    assert.equal(pendingDeliveries([systemRow], [task], NOW).length, 0)
    assert.equal(pendingDeliveries([record(key, '2026-10-30T01:00:05.000Z', { status: 'failed' })], [task], NOW).length, 0)
  })

  it('skips a task that was archived', () => {
    const key = 'tr_a@2026-10-30T01:00:00.000Z'
    const archived = { ...task, status: 'archived' as const }
    assert.equal(pendingDeliveries([record(key, '2026-10-30T01:00:05.000Z')], [archived], NOW).length, 0)
  })

  it('skips a row whose task no longer exists', () => {
    const pending = pendingDeliveries([record('tr_gone@2026-10-30T01:00:00.000Z', '2026-10-30T01:00:05.000Z')], [task], NOW)
    assert.equal(pending.length, 0)
  })
})

describe('acknowledge (F5.5)', () => {
  const key = 'tr_a@2026-10-30T01:00:00.000Z'
  const row = {
    occurrenceKey: key,
    channel: 'overlay' as const,
    status: 'ok' as const,
    at: '2026-10-30T01:00:05.000Z',
    readAt: null,
    ignoredAt: null,
    dismissedAt: null,
    error: null,
  }

  it('records dismissedAt and ignoredAt for dismiss', () => {
    const result = acknowledge([row], key, 'overlay', 'dismiss', NOW)
    assert.equal(result.changed, true)
    assert.ok(result.records[0]?.dismissedAt !== null)
    assert.ok(result.records[0]?.ignoredAt !== null)
    assert.ok(result.records[0]?.readAt !== null)
  })

  it('records readAt only for complete', () => {
    const result = acknowledge([row], key, 'overlay', 'complete', NOW)
    assert.equal(result.records[0]?.ignoredAt, null)
    assert.ok(result.records[0]?.readAt !== null)
  })

  it('reports changed: false for an unknown key', () => {
    assert.equal(acknowledge([row], 'tr_other@x', 'overlay', 'dismiss', NOW).changed, false)
  })

  it('does not mutate the input array', () => {
    const before = JSON.stringify([row])
    acknowledge([row], key, 'overlay', 'dismiss', NOW)
    assert.equal(JSON.stringify([row]), before)
  })
})

describe('reportSystemDelivery (F5.2/F5.3)', () => {
  const key = 'tr_a@2026-10-30T01:00:00.000Z'
  const row = {
    occurrenceKey: key,
    channel: 'system' as const,
    status: 'skipped' as const,
    at: '2026-10-30T01:00:05.000Z',
    readAt: null,
    ignoredAt: null,
    dismissedAt: null,
    error: 'page-visible',
  }

  it('marks a shown notification ok and clears the placeholder error', () => {
    const result = reportSystemDelivery([row], key, { ok: true }, NOW)
    assert.equal(result.found, true)
    assert.equal(result.records[0]?.status, 'ok')
    assert.equal(result.records[0]?.error, null)
  })

  it('recovers a permission-denied failure', () => {
    const result = reportSystemDelivery([row], key, { ok: false, error: 'permission-denied' }, NOW)
    assert.equal(result.records[0]?.status, 'failed')
    assert.equal(result.records[0]?.error, 'permission-denied')
  })

  it('defaults the failure reason', () => {
    const result = reportSystemDelivery([row], key, { ok: false }, NOW)
    assert.equal(result.records[0]?.error, 'not-supported')
  })

  it('reports not-found for a missing row', () => {
    assert.equal(reportSystemDelivery([row], 'tr_x@y', { ok: true }, NOW).found, false)
  })
})

describe('findDelivery', () => {
  it('filters by channel when asked', () => {
    const row = {
      occurrenceKey: 'k',
      channel: 'overlay' as const,
      status: 'ok' as const,
      at: NOW.toISOString(),
      readAt: null,
      ignoredAt: null,
      dismissedAt: null,
      error: null,
    }
    assert.ok(findDelivery([row], 'k') !== undefined)
    assert.equal(findDelivery([row], 'k', 'system'), undefined)
  })
})
