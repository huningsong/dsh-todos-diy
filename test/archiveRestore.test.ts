/**
 * Archive restore (F4.18 / F4.19 / AC-39).
 *
 * The ordering rule is the important part: the live document is persisted
 * *before* the quarter file is touched, so a crash can only duplicate the task
 * (reconciled at startup) and never lose it.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { archiveCompleted, readArchiveIndex, readQuarter, rebuildIndex } from '../src/host/archive.js'
import { findArchivedTask, restoreArchivedTask } from '../src/host/archiveRestore.js'
import { storagePaths } from '../src/host/paths.js'
import { emptyState, SCHEMA_VERSION, type PersistedState } from '../src/host/state.js'
import { createMemoryFs } from './memoryFs.js'
import { makeTask } from './fixtures.js'

const DATA_DIR = '/virtual/dsh/dsh-todos-diy'
const NOW = new Date('2027-01-05T09:00:00+08:00')

/** Build a state with one completed previous-quarter task and archive it. */
function archivedFixture(): { fs: ReturnType<typeof createMemoryFs>; state: PersistedState; paths: ReturnType<typeof storagePaths> } {
  const fs = createMemoryFs()
  fs.mkdir(DATA_DIR)
  const state = emptyState(NOW)
  state.tasks = [
    makeTask({
      id: 'tr_q3',
      title: 'Q3 已完成',
      kind: 'once',
      status: 'done',
      doneAt: '2026-08-15T02:00:00.000Z',
      once: {
        startAt: '2026-08-15T01:00:00.000Z',
        endAt: '2026-08-15T03:00:00.000Z',
        startAtSource: 'explicit',
        timeZone: 'Asia/Shanghai',
      },
    }),
  ]
  const paths = storagePaths(DATA_DIR)
  archiveCompleted(state, { paths, fs, now: NOW, timeZone: 'Asia/Shanghai' })
  return { fs, state, paths }
}

describe('findArchivedTask', () => {
  it('finds a task by id in its quarter file', () => {
    const { fs, paths } = archivedFixture()
    const found = findArchivedTask('tr_q3', paths, fs)
    assert.equal(found?.quarter, '2026-Q3')
    assert.equal(found?.task.title, 'Q3 已完成')
  })

  it('returns null for an unknown id', () => {
    const { fs, paths } = archivedFixture()
    assert.equal(findArchivedTask('tr_missing', paths, fs), null)
  })
})

