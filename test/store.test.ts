/**
 * Store tests (F6.5 / F6.7 / F6.8 / F6.9).
 *
 * Covers the atomic-write protocol, the corrupt-file recovery path, the
 * unsupported-version guard, and the "no write when nothing changed" rule.
 * Every filesystem interaction goes through the in-memory double, so an
 * injected `ENOSPC` is reproducible.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { SCHEMA_VERSION, emptyState } from '../src/host/state.js'
import { createStore, type StoreLogger } from '../src/host/store.js'
import { createMemoryFs, type MemoryFs } from './memoryFs.js'
import { makeTask } from './fixtures.js'

const DATA_DIR = '/virtual/dsh/dsh-todos-diy'
const STATE = `${DATA_DIR}/tasks.json`

/** Collect log lines so recovery logging can be asserted. */
function logger(): StoreLogger & { lines: string[] } {
  const lines: string[] = []
  return {
    lines,
    info: (message) => lines.push(`info:${message}`),
    warn: (message) => lines.push(`warn:${message}`),
  }
}

/** Build a store over a fresh memory filesystem. */
function setup(seed?: string): { fs: MemoryFs; store: ReturnType<typeof createStore>; log: ReturnType<typeof logger> } {
  const fs = createMemoryFs()
  fs.mkdir(DATA_DIR)
  if (seed !== undefined) fs.files.set(STATE, seed)
  const log = logger()
  const store = createStore({ dataDir: DATA_DIR, fs, logger: log, now: () => new Date('2026-10-30T00:00:00Z') })
  return { fs, store, log }
}

describe('store — first run', () => {
  it('starts empty without writing anything', () => {
    const { fs, store } = setup()
    const state = store.load()
    assert.deepEqual(state.tasks, [])
    assert.equal(store.stateName, 'ready')
    assert.equal(fs.files.size, 0)
  })

  it('writes only when something changed', () => {
    const { fs, store } = setup()
    store.load()
    assert.equal(store.flush(), true)
    assert.equal(fs.writeCount, 0, 'an idle flush must not touch the disk')
  })
})

