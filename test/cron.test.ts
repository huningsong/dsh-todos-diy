/**
 * Cron parser tests: accepted dialect, rejected dialect, canonicalization and
 * the Vixie dom/dow AND-OR branch.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CronError,
  canonicalizeCron,
  cronTimes,
  hasAnyMatchingDate,
  matchCron,
  parseCron,
} from '../src/host/rules/cron.js'

describe('parseCron — accepted dialect', () => {
  it('parses a plain weekday rule', () => {
    const spec = parseCron('0 9 * * 1-5')
    assert.deepEqual(spec.minutes, [0])
    assert.deepEqual(spec.hours, [9])
    assert.deepEqual(spec.daysOfMonth, Array.from({ length: 31 }, (_, i) => i + 1))
    assert.deepEqual(spec.months, Array.from({ length: 12 }, (_, i) => i + 1))
    assert.deepEqual(spec.daysOfWeek, [1, 2, 3, 4, 5])
  })

  it('expands a comma list', () => {
    const spec = parseCron('0 9 1,30 * *')
    assert.deepEqual(spec.daysOfMonth, [1, 30])
  })

  it('expands a stepped star', () => {
    const spec = parseCron('*/15 9-17 * * 1-5')
    assert.deepEqual(spec.minutes, [0, 15, 30, 45])
    assert.deepEqual(spec.hours, [9, 10, 11, 12, 13, 14, 15, 16, 17])
  })

  it('expands a stepped range', () => {
    const spec = parseCron('0 8-20/4 * * *')
    assert.deepEqual(spec.hours, [8, 12, 16, 20])
  })

  it('folds day-of-week 7 into Sunday 0', () => {
    const spec = parseCron('0 9 * * 7')
    assert.deepEqual(spec.daysOfWeek, [0])
  })

  it('keeps Sunday when 0 and 7 are both listed', () => {
    const spec = parseCron('0 9 * * 0,7')
    assert.deepEqual(spec.daysOfWeek, [0])
  })

  it('accepts whitespace-separated fields with extra spaces', () => {
    assert.equal(parseCron('0  9 *  * 1-5').expression, '0 9 * * 1-5')
  })
})

describe('parseCron — canonicalization', () => {
  it('keeps an already canonical expression unchanged', () => {
    for (const expression of [
      '0 9 * * 1-5',
      '0 9 1,30 * *',
      '*/15 9-17 * * 1-5',
      '0 0 * * *',
      '5 4 1 1 *',
    ]) {
      assert.equal(canonicalizeCron(expression), expression)
    }
  })

  it('reduces a full range to its shortest spelling', () => {
    assert.equal(canonicalizeCron('0-59 0-23 1-31 1-12 0-7'), '0-59 0-23 1-31 1-12 0-6')
  })

  it('keeps a star-led field star-led', () => {
    // Stepped stars must stay stars: the flag decides the dom/dow AND/OR branch.
    assert.equal(canonicalizeCron('0 9 */2 * *'), '0 9 */2 * *')
    assert.equal(canonicalizeCron('0 9 * * */2'), '0 9 * * */2')
  })

  it('does not invent a star for an explicit full range', () => {
    const canonical = canonicalizeCron('0 9 1-31 * *')
    assert.equal(canonical, '0 9 1-31 * *')
  })

  it('sorts and de-duplicates list elements', () => {
    assert.equal(canonicalizeCron('0 9 30,1,1 * *'), '0 9 1,30 * *')
  })

  it('is idempotent', () => {
    const first = canonicalizeCron('*/7 3,9,15 1-5 * 1-5')
    assert.equal(canonicalizeCron(first), first)
  })
})

describe('parseCron — rejected dialect', () => {
  const rejected: [string, string][] = [
    ['0 9 L * *', 'expression'],
    ['0 9 * * 1L', 'expression'],
    ['0 9 15W * *', 'expression'],
    ['0 9 * * 5#3', 'expression'],
    ['0 9 * * MON', 'expression'],
    ['0 9 * JAN *', 'expression'],
    ['@daily', 'expression'],
    ['0 0 9 * * *', 'expression'],
    ['0 9 * *', 'expression'],
    ['', 'expression'],
    ['  0 9 * * *', 'expression'],
    ['60 9 * * *', 'minute'],
    ['0 24 * * *', 'hour'],
    ['0 9 32 * *', 'day-of-month'],
    ['0 9 0 * *', 'day-of-month'],
    ['0 9 * 13 *', 'month'],
    ['0 9 * * 8', 'day-of-week'],
    ['0 9 5-1 * *', 'day-of-month'],
    ['*/0 9 * * *', 'minute'],
    ['0 9 1,,2 * *', 'day-of-month'],
    ['0 9 1-* * *', 'day-of-month'],
    ['0 9 * * */x', 'expression'],
  ]

  for (const [expression, field] of rejected) {
    it(`rejects ${JSON.stringify(expression)}`, () => {
      assert.throws(
        () => parseCron(expression),
        (error: unknown) => {
          assert.ok(error instanceof CronError)
          assert.equal(error.code, 'invalid_cron')
          assert.equal(error.field, field)
          return true
        },
      )
    })
  }
})

