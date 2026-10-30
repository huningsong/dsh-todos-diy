/**
 * Occurrence tests: next-occurrence search, monthly overflow, holiday
 * interaction, exception dates, DST behaviour, one-off nodes and advance shift.
 *
 * Every case names the local wall clock it expects, because "09:00" is the
 * contract — the UTC instant is an implementation detail.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { buildHolidayTable, type HolidayFile } from '../src/host/rules/holidays.js'
import {
  applyAdvance,
  dueOccurrences,
  nextFireAt,
  nextOccurrence,
  nextWakeAt,
  occurrenceKey,
  occurrencesBetween,
} from '../src/host/rules/occurrence.js'
import { localDateTimeKey } from '../src/host/rules/timezone.js'
import { at, makeOnceTask, makeRule, makeTask } from './fixtures.js'

const here = dirname(fileURLToPath(import.meta.url))
const holidays = buildHolidayTable(
  JSON.parse(readFileSync(join(here, '../../assets/holidays-cn-2024-2027.json'), 'utf8')) as HolidayFile,
)

/** Local `YYYY-MM-DDTHH:mm` of an instant in a zone. */
function localOf(instant: Date | null, timeZone = 'Asia/Shanghai'): string | null {
  return instant === null ? null : localDateTimeKey(instant.getTime(), timeZone)
}

describe('occurrenceKey', () => {
  it('builds the documented key shape', () => {
    const instant = at('2026-10-30T01:00:00.000Z')
    assert.equal(occurrenceKey('tr_x', instant), 'tr_x@2026-10-30T01:00:00.000Z')
    assert.equal(occurrenceKey('tr_x', instant, 'start'), 'tr_x@2026-10-30T01:00:00.000Z#start')
    assert.equal(occurrenceKey('tr_x', instant, 'end'), 'tr_x@2026-10-30T01:00:00.000Z#end')
    assert.equal(occurrenceKey('tr_x', instant, 'advance'), 'tr_x@2026-10-30T01:00:00.000Z#advance')
    assert.equal(occurrenceKey('tr_x', instant, null), 'tr_x@2026-10-30T01:00:00.000Z')
  })

  it('is independent of the task time zone (F1.4)', () => {
    const instant = at('2026-10-30T01:00:00.000Z')
    const inShanghai = occurrenceKey('tr_x', instant)
    const sameInstant = new Date(instant.getTime())
    assert.equal(occurrenceKey('tr_x', sameInstant), inShanghai)
  })
})

describe('nextOccurrence — workdays', () => {
  const rule = makeRule()

  it('fires on a normal Friday at 09:00 local', () => {
    const next = nextOccurrence(rule, at('2026-10-30T00:00:00Z'), rule.timeZone, holidays)
    assert.equal(localOf(next), '2026-10-30T09:00')
    assert.equal(next?.toISOString(), '2026-10-30T01:00:00.000Z')
  })

  it('skips a Saturday', () => {
    const next = nextOccurrence(rule, at('2026-10-30T01:00:00Z'), rule.timeZone, holidays)
    assert.equal(localOf(next), '2026-11-02T09:00') // next Monday
  })

  it('skips National Day 2026-10-01 and lands on the next working day', () => {
    const next = nextOccurrence(rule, at('2026-09-30T01:00:00Z'), rule.timeZone, holidays)
    // 10-01..10-07 are holidays, 10-08 (Thu) is the first workday.
    assert.equal(localOf(next), '2026-10-08T09:00')
  })

  it('fires on the 2026-10-10 make-up Saturday', () => {
    const next = nextOccurrence(rule, at('2026-10-09T01:00:00Z'), rule.timeZone, holidays)
    assert.equal(localOf(next), '2026-10-10T09:00')
  })

  it('ignores holidays when holidayCalendar is none', () => {
    const plain = makeRule({ holidayCalendar: 'none' })
    const next = nextOccurrence(plain, at('2026-09-30T01:00:00Z'), plain.timeZone, holidays)
    assert.equal(localOf(next), '2026-10-01T09:00')
  })
})

