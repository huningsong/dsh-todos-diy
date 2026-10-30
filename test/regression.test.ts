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
import { makeRule, makeTask } from './fixtures.js'

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

describe('DEFECT-2: an advance reminder must fire at its shifted instant', () => {
  const advanced = (): ReturnType<typeof makeTask> =>
    makeTask({
      id: 'tr_e',
      createdAt: '2026-10-29T00:00:00.000Z',
      notify: { channels: ['overlay'], template: '{title}', advanceMinutes: 10, sound: false },
    })

  it('fires at 08:50 for a 09:00 rule, not at 09:00', () => {
    const due = dueOccurrences(advanced(), new Date('2026-10-30T00:50:30Z'), null, holidays)
    assert.equal(due.length, 1)
    assert.equal(due[0]?.at.toISOString(), '2026-10-30T00:50:00.000Z')
    assert.equal(due[0]?.phase, 'advance')
    assert.equal(due[0]?.key.endsWith('#advance'), true)
  })

  it('has not fired one minute before the shifted instant', () => {
    const due = dueOccurrences(advanced(), new Date('2026-10-30T00:49:00Z'), null, holidays)
    assert.equal(due.some((occurrence) => occurrence.key.includes('2026-10-30T00:50:00.000Z')), false)
  })

  it('does not fire the on-time occurrence after the advance already fired', () => {
    const task = advanced()
    const fired = dueOccurrences(task, new Date('2026-10-30T00:50:30Z'), null, holidays)
    task.state.lastFiredAt = fired[0]?.at.toISOString() ?? null
    task.state.lastOccurrenceKey = fired[0]?.key ?? null
    const lastFired = task.state.lastFiredAt
    assert.ok(lastFired !== null)
    const later = dueOccurrences(task, new Date('2026-10-30T01:00:30Z'), new Date(lastFired), holidays)
    assert.equal(later.length, 0, 'the advance reminder replaces the on-time one')
  })

  it('resolveTick reports the shifted instant as the fire time', () => {
    const plan = resolveTick([advanced()], new Date('2026-10-30T00:50:30Z'), { holidays, graceMinutes: 5 })
    assert.equal(plan.fire[0]?.at.toISOString(), '2026-10-30T00:50:00.000Z')
  })
})

describe('DEFECT-3: advance + downtime must not over-count missed', () => {
  /** A workdays task with a 10-minute advance, last fired on 10-27. */
  const task = (lastFiredAt: string | null, advanceMinutes: number): ReturnType<typeof makeTask> =>
    makeTask({
      id: 'tr_f',
      createdAt: '2026-10-26T00:00:00.000Z',
      notify: { channels: ['overlay'], template: '{title}', advanceMinutes, sound: false },
      state: { ...makeTask().state, lastFiredAt, lastOccurrenceKey: 'k' },
    })

  it('records exactly three missed days for a three-day outage without advance', () => {
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

  it('records the same three days when a 10-minute advance shifts every instant', () => {
    const plan = resolveTick([task('2026-10-27T00:50:00.000Z', 10)], new Date('2026-10-30T03:00:00Z'), {
      holidays,
      graceMinutes: 5,
    })
    assert.equal(plan.markMissed.length, 3, 'the already-fired 10-27 advance must not be counted again')
    assert.deepEqual(
      plan.markMissed.map((occurrence) => occurrence.at.toISOString()),
      ['2026-10-28T00:50:00.000Z', '2026-10-29T00:50:00.000Z', '2026-10-30T00:50:00.000Z'],
    )
  })

  it('keeps the advance phase on every missed row', () => {
    const plan = resolveTick([task('2026-10-27T00:50:00.000Z', 10)], new Date('2026-10-30T03:00:00Z'), {
      holidays,
      graceMinutes: 5,
    })
    assert.equal(plan.markMissed.every((occurrence) => occurrence.phase === 'advance'), true)
  })
})
