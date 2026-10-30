/**
 * Agent tool tests (F7.1–F7.13 / AC-22).
 *
 * The definitions are driven directly with fake `exec` objects, so both the
 * success path and the structured `{code}` failure envelope are asserted without
 * a Cordis runtime.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { createRepository } from '../src/host/repo.js'
import { createStore } from '../src/host/store.js'
import { buildHolidayTable, type HolidayFile } from '../src/host/rules/holidays.js'
import { createToolDefinitions, delegationDepthOf, ToolFailure, type ToolExec } from '../src/host/tools.js'
import { createMemoryFs } from './memoryFs.js'

const DATA_DIR = '/virtual/dsh/dsh-todos-diy'
const NOW = new Date('2026-10-30T09:00:00+08:00')

const here = dirname(fileURLToPath(import.meta.url))
const holidays = buildHolidayTable(
  JSON.parse(readFileSync(join(here, '../../assets/holidays-cn-2024-2027.json'), 'utf8')) as HolidayFile,
)

/** Main-session caller (delegation depth 0). */
const MAIN: ToolExec = { agent: { session: { header: { delegationDepth: 0 } } } }
/** A delegated sub-agent caller. */
const SUBAGENT: ToolExec = { agent: { session: { header: { delegationDepth: 1 } } } }

/** Build the nine tools over a memory store. */
function harness() {
  const fs = createMemoryFs()
  fs.mkdir(DATA_DIR)
  const store = createStore({ dataDir: DATA_DIR, fs, now: () => NOW })
  store.load()
  const repo = createRepository({ store, now: () => NOW, debounceMs: 0 })
  const tools = createToolDefinitions({ repo, holidays, timeZone: 'Asia/Shanghai', now: () => NOW })
  const byName = new Map(tools.map((tool) => [tool.name, tool]))
  return { repo, tools, byName, fs }
}

/** Invoke one tool by name. */
async function run(
  byName: Map<string, { execute: (args: Record<string, unknown>, exec: ToolExec) => Promise<unknown> }>,
  name: string,
  args: Record<string, unknown>,
  exec: ToolExec = MAIN,
): Promise<unknown> {
  const tool = byName.get(name)
  assert.ok(tool !== undefined, `tool ${name} is not registered`)
  return tool.execute(args, exec)
}

/** Assert a tool rejects with a given structured code. */
async function expectToolCode(
  fn: () => Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(fn, (error: unknown) => {
    assert.ok(error instanceof ToolFailure, `expected ToolFailure, got ${String(error)}`)
    assert.equal(error.payload.code, code)
    return true
  })
}

describe('tool registry surface (F7.9)', () => {
  it('registers exactly the nine documented tools', () => {
    const names = harness().tools.map((tool) => tool.name).sort()
    assert.deepEqual(names, [
      'todo_reminder_complete',
      'todo_reminder_create',
      'todo_reminder_delete',
      'todo_reminder_list',
      'todo_reminder_pause',
      'todo_reminder_pin',
      'todo_reminder_resume',
      'todo_reminder_snooze',
      'todo_reminder_update',
    ])
  })

  it('every description names the domain and warns off schedule_*', () => {
    for (const tool of harness().tools) {
      assert.match(tool.description, /工作待办/)
      assert.match(tool.description, /schedule_\*/)
    }
  })

  it('create/update descriptions state the D-03 both-nodes rule and the cron dialect', () => {
    const create = harness().tools.find((tool) => tool.name === 'todo_reminder_create')
    assert.match(create!.description, /开始和结束都会各提醒一次/)
    assert.match(create!.description, /5 字段 Vixie/)
  })

  it('pause and complete descriptions distinguish the two semantics', () => {
    const pause = harness().tools.find((tool) => tool.name === 'todo_reminder_pause')
    const complete = harness().tools.find((tool) => tool.name === 'todo_reminder_complete')
    assert.match(pause!.description, /complete/)
    assert.match(complete!.description, /pause/)
  })

  it('every schema is a closed object', () => {
    for (const tool of harness().tools) {
      assert.equal((tool.parameters as { type: string }).type, 'object')
      assert.equal((tool.parameters as { additionalProperties: boolean }).additionalProperties, false)
    }
  })
})

describe('F7.10 (v1.3): tools are not bound to an Agent session', () => {
  it('allows a programmatic host call with no agent', async () => {
    const { byName } = harness()
    const result = await run(byName, 'todo_reminder_list', {}, {})
    assert.ok(typeof result === 'object')
  })

  it('allows a delegated sub-agent', async () => {
    const { byName } = harness()
    const result = await run(byName, 'todo_reminder_list', {}, SUBAGENT)
    assert.ok(typeof result === 'object')
  })

  it('allows a main-session call', async () => {
    const { byName } = harness()
    const result = await run(byName, 'todo_reminder_list', {}, MAIN)
    assert.ok(typeof result === 'object')
  })

  it('reads depth from the runtime signal as well as the header', () => {
    assert.equal(delegationDepthOf({ agent: { options: { subagentDepth: 2 } } }), 2)
    assert.equal(delegationDepthOf(MAIN), 0)
    assert.equal(delegationDepthOf({ agent: {} }), 0)
  })

  it('lets a sub-agent create a task', async () => {
    const { byName, repo } = harness()
    await run(byName, 'todo_reminder_create', { title: '子 Agent 任务', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } }, SUBAGENT)
    assert.equal(repo.snapshotTasks().length, 1)
  })
})

