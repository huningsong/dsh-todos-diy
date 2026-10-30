/**
 * Derived stage, priority, ordering and view counts (D-20/D-21/D-22/D-25,
 * F4.10–F4.14 / F4.21).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  computeCounts,
  daysOverdue,
  deadlineOf,
  derivePriority,
  derivePriorityFromRemaining,
  groupTasks,
  isOverdue,
  selectView,
  sortTasksForView,
  stageOf,
} from '../src/host/rules/priority.js'
import type { Task, TaskStage } from '../src/host/rules/types.js'
import { at, makeOnceTask, makeTask } from './fixtures.js'

const HOUR = 3_600_000

/** A one-off task whose window is a fixed offset around a pivot. */
function windowTask(startIso: string, endIso: string, overrides: Partial<Task> = {}): Task {
  return makeOnceTask(startIso, endIso, overrides)
}

describe('stageOf — the seven stages (D-25 / F1.2)', () => {
  const start = '2026-11-05T14:00:00+08:00'
  const end = '2026-11-05T18:00:00+08:00'

  it('is notStarted strictly before startAt', () => {
    assert.equal(stageOf(windowTask(start, end), at('2026-11-05T13:59:59+08:00')), 'notStarted' satisfies TaskStage)
  })

  it('is inProgress at the exact start second', () => {
    assert.equal(stageOf(windowTask(start, end), at('2026-11-05T14:00:00+08:00')), 'inProgress')
  })

  it('is inProgress in the middle of the window', () => {
    assert.equal(stageOf(windowTask(start, end), at('2026-11-05T16:00:00+08:00')), 'inProgress')
  })

  it('treats the endAt second itself as inProgress (F1.2)', () => {
    assert.equal(stageOf(windowTask(start, end), at('2026-11-05T18:00:00+08:00')), 'inProgress')
    assert.equal(stageOf(windowTask(start, end), at('2026-11-05T18:00:00.900+08:00')), 'inProgress')
  })

  it('is overdue from the first millisecond after the endAt second', () => {
    assert.equal(stageOf(windowTask(start, end), at('2026-11-05T18:00:01+08:00')), 'overdue')
  })

  it('never derives overdue for a paused task', () => {
    assert.equal(stageOf(windowTask(start, end, { status: 'paused' }), at('2027-01-01T00:00:00Z')), 'paused')
  })

  it('is done for a finished one-off task', () => {
    assert.equal(stageOf(windowTask(start, end, { status: 'done' }), at('2026-11-06T00:00:00Z')), 'done')
  })

  it('is recurring for an active recurring task regardless of its rule times', () => {
    assert.equal(stageOf(makeTask(), at('2030-01-01T00:00:00Z')), 'recurring')
  })

  it('is archived for a soft-deleted task', () => {
    assert.equal(stageOf(makeTask({ status: 'archived' }), at('2026-11-06T00:00:00Z')), 'archived')
  })
})

describe('derivePriorityFromRemaining — 24/72/168h boundaries (F4.12)', () => {
  const cases: [string, number, string][] = [
    ['overdue by 1 ms', -1, 'high'],
    ['exactly 0', 0, 'high'],
    ['exactly 24h', 24 * HOUR, 'high'],
    ['24h + 1ms', 24 * HOUR + 1, 'mid'],
    ['exactly 72h', 72 * HOUR, 'mid'],
    ['72h + 1ms', 72 * HOUR + 1, 'low'],
    ['exactly 168h', 168 * HOUR, 'low'],
    ['168h + 1ms', 168 * HOUR + 1, 'none'],
  ]
  for (const [label, remainingMs, key] of cases) {
    it(`${label} → ${key}`, () => {
      assert.equal(derivePriorityFromRemaining(remainingMs).key, key)
    })
  }

  it('floors remainingMinutes', () => {
    assert.equal(derivePriorityFromRemaining(59_999).remainingMinutes, 0)
    assert.equal(derivePriorityFromRemaining(60_000).remainingMinutes, 1)
    assert.equal(derivePriorityFromRemaining(-1).remainingMinutes, -1)
  })
})

