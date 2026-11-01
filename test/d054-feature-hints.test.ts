/**
 * F8.19 feature guide dialog (UX-29).
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { zh } from '../src/client/dictionary-zh.js'
import { en } from '../src/client/dictionary-en.js'

const here = dirname(fileURLToPath(import.meta.url))
const source = (name: string): string => readFileSync(join(here, '../../src/client', name), 'utf8')

describe('feature guide dialog', () => {
  it('shows both natural-language and system-notification hints', () => {
    const hints = source('feature-hints.ts')
    assert.ok(hints.includes("t('featureHints.nlp')"))
    assert.ok(hints.includes("t('featureHints.system')"))
    assert.ok(hints.includes('form.notify.guide'))
    assert.ok(hints.includes('Modal'))
    assert.ok(source('panel.ts').includes('h(FeatureHints'))
    assert.ok(source('panel.ts').includes('featureHelpOpen'))
    assert.ok(source('panel-header.ts').includes('onFeatureHelp'))
  })

  it('opens from the top header button, not from the task list', () => {
    const header = source('panel-header.ts')
    assert.ok(header.includes("t('featureHints.title')"))
    assert.ok(header.includes('onFeatureHelp'))
    assert.ok(source('panel.ts').includes('onFeatureHelp: () => setFeatureHelpOpen(true)'))
  })

  it('has all feature guide labels in both languages', () => {
    for (const key of ['title', 'nlp', 'nlpHint', 'system', 'openSettings', 'close']) {
      assert.ok((zh as Record<string, string>)[`featureHints.${key}`])
      assert.ok((en as Record<string, string>)[`featureHints.${key}`])
    }
  })

  it('keeps the toolbar flex row so search, scope and feature entry align', () => {
    assert.ok(source('styles.ts').includes('.dtd-toolbar{display:flex'))
  })

  it('names the entry 快捷功能说明', () => {
    assert.equal((zh as Record<string, string>)['featureHints.title'], '快捷功能说明')
  })

  it('shows enabled/disabled NLP wording without contradiction', () => {
    assert.ok(source('feature-hints.ts').includes("props.nlpEnabled ? 'featureHints.nlpHintOn' : 'featureHints.nlpHint'"))
    assert.ok((zh as Record<string, string>)['featureHints.nlpHintOn'])
    assert.ok((en as Record<string, string>)['featureHints.nlpHintOn'])
  })

  it('calls the system feature 桌面系统通知', () => {
    assert.equal((zh as Record<string, string>)['featureHints.system'], '桌面系统通知')
    assert.equal((en as Record<string, string>)['featureHints.system'], 'Desktop system notifications')
  })
})