describe('matchCron', () => {
  const weekday = (iso: string): number => {
    const js = new Date(`${iso}T00:00:00Z`).getUTCDay()
    return js === 0 ? 7 : js
  }

  it('matches the documented weekday case', () => {
    const spec = parseCron('0 9 * * 1-5')
    assert.equal(matchCron(spec, { year: 2026, month: 10, day: 30, hour: 9, minute: 0 }, weekday('2026-10-30')), true)
    assert.equal(matchCron(spec, { year: 2026, month: 10, day: 31, hour: 9, minute: 0 }, weekday('2026-10-31')), false)
  })

  it('requires the exact minute and hour', () => {
    const spec = parseCron('0 9 * * *')
    assert.equal(matchCron(spec, { year: 2026, month: 10, day: 30, hour: 9, minute: 1 }, 5), false)
    assert.equal(matchCron(spec, { year: 2026, month: 10, day: 30, hour: 10, minute: 0 }, 5), false)
  })

  it('ORs a restricted dom with a restricted dow (Vixie)', () => {
    const spec = parseCron('0 9 1 * 1')
    // 2026-06-01 is a Monday and also day 1; 2026-06-08 is a Monday but not day 1.
    assert.equal(matchCron(spec, { year: 2026, month: 6, day: 1, hour: 9, minute: 0 }, weekday('2026-06-01')), true)
    assert.equal(matchCron(spec, { year: 2026, month: 6, day: 8, hour: 9, minute: 0 }, weekday('2026-06-08')), true)
    // 2026-06-02 is day 2 and a Tuesday: neither side matches.
    assert.equal(matchCron(spec, { year: 2026, month: 6, day: 2, hour: 9, minute: 0 }, weekday('2026-06-02')), false)
  })

  it('ANDs when the dow field is a star', () => {
    const spec = parseCron('0 9 1 * *')
    assert.equal(matchCron(spec, { year: 2026, month: 6, day: 1, hour: 9, minute: 0 }, weekday('2026-06-01')), true)
    assert.equal(matchCron(spec, { year: 2026, month: 6, day: 2, hour: 9, minute: 0 }, weekday('2026-06-02')), false)
  })

  it('ANDs when the dom field is a stepped star', () => {
    // `*/2` in dom keeps the star flag, so dow still restricts the result.
    const spec = parseCron('0 9 */2 * 1')
    assert.equal(spec.dayOfMonthStar, true)
    // 2026-06-01 (Mon, odd day) → dom walk from 1 hits 1,3,5… so 1 matches.
    assert.equal(matchCron(spec, { year: 2026, month: 6, day: 1, hour: 9, minute: 0 }, weekday('2026-06-01')), true)
    // 2026-06-08 (Mon, even day) → dom walk does not include 8.
    assert.equal(matchCron(spec, { year: 2026, month: 6, day: 8, hour: 9, minute: 0 }, weekday('2026-06-08')), false)
  })
})

describe('cronTimes', () => {
  it('returns ascending wall-clock times', () => {
    assert.deepEqual(cronTimes(parseCron('30,0 9,18 * * *')), [
      { hour: 9, minute: 0 },
      { hour: 9, minute: 30 },
      { hour: 18, minute: 0 },
      { hour: 18, minute: 30 },
    ])
  })
})

describe('hasAnyMatchingDate', () => {
  it('rejects 30 February', () => {
    assert.equal(hasAnyMatchingDate(parseCron('0 0 30 2 *')), false)
  })

  it('rejects 31 in short months only', () => {
    assert.equal(hasAnyMatchingDate(parseCron('0 0 31 4,6,9,11 *')), false)
    assert.equal(hasAnyMatchingDate(parseCron('0 0 31 1,3,5,7,8,10,12 *')), true)
  })

  it('accepts 29 February (leap year)', () => {
    assert.equal(hasAnyMatchingDate(parseCron('0 0 29 2 *')), true)
  })
})
