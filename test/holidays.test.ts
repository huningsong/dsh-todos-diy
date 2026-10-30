/**
 * Holiday-table tests, driven by the real shipped asset.
 *
 * The fixture is the actual `assets/holidays-cn-2024-2027.json`, so these tests
 * also guard the data file itself: a typo in 2026-10-10 would break the
 * make-up-workday assertion.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import {
  EMPTY_HOLIDAY_TABLE,
  buildHolidayTable,
  isHoliday,
  isMakeupWorkday,
  isWorkday,
  isWeekday,
  workdayPredicate,
  type HolidayFile,
  type HolidayTable,
} from '../src/host/rules/holidays.js'

const here = dirname(fileURLToPath(import.meta.url))
const assetPath = join(here, '../../assets/holidays-cn-2024-2027.json')
const file = JSON.parse(readFileSync(assetPath, 'utf8')) as HolidayFile
const table: HolidayTable = buildHolidayTable(file)

describe('holiday asset', () => {
  it('covers 2024–2027', () => {
    assert.deepEqual(table.years, [2024, 2025, 2026, 2027])
  })

  it('records a source', () => {
    assert.match(table.source, /chinese-days/)
  })
})

describe('isWorkday — 2026 National Day', () => {
  it('treats 2026-10-01 (Thursday, holiday) as a non-workday', () => {
    assert.equal(isWeekday({ year: 2026, month: 10, day: 1 }), true)
    assert.equal(isHoliday(table, '2026-10-01'), true)
    assert.equal(isWorkday(table, '2026-10-01'), false)
  })

  it('treats 2026-10-10 (Saturday, make-up workday) as a workday', () => {
    assert.equal(isWeekday({ year: 2026, month: 10, day: 10 }), false)
    assert.equal(isMakeupWorkday(table, '2026-10-10'), true)
    assert.equal(isWorkday(table, '2026-10-10'), true)
  })

  it('treats 2026-10-30 (Friday) as a workday', () => {
    assert.equal(isWorkday(table, '2026-10-30'), true)
  })

  it('treats a normal weekend as a non-workday', () => {
    assert.equal(isWorkday(table, '2026-10-31'), false)
  })

  it('covers the Spring Festival block', () => {
    assert.equal(isWorkday(table, '2026-02-17'), false)
    assert.equal(isWorkday(table, '2026-02-14'), true) // make-up Saturday
  })

  it('falls back to Mon–Fri outside the table coverage', () => {
    // 2027 has no published exceptions yet; a Wednesday is a workday.
    assert.equal(isWorkday(table, '2027-06-16'), true)
    assert.equal(isWorkday(table, '2027-06-19'), false) // Saturday
  })
})

describe('holidayCalendar: none', () => {
  const predicate = workdayPredicate(table, 'none')

  it('ignores the holiday table entirely', () => {
    assert.equal(predicate('2026-10-01'), true) // holiday, but a weekday
    assert.equal(predicate('2026-10-10'), false) // make-up Saturday
  })
})

describe('holidayCalendar: CN', () => {
  const predicate = workdayPredicate(table, 'CN')

  it('follows both holiday and make-up entries', () => {
    assert.equal(predicate('2026-10-01'), false)
    assert.equal(predicate('2026-10-10'), true)
  })
})

describe('robustness', () => {
  it('ignores malformed dates instead of throwing', () => {
    const tolerant = buildHolidayTable({
      schemaVersion: 1,
      source: 'test',
      years: {
        '2026': { holidays: ['2026-02-30', 'not-a-date', '2026-10-01'], workdays: ['2026-10-10'] },
        bogus: { holidays: [], workdays: [] },
      },
    } as unknown as HolidayFile)
    assert.deepEqual([...tolerant.holidays], ['2026-10-01'])
    assert.deepEqual([...tolerant.workdays], ['2026-10-10'])
    assert.deepEqual(tolerant.years, [2026])
  })

  it('rejects invalid date keys in isWorkday', () => {
    assert.equal(isWorkday(table, '2026-02-30'), false)
    assert.equal(isWorkday(table, 'nope'), false)
  })

  it('exposes an empty table for tests', () => {
    assert.equal(EMPTY_HOLIDAY_TABLE.holidays.size, 0)
    assert.equal(isWorkday(EMPTY_HOLIDAY_TABLE, '2026-10-30'), true)
  })
})
