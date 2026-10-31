/**
 * 0.5.1 client experience: search scope (F8.17) and NLP degradation (F10.11).
 *
 * Pure helpers plus source-level contracts; behaviour that needs a real model or
 * a browser is covered by the E2E run described in 测试记录 §9.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { normalizeQuery, resolveSearchTarget, searchActive, stageLabelKey } from '../src/client/search-scope.js'
import { degradedReasonKey, mergeParsedDraft, missingRequiredOf, normalizeDegradedReason } from '../src/client/nlp-degraded.js'
import { emptyDraft, type TaskDraft } from '../src/client/task-draft.js'
import { zh } from '../src/client/dictionary-zh.js'
import { en } from '../src/client/dictionary-en.js'

const here = dirname(fileURLToPath(import.meta.url))
const source = (name: string): string => readFileSync(join(here, '../../src/client', name), 'utf8')
const ZONE = 'Asia/Shanghai'

/** A draft with a few explicit values. */
function draftOf(overrides: Partial<TaskDraft>): TaskDraft {
  return { ...emptyDraft(ZONE), title: '原任务', ...overrides }
}

describe('F8.17: resolveSearchTarget', () => {
  it('keeps the view when the query is empty or whitespace', () => {
    assert.equal(resolveSearchTarget('overdue', 'all', ''), 'overdue')
    assert.equal(resolveSearchTarget('overdue', 'all', '   '), 'overdue')
    assert.equal(searchActive('   '), false)
    assert.equal(normalizeQuery('  预算 '), '预算')
  })

  it('uses all tasks for the global scope and the view for the scoped one', () => {
    assert.equal(resolveSearchTarget('overdue', 'all', '预算'), 'all')
    assert.equal(resolveSearchTarget('overdue', 'view', '预算'), 'overdue')
    assert.equal(resolveSearchTarget('done', 'all', '报销'), 'all')
  })

  it('maps stages to dictionary keys', () => {
    assert.equal(stageLabelKey('notStarted'), 'tab.notStarted')
    assert.equal(stageLabelKey('inProgress'), 'tab.inProgress')
    assert.equal(stageLabelKey('overdue'), 'tab.overdue')
    assert.equal(stageLabelKey('done'), 'tab.done')
    assert.equal(stageLabelKey('recurring'), 'filter.recurring')
    assert.equal(stageLabelKey('paused'), 'filter.paused')
  })
})

describe('F10.11: degraded reason mapping', () => {
  it('keeps known reasons and normalizes unknown ones', () => {
    assert.equal(normalizeDegradedReason('llm_unavailable'), 'llm_unavailable')
    assert.equal(normalizeDegradedReason('timeout'), 'timeout')
    assert.equal(normalizeDegradedReason('bad_output'), 'bad_output')
    assert.equal(normalizeDegradedReason('disabled'), 'unknown')
    assert.equal(normalizeDegradedReason(undefined), 'unknown')
  })

  it('has both languages for every degraded key', () => {
    for (const reason of ['llm_unavailable', 'timeout', 'bad_output', 'unknown'] as const) {
      const key = degradedReasonKey(reason)
      assert.ok((zh as Record<string, string>)[key] !== undefined, key)
      assert.ok((en as Record<string, string>)[key] !== undefined, key)
    }
  })
})

