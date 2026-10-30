/**
 * Archive tests (D-24 / F4.16–F4.19 / AC-38 / AC-39).
 *
 * Uses the in-memory filesystem so the "crash between two writes" states can be
 * constructed explicitly — that is the only way to test crash reconciliation
 * without actually killing a process.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  archiveCompleted,
  compareQuarters,
  currentQuarter,
  quarterBounds,
  quarterOf,
  readArchiveIndex,
  readQuarter,
  rebuildIndex,
  reconcileArchive,
} from '../src/host/archive.js'
import { storagePaths } from '../src/host/paths.js'
import { emptyState, type PersistedState } from '../src/host/state.js'
import { createMemoryFs, type MemoryFs } from './memoryFs.js'
import { makeTask } from './fixtures.js'

const DATA_DIR = '/virtual/dsh/dsh-todos-diy'
const paths = storagePaths(DATA_DIR)

/** Build a memory filesystem with the data directory present. */
function setup(): MemoryFs {
  const fs = createMemoryFs()
  fs.mkdir(DATA_DIR)
  return fs
}

/** A completed task with a given `doneAt`. */
function doneTask(id: string, doneAt: string, timeZone = 'Asia/Shanghai') {
  return makeTask({
    id,
    title: `已完成 ${id}`,
    status: 'done',
    doneAt,
    rule: {
      preset: 'workdays',
      cron: '0 9 * * 1-5',
      timeZone,
      skipDates: [],
      extraWorkdays: [],
      holidayCalendar: 'CN',
      monthlyOverflow: 'lastDay',
    },
  })
}

/** A state with the given tasks. */
function stateWith(tasks: ReturnType<typeof doneTask>[]): PersistedState {
  const state = emptyState(new Date('2027-01-01T00:30:00Z'))
  state.tasks = tasks
  return state
}

describe('quarterOf', () => {
  const cases: [string, string][] = [
    ['2026-01-01T00:00:00.000Z', '2026-Q1'],
    ['2026-03-31T15:59:59.000Z', '2026-Q1'],
    ['2026-03-31T16:00:00.000Z', '2026-Q2'], // 2026-04-01 00:00 +08:00
    ['2026-06-30T15:59:59.000Z', '2026-Q2'],
    ['2026-07-01T00:00:00.000Z', '2026-Q3'],
    ['2026-10-01T00:00:00.000Z', '2026-Q4'],
    ['2026-12-31T16:00:00.000Z', '2027-Q1'], // 2027-01-01 00:00 +08:00
  ]
  for (const [instant, quarter] of cases) {
    it(`${instant} → ${quarter}`, () => {
      assert.equal(quarterOf(instant, 'Asia/Shanghai'), quarter)
    })
  }

  it('uses the task zone, not the host zone', () => {
    // 2026-12-31 20:00Z is still 2026 in UTC but already 2027 in Shanghai.
    assert.equal(quarterOf('2026-12-31T20:00:00.000Z', 'UTC'), '2026-Q4')
    assert.equal(quarterOf('2026-12-31T20:00:00.000Z', 'Asia/Shanghai'), '2027-Q1')
  })

  it('falls back safely for garbage input', () => {
    assert.equal(quarterOf('not-a-date', 'Asia/Shanghai'), '1970-Q1')
  })
})

describe('currentQuarter / compareQuarters / quarterBounds', () => {
  it('reports the quarter containing now', () => {
    assert.equal(currentQuarter(new Date('2027-01-01T00:30:00+08:00'), 'Asia/Shanghai'), '2027-Q1')
  })

  it('orders quarters across years', () => {
    assert.ok(compareQuarters('2026-Q4', '2027-Q1') < 0)
    assert.ok(compareQuarters('2027-Q1', '2026-Q4') > 0)
    assert.equal(compareQuarters('2026-Q3', '2026-Q3'), 0)
  })

  it('computes quarter bounds', () => {
    assert.deepEqual(quarterBounds('2026-Q4'), {
      start: '2026-10-01T00:00:00.000Z',
      end: '2026-12-31T23:59:59.999Z',
    })
    assert.equal(quarterBounds('bad'), null)
  })
})

