/**
 * Regression tests for defects found after the first review round.
 *
 * Each case names the defect it locks down so a future refactor cannot silently
 * reintroduce it.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { buildHolidayTable, type HolidayFile } from '../src/host/rules/holidays.js'
import { dueOccurrences } from '../src/host/rules/occurrence.js'
import { resolveTick } from '../src/host/rules/resolveTick.js'
import { makeOnceTask, makeRule, makeTask } from './fixtures.js'

const here = dirname(fileURLToPath(import.meta.url))
const holidays = buildHolidayTable(
  JSON.parse(readFileSync(join(here, '../../assets/holidays-cn-2024-2027.json'), 'utf8')) as HolidayFile,
)

describe('DEFECT-1: resolveTick must honour the holiday table', () => {
  it('does not fire a workdays task on 2026-10-01 (National Day)', () => {
    const task = makeTask({
      id: 'tr_a',
      createdAt: '2026-09-30T00:00:00.000Z',
      rule: makeRule({ preset: 'workdays', cron: '0 9 * * 1-5', holidayCalendar: 'CN' }),
    })
    const plan = resolveTick([task], new Date('2026-10-01T01:00:30Z'), { holidays, graceMinutes: 5 })
    assert.equal(plan.fire.length, 0, 'a public holiday must not fire')
  })

  it('fires a workdays task on 2026-10-10 (make-up Saturday)', () => {
    const task = makeTask({
      id: 'tr_b',
      createdAt: '2026-10-10T00:00:00.000Z',
      rule: makeRule({ preset: 'workdays', cron: '0 9 * * 1-5', holidayCalendar: 'CN' }),
    })
    const plan = resolveTick([task], new Date('2026-10-10T01:00:30Z'), { holidays, graceMinutes: 5 })
    assert.equal(plan.fire.length, 1, 'a make-up workday must fire')
  })

  it('still fires a normal Friday', () => {
    const task = makeTask({ id: 'tr_c', createdAt: '2026-10-30T00:00:00.000Z' })
    const plan = resolveTick([task], new Date('2026-10-30T01:00:30Z'), { holidays, graceMinutes: 5 })
    assert.equal(plan.fire.length, 1)
  })

  it('passes the table through dueOccurrences directly', () => {
    const task = makeTask({ id: 'tr_d', createdAt: '2026-10-01T00:00:00.000Z' })
    // Without the table this would return the 10-01 occurrence.
    assert.equal(dueOccurrences(task, new Date('2026-10-01T01:00:30Z'), null, holidays).length, 0)
    // With an empty table it would (the fixture default ignores holidays).
    assert.equal(dueOccurrences(task, new Date('2026-10-01T01:00:30Z'), null).length, 1)
  })
})

describe('DEFECT-2: an advance reminder must fire at its shifted instant (F5.7)', () => {
  /** A 14:00–18:00 one-off task with a 10-minute lead on the end node. */
  const advanced = (): ReturnType<typeof makeTask> =>
    makeOnceTask('2026-11-05T14:00:00+08:00', '2026-11-05T18:00:00+08:00', {
      id: 'tr_e',
      createdAt: '2026-11-04T00:00:00.000Z',
      notify: { channels: ['overlay'], template: '{title}', advanceMinutes: 10, sound: false, endReminder: true },
    })

  it('fires the end node at 17:50 instead of 18:00', () => {
    const task = advanced()
    task.state.firedStart = true // the 14:00 reminder already fired
    const due = dueOccurrences(task, new Date('2026-11-05T09:50:30Z'), null, holidays)
    assert.equal(due.length, 1)
    assert.equal(due[0]?.at.toISOString(), '2026-11-05T09:50:00.000Z')
    assert.equal(due[0]?.phase, 'advance')
    assert.equal(due[0]?.key.endsWith('#advance'), true)
  })

  it('does not fire the end node one minute early', () => {
    const due = dueOccurrences(advanced(), new Date('2026-11-05T09:49:00Z'), null, holidays)
    assert.equal(due.some((occurrence) => occurrence.key.includes('2026-11-05T09:50:00.000Z')), false)
  })

  it('does not fire the on-time occurrence after the advance already fired', () => {
    const task = advanced()
    task.state.firedStart = true
    const fired = dueOccurrences(task, new Date('2026-11-05T09:50:30Z'), null, holidays)
    task.state.lastFiredAt = fired[0]?.at.toISOString() ?? null
    task.state.lastOccurrenceKey = fired[0]?.key ?? null
    task.state.firedEndAdvance = true
    const lastFired = task.state.lastFiredAt
    assert.ok(lastFired !== null)
    const later = dueOccurrences(task, new Date('2026-11-05T10:00:30Z'), new Date(lastFired), holidays)
    assert.equal(later.length, 0, 'the advance reminder replaces the on-time one')
  })

  it('resolveTick reports the shifted instant as the fire time', () => {
    const plan = resolveTick([advanced()], new Date('2026-11-05T09:50:30Z'), { holidays, graceMinutes: 5 })
    assert.equal(plan.fire[0]?.at.toISOString(), '2026-11-05T09:50:00.000Z')
  })

  it('leaves the #start node on its natural instant', () => {
    const plan = resolveTick([advanced()], new Date('2026-11-05T06:00:30Z'), { holidays, graceMinutes: 5 })
    assert.equal(plan.fire[0]?.at.toISOString(), '2026-11-05T06:00:00.000Z')
    assert.equal(plan.fire[0]?.phase, 'start')
  })
})

describe('DEFECT-3: a recurring task ignores advanceMinutes (F5.7 v1 scope)', () => {
  /** A workdays task that mistakenly carries an advance setting. */
  const task = (lastFiredAt: string | null, advanceMinutes: number): ReturnType<typeof makeTask> =>
    makeTask({
      id: 'tr_f',
      createdAt: '2026-10-26T00:00:00.000Z',
      notify: { channels: ['overlay'], template: '{title}', advanceMinutes, sound: false, endReminder: true },
      state: { ...makeTask().state, lastFiredAt, lastOccurrenceKey: 'k' },
    })

  it('records exactly three missed days for a three-day outage', () => {
    const plan = resolveTick([task('2026-10-27T01:00:00.000Z', 0)], new Date('2026-10-30T03:00:00Z'), {
      holidays,
      graceMinutes: 5,
    })
    assert.equal(plan.markMissed.length, 3)
    assert.deepEqual(
      plan.markMissed.map((occurrence) => occurrence.at.toISOString()),
      ['2026-10-28T01:00:00.000Z', '2026-10-29T01:00:00.000Z', '2026-10-30T01:00:00.000Z'],
    )
  })

  it('produces the same rows even when advanceMinutes is set', () => {
    const plan = resolveTick([task('2026-10-27T01:00:00.000Z', 10)], new Date('2026-10-30T03:00:00Z'), {
      holidays,
      graceMinutes: 5,
    })
    // Two backlog days + the newest row (missed because it is beyond grace).
    assert.equal(plan.markMissed.length, 3)
    assert.deepEqual(
      plan.markMissed.map((occurrence) => occurrence.at.toISOString()),
      ['2026-10-28T01:00:00.000Z', '2026-10-29T01:00:00.000Z', '2026-10-30T01:00:00.000Z'],
    )
    assert.equal(plan.fire.length, 0)
  })

  it('keeps the recurring occurrences on a plain phase', () => {
    const plan = resolveTick([task('2026-10-27T01:00:00.000Z', 10)], new Date('2026-10-30T03:00:00Z'), {
      holidays,
      graceMinutes: 5,
    })
    assert.equal(plan.markMissed.every((occurrence) => occurrence.phase === null), true)
  })
})