describe('derivePriority — task-level (F4.12 / D-22)', () => {
  it('uses once.endAt for a one-off task', () => {
    const task = windowTask('2026-10-30T00:00:00Z', '2026-11-03T18:00:00+08:00')
    assert.equal(derivePriority(task, at('2026-10-30T18:00:00+08:00')).key, 'low')
    assert.equal(derivePriority(task, at('2026-11-01T18:00:00+08:00')).key, 'mid')
    assert.equal(derivePriority(task, at('2026-11-03T12:00:00+08:00')).key, 'high')
    assert.equal(derivePriority(task, at('2026-11-03T18:00:01+08:00')).key, 'high')
  })

  it('uses nextAt for a recurring task', () => {
    const task = makeTask({ kind: 'recurring' })
    const next = new Date('2026-11-02T01:00:00Z') // 30h away
    const priority = derivePriority(task, at('2026-10-31T19:00:00Z'), { nextAtFor: () => next })
    assert.equal(priority.key, 'mid')
  })

  it('reports none when a recurring task has no nextAt', () => {
    const priority = derivePriority(makeTask(), at('2026-10-31T19:00:00Z'), { nextAtFor: () => null })
    assert.equal(priority.key, 'none')
    assert.equal(priority.remainingMinutes, null)
  })

  it('reports paused for a paused task even when overdue', () => {
    const task = windowTask('2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z', { status: 'paused' })
    assert.deepEqual(derivePriority(task, at('2027-01-01T00:00:00Z')), { key: 'paused', remainingMinutes: null })
  })

  it('never writes priority onto the task', () => {
    const task = windowTask('2026-10-30T00:00:00Z', '2026-11-03T18:00:00+08:00')
    derivePriority(task, at('2026-10-30T18:00:00+08:00'))
    assert.equal(Object.hasOwn(task, 'priority'), false)
  })
})

describe('deadlineOf', () => {
  it('returns endAt for a one-off task', () => {
    const task = windowTask('2026-10-30T00:00:00Z', '2026-11-03T18:00:00+08:00')
    assert.equal(deadlineOf(task), Date.parse('2026-11-03T18:00:00+08:00'))
  })

  it('returns null for an inactive recurring task', () => {
    assert.equal(deadlineOf(makeTask({ status: 'paused' }), { nextAtFor: () => new Date() }), null)
  })
})

describe('isOverdue / daysOverdue', () => {
  const task = windowTask('2026-10-01T00:00:00Z', '2026-10-30T00:00:00Z')

  it('is overdue only after endAt', () => {
    assert.equal(isOverdue(task, at('2026-10-30T00:00:00Z')), false)
    assert.equal(isOverdue(task, at('2026-10-30T00:00:01Z')), true)
  })

  it('never reports a paused task as overdue', () => {
    assert.equal(isOverdue({ ...task, status: 'paused' }, at('2027-01-01T00:00:00Z')), false)
  })

  it('counts whole overdue days', () => {
    assert.equal(daysOverdue(task, at('2026-11-01T00:00:00Z')), 2)
    assert.equal(daysOverdue(task, at('2026-10-30T12:00:00Z')), 0)
  })

  it('returns null for a recurring task', () => {
    assert.equal(daysOverdue(makeTask(), at('2026-11-01T00:00:00Z')), null)
  })
})