describe('todo_reminder_create', () => {
  it('creates a recurring task and returns the TaskView', async () => {
    const { byName, repo } = harness()
    const view = (await run(byName, 'todo_reminder_create', {
      title: '查看今日待办',
      kind: 'recurring',
      rule: { preset: 'workdays', time: '09:00' },
    })) as { id: string; priority: { key: string }; rule: { cron: string } }
    assert.match(view.id, /^tr_/)
    assert.equal(view.rule.cron, '0 9 * * 1-5')
    assert.ok(['high', 'mid', 'low', 'none'].includes(view.priority.key))
    assert.equal(repo.snapshotTasks().length, 1)
  })

  it('creates a one-off task with both nodes', async () => {
    const { byName } = harness()
    const view = (await run(byName, 'todo_reminder_create', {
      title: '季度评审',
      kind: 'once',
      once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' },
    })) as { once: { startAt: string; endAt: string } }
    assert.equal(view.once.startAt, '2026-11-05T06:00:00.000Z')
    assert.equal(view.once.endAt, '2026-11-05T10:00:00.000Z')
  })

  it('returns invalid_cron for a bad expression', async () => {
    const { byName } = harness()
    await expectToolCode(
      () => run(byName, 'todo_reminder_create', { title: 'x', kind: 'recurring', rule: { preset: 'custom', cron: '0 9 L * *' } }),
      'invalid_cron',
    )
  })

  it('returns invalid_timezone for an unknown zone', async () => {
    const { byName } = harness()
    await expectToolCode(
      () => run(byName, 'todo_reminder_create', { title: 'x', kind: 'recurring', rule: { preset: 'workdays', time: '09:00', timeZone: 'Mars/Base' } }),
      'invalid_timezone',
    )
  })

  it('returns invalid_argument when title is missing', async () => {
    const { byName } = harness()
    await expectToolCode(() => run(byName, 'todo_reminder_create', { kind: 'recurring' }), 'invalid_argument')
  })
})