describe('store — atomic write', () => {
  it('writes via a tmp file and renames it into place', () => {
    const { fs, store } = setup()
    store.load()
    store.state.tasks.push(makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRS' }))
    store.set(store.state)
    assert.equal(store.flush(), true)
    assert.equal(fs.renameCount, 1)
    assert.equal(fs.files.has(`${STATE}.tmp`), false, 'the tmp file must not survive')
    const written = JSON.parse(fs.files.get(STATE) as string)
    assert.equal(written.tasks.length, 1)
    assert.equal(written.schemaVersion, SCHEMA_VERSION)
  })

  it('keeps exactly one previous generation as tasks.json.bak', () => {
    const { fs, store } = setup()
    store.load()
    store.state.tasks.push(makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRS' }))
    store.set(store.state)
    store.flush()
    const first = fs.files.get(STATE)
    store.state.tasks[0]!.title = '改过的标题'
    store.set(store.state)
    store.flush()
    assert.equal(fs.files.get(`${STATE}.bak`), first)
  })

  it('leaves the old file intact when the write fails (ENOSPC)', () => {
    const { fs, store } = setup()
    store.load()
    store.state.tasks.push(makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRS' }))
    store.set(store.state)
    store.flush()
    const good = fs.files.get(STATE)
    fs.failWrite = 'ENOSPC: no space left on device'
    store.state.tasks[0]!.title = '写不进去'
    store.set(store.state)
    assert.equal(store.flush(), false)
    assert.equal(fs.files.get(STATE), good, 'the previous complete file must survive')
  })

  it('survives a rename failure without leaving a tmp file', () => {
    const { fs, store } = setup()
    store.load()
    store.state.tasks.push(makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRS' }))
    store.set(store.state)
    fs.failRename = 'EACCES: permission denied'
    assert.equal(store.flush(), false)
    assert.equal(fs.files.has(`${STATE}.tmp`), false)
  })

  it('keeps the in-memory value when the write fails, and retries on the next flush', () => {
    const { fs, store } = setup()
    store.load()
    store.state.tasks.push(makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRS' }))
    store.set(store.state)
    fs.failWrite = 'EACCES'
    assert.equal(store.flush(), false)
    assert.equal(store.state.tasks.length, 1)
    fs.failWrite = null
    assert.equal(store.flush(), true)
    assert.equal(JSON.parse(fs.files.get(STATE) as string).tasks.length, 1)
  })
})

describe('store — corrupt file recovery (F6.7)', () => {
  it('backs up invalid JSON and rebuilds empty', () => {
    const { fs, store, log } = setup('{bad json')
    const state = store.load()
    assert.deepEqual(state.tasks, [])
    assert.equal(store.stateName, 'corrupt')
    assert.ok(store.lastRecovery !== null)
    assert.equal(store.lastRecovery?.reason, 'corrupt')
    assert.ok(log.lines.some((line) => line.startsWith('warn:')))
    const backups = [...fs.files.keys()].filter((path) => path.includes('.corrupt.'))
    assert.equal(backups.length, 1, 'the bad file must be preserved')
    assert.equal(fs.files.get(backups[0] as string), '{bad json')
  })

  it('records the recovery in the rebuilt document', () => {
    const { fs, store } = setup('{bad json')
    store.load()
    store.flush()
    const written = JSON.parse(fs.files.get(STATE) as string)
    assert.equal(written.meta.lastRecovery.reason, 'corrupt')
  })

  it('rebuilds when the root is not an object', () => {
    const { store } = setup('"just a string"')
    store.load()
    assert.equal(store.stateName, 'corrupt')
    assert.equal(store.lastRecovery?.reason, 'corrupt')
  })
})

describe('store — version guard (F6.8)', () => {
  it('refuses to load a newer schema and never rewrites the file', () => {
    const future = JSON.stringify({ schemaVersion: 99, tasks: [{ id: 'keep' }] })
    const { fs, store } = setup(future)
    const state = store.load()
    assert.equal(store.stateName, 'unsupported-version')
    assert.equal(store.lastRecovery?.reason, 'unsupported-version')
    assert.deepEqual(state.tasks, [])
    store.flush()
    assert.equal(fs.files.get(STATE), future, 'the newer file must stay untouched')
  })

  it('records a migration failure without overwriting the file', () => {
    const old = JSON.stringify({ schemaVersion: 0, tasks: [] })
    const { fs, store } = setup(old)
    store.load()
    assert.equal(store.stateName, 'migration-failed')
    assert.equal(fs.files.get(STATE), old)
  })
})

describe('store — reload fidelity (AC-18)', () => {
  it('keeps every persisted field across a reload', () => {
    const { fs, store } = setup()
    store.load()
    const task = makeTask({
      id: 'tr_0123456789ABCDEFGHJKMNPQRS',
      title: '季度材料',
      description: '含考勤汇总',
      pinned: true,
      state: {
        lastFiredAt: '2026-10-30T01:00:00.000Z',
        lastOccurrenceKey: 'tr_0123456789ABCDEFGHJKMNPQRS@2026-10-30T01:00:00.000Z',
        firedStart: true,
        firedEnd: false,
        firedStartAdvance: false,
        firedEndAdvance: false,
        missedStart: false,
        missedEnd: false,
        missedAt: null,
        missedCount: 2,
        snoozeUntil: null,
        completedOccurrenceKey: null,
      },
    })
    store.state.tasks.push(task)
    store.set(store.state)
    store.flush()

    const reopened = createStore({ dataDir: DATA_DIR, fs, now: () => new Date('2026-10-31T00:00:00Z') })
    const reloaded = reopened.load()
    assert.equal(reloaded.tasks.length, 1)
    assert.deepEqual(reloaded.tasks[0], task)
    assert.equal(reopened.stateName, 'ready')
    assert.equal(reopened.lastRecovery, null)
  })
})

describe('store — fileMtimeMs', () => {
  it('reports null before the first write and a value afterwards', () => {
    const { store } = setup()
    store.load()
    assert.equal(store.fileMtimeMs(), null)
    store.state.tasks.push(makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRS' }))
    store.set(store.state)
    store.flush()
    assert.equal(typeof store.fileMtimeMs(), 'number')
  })
})

describe('emptyState in the store', () => {
  it('writes a document the same schema reads back', () => {
    const { fs, store } = setup()
    store.load()
    store.set(emptyState(new Date('2026-10-30T00:00:00Z')))
    store.flush()
    const rewritten = createStore({ dataDir: DATA_DIR, fs, now: () => new Date('2026-10-31T00:00:00Z') })
    assert.equal(rewritten.load().schemaVersion, SCHEMA_VERSION)
  })
})
