/**
 * `resolveTick` tests: grace window, zero backfill, paused tasks, dedupe keys
 * and next-wake reporting.
 *
 * These are the acceptance cases for AC-08 (grace), AC-19 (3-day downtime),
 * AC-09 (repeat tick) and F6.4 (no burst after downtime).
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { buildHolidayTable, type HolidayFile } from '../src/host/rules/holidays.js'
import { resolveTick, withinGrace } from '../src/host/rules/resolveTick.js'
import { at, makeOnceTask, makeRule, makeTask } from './fixtures.js'

const here = dirname(fileURLToPath(import.meta.url))
const holidays = buildHolidayTable(
  JSON.parse(readFileSync(join(here, '../../assets/holidays-cn-2024-2027.json'), 'utf8')) as HolidayFile,
)

describe('withinGrace (D-06)', () => {
  const occurrence = { taskId: 'x', at: at('2026-10-30T01:00:00Z'), phase: null, key: 'k', kind: 'recurring' as const }

  it('admits exactly on time', () => {
    assert.equal(withinGrace(occurrence, at('2026-10-30T01:00:00Z'), 5), true)
  })

  it('admits one second inside the window', () => {
    assert.equal(withinGrace(occurrence, at('2026-10-30T01:04:59Z'), 5), true)
  })

  it('admits exactly at the window edge (09:05:00 for a 09:00 target)', () => {
    assert.equal(withinGrace(occurrence, at('2026-10-30T01:05:00Z'), 5), true)
  })

  it('rejects one second past the window (09:05:01)', () => {
    assert.equal(withinGrace(occurrence, at('2026-10-30T01:05:01Z'), 5), false)
  })

  it('treats graceMinutes 0 as strict', () => {
    assert.equal(withinGrace(occurrence, at('2026-10-30T01:00:00Z'), 0), true)
    assert.equal(withinGrace(occurrence, at('2026-10-30T01:00:01Z'), 0), false)
  })
})

describe('resolveTick — recurring', () => {
  it('fires an on-time occurrence and reports no misses', () => {
    const task = makeTask({ createdAt: '2026-10-30T00:00:00.000Z' })
    const plan = resolveTick([task], at('2026-10-30T01:00:30Z'), { holidays })
    assert.equal(plan.fire.length, 1)
    assert.equal(plan.markMissed.length, 0)
    assert.equal(plan.fire[0]?.at.toISOString(), '2026-10-30T01:00:00.000Z')
  })

  it('re-fires nothing on a second tick for the same occurrence (AC-09)', () => {
    // The repository records `lastFiredAt`; the pure function honours it.
    const task = makeTask({
      createdAt: '2026-10-30T00:00:00.000Z',
      state: { ...makeTask().state, lastFiredAt: '2026-10-30T01:00:00.000Z' },
    })
    const plan = resolveTick([task], at('2026-10-30T01:00:30Z'), { holidays })
    assert.equal(plan.fire.length, 0)
  })

  it('suppresses a re-fire after the clock is rolled back 5 minutes (AC-09)', () => {
    const task = makeTask({
      createdAt: '2026-10-30T00:00:00.000Z',
      state: { ...makeTask().state, lastFiredAt: '2026-10-30T01:00:00.000Z' },
    })
    const plan = resolveTick([task], at('2026-10-30T00:55:00Z'), { holidays })
    assert.equal(plan.fire.length, 0)
  })

  it('fires once inside the grace window after a late start (AC-08, 09:03)', () => {
    const task = makeTask({ createdAt: '2026-10-30T00:00:00.000Z' })
    const plan = resolveTick([task], at('2026-10-30T01:03:00Z'), { holidays, graceMinutes: 5 })
    assert.equal(plan.fire.length, 1)
    assert.equal(plan.markMissed.length, 0)
  })

  it('marks missed and does not fire past the window (AC-08, 09:06)', () => {
    const task = makeTask({ createdAt: '2026-10-30T00:00:00.000Z' })
    const plan = resolveTick([task], at('2026-10-30T01:06:00Z'), { holidays, graceMinutes: 5 })
    assert.equal(plan.fire.length, 0)
    assert.equal(plan.markMissed.length, 1)
    assert.equal(plan.markMissed[0]?.at.toISOString(), '2026-10-30T01:00:00.000Z')
  })

  it('never backfills after three days of downtime (AC-19)', () => {
    const task = makeTask({ createdAt: '2026-10-26T00:00:00.000Z' })
    const plan = resolveTick([task], at('2026-10-30T03:00:00Z'), { holidays, graceMinutes: 5 })
    assert.equal(plan.fire.length, 0)
    // Mon 26, Tue 27, Wed 28, Thu 29, Fri 30 at 09:00 local → 5 misses.
    assert.equal(plan.markMissed.length, 5)
    assert.equal(plan.markMissed.at(-1)?.at.toISOString(), '2026-10-30T01:00:00.000Z')
  })

  it('caps the missed backlog at the configured limit', () => {
    const task = makeTask({ createdAt: '2026-09-01T00:00:00.000Z' })
    const plan = resolveTick([task], at('2026-10-30T03:00:00Z'), { holidays, graceMinutes: 5, missedLimit: 10 })
    assert.equal(plan.fire.length, 0)
    assert.equal(plan.markMissed.length, 10)
  })

  it('skips paused tasks entirely — no fire, no missed (D-22)', () => {
    const task = makeTask({ status: 'paused', createdAt: '2026-10-26T00:00:00.000Z' })
    const plan = resolveTick([task], at('2026-10-30T03:00:00Z'), { holidays })
    assert.equal(plan.fire.length, 0)
    assert.equal(plan.markMissed.length, 0)
  })

  it('skips archived and done tasks', () => {
    const archived = makeTask({ status: 'archived', createdAt: '2026-10-29T00:00:00.000Z' })
    const done = makeTask({ status: 'done', createdAt: '2026-10-29T00:00:00.000Z' })
    const plan = resolveTick([archived, done], at('2026-10-30T03:00:00Z'), { holidays })
    assert.equal(plan.fire.length, 0)
    assert.equal(plan.markMissed.length, 0)
  })

  it('produces the documented occurrence key', () => {
    const task = makeTask({ id: 'tr_abc', createdAt: '2026-10-30T00:00:00.000Z' })
    const plan = resolveTick([task], at('2026-10-30T01:00:30Z'), { holidays })
    assert.equal(plan.fire[0]?.key, 'tr_abc@2026-10-30T01:00:00.000Z')
  })
})

describe('resolveTick — one-off tasks (D-03)', () => {
  const startAt = '2026-11-05T14:00:00+08:00'
  const endAt = '2026-11-05T18:00:00+08:00'

  it('fires the start node only, before the end node is due', () => {
    const task = makeOnceTask(startAt, endAt)
    const plan = resolveTick([task], at('2026-11-05T06:00:00Z'), { holidays })
    assert.equal(plan.fire.length, 1)
    assert.equal(plan.fire[0]?.phase, 'start')
    assert.equal(plan.fire[0]?.node, 'start')
  })

  it('fires both nodes when the whole window is in the past and both are fresh', () => {
    // A task created just now whose window already elapsed: both nodes are within grace.
    const task = makeOnceTask('2026-11-05T13:55:00+08:00', '2026-11-05T13:58:00+08:00')
    const plan = resolveTick([task], at('2026-11-05T05:59:00Z'), { holidays, graceMinutes: 5 })
    assert.deepEqual(plan.fire.map((occurrence) => occurrence.node), ['start', 'end'])
  })

  it('does not fire a node already marked fired', () => {
    const task = makeOnceTask(startAt, endAt, {
      state: { ...makeTask().state, firedStart: true, lastOccurrenceKey: 'k' },
    })
    // 18:00 local is 10:00Z; tick 30 s later so the end node is inside grace.
    const plan = resolveTick([task], at('2026-11-05T10:00:30Z'), { holidays })
    assert.deepEqual(plan.fire.map((occurrence) => occurrence.node), ['end'])
  })

  it('marks a stale start node missed instead of firing it', () => {
    const task = makeOnceTask(startAt, endAt)
    const plan = resolveTick([task], at('2026-11-05T06:10:00Z'), { holidays, graceMinutes: 5 })
    assert.equal(plan.fire.length, 0)
    assert.deepEqual(plan.markMissed.map((occurrence) => occurrence.node), ['start'])
  })

  it('uses #start and #end suffixes on the keys', () => {
    // A window that just elapsed: both nodes are inside the grace window.
    const task = makeOnceTask('2026-11-05T13:55:00+08:00', '2026-11-05T13:58:00+08:00')
    const plan = resolveTick([task], at('2026-11-05T05:59:00Z'), { holidays, graceMinutes: 5 })
    const keys = plan.fire.map((occurrence) => occurrence.key).sort()
    assert.equal(keys.length, 2)
    assert.equal(keys.some((key) => key.endsWith('#start')), true)
    assert.equal(keys.some((key) => key.endsWith('#end')), true)
  })
})

describe('resolveTick — nextWakeAt', () => {
  it('reports the next fire across active tasks', () => {
    const task = makeTask({ rule: makeRule({ cron: '0 9 * * 1-5' }) })
    const plan = resolveTick([task], at('2026-10-30T02:00:00Z'), { holidays })
    assert.equal(plan.nextWakeAt?.toISOString(), '2026-11-02T01:00:00.000Z')
  })

  it('reports null when every task is paused', () => {
    const task = makeTask({ status: 'paused' })
    assert.equal(resolveTick([task], at('2026-10-30T02:00:00Z'), { holidays }).nextWakeAt, null)
  })
})

describe('resolveTick — mixed set', () => {
  it('handles many tasks without cross-talk', () => {
    const tasks = [
      makeTask({ id: 'a', createdAt: '2026-10-30T00:00:00.000Z' }),
      makeTask({ id: 'b', status: 'paused', createdAt: '2026-10-26T00:00:00.000Z' }),
      makeOnceTask('2026-11-05T14:00:00+08:00', '2026-11-05T18:00:00+08:00', { id: 'c' }),
      makeTask({ id: 'd', status: 'archived' }),
    ]
    const plan = resolveTick(tasks, at('2026-10-30T01:00:30Z'), { holidays })
    assert.deepEqual(plan.fire.map((occurrence) => occurrence.taskId), ['a'])
  })
})