describe('F10.11: mergeParsedDraft', () => {
  it('replaces untouched fields and keeps user edits', () => {
    const initial = draftOf({ title: '明天9点提醒我', description: '' })
    const current = draftOf({ title: '明天9点提醒我', description: '我自己写的说明' })
    const parsed = draftOf({ title: '交周报', description: '模型说明', kind: 'recurring', preset: 'weekly', weekdays: [5], time: '17:00' })
    const { draft, retained } = mergeParsedDraft(current, parsed, initial)
    assert.equal(draft.title, '交周报')
    assert.equal(draft.description, '我自己写的说明')
    assert.equal(draft.kind, 'recurring')
    assert.ok(retained.includes('description'))
  })

  it('compares array fields deeply', () => {
    const initial = draftOf({ weekdays: [] })
    const current = draftOf({ weekdays: [1, 3] })
    const parsed = draftOf({ weekdays: [5] })
    assert.deepEqual(mergeParsedDraft(current, parsed, initial).draft.weekdays, [1, 3])
    const untouched = mergeParsedDraft(draftOf({ weekdays: [] }), parsed, draftOf({ weekdays: [] }))
    assert.deepEqual(untouched.draft.weekdays, [5])
  })

  it('does not merge rule fields after the user switches kind', () => {
    const initial = draftOf({ kind: 'recurring', preset: 'weekly', weekdays: [5] })
    const current = draftOf({ kind: 'once', preset: 'weekly', weekdays: [5] })
    const parsed = draftOf({ kind: 'recurring', preset: 'monthly', monthDays: [1], time: '10:00' })
    const { draft, retained } = mergeParsedDraft(current, parsed, initial)
    assert.equal(draft.kind, 'once')
    assert.equal(draft.preset, 'weekly')
    assert.ok(retained.includes('preset'))
    assert.ok(retained.includes('monthDays'))
  })
})

describe('F10.11: missingRequiredOf', () => {
  it('checks the one-off window', () => {
    assert.deepEqual(missingRequiredOf(draftOf({ kind: 'once', endAt: '' })), ['endAt'])
    assert.deepEqual(missingRequiredOf(draftOf({ kind: 'once', endAt: '2026-11-01T18:00' })), [])
  })

  it('checks each recurring preset', () => {
    assert.deepEqual(missingRequiredOf(draftOf({ kind: 'recurring', preset: 'weekly', weekdays: [] })), ['weekdays'])
    assert.deepEqual(missingRequiredOf(draftOf({ kind: 'recurring', preset: 'monthly', monthDays: [] })), ['monthDays'])
    assert.deepEqual(missingRequiredOf(draftOf({ kind: 'recurring', preset: 'custom', cron: '' })), ['cron'])
    assert.deepEqual(missingRequiredOf(draftOf({ kind: 'recurring', preset: 'workdays', time: '25:00' })), ['time'])
  })

  it('flags an empty title', () => {
    assert.deepEqual(missingRequiredOf(draftOf({ title: '  ' })), ['title'])
  })
})

describe('F8.17/F10.11: source contracts', () => {
  it('the panel routes every load through resolveSearchTarget', () => {
    const panel = source('panel.ts')
    assert.ok(panel.includes('resolveSearchTarget(target, searchScope, query)'))
    assert.ok(panel.includes('api.snapshot(effective, query, controller.signal, 200)'))
    assert.ok(panel.includes('setNextCursor(snapshot.nextCursor)'))
  })

  it('the list bypasses ArchiveView while searching and shows stage badges', () => {
    const list = source('task-list.ts')
    assert.ok(list.includes("view === 'done' && props.searchActive !== true"))
    assert.ok(list.includes('showStage'))
    assert.ok(source('task-row.ts').includes('stageLabelKey(task.stage)'))
  })

  it('the editor renders the degraded banner, retry and dismiss', () => {
    const editor = source('task-editor.ts')
    for (const key of ['nlp.degraded.title', 'nlp.degraded.retry', 'nlp.degraded.dismiss']) {
      assert.ok(editor.includes(key), key)
    }
    assert.ok(editor.includes('degradedReasonKey'))
    assert.ok(editor.includes('mergeParsedDraft'))
  })

  it('disables invalid row actions and keeps the six-item menu', () => {
    assert.ok(source('task-row.ts').includes('!canComplete'))
    assert.ok(source('panel-menu.ts').includes('disabled: props.canPin === false'))
    assert.ok(source('panel-menu.ts').includes('disabled: props.canRemind === false'))
  })

  it('the toolbar has both scope buttons and a controlled hint', () => {
    const toolbar = source('panel-toolbar.ts')
    assert.ok(toolbar.includes("'nlp.searchScope.all'"))
    assert.ok(toolbar.includes("'nlp.searchScope.view'"))
    assert.ok(toolbar.includes('nlpHint'))
  })

  it('keeps every new dictionary key in both languages', () => {
    for (const key of [
      'search.placeholderAll',
      'search.placeholderView',
      'nlp.searchScope.all',
      'nlp.searchScope.view',
      'nlp.searchResult.all',
      'nlp.searchResult.view',
      'nlp.searchLimit',
      'nlp.searchAll',
      'nlp.degraded.title',
      'nlp.degraded.retry',
      'nlp.degraded.retrying',
      'nlp.degraded.dismiss',
    ]) {
      assert.ok((zh as Record<string, string>)[key] !== undefined, key)
      assert.ok((en as Record<string, string>)[key] !== undefined, key)
    }
  })
})

