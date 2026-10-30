/**
 * Repository tests (F1.2–F1.6, F4.1–F4.5, F4.15, F6.9).
 *
 * The repository is exercised over the in-memory filesystem so the write count
 * and the durable JSON can both be asserted. `now` is always injected.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRepository, type Repository } from '../src/host/repo.js'
import { createStore } from '../src/host/store.js'
import { createMemoryFs, type MemoryFs } from './memoryFs.js'
import { makeTask } from './fixtures.js'

const DATA_DIR = '/virtual/dsh/dsh-todos-diy'
const STATE = `${DATA_DIR}/tasks.json`
const NOW = new Date('2026-10-30T09:00:00+08:00')

interface Harness {
  fs: MemoryFs
  repo: Repository
}

/** Build a repository over an empty in-memory store. */
function harness(now: Date = NOW): Harness {
  const fs = createMemoryFs()
  fs.mkdir(DATA_DIR)
  const store = createStore({ dataDir: DATA_DIR, fs, now: () => now })
  store.load()
  const repo = createRepository({ store, now: () => now, debounceMs: 0 })
  return { fs, repo }
}

/** A minimal valid recurring payload. */
function recurringInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: '查看今日待办',
    description: '确认今天三件最重要的事',
    kind: 'recurring',
    dueDate: '2026-10-30',
    rule: { preset: 'workdays', time: '09:00', timezone: 'Asia/Shanghai' },
    ...overrides,
  }
}

/** A minimal valid one-off payload. */
function onceInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: '季度评审',
    kind: 'once',
    dueDate: '2026-11-05',
    once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' },
    ...overrides,
  }
}

describe('repo — create', () => {
  it('creates a recurring task with a canonical cron and clean state', async () => {
    const { repo } = harness()
    const task = await repo.create(recurringInput() as never)
    assert.match(task.id, /^tr_[0-9A-HJKMNP-TV-Z]{26}$/)
    assert.equal(task.status, 'active')
    assert.equal(task.revision, 1)
    assert.equal(task.rule?.cron, '0 9 * * 1-5')
    assert.equal(task.rule?.timeZone, 'Asia/Shanghai')
    assert.deepEqual(task.notify.channels, ['overlay'])
    assert.equal(task.state.lastOccurrenceKey, null)
    assert.equal(task.state.firedStart, false)
  })

  it('creates a one-off task with both nodes stored in UTC', async () => {
    const { repo } = harness()
    const task = await repo.create(onceInput() as never)
    assert.equal(task.kind, 'once')
    assert.equal(task.once?.startAt, '2026-11-05T06:00:00.000Z')
    assert.equal(task.once?.endAt, '2026-11-05T10:00:00.000Z')
    assert.equal(task.rule, null)
  })

  it('rejects a missing title', async () => {
    const { repo } = harness()
    await assert.rejects(repo.create({ kind: 'recurring', title: '  ' } as never), (error: { code: string }) => {
      assert.equal(error.code, 'invalid_argument')
      return true
    })
  })

  it('rejects an invalid cron with invalid_cron', async () => {
    const { repo } = harness()
    await assert.rejects(
      repo.create(recurringInput({ rule: { preset: 'custom', cron: '0 9 L * *' } }) as never),
      (error: { code: string }) => {
        assert.equal(error.code, 'invalid_cron')
        return true
      },
    )
  })

  it('rejects an unknown time zone with invalid_timezone', async () => {
    const { repo } = harness()
    await assert.rejects(
      repo.create(recurringInput({ rule: { preset: 'workdays', time: '09:00', timeZone: 'Asia/Beijing' } }) as never),
      (error: { code: string }) => {
        assert.equal(error.code, 'invalid_timezone')
        return true
      },
    )
  })

  it('rejects a one-off task without endAt (D-03)', async () => {
    const { repo } = harness()
    await assert.rejects(
      repo.create({ title: 'x', kind: 'once', once: { startAt: '2026-11-05T14:00:00+08:00' } } as never),
      (error: { code: string }) => {
        assert.equal(error.code, 'invalid_argument')
        return true
      },
    )
  })

  it('rejects endAt not later than startAt', async () => {
    const { repo } = harness()
    await assert.rejects(
      repo.create({
        title: 'x',
        kind: 'once',
        once: { startAt: '2026-11-05T18:00:00+08:00', endAt: '2026-11-05T14:00:00+08:00' },
      } as never),
      (error: { code: string }) => {
        assert.equal(error.code, 'invalid_argument')
        return true
      },
    )
  })

  it('applies an offset-less window in the task zone', async () => {
    const { repo } = harness()
    const task = await repo.create({
      title: 'x',
      kind: 'once',
      timeZone: 'Asia/Shanghai',
      once: { startAt: '2026-11-05T14:00:00', endAt: '2026-11-05T18:00:00' },
    } as never)
    assert.equal(task.once?.startAt, '2026-11-05T06:00:00.000Z')
  })
})