describe('todo_reminder_list (F7.1 / F7.13)', () => {
  it('returns items, counts, prioritySummary and nextCursor', async () => {
    const { byName } = harness()
    await run(byName, 'todo_reminder_create', { title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const result = (await run(byName, 'todo_reminder_list', { view: 'recurring' })) as {
      items: unknown[]
      counts: { recurring: number }
      byKind: { once: number; recurring: number }
      totalDone: number
      prioritySummary: { high: number }
      nextCursor: string | null
      serverTime: string
    }
    assert.equal(result.items.length, 1)
    assert.equal(result.counts.recurring, 1)
    assert.deepEqual(result.byKind, { once: 0, recurring: 1 })
    assert.equal(result.totalDone, 0)
    assert.equal(typeof result.serverTime, 'string')
    assert.equal(result.nextCursor, null)
  })

  it('filters by view', async () => {
    const { byName } = harness()
    const created = (await run(byName, 'todo_reminder_create', {
      title: 'A',
      kind: 'once',
      once: { startAt: '2026-10-01T02:00:00Z', endAt: '2026-10-01T04:00:00Z' },
    })) as { id: string }
    await run(byName, 'todo_reminder_complete', { id: created.id })
    const done = (await run(byName, 'todo_reminder_list', { view: 'done' })) as { items: unknown[] }
    assert.equal(done.items.length, 1)
  })

  it('filters by query text', async () => {
    const { byName } = harness()
    await run(byName, 'todo_reminder_create', { title: '提交材料', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    await run(byName, 'todo_reminder_create', { title: '别的', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const result = (await run(byName, 'todo_reminder_list', { view: 'recurring', query: '材料' })) as { items: unknown[] }
    assert.equal(result.items.length, 1)
  })
})

describe('todo_reminder_update (F7.3)', () => {
  it('updates with the matching revision', async () => {
    const { byName } = harness()
    const created = (await run(byName, 'todo_reminder_create', { title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })) as { id: string }
    const updated = (await run(byName, 'todo_reminder_update', { id: created.id, expectedRevision: 1, patch: { title: 'B' } })) as { title: string; revision: number }
    assert.equal(updated.title, 'B')
    assert.equal(updated.revision, 2)
  })

  it('returns conflict for a stale revision', async () => {
    const { byName } = harness()
    const created = (await run(byName, 'todo_reminder_create', { title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })) as { id: string }
    await run(byName, 'todo_reminder_update', { id: created.id, expectedRevision: 1, patch: { title: 'B' } })
    await expectToolCode(
      () => run(byName, 'todo_reminder_update', { id: created.id, expectedRevision: 1, patch: { title: 'C' } }),
      'conflict',
    )
  })

  it('returns not_found for an unknown id', async () => {
    const { byName } = harness()
    await expectToolCode(() => run(byName, 'todo_reminder_update', { id: 'tr_nope', expectedRevision: 1, patch: {} }), 'not_found')
  })
})

describe('todo_reminder_delete (F7.4)', () => {
  it('soft-deletes by default', async () => {
    const { byName, repo } = harness()
    const created = (await run(byName, 'todo_reminder_create', { title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })) as { id: string }
    const result = (await run(byName, 'todo_reminder_delete', { id: created.id })) as { purged: boolean }
    assert.equal(result.purged, false)
    assert.equal(repo.get(created.id)?.status, 'archived')
  })

  it('purges when confirm is true', async () => {
    const { byName, repo } = harness()
    const created = (await run(byName, 'todo_reminder_create', { title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })) as { id: string }
    const result = (await run(byName, 'todo_reminder_delete', { id: created.id, purge: true, confirm: true })) as { purged: boolean }
    assert.equal(result.purged, true)
    assert.equal(repo.get(created.id), null)
  })

  it('refuses a purge without confirm', async () => {
    const { byName } = harness()
    const created = (await run(byName, 'todo_reminder_create', { title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })) as { id: string }
    await expectToolCode(() => run(byName, 'todo_reminder_delete', { id: created.id, purge: true }), 'invalid_argument')
  })
})

describe('todo_reminder_pause / resume (F7.5 / F7.6)', () => {
  it('pauses and resumes', async () => {
    const { byName } = harness()
    const created = (await run(byName, 'todo_reminder_create', { title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })) as { id: string }
    const paused = (await run(byName, 'todo_reminder_pause', { id: created.id })) as { status: string; changed: boolean }
    assert.deepEqual(paused, { id: created.id, status: 'paused', changed: true })
    const resumed = (await run(byName, 'todo_reminder_resume', { id: created.id })) as { status: string; changed: boolean }
    assert.deepEqual(resumed, { id: created.id, status: 'active', changed: true })
  })
})

describe('todo_reminder_complete (F7.7)', () => {
  it('completes a one-off task', async () => {
    const { byName } = harness()
    const created = (await run(byName, 'todo_reminder_create', {
      title: 'A',
      kind: 'once',
      once: { startAt: '2026-10-30T02:00:00Z', endAt: '2026-10-30T04:00:00Z' },
    })) as { id: string }
    const result = (await run(byName, 'todo_reminder_complete', { id: created.id })) as { id: string; nextAt: string | null }
    assert.equal(result.id, created.id)
    assert.equal(result.nextAt, null)
  })

  it('returns no_occurrence for a recurring task that has never fired', async () => {
    const { byName } = harness()
    const created = (await run(byName, 'todo_reminder_create', { title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })) as { id: string }
    await expectToolCode(() => run(byName, 'todo_reminder_complete', { id: created.id }), 'no_occurrence')
  })
})

describe('todo_reminder_snooze (F7.8)', () => {
  it('snoozes and returns the until instant', async () => {
    const { byName } = harness()
    const created = (await run(byName, 'todo_reminder_create', { title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })) as { id: string }
    const result = (await run(byName, 'todo_reminder_snooze', { id: created.id, minutes: 5 })) as { snoozeUntil: string }
    assert.equal(result.snoozeUntil, '2026-10-30T01:05:00.000Z')
  })

  it('rejects an out-of-range minute count', async () => {
    const { byName } = harness()
    const created = (await run(byName, 'todo_reminder_create', { title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })) as { id: string }
    await expectToolCode(() => run(byName, 'todo_reminder_snooze', { id: created.id, minutes: 0 }), 'invalid_argument')
  })
})

describe('todo_reminder_pin (F7.12)', () => {
  it('pins and unpins', async () => {
    const { byName } = harness()
    const created = (await run(byName, 'todo_reminder_create', { title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })) as { id: string }
    assert.deepEqual(await run(byName, 'todo_reminder_pin', { id: created.id, pinned: true }), { id: created.id, pinned: true })
    assert.deepEqual(await run(byName, 'todo_reminder_pin', { id: created.id, pinned: false }), { id: created.id, pinned: false })
  })
})

describe('tool output contract', () => {
  it('renders JSON text for every tool', () => {
    for (const tool of harness().tools) {
      const blocks = tool.output.render({}, { ok: true })
      assert.equal(blocks[0]?.type, 'text')
      assert.equal(JSON.parse((blocks[0] as { text: string }).text).ok, true)
    }
  })
})