describe('F8.17: /snapshot all-view search crosses stages', () => {
  it('returns matching tasks from different stages', async () => {
    const { routes, repo } = (await import('./routeHarness.js')).routesFor(new Date('2026-10-30T12:00:00+08:00'))
    await repo.create({ title: 'Q4 预算申报', kind: 'once', once: { startAt: '2026-10-30T09:00:00+08:00', endAt: '2026-11-15T18:00:00+08:00' } })
    await repo.create({ title: '供应商资质年审', kind: 'once', once: { startAt: '2026-09-01T09:00:00+08:00', endAt: '2026-10-01T18:00:00+08:00' } })
    await repo.create({ title: '部门预算执行分析', kind: 'recurring', rule: { preset: 'monthly', monthDays: [31], time: '10:00' } })
    const { fakeRequest, fakeResponse } = await import('./fakeHttp.js')
    const response = fakeResponse()
    const entry = routes.find((route) => route.path.endsWith('/snapshot'))
    assert.ok(entry !== undefined)
    await entry.handler(fakeRequest({ url: '/api/dsh-todos-diy/snapshot?view=all&q=预算&limit=200' }) as never, response as never)
    const body = response.json<{ value: { items: { title: string }[]; counts: Record<string, number> } }>()
    assert.deepEqual(body.value.items.map((item) => item.title).sort(), ['Q4 预算申报', '部门预算执行分析'].sort())
    assert.equal(body.value.counts.overdue, 1, 'counts stay global')
  })
})

describe('F8.19 follow-up: group counts cover the full view, not the page', () => {
  it('reports exact group totals while the page is capped at 50', async () => {
    const { repo } = (await import('./routeHarness.js')).routesFor(new Date('2026-10-30T12:00:00+08:00'))
    for (let index = 0; index < 60; index += 1) {
      await repo.create({
        title: `批量任务 ${String(index).padStart(2, '0')}`,
        kind: 'once',
        once: { startAt: '2026-10-30T09:00:00+08:00', endAt: '2026-10-30T18:00:00+08:00' },
      })
    }
    const page = repo.list({ view: 'inProgress', limit: 50 })
    assert.equal(page.items.length, 50)
    assert.notEqual(page.nextCursor, null)
    assert.equal(page.groupCounts.high, 60)
    assert.equal(
      page.groupCounts.pinned + page.groupCounts.high + page.groupCounts.mid + page.groupCounts.low + page.groupCounts.none + page.groupCounts.paused,
      60,
    )
  })

  it('sums the client group counts', async () => {
    const { groupTotal } = await import('../src/client/search-scope.js')
    assert.equal(groupTotal({ pinned: 1, high: 96, mid: 192, low: 316, none: 396, paused: 0 }), 1001)
  })

  it('renders the list meta and load-more affordance', () => {
    const list = source('task-list.ts')
    assert.ok(list.includes("t('list.meta', { total, loaded })"))
    assert.ok(list.includes("t('list.loadMore')"))
    assert.ok(list.includes('groupCounts?.[group.key]'))
    const panel = source('panel.ts')
    assert.ok(panel.includes('fetchNextPage'))
    assert.ok(panel.includes('total: groupCounts === null ? undefined : groupTotal(groupCounts)'))
  })
})