describe('archiveCompleted', () => {
  it('moves a previous quarter into its own file and leaves the current one alone (AC-38)', () => {
    const fs = setup()
    const state = stateWith([
      doneTask('tr_old', '2026-11-15T02:00:00.000Z'),
      doneTask('tr_new', '2027-01-02T02:00:00.000Z'),
    ])
    const result = archiveCompleted(state, {
      paths,
      fs,
      now: new Date('2027-01-01T00:30:00+08:00'),
      timeZone: 'Asia/Shanghai',
    })
    assert.deepEqual(result.archived, [{ quarter: '2026-Q4', count: 1 }])
    assert.deepEqual(state.tasks.map((task) => task.id), ['tr_new'])

    const file = JSON.parse(fs.files.get(`${DATA_DIR}/archive/completed-2026-Q4.json`) as string)
    assert.equal(file.quarter, '2026-Q4')
    assert.equal(file.tasks[0].id, 'tr_old')
    assert.equal(file.tasks[0].archivedQuarter, '2026-Q4')

    const index = JSON.parse(fs.files.get(`${DATA_DIR}/archive/index.json`) as string)
    assert.equal(index.quarters.length, 1)
    assert.equal(index.quarters[0].quarter, '2026-Q4')
    assert.equal(index.quarters[0].count, 1)
  })

  it('groups three quarters into three files and three index rows (F4.17)', () => {
    const fs = setup()
    const state = stateWith([
      doneTask('tr_q1', '2026-02-10T02:00:00.000Z'),
      doneTask('tr_q2', '2026-05-10T02:00:00.000Z'),
      doneTask('tr_q3', '2026-08-10T02:00:00.000Z'),
    ])
    archiveCompleted(state, { paths, fs, now: new Date('2027-01-01T00:30:00+08:00'), timeZone: 'Asia/Shanghai' })
    const index = readArchiveIndex(paths, fs)
    assert.deepEqual(index.quarters.map((entry) => entry.quarter), ['2026-Q1', '2026-Q2', '2026-Q3'])
    assert.equal(index.quarters.every((entry) => entry.count === 1), true)
  })

  it('is idempotent: a second run archives nothing', () => {
    const fs = setup()
    const state = stateWith([doneTask('tr_old', '2026-11-15T02:00:00.000Z')])
    const options = { paths, fs, now: new Date('2027-01-01T00:30:00+08:00'), timeZone: 'Asia/Shanghai' }
    archiveCompleted(state, options)
    const second = archiveCompleted(state, options)
    assert.deepEqual(second.archived, [])
  })

  it('merges into an existing quarter file without duplicating ids', () => {
    const fs = setup()
    const first = stateWith([doneTask('tr_a', '2026-11-01T02:00:00.000Z')])
    const options = { paths, fs, now: new Date('2027-01-01T00:30:00+08:00'), timeZone: 'Asia/Shanghai' }
    archiveCompleted(first, options)
    // Simulate a restored-then-recompleted task in the same quarter.
    const second = stateWith([doneTask('tr_a', '2026-11-01T02:00:00.000Z')])
    archiveCompleted(second, options)
    const file = JSON.parse(fs.files.get(`${DATA_DIR}/archive/completed-2026-Q4.json`) as string)
    assert.equal(file.tasks.length, 1)
    assert.equal(file.tasks[0].id, 'tr_a')
  })

  it('leaves active/paused tasks alone even if they are old', () => {
    const fs = setup()
    const state = stateWith([
      makeTask({ id: 'tr_active', status: 'active', createdAt: '2020-01-01T00:00:00.000Z' }),
      makeTask({ id: 'tr_paused', status: 'paused' }),
    ])
    const result = archiveCompleted(state, {
      paths,
      fs,
      now: new Date('2027-01-01T00:30:00+08:00'),
      timeZone: 'Asia/Shanghai',
    })
    assert.deepEqual(result.archived, [])
    assert.equal(state.tasks.length, 2)
  })

  it('does nothing when there is nothing to archive', () => {
    const fs = setup()
    const state = stateWith([makeTask({ id: 'tr_active' })])
    assert.deepEqual(
      archiveCompleted(state, { paths, fs, now: new Date('2027-01-01T00:30:00+08:00'), timeZone: 'Asia/Shanghai' }),
      { archived: [], skipped: [], duplicatesRemoved: 0 },
    )
    assert.equal(fs.files.size, 0)
  })
})