describe('restoreArchivedTask', () => {
  it('moves the task back as active and clears the archive fields', () => {
    const { fs, state, paths } = archivedFixture()
    const result = restoreArchivedTask(state, 'tr_q3', paths, fs, NOW)
    assert.equal(result.restored, true)
    if (result.restored) {
      assert.equal(result.task.status, 'active')
      assert.equal(result.task.doneAt, null)
      assert.equal(result.task.archivedQuarter, null)
      assert.equal(result.task.pinned, false)
      assert.equal(result.task.revision, 2)
    }
    assert.equal(state.tasks.some((task) => task.id === 'tr_q3'), true)
  })

  it('removes the entry from the quarter file and updates the index', () => {
    const { fs, state, paths } = archivedFixture()
    restoreArchivedTask(state, 'tr_q3', paths, fs, NOW)
    const quarter = JSON.parse(fs.files.get(`${DATA_DIR}/archive/completed-2026-Q3.json`) as string)
    assert.equal(quarter.tasks.length, 0)
    assert.equal(quarter.schemaVersion, SCHEMA_VERSION)
    const index = readArchiveIndex(paths, fs)
    assert.equal(index.quarters.length, 0)
  })

  it('persists the live document before touching the archive (F4.19)', () => {
    const { fs, state, paths } = archivedFixture()
    let persistedBeforeArchiveChange = false
    restoreArchivedTask(state, 'tr_q3', paths, fs, NOW, (next) => {
      // At persist time the quarter file must still contain the task.
      const quarter = JSON.parse(fs.files.get(`${DATA_DIR}/archive/completed-2026-Q3.json`) as string)
      persistedBeforeArchiveChange = quarter.tasks.some((task: { id: string }) => task.id === 'tr_q3')
      assert.equal(next.tasks.some((task) => task.id === 'tr_q3'), true)
    })
    assert.equal(persistedBeforeArchiveChange, true)
  })

  it('migrates a v1 quarter task while restoring it', () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    fs.mkdir(`${DATA_DIR}/archive`)
    const v1Task = {
      id: 'tr_v1',
      title: '旧任务',
      description: '',
      kind: 'once',
      status: 'done',
      dueDate: '2026-08-15',
      pinned: true,
      doneAt: '2026-08-15T02:00:00.000Z',
      archivedQuarter: '2026-Q3',
      rule: null,
      once: { startAt: '2026-08-15T01:00:00.000Z', endAt: '2026-08-15T03:00:00.000Z', timeZone: 'Asia/Shanghai' },
      notify: { channels: ['overlay'], template: '{title}', advanceMinutes: 0, sound: false },
      state: { lastFiredAt: null, lastOccurrenceKey: null, firedStart: true, firedEnd: true },
      revision: 1,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-15T02:00:00.000Z',
    }
    fs.files.set(`${DATA_DIR}/archive/completed-2026-Q3.json`, JSON.stringify({ schemaVersion: 1, quarter: '2026-Q3', tasks: [v1Task] }))
    fs.files.set(`${DATA_DIR}/archive/index.json`, JSON.stringify({
      schemaVersion: 1,
      quarters: [{ quarter: '2026-Q3', file: 'completed-2026-Q3.json', count: 1, start: '', end: '' }],
    }))
    const state = emptyState(NOW)
    const result = restoreArchivedTask(state, 'tr_v1', storagePaths(DATA_DIR), fs, NOW)
    assert.equal(result.restored, true)
    if (result.restored) {
      assert.equal(Object.hasOwn(result.task as object, 'dueDate'), false)
      assert.equal(result.task.once?.startAtSource, 'explicit')
      assert.equal(result.task.notify.endReminder, true)
    }
  })

  it('refuses to restore when the quarter file is unreadable', () => {
    const { fs, state, paths } = archivedFixture()
    fs.files.set(`${DATA_DIR}/archive/completed-2026-Q3.json`, '{bad')
    const result = restoreArchivedTask(state, 'tr_q3', paths, fs, NOW)
    assert.equal(result.restored, false)
    // The task cannot even be located in a corrupt file, so the reason is
    // `not-archived`; either way nothing is written and the file stays intact.
    assert.equal(fs.files.get(`${DATA_DIR}/archive/completed-2026-Q3.json`), '{bad')
  })

  it('reports not-archived for an unknown id', () => {
    const { fs, state, paths } = archivedFixture()
    const result = restoreArchivedTask(state, 'tr_missing', paths, fs, NOW)
    assert.deepEqual(result, { restored: false, reason: 'not-archived' })
  })

  it('leaves the quarter file readable to readQuarter after a restore', () => {
    const { fs, state, paths } = archivedFixture()
    restoreArchivedTask(state, 'tr_q3', paths, fs, NOW)
    const quarter = readQuarter('2026-Q3', paths, fs)
    // The quarter is dropped from the index when empty, so readQuarter returns
    // null and the file itself is an empty task list.
    assert.equal(quarter, null)
    const raw = JSON.parse(fs.files.get(`${DATA_DIR}/archive/completed-2026-Q3.json`) as string)
    assert.deepEqual(raw.tasks, [])
  })
})

describe('Review round 4: a newer archive index is never downgraded', () => {
  it('rebuildIndex reports unsupported and returns no quarters', () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    fs.mkdir(`${DATA_DIR}/archive`)
    fs.files.set(`${DATA_DIR}/archive/index.json`, JSON.stringify({ schemaVersion: 99, quarters: [] }))
    fs.files.set(`${DATA_DIR}/archive/completed-2026-Q3.json`, JSON.stringify({ schemaVersion: 2, quarter: '2026-Q3', tasks: [] }))
    const index = rebuildIndex(storagePaths(DATA_DIR), fs)
    assert.equal(index.unsupported, true)
    assert.equal(index.schemaVersion, 99)
  })

  it('readArchiveIndex leaves a newer index untouched', () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    fs.mkdir(`${DATA_DIR}/archive`)
    const original = JSON.stringify({ schemaVersion: 99, quarters: [], custom: 'keep' })
    fs.files.set(`${DATA_DIR}/archive/index.json`, original)
    const index = readArchiveIndex(storagePaths(DATA_DIR), fs)
    assert.equal(index.unsupported, true)
    assert.equal(fs.files.get(`${DATA_DIR}/archive/index.json`), original)
  })
})
