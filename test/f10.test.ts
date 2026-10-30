/**
 * F10 natural-language task creation — parser, normalizer, prompt and route.
 *
 * The model is faked: these tests pin the contract the plugin relies on
 * (`ctx.llm.stream`) and the D-25 normalization rules, not the model quality.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildSystemPrompt, emptyNlpDraft } from '../src/host/nlp/prompt.js'
import { normalizeNlpOutput, addMinutesLocal, cleanTitle, isLocalDateTime } from '../src/host/nlp/normalize.js'
import { degradedResult, extractJson, parseTaskText, formatNow } from '../src/host/nlp/parse.js'
import { createNlpRoutes, resolveSelection } from '../src/host/nlp/routes.js'
import type { NlpLlm } from '../src/host/nlp/types.js'
import { routesFor } from './routeHarness.js'
import { fakeRequest, fakeResponse } from './fakeHttp.js'

const NOW = new Date('2026-10-30T15:30:00+08:00')
const ZONE = 'Asia/Shanghai'

/** A fake LLM that streams one answer. */
function fakeLlm(answer: string, options: { delayMs?: number } = {}): NlpLlm {
  return {
    async *stream() {
      if (options.delayMs !== undefined) await new Promise((resolve) => setTimeout(resolve, options.delayMs))
      yield { type: 'text-delta', text: answer }
      yield { type: 'finish' }
    },
  }
}

describe('F10 prompt', () => {
  it('states the D-25 window rules', () => {
    const prompt = buildSystemPrompt('2026-10-30 15:30', ZONE)
    assert.ok(prompt.includes('once.endAt 必填'))
    assert.ok(prompt.includes('once.startAt 可省略'))
    assert.ok(prompt.includes('endReminder=false'))
    assert.equal(prompt.includes('dueDate'), false)
  })

  it('renders the clock in the target zone', () => {
    assert.equal(formatNow(NOW, ZONE), '2026-10-30 15:30 Fri')
    assert.equal(formatNow(NOW, 'UTC'), '2026-10-30 07:30 Fri')
  })
})

