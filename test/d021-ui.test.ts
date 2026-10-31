/**
 * 0.2.1 client experience fixes (FIX-01…FIX-05 + P2-F).
 *
 * Pure helpers and source-level contract checks only: React components are not
 * rendered in node:test, so behaviour that lives in JSX is asserted against the
 * module that owns it.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { ruleSummary } from '../src/client/task-summary.js'
import { emptyDraft, validateDraft } from '../src/client/task-draft.js'
import { zh } from '../src/client/dictionary-zh.js'
import { en } from '../src/client/dictionary-en.js'
import type { TaskView } from '../src/host/taskView.js'
import { makeCreatedTask, makeOnceTask } from './fixtures.js'
import { toTaskView } from '../src/host/taskView.js'

const here = dirname(fileURLToPath(import.meta.url))
const clientSource = (name: string): string => readFileSync(join(here, '../../src/client', name), 'utf8')
const NOW = new Date('2026-11-05T12:00:00+08:00')
const t = (key: string, params?: Record<string, string | number>): string => {
  const template = (zh as Record<string, string>)[key] ?? key
  if (params === undefined) return template
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template)
}

/** Project a fixture into a TaskView. */
const view = (task: ReturnType<typeof makeOnceTask>): TaskView => toTaskView(task, { now: NOW })

describe('FIX-03: a created-start task shows only its deadline', () => {
  it('omits the internal start time', () => {
    const task = makeCreatedTask('2026-11-05T09:00:00+08:00', '2026-11-06T18:00:00+08:00')
    const text = ruleSummary(view(task), t)
    assert.equal(text, '单次 · 截止 2026-11-06 18:00')
    assert.equal(text.includes('→'), false)
  })

  it('keeps the range for an explicit start', () => {
    const task = makeOnceTask('2026-11-05T14:00:00+08:00', '2026-11-05T18:00:00+08:00')
    const text = ruleSummary(view(task), t)
    assert.equal(text, '单次 · 2026-11-05 14:00 → 2026-11-05 18:00')
  })

  it('has the deadline-only string in both languages', () => {
    assert.ok((zh as Record<string, string>)['task.onceDeadlineOnly']?.includes('{end}'))
    assert.ok((en as Record<string, string>)['task.onceDeadlineOnly']?.includes('{end}'))
  })
})

describe('FIX-04: field-level validation', () => {
  it('marks endAt when it is missing', () => {
    const draft = { ...emptyDraft('Asia/Shanghai'), kind: 'once' as const, title: 'x', endAt: '' }
    const result = validateDraft(draft, t)
    assert.equal(result.fieldErrors.endAt, '结束时间为必填')
    assert.equal(result.error, undefined)
  })

  it('marks endAt when it is not after startAt', () => {
    const draft = {
      ...emptyDraft('Asia/Shanghai'),
      kind: 'once' as const,
      title: 'x',
      startAt: '2026-11-05T18:00',
      endAt: '2026-11-05T14:00',
    }
    assert.equal(validateDraft(draft, t).fieldErrors.endAt, '结束时间必须晚于开始时间')
  })

  it('passes a valid one-off window', () => {
    const draft = {
      ...emptyDraft('Asia/Shanghai'),
      kind: 'once' as const,
      title: 'x',
      startAt: '2026-11-05T14:00',
      endAt: '2026-11-05T18:00',
    }
    assert.deepEqual(validateDraft(draft, t), { fieldErrors: {} })
  })

  it('reports a missing title at form level', () => {
    const draft = { ...emptyDraft('Asia/Shanghai'), title: '  ' }
    assert.equal(validateDraft(draft, t).error, '必填')
  })

  it('accepts a recurring draft without a window', () => {
    assert.deepEqual(validateDraft({ ...emptyDraft('Asia/Shanghai'), title: 'x' }, t), { fieldErrors: {} })
  })

  it('renders aria-invalid and the message in OnceFields', () => {
    const fields = clientSource('editor-fields.ts')
    assert.ok(fields.includes("'aria-invalid'"))
    assert.ok(fields.includes('dtd-field-error'))
    assert.ok(clientSource('task-editor.ts').includes('validateDraft'))
  })
})

describe('FIX-02: settings dialog uses its own save label', () => {
  it('has settings.save in both dictionaries', () => {
    assert.equal((zh as Record<string, string>)['settings.save'], '保存设置')
    assert.equal((en as Record<string, string>)['settings.save'], 'Save settings')
  })

  it('settings modal uses settings.save, not form.save', () => {
    const source = clientSource('settings-modal.ts')
    assert.ok(source.includes("t('settings.save')"))
    assert.equal(source.includes("t('form.save')"), false)
  })
})

describe('FIX-01: panel guards against stale snapshot responses', () => {
  it('keeps a request sequence and an abort controller', () => {
    const source = clientSource('panel.ts')
    assert.ok(source.includes('requestSeqRef'))
    assert.ok(source.includes('abortRef'))
    assert.ok(source.includes('controller.abort') || source.includes('.abort()'))
    assert.ok(source.includes('seq !== requestSeqRef.current'))
  })

  it('passes an AbortSignal to api.snapshot', () => {
    assert.ok(clientSource('panel.ts').includes('api.snapshot(effective, query, controller.signal, 200)'))
    assert.ok(clientSource('api.ts').includes('signal?: AbortSignal'))
  })

  it('shows the loading skeleton on an explicit view/search switch', () => {
    const source = clientSource('panel.ts')
    assert.ok(source.includes('void load(view, search, true)'))
    assert.ok(source.includes('resolveSearchTarget(target, searchScope, query)'))
  })
})

describe('FIX-05: completing a never-fired recurring task skips the next run', () => {
  it('api.complete sends skipNext when requested', () => {
    const source = clientSource('api.ts')
    assert.ok(source.includes('skipNext?: boolean'))
    assert.ok(source.includes('skipNext === true ? { skipNext: true }'))
  })

  it('panel decides skipNext from lastOccurrenceKey', () => {
    const source = clientSource('panel.ts')
    assert.ok(source.includes("task.kind === 'recurring' && task.state.lastOccurrenceKey === null"))
    assert.ok(source.includes('api.complete(task.id, undefined, skipNext)'))
    assert.ok(source.includes("t('toast.skippedNext')"))
  })

  it('has the skip toast in both languages', () => {
    assert.equal((zh as Record<string, string>)['toast.skippedNext'], '已跳过下一次提醒')
    assert.equal((en as Record<string, string>)['toast.skippedNext'], 'Next reminder skipped')
  })
})

describe('P2-F/F8.17: search placeholder follows the scope', () => {
  it('has both scope wordings and uses the dynamic key', () => {
    assert.equal((zh as Record<string, string>)['search.placeholderAll'], '搜索全部任务')
    assert.equal((zh as Record<string, string>)['search.placeholderView'], '在当前视图内搜索')
    assert.ok(clientSource('panel-toolbar.ts').includes("t(props.searchScope === 'all' ? 'search.placeholderAll' : 'search.placeholderView')"))
  })
})