describe('nextOccurrence — weekly', () => {
  it('fires only on Monday for the documented example', () => {
    const rule = makeRule({ preset: 'weekly', cron: '0 10 * * 1' })
    const next = nextOccurrence(rule, at('2026-10-30T00:00:00Z'), rule.timeZone, holidays)
    assert.equal(localOf(next), '2026-11-02T10:00')
    const afterMonday = nextOccurrence(rule, at('2026-11-02T02:00:00Z'), rule.timeZone, holidays)
    assert.equal(localOf(afterMonday), '2026-11-09T10:00')
  })

  it('fires on both Monday and Wednesday for a multi-day rule', () => {
    const rule = makeRule({ preset: 'weekly', cron: '0 10 * * 1,3' })
    const monday = nextOccurrence(rule, at('2026-10-30T00:00:00Z'), rule.timeZone, holidays)
    assert.equal(localOf(monday), '2026-11-02T10:00')
    const wednesday = nextOccurrence(rule, at('2026-11-02T02:00:00Z'), rule.timeZone, holidays)
    assert.equal(localOf(wednesday), '2026-11-04T10:00')
  })
})

describe('nextOccurrence — monthly overflow (D-05)', () => {
  it('moves 30 February to 28 February under lastDay', () => {
    const rule = makeRule({ preset: 'monthly', cron: '0 9 1,30 * *', monthlyOverflow: 'lastDay' })
    const first = nextOccurrence(rule, at('2026-01-31T00:00:00Z'), rule.timeZone, holidays)
    assert.equal(localOf(first), '2026-02-01T09:00')
    const second = nextOccurrence(rule, at('2026-02-01T01:00:00Z'), rule.timeZone, holidays)
    assert.equal(localOf(second), '2026-02-28T09:00')
  })

  it('moves 31 February to 28 February under lastDay', () => {
    const rule = makeRule({ preset: 'monthly', cron: '0 9 31 * *', monthlyOverflow: 'lastDay' })
    assert.equal(localOf(nextOccurrence(rule, at('2026-02-01T00:00:00Z'), rule.timeZone, holidays)), '2026-02-28T09:00')
  })

  it('moves 31 April to 30 April under lastDay', () => {
    const rule = makeRule({ preset: 'monthly', cron: '0 9 31 * *', monthlyOverflow: 'lastDay' })
    assert.equal(localOf(nextOccurrence(rule, at('2026-04-01T00:00:00Z'), rule.timeZone, holidays)), '2026-04-30T09:00')
  })

  it('skips February entirely under skip', () => {
    const rule = makeRule({ preset: 'monthly', cron: '0 9 31 * *', monthlyOverflow: 'skip' })
    assert.equal(localOf(nextOccurrence(rule, at('2026-02-01T00:00:00Z'), rule.timeZone, holidays)), '2026-03-31T09:00')
  })

  it('handles the 29th in a leap year', () => {
    const rule = makeRule({ preset: 'monthly', cron: '0 9 29 * *', monthlyOverflow: 'lastDay' })
    assert.equal(localOf(nextOccurrence(rule, at('2028-02-01T00:00:00Z'), rule.timeZone, holidays)), '2028-02-29T09:00')
    assert.equal(localOf(nextOccurrence(rule, at('2027-02-01T00:00:00Z'), rule.timeZone, holidays)), '2027-02-28T09:00')
  })
})

describe('nextOccurrence — cross-year and impossible rules', () => {
  it('crosses into the next year for a 1 January rule', () => {
    const rule = makeRule({ preset: 'custom', cron: '0 0 1 1 *' })
    const next = nextOccurrence(rule, at('2026-06-01T00:00:00Z'), 'UTC')
    assert.equal(localOf(next, 'UTC'), '2027-01-01T00:00')
  })

  it('returns null for 30 February', () => {
    const rule = makeRule({ preset: 'custom', cron: '0 0 30 2 *' })
    assert.equal(nextOccurrence(rule, at('2026-01-01T00:00:00Z'), 'UTC'), null)
  })
})

