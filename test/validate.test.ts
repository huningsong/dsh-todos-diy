/**
 * Validation tests (§7.4 field constraints, F2.1–F2.4, F2.5, F3.1–F3.3).
 *
 * Every `invalid_argument` / `invalid_cron` / `invalid_timezone` path the API
 * and agent tools can hit is exercised here, so the two callers share one
 * acceptance surface (F7.11).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  LIMITS,
  validateDateList,
  validateDescription,
  validateDueDate,
  validateNotify,
  validateRule,
  validateTimeZone,
  validateTitle,
} from '../src/host/validate.js'
import { parseInstant, validateOnce } from '../src/host/validateTime.js'

/** Assert that `fn` throws a ValidationError with the given code. */
function expectCode(fn: () => unknown, code: string, field?: string): void {
  assert.throws(fn, (error: { code?: string; details?: { field?: string } }) => {
    assert.equal(error.code, code)
    if (field !== undefined) assert.equal(error.details?.field, field)
    return true
  })
}

describe('validateTitle', () => {
  it('trims and accepts a normal title', () => {
    assert.equal(validateTitle('  查看今日待办  '), '查看今日待办')
  })

  it('rejects a non-string', () => {
    expectCode(() => validateTitle(42), 'invalid_argument', 'title')
  })

  it('rejects an empty or whitespace-only title', () => {
    expectCode(() => validateTitle(''), 'invalid_argument', 'title')
    expectCode(() => validateTitle('   '), 'invalid_argument', 'title')
  })

  it('accepts exactly 200 characters and rejects 201', () => {
    assert.equal(validateTitle('字'.repeat(LIMITS.titleMax)).length, 200)
    expectCode(() => validateTitle('字'.repeat(201)), 'invalid_argument', 'title')
  })

  it('trims before measuring the limit', () => {
    assert.equal(validateTitle(`  ${'a'.repeat(200)}  `).length, 200)
  })
})

describe('validateDescription', () => {
  it('defaults to an empty string', () => {
    assert.equal(validateDescription(undefined), '')
    assert.equal(validateDescription(null), '')
  })

  it('keeps a normal description verbatim', () => {
    assert.equal(validateDescription('含考勤汇总\n第二行'), '含考勤汇总\n第二行')
  })

  it('rejects a non-string', () => {
    expectCode(() => validateDescription(1), 'invalid_argument', 'description')
  })

  it('rejects more than 2000 characters', () => {
    expectCode(() => validateDescription('x'.repeat(2001)), 'invalid_argument', 'description')
  })
})

describe('validateDueDate', () => {
  it('accepts a real date', () => {
    assert.equal(validateDueDate('2026-11-03'), '2026-11-03')
  })

  it('treats null/undefined/empty as "no deadline"', () => {
    assert.equal(validateDueDate(undefined), null)
    assert.equal(validateDueDate(null), null)
    assert.equal(validateDueDate(''), null)
  })

  it('rejects a non-date shape', () => {
    expectCode(() => validateDueDate('2026-1-1'), 'invalid_argument', 'dueDate')
    expectCode(() => validateDueDate('03/11/2026'), 'invalid_argument', 'dueDate')
  })

  it('rejects dates that do not exist', () => {
    expectCode(() => validateDueDate('2026-02-30'), 'invalid_argument', 'dueDate')
    expectCode(() => validateDueDate('2026-13-01'), 'invalid_argument', 'dueDate')
  })

  it('rejects a non-string', () => {
    expectCode(() => validateDueDate(20261103), 'invalid_argument', 'dueDate')
  })
})

describe('validateTimeZone', () => {
  it('accepts a resolvable zone', () => {
    assert.equal(validateTimeZone('Asia/Tokyo'), 'Asia/Tokyo')
  })

  it('falls back to the default when the value is absent', () => {
    assert.equal(validateTimeZone(undefined, 'Asia/Shanghai'), 'Asia/Shanghai')
  })

  it('rejects an unknown zone with invalid_timezone', () => {
    expectCode(() => validateTimeZone('Asia/Beijing'), 'invalid_timezone', 'timeZone')
  })

  it('rejects a blank string', () => {
    expectCode(() => validateTimeZone('   '), 'invalid_timezone', 'timeZone')
  })
})

