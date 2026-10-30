/**
 * Time-zone arithmetic tests: offset lookup, DST gap/overlap, civil-date maths.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  addDays,
  daysBetween,
  daysInMonth,
  formatLocalDate,
  formatUtcOffset,
  isoWeekday,
  isSupportedTimeZone,
  isValidCivilDate,
  localDateKey,
  localToInstant,
  parseLocalDate,
  zoneOffsetMs,
} from '../src/host/rules/timezone.js'

describe('zone offsets', () => {
  it('keeps Asia/Shanghai at +08:00 all year (no DST)', () => {
    for (const iso of [
      '2026-01-15T00:00:00.000Z',
      '2026-04-15T00:00:00.000Z',
      '2026-07-15T00:00:00.000Z',
      '2026-10-15T00:00:00.000Z',
    ]) {
      assert.equal(zoneOffsetMs(Date.parse(iso), 'Asia/Shanghai'), 8 * 3_600_000)
    }
  })

  it('follows US DST in America/New_York', () => {
    // 2026-01-15 12:00Z is EST (UTC-5); 2026-07-15 12:00Z is EDT (UTC-4).
    assert.equal(zoneOffsetMs(Date.parse('2026-01-15T12:00:00Z'), 'America/New_York'), -5 * 3_600_000)
    assert.equal(zoneOffsetMs(Date.parse('2026-07-15T12:00:00Z'), 'America/New_York'), -4 * 3_600_000)
  })

  it('formats a UTC offset label for list rows', () => {
    assert.equal(formatUtcOffset(Date.parse('2026-10-30T00:00:00Z'), 'Asia/Shanghai'), 'UTC+08:00')
    assert.equal(formatUtcOffset(Date.parse('2026-01-15T00:00:00Z'), 'America/New_York'), 'UTC-05:00')
    assert.equal(formatUtcOffset(Date.parse('2026-07-15T00:00:00Z'), 'America/New_York'), 'UTC-04:00')
  })

  it('rejects unknown zones', () => {
    assert.equal(isSupportedTimeZone('Asia/Shanghai'), true)
    assert.equal(isSupportedTimeZone('Asia/Beijing'), false)
    assert.equal(isSupportedTimeZone(''), false)
    assert.equal(isSupportedTimeZone(42), false)
  })
})

describe('localToInstant', () => {
  it('converts a plain wall clock in a fixed-offset zone', () => {
    const instant = localToInstant(
      { year: 2026, month: 11, day: 5, hour: 14, minute: 0 },
      'Asia/Shanghai',
    )
    assert.equal(new Date(instant as number).toISOString(), '2026-11-05T06:00:00.000Z')
  })

  it('round-trips through localDateKey', () => {
    const instant = localToInstant(
      { year: 2026, month: 2, day: 28, hour: 9, minute: 30 },
      'Asia/Shanghai',
    ) as number
    assert.equal(localDateKey(instant, 'Asia/Shanghai'), '2026-02-28')
  })

  it('skips a spring-forward gap (2026-03-08 02:30 New York)', () => {
    const instant = localToInstant(
      { year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
      'America/New_York',
    )
    assert.equal(instant, undefined)
  })

  it('resolves a fall-back overlap to the earlier instant (2026-11-01 01:30 New York)', () => {
    const instant = localToInstant(
      { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
      'America/New_York',
    ) as number
    // The earlier 01:30 is EDT (UTC-4) → 05:30Z, not the later EST 06:30Z.
    assert.equal(new Date(instant).toISOString(), '2026-11-01T05:30:00.000Z')
  })
})

describe('civil date helpers', () => {
  it('validates real dates', () => {
    assert.equal(isValidCivilDate(2026, 2, 28), true)
    assert.equal(isValidCivilDate(2026, 2, 29), false)
    assert.equal(isValidCivilDate(2028, 2, 29), true)
    assert.equal(isValidCivilDate(2026, 4, 31), false)
    assert.equal(isValidCivilDate(2026, 13, 1), false)
  })

  it('counts month lengths including leap February', () => {
    assert.equal(daysInMonth(2026, 2), 28)
    assert.equal(daysInMonth(2028, 2), 29)
    assert.equal(daysInMonth(2026, 4), 30)
    assert.equal(daysInMonth(2026, 12), 31)
  })

  it('computes ISO weekdays', () => {
    assert.equal(isoWeekday({ year: 2026, month: 10, day: 30 }), 5) // Friday
    assert.equal(isoWeekday({ year: 2026, month: 10, day: 31 }), 6) // Saturday
    assert.equal(isoWeekday({ year: 2026, month: 11, day: 1 }), 7) // Sunday
    assert.equal(isoWeekday({ year: 2026, month: 10, day: 26 }), 1) // Monday
  })

  it('adds days across month and year boundaries', () => {
    assert.equal(formatLocalDate(addDays({ year: 2026, month: 12, day: 31 }, 1)), '2027-01-01')
    assert.equal(formatLocalDate(addDays({ year: 2026, month: 2, day: 28 }, 1)), '2026-03-01')
    assert.equal(formatLocalDate(addDays({ year: 2028, month: 2, day: 28 }, 1)), '2028-02-29')
    assert.equal(formatLocalDate(addDays({ year: 2026, month: 1, day: 1 }, -1)), '2025-12-31')
  })

  it('measures whole-day differences', () => {
    assert.equal(daysBetween({ year: 2026, month: 11, day: 3 }, { year: 2026, month: 10, day: 30 }), 4)
    assert.equal(daysBetween({ year: 2026, month: 10, day: 30 }, { year: 2026, month: 10, day: 30 }), 0)
    assert.equal(daysBetween({ year: 2026, month: 10, day: 29 }, { year: 2026, month: 10, day: 30 }), -1)
    // Across a DST change: still whole days, never 23/25 hours.
    assert.equal(daysBetween({ year: 2026, month: 11, day: 2 }, { year: 2026, month: 10, day: 31 }), 2)
  })

  it('parses only well-formed date keys', () => {
    assert.deepEqual(parseLocalDate('2026-10-30'), { year: 2026, month: 10, day: 30 })
    assert.equal(parseLocalDate('2026-2-3'), undefined)
    assert.equal(parseLocalDate('2026-02-30'), undefined)
    assert.equal(parseLocalDate('not-a-date'), undefined)
    assert.equal(parseLocalDate(20261030), undefined)
  })
})
