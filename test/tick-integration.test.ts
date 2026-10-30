/**
 * Scheduler-integration tests: the tick wiring that lives in `index.ts`.
 *
 * `apply()` itself needs a Cordis context, so the observable behaviour is
 * tested through the same pure pieces it composes plus a small harness that
 * mirrors the tick body: resolveTick → applyTick → flush. That keeps the test
 * honest about ordering (claim before deliver) without faking a whole Cordis
 * runtime.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRepository } from '../src/host/repo.js'
import { createStore } from '../src/host/store.js'
import { resolveTick } from '../src/host/rules/resolveTick.js'
import { planToChanges } from '../src/host/tickChanges.js'
import { buildHolidayTable, type HolidayFile } from '../src/host/rules/holidays.js'
import { createMemoryFs, type MemoryFs } from './memoryFs.js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = '/virtual/dsh/dsh-todos-diy'
const STATE = `${DATA_DIR}/tasks.json`

const here = dirname(fileURLToPath(import.meta.url))
const holidays = buildHolidayTable(
  JSON.parse(readFileSync(join(here, '../../assets/holidays-cn-2024-2027.json'), 'utf8')) as HolidayFile,
)

interface Harness {
  fs: MemoryFs
  repo: ReturnType<typeof createRepository>
  /** Move the injected clock forward (the repository reads it per call). */
  setNow(instant: Date): void
}

/** Repository + memory fs with a movable injected clock. */
function harness(now: Date): Harness {
  const fs = createMemoryFs()
  fs.mkdir(DATA_DIR)
  let current = now
  const store = createStore({ dataDir: DATA_DIR, fs, now: () => current })
  store.load()
  const repo = createRepository({ store, now: () => current, debounceMs: 0 })
  return {
    fs,
    repo,
    setNow(instant: Date) {
      current = instant
    },
  }
}

/**
 * Mirror of the tick body in `index.ts`: resolve, claim (persist), then report.
 * @param harness - Repository under test.
 * @param now - Tick instant.
 * @returns The plan that was applied.
 */
async function tick(harnessRef: Harness, now: Date): Promise<ReturnType<typeof resolveTick>> {
  const tasks = harnessRef.repo.snapshotTasks()
  const plan = resolveTick(tasks, now, { graceMinutes: 5, holidays })
  // Always use the production mapper: a local mirror would let a missing field
  // in `createTick` pass unnoticed (that is how the `node` defect slipped by).
  const changes = planToChanges(plan, tasks)
  if (changes.length > 0) {
    await harnessRef.repo.applyTick(changes, now)
    await harnessRef.repo.flush()
  }
  return plan
}

describe('tick — first run', () => {
  it('fires a due occurrence and writes the claim before anything else', async () => {
    // Created the previous morning, so the 09:00 occurrence is genuinely due.
    const h = harness(new Date('2026-10-29T08:00:00+08:00'))
    const task = await h.repo.create({
      title: '查看今日待办',
      kind: 'recurring',
      rule: { preset: 'workdays', time: '09:00' },
    })
    await h.repo.flush()
    const plan = await tick(h, new Date('2026-10-30T09:00:30+08:00'))
    assert.equal(plan.fire.length, 1)
    const persisted = JSON.parse(h.fs.files.get(STATE) as string)
    const stored = persisted.tasks.find((entry: { id: string }) => entry.id === task.id)
    // 10-29 is a normal Thursday whose 09:00 occurrence was also due (the task
    // was created at 08:00 the previous day), so the plan fires the latest one
    // and records 10-29 as missed first.
    assert.equal(stored.state.lastOccurrenceKey, `${task.id}@2026-10-30T01:00:00.000Z`)
    assert.equal(stored.state.missedCount, 1)
  })

  it('does not fire twice for the same occurrence on a second tick (AC-09)', async () => {
    const h = harness(new Date('2026-10-29T08:00:00+08:00'))
    await h.repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    const first = await tick(h, new Date('2026-10-30T09:00:30+08:00'))
    assert.equal(first.fire.length, 1)
    const second = await tick(h, new Date('2026-10-30T09:01:00+08:00'))
    assert.equal(second.fire.length, 0)
    assert.equal(second.markMissed.length, 0)
  })

  it('marks a missed occurrence without firing it', async () => {
    const h = harness(new Date('2026-10-29T08:00:00+08:00'))
    const task = await h.repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    // The 10-29 09:00 occurrence fired normally; then the process slept through
    // 10-30 09:00 and woke at 09:30 (outside the 5-minute grace window).
    await h.repo.applyTick(
      [{ taskId: task.id, firedKey: `${task.id}@2026-10-29T01:00:00.000Z`, firedAt: '2026-10-29T01:00:04.000Z' }],
      new Date('2026-10-29T09:00:04+08:00'),
    )
    await h.repo.flush()
    const plan = await tick(h, new Date('2026-10-30T09:30:00+08:00'))
    assert.equal(plan.fire.length, 0)
    assert.equal(plan.markMissed.length, 1)
    assert.equal(h.repo.get(task.id)?.state.missedCount, 1)
  })
})

describe('tick — one-off nodes', () => {
  it('fires the start node, then the end node on a later tick', async () => {
    const h = harness(new Date('2026-11-05T13:59:30+08:00'))
    const task = await h.repo.create({
      title: '季度评审',
      kind: 'once',
      once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' },
    })
    const startPlan = await tick(h, new Date('2026-11-05T14:00:20+08:00'))
    assert.deepEqual(startPlan.fire.map((occurrence) => occurrence.phase), ['start'])
    assert.equal(h.repo.get(task.id)?.state.firedStart, true)
    assert.equal(h.repo.get(task.id)?.state.firedEnd, false)

    const endPlan = await tick(h, new Date('2026-11-05T18:00:20+08:00'))
    assert.deepEqual(endPlan.fire.map((occurrence) => occurrence.phase), ['end'])
    assert.equal(h.repo.get(task.id)?.state.firedEnd, true)
  })

  it('reports no fire for a paused one-off task', async () => {
    const h = harness(new Date('2026-11-05T13:00:00+08:00'))
    const task = await h.repo.create({
      title: '停掉的任务',
      kind: 'once',
      once: { startAt: '2026-11-05T14:00:00+08:00', endAt: '2026-11-05T18:00:00+08:00' },
    })
    await h.repo.pause(task.id)
    const plan = await tick(h, new Date('2026-11-05T14:00:20+08:00'))
    assert.equal(plan.fire.length, 0)
    assert.equal(plan.markMissed.length, 0)
  })
})

describe('tick — persistence discipline', () => {
  it('does not write when the plan is empty', async () => {
    const h = harness(new Date('2026-10-30T07:00:00+08:00'))
    await h.repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    await h.repo.flush()
    const before = h.fs.renameCount
    await tick(h, new Date('2026-10-30T08:30:00+08:00'))
    assert.equal(h.fs.renameCount, before, 'an empty plan must not rewrite the file')
  })

  it('records a whole missed backlog as missedCount', async () => {
    const h = harness(new Date('2026-10-26T07:00:00+08:00'))
    const task = await h.repo.create({ title: 'A', kind: 'recurring', rule: { preset: 'workdays', time: '09:00' } })
    await h.repo.flush()
    // Five workdays pass while the process is down.
    await tick(h, new Date('2026-10-30T10:00:00+08:00'))
    const after = h.repo.get(task.id)
    assert.equal(after?.state.missedCount, 5)
  })
})