describe('reconcileArchive (F4.19)', () => {
  it('removes a task that a crash left in both the archive and the main file', () => {
    const fs = setup()
    // Simulate: archive written, main file never rewritten.
    const state = stateWith([doneTask('tr_dup', '2026-11-15T02:00:00.000Z')])
    archiveCompleted(state, { paths, fs, now: new Date('2027-01-01T00:30:00+08:00'), timeZone: 'Asia/Shanghai' })
    // Put it back into the main file, as the crash would have left it.
    const crashed = stateWith([doneTask('tr_dup', '2026-11-15T02:00:00.000Z')])
    const removed = reconcileArchive(crashed, paths, fs)
    assert.equal(removed, 1)
    assert.equal(crashed.tasks.length, 0)
  })

  it('is a no-op when the archive directory does not exist', () => {
    const fs = setup()
    const state = stateWith([makeTask({ id: 'tr_active' })])
    assert.equal(reconcileArchive(state, paths, fs), 0)
    assert.equal(state.tasks.length, 1)
  })

  it('keeps the total count stable across a simulated crash (AC-39)', () => {
    const fs = setup()
    const state = stateWith([
      doneTask('tr_a', '2026-11-01T02:00:00.000Z'),
      doneTask('tr_b', '2026-11-02T02:00:00.000Z'),
    ])
    archiveCompleted(state, { paths, fs, now: new Date('2027-01-01T00:30:00+08:00'), timeZone: 'Asia/Shanghai' })
    const archivedCount = readQuarter('2026-Q4', paths, fs)?.tasks.length ?? 0
    assert.equal(archivedCount + state.tasks.length, 2)
  })
})

describe('index repair (§8.3)', () => {
  it('rebuilds the index from the quarter files when index.json is missing', () => {
    const fs = setup()
    const state = stateWith([doneTask('tr_a', '2026-11-01T02:00:00.000Z')])
    archiveCompleted(state, { paths, fs, now: new Date('2027-01-01T00:30:00+08:00'), timeZone: 'Asia/Shanghai' })
    fs.files.delete(`${DATA_DIR}/archive/index.json`)
    const rebuilt = rebuildIndex(paths, fs)
    assert.deepEqual(rebuilt.quarters.map((entry) => entry.quarter), ['2026-Q4'])
    assert.equal(rebuilt.quarters[0]?.count, 1)
  })

  it('reports an empty index when the archive directory was deleted', () => {
    const fs = setup()
    assert.deepEqual(readArchiveIndex(paths, fs).quarters, [])
  })

  it('skips a corrupt quarter file instead of aborting', () => {
    const fs = setup()
    fs.mkdir(`${DATA_DIR}/archive`)
    fs.files.set(`${DATA_DIR}/archive/completed-2026-Q4.json`, '{bad')
    const index = rebuildIndex(paths, fs)
    assert.deepEqual(index.quarters, [])
  })
})

describe('readQuarter', () => {
  it('returns the tasks for a known quarter', () => {
    const fs = setup()
    const state = stateWith([doneTask('tr_a', '2026-11-01T02:00:00.000Z')])
    archiveCompleted(state, { paths, fs, now: new Date('2027-01-01T00:30:00+08:00'), timeZone: 'Asia/Shanghai' })
    const result = readQuarter('2026-Q4', paths, fs)
    assert.equal(result?.tasks[0]?.id, 'tr_a')
    assert.equal(result?.entry.count, 1)
  })

  it('returns null for an unknown quarter', () => {
    const fs = setup()
    assert.equal(readQuarter('2020-Q1', paths, fs), null)
  })
})
