/**
 * 0.2.1 Agent capability tests: F7.14–F7.18 / AC-46–AC-50.
 *
 * The tool layer is driven directly (no HTTP) where the requirement is about
 * Agent behaviour, and through `repo` for the store-level contract.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createToolDefinitions } from '../src/host/toolDefs.js'
import type { RawToolDefinition } from '../src/host/tools.js'
import { createRepository } from '../src/host/repo.js'
import { createStore } from '../src/host/store.js'
import { nextFireAt, occurrenceKey } from '../src/host/rules/occurrence.js'
import { toTaskView } from '../src/host/taskView.js'
import { createMemoryFs } from './memoryFs.js'
import { makeTask } from './fixtures.js'

const DATA_DIR = '/virtual/dsh/dsh-todos-diy'
const NOW = new Date('2026-11-05T12:00:00+08:00')

/** Build a repository + tool table over a memory store. */
function harness() {
  const fs = createMemoryFs()
  fs.mkdir(DATA_DIR)
  const store = createStore({ dataDir: DATA_DIR, fs, now: () => NOW })
  store.load()
  const repo = createRepository({ store, now: () => NOW, debounceMs: 0 })
  const tools = createToolDefinitions({ repo, holidays: undefined as never, timeZone: 'Asia/Shanghai', now: () => NOW })
  const byName = new Map(tools.map((tool) => [tool.name, tool]))
  return { fs, store, repo, tools, byName }
}

/** Invoke one tool by name. */
async function run(
  byName: Map<string, RawToolDefinition>,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const tool = byName.get(name)
  assert.ok(tool !== undefined, `tool ${name} is not registered`)
  return (await tool.execute(args, {} as never)) as Record<string, unknown>
}

/** Assert a tool rejects with the given structured code. */
async function expectCode(work: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(work, (error: { payload?: { code?: string }; message?: string }) => {
    const payload = error.payload ?? (JSON.parse(error.message ?? '{}') as { code?: string })
    assert.equal(payload.code, code)
    return true
  })
}

