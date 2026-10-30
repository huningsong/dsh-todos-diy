/**
 * State coercion + migration tests (F6.2 / F6.7 / F6.8 / F9.5).
 *
 * These are the acceptance cases for "restart keeps every field" and
 * "a newer file is never overwritten".
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { MIGRATIONS, isKnownVersion, migrateState } from '../src/host/migrations.js'
import {
  SCHEMA_VERSION,
  coerceSettings,
  coerceState,
  coerceTask,
  defaultSettings,
  emptyState,
} from '../src/host/state.js'
import { makeOnceTask, makeRule, makeTask } from './fixtures.js'

describe('emptyState', () => {
  it('is already at the current schema version', () => {
    const state = emptyState(new Date('2026-10-30T00:00:00Z'))
    assert.equal(state.schemaVersion, SCHEMA_VERSION)
    assert.deepEqual(state.tasks, [])
    assert.deepEqual(state.deliveries, [])
    assert.equal(state.meta.lastRecovery, null)
  })

  it('uses the documented settings defaults', () => {
    const state = emptyState(new Date('2026-10-30T00:00:00Z'))
    assert.equal(state.settings.timeZone, 'Asia/Shanghai')
    assert.equal(state.settings.graceMinutes, 5)
    assert.deepEqual(state.settings.defaultChannels, ['overlay'])
    assert.equal(state.settings.dnd.enabled, false)
  })
})

describe('coerceState — accepted documents', () => {
  it('round-trips a full task without losing a field', () => {
    const task = makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRS', dueDate: '2026-11-03' })
    const state = emptyState(new Date('2026-10-30T00:00:00Z'))
    state.tasks.push(task)
    const parsed = coerceState(JSON.parse(JSON.stringify(state)))
    assert.deepEqual(parsed.problem, { kind: 'ok' })
    assert.deepEqual(parsed.state?.tasks[0], task)
  })

  it('keeps a one-off window exactly', () => {
    const task = makeOnceTask('2026-11-05T06:00:00.000Z', '2026-11-05T10:00:00.000Z', {
      id: 'tr_0123456789ABCDEFGHJKMNPQRS',
    })
    const parsed = coerceState({
      schemaVersion: SCHEMA_VERSION,
      meta: {},
      settings: {},
      tasks: [task],
      deliveries: [],
    })
    assert.deepEqual(parsed.state?.tasks[0]?.once, {
      startAt: '2026-11-05T06:00:00.000Z',
      endAt: '2026-11-05T10:00:00.000Z',
      timeZone: 'Asia/Shanghai',
    })
  })
})

describe('coerceState — rejected documents', () => {
  it('reports corrupt when the root is not an object', () => {
    assert.equal(coerceState([]).problem.kind, 'corrupt')
    assert.equal(coerceState('x').problem.kind, 'corrupt')
  })

  it('reports corrupt when schemaVersion is missing', () => {
    assert.equal(coerceState({ tasks: [] }).problem.kind, 'corrupt')
  })

  it('reports unsupported-version for a newer file', () => {
    const problem = coerceState({ schemaVersion: 99 }).problem
    assert.equal(problem.kind, 'unsupported-version')
    if (problem.kind === 'unsupported-version') assert.equal(problem.found, 99)
  })

  it('drops a malformed task but keeps the rest', () => {
    const good = makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRS' })
    const parsed = coerceState({
      schemaVersion: SCHEMA_VERSION,
      meta: {},
      settings: {},
      tasks: [good, { id: 'nope' }, null, { ...good, id: 'tr_0123456789ABCDEFGHJKMNPQRT', kind: 'bogus' }],
      deliveries: [],
    })
    assert.equal(parsed.problem.kind, 'ok')
    assert.equal(parsed.state?.tasks.length, 1)
    assert.equal(parsed.warnings.length, 3)
  })
})

describe('coerceTask — field rules', () => {
  const base = makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRS' })

  it('rejects a task with no id or title', () => {
    assert.equal(coerceTask({ ...base, id: '' }), null)
    assert.equal(coerceTask({ ...base, title: '   ' }), null)
  })

  it('rejects an unknown kind or status', () => {
    assert.equal(coerceTask({ ...base, kind: 'weird' }), null)
    assert.equal(coerceTask({ ...base, status: 'weird' }), null)
  })

  it('forces overlay into the channel list', () => {
    const task = coerceTask({ ...base, notify: { channels: ['system'] } })
    assert.deepEqual(task?.notify.channels, ['overlay', 'system'])
  })

  it('clamps advanceMinutes into 0–1440', () => {
    assert.equal(coerceTask({ ...base, notify: { advanceMinutes: -5 } })?.notify.advanceMinutes, 0)
    assert.equal(coerceTask({ ...base, notify: { advanceMinutes: 9999 } })?.notify.advanceMinutes, 1440)
  })

  it('drops an invalid dueDate instead of failing the task', () => {
    assert.equal(coerceTask({ ...base, dueDate: '2026-02-30' })?.dueDate, null)
  })

  it('normalizes skipDates: de-duplicated and sorted', () => {
    const task = coerceTask({
      ...base,
      rule: { ...makeRule(), skipDates: ['2026-10-02', '2026-10-01', '2026-10-02', 'bad'] },
    })
    assert.deepEqual(task?.rule?.skipDates, ['2026-10-01', '2026-10-02'])
  })

  it('rejects a one-off task whose end is not after its start', () => {
    assert.equal(
      coerceTask({
        ...base,
        kind: 'once',
        rule: null,
        once: { startAt: '2026-11-05T10:00:00.000Z', endAt: '2026-11-05T10:00:00.000Z' },
      }),
      null,
    )
  })
})

describe('coerceSettings', () => {
  it('fills every missing field with a default', () => {
    const settings = coerceSettings({})
    assert.deepEqual(settings, defaultSettings())
  })

  it('clamps numeric ranges', () => {
    const settings = coerceSettings({ graceMinutes: 999, retentionDays: -1, tickIntervalMs: 1 })
    assert.equal(settings.graceMinutes, 60)
    assert.equal(settings.retentionDays, 1)
    assert.equal(settings.tickIntervalMs, 30_000)
  })

  it('keeps overlay in defaultChannels', () => {
    assert.deepEqual(coerceSettings({ defaultChannels: ['system'] }).defaultChannels, ['overlay', 'system'])
  })
})

describe('migrations', () => {
  it('ships with a v1 schema and no migrations yet', () => {
    assert.equal(SCHEMA_VERSION, 1)
    assert.equal(MIGRATIONS.length, 0)
  })

  it('is a no-op when the document is already current', () => {
    const result = migrateState({ schemaVersion: 1, tasks: [] })
    assert.equal(result.ok, true)
    if (result.ok) assert.deepEqual(result.applied, [])
  })

  it('refuses to migrate a newer document downwards', () => {
    const result = migrateState({ schemaVersion: 2 })
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.message, /newer/)
  })

  it('reports a missing chain link instead of guessing', () => {
    const result = migrateState({ schemaVersion: 1 }, [], 2)
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.message, /no migration registered from version 1/)
  })

  it('runs a registered chain in order', () => {
    const chain = [
      {
        from: 1,
        describe: 'v1→v2',
        run: (raw: Record<string, unknown>) => ({ ...raw, schemaVersion: 2, added: true }),
      },
      {
        from: 2,
        describe: 'v2→v3',
        run: (raw: Record<string, unknown>) => ({ ...raw, schemaVersion: 3, more: true }),
      },
    ]
    const result = migrateState({ schemaVersion: 1 }, chain, 3)
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.deepEqual(result.applied, ['v1→v2', 'v2→v3'])
      assert.equal(result.state['schemaVersion'], 3)
      assert.equal(result.state['added'], true)
      assert.equal(result.state['more'], true)
    }
  })

  it('keeps the original document when a migration throws', () => {
    const chain = [
      {
        from: 1,
        describe: 'boom',
        run: () => {
          throw new Error('nope')
        },
      },
    ]
    const original = { schemaVersion: 1, tasks: ['keep me'] }
    const result = migrateState(original, chain, 2)
    assert.equal(result.ok, false)
    assert.deepEqual(original.tasks, ['keep me'])
  })

  it('rejects a migration that does not advance the version', () => {
    const chain = [{ from: 1, describe: 'stuck', run: (raw: Record<string, unknown>) => ({ ...raw }) }]
    const result = migrateState({ schemaVersion: 1 }, chain, 2)
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.message, /did not advance/)
  })

  it('knows its own version range', () => {
    assert.equal(isKnownVersion(1), true)
    assert.equal(isKnownVersion(0), false)
    assert.equal(isKnownVersion(2), false)
    assert.equal(isKnownVersion(1.5), false)
  })
})