describe('repo — read', () => {
  it('returns the task by id and null for an unknown id', async () => {
    const { repo } = harness()
    const task = await repo.create(recurringInput() as never)
    assert.equal(repo.get(task.id)?.id, task.id)
    assert.equal(repo.get('tr_nope'), null)
  })

  it('computes counts and priority summary', async () => {
    const { repo } = harness()
    await repo.create(recurringInput({ dueDate: '2026-10-30' }) as never)
    await repo.create(recurringInput({ title: '后天', dueDate: '2026-11-01' }) as never)
    await repo.create(recurringInput({ title: '无截止', dueDate: null }) as never)
    const result = repo.list({ today: '2026-10-30' })
    assert.equal(result.counts.todo, 3)
    assert.deepEqual(result.prioritySummary, { high: 1, mid: 1, low: 0, none: 1 })
  })

  it('searches title and description', async () => {
    const { repo } = harness()
    await repo.create(recurringInput({ title: '提交材料', description: '' }) as never)
    await repo.create(recurringInput({ title: '别的', description: '材料归档' }) as never)
    assert.equal(repo.list({ query: '材料', today: '2026-10-30' }).items.length, 2)
    assert.equal(repo.list({ query: '归档', today: '2026-10-30' }).items.length, 1)
  })

  it('paginates with an opaque cursor', async () => {
    const { repo } = harness()
    for (let index = 0; index < 5; index += 1) {
      await repo.create(recurringInput({ title: `任务${String(index)}` }) as never)
    }
    const first = repo.list({ limit: 2, today: '2026-10-30' })
    assert.equal(first.items.length, 2)
    assert.ok(first.nextCursor !== null)
    const second = repo.list({ limit: 2, cursor: first.nextCursor as string, today: '2026-10-30' })
    assert.equal(second.items.length, 2)
    const ids = new Set([...first.items, ...second.items].map((task) => task.id))
    assert.equal(ids.size, 4, 'pages must not overlap')
  })

  it('excludes archived tasks unless asked', async () => {
    const { repo } = harness()
    const task = await repo.create(recurringInput() as never)
    await repo.remove(task.id)
    assert.equal(repo.list({ today: '2026-10-30' }).items.length, 0)
    assert.equal(repo.list({ includeArchived: true, today: '2026-10-30' }).items.length, 1)
  })
})

describe('repo — update and optimistic locking (F1.6)', () => {
  it('bumps the revision on every edit', async () => {
    const { repo } = harness()
    const task = await repo.create(recurringInput() as never)
    const edited = await repo.update(task.id, 1, { title: '新标题' })
    assert.equal(edited.revision, 2)
    assert.equal(edited.title, '新标题')
  })

  it('rejects a stale revision with conflict and the current revision', async () => {
    const { repo } = harness()
    const task = await repo.create(recurringInput() as never)
    await repo.update(task.id, 1, { title: 'first' })
    await assert.rejects(repo.update(task.id, 1, { title: 'second' }), (error: { code: string; details?: { currentRevision?: number } }) => {
      assert.equal(error.code, 'conflict')
      assert.equal(error.details?.currentRevision, 2)
      return true
    })
  })

  it('clears firing markers when the rule changes', async () => {
    const { repo } = harness()
    const task = await repo.create(recurringInput() as never)
    await repo.update(task.id, 1, {
      rule: { preset: 'weekly', weekdays: [1], time: '10:00' },
    })
    const edited = repo.get(task.id)
    assert.equal(edited?.rule?.cron, '0 10 * * 1')
    assert.equal(edited?.state.lastOccurrenceKey, null)
  })

  it('refuses a rule on a one-off task', async () => {
    const { repo } = harness()
    const task = await repo.create(onceInput() as never)
    await assert.rejects(repo.update(task.id, 1, { rule: { preset: 'workdays', time: '09:00' } }), (error: { code: string }) => {
      assert.equal(error.code, 'invalid_state')
      return true
    })
  })

  it('reports not_found for an unknown id', async () => {
    const { repo } = harness()
    await assert.rejects(repo.update('tr_nope', 1, { title: 'x' }), (error: { code: string }) => {
      assert.equal(error.code, 'not_found')
      return true
    })
  })
})

