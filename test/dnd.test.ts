/**
 * Do-not-disturb tests (F5.6 / F9.2 / UX-05).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  dndDurationMinutes,
  dndEndsAt,
  isWithinDnd,
  minutesOfDay,
  parseClock,
  shouldDropInsteadOfSummarise,
} from '../src/host/dnd.js'

/** DND settings builder. */
function dnd(overrides: Partial<{ enabled: boolean; start: string; end: string; weekdaysOnly: boolean }> = {}) {
  return { enabled: true, start: '22:00', end: '08:00', weekdaysOnly: false, ...overrides }
}

/** A local instant in Asia/Shanghai. */
function atLocal(text: string): Date {
  return new Date(`${text}+08:00`)
}

describe('parseClock', () => {
  it('accepts HH:mm', () => {
    assert.deepEqual(parseClock('22:00'), { hour: 22, minute: 0 })
    assert.deepEqual(parseClock('7:05'), { hour: 7, minute: 5 })
  })

  it('rejects malformed values', () => {
    for (const value of ['24:00', '12:60', 'noon', '', 2200, null]) {
      assert.equal(parseClock(value), null)
    }
  })
})

describe('minutesOfDay', () => {
  it('converts a clock reading', () => {
    assert.equal(minutesOfDay({ hour: 0, minute: 0 }), 0)
    assert.equal(minutesOfDay({ hour: 22, minute: 30 }), 1350)
  })
})

describe('dndDurationMinutes', () => {
  it('measures a same-day window', () => {
    assert.equal(dndDurationMinutes(dnd({ start: '12:00', end: '14:00' })), 120)
  })

  it('measures a cross-midnight window', () => {
    assert.equal(dndDurationMinutes(dnd({ start: '22:00', end: '08:00' })), 600)
  })
})

describe('isWithinDnd (F9.2)', () => {
  it('is false when disabled', () => {
    assert.equal(isWithinDnd(dnd({ enabled: false }), atLocal('2026-10-30T23:00:00'), 'Asia/Shanghai'), false)
  })

  it('includes 23:30 and 07:30 for a 22:00–08:00 window', () => {
    assert.equal(isWithinDnd(dnd(), atLocal('2026-10-30T23:30:00'), 'Asia/Shanghai'), true)
    assert.equal(isWithinDnd(dnd(), atLocal('2026-10-31T07:30:00'), 'Asia/Shanghai'), true)
  })

  it('excludes 08:01 and 21:59', () => {
    assert.equal(isWithinDnd(dnd(), atLocal('2026-10-31T08:01:00'), 'Asia/Shanghai'), false)
    assert.equal(isWithinDnd(dnd(), atLocal('2026-10-30T21:59:00'), 'Asia/Shanghai'), false)
  })

  it('treats the start as inclusive and the end as exclusive', () => {
    assert.equal(isWithinDnd(dnd(), atLocal('2026-10-30T22:00:00'), 'Asia/Shanghai'), true)
    assert.equal(isWithinDnd(dnd(), atLocal('2026-10-31T08:00:00'), 'Asia/Shanghai'), false)
  })

  it('honours weekdaysOnly by skipping Saturday and Sunday', () => {
    const weekend = dnd({ weekdaysOnly: true })
    // 2026-10-31 is a Saturday, 2026-11-01 a Sunday.
    assert.equal(isWithinDnd(weekend, atLocal('2026-10-30T23:00:00'), 'Asia/Shanghai'), true) // Friday night
    assert.equal(isWithinDnd(weekend, atLocal('2026-10-31T23:00:00'), 'Asia/Shanghai'), false) // Saturday night
    assert.equal(isWithinDnd(weekend, atLocal('2026-11-01T23:00:00'), 'Asia/Shanghai'), false) // Sunday night
  })

  it('evaluates the window in the given zone, not UTC', () => {
    // 15:00 UTC is 23:00 in Shanghai (inside) but 15:00 in London (outside).
    const instant = new Date('2026-10-30T15:00:00Z')
    assert.equal(isWithinDnd(dnd(), instant, 'Asia/Shanghai'), true)
    assert.equal(isWithinDnd(dnd(), instant, 'Europe/London'), false)
  })

  it('is false for a degenerate zero-length window', () => {
    assert.equal(isWithinDnd(dnd({ start: '22:00', end: '22:00' }), atLocal('2026-10-30T22:00:00'), 'Asia/Shanghai'), false)
  })
})

describe('dndEndsAt', () => {
  it('returns the coming 08:00 for a 22:00–08:00 window', () => {
    const end = dndEndsAt(dnd(), atLocal('2026-10-30T23:30:00'), 'Asia/Shanghai')
    assert.equal(end.toISOString(), '2026-10-31T00:00:00.000Z')
  })

  it('returns the same day 08:00 when asked before it', () => {
    const end = dndEndsAt(dnd(), atLocal('2026-10-31T02:00:00'), 'Asia/Shanghai')
    assert.equal(end.toISOString(), '2026-10-31T00:00:00.000Z')
  })
})

describe('shouldDropInsteadOfSummarise (UX-05)', () => {
  it('drops a window longer than 12 hours', () => {
    assert.equal(shouldDropInsteadOfSummarise(dnd({ start: '08:00', end: '21:00' })), true)
  })

  it('drops a 24-hour window', () => {
    assert.equal(shouldDropInsteadOfSummarise(dnd({ start: '00:00', end: '23:59' })), true)
  })

  it('keeps the default 22:00–08:00 window as summarisable', () => {
    assert.equal(shouldDropInsteadOfSummarise(dnd()), false)
  })

  it('drops a window that covers the whole daytime', () => {
    assert.equal(shouldDropInsteadOfSummarise(dnd({ start: '08:00', end: '18:00' })), true)
  })
})