describe('sortTasksForView (F4.7 / F4.14)', () => {
  const now = at('2026-10-30T00:00:00Z')

  it('puts pinned first, then priority, then earliest deadline', () => {
    const pinned = windowTask('2026-10-01T00:00:00Z', '2026-12-01T00:00:00Z', { id: 'p', pinned: true })
    const high = windowTask('2026-10-01T00:00:00Z', '2026-10-31T00:00:00Z', { id: 'h' })
    const low = windowTask('2026-10-01T00:00:00Z', '2026-11-20T00:00:00Z', { id: 'l' })
    const order = sortTasksForView([low, high, pinned], now).map((task) => task.id)
    assert.deepEqual(order, ['p', 'h', 'l'])
  })

  it('keeps an overdue pinned task at the top with high priority', () => {
    const pinned = windowTask('2026-01-01T00:00:00Z', '2026-10-01T00:00:00Z', { id: 'p', pinned: true })
    const normal = windowTask('2026-10-01T00:00:00Z', '2026-10-31T00:00:00Z', { id: 'n' })
    assert.deepEqual(sortTasksForView([normal, pinned], now).map((t) => t.id), ['p', 'n'])
    assert.equal(derivePriority(pinned, now).key, 'high')
  })

  it('sinks paused tasks below every priority group', () => {
    const paused = windowTask('2026-01-01T00:00:00Z', '2026-10-01T00:00:00Z', { id: 'z', status: 'paused' })
    const none = windowTask('2026-01-01T00:00:00Z', '2027-12-01T00:00:00Z', { id: 'n' })
    assert.deepEqual(sortTasksForView([paused, none], now).map((t) => t.id), ['n', 'z'])
  })

  it('puts tasks without a deadline last within a group', () => {
    const withDeadline = windowTask('2026-10-01T00:00:00Z', '2027-12-01T00:00:00Z', { id: 'a' })
    const noDeadline = makeTask({ id: 'b', kind: 'recurring' })
    const order = sortTasksForView([noDeadline, withDeadline], now, { nextAtFor: () => null }).map((t) => t.id)
    assert.deepEqual(order, ['a', 'b'])
  })

  it('does not mutate the input array', () => {
    const list = [windowTask('2026-10-01T00:00:00Z', '2026-12-01T00:00:00Z', { id: 'a' }), windowTask('2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z', { id: 'b' })]
    const before = list.map((task) => task.id)
    sortTasksForView(list, now)
    assert.deepEqual(list.map((task) => task.id), before)
  })
})

describe('computeCounts — six mutually exclusive buckets (F4.21 / AC-40)', () => {
  const now = at('2026-11-05T12:00:00+08:00')
  const tasks: Task[] = [
    // 3 not started
    ...['2026-11-06T10:00:00+08:00', '2026-11-07T10:00:00+08:00', '2026-11-08T10:00:00+08:00'].map((start, index) =>
      windowTask(start, '2026-11-09T10:00:00+08:00', { id: `n${String(index)}` }),
    ),
    // 2 in progress
    windowTask('2026-11-05T09:00:00+08:00', '2026-11-05T18:00:00+08:00', { id: 'p0' }),
    windowTask('2026-11-04T09:00:00+08:00', '2026-11-06T18:00:00+08:00', { id: 'p1' }),
    // 1 overdue
    windowTask('2026-11-01T09:00:00+08:00', '2026-11-02T18:00:00+08:00', { id: 'o0' }),
    // 4 done
    ...['d0', 'd1', 'd2', 'd3'].map((id) =>
      windowTask('2026-11-01T09:00:00+08:00', '2026-11-02T18:00:00+08:00', { id, status: 'done', doneAt: '2026-11-03T00:00:00Z' }),
    ),
    // 1 paused
    windowTask('2026-11-01T09:00:00+08:00', '2026-11-02T18:00:00+08:00', { id: 'z0', status: 'paused' }),
    // 3 recurring
    ...[0, 1, 2].map((index) => makeTask({ id: `r${String(index)}` })),
  ]

  it('returns the documented counts', () => {
    const { counts } = computeCounts(tasks, now, { nextAtFor: () => new Date('2026-11-06T01:00:00Z') })
    assert.deepEqual(counts, { notStarted: 3, inProgress: 2, overdue: 1, done: 4, paused: 1, recurring: 3 })
  })

  it('sums to the number of non-archived tasks', () => {
    const withArchived = [...tasks, makeTask({ id: 'a', status: 'archived' })]
    const { counts } = computeCounts(withArchived, now, { nextAtFor: () => null })
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
    assert.equal(total, tasks.length)
  })

  it('summarises active one-off and active recurring tasks (paused/done excluded)', () => {
    const { prioritySummary } = computeCounts(tasks, now, { nextAtFor: () => new Date('2026-11-06T01:00:00Z') })
    // 3 notStarted + 2 inProgress + 1 overdue + 3 recurring = 9
    assert.equal(prioritySummary.high + prioritySummary.mid + prioritySummary.low + prioritySummary.none, 9)
  })
})

