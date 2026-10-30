/**
 * `apply()` wiring test.
 *
 * Boots the real entry point against a fake Cordis context and a temporary data
 * directory, then asserts the two registrations the plugin owns: the route table
 * and the nine agent tools. This is the closest unit-level check to "the plugin
 * really mounts" without a full DSH boot.
 */

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, before, after } from 'node:test'

import { apply, inject, name } from '../src/host/index.js'

/** Recorded registrations. */
interface Recorded {
  routes: { kind: string; path: string }[]
  tools: string[]
  disposers: (() => void)[]
  intervals: number[]
  effects: string[]
}

/** Build a fake Cordis context that records everything `apply()` registers. */
function fakeCtx(recorded: Recorded) {
  const makeCtx = (impl: Record<string, unknown>): Record<string, unknown> => ({
    logger: { info: () => undefined, warn: () => undefined },
    get: () => undefined,
    effect: (fn: () => unknown, label: string) => {
      recorded.effects.push(label)
      const disposer = fn()
      if (typeof disposer === 'function') recorded.disposers.push(disposer as () => void)
      return () => undefined
    },
    interval: (callback: () => void, ms: number) => {
      recorded.intervals.push(ms)
      return () => undefined
    },
    inject: (deps: string[], callback: (ctx: unknown) => void) => {
      if (deps.includes('webServer')) {
        callback({
          ...makeCtx(impl),
          effect: (fn: () => unknown, label?: string) => {
            recorded.effects.push(label ?? '')
            const disposer = fn()
            if (typeof disposer === 'function') recorded.disposers.push(disposer as () => void)
            return () => undefined
          },
          webServer: {
            register: (route: { kind: string; path: string }) => {
              recorded.routes.push(route)
              return () => undefined
            },
          },
        })
      }
      if (deps.includes('tools')) {
        callback({
          ...makeCtx(impl),
          effect: (fn: () => unknown, label?: string) => {
            recorded.effects.push(label ?? '')
            const disposer = fn()
            if (typeof disposer === 'function') recorded.disposers.push(disposer as () => void)
            return () => undefined
          },
          tools: {
            register: (definition: { name: string }) => {
              recorded.tools.push(definition.name)
              return () => undefined
            },
          },
        })
      }
    },
  })
  return makeCtx({})
}

describe('apply() wiring', () => {
  let dataDir = ''
  const previousHome = process.env['DSH_HOME']

  before(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'dsh-todos-apply-'))
    process.env['DSH_HOME'] = dataDir
  })

  after(() => {
    if (previousHome === undefined) delete process.env['DSH_HOME']
    else process.env['DSH_HOME'] = previousHome
    rmSync(dataDir, { recursive: true, force: true })
  })

  it('exports the documented identity and required services', () => {
    assert.equal(name, 'dsh-todos-diy')
    assert.deepEqual(inject, ['timer'])
  })

  it('registers the route table and the twelve tools', () => {
    const recorded: Recorded = { routes: [], tools: [], disposers: [], intervals: [], effects: [] }
    apply(fakeCtx(recorded), { tickIntervalMs: 60_000, timeZone: 'Asia/Shanghai' })
    assert.equal(recorded.routes.length, 28, `expected 25 routes, got ${String(recorded.routes.length)}`)
    assert.ok(recorded.routes.every((route) => route.kind === 'exact'))
    assert.equal(recorded.tools.length, 12)
    assert.ok(recorded.effects.includes('todos-diy: scheduler'))
    assert.ok(recorded.effects.includes('todos-diy: routes'))
    assert.ok(recorded.effects.includes('todos-diy: tools'))
  })

  it('starts the scheduler at the configured interval', () => {
    const recorded: Recorded = { routes: [], tools: [], disposers: [], intervals: [], effects: [] }
    apply(fakeCtx(recorded), { tickIntervalMs: 30_000 })
    assert.ok(recorded.intervals.includes(30_000))
  })

  it('creates the data directory content only when something is written', () => {
    const recorded: Recorded = { routes: [], tools: [], disposers: [], intervals: [], effects: [] }
    apply(fakeCtx(recorded), {})
    // Loading a fresh store must not create tasks.json.
    assert.equal(existsSync(join(dataDir, 'dsh-todos-diy', 'tasks.json')), false)
  })

  it('disposes every registration without throwing', () => {
    const recorded: Recorded = { routes: [], tools: [], disposers: [], intervals: [], effects: [] }
    apply(fakeCtx(recorded), {})
    for (const dispose of recorded.disposers) assert.doesNotThrow(dispose)
  })
})