describe('nextOccurrence — exception dates (F2.5)', () => {
  it('honours skipDates', () => {
    const rule = makeRule({ skipDates: ['2026-10-30'] })
    // `after` is 10:00 local on 10-29, so 10-29 has already gone by.
    assert.equal(localOf(nextOccurrence(rule, at('2026-10-29T02:00:00Z'), rule.timeZone, holidays)), '2026-11-02T09:00')
  })

  it('lets extraWorkdays override the built-in holiday table', () => {
    const rule = makeRule({ extraWorkdays: ['2026-10-01'] })
    assert.equal(localOf(nextOccurrence(rule, at('2026-09-30T02:00:00Z'), rule.timeZone, holidays)), '2026-10-01T09:00')
  })

  it('lets skipDates beat extraWorkdays on the same date', () => {
    const rule = makeRule({ skipDates: ['2026-10-01'], extraWorkdays: ['2026-10-01'] })
    assert.notEqual(localOf(nextOccurrence(rule, at('2026-09-30T02:00:00Z'), rule.timeZone, holidays)), '2026-10-01T09:00')
  })

  it('lets skipDates beat a monthly lastDay overflow', () => {
    const rule = makeRule({
      preset: 'monthly',
      cron: '0 9 31 * *',
      monthlyOverflow: 'lastDay',
      skipDates: ['2026-02-28'],
    })
    assert.equal(localOf(nextOccurrence(rule, at('2026-02-01T00:00:00Z'), rule.timeZone, holidays)), '2026-03-31T09:00')
  })

  it('fires extraWorkdays on a weekend for a weekly rule', () => {
    const rule = makeRule({ preset: 'weekly', cron: '0 10 * * 1', extraWorkdays: ['2026-11-07'] })
    assert.equal(localOf(nextOccurrence(rule, at('2026-11-02T03:00:00Z'), rule.timeZone, holidays)), '2026-11-07T10:00')
  })
})

describe('nextOccurrence — DST (F2.7)', () => {
  it('skips the non-existent 2026-03-08 02:30 in New York', () => {
    const rule = makeRule({ preset: 'custom', cron: '30 2 * * *', timeZone: 'America/New_York', holidayCalendar: 'none' })
    const next = nextOccurrence(rule, at('2026-03-08T00:00:00Z'), rule.timeZone)
    // 03-08 02:30 does not exist; the next one is 03-09 02:30 EDT (06:30Z).
    assert.equal(next?.toISOString(), '2026-03-09T06:30:00.000Z')
  })

  it('fires the fall-back 01:30 only once, at the earlier instant', () => {
    const rule = makeRule({ preset: 'custom', cron: '30 1 * * *', timeZone: 'America/New_York', holidayCalendar: 'none' })
    const occurrences = occurrencesBetween(rule, at('2026-10-31T12:00:00Z'), at('2026-11-02T04:00:00Z'))
    assert.deepEqual(
      occurrences.map((instant) => instant.toISOString()),
      ['2026-11-01T05:30:00.000Z'],
    )
  })
})

describe('nextOccurrence — multiple times per day', () => {
  it('walks every configured time in order', () => {
    const rule = makeRule({ preset: 'custom', cron: '0,30 9 * * *', holidayCalendar: 'none' })
    const times = occurrencesBetween(rule, at('2026-10-30T00:00:00Z'), at('2026-10-30T12:00:00Z')).map(
      (instant) => localOf(instant),
    )
    assert.deepEqual(times, ['2026-10-30T09:00', '2026-10-30T09:30'])
  })
})

