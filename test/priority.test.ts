/**
 * Priority, view selection and ordering tests (D-20/D-21/D-22, F4.10–F4.14).
 * Every boundary of the documented table is covered, plus the three badges.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  daysOverdue,
  derivePriority,
  groupTodoTasks,
  isOverdue,
  priorityOf,
  selectView,
  sortTasksForView,
} from '../src/host/rules/priority.js'
import { makeTask } from './fixtures.js'

const TODAY = '2026-10-30'

describe('derivePriority — boundary table', () => {
  const cases: [string, string, 'high' | 'mid' | 'low' | 'none', number][] = [
    ['overdue by 2', '2026-10-28', 'high', -2],
    ['yesterday', '2026-10-29', 'high', -1],
    ['today', '2026-10-30', 'high', 0],
    ['+1 day', '2026-10-31', 'mid', 1],
    ['+2 days', '2026-11-01', 'mid', 2],
    ['+3 days', '2026-11-02', 'mid', 3],
    ['+4 days', '2026-11-03', 'low', 4],
    ['+5 days', '2026-11-04', 'low', 5],
    ['+7 days', '2026-11-06', 'low', 7],
    ['+8 days', '2026-11-07', 'none', 8],
    ['+21 days', '2026-11-20', 'none', 21],
  ]

  for (const [label, dueDate, key, daysLeft] of cases) {
    it(`${label} (${dueDate}) → ${key}`, () => {
      const priority = derivePriority(dueDate, TODAY)
      assert.equal(priority.key, key)
      assert.equal(priority.daysLeft, daysLeft)
    })
  }

  it('returns none with a null day count when there is no due date', () => {
    assert.deepEqual(derivePriority(null, TODAY), { key: 'none', daysLeft: null })
  })

  it('treats a malformed due date as no due date', () => {
    assert.deepEqual(derivePriority('2026-02-30', TODAY), { key: 'none', daysLeft: null })
  })

  it('crosses a month boundary correctly', () => {
    assert.equal(derivePriority('2026-11-01', '2026-10-30').daysLeft, 2)
    assert.equal(derivePriority('2026-12-01', '2026-11-30').daysLeft, 1)
  })
})

describe('priorityOf — paused tasks (D-22)', () => {
  it('reports paused for a paused task with a past due date', () => {
    const task = makeTask({ status: 'paused', dueDate: '2026-10-01' })
    assert.deepEqual(priorityOf(task, TODAY), { key: 'paused', daysLeft: -29 })
  })

  it('still derives priority for an active task', () => {
    const task = makeTask({ dueDate: '2026-10-30' })
    assert.equal(priorityOf(task, TODAY).key, 'high')
  })
})

describe('isOverdue / daysOverdue', () => {
  it('is overdue only when the due date is strictly before today', () => {
    assert.equal(isOverdue(makeTask({ dueDate: '2026-10-29' }), TODAY), true)
    assert.equal(isOverdue(makeTask({ dueDate: '2026-10-30' }), TODAY), false)
    assert.equal(isOverdue(makeTask({ dueDate: '2026-10-31' }), TODAY), false)
    assert.equal(isOverdue(makeTask({ dueDate: null }), TODAY), false)
  })

  it('never reports a paused task as overdue', () => {
    assert.equal(isOverdue(makeTask({ status: 'paused', dueDate: '2026-10-01' }), TODAY), false)
    assert.equal(isOverdue(makeTask({ status: 'done', dueDate: '2026-10-01' }), TODAY), false)
  })

  it('counts whole overdue days for the red marker', () => {
    assert.equal(daysOverdue(makeTask({ dueDate: '2026-10-28' }), TODAY), 2)
    assert.equal(daysOverdue(makeTask({ dueDate: TODAY }), TODAY), null)
    assert.equal(daysOverdue(makeTask({ status: 'paused', dueDate: '2026-10-01' }), TODAY), null)
  })
})

describe('sortTasksForView (D-21)', () => {
  it('puts pinned first, then priority, then due date', () => {
    const pinned = makeTask({ id: 'a-pinned', title: 'A', pinned: true, dueDate: '2026-11-20' })
    const high = makeTask({ id: 'b-high', title: 'B', dueDate: '2026-10-30' })
    const mid = makeTask({ id: 'c-mid', title: 'C', dueDate: '2026-11-01' })
    const low = makeTask({ id: 'd-low', title: 'D', dueDate: '2026-11-04' })
    const none = makeTask({ id: 'e-none', title: 'E', dueDate: null })
    const sorted = sortTasksForView([none, low, mid, high, pinned], TODAY).map((task) => task.id)
    assert.deepEqual(sorted, ['a-pinned', 'b-high', 'c-mid', 'd-low', 'e-none'])
  })

  it('keeps an overdue pinned task at the top with high priority', () => {
    const overduePinned = makeTask({ id: 'a', pinned: true, dueDate: '2026-10-28' })
    const todayHigh = makeTask({ id: 'b', dueDate: '2026-10-30' })
    const sorted = sortTasksForView([todayHigh, overduePinned], TODAY)
    assert.equal(sorted[0]?.id, 'a')
    assert.equal(priorityOf(sorted[0] as never, TODAY).key, 'high')
  })

  it('sorts a same-priority group by earliest due date', () => {
    const later = makeTask({ id: 'later', title: 'X', dueDate: '2026-11-02' })
    const sooner = makeTask({ id: 'sooner', title: 'Y', dueDate: '2026-10-31' })
    assert.deepEqual(sortTasksForView([later, sooner], TODAY).map((task) => task.id), ['sooner', 'later'])
  })

  it('puts no-due-date tasks last within a priority group', () => {
    const dated = makeTask({ id: 'dated', title: 'X', dueDate: '2026-11-04' })
    const undated = makeTask({ id: 'undated', title: 'Y', dueDate: null })
    assert.deepEqual(sortTasksForView([undated, dated], TODAY).map((task) => task.id), ['dated', 'undated'])
  })

  it('sinks paused tasks below every priority group', () => {
    const paused = makeTask({ id: 'paused', status: 'paused', dueDate: '2026-10-01' })
    const none = makeTask({ id: 'none', dueDate: null })
    assert.deepEqual(sortTasksForView([paused, none], TODAY).map((task) => task.id), ['none', 'paused'])
  })

  it('does not mutate the input array', () => {
    const tasks = [makeTask({ id: 'b' }), makeTask({ id: 'a' })]
    const before = tasks.map((task) => task.id)
    sortTasksForView(tasks, TODAY)
    assert.deepEqual(tasks.map((task) => task.id), before)
  })
})

describe('selectView — counts (F4.10 / AC-29)', () => {
  const tasks = [
    makeTask({ id: 't1', dueDate: '2026-10-30' }),
    makeTask({ id: 't2', dueDate: '2026-10-31' }),
    makeTask({ id: 't3', dueDate: null }),
    makeTask({ id: 't4', dueDate: '2026-11-04' }),
    makeTask({ id: 't5', dueDate: '2026-10-01' }), // overdue
    makeTask({ id: 't6', dueDate: '2026-10-02' }), // overdue
    makeTask({ id: 'p1', status: 'paused', dueDate: '2026-10-01' }), // paused, not overdue
    makeTask({ id: 'd1', status: 'done', dueDate: '2026-10-01' }),
    makeTask({ id: 'd2', status: 'done', dueDate: null }),
    makeTask({ id: 'd3', status: 'done', dueDate: null }),
    makeTask({ id: 'd4', status: 'done', dueDate: null }),
  ]

  it('counts todo as active-and-not-overdue', () => {
    const { counts } = selectView(tasks, 'todo', TODAY)
    assert.equal(counts.todo, 4) // t1, t2, t3, t4
    assert.equal(counts.done, 4)
    assert.equal(counts.overdue, 2)
  })

  it('lists active and paused tasks in the todo view, paused last', () => {
    const { items } = selectView(tasks, 'todo', TODAY)
    // 6 active (incl. the 2 overdue, which stay on the todo tab) + 1 paused.
    // Overdue tasks sort first inside the high group because their due date is earlier.
    assert.equal(items.length, 7)
    assert.deepEqual(items.map((task) => task.id), ['t5', 't6', 't1', 't2', 't4', 't3', 'p1'])
  })

  it('lists only done tasks in the done view, newest first', () => {
    const doneTasks = [
      makeTask({ id: 'old', status: 'done', doneAt: '2026-10-01T00:00:00.000Z' }),
      makeTask({ id: 'new', status: 'done', doneAt: '2026-10-29T00:00:00.000Z' }),
    ]
    const { items, counts } = selectView(doneTasks, 'done', TODAY)
    assert.deepEqual(items.map((task) => task.id), ['new', 'old'])
    assert.equal(counts.done, 2)
  })

  it('lists only overdue active tasks in the overdue view', () => {
    const { items } = selectView(tasks, 'overdue', TODAY)
    assert.deepEqual(items.map((task) => task.id).sort(), ['t5', 't6'])
  })

  it('excludes archived tasks from every count', () => {
    const withArchived = [...tasks, makeTask({ id: 'arch', status: 'archived', dueDate: '2026-10-01' })]
    assert.deepEqual(selectView(withArchived, 'todo', TODAY).counts, selectView(tasks, 'todo', TODAY).counts)
  })

  it('summarizes priorities of active tasks only', () => {
    const { prioritySummary } = selectView(tasks, 'todo', TODAY)
    // t1 high, t2 mid, t4 low, t3 none, t5/t6 high
    assert.deepEqual(prioritySummary, { high: 3, mid: 1, low: 1, none: 1 })
  })

  it('keeps the three views a partition of the unfinished set plus done (D-22)', () => {
    const { counts, items } = selectView(tasks, 'todo', TODAY)
    const overdue = selectView(tasks, 'overdue', TODAY).items
    const done = selectView(tasks, 'done', TODAY).items
    const todoActiveIds = new Set(items.filter((task) => task.status === 'active').map((task) => task.id))
    for (const task of overdue) {
      assert.equal(todoActiveIds.has(task.id), true, 'overdue tasks belong to the todo set')
      assert.equal(done.some((entry) => entry.id === task.id), false, 'done is disjoint')
    }
    assert.equal(counts.done, done.length)
    assert.equal(counts.overdue, overdue.length)
  })
})

describe('paused semantics in the views (AC-36)', () => {
  const pausedOverdue = makeTask({ id: 'p', status: 'paused', dueDate: '2026-10-01' })

  it('does not count a paused overdue task in the todo badge', () => {
    assert.equal(selectView([pausedOverdue], 'todo', TODAY).counts.todo, 0)
  })

  it('does not show a paused task on the overdue tab', () => {
    assert.deepEqual(selectView([pausedOverdue], 'overdue', TODAY).items, [])
  })

  it('still shows it in the todo list', () => {
    assert.deepEqual(selectView([pausedOverdue], 'todo', TODAY).items.map((task) => task.id), ['p'])
  })
})

describe('groupTodoTasks', () => {
  it('builds pinned → high → mid → low → none → paused, omitting empties', () => {
    const tasks = [
      makeTask({ id: 'pin', pinned: true, dueDate: '2026-11-20' }),
      makeTask({ id: 'hi', dueDate: '2026-10-30' }),
      makeTask({ id: 'pa', status: 'paused', dueDate: '2026-10-01' }),
    ]
    const groups = groupTodoTasks(tasks, TODAY)
    assert.deepEqual(groups.map((group) => group.key), ['pinned', 'high', 'paused'])
  })

  it('keeps an overdue pinned task in the pinned group (D-21)', () => {
    const groups = groupTodoTasks([makeTask({ id: 'pin', pinned: true, dueDate: '2026-10-01' })], TODAY)
    assert.equal(groups[0]?.key, 'pinned')
  })
})