describe('validateDateList', () => {
  it('defaults to an empty array', () => {
    assert.deepEqual(validateDateList(undefined, 'rule.skipDates'), [])
  })

  it('sorts and de-duplicates', () => {
    assert.deepEqual(
      validateDateList(['2026-10-02', '2026-10-01', '2026-10-02'], 'rule.skipDates'),
      ['2026-10-01', '2026-10-02'],
    )
  })

  it('rejects a non-array', () => {
    expectCode(() => validateDateList('2026-10-01', 'rule.skipDates'), 'invalid_argument', 'rule.skipDates')
  })

  it('rejects an invalid date inside the list', () => {
    expectCode(() => validateDateList(['2026-02-30'], 'rule.skipDates'), 'invalid_argument', 'rule.skipDates')
  })

  it('rejects a non-string entry', () => {
    expectCode(() => validateDateList([20261001], 'rule.extraWorkdays'), 'invalid_argument', 'rule.extraWorkdays')
  })

  it('rejects more than 366 entries', () => {
    const many = Array.from({ length: 367 }, (_, index) => `2026-01-${String((index % 28) + 1).padStart(2, '0')}`)
    expectCode(() => validateDateList(many, 'rule.skipDates'), 'invalid_argument', 'rule.skipDates')
  })
})

describe('validateNotify', () => {
  const defaults = { channels: ['overlay'] as ('overlay' | 'system')[], template: '{title}' }

  it('inherits the defaults', () => {
    assert.deepEqual(validateNotify(undefined, defaults), {
      channels: ['overlay'],
      template: '{title}',
      advanceMinutes: 0,
      sound: false,
    })
  })

  it('accepts overlay+system', () => {
    assert.deepEqual(validateNotify({ channels: ['overlay', 'system'] }, defaults).channels, ['overlay', 'system'])
  })

  it('rejects a channel list without overlay', () => {
    expectCode(() => validateNotify({ channels: ['system'] }, defaults), 'invalid_argument', 'notify.channels')
  })

  it('rejects an empty channel list', () => {
    expectCode(() => validateNotify({ channels: [] }, defaults), 'invalid_argument', 'notify.channels')
  })

  it('rejects an unknown channel', () => {
    // `session` is not a channel in v1 (D-02).
    expectCode(() => validateNotify({ channels: ['session'] }, defaults), 'invalid_argument', 'notify.channels')
  })

  it('rejects a non-array channel list', () => {
    expectCode(() => validateNotify({ channels: 'overlay' }, defaults), 'invalid_argument', 'notify.channels')
  })

  it('validates advanceMinutes bounds', () => {
    assert.equal(validateNotify({ advanceMinutes: 1440 }, defaults).advanceMinutes, 1440)
    assert.equal(validateNotify({ advanceMinutes: 0 }, defaults).advanceMinutes, 0)
    for (const value of [-1, 1441, 1.5, 'ten']) {
      expectCode(() => validateNotify({ advanceMinutes: value }, defaults), 'invalid_argument', 'notify.advanceMinutes')
    }
  })

  it('rejects an empty template', () => {
    expectCode(() => validateNotify({ template: '  ' }, defaults), 'invalid_argument', 'notify.template')
  })

  it('rejects an over-long template', () => {
    expectCode(() => validateNotify({ template: 'x'.repeat(1001) }, defaults), 'invalid_argument', 'notify.template')
  })

  it('reads sound as a strict boolean', () => {
    assert.equal(validateNotify({ sound: true }, defaults).sound, true)
    assert.equal(validateNotify({ sound: 'yes' }, defaults).sound, false)
  })
})