describe('selectView — the six views (F4.10 / AC-29)', () => {
  const now = at('2026-11-05T12:00:00+08:00')
  const notStarted = windowTask('2026-11-06T10:00:00+08:00', '2026-11-09T10:00:00+08:00', { id: 'n0' })
  const inProgress = windowTask('2026-11-05T09:00:00+08:00', '2026-11-05T18:00:00+08:00', { id: 'p0' })
  const overdue = windowTask('2026-11-01T09:00:00+08:00', '2026-11-02T18:00:00+08:00', { id: 'o0' })
  const done = windowTask('2026-11-01T09:00:00+08:00', '2026-11-02T18:00:00+08:00', {
    id: 'd0',
    status: 'done',
    doneAt: '2026-11-03T00:00:00Z',
  })
  const paused = windowTask('2026-11-01T09:00:00+08:00', '2026-11-02T18:00:00+08:00', { id: 'z0', status: 'paused' })
  const recurring = makeTask({ id: 'r0' })
  const all = [notStarted, inProgress, overdue, done, paused, recurring]

  for (const [view, id] of [
    ['notStarted', 'n0'],
    ['inProgress', 'p0'],
    ['overdue', 'o0'],
    ['done', 'd0'],
    ['paused', 'z0'],
    ['recurring', 'r0'],
  ] as const) {
    it(`the ${view} view contains only its own stage`, () => {
      const result = selectView(all, view, now, { nextAtFor: () => null })
      assert.deepEqual(result.items.map((task) => task.id), [id])
    })
  }

  it('a paused task never appears in a stage view (AC-36)', () => {
    for (const view of ['notStarted', 'inProgress', 'overdue'] as const) {
      assert.equal(selectView(all, view, now, { nextAtFor: () => null }).items.some((task) => task.id === 'z0'), false)
    }
  })

  it('lists done tasks newest first', () => {
    const older = windowTask('2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z', { id: 'd1', status: 'done', doneAt: '2026-10-05T00:00:00Z' })
    const newer = windowTask('2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z', { id: 'd2', status: 'done', doneAt: '2026-11-01T00:00:00Z' })
    const result = selectView([older, newer], 'done', now)
    assert.deepEqual(result.items.map((task) => task.id), ['d2', 'd1'])
  })

  it('excludes archived tasks from every view', () => {
    const archived = makeTask({ id: 'a0', status: 'archived' })
    for (const view of ['notStarted', 'inProgress', 'overdue', 'done', 'recurring', 'paused'] as const) {
      assert.equal(selectView([...all, archived], view, now, { nextAtFor: () => null }).items.some((t) => t.id === 'a0'), false)
    }
  })
})

describe('groupTasks (F8.13 / D-21)', () => {
  const now = at('2026-11-05T12:00:00+08:00')

  it('builds pinned → high → mid → low → none → paused, omitting empties', () => {
    const pinned = windowTask('2026-10-01T00:00:00Z', '2026-12-01T00:00:00Z', { id: 'p', pinned: true })
    const high = windowTask('2026-10-01T00:00:00Z', '2026-11-05T18:00:00+08:00', { id: 'h' })
    const none = windowTask('2026-10-01T00:00:00Z', '2027-12-01T00:00:00Z', { id: 'n' })
    const groups = groupTasks([pinned, high, none], now)
    assert.deepEqual(groups.map((group) => group.key), ['pinned', 'high', 'none'])
  })

  it('keeps an overdue pinned task in the pinned group (D-21)', () => {
    const pinned = windowTask('2026-01-01T00:00:00Z', '2026-10-01T00:00:00Z', { id: 'p', pinned: true })
    assert.equal(groupTasks([pinned], now)[0]?.key, 'pinned')
  })
})