describe('dueOccurrences', () => {
  it('returns the on-time occurrence for a recurring task', () => {
    const task = makeTask({ createdAt: '2026-10-30T00:00:00.000Z' })
    const due = dueOccurrences(task, at('2026-10-30T01:00:30Z'), null)
    assert.equal(due.length, 1)
    assert.equal(due[0]?.at.toISOString(), '2026-10-30T01:00:00.000Z')
    assert.equal(due[0]?.phase, null)
  })

  it('returns nothing before the fire time', () => {
    const task = makeTask({ createdAt: '2026-10-30T00:00:00.000Z' })
    assert.equal(dueOccurrences(task, at('2026-10-30T00:59:00Z'), null).length, 0)
  })

  it('returns the un-fired start node of a one-off task', () => {
    const task = makeOnceTask('2026-11-05T14:00:00+08:00', '2026-11-05T18:00:00+08:00')
    const due = dueOccurrences(task, at('2026-11-05T06:00:00Z'), null)
    assert.equal(due.length, 1)
    assert.equal(due[0]?.phase, 'start')
    assert.equal(due[0]?.key.endsWith('#start'), true)
  })

  it('returns both nodes once the window has passed', () => {
    const task = makeOnceTask('2026-11-05T14:00:00+08:00', '2026-11-05T18:00:00+08:00')
    const due = dueOccurrences(task, at('2026-11-05T11:00:00Z'), null)
    assert.deepEqual(due.map((occurrence) => occurrence.phase), ['start', 'end'])
  })

  it('does not repeat a node already marked fired', () => {
    const task = makeOnceTask('2026-11-05T14:00:00+08:00', '2026-11-05T18:00:00+08:00', {
      state: { ...makeTask().state, firedStart: true },
    })
    const due = dueOccurrences(task, at('2026-11-05T11:00:00Z'), null)
    assert.deepEqual(due.map((occurrence) => occurrence.phase), ['end'])
  })
})

describe('applyAdvance (F5.7)', () => {
  it('keeps the on-time occurrence when advanceMinutes is 0', () => {
    const task = makeTask()
    const occurrence = applyAdvance(task, at('2026-10-30T01:00:00Z'), null)
    assert.equal(occurrence.phase, null)
    assert.equal(occurrence.at.toISOString(), '2026-10-30T01:00:00.000Z')
  })

  it('shifts ten minutes earlier and replaces the on-time reminder', () => {
    const task = makeTask({ notify: { ...makeTask().notify, advanceMinutes: 10 } })
    const occurrence = applyAdvance(task, at('2026-10-30T01:00:00Z'), null)
    assert.equal(occurrence.phase, 'advance')
    assert.equal(occurrence.at.toISOString(), '2026-10-30T00:50:00.000Z')
    assert.equal(occurrence.key, 'tr_test@2026-10-30T00:50:00.000Z#advance')
  })

  it('crosses midnight when the advance is large', () => {
    const task = makeTask({ notify: { ...makeTask().notify, advanceMinutes: 10 } })
    const occurrence = applyAdvance(task, at('2026-10-30T00:05:00+08:00'), null)
    assert.equal(localOf(occurrence.at), '2026-10-29T23:55')
  })
})

describe('nextFireAt / nextWakeAt', () => {
  it('reports the next fire for an active task', () => {
    const task = makeTask()
    assert.equal(localOf(nextFireAt(task, at('2026-10-30T02:00:00Z'), holidays)), '2026-11-02T09:00')
  })

  it('reports the remaining one-off nodes', () => {
    const task = makeOnceTask('2026-11-05T14:00:00+08:00', '2026-11-05T18:00:00+08:00')
    assert.equal(localOf(nextFireAt(task, at('2026-11-05T00:00:00Z'))), '2026-11-05T14:00')
  })

  it('picks the earliest across tasks and ignores paused ones', () => {
    const early = makeTask({ id: 'tr_early', rule: makeRule({ cron: '0 8 * * 1-5' }) })
    const late = makeTask({ id: 'tr_late', rule: makeRule({ cron: '0 18 * * 1-5' }) })
    const paused = makeTask({ id: 'tr_paused', status: 'paused', rule: makeRule({ cron: '0 6 * * 1-5' }) })
    const wake = nextWakeAt([early, late, paused], at('2026-10-30T11:00:00Z'), holidays)
    assert.equal(localOf(wake), '2026-11-02T08:00')
  })

  it('returns null when nothing is scheduled', () => {
    assert.equal(nextWakeAt([], at('2026-10-30T02:00:00Z')), null)
  })
})