describe('F10 normalize', () => {
  it('defaults endAt to start+1h and drops the end reminder', () => {
    const result = normalizeNlpOutput(
      { kind: 'once', title: '交周报', once: { startAt: '2026-10-31T09:00', endAt: null }, confidence: 0.9 },
      { now: NOW, timeZone: ZONE },
    )
    assert.equal(result.draft.startAt, '2026-10-31T09:00')
    assert.equal(result.draft.endAt, '2026-10-31T10:00')
    assert.equal(result.draft.endReminder, false)
    assert.equal(result.fieldStatus.endAt, 'default')
  })

  it('keeps an explicit window untouched', () => {
    const result = normalizeNlpOutput(
      { kind: 'once', title: '开会', once: { startAt: '2026-10-31T14:00', endAt: '2026-10-31T18:00' }, confidence: 0.9 },
      { now: NOW, timeZone: ZONE },
    )
    assert.equal(result.draft.endAt, '2026-10-31T18:00')
    assert.equal(result.draft.endReminder, true)
    assert.equal(result.fieldStatus.endAt, 'explicit')
  })

  it('treats a deadline-only answer as created-start', () => {
    const result = normalizeNlpOutput(
      { kind: 'once', title: '交材料', once: { startAt: null, endAt: '2026-10-31T18:00' } },
      { now: NOW, timeZone: ZONE },
    )
    assert.equal(result.draft.startAt, '')
    assert.equal(result.draft.startAtSource, 'created')
    assert.equal(result.draft.endAt, '2026-10-31T18:00')
  })

  it('reports missing times when the model gave nothing', () => {
    const result = normalizeNlpOutput({ kind: 'once', title: 'x', once: null }, { now: NOW, timeZone: ZONE })
    assert.deepEqual(result.missingRequired.sort(), ['endAt', 'startAt'])
    assert.equal(result.draft.startAt, '')
  })

  it('falls back to +1h when the window is reversed', () => {
    const result = normalizeNlpOutput(
      { kind: 'once', title: 'x', once: { startAt: '2026-10-31T18:00', endAt: '2026-10-31T09:00' } },
      { now: NOW, timeZone: ZONE },
    )
    assert.equal(result.draft.endAt, '2026-10-31T19:00')
    assert.equal(result.fieldStatus.endAt, 'default')
  })

  it('normalizes recurring presets and missing weekday lists', () => {
    const weekly = normalizeNlpOutput(
      { kind: 'recurring', title: '交周报', rule: { preset: 'weekly', time: '17:00', weekdays: [5] } },
      { now: NOW, timeZone: ZONE },
    )
    assert.equal(weekly.draft.preset, 'weekly')
    assert.deepEqual(weekly.draft.weekdays, [5])
    assert.deepEqual(weekly.missingRequired, [])
    const bare = normalizeNlpOutput(
      { kind: 'recurring', title: '周报', rule: { preset: 'weekly', time: '17:00' } },
      { now: NOW, timeZone: ZONE },
    )
    assert.deepEqual(bare.missingRequired, ['weekdays'])
  })

  it('falls back to the raw sentence when the model omits the title', () => {
    const result = normalizeNlpOutput(
      { kind: 'once', title: null, once: { startAt: '2026-10-31T09:00' } },
      { now: NOW, timeZone: ZONE, fallbackTitle: '明天9点提醒我' },
    )
    assert.equal(result.draft.title, '明天9点提醒我')
    assert.equal(result.fieldStatus.title, 'default')
  })

  it('honours singleTime to mark the inferred end as default', () => {
    const result = normalizeNlpOutput(
      { kind: 'once', title: 'x', singleTime: true, once: { startAt: '2026-10-31T09:00', endAt: '2026-10-31T10:00' } },
      { now: NOW, timeZone: ZONE },
    )
    assert.equal(result.fieldStatus.endAt, 'default')
    assert.equal(result.draft.endReminder, false)
  })

  it('clamps title length and strips filler prefixes', () => {
    assert.equal(cleanTitle('提醒我交周报', 'fallback'), '交周报')
    assert.equal(cleanTitle(null, '原文'), '原文')
    assert.equal(cleanTitle('x'.repeat(300), 'y').length, 200)
  })

  it('adds minutes across a day boundary', () => {
    assert.equal(addMinutesLocal('2026-10-31T23:30', 60), '2026-11-01T00:30')
    assert.equal(isLocalDateTime('2026-10-31T23:30'), true)
    assert.equal(isLocalDateTime('2026-10-31 23:30'), false)
  })
})

describe('F10 parse', () => {
  it('parses a model answer into a degraded-free result', async () => {
    const answer = JSON.stringify({
      kind: 'recurring',
      title: '交周报',
      rule: { preset: 'weekly', time: '17:00', weekdays: [5] },
      notify: { advanceMinutes: 10 },
      confidence: 0.93,
    })
    const result = await parseTaskText({ text: '每周五下午5点提醒我交周报，提前10分钟', now: NOW, timeZone: ZONE, llm: fakeLlm(answer), selection: { provider: 'p', model: 'm' } })
    assert.equal(result.degraded, false)
    assert.equal(result.draft.kind, 'recurring')
    assert.equal(result.draft.advanceMinutes, 10)
    assert.deepEqual(result.draft.weekdays, [5])
  })

  it('extracts JSON from fenced answers', async () => {
    const result = await parseTaskText({
      text: 'x',
      now: NOW,
      timeZone: ZONE,
      llm: fakeLlm('```json\n{"kind":"once","title":"x","once":{"startAt":"2026-10-31T09:00"}}\n```'),
      selection: { provider: 'p', model: 'm' },
    })
    assert.equal(result.degraded, false)
    assert.equal(result.draft.endAt, '2026-10-31T10:00')
  })

  it('degrades on bad JSON instead of throwing', async () => {
    const result = await parseTaskText({ text: '明天九点', now: NOW, timeZone: ZONE, llm: fakeLlm('not json'), selection: { provider: 'p', model: 'm' } })
    assert.equal(result.degraded, true)
    assert.equal(result.reason, 'bad_output')
    assert.equal(result.draft.title, '明天九点')
  })

  it('degrades when no model route exists', async () => {
    const result = await parseTaskText({ text: '明天九点', now: NOW, timeZone: ZONE, llm: undefined, selection: undefined })
    assert.equal(result.degraded, true)
    assert.equal(result.reason, 'llm_unavailable')
  })

  it('times out to a degraded result', async () => {
    const result = await parseTaskText({
      text: '明天九点',
      now: NOW,
      timeZone: ZONE,
      llm: fakeLlm('{}', { delayMs: 200 }),
      selection: { provider: 'p', model: 'm' },
      timeoutMs: 10,
    })
    assert.equal(result.degraded, true)
    assert.equal(result.reason, 'timeout')
  })

  it('keeps the raw text in the degraded draft', () => {
    const result = degradedResult('明天九点提醒我', ZONE, 'bad_output')
    assert.equal(result.draft.title, '明天九点提醒我')
    assert.deepEqual(result.missingRequired, ['endAt'])
  })

  it('extractJson tolerates prose around the object', () => {
    assert.deepEqual(extractJson('好的：{"a":1} 以上'), { a: 1 })
    assert.equal(extractJson('no object'), null)
  })
})