describe('repo — state machine (F1.2)', () => {
  it('pauses and resumes, and both are idempotent (F4.3)', async () => {
    const { repo } = harness()
    const task = await repo.create(recurringInput() as never)
    assert.deepEqual(await repo.pause(task.id), { id: task.id, status: 'paused', changed: true })
    assert.deepEqual(await repo.pause(task.id), { id: task.id, status: 'paused', changed: false })
    assert.deepEqual(await repo.resume(task.id), { id: task.id, status: 'active', changed: true })
    assert.deepEqual(await repo.resume(task.id), { id: task.id, status: 'active', changed: false })
  })

  it('refuses to complete a paused task', async () => {
    const { repo } = harness()
    const task = await repo.create(onceInput() as never)
    await repo.pause(task.id)
    await assert.rejects(repo.complete(task.id), (error: { code: string }) => {
      assert.equal(error.code, 'invalid_state')
      return true
    })
  })

  it('refuses to resume an archived task that was purged', async () => {
    const { repo } = harness()
    const task = await repo.create(recurringInput() as never)
    await repo.remove(task.id, true)
    await assert.rejects(repo.restore(task.id), (error: { code: string }) => {
      assert.equal(error.code, 'not_found')
      return true
    })
  })

  it('restores a soft-deleted task to active and clears doneAt', async () => {
    const { repo } = harness()
    const task = await repo.create(onceInput() as never)
    await repo.complete(task.id)
    await repo.remove(task.id)
    const restored = await repo.restore(task.id)
    assert.equal(restored.status, 'active')
    assert.equal(restored.doneAt, null)
    assert.equal(restored.pinned, false)
  })
})

describe('repo — complete (F4.4 / F4.15)', () => {
  it('completes a one-off task and clears its pin', async () => {
    const { repo } = harness()
    const task = await repo.create({ ...onceInput(), pinned: true } as never)
    assert.equal(repo.get(task.id)?.pinned, true)
    const result = await repo.complete(task.id)
    assert.equal(result.task.status, 'done')
    assert.equal(result.task.pinned, false)
    assert.ok(result.task.doneAt !== null)
    assert.equal(result.task.state.firedStart, true)
    assert.equal(result.task.state.firedEnd, true)
  })

  it('keeps a recurring task active and advances past the current occurrence', async () => {
    const { repo } = harness()
    const task = await repo.create(recurringInput() as never)
    await repo.applyTick([{ taskId: task.id, firedKey: `${task.id}@2026-10-30T01:00:00.000Z`, firedAt: '2026-10-30T01:00:05.000Z' }], NOW)
    const result = await repo.complete(task.id)
    assert.equal(result.task.status, 'active')
    assert.equal(result.completedOccurrenceKey, `${task.id}@2026-10-30T01:00:00.000Z`)
  })

  it('rejects complete on a recurring task with no occurrence yet', async () => {
    const { repo } = harness()
    const task = await repo.create(recurringInput() as never)
    await assert.rejects(repo.complete(task.id), (error: { code: string }) => {
      assert.equal(error.code, 'no_occurrence')
      return true
    })
  })

  it('is idempotent when completing an already-done task', async () => {
    const { repo } = harness()
    const task = await repo.create(onceInput() as never)
    const first = await repo.complete(task.id)
    const second = await repo.complete(task.id)
    assert.equal(second.task.status, 'done')
    assert.equal(second.task.doneAt, first.task.doneAt)
  })
})

describe('repo — snooze and pin', () => {
  it('snoozes for the requested minutes', async () => {
    const { repo } = harness()
    const task = await repo.create(recurringInput() as never)
    const result = await repo.snooze(task.id, 15)
    assert.equal(result.snoozeUntil, '2026-10-30T01:15:00.000Z')
  })

  it('rejects minutes outside 1–1440', async () => {
    const { repo } = harness()
    const task = await repo.create(recurringInput() as never)
    for (const minutes of [0, -1, 1441, 1.5]) {
      await assert.rejects(repo.snooze(task.id, minutes), (error: { code: string }) => {
        assert.equal(error.code, 'invalid_argument')
        return true
      })
    }
  })

  it('toggles the pin and is a no-op when unchanged', async () => {
    const { repo } = harness()
    const task = await repo.create(recurringInput() as never)
    assert.deepEqual(await repo.pin(task.id, true), { id: task.id, pinned: true })
    const revisionAfterPin = repo.get(task.id)?.revision
    await repo.pin(task.id, true)
    assert.equal(repo.get(task.id)?.revision, revisionAfterPin)
  })
})

describe('repo — serialization and write amplification (F6.9)', () => {
  it('serializes concurrent updates so no write is lost', async () => {
    const { repo } = harness()
    const task = await repo.create(recurringInput() as never)
    await Promise.all([
      repo.pin(task.id, true),
      repo.snooze(task.id, 5),
    ])
    const after = repo.get(task.id)
    assert.equal(after?.pinned, true)
    assert.ok(after?.state.snoozeUntil !== null)
  })

  it('coalesces a burst into at most two physical writes', async () => {
    const { fs, repo } = harness()
    const task = await repo.create(recurringInput() as never)
    await repo.flush()
    const baseline = fs.writeCount
    for (let index = 0; index < 50; index += 1) {
      await repo.pin(task.id, index % 2 === 0)
    }
    await repo.flush()
    assert.ok(fs.writeCount - baseline <= 2, `expected ≤2 writes, got ${String(fs.writeCount - baseline)}`)
  })

  it('does not write at all for a read-only burst', async () => {
    const { fs, repo } = harness()
    await repo.create(recurringInput() as never)
    await repo.flush()
    const baseline = fs.writeCount
    repo.list({ today: '2026-10-30' })
    repo.get('x')
    await repo.flush()
    assert.equal(fs.writeCount, baseline)
  })
})