describe('F7.14 / AC-46: todo_reminder_get', () => {
  it('returns the same TaskView as /tasks/get', async () => {
    const { repo, byName } = harness()
    const task = await repo.create({ title: 'get me', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const result = await run(byName, 'todo_reminder_get', { id: task.id })
    assert.equal(result['id'], task.id)
    assert.equal(result['title'], 'get me')
    assert.equal(typeof result['revision'], 'number')
    assert.equal(result['stage'], 'recurring')
    assert.deepEqual(result['priority'], toTaskView(task, { now: NOW }).priority)
  })

  it('answers not_found for an unknown id', async () => {
    const { byName } = harness()
    await expectCode(() => run(byName, 'todo_reminder_get', { id: 'tr_nope' }), 'not_found')
  })

  it('lets an Agent get then update with the returned revision', async () => {
    const { repo, byName } = harness()
    const task = await repo.create({ title: 'before', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const view = await run(byName, 'todo_reminder_get', { id: task.id })
    const updated = await run(byName, 'todo_reminder_update', {
      id: task.id,
      expectedRevision: view['revision'],
      patch: { title: 'after' },
    })
    assert.equal(updated['title'], 'after')
  })
})

describe('F7.15 / AC-47: create idempotency', () => {
  const key = 'idem-key-0123456789'

  it('replays the original task for the same key and payload', async () => {
    const { repo } = harness()
    const input = { title: 'idem', kind: 'recurring' as const, rule: { preset: 'workdays', time: '09:00' } }
    const first = await repo.createTask({ ...input, idempotencyKey: key })
    const second = await repo.createTask({ ...input, idempotencyKey: key })
    assert.equal(first.replayed, false)
    assert.equal(second.replayed, true)
    assert.equal(second.task.id, first.task.id)
    assert.equal(repo.snapshotTasks().length, 1, 'retrying must not create a second task')
  })

  it('reports conflict when the same key carries a different payload', async () => {
    const { repo } = harness()
    await repo.createTask({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' }, idempotencyKey: key })
    await assert.rejects(
      repo.createTask({ title: 'B', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' }, idempotencyKey: key }),
      (error: { code?: string }) => {
        assert.equal(error.code, 'conflict')
        return true
      },
    )
    assert.equal(repo.snapshotTasks().length, 1)
  })

  it('rejects a key shorter than 16 or longer than 128 characters', async () => {
    const { repo } = harness()
    for (const bad of ['short', 'x'.repeat(129)]) {
      await assert.rejects(
        repo.createTask({ title: 'x', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' }, idempotencyKey: bad }),
        (error: { code?: string }) => error.code === 'invalid_argument',
      )
    }
  })

  it('does not affect creates without a key', async () => {
    const { repo } = harness()
    for (let index = 0; index < 2; index += 1) {
      await repo.createTask({ title: 'x', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    }
    assert.equal(repo.snapshotTasks().length, 2)
  })

  it('persists the index so a restart replays instead of duplicating', async () => {
    const fs = createMemoryFs()
    fs.mkdir(DATA_DIR)
    const store = createStore({ dataDir: DATA_DIR, fs, now: () => NOW })
    store.load()
    const repo = createRepository({ store, now: () => NOW, debounceMs: 0 })
    const input = { title: 'persist', kind: 'recurring' as const, rule: { preset: 'workdays', time: '09:00' }, idempotencyKey: key }
    await repo.createTask(input)
    await repo.flush()
    const reopened = createStore({ dataDir: DATA_DIR, fs, now: () => NOW })
    reopened.load()
    const repo2 = createRepository({ store: reopened, now: () => NOW, debounceMs: 0 })
    const replayed = await repo2.createTask(input)
    assert.equal(replayed.replayed, true)
    assert.equal(reopened.state.tasks.length, 1)
  })

  it('generates the same fingerprint regardless of property order', async () => {
    const { repo } = harness()
    const a = await repo.createTask({
      title: 'order',
      kind: 'recurring',
      rule: { preset: 'workdays', time: '09:00' },
      idempotencyKey: key,
    })
    const b = await repo.createTask({
      idempotencyKey: key,
      rule: { time: '09:00', preset: 'workdays' } as never,
      kind: 'recurring',
      title: 'order',
    })
    assert.equal(a.task.id, b.task.id)
    assert.equal(b.replayed, true)
  })
})

describe('F7.16 / AC-48: list defaults to all', () => {
  /** One task in each stage. */
  async function seed(repo: ReturnType<typeof harness>['repo']) {
    await repo.create({ title: 'n', kind: 'once', once: { startAt: '2026-11-06T09:00:00+08:00', endAt: '2026-11-06T18:00:00+08:00' } })
    await repo.create({ title: 'p', kind: 'once', once: { startAt: '2026-11-05T09:00:00+08:00', endAt: '2026-11-05T20:00:00+08:00' } })
    await repo.create({ title: 'o', kind: 'once', once: { startAt: '2026-10-01T09:00:00+08:00', endAt: '2026-10-02T18:00:00+08:00' } })
    const done = await repo.create({ title: 'd', kind: 'once', once: { startAt: '2026-11-01T09:00:00+08:00', endAt: '2026-11-02T18:00:00+08:00' } })
    await repo.complete(done.id)
    const paused = await repo.create({ title: 'z', kind: 'once', once: { startAt: '2026-10-01T09:00:00+08:00', endAt: '2026-10-02T18:00:00+08:00' } })
    await repo.pause(paused.id)
    await repo.create({ title: 'r', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
  }

  it('returns every non-archived task by default', async () => {
    const { repo, byName } = harness()
    await seed(repo)
    const result = await run(byName, 'todo_reminder_list', {})
    const items = result['items'] as { title: string }[]
    assert.equal(items.length, 6)
    assert.deepEqual(items.map((item) => item.title).sort(), ['d', 'n', 'o', 'p', 'r', 'z'])
  })

  it('excludes archived tasks', async () => {
    const { repo, byName } = harness()
    await seed(repo)
    const target = repo.snapshotTasks()[0]
    assert.ok(target !== undefined)
    await repo.remove(target.id)
    const result = await run(byName, 'todo_reminder_list', {})
    assert.equal((result['items'] as unknown[]).length, 5)
  })

  it('still supports the stage views', async () => {
    const { repo, byName } = harness()
    await seed(repo)
    const result = await run(byName, 'todo_reminder_list', { view: 'overdue' })
    assert.deepEqual((result['items'] as { title: string }[]).map((item) => item.title), ['o'])
  })

  it('returns counts/byKind/totalDone/serverTime/nextTransitionAt', async () => {
    const { repo, byName } = harness()
    await seed(repo)
    const result = await run(byName, 'todo_reminder_list', {})
    assert.deepEqual(result['counts'], { notStarted: 1, inProgress: 1, overdue: 1, done: 1, paused: 1, recurring: 1 })
    assert.deepEqual(result['byKind'], { once: 5, recurring: 1 })
    assert.equal(result['totalDone'], 1)
    assert.equal(typeof result['serverTime'], 'string')
    assert.ok('nextTransitionAt' in result)
  })

  it('keeps the HTTP snapshot default at inProgress', async () => {
    const { repo } = harness()
    await seed(repo)
    const result = repo.list({})
    assert.deepEqual(result.items.map((task) => task.title), ['p'])
  })
})

describe('F7.17 / AC-49: remind and deliveries tools', () => {
  it('sends one reminder without touching the rule state', async () => {
    const { repo, byName } = harness()
    const task = await repo.create({ title: 'remind me', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const before = repo.get(task.id)
    assert.ok(before !== null)
    const result = await run(byName, 'todo_reminder_remind', { id: task.id })
    assert.match(String(result['occurrenceKey']), /#remind$/)
    assert.equal(typeof result['deliveredAt'], 'string')
    const after = repo.get(task.id)
    assert.equal(after?.state.lastOccurrenceKey, before.state.lastOccurrenceKey)
    assert.equal(after?.state.lastFiredAt, before.state.lastFiredAt)
    assert.equal(after?.state.firedStart, before.state.firedStart)
    assert.equal(repo.deliveries().length, 1)
  })

  it('answers not_found for an unknown task', async () => {
    const { byName } = harness()
    await expectCode(() => run(byName, 'todo_reminder_remind', { id: 'tr_nope' }), 'not_found')
  })

  it('lists deliveries newest first with paging and a total', async () => {
    const { repo, byName } = harness()
    const first = await repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const second = await repo.create({ title: 'B', kind: 'recurring', rule: { preset: 'workdays', time: '10:00' } })
    await run(byName, 'todo_reminder_remind', { id: first.id })
    await run(byName, 'todo_reminder_remind', { id: second.id })
    const all = await run(byName, 'todo_reminder_deliveries', {})
    assert.equal(all['total'], 2)
    const items = all['items'] as { occurrenceKey: string }[]
    assert.equal(items.length, 2)
    assert.ok(items[0]?.occurrenceKey.startsWith(second.id))
    const scoped = await run(byName, 'todo_reminder_deliveries', { taskId: first.id })
    assert.equal(scoped['total'], 1)
    const page = await run(byName, 'todo_reminder_deliveries', { limit: 1 })
    assert.equal((page['items'] as unknown[]).length, 1)
    assert.equal(page['nextCursor'], '1')
  })

  it('answers not_found for an unknown taskId filter', async () => {
    const { byName } = harness()
    await expectCode(() => run(byName, 'todo_reminder_deliveries', { taskId: 'tr_nope' }), 'not_found')
  })
})

describe('F7.18 / AC-50: complete skipNext', () => {
  it('skips the next occurrence of a brand-new recurring task', async () => {
    const { repo, byName } = harness()
    const task = await repo.create({ title: 'skip', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const next = nextFireAt(task, NOW)
    assert.ok(next !== null)
    const result = await run(byName, 'todo_reminder_complete', { id: task.id, skipNext: true })
    assert.equal(result['completedOccurrenceKey'], occurrenceKey(task.id, next, null))
    const after = repo.get(task.id)
    assert.equal(after?.status, 'active', 'a recurring task must never become done')
    assert.equal(after?.state.completedOccurrenceKey, occurrenceKey(task.id, next, null))
    assert.equal(after?.state.lastOccurrenceKey, occurrenceKey(task.id, next, null))
    // The next fire is now the occurrence after the skipped one.
    const following = nextFireAt(after as never, new Date(next.getTime()))
    assert.ok(following !== null)
    assert.ok(following.getTime() > next.getTime())
    // And the projected nextAt must already point past the skipped run.
    const view = toTaskView(after as never, { now: NOW })
    assert.ok(view.nextAt !== null)
    assert.ok(Date.parse(view.nextAt) > next.getTime())
  })

  it('still returns no_occurrence without skipNext', async () => {
    const { repo, byName } = harness()
    const task = await repo.create({ title: 'skip', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    await expectCode(() => run(byName, 'todo_reminder_complete', { id: task.id }), 'no_occurrence')
  })

  it('does not change a one-off task semantics', async () => {
    const { repo, byName } = harness()
    const task = await repo.create({ title: 'once', kind: 'once', once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' } })
    const result = await run(byName, 'todo_reminder_complete', { id: task.id, skipNext: true })
    assert.equal((result as { task?: { status?: string } }).task?.status ?? 'done', 'done')
    assert.equal(repo.get(task.id)?.status, 'done')
  })
})

describe('0.2.1 tool surface', () => {
  it('registers the three new tools and the updated list schema', () => {
    const { tools } = harness()
    const names = tools.map((tool) => tool.name)
    for (const name of ['todo_reminder_get', 'todo_reminder_remind', 'todo_reminder_deliveries']) {
      assert.ok(names.includes(name), `${name} must be registered`)
    }
    assert.equal(tools.length, 12)
    const propsOf = (name: string): Record<string, unknown> =>
      ((tools.find((tool) => tool.name === name)?.parameters as { properties?: Record<string, unknown> })?.properties ?? {})
    const view = propsOf('todo_reminder_list')['view'] as { enum?: string[] } | undefined
    assert.ok(view?.enum?.includes('all'))
    assert.ok(propsOf('todo_reminder_create')['idempotencyKey'] !== undefined)
    assert.ok(propsOf('todo_reminder_complete')['skipNext'] !== undefined)
  })

  it('exposes no dueDate parameter anywhere', () => {
    const { tools } = harness()
    for (const tool of tools) {
      const properties = (tool.parameters as { properties?: Record<string, unknown> }).properties ?? {}
      assert.equal(Object.hasOwn(properties, 'dueDate'), false, tool.name)
    }
  })
})

describe('0.2.1 state shape', () => {
  it('round-trips the idempotency index through coerceState', async () => {
    const { repo, fs } = harness()
    await repo.createTask({ title: 'x', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' }, idempotencyKey: 'idem-key-0123456789' })
    await repo.flush()
    const { coerceState } = await import('../src/host/state.js')
    const raw = JSON.parse(fs.files.get(`${DATA_DIR}/tasks.json`) as string)
    const parsed = coerceState(raw)
    assert.deepEqual(parsed.problem, { kind: 'ok' })
    assert.equal(Object.keys(parsed.state?.meta.idempotency ?? {}).length, 1)
  })

  it('tolerates a v2 file without the optional index', async () => {
    const { coerceState, emptyState } = await import('../src/host/state.js')
    const state = emptyState(NOW)
    const raw = JSON.parse(JSON.stringify(state)) as { meta: Record<string, unknown> }
    delete raw.meta['idempotency']
    const parsed = coerceState(raw)
    assert.deepEqual(parsed.problem, { kind: 'ok' })
    assert.deepEqual(parsed.state?.meta.idempotency, {})
  })
})