describe('F10 route', () => {
  const selection = { currentSelection: () => ({ provider: 'p', model: 'm' }) }

  it('answers nlp_disabled until the user opts in', async () => {
    const { routes } = routesFor(NOW, { llm: fakeLlm('{}'), agentDefaultModel: selection })
    const res = await callRoute(routes, '/parse', { method: 'POST', body: { text: '明天九点' } })
    assert.equal(res.statusCode, 409)
    assert.equal(res.json<{ error: { code: string } }>().error.code, 'nlp_disabled')
  })

  it('parses when enabled', async () => {
    const { routes, repo } = routesFor(NOW, {
      llm: fakeLlm(JSON.stringify({ kind: 'once', title: '开会', once: { startAt: '2026-10-31T14:00', endAt: '2026-10-31T18:00' } })),
      agentDefaultModel: selection,
    })
    repo.updateSettings({ nlp: { enabled: true } })
    const res = await callRoute(routes, '/parse', { method: 'POST', body: { text: '明天下午2点到6点开会' } })
    assert.equal(res.statusCode, 200)
    const value = res.json<{ value: { draft: { title: string }; degraded: boolean } }>().value
    assert.equal(value.degraded, false)
    assert.equal(value.draft.title, '开会')
  })

  it('degrades when the host has no LLM service', async () => {
    const { routes, repo } = routesFor(NOW)
    repo.updateSettings({ nlp: { enabled: true } })
    const res = await callRoute(routes, '/parse', { method: 'POST', body: { text: '明天九点' } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json<{ value: { degraded: boolean; reason: string } }>().value.reason, 'llm_unavailable')
  })

  it('rejects empty or over-long text', async () => {
    const { routes, repo } = routesFor(NOW, { llm: fakeLlm('{}'), agentDefaultModel: selection })
    repo.updateSettings({ nlp: { enabled: true } })
    for (const text of ['', 'x'.repeat(501)]) {
      const res = await callRoute(routes, '/parse', { method: 'POST', body: { text } })
      assert.equal(res.statusCode, 400)
    }
  })

  it('resolveSelection falls back to the first provider/model', async () => {
    const host = {
      llm: {
        ...fakeLlm('{}'),
        listProviders: () => [{ id: 'p1', name: 'P1' }],
        listModels: async () => [{ id: 'm1', name: 'M1' }],
      },
    }
    assert.deepEqual(await resolveSelection(host), { provider: 'p1', model: 'm1' })
    assert.equal(await resolveSelection({}), undefined)
  })

  it('builds one route', () => {
    const { ctx } = routesFor(NOW)
    assert.equal(createNlpRoutes(ctx).length, 1)
  })
})

async function callRoute(
  routes: ReturnType<typeof routesFor>['routes'],
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<ReturnType<typeof fakeResponse>> {
  const entry = routes.find((route) => route.path.endsWith(path))
  assert.ok(entry !== undefined, `route ${path} not registered`)
  const res = fakeResponse()
  await entry.handler(
    fakeRequest({ url: `/api/dsh-todos-diy${path}`, method: options.method ?? 'GET', ...(options.body === undefined ? {} : { body: options.body }) }) as never,
    res as never,
  )
  return res
}