describe('validateOnce (D-03)', () => {
  it('accepts a window with explicit offsets', () => {
    assert.deepEqual(validateOnce({ startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' }, 'Asia/Shanghai'), {
      startAt: '2026-11-05T06:00:00.000Z',
      endAt: '2026-11-05T10:00:00.000Z',
    })
  })

  it('interprets an offset-less window in the task zone', () => {
    assert.deepEqual(validateOnce({ startAt: '2026-11-05T14:00:00', endAt: '2026-11-05T18:00:00' }, 'Asia/Shanghai'), {
      startAt: '2026-11-05T06:00:00.000Z',
      endAt: '2026-11-05T10:00:00.000Z',
    })
  })

  it('requires startAt', () => {
    expectCode(() => validateOnce({ endAt: '2026-11-05T18:00:00+08:00' }, 'Asia/Shanghai'), 'invalid_argument', 'once.startAt')
  })

  it('requires endAt (both nodes remind)', () => {
    expectCode(() => validateOnce({ startAt: '2026-11-05T14:00:00+08:00' }, 'Asia/Shanghai'), 'invalid_argument', 'once.endAt')
  })

  it('rejects endAt equal to startAt', () => {
    expectCode(
      () => validateOnce({ startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T14:00:00+08:00' }, 'Asia/Shanghai'),
      'invalid_argument',
      'once.endAt',
    )
  })

  it('rejects endAt before startAt', () => {
    expectCode(
      () => validateOnce({ startAt: '2026-11-05T18:00:00+08:00', endAt: '2026-11-05T14:00:00+08:00' }, 'Asia/Shanghai'),
      'invalid_argument',
      'once.endAt',
    )
  })

  it('rejects an unparseable instant', () => {
    expectCode(
      () => validateOnce({ startAt: 'tomorrow', endAt: '2026-11-05T18:00:00+08:00' }, 'Asia/Shanghai'),
      'invalid_argument',
      'once.startAt',
    )
  })

  it('treats a non-object as missing both bounds', () => {
    expectCode(() => validateOnce(null, 'Asia/Shanghai'), 'invalid_argument')
  })
})

describe('parseInstant', () => {
  it('accepts a `Z` suffix', () => {
    assert.equal(parseInstant('2026-11-05T06:00:00Z', 'Asia/Shanghai', 'f').toISOString(), '2026-11-05T06:00:00.000Z')
  })

  it('accepts a compact offset', () => {
    assert.equal(parseInstant('2026-11-05T14:00:00+0800', 'Asia/Shanghai', 'f').toISOString(), '2026-11-05T06:00:00.000Z')
  })

  it('applies the zone offset for a date-only local value', () => {
    expectCode(() => parseInstant('2026-11-05', 'Asia/Shanghai', 'f'), 'invalid_argument')
  })
})

describe('validateRule — presets', () => {
  it('workdays: canonical Mon–Fri cron from a wall clock', () => {
    const rule = validateRule({ preset: 'workdays', time: '09:00' }, 'Asia/Shanghai')
    assert.equal(rule.cron, '0 9 * * 1-5')
    assert.equal(rule.preset, 'workdays')
    assert.equal(rule.holidayCalendar, 'CN')
    assert.equal(rule.timeZone, 'Asia/Shanghai')
  })

  it('workdays: honours holidayCalendar "none"', () => {
    assert.equal(validateRule({ preset: 'workdays', time: '09:00', holidayCalendar: 'none' }, 'Asia/Shanghai').holidayCalendar, 'none')
  })

  it('weekly: converts ISO weekdays to cron (7 → 0)', () => {
    assert.equal(validateRule({ preset: 'weekly', weekdays: [1, 3], time: '10:00' }, 'UTC').cron, '0 10 * * 1,3')
    assert.equal(validateRule({ preset: 'weekly', weekdays: [7], time: '10:00' }, 'UTC').cron, '0 10 * * 0')
  })

  it('weekly: de-duplicates and sorts the day set', () => {
    // 1,3,5 canonicalizes to the equivalent stepped range 1-5/2.
    assert.equal(validateRule({ preset: 'weekly', weekdays: [5, 1, 3, 1], time: '10:00' }, 'UTC').cron, '0 10 * * 1-5/2')
  })

  it('weekly: rejects an empty day set', () => {
    expectCode(() => validateRule({ preset: 'weekly', weekdays: [], time: '10:00' }, 'UTC'), 'invalid_argument', 'rule.weekdays')
  })

  it('weekly: rejects an out-of-range weekday', () => {
    expectCode(() => validateRule({ preset: 'weekly', weekdays: [8], time: '10:00' }, 'UTC'), 'invalid_argument', 'rule.weekdays')
    expectCode(() => validateRule({ preset: 'weekly', weekdays: [0], time: '10:00' }, 'UTC'), 'invalid_argument', 'rule.weekdays')
  })

  it('monthly: builds a dom list', () => {
    assert.equal(validateRule({ preset: 'monthly', monthDays: [1, 30], time: '09:00' }, 'UTC').cron, '0 9 1,30 * *')
  })

  it('monthly: de-duplicates and sorts', () => {
    assert.equal(validateRule({ preset: 'monthly', monthDays: [31, 1, 31], time: '09:00' }, 'UTC').cron, '0 9 1,31 * *')
  })

  it('monthly: rejects an empty or out-of-range day set', () => {
    expectCode(() => validateRule({ preset: 'monthly', monthDays: [] }, 'UTC'), 'invalid_argument', 'rule.monthDays')
    expectCode(() => validateRule({ preset: 'monthly', monthDays: [32] }, 'UTC'), 'invalid_argument', 'rule.monthDays')
    expectCode(() => validateRule({ preset: 'monthly', monthDays: [0] }, 'UTC'), 'invalid_argument', 'rule.monthDays')
  })

  it('monthly: defaults monthlyOverflow to lastDay and honours skip', () => {
    assert.equal(validateRule({ preset: 'monthly', monthDays: [31] }, 'UTC').monthlyOverflow, 'lastDay')
    assert.equal(
      validateRule({ preset: 'monthly', monthDays: [31], monthlyOverflow: 'skip' }, 'UTC').monthlyOverflow,
      'skip',
    )
  })

  it('custom: canonicalizes a valid expression', () => {
    assert.equal(validateRule({ preset: 'custom', cron: '0 9 * * 1-5' }, 'UTC').cron, '0 9 * * 1-5')
    assert.equal(validateRule({ preset: 'custom', cron: '0  9 * * 1-5' }, 'UTC').cron, '0 9 * * 1-5')
  })

  it('custom: rejects L/W/#/names/macros with invalid_cron', () => {
    for (const expression of ['0 9 L * *', '0 9 15W * *', '0 9 * * 5#3', '0 9 * * MON', '@daily', '0 0 9 * * *']) {
      expectCode(() => validateRule({ preset: 'custom', cron: expression }, 'UTC'), 'invalid_cron', 'rule.cron')
    }
  })

  it('custom: reports which cron field failed', () => {
    assert.throws(
      () => validateRule({ preset: 'custom', cron: '99 9 * * *' }, 'UTC'),
      (error: { code?: string; details?: { cronField?: string } }) => {
        assert.equal(error.code, 'invalid_cron')
        assert.equal(error.details?.cronField, 'minute')
        return true
      },
    )
  })

  it('custom: requires an expression', () => {
    expectCode(() => validateRule({ preset: 'custom' }, 'UTC'), 'invalid_cron', 'rule.cron')
  })

  it('rejects an unknown preset', () => {
    expectCode(() => validateRule({ preset: 'hourly' }, 'UTC'), 'invalid_argument', 'rule.preset')
  })

  it('rejects an invalid rule time zone', () => {
    expectCode(() => validateRule({ preset: 'workdays', time: '09:00', timeZone: 'Mars/Base' }, 'UTC'), 'invalid_timezone', 'timeZone')
  })

  it('validates skipDates and extraWorkdays', () => {
    const rule = validateRule(
      { preset: 'workdays', time: '09:00', skipDates: ['2026-10-01'], extraWorkdays: ['2026-10-11'] },
      'UTC',
    )
    assert.deepEqual(rule.skipDates, ['2026-10-01'])
    assert.deepEqual(rule.extraWorkdays, ['2026-10-11'])
  })

  it('rejects a malformed time', () => {
    expectCode(() => validateRule({ preset: 'workdays', time: '9:00' }, 'UTC'), 'invalid_argument', 'rule.time')
    expectCode(() => validateRule({ preset: 'workdays', time: '25:00' }, 'UTC'), 'invalid_argument', 'rule.time')
  })

  it('defaults the time to 09:00 when omitted', () => {
    assert.equal(validateRule({ preset: 'workdays' }, 'UTC').cron, '0 9 * * 1-5')
  })
})