describe('repo — applyTick', () => {
  it('records a fired occurrence and a missed occurrence in one write', async () => {
    const { fs, repo } = harness()
    const task = await repo.create(recurringInput() as never)
    await repo.flush()
    const baseline = fs.writeCount
    await repo.applyTick(
      [
        { taskId: task.id, firedKey: `${task.id}@2026-10-30T01:00:00.000Z`, firedAt: '2026-10-30T01:00:04.000Z' },
        { taskId: 'tr_missing', firedKey: 'ignored' },
      ],
      NOW,
    )
    const after = repo.get(task.id)
    assert.equal(after?.state.lastOccurrenceKey, `${task.id}@2026-10-30T01:00:00.000Z`)
    assert.equal(after?.state.lastFiredAt, '2026-10-30T01:00:04.000Z')
    assert.ok(fs.writeCount - baseline <= 1)
  })

  it('increments missedCount and advances the missed watermark', async () => {
    const { repo } = harness()
    const task = await repo.create(recurringInput() as never)
    await repo.applyTick(
      [{ taskId: task.id, missedKey: `${task.id}@2026-10-29T01:00:00.000Z`, missedAt: '2026-10-29T01:00:00.000Z' }],
      NOW,
    )
    const after = repo.get(task.id)
    assert.equal(after?.state.missedCount, 1)
    // A missed occurrence also records the de-duplication marker, otherwise the
    // next tick would count the same occurrence again (F6.4).
    assert.equal(after?.state.missedAt, '2026-10-29T01:00:00.000Z')
    assert.equal(after?.state.lastOccurrenceKey, `${task.id}@2026-10-29T01:00:00.000Z`)
  })

  it('marks firedStart only for a start phase', async () => {
    const { repo } = harness()
    const task = await repo.create(onceInput() as never)
    await repo.applyTick(
      [{ taskId: task.id, firedKey: `${task.id}@2026-11-05T06:00:00.000Z#start`, phase: 'start', node: 'start' }],
      NOW,
    )
    const after = repo.get(task.id)
    assert.equal(after?.state.firedStart, true)
    assert.equal(after?.state.firedEnd, false)
  })
})

describe('repo — persistence', () => {
  it('writes through to the JSON file', async () => {
    const { fs, repo } = harness()
    const task = await repo.create(recurringInput() as never)
    await repo.flush()
    const written = JSON.parse(fs.files.get(STATE) as string)
    assert.equal(written.tasks.length, 1)
    assert.equal(written.tasks[0].id, task.id)
  })

  it('drops the oldest deliveries past the cap', async () => {
    const { repo } = harness()
    for (let index = 0; index < 1005; index += 1) {
      await repo.recordDelivery({
        occurrenceKey: `k${String(index)}`,
        channel: 'overlay',
        status: 'ok',
        at: NOW.toISOString(),
        readAt: null,
        ignoredAt: null,
        dismissedAt: null,
        error: null,
      })
    }
    assert.equal(repo.deliveries().length, 1000)
    assert.equal(repo.deliveries()[0]?.occurrenceKey, 'k5')
  })

  it('stores settings and merges a partial dnd update', async () => {
    const { repo } = harness()
    repo.updateSettings({ dnd: { enabled: true, start: '22:00', end: '08:00', weekdaysOnly: true } })
    assert.equal(repo.settings().dnd.enabled, true)
    assert.equal(repo.settings().dnd.weekdaysOnly, true)
  })
})

describe('repo — disposal', () => {
  it('flushes pending changes on dispose and rejects later writes', async () => {
    const { fs, repo } = harness()
    const task = await repo.create(recurringInput() as never)
    repo.dispose()
    // The pending create must have reached disk before disposal returned.
    const written = JSON.parse(fs.files.get(STATE) as string)
    assert.equal(written.tasks[0].id, task.id)
    await assert.rejects(repo.create(recurringInput() as never))
  })
})

describe('repo — fixture sanity', () => {
  it('stores the same shape the fixtures build', () => {
    const task = makeTask({ id: 'tr_0123456789ABCDEFGHJKMNPQRS' })
    assert.equal(task.kind, 'recurring')
  })
})
