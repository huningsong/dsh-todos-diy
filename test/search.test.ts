/**
 * Search-primitive tests: the month-skip shortcut, the collection limit and the
 * `cronError` helper. These cover the branches the calendar tests do not reach.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CronError } from '../src/host/rules/cron.js'
import { cronError } from '../src/host/rules/occurrence.js'
import { canSkipMonths, latestOccurrences, occurrencesBetween } from '../src/host/rules/search.js'
import { parseCron } from '../src/host/rules/cron.js'
import { at, makeRule } from './fixtures.js'

describe('canSkipMonths', () => {
  it('allows the shortcut for a custom rule without extra workdays', () => {
    const rule = makeRule({ preset: 'custom', cron: '0 9 1 3 *', extraWorkdays: [] })
    assert.equal(canSkipMonths(parseCron(rule.cron), rule), true)
  })

  it('disables the shortcut for workdays rules', () => {
    const rule = makeRule({ extraWorkdays: [] })
    assert.equal(canSkipMonths(parseCron(rule.cron), rule), false)
  })

  it('disables the shortcut when extraWorkdays is non-empty', () => {
    const rule = makeRule({ preset: 'custom', cron: '0 9 1 3 *', extraWorkdays: ['2026-07-04'] })
    assert.equal(canSkipMonths(parseCron(rule.cron), rule), false)
  })
})

describe('occurrencesBetween — month shortcut', () => {
  it('jumps over non-matching months instead of walking every day', () => {
    const rule = makeRule({ preset: 'custom', cron: '0 9 1 3 *', extraWorkdays: [] })
    const found = occurrencesBetween(rule, at('2026-01-01T00:00:00Z'), at('2027-01-01T00:00:00Z'))
    assert.deepEqual(
      found.map((instant) => instant.toISOString()),
      ['2026-03-01T01:00:00.000Z'],
    )
  })

  it('honours the limit argument', () => {
    const rule = makeRule({ preset: 'custom', cron: '0 9 * * *', holidayCalendar: 'none', extraWorkdays: [] })
    const found = occurrencesBetween(rule, at('2026-10-01T00:00:00Z'), at('2026-10-31T00:00:00Z'), undefined, 3)
    assert.equal(found.length, 3)
  })

  it('returns an empty array when the window is inverted', () => {
    const rule = makeRule()
    assert.deepEqual(occurrencesBetween(rule, at('2026-10-31T00:00:00Z'), at('2026-10-01T00:00:00Z')), [])
  })
})

describe('cronError', () => {
  it('returns null for a valid expression', () => {
    assert.equal(cronError('0 9 * * 1-5'), null)
  })

  it('returns the CronError for an invalid expression', () => {
    const error = cronError('0 9 L * *')
    assert.ok(error instanceof CronError)
    assert.equal(error.code, 'invalid_cron')
  })

  it('reports which field failed', () => {
    assert.equal(cronError('99 9 * * *')?.field, 'minute')
  })
})

describe('latestOccurrences — backward search', () => {
  it('finds the latest occurrence across several matching months', () => {
    const rule = makeRule({ preset: 'custom', cron: '0 9 1 * *', extraWorkdays: [] })
    const found = latestOccurrences(rule, at('2026-01-01T00:00:00Z'), at('2026-06-15T00:00:00Z'))
    assert.deepEqual(found.map((instant) => instant.toISOString()), ['2026-06-01T01:00:00.000Z'])
  })

  it('skips months that the rule does not name', () => {
    // A March-only rule evaluated in December: the walk must jump back to March.
    const rule = makeRule({ preset: 'custom', cron: '0 9 1 3 *', extraWorkdays: [] })
    const found = latestOccurrences(rule, at('2026-01-01T00:00:00Z'), at('2027-01-01T00:00:00Z'))
    assert.deepEqual(found.map((instant) => instant.toISOString()), ['2026-03-01T01:00:00.000Z'])
  })

  it('returns an empty array for an empty window', () => {
    const rule = makeRule()
    assert.deepEqual(latestOccurrences(rule, at('2026-10-30T00:00:00Z'), at('2026-10-30T00:00:00Z')), [])
  })
})
